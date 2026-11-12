import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { renderMarkdown, runEvaluation } from './evaluator.js';

const outputDirectory = path.resolve('eval-results');
const report = await runEvaluation();

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    path.join(outputDirectory, 'agent-quality.json'),
    `${JSON.stringify(report, null, 2)}\n`
  ),
  writeFile(
    path.join(outputDirectory, 'agent-quality.md'),
    renderMarkdown(report)
  )
]);

for (const [dimension, metric] of Object.entries(report.summary))
  console.log(`${dimension}: ${metric.passed}/${metric.total} (${(metric.score * 100).toFixed(1)}%)`);

const failedDimensions = Object.entries(report.summary)
  .filter(([, metric]) => !metric.meetsThreshold)
  .map(([dimension]) => dimension);

if (failedDimensions.length > 0) {
  console.error(`Regression thresholds failed: ${failedDimensions.join(', ')}`);
  process.exitCode = 1;
}
