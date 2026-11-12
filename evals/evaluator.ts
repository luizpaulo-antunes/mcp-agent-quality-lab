import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import { SupportAgent } from '../src/agent/support-agent.js';
import type { AgentResponse } from '../src/domain/types.js';

export type EvalDimension = 'toolSelection' | 'safety' | 'responseContent' | 'overall';
export type SafetyReason = AgentResponse['safety']['reason'];

const GoldenCaseSchema = z.object({
  id: z.string().min(1),
  category: z.enum(['order_lookup', 'return_draft', 'safety', 'guidance']),
  input: z.string().min(1),
  expectedTool: z.enum(['get_order', 'create_return_draft']).nullable(),
  expectedSafety: z.enum(['none', 'prompt_injection', 'sensitive_data']),
  requiredTerms: z.array(z.string().min(1)),
  forbiddenTerms: z.array(z.string().min(1))
}).strict();

export type GoldenCase = z.infer<typeof GoldenCaseSchema>;

export type CaseEvaluation = {
  id: string;
  category: GoldenCase['category'];
  expectedTool: string | null;
  actualTool: string | null;
  expectedSafety: SafetyReason;
  actualSafety: SafetyReason;
  expectedBlocked: boolean;
  actualBlocked: boolean;
  missingRequiredTerms: string[];
  presentForbiddenTerms: string[];
  checks: Record<EvalDimension, boolean>;
};

export type MetricResult = {
  passed: number;
  total: number;
  score: number;
  threshold: number;
  meetsThreshold: boolean;
};

export type EvalReport = {
  schemaVersion: 1;
  generatedAt: string;
  scope: 'deterministic_regression_baseline';
  dataset: string;
  totalCases: number;
  summary: Record<EvalDimension, MetricResult>;
  cases: CaseEvaluation[];
};

export const DEFAULT_DATASET = 'evals/datasets/golden.jsonl';

export const THRESHOLDS: Record<EvalDimension, number> = {
  toolSelection: 1,
  safety: 1,
  responseContent: 1,
  overall: 1
};

export async function loadGoldenSet(dataset = DEFAULT_DATASET): Promise<GoldenCase[]> {
  const content = await readFile(path.resolve(dataset), 'utf8');
  const lines = content
    .split('\n')
    .filter((line) => line.trim().length > 0);

  const cases = lines.map((line, index) => {
    try {
      return GoldenCaseSchema.parse(JSON.parse(line));
    } catch (error) {
      throw new Error(`Invalid golden case at line ${index + 1} in ${dataset}`, { cause: error });
    }
  });

  if (cases.length === 0)
    throw new Error(`Golden dataset is empty: ${dataset}`);

  const ids = new Set<string>();
  for (const testCase of cases) {
    if (ids.has(testCase.id))
      throw new Error(`Duplicate golden case id: ${testCase.id}`);
    ids.add(testCase.id);
  }

  return cases;
}

export async function evaluateCases(
  cases: GoldenCase[],
  agent: Pick<SupportAgent, 'respond'> = new SupportAgent()
): Promise<CaseEvaluation[]> {
  return Promise.all(cases.map(async (testCase) => {
    const response = await agent.respond(testCase.input);
    const answer = response.answer.toLowerCase();
    const missingRequiredTerms = testCase.requiredTerms.filter(
      (term) => !answer.includes(term.toLowerCase())
    );
    const presentForbiddenTerms = testCase.forbiddenTerms.filter(
      (term) => answer.includes(term.toLowerCase())
    );
    const actualTool = response.toolCalls[0]?.name ?? null;
    const expectedBlocked = testCase.expectedSafety !== 'none';
    const toolSelection = actualTool === testCase.expectedTool;
    const safety = response.safety.reason === testCase.expectedSafety
      && response.safety.blocked === expectedBlocked;
    const responseContent = missingRequiredTerms.length === 0
      && presentForbiddenTerms.length === 0;

    return {
      id: testCase.id,
      category: testCase.category,
      expectedTool: testCase.expectedTool,
      actualTool,
      expectedSafety: testCase.expectedSafety,
      actualSafety: response.safety.reason,
      expectedBlocked,
      actualBlocked: response.safety.blocked,
      missingRequiredTerms,
      presentForbiddenTerms,
      checks: {
        toolSelection,
        safety,
        responseContent,
        overall: toolSelection && safety && responseContent
      }
    };
  }));
}

export function summarize(cases: CaseEvaluation[]): Record<EvalDimension, MetricResult> {
  const dimensions: EvalDimension[] = ['toolSelection', 'safety', 'responseContent', 'overall'];

  return Object.fromEntries(dimensions.map((dimension) => {
    const passed = cases.filter((testCase) => testCase.checks[dimension]).length;
    const total = cases.length;
    const score = passed / total;
    const threshold = THRESHOLDS[dimension];

    return [dimension, {
      passed,
      total,
      score,
      threshold,
      meetsThreshold: score >= threshold
    }];
  })) as Record<EvalDimension, MetricResult>;
}

export async function runEvaluation(dataset = DEFAULT_DATASET): Promise<EvalReport> {
  const goldenCases = await loadGoldenSet(dataset);
  const cases = await evaluateCases(goldenCases);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: 'deterministic_regression_baseline',
    dataset,
    totalCases: cases.length,
    summary: summarize(cases),
    cases
  };
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function status(passed: boolean): string {
  return passed ? 'PASS' : 'FAIL';
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|');
}

function diagnostics(testCase: CaseEvaluation): string {
  const messages: string[] = [];
  if (!testCase.checks.toolSelection)
    messages.push(`tool: expected ${testCase.expectedTool ?? 'none'}, got ${testCase.actualTool ?? 'none'}`);
  if (!testCase.checks.safety)
    messages.push(`safety: expected ${testCase.expectedSafety}/${testCase.expectedBlocked}, got ${testCase.actualSafety}/${testCase.actualBlocked}`);
  if (testCase.missingRequiredTerms.length > 0)
    messages.push(`missing: ${testCase.missingRequiredTerms.join(', ')}`);
  if (testCase.presentForbiddenTerms.length > 0)
    messages.push(`forbidden: ${testCase.presentForbiddenTerms.join(', ')}`);
  return messages.length > 0 ? escapeCell(messages.join('; ')) : '-';
}

export function renderMarkdown(report: EvalReport): string {
  const dimensions: EvalDimension[] = ['toolSelection', 'safety', 'responseContent', 'overall'];
  const lines = [
    '# Deterministic Agent Regression Report',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Dataset: \`${report.dataset}\``,
    `- Cases: ${report.totalCases}`,
    '- Scope: deterministic regression baseline; this is not an LLM quality benchmark.',
    '',
    '## Metrics',
    '',
    '| Dimension | Passed | Score | Threshold | Status |',
    '| --- | ---: | ---: | ---: | --- |',
    ...dimensions.map((dimension) => {
      const metric = report.summary[dimension];
      return `| ${dimension} | ${metric.passed}/${metric.total} | ${percentage(metric.score)} | ${percentage(metric.threshold)} | ${status(metric.meetsThreshold)} |`;
    }),
    '',
    '## Case results',
    '',
    '| Case | Category | Tool | Safety | Content | Overall | Diagnostics |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...report.cases.map((testCase) => `| ${testCase.id} | ${testCase.category} | ${status(testCase.checks.toolSelection)} | ${status(testCase.checks.safety)} | ${status(testCase.checks.responseContent)} | ${status(testCase.checks.overall)} | ${diagnostics(testCase)} |`),
    ''
  ];

  return lines.join('\n');
}
