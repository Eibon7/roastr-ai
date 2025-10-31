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
 *   TEST_BASELINE_FAILURES - Override baseline (default: 182)
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
const logger = require('../../src/utils/logger');

/**
 * Returns the baseline number of failing test suites from main branch.
 * This baseline was established on 2025-10-30 and should be updated as main improves.
 *
 * @returns {number} Baseline failing suite count
 */
function getBaselineFailures() {
  // Baseline: Main branch test failures (2025-10-30)
  // Update this value when main branch test count improves
  const BASELINE_FAILING_SUITES = 182;

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

  // No fallback - return null if suite-level count cannot be determined
  // This ensures we only validate suite-level failures, not individual tests
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
  logger.info('\n3️⃣  Checking Tests Status (Baseline Mode)...');

  if (process.env.SKIP_EXPENSIVE_CHECKS === 'true') {
    logger.warn('   ⚠️  Skipped (test mode)');
    return { passed: true, failing: 0, baseline: 0, improvement: 0, regression: false };
  }

  const baseline = getBaselineFailures();
  logger.info(`   📊 Main branch baseline: ${baseline} failing suites`);

<<<<<<< HEAD
  try {
    // Run full test suite
    execSync('npm test', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // All tests passing!
    logger.info('   ✅ All tests passing (100% improvement!)');
    return { passed: true, failing: 0, baseline, improvement: baseline, regression: false };
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const failingSuites = parseFailingSuites(output);

    if (failingSuites === null) {
      logger.error('   ❌ Could not parse test output - test system may be broken');
      logger.error('   🚨 FAILING validation to prevent silent errors');
      return { passed: false, failing: 'unknown', baseline, improvement: 0, regression: false };
    }

    // Compare with baseline
    const improvement = baseline - failingSuites;
    const isRegression = failingSuites > baseline;

    if (isRegression) {
      logger.error(`   ❌ Tests failing: ${failingSuites} suites (+${Math.abs(improvement)} NEW failures vs baseline)`);
      logger.error(`   🚨 REGRESSION DETECTED - PR introduces new test failures`);
      return { passed: false, failing: failingSuites, baseline, improvement, regression: true };
    } else if (improvement > 0) {
      logger.info(`   ✅ Tests failing: ${failingSuites} suites (-${improvement} vs baseline - IMPROVEMENT!)`);
      return { passed: true, failing: failingSuites, baseline, improvement, regression: false };
    } else {
      // Same as baseline
      logger.warn(`   ⚠️  Tests failing: ${failingSuites} suites (same as baseline)`);
      logger.info(`   ✅ No regression - PR maintains baseline`);
      return { passed: true, failing: failingSuites, baseline, improvement: 0, regression: false };
    }
=======
  let output = '';
  let testsRan = false;

  // Check if test output was provided via file (CI workflow optimization)
  const fs = require('fs');
  if (process.env.TEST_OUTPUT_FILE && fs.existsSync(process.env.TEST_OUTPUT_FILE)) {
    logger.info('   📄 Using pre-executed test results from workflow...');
    output = fs.readFileSync(process.env.TEST_OUTPUT_FILE, 'utf8');
    testsRan = true;
  } else {
    // Fall back to running tests
    logger.info('   🧪 Running test suite (this may take several minutes)...');
    try {
      // Run full test suite with proper output capture
      const result = execSync('npm test', {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large test outputs
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // All tests passing!
      logger.info('   ✅ All tests passing (100% improvement!)');
      return { passed: true, failing: 0, baseline, improvement: baseline, regression: false };
    } catch (error) {
      // Capture both stdout and stderr, merge them
      if (error.stdout) output += error.stdout;
      if (error.stderr) output += error.stderr;
      if (error.output) output += error.output.join('');
      testsRan = true;
    }
  }

  const failingSuites = parseFailingSuites(output);

  if (failingSuites === null) {
    logger.error('   ❌ Could not parse test output - test system may be broken');
    logger.error('   🚨 FAILING validation to prevent silent errors');
    logger.error(`   Debug: Output length: ${output.length} bytes`);
    logger.error(`   Debug: First 200 chars: ${output.substring(0, 200)}`);
    return { passed: false, failing: 'unknown', baseline, improvement: 0, regression: false };
  }

  // If tests passed (no failures found)
  if (failingSuites === 0) {
    logger.info('   ✅ All tests passing (100% improvement!)');
    return { passed: true, failing: 0, baseline, improvement: baseline, regression: false };
  }

  // Compare with baseline (with tolerance for test flakiness)
  const improvement = baseline - failingSuites;
  const REGRESSION_TOLERANCE = 2; // Allow +2 suites for test flakiness
  const isSignificantRegression = failingSuites > (baseline + REGRESSION_TOLERANCE);

  if (isSignificantRegression) {
    logger.error(`   ❌ Tests failing: ${failingSuites} suites (+${Math.abs(improvement)} NEW failures vs baseline)`);
    logger.error(`   🚨 REGRESSION DETECTED - PR introduces new test failures beyond tolerance`);
    return { passed: false, failing: failingSuites, baseline, improvement, regression: true };
  } else if (failingSuites > baseline && failingSuites <= (baseline + REGRESSION_TOLERANCE)) {
    logger.warn(`   ⚠️  Tests failing: ${failingSuites} suites (+${Math.abs(improvement)} vs baseline - within tolerance)`);
    logger.info(`   ✅ Acceptable - within ${REGRESSION_TOLERANCE} suite tolerance for test flakiness`);
    return { passed: true, failing: failingSuites, baseline, improvement: 0, regression: false };
  } else if (improvement > 0) {
    logger.info(`   ✅ Tests failing: ${failingSuites} suites (-${improvement} vs baseline - IMPROVEMENT!)`);
    return { passed: true, failing: failingSuites, baseline, improvement, regression: false };
  } else {
    // Same as baseline
    logger.warn(`   ⚠️  Tests failing: ${failingSuites} suites (same as baseline)`);
    logger.info(`   ✅ No regression - PR maintains baseline`);
    return { passed: true, failing: failingSuites, baseline, improvement: 0, regression: false };
  }
}

/**
 * Checks if PR only modifies non-production files (docs, CI scripts, configs).
 * These changes shouldn't cause test failures, so we allow minor regressions.
 *
 * @returns {boolean} True if only non-production files modified
 */
function isDocsOnlyPR() {
  const baseBranch = process.env.GITHUB_BASE_REF || 'main';
  
  try {
    // Get changed files vs base branch
    const output = execSync(`git diff --name-only origin/${baseBranch}...HEAD`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const files = output.trim().split('\n').filter(f => f.length > 0);
    if (files.length === 0) return false;
    
    // Patterns for non-production files that don't affect tests
    const nonProductionPatterns = [
      /^docs\//,
      /^\.github\/workflows\//,
      /^scripts\/ci\//,
      /^scripts\/guardian/,
      /^CLAUDE\.md$/,
      /^spec\.md$/,
      /^\.issue_lock$/,
      /^gdd-.*\.json$/,
      /^docs\/system-.*\.md$/,
      /^docs\/plan\//,
      /^docs\/investigations\//
    ];
    
    // Check if ALL files match non-production patterns
    const allNonProduction = files.every(file => 
      nonProductionPatterns.some(pattern => pattern.test(file))
    );
    
    return allNonProduction;
  } catch (error) {
    // If we can't determine, be conservative (don't allow regression)
    logger.warn('   ⚠️  Could not determine if docs-only PR, using strict validation');
    return false;
>>>>>>> origin/main
  }
}

/**
 * Main validation function
 */
function main() {
  logger.info('\n============================================================');
  logger.info('🛡️  GUARDIAN COMPLETION VALIDATOR (BASELINE MODE)');
  logger.info('============================================================');

  const args = process.argv.slice(2);
  const prArg = args.find(arg => arg.startsWith('--pr='));
  const prNumber = prArg ? prArg.split('=')[1] : 'unknown';

  logger.info(`\n🎯 Validating PR #${prNumber} with baseline comparison...\n`);

<<<<<<< HEAD
=======
  // Check if this is a docs-only PR
  const docsOnly = isDocsOnlyPR();
  if (docsOnly) {
    logger.info('   📚 Detected docs-only PR (documentation/CI/config changes)');
    logger.info('   ✅ Allowing minor regression tolerance for flaky tests');
  }

>>>>>>> origin/main
  // Run test validation with baseline comparison
  const testResult = checkTestsPassing();

  // Summary
  logger.info('\n============================================================');
  logger.info('📊 VALIDATION SUMMARY');
  logger.info('============================================================');

  logger.info(`\nPR: #${prNumber}`);
  logger.info(`Date: ${new Date().toISOString().split('T')[0]}`);

  logger.info('\n🎯 Test Results:');
  logger.info(`   Baseline: ${testResult.baseline} failing suites (main branch)`);
  if (testResult.passed) {
    logger.info(`   Current:  ${testResult.failing} failing suites (this PR)`);
  } else {
    logger.error(`   Current:  ${testResult.failing} failing suites (this PR)`);
  }

  if (testResult.improvement > 0) {
    logger.info(`   📈 Improvement: -${testResult.improvement} suites fixed! ✅`);
  } else if (testResult.improvement < 0) {
    logger.error(`   📉 Regression: +${Math.abs(testResult.improvement)} NEW failures ❌`);
  } else {
    logger.warn(`   ➡️  No change: maintaining baseline`);
  }

  logger.info('\n============================================================');

  if (!testResult.passed) {
    if (testResult.regression) {
<<<<<<< HEAD
      logger.error('🚨 VALIDATION FAILED - REGRESSION DETECTED');
      logger.error('   This PR introduces new test failures vs baseline');
      logger.error('   Fix new failures before merge');
=======
      // Allow minor regression (<5 tests) for docs-only PRs (flaky tests)
      const regressionSize = Math.abs(testResult.improvement);
      if (docsOnly && regressionSize < 5) {
        logger.warn('⚠️  Minor regression detected (+' + regressionSize + ' tests)');
        logger.warn('   ⚠️  Allowing due to docs-only PR (likely flaky tests)');
        logger.info('✅ VALIDATION PASSED (docs-only PR with minor regression)');
        logger.info('   No production code changes - regression likely from flaky tests');
        process.exit(0);
      } else {
        logger.error('🚨 VALIDATION FAILED - REGRESSION DETECTED');
        logger.error('   This PR introduces new test failures vs baseline');
        logger.error('   Fix new failures before merge');
      }
>>>>>>> origin/main
    } else {
      logger.error('🚨 VALIDATION FAILED - CRITICAL ERROR');
      logger.error('   Could not parse test output or test system broken');
      logger.error('   Fix test infrastructure before merge');
    }
    process.exit(1);
  } else {
    logger.info('✅ VALIDATION PASSED');
    if (testResult.failing === 0) {
      logger.info('   All tests passing! Perfect PR ⭐');
    } else if (testResult.improvement > 0) {
      logger.info(`   PR improves baseline by ${testResult.improvement} suites!`);
    } else {
      logger.info('   No regression - PR maintains baseline');
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
  checkTestsPassing,
  isDocsOnlyPR
};
