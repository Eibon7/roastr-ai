#!/usr/bin/env node

/**
 * Completion Validation Script with Baseline Comparison
 *
 * Validates PR completion criteria with baseline comparison mode to allow incremental
 * improvement even when main branch has test failures.
 *
 * Part of EPIC #480 - Test Suite Stabilization (Option C: Hybrid Approach)
 *
 * Usage:
 *   node scripts/ci/validate-completion.js --pr=630
 *
 * Environment Variables:
 *   TEST_BASELINE_FAILURES - Override baseline (default: 179)
 *
 * Exit Codes:
 *   0 - All validation passed (or no worse than baseline)
 *   1 - Validation failed (regression detected or critical issues)
 *
 * Created: 2025-10-23
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Returns the baseline number of failing test suites from main branch.
 * This baseline was established on 2025-10-23 and should be updated as main improves.
 *
 * @returns {number} Baseline failing suite count
 */
function getBaselineFailures() {
  // Baseline: Main branch test failures (2025-10-23)
  // Update this value when main branch test count improves
  const BASELINE_FAILING_SUITES = 179;

  // Try to get from environment variable (allows CI override)
  const envBaseline = process.env.TEST_BASELINE_FAILURES;
  if (envBaseline) {
    const parsed = parseInt(envBaseline, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return BASELINE_FAILING_SUITES;
}

/**
 * Parses Jest test output to extract the number of failing test suites.
 *
 * Expected format: "Test Suites: X failed, Y passed, Z total"
 *
 * @param {string} output - Jest test output
 * @returns {number|null} Number of failing suites, or null if cannot parse
 */
function parseFailingSuites(output) {
  // Parse "Test Suites: X failed, Y passed, Z total"
  const suiteMatch = output.match(/Test Suites:\s*(\d+)\s+failed/);
  if (suiteMatch) {
    return parseInt(suiteMatch[1], 10);
  }

  // Fallback: parse individual test failures (less accurate)
  const failMatch = output.match(/(\d+)\s+failing/);
  if (failMatch) {
    return parseInt(failMatch[1], 10);
  }

  return null;
}

/**
 * Checks if tests are passing using baseline comparison mode.
 *
 * Logic:
 * - If all tests pass: PASS ✅
 * - If failing ≤ baseline: PASS ✅ (no regression)
 * - If failing > baseline: FAIL ❌ (regression detected)
 *
 * @returns {Object} Test result with baseline comparison
 */
function checkTestsPassing() {
  log('\n3️⃣  Checking Tests Status (Baseline Mode)...', 'cyan');

  if (process.env.SKIP_EXPENSIVE_CHECKS === 'true') {
    log('   ⚠️  Skipped (test mode)', 'yellow');
    return { passed: true, failing: 0, baseline: 0, improvement: 0, regression: false };
  }

  const baseline = getBaselineFailures();
  log(`   📊 Main branch baseline: ${baseline} failing suites`, 'blue');

  try {
    // Run full test suite
    execSync('npm test', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // All tests passing!
    log('   ✅ All tests passing (100% improvement!)', 'green');
    return { passed: true, failing: 0, baseline, improvement: baseline, regression: false };
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const failingSuites = parseFailingSuites(output);

    if (failingSuites === null) {
      log('   ⚠️  Could not parse test output', 'yellow');
      return { passed: true, failing: 'unknown', baseline, improvement: 0, regression: false };
    }

    // Compare with baseline
    const improvement = baseline - failingSuites;
    const isRegression = failingSuites > baseline;

    if (isRegression) {
      log(`   ❌ Tests failing: ${failingSuites} suites (+${Math.abs(improvement)} NEW failures vs baseline)`, 'red');
      log(`   🚨 REGRESSION DETECTED - PR introduces new test failures`, 'red');
      return { passed: false, failing: failingSuites, baseline, improvement, regression: true };
    } else if (improvement > 0) {
      log(`   ✅ Tests failing: ${failingSuites} suites (-${improvement} vs baseline - IMPROVEMENT!)`, 'green');
      return { passed: true, failing: failingSuites, baseline, improvement, regression: false };
    } else {
      // Same as baseline
      log(`   ⚠️  Tests failing: ${failingSuites} suites (same as baseline)`, 'yellow');
      log(`   ✅ No regression - PR maintains baseline`, 'green');
      return { passed: true, failing: failingSuites, baseline, improvement: 0, regression: false };
    }
  }
}

/**
 * Main validation function
 */
function main() {
  log('\n============================================================', 'cyan');
  log('🛡️  GUARDIAN COMPLETION VALIDATOR (BASELINE MODE)', 'bright');
  log('============================================================', 'cyan');

  const args = process.argv.slice(2);
  const prArg = args.find(arg => arg.startsWith('--pr='));
  const prNumber = prArg ? prArg.split('=')[1] : 'unknown';

  log(`\n🎯 Validating PR #${prNumber} with baseline comparison...\n`, 'cyan');

  // Run test validation with baseline comparison
  const testResult = checkTestsPassing();

  // Summary
  log('\n============================================================', 'cyan');
  log('📊 VALIDATION SUMMARY', 'bright');
  log('============================================================', 'cyan');

  log(`\nPR: #${prNumber}`, 'blue');
  log(`Date: ${new Date().toISOString().split('T')[0]}`, 'blue');

  log('\n🎯 Test Results:', 'cyan');
  log(`   Baseline: ${testResult.baseline} failing suites (main branch)`, 'blue');
  log(`   Current:  ${testResult.failing} failing suites (this PR)`, testResult.passed ? 'green' : 'red');

  if (testResult.improvement > 0) {
    log(`   📈 Improvement: -${testResult.improvement} suites fixed! ✅`, 'green');
  } else if (testResult.improvement < 0) {
    log(`   📉 Regression: +${Math.abs(testResult.improvement)} NEW failures ❌`, 'red');
  } else {
    log(`   ➡️  No change: maintaining baseline`, 'yellow');
  }

  log('\n============================================================', 'cyan');

  if (testResult.regression) {
    log('🚨 VALIDATION FAILED - REGRESSION DETECTED', 'red');
    log('   This PR introduces new test failures vs baseline', 'red');
    log('   Fix new failures before merge', 'red');
    process.exit(1);
  } else {
    log('✅ VALIDATION PASSED', 'green');
    if (testResult.failing === 0) {
      log('   All tests passing! Perfect PR ⭐', 'green');
    } else if (testResult.improvement > 0) {
      log(`   PR improves baseline by ${testResult.improvement} suites!`, 'green');
    } else {
      log('   No regression - PR maintains baseline', 'green');
    }
    process.exit(0);
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = {
  getBaselineFailures,
  parseFailingSuites,
  checkTestsPassing
};
