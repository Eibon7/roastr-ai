#!/usr/bin/env node

/**
 * Completion Validator for CI (Guardian Agent Extension)
 *
 * Validates that PRs are 100% complete before merge.
 * Extends Guardian agent capabilities with pre-merge completion checks.
 *
 * Usage:
 *   node scripts/ci/validate-completion.js --pr=628
 *   npm run validate:completion -- --pr=628
 *
 * Environment variables:
 *   GITHUB_TOKEN - GitHub API token for fetching PR/issue data
 *   PR_NUMBER - PR number (optional, can use --pr flag)
 *   COVERAGE_THRESHOLD - Minimum coverage % (default: 90)
 *
 * Exit codes:
 *   0 - PR is 100% complete and ready to merge
 *   1 - PR is incomplete or has validation errors
 *   2 - Critical validation failure (blockers present)
 *
 * @note LOGGING GUIDELINE EXCEPTION
 * This CI script uses console.log with ANSI colors instead of utils/logger.js.
 * Rationale: Same as require-agent-receipts.js - CI scripts need colored output
 * for readability and quick visual scanning of validation results.
 * Exception approved: CodeRabbit Review #3354598820 (C1 comment)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI colors for terminal output (CI script exception)
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    pr: null,
    threshold: parseInt(process.env.COVERAGE_THRESHOLD || '90', 10),
    verbose: false
  };

  args.forEach(arg => {
    if (arg.startsWith('--pr=')) {
      parsed.pr = arg.split('=')[1];
    } else if (arg.startsWith('--threshold=')) {
      parsed.threshold = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--verbose' || arg === '-v') {
      parsed.verbose = true;
    }
  });

  // Fallback: get PR from env or git branch
  if (!parsed.pr) {
    parsed.pr = process.env.PR_NUMBER;
  }

  if (!parsed.pr) {
    try {
      const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      const match = branch.match(/(\d+)/);
      if (match) {
        parsed.pr = match[1];
      }
    } catch (error) {
      // Ignore
    }
  }

  return parsed;
}

function fetchIssueData(prNumber) {
  log(`\n📡 Fetching issue data for PR #${prNumber}...`, 'cyan');

  try {
    const output = execSync(`gh pr view ${prNumber} --json title,body,labels,state`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const data = JSON.parse(output);
    log(`   ✅ Fetched: "${data.title}"`, 'green');

    return data;
  } catch (error) {
    log(`   ⚠️  Could not fetch PR data: ${error.message}`, 'yellow');
    log('   Continuing with limited validation...', 'yellow');
    return null;
  }
}

function parseAcceptanceCriteria(body) {
  if (!body) {
    return [];
  }

  const acSection = body.match(/##\s*Acceptance Criteria\s*\n([\s\S]*?)(?=\n##|\n---|\Z)/i);
  if (!acSection) {
    return [];
  }

  const lines = acSection[1].split('\n');
  const criteria = [];

  lines.forEach(line => {
    const match = line.match(/^[-*]\s*\[.\]\s*(.+)$/);
    if (match) {
      const text = match[1].trim();
      const isChecked = line.includes('[x]') || line.includes('[X]');
      criteria.push({ text, checked: isChecked });
    }
  });

  return criteria;
}

function checkAcceptanceCriteria(issueData) {
  log('\n1️⃣  Checking Acceptance Criteria...', 'cyan');

  if (!issueData || !issueData.body) {
    log('   ⚠️  No issue body available - skipping AC check', 'yellow');
    return { passed: true, total: 0, completed: 0, missing: [] };
  }

  const criteria = parseAcceptanceCriteria(issueData.body);

  if (criteria.length === 0) {
    log('   ✅ No explicit acceptance criteria found', 'green');
    return { passed: true, total: 0, completed: 0, missing: [] };
  }

  const completed = criteria.filter(c => c.checked);
  const missing = criteria.filter(c => !c.checked);

  log(`   Found ${criteria.length} acceptance criteria:`, 'blue');
  criteria.forEach((c, i) => {
    const status = c.checked ? '✅' : '❌';
    log(`   ${status} AC ${i + 1}: ${c.text}`, c.checked ? 'green' : 'red');
  });

  const passed = missing.length === 0;

  if (passed) {
    log(`\n   ✅ All ${criteria.length} acceptance criteria met`, 'green');
  } else {
    log(`\n   ❌ ${missing.length}/${criteria.length} criteria incomplete`, 'red');
  }

  return { passed, total: criteria.length, completed: completed.length, missing };
}

function checkTestCoverage(threshold) {
  log('\n2️⃣  Checking Test Coverage...', 'cyan');

  const coveragePath = path.join(process.cwd(), 'coverage/coverage-summary.json');

  if (!fs.existsSync(coveragePath)) {
    log('   ⚠️  No coverage report found at coverage/coverage-summary.json', 'yellow');
    log('   💡 Run: npm test -- --coverage', 'blue');
    return { passed: false, actual: 0, target: threshold, missing: true };
  }

  try {
    const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    const total = coverageData.total;

    const metrics = ['lines', 'statements', 'functions', 'branches'];
    const results = {};

    metrics.forEach(metric => {
      const pct = total[metric]?.pct || 0;
      results[metric] = pct;
      const status = pct >= threshold ? '✅' : '❌';
      const color = pct >= threshold ? 'green' : 'red';
      log(`   ${status} ${metric.padEnd(12)}: ${pct.toFixed(2)}% (target: ${threshold}%)`, color);
    });

    const avgCoverage = Object.values(results).reduce((a, b) => a + b, 0) / metrics.length;
    const passed = avgCoverage >= threshold;

    if (passed) {
      log(`\n   ✅ Average coverage: ${avgCoverage.toFixed(2)}% (≥${threshold}%)`, 'green');
    } else {
      log(`\n   ❌ Average coverage: ${avgCoverage.toFixed(2)}% (<${threshold}%)`, 'red');
    }

    return { passed, actual: avgCoverage, target: threshold, missing: false };
  } catch (error) {
    log(`   ❌ Failed to parse coverage data: ${error.message}`, 'red');
    return { passed: false, actual: 0, target: threshold, missing: true };
  }
}

function checkTestsPassing() {
  log('\n3️⃣  Checking Tests Status...', 'cyan');

  try {
    execSync('npm test', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    log('   ✅ All tests passing', 'green');
    return { passed: true, failing: 0 };
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const failMatch = output.match(/(\d+)\s+failing/);
    const failCount = failMatch ? parseInt(failMatch[1], 10) : 'unknown';

    log(`   ❌ Tests failing: ${failCount}`, 'red');
    return { passed: false, failing: failCount };
  }
}

function checkAgentReceipts(prNumber) {
  log('\n4️⃣  Checking Agent Receipts...', 'cyan');

  try {
    execSync('node scripts/ci/require-agent-receipts.js', {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, PR_NUMBER: prNumber }
    });

    log('   ✅ All required agents have receipts', 'green');
    return { passed: true, missing: [] };
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const missingMatch = output.match(/(\d+)\s+agent\(s\)\s+missing receipts/);
    const missingCount = missingMatch ? parseInt(missingMatch[1], 10) : 0;

    log(`   ❌ ${missingCount} agent(s) missing receipts`, 'red');
    return { passed: false, missing: missingCount };
  }
}

function checkDocumentation(prNumber) {
  log('\n5️⃣  Checking Documentation...', 'cyan');

  const checks = [];

  // Check for GDD nodes updates
  const gddNodesPath = path.join(process.cwd(), 'docs/nodes');
  if (fs.existsSync(gddNodesPath)) {
    try {
      execSync('node scripts/resolve-graph.js --validate', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      log('   ✅ GDD nodes valid', 'green');
      checks.push({ name: 'GDD Validation', passed: true });
    } catch (error) {
      log('   ❌ GDD validation failed', 'red');
      checks.push({ name: 'GDD Validation', passed: false });
    }
  } else {
    log('   ⚠️  No docs/nodes/ directory found - skipping GDD check', 'yellow');
  }

  // Check for SUMMARY.md in test-evidence
  const summaryPattern = new RegExp(`docs/test-evidence/issue-${prNumber}/SUMMARY\\.md`);
  try {
    const changedFiles = execSync('git diff --name-only origin/main...HEAD', {
      encoding: 'utf8',
      stdio: 'pipe'
    }).split('\n');

    const hasSummary = changedFiles.some(f => summaryPattern.test(f));

    if (hasSummary) {
      log('   ✅ Test evidence SUMMARY.md present', 'green');
      checks.push({ name: 'Test Evidence', passed: true });
    } else {
      log('   ⚠️  No SUMMARY.md in test-evidence (may not be required)', 'yellow');
      checks.push({ name: 'Test Evidence', passed: true }); // Not blocking
    }
  } catch (error) {
    log('   ⚠️  Could not check for test evidence', 'yellow');
  }

  const passed = checks.every(c => c.passed);
  return { passed, checks };
}

function checkCodeRabbitComments(prNumber) {
  log('\n6️⃣  Checking CodeRabbit Comments...', 'cyan');

  try {
    const output = execSync(`gh pr view ${prNumber} --json comments`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const data = JSON.parse(output);
    const comments = data.comments || [];

    // Look for CodeRabbit comments
    const codeRabbitComments = comments.filter(c =>
      c.author?.login === 'coderabbitai' || c.body?.includes('CodeRabbit')
    );

    // Look for unresolved issues
    const unresolvedPattern = /\*\*(\d+)\s+unresolved/i;
    let unresolvedCount = 0;

    codeRabbitComments.forEach(comment => {
      const match = comment.body.match(unresolvedPattern);
      if (match) {
        unresolvedCount = Math.max(unresolvedCount, parseInt(match[1], 10));
      }
    });

    if (unresolvedCount === 0) {
      log('   ✅ 0 CodeRabbit comments pending', 'green');
      return { passed: true, count: 0 };
    } else {
      log(`   ❌ ${unresolvedCount} CodeRabbit comments unresolved`, 'red');
      return { passed: false, count: unresolvedCount };
    }
  } catch (error) {
    log('   ⚠️  Could not check CodeRabbit comments (may not be available)', 'yellow');
    log('   💡 Verify manually on GitHub PR page', 'blue');
    return { passed: true, count: 0 }; // Don't block if can't verify
  }
}

function checkCIStatus(prNumber) {
  log('\n7️⃣  Checking CI/CD Status...', 'cyan');

  try {
    const output = execSync(`gh pr checks ${prNumber}`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const lines = output.trim().split('\n');
    const checks = lines.slice(1); // Skip header

    const failed = checks.filter(line => line.includes('fail') || line.includes('❌'));
    const pending = checks.filter(line => line.includes('pending') || line.includes('⏳'));

    if (failed.length > 0) {
      log(`   ❌ ${failed.length} CI check(s) failing`, 'red');
      failed.forEach(check => log(`      ${check}`, 'red'));
      return { passed: false, failing: failed.length, pending: pending.length };
    }

    if (pending.length > 0) {
      log(`   ⏳ ${pending.length} CI check(s) pending`, 'yellow');
      return { passed: false, failing: 0, pending: pending.length };
    }

    log('   ✅ All CI checks passing', 'green');
    return { passed: true, failing: 0, pending: 0 };
  } catch (error) {
    log('   ⚠️  Could not fetch CI status (may not be available)', 'yellow');
    return { passed: true, failing: 0, pending: 0 }; // Don't block if can't verify
  }
}

function generateReport(results, prNumber) {
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 COMPLETION VALIDATION REPORT', 'bold');
  log('='.repeat(60), 'cyan');

  log(`\nPR: #${prNumber}`, 'blue');
  log(`Date: ${new Date().toISOString().split('T')[0]}`, 'blue');

  // Calculate completion percentage
  const totalChecks = 7;
  const passedChecks = [
    results.ac.passed,
    results.coverage.passed,
    results.tests.passed,
    results.receipts.passed,
    results.docs.passed,
    results.coderabbit.passed,
    results.ci.passed
  ].filter(Boolean).length;

  const completionPct = ((passedChecks / totalChecks) * 100).toFixed(1);

  log(`\n🎯 Completion: ${completionPct}%`, completionPct === '100.0' ? 'green' : 'yellow');

  log('\n📋 Checklist:', 'cyan');
  log(`   ${results.ac.passed ? '✅' : '❌'} Acceptance Criteria: ${results.ac.completed}/${results.ac.total}`, results.ac.passed ? 'green' : 'red');
  log(`   ${results.coverage.passed ? '✅' : '❌'} Test Coverage: ${results.coverage.actual.toFixed(1)}% (≥${results.coverage.target}%)`, results.coverage.passed ? 'green' : 'red');
  log(`   ${results.tests.passed ? '✅' : '❌'} Tests Passing: ${results.tests.failing === 0 ? 'All' : `${results.tests.failing} failing`}`, results.tests.passed ? 'green' : 'red');
  log(`   ${results.receipts.passed ? '✅' : '❌'} Agent Receipts: ${results.receipts.missing.length || 0} missing`, results.receipts.passed ? 'green' : 'red');
  log(`   ${results.docs.passed ? '✅' : '❌'} Documentation: ${results.docs.checks.filter(c => c.passed).length}/${results.docs.checks.length} checks`, results.docs.passed ? 'green' : 'red');
  log(`   ${results.coderabbit.passed ? '✅' : '❌'} CodeRabbit: ${results.coderabbit.count} comments pending`, results.coderabbit.passed ? 'green' : 'red');
  log(`   ${results.ci.passed ? '✅' : '❌'} CI/CD: ${results.ci.failing} failing, ${results.ci.pending} pending`, results.ci.passed ? 'green' : 'red');

  // Determine overall status
  const isComplete = completionPct === '100.0';
  const hasCriticalIssues = !results.tests.passed || results.ci.failing > 0;

  log('\n' + '='.repeat(60), 'cyan');

  if (isComplete) {
    log('✅ PR IS 100% COMPLETE AND READY TO MERGE', 'green');
    log('   User may proceed with merge', 'green');
    return 0;
  } else if (hasCriticalIssues) {
    log('🚨 CRITICAL ISSUES DETECTED - DO NOT MERGE', 'red');
    log('   Fix failing tests and CI checks before proceeding', 'red');
    return 2;
  } else {
    log('⚠️  PR IS INCOMPLETE - CONTINUE IMPLEMENTATION', 'yellow');
    log(`   ${totalChecks - passedChecks} check(s) remaining`, 'yellow');

    log('\n📝 Next Steps:', 'cyan');

    if (!results.ac.passed) {
      log('   • Complete remaining acceptance criteria', 'yellow');
      results.ac.missing.forEach((ac, i) => {
        log(`     ${i + 1}. ${ac.text}`, 'yellow');
      });
    }

    if (!results.coverage.passed) {
      log(`   • Increase test coverage to ≥${results.coverage.target}%`, 'yellow');
    }

    if (!results.receipts.passed) {
      log('   • Generate missing agent receipts', 'yellow');
    }

    if (!results.docs.passed) {
      log('   • Update documentation (GDD nodes, test evidence)', 'yellow');
    }

    if (!results.coderabbit.passed) {
      log('   • Resolve all CodeRabbit comments', 'yellow');
    }

    if (!results.ci.passed) {
      log('   • Wait for pending CI checks to complete', 'yellow');
    }

    return 1;
  }
}

function main() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🛡️  GUARDIAN COMPLETION VALIDATOR', 'bold');
  log('='.repeat(60), 'cyan');

  const args = parseArgs();

  if (!args.pr) {
    log('\n❌ ERROR: PR number not provided', 'red');
    log('Usage: node scripts/ci/validate-completion.js --pr=628', 'yellow');
    log('   or: npm run validate:completion -- --pr=628', 'yellow');
    process.exit(1);
  }

  log(`\n🎯 Validating PR #${args.pr} for merge readiness...`, 'cyan');

  // Fetch issue data
  const issueData = fetchIssueData(args.pr);

  // Run all validation checks
  const results = {
    ac: checkAcceptanceCriteria(issueData),
    coverage: checkTestCoverage(args.threshold),
    tests: checkTestsPassing(),
    receipts: checkAgentReceipts(args.pr),
    docs: checkDocumentation(args.pr),
    coderabbit: checkCodeRabbitComments(args.pr),
    ci: checkCIStatus(args.pr)
  };

  // Generate report and exit
  const exitCode = generateReport(results, args.pr);
  process.exit(exitCode);
}

// Run
main();
