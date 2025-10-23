#!/usr/bin/env node
/**
 * GDD Post-Merge Node Synchronization Script
 *
 * Synchronizes GDD nodes after a PR merge by updating metadata,
 * coverage information, and related PRs.
 *
 * Usage:
 *   node scripts/sync-gdd-nodes.js --pr <number> --nodes <affected-nodes.json>
 *   node scripts/sync-gdd-nodes.js --pr 700 --nodes affected-nodes.json
 *   node scripts/sync-gdd-nodes.js --dry-run --pr 700 --nodes affected-nodes.json
 *
 * Options:
 *   --pr <number>        PR number that was merged
 *   --nodes <file>       JSON file with affected nodes
 *   --dry-run           Show what would be updated without writing
 *   --verbose           Verbose output
 *
 * Expected JSON format:
 * {
 *   "nodes": ["auth-system", "billing", "cost-control"],
 *   "pr": 700,
 *   "branch": "fix/complete-login-registration-628"
 * }
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

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

class NodeSynchronizer {
  constructor(options = {}) {
    this.prNumber = options.pr;
    this.nodesFile = options.nodes;
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.nodesDir = path.join(process.cwd(), 'docs/nodes');
    this.systemMapPath = path.join(process.cwd(), 'system-map.yaml');
    this.coveragePath = path.join(process.cwd(), 'coverage/coverage-summary.json');
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
   * Load coverage data from coverage-summary.json
   */
  loadCoverageData() {
    if (!fs.existsSync(this.coveragePath)) {
      this.verbose('No coverage data found, skipping coverage sync');
      return null;
    }

    try {
      const content = fs.readFileSync(this.coveragePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.log(`Warning: Could not load coverage data: ${error.message}`, 'yellow');
      return null;
    }
  }

  /**
   * Load system map to get node-to-file mappings
   */
  loadSystemMap() {
    try {
      const content = fs.readFileSync(this.systemMapPath, 'utf8');
      return yaml.load(content);
    } catch (error) {
      this.log(`Error loading system map: ${error.message}`, 'red');
      process.exit(1);
    }
  }

  /**
   * Calculate coverage for a node based on its implementation files
   */
  calculateNodeCoverage(nodeName, systemMap, coverageData) {
    if (!coverageData || !systemMap.features[nodeName]) {
      return null;
    }

    const nodeConfig = systemMap.features[nodeName];
    const implementationFiles = nodeConfig.implementation || [];

    if (implementationFiles.length === 0) {
      return null;
    }

    let totalStatements = 0;
    let coveredStatements = 0;

    for (const file of implementationFiles) {
      const filePath = path.join(process.cwd(), file);
      const relativePath = path.relative(process.cwd(), filePath);

      if (coverageData[relativePath]) {
        const fileData = coverageData[relativePath];
        totalStatements += fileData.statements?.total || 0;
        coveredStatements += fileData.statements?.covered || 0;
      }
    }

    if (totalStatements === 0) {
      return null;
    }

    return Math.round((coveredStatements / totalStatements) * 100);
  }

  /**
   * Update a single node file
   */
  updateNodeFile(nodeName, prNumber, coverage = null) {
    const nodePath = path.join(this.nodesDir, `${nodeName}.md`);

    if (!fs.existsSync(nodePath)) {
      this.log(`Warning: Node file not found: ${nodePath}`, 'yellow');
      return false;
    }

    try {
      let content = fs.readFileSync(nodePath, 'utf8');
      const originalContent = content;
      const currentDate = new Date().toISOString().split('T')[0];

      // Update "Last Updated" field
      content = content.replace(
        /\*\*Last Updated:\*\* \d{4}-\d{2}-\d{2}/,
        `**Last Updated:** ${currentDate}`
      );

      // Update "Related PRs" field (append if exists, create if not)
      if (content.includes('**Related PRs:**')) {
        content = content.replace(
          /\*\*Related PRs:\*\* (#\d+(?:, #\d+)*)/,
          (match, prs) => {
            const prList = prs.split(', ').map(pr => pr.trim());
            const newPR = `#${prNumber}`;
            if (!prList.includes(newPR)) {
              prList.push(newPR);
            }
            return `**Related PRs:** ${prList.join(', ')}`;
          }
        );
      } else {
        // Add Related PRs after Last Updated
        content = content.replace(
          /(\*\*Last Updated:\*\* \d{4}-\d{2}-\d{2})/,
          `$1\n**Related PRs:** #${prNumber}`
        );
      }

      // Update coverage if available and source is auto
      if (coverage !== null && content.includes('**Coverage Source:** auto')) {
        content = content.replace(
          /\*\*Coverage:\*\* \d+%/,
          `**Coverage:** ${coverage}%`
        );
        this.verbose(`Updated coverage to ${coverage}%`);
      }

      if (content !== originalContent) {
        if (!this.dryRun) {
          fs.writeFileSync(nodePath, content, 'utf8');
          this.log(`✅ Updated ${nodeName}.md`, 'green');
        } else {
          this.log(`[DRY RUN] Would update ${nodeName}.md`, 'yellow');
        }
        return true;
      } else {
        this.verbose(`No changes needed for ${nodeName}.md`);
        return false;
      }

    } catch (error) {
      this.log(`Error updating ${nodeName}.md: ${error.message}`, 'red');
      return false;
    }
  }

  /**
   * Sync all affected nodes
   */
  async sync() {
    this.log('🔄 Starting GDD node synchronization...', 'cyan');

    const affectedData = this.loadAffectedNodes();
    const systemMap = this.loadSystemMap();
    const coverageData = this.loadCoverageData();

    let updatedCount = 0;

    for (const nodeName of affectedData.nodes) {
      this.verbose(`Processing ${nodeName}...`);

      const coverage = this.calculateNodeCoverage(nodeName, systemMap, coverageData);
      const updated = this.updateNodeFile(nodeName, this.prNumber, coverage);

      if (updated) {
        updatedCount++;
      }
    }

    // Summary
    this.log('', 'reset');
    this.log('📊 Sync Summary:', 'bright');
    this.log(`  Nodes processed: ${affectedData.nodes.length}`, 'reset');
    this.log(`  Nodes updated: ${updatedCount}`, updatedCount > 0 ? 'green' : 'yellow');
    this.log(`  PR number: #${this.prNumber}`, 'cyan');

    if (this.dryRun) {
      this.log('\n⚠️  DRY RUN MODE - No files were modified', 'yellow');
    }

    return updatedCount > 0;
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    pr: null,
    nodes: null,
    dryRun: false,
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
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--help') {
      console.log(`
Usage: node scripts/sync-gdd-nodes.js [options]

Options:
  --pr <number>        PR number that was merged (required)
  --nodes <file>       JSON file with affected nodes (required)
  --dry-run           Show what would be updated without writing
  --verbose           Verbose output
  --help              Show this help message

Examples:
  node scripts/sync-gdd-nodes.js --pr 700 --nodes affected-nodes.json
  node scripts/sync-gdd-nodes.js --pr 700 --nodes affected-nodes.json --dry-run
  node scripts/sync-gdd-nodes.js --pr 700 --nodes affected-nodes.json --verbose
      `);
      process.exit(0);
    }
  }

  if (!options.pr || !options.nodes) {
    console.error('Error: --pr and --nodes are required\n');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  return options;
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  const synchronizer = new NodeSynchronizer(options);

  synchronizer.sync()
    .then(hasUpdates => {
      process.exit(hasUpdates ? 0 : 0); // Always exit 0 (success)
    })
    .catch(error => {
      console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
      process.exit(1);
    });
}

module.exports = NodeSynchronizer;
