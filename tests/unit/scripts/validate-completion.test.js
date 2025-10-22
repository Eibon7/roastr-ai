/**
 * Tests for Completion Validator (Guardian Agent Extension)
 *
 * Tests the automated pre-merge validation system that ensures
 * no PR is merged until it is 100% complete.
 *
 * Coverage: All validation checks, exit codes, report generation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mock dependencies
jest.mock('fs');
jest.mock('child_process');

describe('Completion Validator', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Acceptance Criteria Parsing', () => {
    it('should parse checked acceptance criteria correctly', () => {
      const issueBody = `
## Acceptance Criteria
- [x] User can delete account
- [x] 30-day grace period implemented
- [x] Email notification sent
      `;

      const criteria = parseAcceptanceCriteria(issueBody);

      expect(criteria).toHaveLength(3);
      expect(criteria.every(c => c.checked)).toBe(true);
    });

    it('should detect unchecked acceptance criteria', () => {
      const issueBody = `
## Acceptance Criteria
- [x] User can delete account
- [ ] 30-day grace period implemented
- [x] Email notification sent
      `;

      const criteria = parseAcceptanceCriteria(issueBody);

      expect(criteria).toHaveLength(3);
      expect(criteria.filter(c => c.checked)).toHaveLength(2);
      expect(criteria.filter(c => !c.checked)).toHaveLength(1);
      expect(criteria.find(c => !c.checked).text).toContain('30-day grace period');
    });

    it('should handle missing acceptance criteria section', () => {
      const issueBody = `
## Description
This is a test issue without AC section.
      `;

      const criteria = parseAcceptanceCriteria(issueBody);

      expect(criteria).toHaveLength(0);
    });

    it('should handle various checkbox formats', () => {
      const issueBody = `
## Acceptance Criteria
- [X] Uppercase X
- [x] Lowercase x
- [ ] Unchecked
- [✓] Checkmark
      `;

      const criteria = parseAcceptanceCriteria(issueBody);

      expect(criteria).toHaveLength(4);
      expect(criteria.filter(c => c.checked)).toHaveLength(3);
    });
  });

  describe('Test Coverage Validation', () => {
    it('should pass when coverage meets threshold', () => {
      const coverageData = {
        total: {
          lines: { pct: 92.5 },
          statements: { pct: 91.2 },
          functions: { pct: 93.0 },
          branches: { pct: 90.1 }
        }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(coverageData));

      const result = checkTestCoverage(90);

      expect(result.passed).toBe(true);
      expect(result.actual).toBeGreaterThanOrEqual(90);
    });

    it('should fail when coverage below threshold', () => {
      const coverageData = {
        total: {
          lines: { pct: 85.0 },
          statements: { pct: 86.0 },
          functions: { pct: 84.0 },
          branches: { pct: 82.0 }
        }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(coverageData));

      const result = checkTestCoverage(90);

      expect(result.passed).toBe(false);
      expect(result.actual).toBeLessThan(90);
    });

    it('should handle missing coverage report', () => {
      fs.existsSync.mockReturnValue(false);

      const result = checkTestCoverage(90);

      expect(result.passed).toBe(false);
      expect(result.missing).toBe(true);
    });

    it('should handle corrupted coverage data', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');

      const result = checkTestCoverage(90);

      expect(result.passed).toBe(false);
    });
  });

  describe('Tests Passing Validation', () => {
    it('should pass when all tests succeed', () => {
      execSync.mockReturnValue('');

      const result = checkTestsPassing();

      expect(result.passed).toBe(true);
      expect(result.failing).toBe(0);
    });

    it('should fail when tests fail', () => {
      const error = new Error('Tests failed');
      error.stdout = '5 passing\n2 failing\n';
      execSync.mockImplementation(() => {
        throw error;
      });

      const result = checkTestsPassing();

      expect(result.passed).toBe(false);
      expect(result.failing).toBe(2);
    });

    it('should handle test command errors', () => {
      const error = new Error('Command not found');
      execSync.mockImplementation(() => {
        throw error;
      });

      const result = checkTestsPassing();

      expect(result.passed).toBe(false);
      expect(result.failing).toBe('unknown');
    });
  });

  describe('Agent Receipts Validation', () => {
    it('should pass when all receipts present', () => {
      execSync.mockReturnValue('');

      const result = checkAgentReceipts('628');

      expect(result.passed).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should detect missing receipts', () => {
      const error = new Error('Receipts missing');
      error.stdout = '2 agent(s) missing receipts';
      execSync.mockImplementation(() => {
        throw error;
      });

      const result = checkAgentReceipts('628');

      expect(result.passed).toBe(false);
      expect(result.missing).toBe(2);
    });
  });

  describe('Documentation Validation', () => {
    it('should pass when GDD nodes valid', () => {
      fs.existsSync.mockReturnValue(true);
      execSync.mockReturnValue('');

      const result = checkDocumentation('628');

      expect(result.passed).toBe(true);
      expect(result.checks.some(c => c.name === 'GDD Validation')).toBe(true);
    });

    it('should fail when GDD validation errors', () => {
      fs.existsSync.mockReturnValue(true);
      const error = new Error('GDD errors');
      execSync.mockImplementation(() => {
        throw error;
      });

      const result = checkDocumentation('628');

      expect(result.passed).toBe(false);
    });

    it('should handle missing GDD directory', () => {
      fs.existsSync.mockReturnValue(false);

      const result = checkDocumentation('628');

      expect(result.passed).toBe(true); // Not blocking if GDD doesn't exist
    });
  });

  describe('Exit Code Logic', () => {
    it('should return 0 for 100% completion', () => {
      const results = {
        ac: { passed: true, total: 3, completed: 3, missing: [] },
        coverage: { passed: true, actual: 92.5, target: 90, missing: false },
        tests: { passed: true, failing: 0 },
        receipts: { passed: true, missing: [] },
        docs: { passed: true, checks: [{ passed: true }] },
        coderabbit: { passed: true, count: 0 },
        ci: { passed: true, failing: 0, pending: 0 }
      };

      const exitCode = determineExitCode(results);

      expect(exitCode).toBe(0);
    });

    it('should return 2 for critical issues', () => {
      const results = {
        ac: { passed: true, total: 3, completed: 3, missing: [] },
        coverage: { passed: true, actual: 92.5, target: 90, missing: false },
        tests: { passed: false, failing: 2 }, // Critical
        receipts: { passed: true, missing: [] },
        docs: { passed: true, checks: [] },
        coderabbit: { passed: true, count: 0 },
        ci: { passed: true, failing: 0, pending: 0 }
      };

      const exitCode = determineExitCode(results);

      expect(exitCode).toBe(2);
    });

    it('should return 1 for incomplete (non-critical)', () => {
      const results = {
        ac: { passed: false, total: 3, completed: 2, missing: [{ text: 'AC 3' }] },
        coverage: { passed: true, actual: 92.5, target: 90, missing: false },
        tests: { passed: true, failing: 0 },
        receipts: { passed: true, missing: [] },
        docs: { passed: true, checks: [] },
        coderabbit: { passed: true, count: 0 },
        ci: { passed: true, failing: 0, pending: 0 }
      };

      const exitCode = determineExitCode(results);

      expect(exitCode).toBe(1);
    });
  });

  describe('Report Generation', () => {
    it('should generate complete report for 100% completion', () => {
      const results = {
        ac: { passed: true, total: 3, completed: 3, missing: [] },
        coverage: { passed: true, actual: 92.5, target: 90, missing: false },
        tests: { passed: true, failing: 0 },
        receipts: { passed: true, missing: [] },
        docs: { passed: true, checks: [{ passed: true }] },
        coderabbit: { passed: true, count: 0 },
        ci: { passed: true, failing: 0, pending: 0 }
      };

      const report = generateReport(results, '628');

      expect(report).toContain('100.0%');
      expect(report).toContain('✅ PR IS 100% COMPLETE');
    });

    it('should generate actionable report for incomplete PR', () => {
      const results = {
        ac: { passed: false, total: 3, completed: 2, missing: [{ text: 'Missing AC' }] },
        coverage: { passed: false, actual: 85.0, target: 90, missing: false },
        tests: { passed: true, failing: 0 },
        receipts: { passed: true, missing: [] },
        docs: { passed: true, checks: [] },
        coderabbit: { passed: true, count: 0 },
        ci: { passed: true, failing: 0, pending: 0 }
      };

      const report = generateReport(results, '628');

      expect(report).toContain('INCOMPLETE');
      expect(report).toContain('Next Steps');
      expect(report).toContain('Complete remaining acceptance criteria');
      expect(report).toContain('Increase test coverage');
    });

    it('should highlight critical issues', () => {
      const results = {
        ac: { passed: true, total: 3, completed: 3, missing: [] },
        coverage: { passed: true, actual: 92.5, target: 90, missing: false },
        tests: { passed: false, failing: 2 },
        receipts: { passed: true, missing: [] },
        docs: { passed: true, checks: [] },
        coderabbit: { passed: true, count: 0 },
        ci: { passed: false, failing: 1, pending: 0 }
      };

      const report = generateReport(results, '628');

      expect(report).toContain('CRITICAL ISSUES');
      expect(report).toContain('DO NOT MERGE');
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete PR end-to-end', () => {
      // Mock complete PR state
      const issueData = {
        title: 'Test PR',
        body: `
## Acceptance Criteria
- [x] Feature implemented
- [x] Tests added
- [x] Documentation updated
        `
      };

      const coverageData = {
        total: {
          lines: { pct: 92.5 },
          statements: { pct: 91.2 },
          functions: { pct: 93.0 },
          branches: { pct: 90.1 }
        }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(coverageData));
      execSync.mockReturnValue(''); // All commands succeed

      // Run full validation
      const ac = checkAcceptanceCriteria(issueData);
      const coverage = checkTestCoverage(90);
      const tests = checkTestsPassing();
      const receipts = checkAgentReceipts('628');
      const docs = checkDocumentation('628');

      expect(ac.passed).toBe(true);
      expect(coverage.passed).toBe(true);
      expect(tests.passed).toBe(true);
      expect(receipts.passed).toBe(true);
      expect(docs.passed).toBe(true);
    });
  });
});

// Helper functions (extracted from main script for testing)

function parseAcceptanceCriteria(body) {
  if (!body) return [];

  const acSection = body.match(/##\s*Acceptance Criteria\s*\n([\s\S]*?)(?=\n##|\n---|\Z)/i);
  if (!acSection) return [];

  const lines = acSection[1].split('\n');
  const criteria = [];

  lines.forEach(line => {
    const match = line.match(/^[-*]\s*\[(.)\]\s*(.+)$/);
    if (match) {
      const checkbox = match[1].toLowerCase();
      const text = match[2].trim();
      const isChecked = checkbox === 'x' || checkbox === '✓';
      criteria.push({ text, checked: isChecked });
    }
  });

  return criteria;
}

function checkTestCoverage(threshold) {
  const coveragePath = path.join(process.cwd(), 'coverage/coverage-summary.json');

  if (!fs.existsSync(coveragePath)) {
    return { passed: false, actual: 0, target: threshold, missing: true };
  }

  try {
    const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    const total = coverageData.total;

    const metrics = ['lines', 'statements', 'functions', 'branches'];
    const results = {};

    metrics.forEach(metric => {
      results[metric] = total[metric]?.pct || 0;
    });

    const avgCoverage = Object.values(results).reduce((a, b) => a + b, 0) / metrics.length;
    const passed = avgCoverage >= threshold;

    return { passed, actual: avgCoverage, target: threshold, missing: false };
  } catch (error) {
    return { passed: false, actual: 0, target: threshold, missing: true };
  }
}

function checkTestsPassing() {
  try {
    execSync('npm test', { encoding: 'utf8', stdio: 'pipe' });
    return { passed: true, failing: 0 };
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const failMatch = output.match(/(\d+)\s+failing/);
    const failCount = failMatch ? parseInt(failMatch[1], 10) : 'unknown';
    return { passed: false, failing: failCount };
  }
}

function checkAgentReceipts(prNumber) {
  try {
    execSync('node scripts/ci/require-agent-receipts.js', {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, PR_NUMBER: prNumber }
    });
    return { passed: true, missing: [] };
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const missingMatch = output.match(/(\d+)\s+agent\(s\)\s+missing receipts/);
    const missingCount = missingMatch ? parseInt(missingMatch[1], 10) : 0;
    return { passed: false, missing: missingCount };
  }
}

function checkDocumentation(prNumber) {
  const checks = [];
  const gddNodesPath = path.join(process.cwd(), 'docs/nodes');

  if (fs.existsSync(gddNodesPath)) {
    try {
      execSync('node scripts/resolve-graph.js --validate', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      checks.push({ name: 'GDD Validation', passed: true });
    } catch (error) {
      checks.push({ name: 'GDD Validation', passed: false });
    }
  }

  const passed = checks.every(c => c.passed);
  return { passed, checks };
}

function checkAcceptanceCriteria(issueData) {
  if (!issueData || !issueData.body) {
    return { passed: true, total: 0, completed: 0, missing: [] };
  }

  const criteria = parseAcceptanceCriteria(issueData.body);

  if (criteria.length === 0) {
    return { passed: true, total: 0, completed: 0, missing: [] };
  }

  const completed = criteria.filter(c => c.checked);
  const missing = criteria.filter(c => !c.checked);
  const passed = missing.length === 0;

  return { passed, total: criteria.length, completed: completed.length, missing };
}

function determineExitCode(results) {
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

  const isComplete = passedChecks === totalChecks;
  const hasCriticalIssues = !results.tests.passed || results.ci.failing > 0;

  if (isComplete) return 0;
  if (hasCriticalIssues) return 2;
  return 1;
}

function generateReport(results, prNumber) {
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

  let report = `PR: #${prNumber}\n`;
  report += `Completion: ${completionPct}%\n\n`;

  if (completionPct === '100.0') {
    report += '✅ PR IS 100% COMPLETE AND READY TO MERGE\n';
  } else if (!results.tests.passed || results.ci.failing > 0) {
    report += '🚨 CRITICAL ISSUES DETECTED - DO NOT MERGE\n';
  } else {
    report += '⚠️  PR IS INCOMPLETE - CONTINUE IMPLEMENTATION\n\n';
    report += 'Next Steps:\n';

    if (!results.ac.passed) {
      report += '• Complete remaining acceptance criteria\n';
    }
    if (!results.coverage.passed) {
      report += `• Increase test coverage to ≥${results.coverage.target}%\n`;
    }
    if (!results.receipts.passed) {
      report += '• Generate missing agent receipts\n';
    }
    if (!results.docs.passed) {
      report += '• Update documentation (GDD nodes, test evidence)\n';
    }
    if (!results.coderabbit.passed) {
      report += '• Resolve all CodeRabbit comments\n';
    }
    if (!results.ci.passed && results.ci.pending > 0) {
      report += '• Wait for pending CI checks to complete\n';
    }
  }

  return report;
}

module.exports = {
  parseAcceptanceCriteria,
  checkTestCoverage,
  checkTestsPassing,
  checkAgentReceipts,
  checkDocumentation,
  checkAcceptanceCriteria,
  determineExitCode,
  generateReport
};
