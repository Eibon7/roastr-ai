#!/usr/bin/env node

/**
 * Regenerate coverage-summary.json from coverage-final.json
 * Temporary utility for Issue #525
 */

const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

const rootDir = path.resolve(__dirname, '..');
const coverageFinalPath = path.join(rootDir, 'coverage', 'coverage-final.json');
const coverageSummaryPath = path.join(rootDir, 'coverage', 'coverage-summary.json');

logger.info('📊 Regenerating coverage-summary.json from coverage-final.json');
logger.info('');

try {
  // Check if coverage-final.json exists
  if (!fs.existsSync(coverageFinalPath)) {
    logger.error(`❌ Error: Coverage file not found at ${coverageFinalPath}`);
    logger.error('');
    logger.error('Please run tests with coverage first:');
    logger.error('  npm test -- --coverage');
    logger.error('');
    process.exit(1);
  }

  // Read and parse coverage-final.json
  let coverageFinal;
  try {
    const coverageData = fs.readFileSync(coverageFinalPath, 'utf8');
    coverageFinal = JSON.parse(coverageData);
  } catch (parseError) {
    logger.error(`❌ Error: Failed to parse ${coverageFinalPath}`);
    logger.error('');
    logger.error('Details:', parseError.message);
    logger.error('');
    logger.error('The coverage file may be corrupted. Try regenerating it:');
    logger.error('  npm test -- --coverage');
    logger.error('');
    process.exit(1);
  }

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
    Object.values(data.s).forEach((v) => {
      if (v > 0) fileSummary.statements.covered++;
    });

    // Count covered functions
    Object.values(data.f || {}).forEach((v) => {
      if (v > 0) fileSummary.functions.covered++;
    });

    // Count branches
    Object.values(data.b || {}).forEach((arr) => {
      fileSummary.branches.total += arr.length;
      arr.forEach((v) => {
        if (v > 0) fileSummary.branches.covered++;
      });
    });

    // Lines coverage = statements coverage
    fileSummary.lines.covered = fileSummary.statements.covered;

    // Add percentages
    ['lines', 'statements', 'functions', 'branches'].forEach((key) => {
      fileSummary[key].pct =
        fileSummary[key].total > 0
          ? (fileSummary[key].covered / fileSummary[key].total) * 100
          : 100;
    });

    summary[filePath] = fileSummary;

    // Add to totals
    ['lines', 'statements', 'functions', 'branches'].forEach((key) => {
      totals[key].total += fileSummary[key].total;
      totals[key].covered += fileSummary[key].covered;
    });
  }

  // Calculate total percentages
  ['lines', 'statements', 'functions', 'branches'].forEach((key) => {
    totals[key].pct = totals[key].total > 0 ? (totals[key].covered / totals[key].total) * 100 : 100;
  });
  totals.branchesTrue.pct = 100;

  logger.info(`✓ Processed ${fileCount} source files`);
  logger.info('');
  logger.info('Total Coverage:');
  logger.info(
    `  Lines: ${totals.lines.pct.toFixed(2)}% (${totals.lines.covered}/${totals.lines.total})`
  );
  logger.info(
    `  Statements: ${totals.statements.pct.toFixed(2)}% (${totals.statements.covered}/${totals.statements.total})`
  );
  logger.info(
    `  Functions: ${totals.functions.pct.toFixed(2)}% (${totals.functions.covered}/${totals.functions.total})`
  );
  logger.info(
    `  Branches: ${totals.branches.pct.toFixed(2)}% (${totals.branches.covered}/${totals.branches.total})`
  );
  logger.info('');

  // Ensure coverage directory exists
  const coverageDir = path.dirname(coverageSummaryPath);
  if (!fs.existsSync(coverageDir)) {
    logger.info(`Creating coverage directory: ${coverageDir}`);
    fs.mkdirSync(coverageDir, { recursive: true });
  }

  // Write summary
  try {
    fs.writeFileSync(coverageSummaryPath, JSON.stringify(summary, null, 2));
    logger.info(`✅ coverage-summary.json regenerated → ${coverageSummaryPath}`);
  } catch (writeError) {
    logger.error(`❌ Error: Failed to write ${coverageSummaryPath}`);
    logger.error('');
    logger.error('Details:', writeError.message);
    logger.error('');
    logger.error('Check file permissions and disk space.');
    logger.error('');
    process.exit(1);
  }
} catch (error) {
  logger.error('❌ Error regenerating coverage summary:', error.message);
  logger.error('');
  logger.error('Stack trace:');
  logger.error(error.stack);
  logger.error('');
  process.exit(1);
}
