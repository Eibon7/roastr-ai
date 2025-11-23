#!/usr/bin/env node

/**
 * Log Management Test Runner
 *
 * Comprehensive test runner for log backup, maintenance, and alert systems
 * Includes unit tests, integration tests, and coverage reporting
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

// Configuration
const ROOT_DIR = path.join(__dirname, '..');
const COVERAGE_DIR = path.join(ROOT_DIR, 'coverage', 'log-management');
const REPORTS_DIR = path.join(ROOT_DIR, 'test-reports', 'log-management');

// Test suites to run
const TEST_SUITES = [
  {
    name: 'Log Backup Service Unit Tests',
    pattern: '**/logBackupService.test.js',
    timeout: 30000
  },
  {
    name: 'Log Maintenance Unit Tests',
    pattern: '**/logMaintenance.test.js',
    timeout: 30000
  },
  {
    name: 'Alert Service Unit Tests',
    pattern: '**/alertService.test.js',
    timeout: 30000
  },
  {
    name: 'CLI Integration Tests',
    pattern: '**/logCommands.test.js',
    timeout: 60000
  }
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(` ${message}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSubHeader(message) {
  log(`\n${'-'.repeat(40)}`, 'blue');
  log(` ${message}`, 'blue');
  log('-'.repeat(40), 'blue');
}

async function setupTestEnvironment() {
  logSubHeader('Setting up test environment');

  // Ensure directories exist
  await fs.ensureDir(COVERAGE_DIR);
  await fs.ensureDir(REPORTS_DIR);

  // Clean previous test artifacts
  await fs.emptyDir(COVERAGE_DIR);
  await fs.emptyDir(REPORTS_DIR);

  log('✓ Test directories prepared', 'green');
}

async function runTestSuite(suite) {
  logSubHeader(`Running: ${suite.name}`);

  const jestConfig = {
    testMatch: [`<rootDir>/${suite.pattern}`],
    testTimeout: suite.timeout,
    collectCoverage: true,
    collectCoverageFrom: [
      'src/services/logBackupService.js',
      'src/utils/logMaintenance.js',
      'src/services/alertService.js'
    ],
    coverageDirectory: path.join(COVERAGE_DIR, suite.name.toLowerCase().replace(/\s+/g, '-')),
    coverageReporters: ['text', 'lcov', 'json'],
    reporters: ['default'],
    testEnvironment: 'node'
  };

  const configPath = path.join(ROOT_DIR, 'temp-jest-config.json');
  await fs.writeJson(configPath, jestConfig, { spaces: 2 });

  try {
    execSync(`npx jest --config "${configPath}" --verbose`, {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    log(`✓ ${suite.name} completed successfully`, 'green');
    return { success: true, suite: suite.name };
  } catch (error) {
    log(`✗ ${suite.name} failed`, 'red');
    log(`Error: ${error.message}`, 'red');
    return { success: false, suite: suite.name, error: error.message };
  } finally {
    // Clean up temporary config
    await fs.remove(configPath);
  }
}

async function generateCoverageReport() {
  logSubHeader('Generating combined coverage report');

  try {
    const mergedCoverageDir = path.join(COVERAGE_DIR, 'merged');
    await fs.ensureDir(mergedCoverageDir);

    // Find all coverage.json files from individual test suites
    const coverageFiles = [];
    const suiteDirectories = await fs.readdir(COVERAGE_DIR);

    for (const dir of suiteDirectories) {
      if (dir === 'merged') continue; // Skip the merged directory

      const suiteCoverageDir = path.join(COVERAGE_DIR, dir);
      const coverageJsonPath = path.join(suiteCoverageDir, 'coverage-final.json');

      if (await fs.pathExists(coverageJsonPath)) {
        coverageFiles.push(coverageJsonPath);
      }
    }

    if (coverageFiles.length === 0) {
      log('⚠ No coverage files found to merge', 'yellow');
      return;
    }

    log(`📊 Found ${coverageFiles.length} coverage files to merge`, 'blue');

    // Use nyc to merge coverage files
    const mergedCoverageFile = path.join(mergedCoverageDir, 'coverage.json');
    execSync(`npx nyc merge ${coverageFiles.join(' ')} ${mergedCoverageFile}`, {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    // Generate HTML report from merged coverage
    execSync(
      `npx nyc report --temp-dir=${mergedCoverageDir} --reporter=html --reporter=text --reporter=text-summary --report-dir=${mergedCoverageDir}`,
      { cwd: ROOT_DIR, stdio: 'inherit' }
    );

    log('✓ Coverage report generated successfully', 'green');
    log(`📊 HTML Coverage report: ${path.join(mergedCoverageDir, 'index.html')}`, 'cyan');
    log(`📋 Text summary available in console output above`, 'cyan');
  } catch (error) {
    log(`⚠ Failed to generate coverage report: ${error.message}`, 'yellow');
    log('💡 This might be expected if no coverage files were generated', 'blue');
  }
}

async function generateTestReport(results) {
  logSubHeader('Generating test summary report');

  const summary = {
    timestamp: new Date().toISOString(),
    totalSuites: results.length,
    passedSuites: results.filter((r) => r.success).length,
    failedSuites: results.filter((r) => !r.success).length,
    results: results
  };

  const reportPath = path.join(REPORTS_DIR, 'summary.json');
  await fs.writeJson(reportPath, summary, { spaces: 2 });

  // Generate markdown report
  const markdownReport = generateMarkdownReport(summary);
  const markdownPath = path.join(REPORTS_DIR, 'summary.md');
  await fs.writeFile(markdownPath, markdownReport);

  log('✓ Test summary generated', 'green');
  log(`📋 Summary report: ${markdownPath}`, 'cyan');

  return summary;
}

function generateMarkdownReport(summary) {
  const { totalSuites, passedSuites, failedSuites, results } = summary;

  let markdown = `# Log Management Test Report\n\n`;
  markdown += `**Generated:** ${summary.timestamp}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `- **Total Test Suites:** ${totalSuites}\n`;
  markdown += `- **Passed:** ${passedSuites} ✅\n`;
  markdown += `- **Failed:** ${failedSuites} ${failedSuites > 0 ? '❌' : ''}\n`;
  markdown += `- **Success Rate:** ${Math.round((passedSuites / totalSuites) * 100)}%\n\n`;

  markdown += `## Test Results\n\n`;

  for (const result of results) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    markdown += `### ${result.suite} - ${status}\n\n`;

    if (!result.success && result.error) {
      markdown += `**Error:** ${result.error}\n\n`;
    }
  }

  markdown += `## Coverage\n\n`;
  markdown += `Coverage reports are available in the \`coverage/log-management/merged\` directory.\n\n`;

  return markdown;
}

async function main() {
  try {
    logHeader('Log Management Test Suite');

    // Setup
    await setupTestEnvironment();

    // Run all test suites
    const results = [];
    for (const suite of TEST_SUITES) {
      const result = await runTestSuite(suite);
      results.push(result);
    }

    // Generate reports
    await generateCoverageReport();
    const summary = await generateTestReport(results);

    // Final summary
    logHeader('Test Execution Complete');
    log(`Total Suites: ${summary.totalSuites}`, 'bright');
    log(`Passed: ${summary.passedSuites}`, 'green');
    log(`Failed: ${summary.failedSuites}`, summary.failedSuites > 0 ? 'red' : 'green');
    log(
      `Success Rate: ${Math.round((summary.passedSuites / summary.totalSuites) * 100)}%`,
      'bright'
    );

    if (summary.failedSuites > 0) {
      log('\n❌ Some tests failed. Check the reports for details.', 'red');
      process.exit(1);
    } else {
      log('\n✅ All tests passed successfully!', 'green');
      process.exit(0);
    }
  } catch (error) {
    log(`\n💥 Test execution failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Handle CLI arguments
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Log Management Test Runner

Usage: node scripts/test-log-management.js [options]

Options:
  --help, -h     Show this help message
  
This script runs comprehensive tests for the log management system including:
- Log backup service unit tests
- Log maintenance service unit tests  
- Alert service unit tests
- CLI integration tests

Reports are generated in test-reports/log-management/
Coverage reports are generated in coverage/log-management/
    `);
    process.exit(0);
  }

  main();
}
