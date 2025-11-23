#!/usr/bin/env node

/**
 * Get Real Test Coverage - SOURCE OF TRUTH
 *
 * This script is the SINGLE SOURCE OF TRUTH for test coverage numbers.
 * Always use this script to get accurate coverage data.
 *
 * Reads coverage-summary.json and displays consistent coverage numbers
 *
 * Usage:
 *   node scripts/get-coverage.js          # Human-readable format
 *   node scripts/get-coverage.js --json    # JSON format for scripts
 *   node scripts/get-coverage.js --short   # One-line summary
 */

const fs = require('fs');
const path = require('path');

const coveragePath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');

if (!fs.existsSync(coveragePath)) {
  console.error('❌ Coverage file not found. Run tests with coverage first:');
  console.error('   npm test -- --coverage');
  process.exit(1);
}

try {
  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const total = coverage.total;

  // Calculate average
  const avg =
    (total.lines.pct + total.statements.pct + total.functions.pct + total.branches.pct) / 4;

  if (process.argv.includes('--json')) {
    // JSON output for scripts/automation
    console.log(
      JSON.stringify(
        {
          lines: {
            pct: total.lines.pct,
            covered: total.lines.covered,
            total: total.lines.total
          },
          statements: {
            pct: total.statements.pct,
            covered: total.statements.covered,
            total: total.statements.total
          },
          functions: {
            pct: total.functions.pct,
            covered: total.functions.covered,
            total: total.functions.total
          },
          branches: {
            pct: total.branches.pct,
            covered: total.branches.covered,
            total: total.branches.total
          },
          average: avg,
          status:
            avg >= 70
              ? 'excellent'
              : avg >= 50
                ? 'good'
                : avg >= 30
                  ? 'needs_improvement'
                  : 'critical'
        },
        null,
        2
      )
    );
  } else if (process.argv.includes('--short')) {
    // One-line summary
    console.log(
      `Coverage: ${avg.toFixed(2)}% (Lines: ${total.lines.pct.toFixed(2)}%, Functions: ${total.functions.pct.toFixed(2)}%, Branches: ${total.branches.pct.toFixed(2)}%)`
    );
  } else {
    // Human-readable format
    console.log('\n📊 Test Coverage Report (SOURCE OF TRUTH)\n');
    console.log('═'.repeat(50));
    console.log(
      `Lines:      ${total.lines.pct.toFixed(2)}% (${total.lines.covered}/${total.lines.total})`
    );
    console.log(
      `Statements: ${total.statements.pct.toFixed(2)}% (${total.statements.covered}/${total.statements.total})`
    );
    console.log(
      `Functions:  ${total.functions.pct.toFixed(2)}% (${total.functions.covered}/${total.functions.total})`
    );
    console.log(
      `Branches:   ${total.branches.pct.toFixed(2)}% (${total.branches.covered}/${total.branches.total})`
    );
    console.log('═'.repeat(50));

    // Status indicator
    let status, emoji;
    if (avg >= 70) {
      status = 'EXCELLENT';
      emoji = '✅';
    } else if (avg >= 50) {
      status = 'GOOD';
      emoji = '🟡';
    } else if (avg >= 30) {
      status = 'NEEDS IMPROVEMENT';
      emoji = '🟠';
    } else {
      status = 'CRITICAL - Needs immediate attention';
      emoji = '🔴';
    }

    console.log(`${emoji} Coverage: ${status}`);
    console.log(`\n📈 Average: ${avg.toFixed(2)}%`);
    console.log(`🎯 Target: 70%+\n`);
    console.log('💡 Always use this script for accurate coverage numbers!');
    console.log('   node scripts/get-coverage.js\n');
  }
} catch (error) {
  console.error('❌ Error reading coverage file:', error.message);
  process.exit(1);
}
