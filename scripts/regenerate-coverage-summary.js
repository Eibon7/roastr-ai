#!/usr/bin/env node

/**
 * Regenerate coverage-summary.json from coverage-final.json
 * Temporary utility for Issue #525
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const coverageFinalPath = path.join(rootDir, 'coverage', 'coverage-final.json');
const coverageSummaryPath = path.join(rootDir, 'coverage', 'coverage-summary.json');

console.log('📊 Regenerating coverage-summary.json from coverage-final.json');
console.log('');

// Read coverage-final.json
const coverageFinal = JSON.parse(fs.readFileSync(coverageFinalPath, 'utf8'));

// Calculate totals
const totals = {
  lines: { total: 0, covered: 0, skipped: 0 },
  statements: { total: 0, covered: 0, skipped: 0 },
  functions: { total: 0, covered: 0, skipped: 0 },
  branches: { total: 0, covered: 0, skipped: 0 },
  branchesTrue: { total: 0, covered: 0, skipped: 0 }
};

const summary = { total: totals };
let fileCount = 0;

for (const [filePath, data] of Object.entries(coverageFinal)) {
  if (!data.s || !data.statementMap) continue;

  fileCount++;

  // Calculate file metrics
  const fileSummary = {
    lines: { total: Object.keys(data.statementMap).length, covered: 0, skipped: 0 },
    statements: { total: Object.keys(data.s).length, covered: 0, skipped: 0 },
    functions: { total: Object.keys(data.f || {}).length, covered: 0, skipped: 0 },
    branches: { total: 0, covered: 0, skipped: 0 }
  };

  // Count covered statements
  Object.values(data.s).forEach(v => {
    if (v > 0) fileSummary.statements.covered++;
  });

  // Count covered functions
  Object.values(data.f || {}).forEach(v => {
    if (v > 0) fileSummary.functions.covered++;
  });

  // Count branches
  Object.values(data.b || {}).forEach(arr => {
    fileSummary.branches.total += arr.length;
    arr.forEach(v => {
      if (v > 0) fileSummary.branches.covered++;
    });
  });

  // Lines coverage = statements coverage
  fileSummary.lines.covered = fileSummary.statements.covered;

  // Add percentages
  ['lines', 'statements', 'functions', 'branches'].forEach(key => {
    fileSummary[key].pct = fileSummary[key].total > 0
      ? (fileSummary[key].covered / fileSummary[key].total) * 100
      : 100;
  });

  summary[filePath] = fileSummary;

  // Add to totals
  ['lines', 'statements', 'functions', 'branches'].forEach(key => {
    totals[key].total += fileSummary[key].total;
    totals[key].covered += fileSummary[key].covered;
  });
}

// Calculate total percentages
['lines', 'statements', 'functions', 'branches'].forEach(key => {
  totals[key].pct = totals[key].total > 0
    ? (totals[key].covered / totals[key].total) * 100
    : 100;
});
totals.branchesTrue.pct = 100;

console.log(`✓ Processed ${fileCount} source files`);
console.log('');
console.log('Total Coverage:');
console.log(`  Lines: ${totals.lines.pct.toFixed(2)}% (${totals.lines.covered}/${totals.lines.total})`);
console.log(`  Statements: ${totals.statements.pct.toFixed(2)}% (${totals.statements.covered}/${totals.statements.total})`);
console.log(`  Functions: ${totals.functions.pct.toFixed(2)}% (${totals.functions.covered}/${totals.functions.total})`);
console.log(`  Branches: ${totals.branches.pct.toFixed(2)}% (${totals.branches.covered}/${totals.branches.total})`);
console.log('');

// Write summary
fs.writeFileSync(coverageSummaryPath, JSON.stringify(summary, null, 2));
console.log(`✅ coverage-summary.json regenerated → ${coverageSummaryPath}`);
