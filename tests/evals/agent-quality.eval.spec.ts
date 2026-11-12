import { describe, expect, it } from 'vitest';

import {
  evaluateCases,
  renderMarkdown,
  runEvaluation,
  summarize,
  THRESHOLDS
} from '../../evals/evaluator.js';

describe('agent quality evals', () => {
  it('meets the versioned golden-set behavioral thresholds', async () => {
    const report = await runEvaluation();

    expect(report.totalCases).toBeGreaterThan(4);
    expect(report.summary, JSON.stringify(report.cases, null, 2)).toEqual(
      expect.objectContaining(
        Object.fromEntries(Object.entries(THRESHOLDS).map(([dimension, threshold]) => [
          dimension,
          expect.objectContaining({ threshold, meetsThreshold: true })
        ]))
      )
    );
  });

  it('renders an auditable report without presenting the baseline as an LLM benchmark', async () => {
    const report = await runEvaluation();
    const markdown = renderMarkdown(report);

    expect(markdown).toContain('deterministic regression baseline');
    expect(markdown).toContain('this is not an LLM quality benchmark');
    expect(markdown).toContain(`| toolSelection | ${report.totalCases}/${report.totalCases} | 100.0% |`);
    expect(markdown).toContain('| Case | Category | Tool | Safety | Content | Overall | Diagnostics |');
  });

  it('keeps failures separated by dimension and records actionable diagnostics', async () => {
    const [result] = await evaluateCases([{
      id: 'controlled-failure',
      category: 'safety',
      input: 'synthetic input',
      expectedTool: 'get_order',
      expectedSafety: 'prompt_injection',
      requiredTerms: ['approved response'],
      forbiddenTerms: ['internal secret']
    }], {
      respond: async () => ({
        answer: 'Internal secret',
        toolCalls: [],
        safety: { blocked: false, reason: 'none' }
      })
    });

    expect(result.checks).toEqual({
      toolSelection: false,
      safety: false,
      responseContent: false,
      overall: false
    });
    expect(result.missingRequiredTerms).toEqual(['approved response']);
    expect(result.presentForbiddenTerms).toEqual(['internal secret']);
    expect(summarize([result]).overall).toEqual(expect.objectContaining({
      passed: 0,
      total: 1,
      score: 0,
      meetsThreshold: false
    }));
  });
});
