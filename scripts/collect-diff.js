#!/usr/bin/env node

/**
 * Diff Collector - Structured Diff Generation for Guardian Agent
 *
 * Compares current repo state vs last approved commit and generates
 * structured JSON diffs for Guardian analysis and Admin Panel display.
 *
 * Part of GDD 2.0 Phase 16: Guardian Agent Core
 *
 * Usage:
 *   node scripts/collect-diff.js [options]
 *
 * Options:
 *   --base <commit>    Base commit to compare against (default: HEAD)
 *   --output <path>    Output path for diff JSON (default: docs/guardian/diffs/latest.json)
 *   --verbose          Detailed output
 *   --help             Show help
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const yaml = require('yaml');

// ============================================================
// Configuration
// ============================================================

const PRODUCT_GUARD_CONFIG = path.join(__dirname, '../config/product-guard.yaml');
const DEFAULT_OUTPUT = path.join(__dirname, '../docs/guardian/diffs/latest.json');

// ============================================================
// CLI Arguments
// ============================================================

const args = process.argv.slice(2);
const flags = {
  base: args.includes('--base') ? args[args.indexOf('--base') + 1] : 'HEAD',
  output: args.includes('--output') ? args[args.indexOf('--output') + 1] : DEFAULT_OUTPUT,
  verbose: args.includes('--verbose'),
  help: args.includes('--help')
};

// ============================================================
// Diff Collector Class
// ============================================================

class DiffCollector {
  constructor(baseCommit = 'HEAD') {
    this.baseCommit = baseCommit;
    this.config = null;
    this.diffData = {
      timestamp: new Date().toISOString(),
      base_commit: null,
      current_commit: null,
      domains_affected: [],
      files_changed: [],
      severity: 'SAFE',
      summary: {
        total_files: 0,
        total_lines_added: 0,
        total_lines_removed: 0,
        by_domain: {}
      }
    };
  }

  /**
   * Load product guard configuration
   */
  loadConfig() {
    try {
      const configContent = fs.readFileSync(PRODUCT_GUARD_CONFIG, 'utf8');
      this.config = yaml.parse(configContent);
      if (flags.verbose) {
        console.log('✅ Configuration loaded successfully');
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to load configuration:', error.message);
      return false;
    }
  }

  /**
   * Get current commit hash
   */
  getCurrentCommit() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get base commit hash
   */
  getBaseCommit() {
    try {
      if (this.baseCommit === 'HEAD') {
        return this.getCurrentCommit();
      }
      return execSync(`git rev-parse ${this.baseCommit}`, { encoding: 'utf8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get list of changed files
   */
  getChangedFiles() {
    try {
      let diff = '';

      // If base commit specified, use commit range comparison
      if (this.baseCommit !== 'HEAD') {
        diff = execSync(`git diff ${this.baseCommit} --name-status`, { encoding: 'utf8' });
      } else {
        // Otherwise, get staged + unstaged changes from working tree
        diff = execSync('git diff --cached --name-status', { encoding: 'utf8' });

        // If no staged changes, check unstaged
        if (!diff.trim()) {
          diff = execSync('git diff --name-status', { encoding: 'utf8' });
        }
      }

      if (!diff.trim()) {
        if (flags.verbose) {
          console.log('ℹ️  No changes detected');
        }
        return [];
      }

      // Parse diff output
      const changes = diff.trim().split('\n').map(line => {
        const [status, ...fileParts] = line.split('\t');
        const file = fileParts.join('\t');
        return { status, file };
      });

      if (flags.verbose) {
        console.log(`📊 Detected ${changes.length} changed file(s)`);
      }

      return changes;
    } catch (error) {
      console.error('❌ Failed to get changed files:', error.message);
      return [];
    }
  }

  /**
   * Get detailed diff for a file
   */
  getFileDiff(file) {
    try {
      let diff = '';

      // If base commit specified, use commit range comparison
      if (this.baseCommit !== 'HEAD') {
        diff = execSync(`git diff ${this.baseCommit} -- "${file}"`, { encoding: 'utf8' });
      } else {
        // Otherwise, get staged + unstaged changes from working tree
        diff = execSync(`git diff --cached -- "${file}"`, { encoding: 'utf8' });

        // If no staged changes, check unstaged
        if (!diff.trim()) {
          diff = execSync(`git diff -- "${file}"`, { encoding: 'utf8' });
        }
      }

      // Count lines (exclude diff headers +++ and ---)
      const lines = diff.split('\n');
      const added = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
      const removed = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;

      // Calculate hash
      const hash = crypto.createHash('sha256').update(diff).digest('hex');

      return { diff, added, removed, hash };
    } catch (error) {
      return { diff: '', added: 0, removed: 0, hash: 'error' };
    }
  }

  /**
   * Classify file by domain
   */
  classifyFile(file, fileDiff) {
    const domains = this.config.domains;
    const matchedDomains = [];
    let highestProtectionLevel = 'SAFE';

    // Check each domain
    for (const [domainName, domain] of Object.entries(domains)) {
      let matched = false;

      // 1. Check file path match
      if (domain.files) {
        for (const protectedFile of domain.files) {
          // Normalize paths for comparison
          const normalizedFile = file.replace(/\\/g, '/');
          const normalizedProtected = protectedFile.replace(/\\/g, '/');

          if (normalizedFile.includes(normalizedProtected) ||
              normalizedProtected.includes(normalizedFile)) {
            matched = true;
            break;
          }
        }
      }

      // 2. Check keyword match in diff
      if (!matched && domain.keywords && fileDiff.diff) {
        const diffLower = fileDiff.diff.toLowerCase();
        for (const keyword of domain.keywords) {
          if (diffLower.includes(keyword.toLowerCase())) {
            matched = true;
            break;
          }
        }
      }

      // Record match
      if (matched) {
        matchedDomains.push({
          name: domainName,
          protection_level: domain.protection_level,
          owner: domain.owner,
          description: domain.description
        });

        // Update highest protection level
        if (domain.protection_level === 'CRITICAL') {
          highestProtectionLevel = 'CRITICAL';
        } else if (domain.protection_level === 'SENSITIVE' && highestProtectionLevel !== 'CRITICAL') {
          highestProtectionLevel = 'SENSITIVE';
        }
      }
    }

    return {
      domains: matchedDomains,
      protection_level: highestProtectionLevel
    };
  }

  /**
   * Collect all diffs
   */
  collect() {
    console.log('\n📦 Diff Collector - Generating structured diffs...\n');

    // Load config
    if (!this.loadConfig()) {
      return false;
    }

    // Get commit info
    this.diffData.base_commit = this.getBaseCommit();
    this.diffData.current_commit = this.getCurrentCommit();

    if (flags.verbose) {
      console.log(`Base commit: ${this.diffData.base_commit}`);
      console.log(`Current commit: ${this.diffData.current_commit}\n`);
    }

    // Get changed files
    const changes = this.getChangedFiles();
    if (changes.length === 0) {
      console.log('✅ No changes to collect\n');
      return true;
    }

    // Analyze each file
    const domainSet = new Set();

    for (const change of changes) {
      const { file, status } = change;
      const fileDiff = this.getFileDiff(file);
      const classification = this.classifyFile(file, fileDiff);

      // Build file entry
      const fileEntry = {
        path: file,
        status,
        domains: classification.domains.map(d => d.name),
        protection_level: classification.protection_level,
        lines_added: fileDiff.added,
        lines_removed: fileDiff.removed,
        diff_hash: fileDiff.hash.substring(0, 12) // Short hash
      };

      this.diffData.files_changed.push(fileEntry);

      // Update summary
      this.diffData.summary.total_files++;
      this.diffData.summary.total_lines_added += fileDiff.added;
      this.diffData.summary.total_lines_removed += fileDiff.removed;

      // Track domains
      for (const domain of classification.domains) {
        domainSet.add(domain.name);

        if (!this.diffData.summary.by_domain[domain.name]) {
          this.diffData.summary.by_domain[domain.name] = {
            files: 0,
            lines_added: 0,
            lines_removed: 0,
            protection_level: domain.protection_level
          };
        }

        this.diffData.summary.by_domain[domain.name].files++;
        this.diffData.summary.by_domain[domain.name].lines_added += fileDiff.added;
        this.diffData.summary.by_domain[domain.name].lines_removed += fileDiff.removed;
      }

      // Update overall severity
      if (classification.protection_level === 'CRITICAL') {
        this.diffData.severity = 'CRITICAL';
      } else if (classification.protection_level === 'SENSITIVE' && this.diffData.severity !== 'CRITICAL') {
        this.diffData.severity = 'SENSITIVE';
      }
    }

    this.diffData.domains_affected = Array.from(domainSet);

    return true;
  }

  /**
   * Save diff data to file
   */
  save() {
    try {
      const outputPath = flags.output;
      const outputDir = path.dirname(outputPath);

      // Ensure directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write JSON
      fs.writeFileSync(outputPath, JSON.stringify(this.diffData, null, 2));

      console.log(`✅ Diff data saved to: ${outputPath}\n`);
      return true;
    } catch (error) {
      console.error('❌ Failed to save diff data:', error.message);
      return false;
    }
  }

  /**
   * Print summary
   */
  printSummary() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    Diff Collection Summary                    ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║ Total Files: ${this.diffData.summary.total_files}`.padEnd(64) + '║');
    console.log(`║ Lines Added: ${this.diffData.summary.total_lines_added}`.padEnd(64) + '║');
    console.log(`║ Lines Removed: ${this.diffData.summary.total_lines_removed}`.padEnd(64) + '║');
    console.log(`║ Domains Affected: ${this.diffData.domains_affected.join(', ') || 'None'}`.padEnd(64) + '║');
    console.log(`║ Overall Severity: ${this.diffData.severity}`.padEnd(64) + '║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');

    if (Object.keys(this.diffData.summary.by_domain).length > 0) {
      console.log('║ By Domain:'.padEnd(64) + '║');
      for (const [domain, stats] of Object.entries(this.diffData.summary.by_domain)) {
        console.log(`║   • ${domain}: ${stats.files} file(s), +${stats.lines_added} -${stats.lines_removed}`.padEnd(64) + '║');
      }
    }

    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  }
}

// ============================================================
// Main Execution
// ============================================================

function main() {
  if (flags.help) {
    console.log(`
Diff Collector - Structured Diff Generation

Usage:
  node scripts/collect-diff.js [options]

Options:
  --base <commit>    Base commit to compare against (default: HEAD)
  --output <path>    Output path for diff JSON (default: docs/guardian/diffs/latest.json)
  --verbose          Detailed output
  --help             Show help

Examples:
  node scripts/collect-diff.js --verbose
  node scripts/collect-diff.js --base main --output diffs/my-diff.json
`);
    process.exit(0);
  }

  const collector = new DiffCollector(flags.base);

  if (!collector.collect()) {
    process.exit(1);
  }

  collector.printSummary();

  if (!collector.save()) {
    process.exit(1);
  }

  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { DiffCollector };
