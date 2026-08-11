#!/usr/bin/env node
/**
 * Renders coverage/coverage-summary.json as a markdown table for the CI job summary.
 *
 * Writes to stdout; the workflow appends it to $GITHUB_STEP_SUMMARY. Never fails the
 * build — a missing report means the test step already failed and has the real message.
 */

import { readFileSync } from 'node:fs';

const METRICS = ['statements', 'branches', 'functions', 'lines'];

let total;
try {
  total = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8')).total;
} catch {
  console.log('### Coverage\n\nNo coverage report was produced.');
  process.exit(0);
}

const rows = METRICS.map((m) => {
  const { pct, covered, total: n } = total[m];
  return `| ${m} | ${pct.toFixed(2)}% | ${covered}/${n} |`;
});

console.log(
  ['### Coverage', '', '| Metric | % | Covered |', '| --- | --- | --- |', ...rows, ''].join('\n'),
);
