#!/usr/bin/env node
/**
 * GDD Post-Merge spec.md Synchronization Script
 *
 * Updates spec.md with post-merge changelog entry for affected nodes.
 *
 * Usage:
 *   node scripts/sync-spec-md.js --nodes <affected-nodes.json>
 *   node scripts/sync-spec-md.js --nodes affected-nodes.json --dry-run
 *   node scripts/sync-spec-md.js --nodes affected-nodes.json --verbose
 *
 * Options:
 *   --nodes <file>       JSON file with affected nodes (required)
 *   --dry-run           Show what would be added without writing
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

class SpecSynchronizer {
  constructor(options = {}) {
    this.nodesFile = options.nodes;
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.specPath = path.join(process.cwd(), 'spec.md');
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
   * Generate changelog entry for spec.md
   */
  generateChangelogEntry(affectedData) {
    const date = new Date().toISOString().split('T')[0];
    const { nodes, pr, branch, title } = affectedData;

    const entry = [
      `## 🔄 Post-Merge Documentation Sync - PR #${pr}`,
      ``,
      `### 🛠️ Implementation Date: ${date}`,
      ``,
      `### 📋 Summary`,
      ``,
      title ? `**PR Title:** ${title}` : '',
      `**Branch:** \`${branch || 'unknown'}\``,
      `**Affected Nodes:** ${nodes.length}`,
      ``,
      `### 📦 Affected GDD Nodes`,
      ``,
      ...nodes.map((node) => `- [\`${node}\`](docs/nodes/${node}.md)`),
      ``,
      `### 📝 Changes`,
      ``,
      `- Updated node metadata (Last Updated, Related PRs)`,
      `- Synced coverage information where available`,
      `- Updated cross-references in affected nodes`,
      ``,
      `### 🔗 Related`,
      ``,
      `- **PR:** #${pr}`,
      `- **Branch:** \`${branch || 'unknown'}\``,
      `- **Sync Report:** \`docs/sync-reports/pr-${pr}-sync.md\``,
      ``,
      `---`,
      ``
    ]
      .filter((line) => line !== undefined)
      .join('\n');

    return entry;
  }

  /**
   * Insert changelog entry at the top of spec.md
   */
  updateSpecFile(entry) {
    if (!fs.existsSync(this.specPath)) {
      this.log(`Error: spec.md not found at ${this.specPath}`, 'red');
      process.exit(1);
    }

    try {
      const content = fs.readFileSync(this.specPath, 'utf8');

      // Find the first # heading (main title)
      const lines = content.split('\n');
      let insertIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^#[^#]/)) {
          // Found main title, insert after it
          insertIndex = i + 1;
          // Skip empty lines after title
          while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
            insertIndex++;
          }
          break;
        }
      }

      // Insert the entry
      lines.splice(insertIndex, 0, entry);
      const updatedContent = lines.join('\n');

      if (!this.dryRun) {
        fs.writeFileSync(this.specPath, updatedContent, 'utf8');
        this.log('✅ Updated spec.md with changelog entry', 'green');
      } else {
        this.log('[DRY RUN] Would add the following to spec.md:', 'yellow');
        this.log('', 'reset');
        this.log(entry, 'cyan');
      }

      return true;
    } catch (error) {
      this.log(`Error updating spec.md: ${error.message}`, 'red');
      return false;
    }
  }

  /**
   * Sync spec.md
   */
  async sync() {
    this.log('📖 Starting spec.md synchronization...', 'cyan');

    const affectedData = this.loadAffectedNodes();
    const entry = this.generateChangelogEntry(affectedData);
    const updated = this.updateSpecFile(entry);

    // Summary
    this.log('', 'reset');
    this.log('📊 Sync Summary:', 'bright');
    this.log(`  Nodes affected: ${affectedData.nodes.length}`, 'reset');
    this.log(`  PR number: #${affectedData.pr}`, 'cyan');
    this.log(`  spec.md updated: ${updated ? 'Yes' : 'No'}`, updated ? 'green' : 'red');

    if (this.dryRun) {
      this.log('\n⚠️  DRY RUN MODE - No files were modified', 'yellow');
    }

    return updated;
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    nodes: null,
    dryRun: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--nodes' && args[i + 1]) {
      options.nodes = args[i + 1];
      i++;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--help') {
      console.log(`
Usage: node scripts/sync-spec-md.js [options]

Options:
  --nodes <file>       JSON file with affected nodes (required)
  --dry-run           Show what would be added without writing
  --verbose           Verbose output
  --help              Show this help message

Examples:
  node scripts/sync-spec-md.js --nodes affected-nodes.json
  node scripts/sync-spec-md.js --nodes affected-nodes.json --dry-run
  node scripts/sync-spec-md.js --nodes affected-nodes.json --verbose
      `);
      process.exit(0);
    }
  }

  if (!options.nodes) {
    console.error('Error: --nodes is required\n');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  return options;
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  const synchronizer = new SpecSynchronizer(options);

  synchronizer
    .sync()
    .then((updated) => {
      process.exit(updated ? 0 : 1);
    })
    .catch((error) => {
      console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
      process.exit(1);
    });
}

module.exports = SpecSynchronizer;
