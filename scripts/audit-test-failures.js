#!/usr/bin/env node

/**
 * Test Failure Audit Script
 *
 * Runs full test suite and categorizes failures by:
 * - Test file
 * - Error type
 * - Common patterns
 * - Root causes
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '../docs/test-evidence/test-audit-646.json');
const SUMMARY_FILE = path.join(__dirname, '../docs/test-evidence/test-audit-646-summary.md');

console.log('🔍 Starting comprehensive test audit...\n');

try {
  // Run tests with JSON output
  console.log('Running test suite...');
  const testOutput = execSync('npm test -- --json --maxWorkers=50%', {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    timeout: 600000 // 10 minutes
  });

  const testResults = JSON.parse(testOutput);

  // Categorize failures
  const failures = {
    byFile: {},
    byPattern: {
      timeout: [],
      mock: [],
      database: [],
      auth: [],
      network: [],
      assertion: [],
      other: []
    },
    total: {
      suites: testResults.numTotalTestSuites,
      passing: testResults.numPassedTestSuites,
      failing: testResults.numFailedTestSuites,
      tests: testResults.numTotalTests,
      passingTests: testResults.numPassedTests,
      failingTests: testResults.numFailedTests
    }
  };

  // Process test results
  testResults.testResults.forEach((suite) => {
    if (suite.status === 'failed') {
      const fileName = suite.name;
      failures.byFile[fileName] = {
        failures: suite.assertionResults.filter((r) => r.status === 'failed'),
        passing: suite.assertionResults.filter((r) => r.status === 'passed'),
        total: suite.assertionResults.length
      };

      // Categorize by error pattern
      suite.assertionResults.forEach((test) => {
        if (test.status === 'failed') {
          const failureMessage = test.failureMessages?.[0] || '';

          if (failureMessage.includes('timeout') || failureMessage.includes('Timeout')) {
            failures.byPattern.timeout.push({
              file: fileName,
              test: test.title
            });
          } else if (failureMessage.includes('mock') || failureMessage.includes('Mock')) {
            failures.byPattern.mock.push({
              file: fileName,
              test: test.title
            });
          } else if (
            failureMessage.includes('database') ||
            failureMessage.includes('Database') ||
            failureMessage.includes('SQL')
          ) {
            failures.byPattern.database.push({
              file: fileName,
              test: test.title
            });
          } else if (
            failureMessage.includes('auth') ||
            failureMessage.includes('401') ||
            failureMessage.includes('Unauthorized')
          ) {
            failures.byPattern.auth.push({
              file: fileName,
              test: test.title
            });
          } else if (
            failureMessage.includes('network') ||
            failureMessage.includes('ECONNREFUSED') ||
            failureMessage.includes('fetch')
          ) {
            failures.byPattern.network.push({
              file: fileName,
              test: test.title
            });
          } else if (failureMessage.includes('expect') || failureMessage.includes('Expected')) {
            failures.byPattern.assertion.push({
              file: fileName,
              test: test.title
            });
          } else {
            failures.byPattern.other.push({
              file: fileName,
              test: test.title,
              message: failureMessage.substring(0, 200)
            });
          }
        }
      });
    }
  });

  // Save JSON results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(failures, null, 2));
  console.log(`✅ Detailed results saved to: ${OUTPUT_FILE}`);

  // Generate summary markdown
  let summary = `# Test Audit Results - Issue #646

**Date:** ${new Date().toISOString()}
**Total Test Suites:** ${failures.total.suites}
**Passing Suites:** ${failures.total.passing} (${Math.round((failures.total.passing / failures.total.suites) * 100)}%)
**Failing Suites:** ${failures.total.failing} (${Math.round((failures.total.failing / failures.total.suites) * 100)}%)

**Total Tests:** ${failures.total.tests}
**Passing Tests:** ${failures.total.passingTests} (${Math.round((failures.total.passingTests / failures.total.tests) * 100)}%)
**Failing Tests:** ${failures.total.failingTests} (${Math.round((failures.total.failingTests / failures.total.tests) * 100)}%)

---

## Failures by Category

### Timeout Issues (${failures.byPattern.timeout.length} tests)
${failures.byPattern.timeout.length > 0 ? failures.byPattern.timeout.map((f) => `- **${f.file}**: ${f.test}`).join('\n') : 'None'}

### Mock Issues (${failures.byPattern.mock.length} tests)
${failures.byPattern.mock.length > 0 ? failures.byPattern.mock.map((f) => `- **${f.file}**: ${f.test}`).join('\n') : 'None'}

### Database Issues (${failures.byPattern.database.length} tests)
${failures.byPattern.database.length > 0 ? failures.byPattern.database.map((f) => `- **${f.file}**: ${f.test}`).join('\n') : 'None'}

### Authentication Issues (${failures.byPattern.auth.length} tests)
${failures.byPattern.auth.length > 0 ? failures.byPattern.auth.map((f) => `- **${f.file}**: ${f.test}`).join('\n') : 'None'}

### Network Issues (${failures.byPattern.network.length} tests)
${failures.byPattern.network.length > 0 ? failures.byPattern.network.map((f) => `- **${f.file}**: ${f.test}`).join('\n') : 'None'}

### Assertion Failures (${failures.byPattern.assertion.length} tests)
${
  failures.byPattern.assertion.length > 0
    ? failures.byPattern.assertion
        .slice(0, 20)
        .map((f) => `- **${f.file}**: ${f.test}`)
        .join('\n')
    : 'None'
}
${failures.byPattern.assertion.length > 20 ? `\n... and ${failures.byPattern.assertion.length - 20} more assertion failures` : ''}

### Other Issues (${failures.byPattern.other.length} tests)
${
  failures.byPattern.other.length > 0
    ? failures.byPattern.other
        .slice(0, 10)
        .map((f) => `- **${f.file}**: ${f.test}`)
        .join('\n')
    : 'None'
}
${failures.byPattern.other.length > 10 ? `\n... and ${failures.byPattern.other.length - 10} more other failures` : ''}

---

## Failures by File

${Object.entries(failures.byFile)
  .sort((a, b) => b[1].failures.length - a[1].failures.length)
  .map(
    ([file, data]) => `### ${file}
- **Failing:** ${data.failures.length} tests
- **Passing:** ${data.passing.length} tests
- **Pass Rate:** ${Math.round((data.passing.length / data.total) * 100)}%
`
  )
  .join('\n')}

---

## Recommendations

1. **Priority 1 (Systematic Issues):**
   ${failures.byPattern.timeout.length > 10 ? '- ⚠️ High number of timeout issues - consider increasing test timeouts or optimizing slow tests' : ''}
   ${failures.byPattern.mock.length > 10 ? '- ⚠️ High number of mock issues - review mock setup patterns' : ''}
   ${failures.byPattern.database.length > 10 ? '- ⚠️ High number of database issues - review database test setup' : ''}

2. **Priority 2 (Individual Fixes):**
   - Fix assertion failures one by one
   - Address authentication issues
   - Resolve network connectivity issues

3. **Priority 3 (Long Tail):**
   - Address remaining "other" category failures
   - Improve test stability
`;

  fs.writeFileSync(SUMMARY_FILE, summary);
  console.log(`✅ Summary saved to: ${SUMMARY_FILE}`);

  console.log('\n📊 Summary:');
  console.log(`   Total Suites: ${failures.total.suites}`);
  console.log(
    `   Passing: ${failures.total.passing} (${Math.round((failures.total.passing / failures.total.suites) * 100)}%)`
  );
  console.log(
    `   Failing: ${failures.total.failing} (${Math.round((failures.total.failing / failures.total.suites) * 100)}%)`
  );
  console.log(`\n   Total Tests: ${failures.total.tests}`);
  console.log(
    `   Passing: ${failures.total.passingTests} (${Math.round((failures.total.passingTests / failures.total.tests) * 100)}%)`
  );
  console.log(
    `   Failing: ${failures.total.failingTests} (${Math.round((failures.total.failingTests / failures.total.tests) * 100)}%)`
  );

  console.log('\n📁 Results saved to:');
  console.log(`   - ${OUTPUT_FILE}`);
  console.log(`   - ${SUMMARY_FILE}`);
} catch (error) {
  console.error('❌ Error running audit:', error.message);
  if (error.stdout) {
    console.error('STDOUT:', error.stdout.substring(0, 1000));
  }
  if (error.stderr) {
    console.error('STDERR:', error.stderr.substring(0, 1000));
  }
  process.exit(1);
}
