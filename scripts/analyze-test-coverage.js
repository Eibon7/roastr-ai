#!/usr/bin/env node

/**
 * Test Coverage Analysis Script
 *
 * Analyzes current test coverage and identifies gaps
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob').sync;

// Configuration
const CONFIG = {
  srcDir: 'src',
  testDir: 'tests',
  outputFile: 'docs/test-coverage-analysis.md',
  thresholds: {
    high: 80,
    medium: 60,
    low: 40
  }
};

// Baseline coverage data from jest run
const BASELINE_COVERAGE = {
  statements: 28.7,
  branches: 27.15,
  functions: 23.07,
  lines: 28.78,
  // Specific file coverage from the detailed report
  files: {
    // Workers
    'src/workers/BaseWorker.js': { statements: 41.17, priority: 'critical' },
    'src/workers/FetchCommentsWorker.js': { statements: 0, priority: 'critical' },
    'src/workers/AnalyzeToxicityWorker.js': { statements: 0, priority: 'critical' },
    'src/workers/GenerateReplyWorker.js': { statements: 0, priority: 'critical' },
    'src/workers/ShieldActionWorker.js': { statements: 0, priority: 'critical' },
    'src/workers/WorkerManager.js': { statements: 0, priority: 'critical' },

    // Services
    'src/services/authService.js': { statements: 0, priority: 'critical' },
    'src/services/costControl.js': { statements: 5.63, priority: 'critical' },
    'src/services/queueService.js': { statements: 0, priority: 'critical' },
    'src/services/shieldService.js': { statements: 0, priority: 'critical' },
    'src/services/styleProfileGenerator.js': { statements: 0, priority: 'high' },

    // Middleware
    'src/middleware/auth.js': { statements: 13.63, priority: 'critical' },
    'src/middleware/rateLimiter.js': { statements: 7.75, priority: 'high' },
    'src/middleware/requirePlan.js': { statements: 95.52, priority: 'high' },
    'src/middleware/security.js': { statements: 59.67, priority: 'high' },
    'src/middleware/sessionRefresh.js': { statements: 6.06, priority: 'medium' },

    // Routes
    'src/routes/admin.js': { statements: 16.29, priority: 'high' },
    'src/routes/auth.js': { statements: 14.84, priority: 'critical' },
    'src/routes/billing.js': { statements: 57.86, priority: 'high' },
    'src/routes/dashboard.js': { statements: 25.58, priority: 'medium' },
    'src/routes/integrations-new.js': { statements: 9.27, priority: 'high' },
    'src/routes/oauth.js': { statements: 0, priority: 'high' },
    'src/routes/plan.js': { statements: 22.44, priority: 'medium' },
    'src/routes/style-profile.js': { statements: 13.79, priority: 'high' },
    'src/routes/user.js': { statements: 68.26, priority: 'medium' }
  }
};

// Get all source files
async function getAllSourceFiles() {
  const files = glob('src/**/*.js', {
    ignore: ['src/public/**', 'src/**/*.test.js']
  });
  return files;
}

// Get all test files
async function getAllTestFiles() {
  const files = glob('tests/**/*.test.js');
  return files;
}

// Check if a source file has corresponding tests
function hasCorrespondingTest(srcFile) {
  const relativePath = srcFile.replace('src/', '');
  const baseName = path.basename(srcFile, '.js');

  // Possible test locations
  const possibleTests = [
    `tests/unit/${relativePath.replace('.js', '.test.js')}`,
    `tests/unit/${baseName}.test.js`,
    `tests/integration/${baseName}.test.js`,
    `tests/smoke/${baseName}.test.js`
  ];

  return possibleTests.some((testPath) => {
    try {
      require.resolve(path.resolve(testPath));
      return true;
    } catch {
      return false;
    }
  });
}

// Categorize coverage level
function categorizeCoverage(percentage) {
  if (percentage >= CONFIG.thresholds.high) return 'excellent';
  if (percentage >= CONFIG.thresholds.medium) return 'good';
  if (percentage >= CONFIG.thresholds.low) return 'poor';
  return 'critical';
}

// Get priority level
function getPriorityLevel(filePath) {
  if (filePath.includes('/workers/')) return 'critical';
  if (filePath.includes('/services/')) return 'critical';
  if (filePath.includes('/middleware/auth.js')) return 'critical';
  if (filePath.includes('/routes/auth.js')) return 'critical';
  if (filePath.includes('/middleware/')) return 'high';
  if (filePath.includes('/routes/')) return 'high';
  return 'medium';
}

// Generate coverage analysis
async function generateCoverageAnalysis() {
  const sourceFiles = await getAllSourceFiles();
  const testFiles = await getAllTestFiles();

  // Analysis results
  const analysis = {
    overview: {
      totalSourceFiles: sourceFiles.length,
      totalTestFiles: testFiles.length,
      currentCoverage: BASELINE_COVERAGE,
      filesWithTests: 0,
      filesWithoutTests: 0
    },
    coverage: {
      excellent: [],
      good: [],
      poor: [],
      critical: []
    },
    priorities: {
      critical: [],
      high: [],
      medium: [],
      low: []
    },
    gaps: {
      noTests: [],
      lowCoverage: [],
      missingFunctionality: []
    }
  };

  // Analyze each source file
  for (const file of sourceFiles) {
    const hasTests = hasCorrespondingTest(file);
    const coverage = BASELINE_COVERAGE.files[file] || {
      statements: 0,
      priority: getPriorityLevel(file)
    };
    const coverageLevel = categorizeCoverage(coverage.statements);
    const priority = coverage.priority;

    if (hasTests) {
      analysis.overview.filesWithTests++;
    } else {
      analysis.overview.filesWithoutTests++;
      analysis.gaps.noTests.push({
        file,
        priority,
        reason: 'No corresponding test file found'
      });
    }

    // Categorize by coverage
    analysis.coverage[coverageLevel].push({
      file,
      coverage: coverage.statements,
      priority,
      hasTests
    });

    // Categorize by priority
    analysis.priorities[priority].push({
      file,
      coverage: coverage.statements,
      hasTests,
      coverageLevel
    });

    // Identify gaps
    if (coverage.statements < CONFIG.thresholds.low) {
      analysis.gaps.lowCoverage.push({
        file,
        coverage: coverage.statements,
        priority,
        hasTests
      });
    }
  }

  return analysis;
}

// Generate markdown report
function generateMarkdownReport(analysis) {
  let md = `# Test Coverage Analysis Report\n\n`;
  md += `Generated on: ${new Date().toISOString()}\n\n`;

  // Overview
  md += `## 📊 Coverage Overview\n\n`;
  md += `### Current Coverage Metrics\n`;
  md += `- **Statements**: ${analysis.overview.currentCoverage.statements}%\n`;
  md += `- **Branches**: ${analysis.overview.currentCoverage.branches}%\n`;
  md += `- **Functions**: ${analysis.overview.currentCoverage.functions}%\n`;
  md += `- **Lines**: ${analysis.overview.currentCoverage.lines}%\n\n`;

  md += `### File Coverage Summary\n`;
  md += `- **Total Source Files**: ${analysis.overview.totalSourceFiles}\n`;
  md += `- **Total Test Files**: ${analysis.overview.totalTestFiles}\n`;
  md += `- **Files with Tests**: ${analysis.overview.filesWithTests}\n`;
  md += `- **Files without Tests**: ${analysis.overview.filesWithoutTests}\n\n`;

  // Coverage Distribution
  md += `## 📈 Coverage Distribution\n\n`;
  md += `| Category | Count | Threshold |\n`;
  md += `|----------|-------|-----------|\n`;
  md += `| Excellent (≥80%) | ${analysis.coverage.excellent.length} | ${CONFIG.thresholds.high}% |\n`;
  md += `| Good (≥60%) | ${analysis.coverage.good.length} | ${CONFIG.thresholds.medium}% |\n`;
  md += `| Poor (≥40%) | ${analysis.coverage.poor.length} | ${CONFIG.thresholds.low}% |\n`;
  md += `| Critical (<40%) | ${analysis.coverage.critical.length} | <${CONFIG.thresholds.low}% |\n\n`;

  // Critical Issues
  md += `## 🚨 Critical Coverage Issues\n\n`;
  if (analysis.coverage.critical.length > 0) {
    md += `### Files with Critical Coverage (<${CONFIG.thresholds.low}%)\n\n`;
    md += `| File | Coverage | Priority | Has Tests |\n`;
    md += `|------|----------|----------|----------|\n`;

    analysis.coverage.critical
      .sort((a, b) => a.coverage - b.coverage)
      .forEach((item) => {
        const hasTestsIcon = item.hasTests ? '✅' : '❌';
        const priorityIcon =
          item.priority === 'critical' ? '🔥' : item.priority === 'high' ? '⚠️' : '⚡';
        md += `| ${item.file} | ${item.coverage}% | ${priorityIcon} ${item.priority} | ${hasTestsIcon} |\n`;
      });
    md += '\n';
  }

  // Files without tests
  if (analysis.gaps.noTests.length > 0) {
    md += `### Files Without Tests\n\n`;
    md += `| File | Priority | Urgency |\n`;
    md += `|------|----------|---------|\n`;

    analysis.gaps.noTests
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .forEach((item) => {
        const priorityIcon =
          item.priority === 'critical'
            ? '🔥'
            : item.priority === 'high'
              ? '⚠️'
              : item.priority === 'medium'
                ? '⚡'
                : '💡';
        md += `| ${item.file} | ${priorityIcon} ${item.priority} | ${item.reason} |\n`;
      });
    md += '\n';
  }

  // Priority-based action plan
  md += `## 🎯 Action Plan by Priority\n\n`;

  ['critical', 'high', 'medium'].forEach((priority) => {
    const items = analysis.priorities[priority];
    if (items.length > 0) {
      const priorityIcon = priority === 'critical' ? '🔥' : priority === 'high' ? '⚠️' : '⚡';

      md += `### ${priorityIcon} ${priority.toUpperCase()} Priority (${items.length} files)\n\n`;

      const needsTests = items.filter((item) => !item.hasTests);
      const lowCoverage = items.filter(
        (item) => item.hasTests && item.coverage < CONFIG.thresholds.medium
      );

      if (needsTests.length > 0) {
        md += `**Files needing test creation:**\n`;
        needsTests.forEach((item) => {
          md += `- [ ] ${item.file} (no tests)\n`;
        });
        md += '\n';
      }

      if (lowCoverage.length > 0) {
        md += `**Files needing coverage improvement:**\n`;
        lowCoverage.forEach((item) => {
          md += `- [ ] ${item.file} (${item.coverage}% coverage)\n`;
        });
        md += '\n';
      }
    }
  });

  // Recommendations
  md += `## 💡 Recommendations\n\n`;
  md += `### Immediate Actions (Next Sprint)\n`;
  md += `1. **Critical Worker Coverage**: Add comprehensive tests for worker classes\n`;
  md += `2. **Authentication Security**: Improve auth middleware test coverage\n`;
  md += `3. **Core Services**: Add tests for queue, cost control, and shield services\n\n`;

  md += `### Short-term Goals (Next Month)\n`;
  md += `1. **Route Coverage**: Improve API endpoint test coverage\n`;
  md += `2. **Integration Tests**: Add end-to-end workflow tests\n`;
  md += `3. **Error Handling**: Test failure scenarios and edge cases\n\n`;

  md += `### Long-term Strategy\n`;
  md += `1. **Coverage Thresholds**: Set up CI coverage requirements\n`;
  md += `2. **Test Automation**: Implement coverage monitoring\n`;
  md += `3. **Documentation**: Keep test documentation up to date\n\n`;

  // Success metrics
  md += `## 📈 Success Metrics\n\n`;
  md += `### Target Coverage Goals\n`;
  md += `- **Overall Coverage**: Target 80% (currently ${analysis.overview.currentCoverage.statements}%)\n`;
  md += `- **Critical Files**: Target 90% coverage for workers and core services\n`;
  md += `- **Test Files**: Ensure all source files have corresponding tests\n\n`;

  md += `### Milestones\n`;
  md += `- [ ] **Milestone 1**: All critical priority files have tests (${analysis.priorities.critical.filter((f) => !f.hasTests).length} remaining)\n`;
  md += `- [ ] **Milestone 2**: Critical files reach 60% coverage\n`;
  md += `- [ ] **Milestone 3**: Overall coverage reaches 50%\n`;
  md += `- [ ] **Milestone 4**: Overall coverage reaches 80%\n\n`;

  return md;
}

// Main execution
async function main() {
  console.log('🔍 Analyzing test coverage...\n');

  try {
    const analysis = await generateCoverageAnalysis();
    const report = generateMarkdownReport(analysis);

    // Ensure docs directory exists
    await fs.mkdir('docs', { recursive: true });

    // Write report
    await fs.writeFile(CONFIG.outputFile, report);

    console.log('✅ Coverage analysis complete!');
    console.log(`📄 Report saved to: ${CONFIG.outputFile}`);
    console.log('\n📊 Quick Summary:');
    console.log(`- Current coverage: ${analysis.overview.currentCoverage.statements}%`);
    console.log(`- Files without tests: ${analysis.overview.filesWithoutTests}`);
    console.log(`- Critical coverage files: ${analysis.coverage.critical.length}`);
    console.log(`- Critical priority files: ${analysis.priorities.critical.length}`);
  } catch (error) {
    console.error('❌ Error analyzing coverage:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateCoverageAnalysis, generateMarkdownReport };
