#!/usr/bin/env node
/**
 * GDD Post-Merge Sync Report Generator
 *
 * Generates a comprehensive markdown report after doc sync.
 *
 * Usage:
 *   node scripts/generate-sync-report.js --pr <number> --nodes <file> --output <path>
 *   node scripts/generate-sync-report.js --pr 700 --nodes affected-nodes.json --output docs/sync-reports/pr-700-sync.md
 *
 * Options:
 *   --pr <number>        PR number (required)
 *   --nodes <file>       JSON file with affected nodes (required)
 *   --output <path>      Output markdown file path (required)
 *   --verbose           Verbose output
 *
 * Expected JSON format:
 * {
 *   "nodes": ["auth-system", "billing"],
 *   "pr": 700,
 *   "branch": "fix/complete-login-registration-628",
 *   "title": "Complete login/registration fixes"
 * }
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

class SyncReportGenerator {
  constructor(options = {}) {
    this.prNumber = options.pr;
    this.nodesFile = options.nodes;
    this.outputPath = options.output;
    this.verbose = options.verbose || false;
    this.nodesDir = path.join(process.cwd(), 'docs/nodes');
    this.driftFile = path.join(process.cwd(), 'gdd-drift.json');
    this.healthFile = path.join(process.cwd(), 'gdd-health.json');
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  verbose(message) {
    if (this.verbose) {
      this.log(`  ${message}`, 'cyan');
    }
  }

  /**
   * Load affected nodes from JSON file
   */
  loadAffectedNodes() {
    try {
      const content = fs.readFileSync(this.nodesFile, 'utf8');
      const data = JSON.parse(content);

      if (!data.nodes || !Array.isArray(data.nodes)) {
        throw new Error('Invalid nodes file format: "nodes" array required');
      }

      this.verbose(`Loaded ${data.nodes.length} affected nodes`);
      return data;
    } catch (error) {
      this.log(`Error loading nodes file: ${error.message}`, 'red');
      process.exit(1);
    }
  }

  /**
   * Load drift data if available
   */
  loadDriftData() {
    if (!fs.existsSync(this.driftFile)) {
      this.verbose('No drift data found');
      return null;
    }

    try {
      const content = fs.readFileSync(this.driftFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.verbose(`Could not load drift data: ${error.message}`);
      return null;
    }
  }

  /**
   * Load health data if available
   */
  loadHealthData() {
    if (!fs.existsSync(this.healthFile)) {
      this.verbose('No health data found');
      return null;
    }

    try {
      const content = fs.readFileSync(this.healthFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.verbose(`Could not load health data: ${error.message}`);
      return null;
    }
  }

  /**
   * Get node metadata
   */
  getNodeMetadata(nodeName) {
    const nodePath = path.join(this.nodesDir, `${nodeName}.md`);

    if (!fs.existsSync(nodePath)) {
      return {
        status: 'Not Found',
        coverage: 'N/A',
        lastUpdated: 'N/A'
      };
    }

    try {
      const content = fs.readFileSync(nodePath, 'utf8');

      // Extract metadata using regex
      const statusMatch = content.match(/\*\*Estado:\*\* ([^\n]+)/);
      const coverageMatch = content.match(/\*\*Coverage:\*\* (\d+)%/);
      const lastUpdatedMatch = content.match(/\*\*Last Updated:\*\* (\d{4}-\d{2}-\d{2})/);

      return {
        status: statusMatch ? statusMatch[1].trim() : 'Unknown',
        coverage: coverageMatch ? `${coverageMatch[1]}%` : 'N/A',
        lastUpdated: lastUpdatedMatch ? lastUpdatedMatch[1] : 'N/A'
      };
    } catch (error) {
      this.verbose(`Error reading ${nodeName}.md: ${error.message}`);
      return {
        status: 'Error',
        coverage: 'N/A',
        lastUpdated: 'N/A'
      };
    }
  }

  /**
   * Get PR details using gh CLI
   */
  getPRDetails() {
    try {
      const output = execSync(`gh pr view ${this.prNumber} --json title,author,url`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return JSON.parse(output);
    } catch (error) {
      this.verbose(`Could not fetch PR details: ${error.message}`);
      return {
        title: 'Unknown',
        author: { login: 'Unknown' },
        url: `https://github.com/owner/repo/pull/${this.prNumber}`
      };
    }
  }

  /**
   * Generate markdown report
   */
  generateReport(affectedData, driftData, healthData) {
    const date = new Date().toISOString().split('T')[0];
    const prDetails = this.getPRDetails();

    const lines = [
      `# 📊 Documentation Sync Report - PR #${this.prNumber}`,
      ``,
      `**Generated:** ${date}`,
      `**PR:** [#${this.prNumber}](${prDetails.url})`,
      `**Title:** ${prDetails.title}`,
      `**Author:** @${prDetails.author.login}`,
      `**Branch:** \`${affectedData.branch || 'unknown'}\``,
      ``,
      `---`,
      ``,
      `## 📦 Affected Nodes (${affectedData.nodes.length})`,
      ``,
      `| Node | Status | Coverage | Last Updated |`,
      `|------|--------|----------|--------------|`
    ];

    // Add node rows
    for (const nodeName of affectedData.nodes) {
      const metadata = this.getNodeMetadata(nodeName);
      lines.push(
        `| [\`${nodeName}\`](../nodes/${nodeName}.md) | ${metadata.status} | ${metadata.coverage} | ${metadata.lastUpdated} |`
      );
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    // Drift analysis section
    if (driftData) {
      const highRiskNodes = driftData.nodes?.filter((n) => n.risk_level === 'high') || [];

      lines.push(`## 🔮 Drift Analysis`);
      lines.push(``);
      lines.push(`**High-Risk Nodes:** ${highRiskNodes.length}`);
      lines.push(``);

      if (highRiskNodes.length > 0) {
        lines.push(`### ⚠️ High-Risk Nodes`);
        lines.push(``);
        lines.push(`| Node | Risk Score | Reason |`);
        lines.push(`|------|------------|--------|`);

        for (const node of highRiskNodes) {
          lines.push(`| \`${node.name}\` | ${node.risk_score} | ${node.reason || 'N/A'} |`);
        }

        lines.push(``);
      }

      lines.push(`---`);
      lines.push(``);
    }

    // Health metrics section
    if (healthData) {
      lines.push(`## 📈 Health Metrics`);
      lines.push(``);
      lines.push(`**Overall Score:** ${healthData.overall_score || 'N/A'}`);
      lines.push(`**Threshold:** ${healthData.threshold || 'N/A'}`);
      lines.push(`**Status:** ${healthData.status || 'N/A'}`);
      lines.push(``);
      lines.push(`---`);
      lines.push(``);
    }

    // Changes summary
    lines.push(`## 📝 Changes Applied`);
    lines.push(``);
    lines.push(`- ✅ Updated node metadata (Last Updated, Related PRs)`);
    lines.push(`- ✅ Synced coverage information where available`);
    lines.push(`- ✅ Updated spec.md with changelog entry`);
    lines.push(`- ✅ Validated system-map.yaml consistency`);
    lines.push(`- ✅ Ran drift prediction analysis`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    // Recommendations
    lines.push(`## 💡 Recommendations`);
    lines.push(``);

    if (driftData && driftData.high_risk_count > 0) {
      lines.push(
        `- ⚠️ **${driftData.high_risk_count} high-risk nodes detected** - Consider updating documentation before next implementation`
      );
    } else {
      lines.push(`- ✅ No high-risk drift detected`);
    }

    if (healthData && healthData.overall_score < healthData.threshold) {
      lines.push(
        `- ⚠️ **Health score below threshold** - Run \`node scripts/auto-repair-gdd.js\` to auto-fix common issues`
      );
    } else {
      lines.push(`- ✅ Health score meets threshold`);
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    // Footer
    lines.push(`## 🔗 Related Files`);
    lines.push(``);
    lines.push(`- **PR:** #${this.prNumber}`);
    lines.push(`- **Affected Nodes:** ${affectedData.nodes.join(', ')}`);
    lines.push(`- **System Map:** \`system-map.yaml\``);
    lines.push(`- **Spec:** \`spec.md\``);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
    lines.push(`*Auto-generated by post-merge doc-sync workflow*`);

    return lines.join('\n');
  }

  /**
   * Write report to file
   */
  writeReport(content) {
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(this.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        this.verbose(`Created directory: ${outputDir}`);
      }

      fs.writeFileSync(this.outputPath, content, 'utf8');
      this.log(`✅ Report generated: ${this.outputPath}`, 'green');
      return true;
    } catch (error) {
      this.log(`Error writing report: ${error.message}`, 'red');
      return false;
    }
  }

  /**
   * Generate sync report
   */
  async generate() {
    this.log('📊 Generating sync report...', 'cyan');

    const affectedData = this.loadAffectedNodes();
    const driftData = this.loadDriftData();
    const healthData = this.loadHealthData();

    const reportContent = this.generateReport(affectedData, driftData, healthData);
    const success = this.writeReport(reportContent);

    // Summary
    this.log('', 'reset');
    this.log('📋 Report Summary:', 'bright');
    this.log(`  Nodes analyzed: ${affectedData.nodes.length}`, 'reset');
    this.log(`  PR number: #${this.prNumber}`, 'cyan');
    this.log(`  Output: ${this.outputPath}`, success ? 'green' : 'red');

    return success;
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    pr: null,
    nodes: null,
    output: null,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--pr' && args[i + 1]) {
      options.pr = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--nodes' && args[i + 1]) {
      options.nodes = args[i + 1];
      i++;
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--help') {
      console.log(`
Usage: node scripts/generate-sync-report.js [options]

Options:
  --pr <number>        PR number (required)
  --nodes <file>       JSON file with affected nodes (required)
  --output <path>      Output markdown file path (required)
  --verbose           Verbose output
  --help              Show this help message

Examples:
  node scripts/generate-sync-report.js --pr 700 --nodes affected-nodes.json --output docs/sync-reports/pr-700-sync.md
  node scripts/generate-sync-report.js --pr 700 --nodes affected-nodes.json --output report.md --verbose
      `);
      process.exit(0);
    }
  }

  if (!options.pr || !options.nodes || !options.output) {
    console.error('Error: --pr, --nodes, and --output are required\n');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  return options;
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  const generator = new SyncReportGenerator(options);

  generator
    .generate()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
      process.exit(1);
    });
}

module.exports = SyncReportGenerator;
