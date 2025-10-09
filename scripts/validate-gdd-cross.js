#!/usr/bin/env node

/**
 * GDD Cross-Validation Engine
 *
 * Validates consistency between GDD documentation and runtime data:
 * 1. Coverage values in node docs vs coverage-summary.json
 * 2. Last updated timestamps vs git commit history
 * 3. Declared dependencies vs actual code imports
 *
 * Part of GDD 2.0 Phase 15: Cross-Validation & Extended Health Metrics
 *
 * Usage:
 *   node scripts/validate-gdd-cross.js               # Full validation
 *   node scripts/validate-gdd-cross.js --node=shield # Specific node
 *   node scripts/validate-gdd-cross.js --summary     # Summary only
 *   node scripts/validate-gdd-cross.js --ci          # CI mode (exit 1 on errors)
 */

const fs = require('fs').promises;
const path = require('path');
const { GDDCrossValidator } = require('./gdd-cross-validator');

class CrossValidationRunner {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = path.resolve(__dirname, '..');
    this.validator = new GDDCrossValidator(this.rootDir);
    this.results = {
      nodes_validated: 0,
      coverage_validation: {
        total: 0,
        matched: 0,
        mismatched: 0,
        violations: []
      },
      timestamp_validation: {
        total: 0,
        valid: 0,
        stale: 0,
        future: 0,
        violations: []
      },
      dependency_validation: {
        total: 0,
        valid: 0,
        missing_deps: 0,
        phantom_deps: 0,
        violations: []
      },
      overall_score: 0,
      status: 'HEALTHY'
    };
  }

  /**
   * Main validation entry point
   */
  async validate() {
    try {
      const startTime = Date.now();

      if (!this.options.ci && !this.options.summary) {
        this.printHeader();
      }

      // Load all nodes
      const nodes = await this.loadNodes();

      // Filter by specific node if requested
      const nodesToValidate = this.options.node
        ? { [this.options.node]: nodes[this.options.node] }
        : nodes;

      if (!nodesToValidate || Object.keys(nodesToValidate).length === 0) {
        throw new Error(`Node not found: ${this.options.node}`);
      }

      this.results.nodes_validated = Object.keys(nodesToValidate).length;

      // Run validations for each node
      for (const [nodeName, nodeData] of Object.entries(nodesToValidate)) {
        await this.validateNode(nodeName, nodeData);
      }

      // Calculate overall score and status
      this.results.overall_score = this.validator.calculateScore(this.results.nodes_validated);
      this.results.status = this.validator.getStatus(this.results.overall_score);

      const duration = Date.now() - startTime;

      // Generate reports
      await this.generateReports();

      // Print summary
      if (!this.options.ci && !this.options.json) {
        this.printSummary(duration);
      }

      // Output JSON if requested
      if (this.options.json) {
        console.log(JSON.stringify(this.results, null, 2));
      }

      // Exit with appropriate code in CI mode
      if (this.options.ci) {
        const exitCode = this.results.status === 'FAIL' ? 2 : (this.results.status === 'WARNING' ? 1 : 0);
        process.exit(exitCode);
      }

      return this.results;
    } catch (error) {
      console.error(`❌ Cross-validation failed: ${error.message}`);
      if (this.options.ci) {
        process.exit(2);
      }
      throw error;
    }
  }

  /**
   * Load all GDD nodes
   */
  async loadNodes() {
    const nodesDir = path.join(this.rootDir, 'docs', 'nodes');
    const nodes = {};

    try {
      const files = await fs.readdir(nodesDir);
      const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md');

      for (const file of mdFiles) {
        const filePath = path.join(nodesDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const nodeName = file.replace('.md', '');

        nodes[nodeName] = {
          file: `docs/nodes/${file}`,
          content,
          metadata: this.parseNodeMetadata(content),
          name: nodeName
        };
      }

      return nodes;
    } catch (error) {
      throw new Error(`Failed to load nodes: ${error.message}`);
    }
  }

  /**
   * Parse node metadata
   */
  parseNodeMetadata(content) {
    const metadata = {
      last_updated: null,
      coverage: null,
      coverage_source: null,
      dependencies: []
    };

    // Extract last_updated
    const dateMatch = content.match(/\*?\*?last[_\s]updated:?\*?\*?\s*(\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) {
      metadata.last_updated = dateMatch[1];
    }

    // Extract coverage
    const coverageMatch = content.match(/\*?\*?coverage:?\*?\*?\s*(\d+)%/i);
    if (coverageMatch) {
      metadata.coverage = parseInt(coverageMatch[1]);
    }

    // Extract coverage source
    const sourceMatch = content.match(/\*?\*?coverage\s+source:?\*?\*?\s*(auto|manual)/i);
    if (sourceMatch) {
      metadata.coverage_source = sourceMatch[1].toLowerCase();
    }

    // Extract dependencies
    const depsSection = content.match(/##\s*Dependencies[\s\S]*?(?=##|$)/i);
    if (depsSection) {
      // Match standard markdown list format: "- node-name" or "- `node-name`"
      const depMatches = depsSection[0].match(/^\s*-\s*`?([a-z0-9-]+)`?\s*$/gim) || [];
      metadata.dependencies = depMatches.map(m => {
        const match = m.match(/`?([a-z0-9-]+)`?/i);
        return match ? match[1] : null;
      }).filter(Boolean);
    }

    return metadata;
  }

  /**
   * Validate a single node
   */
  async validateNode(nodeName, nodeData) {
    if (!this.options.ci && !this.options.summary) {
      process.stdout.write(`\r🔍 Validating ${nodeName}...`);
    }

    // 1. Coverage validation
    if (nodeData.metadata.coverage !== null) {
      const coverageResult = await this.validator.validateCoverage(
        nodeName,
        nodeData.metadata.coverage,
        3 // 3% tolerance
      );

      this.results.coverage_validation.total++;
      if (coverageResult.valid) {
        this.results.coverage_validation.matched++;
      } else {
        // Only count true mismatches, skip warnings (unavailable data, missing files)
        const isWarning = ['coverage_data_unavailable', 'no_source_files_found', 'coverage_calculation_failed'].includes(coverageResult.reason);

        if (!isWarning) {
          this.results.coverage_validation.mismatched++;
        }

        this.results.coverage_validation.violations.push({
          node: nodeName,
          declared: coverageResult.declared,
          actual: coverageResult.actual,
          diff: coverageResult.diff,
          reason: coverageResult.reason
        });
      }
    }

    // 2. Timestamp validation
    if (nodeData.metadata.last_updated) {
      const timestampResult = await this.validator.validateTimestamp(
        nodeName,
        nodeData.metadata.last_updated
      );

      this.results.timestamp_validation.total++;
      if (timestampResult.valid) {
        this.results.timestamp_validation.valid++;
      } else {
        if (timestampResult.reason === 'stale_date') {
          this.results.timestamp_validation.stale++;
        } else if (timestampResult.reason === 'future_date') {
          this.results.timestamp_validation.future++;
        }
        this.results.timestamp_validation.violations.push({
          node: nodeName,
          declared: timestampResult.declared,
          actual: timestampResult.actual,
          diffDays: timestampResult.diffDays,
          reason: timestampResult.reason
        });
      }
    }

    // 3. Dependency validation
    if (nodeData.metadata.dependencies && nodeData.metadata.dependencies.length > 0) {
      const depsResult = await this.validator.validateDependencies(
        nodeName,
        nodeData.metadata.dependencies
      );

      this.results.dependency_validation.total++;
      if (depsResult.valid) {
        this.results.dependency_validation.valid++;
      } else {
        this.results.dependency_validation.missing_deps += depsResult.missing.length;
        this.results.dependency_validation.phantom_deps += depsResult.phantom.length;
        this.results.dependency_validation.violations.push({
          node: nodeName,
          declared: depsResult.declared,
          detected: depsResult.actual,
          missing: depsResult.missing,
          phantom: depsResult.phantom,
          reason: depsResult.reason
        });
      }
    }
  }

  /**
   * Generate reports
   */
  async generateReports() {
    await this.generateMarkdownReport();
    await this.generateJSONReport();
  }

  /**
   * Generate Markdown report
   */
  async generateMarkdownReport() {
    const statusEmoji = {
      'HEALTHY': '🟢',
      'WARNING': '🟡',
      'FAIL': '🔴'
    };

    let markdown = `# Cross-Validation Report

**Generated:** ${new Date().toISOString()}
**Status:** ${statusEmoji[this.results.status]} ${this.results.status}
**Overall Score:** ${this.results.overall_score}/100

---

## Summary

- **Nodes Validated:** ${this.results.nodes_validated}
- **Overall Status:** ${this.results.status}

---

## Coverage Validation

**Status:** ${this.results.coverage_validation.mismatched === 0 ? '✅ PASS' : '⚠️ FAIL'}

- **Total Checked:** ${this.results.coverage_validation.total}
- **Matched:** ${this.results.coverage_validation.matched}
- **Mismatched:** ${this.results.coverage_validation.mismatched}

`;

    if (this.results.coverage_validation.violations.length > 0) {
      markdown += `### Violations\n\n`;
      markdown += `| Node | Declared | Actual | Diff | Reason |\n`;
      markdown += `|------|----------|--------|------|--------|\n`;
      for (const violation of this.results.coverage_validation.violations) {
        markdown += `| ${violation.node} | ${violation.declared}% | ${violation.actual || 'N/A'}% | ${violation.diff || 'N/A'}% | ${violation.reason} |\n`;
      }
      markdown += `\n`;
    }

    markdown += `---

## Timestamp Validation

**Status:** ${this.results.timestamp_validation.stale + this.results.timestamp_validation.future === 0 ? '✅ PASS' : '⚠️ FAIL'}

- **Total Checked:** ${this.results.timestamp_validation.total}
- **Valid:** ${this.results.timestamp_validation.valid}
- **Stale:** ${this.results.timestamp_validation.stale}
- **Future:** ${this.results.timestamp_validation.future}

`;

    if (this.results.timestamp_validation.violations.length > 0) {
      markdown += `### Violations\n\n`;
      markdown += `| Node | Declared | Actual | Diff (days) | Reason |\n`;
      markdown += `|------|----------|--------|-------------|--------|\n`;
      for (const violation of this.results.timestamp_validation.violations) {
        markdown += `| ${violation.node} | ${violation.declared} | ${violation.actual || 'N/A'} | ${violation.diffDays || 'N/A'} | ${violation.reason} |\n`;
      }
      markdown += `\n`;
    }

    markdown += `---

## Dependency Validation

**Status:** ${this.results.dependency_validation.missing_deps + this.results.dependency_validation.phantom_deps === 0 ? '✅ PASS' : '⚠️ FAIL'}

- **Total Checked:** ${this.results.dependency_validation.total}
- **Valid:** ${this.results.dependency_validation.valid}
- **Missing Dependencies:** ${this.results.dependency_validation.missing_deps}
- **Phantom Dependencies:** ${this.results.dependency_validation.phantom_deps}

`;

    if (this.results.dependency_validation.violations.length > 0) {
      markdown += `### Violations\n\n`;
      for (const violation of this.results.dependency_validation.violations) {
        markdown += `#### ${violation.node}\n\n`;
        markdown += `- **Declared:** ${violation.declared.join(', ') || 'None'}\n`;
        markdown += `- **Detected:** ${violation.detected.join(', ') || 'None'}\n`;
        if (violation.missing.length > 0) {
          markdown += `- **Missing:** ${violation.missing.join(', ')}\n`;
        }
        if (violation.phantom.length > 0) {
          markdown += `- **Phantom:** ${violation.phantom.join(', ')}\n`;
        }
        markdown += `\n`;
      }
    }

    markdown += `---

**Generated by:** GDD Cross-Validation Engine
`;

    const outputPath = path.join(this.rootDir, 'docs', 'cross-validation-report.md');
    await fs.writeFile(outputPath, markdown, 'utf-8');
  }

  /**
   * Generate JSON report
   */
  async generateJSONReport() {
    const outputPath = path.join(this.rootDir, 'gdd-cross.json');
    await fs.writeFile(outputPath, JSON.stringify(this.results, null, 2), 'utf-8');
  }

  /**
   * Print header
   */
  printHeader() {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('   CROSS-VALIDATION ENGINE');
    console.log('═══════════════════════════════════════');
    console.log('');
  }

  /**
   * Print summary
   */
  printSummary(duration) {
    const statusColors = {
      'HEALTHY': '\x1b[32m',
      'WARNING': '\x1b[33m',
      'FAIL': '\x1b[31m'
    };

    const reset = '\x1b[0m';
    const color = statusColors[this.results.status] || reset;

    console.log('');
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`${color}   STATUS: ${this.results.status}${reset}`);
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log(`Overall Score: ${this.results.overall_score}/100`);
    console.log(`Nodes Validated: ${this.results.nodes_validated}`);
    console.log(`Duration: ${duration}ms`);
    console.log('');
    console.log('COVERAGE VALIDATION:');
    console.log(`  ✅ Matched: ${this.results.coverage_validation.matched}/${this.results.coverage_validation.total}`);
    console.log(`  ❌ Mismatched: ${this.results.coverage_validation.mismatched}`);
    console.log('');
    console.log('TIMESTAMP VALIDATION:');
    console.log(`  ✅ Valid: ${this.results.timestamp_validation.valid}/${this.results.timestamp_validation.total}`);
    console.log(`  ⚠️  Stale: ${this.results.timestamp_validation.stale}`);
    console.log(`  ❌ Future: ${this.results.timestamp_validation.future}`);
    console.log('');
    console.log('DEPENDENCY VALIDATION:');
    console.log(`  ✅ Valid: ${this.results.dependency_validation.valid}/${this.results.dependency_validation.total}`);
    console.log(`  ⚠️  Missing: ${this.results.dependency_validation.missing_deps}`);
    console.log(`  ❌ Phantom: ${this.results.dependency_validation.phantom_deps}`);
    console.log('');
    console.log('REPORTS GENERATED:');
    console.log('  - docs/cross-validation-report.md');
    console.log('  - gdd-cross.json');
    console.log('');
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  const options = {
    full: args.includes('--full') || args.length === 0,
    node: args.find(arg => arg.startsWith('--node='))?.split('=')[1],
    summary: args.includes('--summary'),
    ci: args.includes('--ci'),
    json: args.includes('--json')
  };

  const runner = new CrossValidationRunner(options);
  await runner.validate();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(2);
  });
}

module.exports = { CrossValidationRunner };
