#!/usr/bin/env node

/**
 * GDD Metrics Sync - Issue #477
 *
 * Auto-generates and syncs GDD metrics from JSON files to documentation.
 * Prevents manual editing of metrics like Lighthouse scores, node counts,
 * test results, and health scores.
 *
 * Usage:
 *   node scripts/sync-gdd-metrics.js                  # Interactive mode
 *   node scripts/sync-gdd-metrics.js --auto           # Auto-sync all
 *   node scripts/sync-gdd-metrics.js --dry-run        # Preview changes
 *   node scripts/sync-gdd-metrics.js --ci             # CI mode (silent, JSON output)
 *   node scripts/sync-gdd-metrics.js --metric=<name>  # Sync specific metric
 *   node scripts/sync-gdd-metrics.js --validate       # Validate metric consistency
 *
 * Exit Codes:
 *   0 - Success
 *   1 - Error (validation failed or file errors)
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Stdout/stderr wrappers to avoid console.* usage
const out = (...args) => process.stdout.write(`${args.join(' ')}\n`);
const err = (...args) => process.stderr.write(`${args.join(' ')}\n`);

/**
 * MetricsCollector - Collects metrics from various JSON sources
 */
class MetricsCollector {
  constructor(rootDir) {
    this.rootDir = rootDir;
  }

  /**
   * Collect Lighthouse accessibility score from most recent report
   * @returns {Object|null} { score, source, timestamp }
   */
  async collectLighthouseScore() {
    try {
      // Find most recent lighthouse report
      const testEvidencePath = path.join(this.rootDir, 'docs', 'test-evidence');
      const lighthouseFiles = [];

      // Recursively search for lighthouse-*.json files
      const searchDir = async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await searchDir(fullPath);
          } else if (entry.isFile() && /lighthouse.*\.json$/i.test(entry.name)) {
            const stats = await fs.stat(fullPath);
            lighthouseFiles.push({ path: fullPath, mtime: stats.mtime });
          }
        }
      };

      await searchDir(testEvidencePath);

      if (lighthouseFiles.length === 0) {
        return null;
      }

      // Sort by modification time, most recent first
      lighthouseFiles.sort((a, b) => b.mtime - a.mtime);
      const mostRecent = lighthouseFiles[0];

      // Read and parse
      const content = await fs.readFile(mostRecent.path, 'utf-8');
      const data = JSON.parse(content);

      // Extract accessibility score
      const accessibilityScore = data.categories?.accessibility?.score;
      if (accessibilityScore === undefined) {
        return null;
      }

      return {
        score: Math.round(accessibilityScore * 100),
        source: path.relative(this.rootDir, mostRecent.path),
        timestamp: mostRecent.mtime.toISOString()
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Collect node count from gdd-status.json
   * @returns {Object|null} { total, healthy, source }
   */
  async collectNodeCount() {
    try {
      const statusPath = path.join(this.rootDir, 'gdd-status.json');
      const content = await fs.readFile(statusPath, 'utf-8');
      const data = JSON.parse(content);

      const total = data.nodes_validated || 0;
      // Issue #621, CodeRabbit Minor: Clamp to valid bounds
      const orphans = Math.max(0, (data.orphans || []).length);
      const healthy = Math.max(0, Math.min(total, total - orphans));

      return {
        total,
        healthy,
        orphans,
        source: 'gdd-status.json'
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Collect system health score
   * @returns {Object|null} { score, source }
   */
  async collectHealthScore() {
    try {
      // Execute score-gdd-health.js to get current health
      const scriptPath = path.join(this.rootDir, 'scripts', 'score-gdd-health.js');
      const output = execSync(`node "${scriptPath}" --ci`, {
        cwd: this.rootDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Parse output for health score
      // Expected format: "Overall Health: XX.X/100"
      const match = output.match(/Overall Health:\s*(\d+(?:\.\d+)?)/i);
      if (!match) {
        return null;
      }

      return {
        score: parseFloat(match[1]),
        source: 'score-gdd-health.js'
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Collect test coverage from coverage-summary.json
   * @returns {Object|null} { lines, branches, functions, statements, source }
   */
  async collectCoverage() {
    try {
      const coveragePath = path.join(this.rootDir, 'coverage', 'coverage-summary.json');
      const content = await fs.readFile(coveragePath, 'utf-8');
      const data = JSON.parse(content);

      const total = data.total;
      if (!total) {
        return null;
      }

      return {
        lines: total.lines?.pct || 0,
        branches: total.branches?.pct || 0,
        functions: total.functions?.pct || 0,
        statements: total.statements?.pct || 0,
        source: 'coverage/coverage-summary.json'
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Collect all metrics
   * @returns {Object} All collected metrics
   */
  async collectAll() {
    const [lighthouse, nodeCount, healthScore, coverage] = await Promise.all([
      this.collectLighthouseScore(),
      this.collectNodeCount(),
      this.collectHealthScore(),
      this.collectCoverage()
    ]);

    return {
      lighthouse,
      nodeCount,
      healthScore,
      coverage,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * DocumentUpdater - Updates documentation with collected metrics
 */
class DocumentUpdater {
  constructor(rootDir, options = {}) {
    this.rootDir = rootDir;
    this.dryRun = options.dryRun || false;
    this.backupDir = null;
    this.changes = [];
  }

  /**
   * Create backup of files before modification
   */
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.backupDir = path.join(this.rootDir, '.gdd-backups', `metrics-sync-${timestamp}`);
    await fs.mkdir(this.backupDir, { recursive: true });
    return this.backupDir;
  }

  /**
   * Backup a file
   */
  async backupFile(filePath) {
    if (this.dryRun || !this.backupDir) {
      return;
    }

    const relativePath = path.relative(this.rootDir, filePath);
    const backupPath = path.join(this.backupDir, relativePath);
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.copyFile(filePath, backupPath);
  }

  /**
   * Update GDD Implementation Summary with metrics
   * @param {Object} metrics - Collected metrics
   */
  async updateGDDSummary(metrics) {
    const summaryPath = path.join(this.rootDir, 'docs', 'GDD-IMPLEMENTATION-SUMMARY.md');

    try {
      // Read current content
      const content = await fs.readFile(summaryPath, 'utf-8');
      let newContent = content;
      let modified = false;

      // Update node count
      if (metrics.nodeCount) {
        const { total, healthy } = metrics.nodeCount;
        // Match: | **Documented Nodes** | 13/13 | ✅ 100% |
        const nodeCountRegex = /(\|\s*\*\*Documented Nodes\*\*\s*\|\s*)(\d+\/\d+)(\s*\|)/g;
        const newNodeCount = `${healthy}/${total}`;
        const replaced = newContent.replace(nodeCountRegex, `$1${newNodeCount}$3`);
        if (replaced !== newContent) {
          newContent = replaced;
          modified = true;
          this.changes.push({
            file: 'GDD-IMPLEMENTATION-SUMMARY.md',
            metric: 'node_count',
            old: content.match(nodeCountRegex)?.[0],
            new: `${healthy}/${total}`
          });
        }
      }

      // Update health score
      if (metrics.healthScore) {
        const { score } = metrics.healthScore;
        // Match: | **Average Health Score** | 98.8/100 | 🟢 HEALTHY |
        const healthRegex =
          /(\|\s*\*\*Average Health Score\*\*\s*\|\s*)(\d+(?:\.\d+)?\/100)(\s*\|)/g;
        const newHealth = `${score.toFixed(1)}/100`;
        const replaced = newContent.replace(healthRegex, `$1${newHealth}$3`);
        if (replaced !== newContent) {
          newContent = replaced;
          modified = true;
          this.changes.push({
            file: 'GDD-IMPLEMENTATION-SUMMARY.md',
            metric: 'health_score',
            old: content.match(healthRegex)?.[0],
            new: newHealth
          });
        }
      }

      // Update lighthouse score (if referenced in docs)
      if (metrics.lighthouse) {
        const { score } = metrics.lighthouse;
        // Match: Lighthouse: 98/100 or similar patterns
        const lighthouseRegex = /(Lighthouse:?\s*)(\d+)\/100/gi;
        const newLighthouse = `${score}/100`;
        const replaced = newContent.replace(lighthouseRegex, `$1${newLighthouse}`);
        if (replaced !== newContent) {
          newContent = replaced;
          modified = true;
          this.changes.push({
            file: 'GDD-IMPLEMENTATION-SUMMARY.md',
            metric: 'lighthouse_score',
            old: score,
            new: newLighthouse
          });
        }
      }

      // Write if modified and not dry-run
      if (modified) {
        if (!this.dryRun) {
          await this.backupFile(summaryPath);
          await fs.writeFile(summaryPath, newContent, 'utf-8');
        }
        return {
          updated: true,
          changes: this.changes.filter((c) => c.file === 'GDD-IMPLEMENTATION-SUMMARY.md')
        };
      }

      return { updated: false, changes: [] };
    } catch (error) {
      err(`Error updating GDD Summary: ${error.message}`);
      return { updated: false, error: error.message };
    }
  }

  /**
   * Update all documents
   * @param {Object} metrics - Collected metrics
   */
  async updateAll(metrics) {
    // Create backup first
    if (!this.dryRun) {
      await this.createBackup();
    }

    const results = {
      summary: await this.updateGDDSummary(metrics),
      backupDir: this.backupDir,
      dryRun: this.dryRun
    };

    return results;
  }

  /**
   * Validate metric consistency between docs and JSON sources
   * @param {Object} metrics - Collected metrics
   * @returns {Array} Validation issues
   */
  async validate(metrics) {
    const issues = [];
    const summaryPath = path.join(this.rootDir, 'docs', 'GDD-IMPLEMENTATION-SUMMARY.md');

    try {
      const content = await fs.readFile(summaryPath, 'utf-8');

      // Validate node count
      if (metrics.nodeCount) {
        const nodeCountMatch = content.match(/\*\*Documented Nodes\*\*\s*\|\s*(\d+)\/(\d+)/);
        if (nodeCountMatch) {
          const [, docHealthy, docTotal] = nodeCountMatch;
          const { total, healthy } = metrics.nodeCount;
          if (parseInt(docTotal) !== total || parseInt(docHealthy) !== healthy) {
            issues.push({
              metric: 'node_count',
              documented: `${docHealthy}/${docTotal}`,
              actual: `${healthy}/${total}`,
              severity: 'warning'
            });
          }
        }
      }

      // Validate health score
      if (metrics.healthScore) {
        const healthMatch = content.match(
          /\*\*Average Health Score\*\*\s*\|\s*(\d+(?:\.\d+)?)\/100/
        );
        if (healthMatch) {
          const [, docScore] = healthMatch;
          const { score } = metrics.healthScore;
          const diff = Math.abs(parseFloat(docScore) - score);
          if (diff > 0.5) {
            // Tolerance of 0.5 points
            issues.push({
              metric: 'health_score',
              documented: `${docScore}/100`,
              actual: `${score.toFixed(1)}/100`,
              diff: diff.toFixed(1),
              severity: 'warning'
            });
          }
        }
      }

      return issues;
    } catch (error) {
      return [{ metric: 'validation', error: error.message, severity: 'error' }];
    }
  }
}

/**
 * CLI - Main entry point
 */
class CLI {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.options = this.parseArgs();
  }

  parseArgs() {
    const args = process.argv.slice(2);
    return {
      auto: args.includes('--auto'),
      dryRun: args.includes('--dry-run'),
      ci: args.includes('--ci'),
      validate: args.includes('--validate'),
      help: args.includes('--help') || args.includes('-h'),
      metric: args.find((arg) => arg.startsWith('--metric='))?.split('=')[1]
    };
  }

  printHelp() {
    out(`
GDD Metrics Sync - Auto-generate metrics from JSON files

Usage:
  node scripts/sync-gdd-metrics.js [options]

Options:
  --auto                  Auto-sync all metrics without prompts
  --dry-run               Preview changes without modifying files
  --ci                    CI mode (silent, JSON output only)
  --metric=<name>         Sync specific metric only
                          Accepted values: lighthouse, node, health, coverage
  --validate              Validate metric consistency
  --help, -h              Show this help

Examples:
  # Preview all changes
  node scripts/sync-gdd-metrics.js --dry-run

  # Auto-sync all metrics
  node scripts/sync-gdd-metrics.js --auto

  # Validate consistency
  node scripts/sync-gdd-metrics.js --validate

  # CI mode
  node scripts/sync-gdd-metrics.js --ci --auto

Metrics Collected:
  - Lighthouse accessibility score (from test-evidence/**/lighthouse-*.json)
  - Node count (from gdd-status.json)
  - System health score (from score-gdd-health.js)
  - Test coverage (from coverage/coverage-summary.json)

Exit Codes:
  0 - Success
  1 - Error or validation failed
    `);
  }

  async run() {
    if (this.options.help) {
      this.printHelp();
      return 0;
    }

    const ciMode = this.options.ci;

    if (!ciMode) {
      out('');
      out('═══════════════════════════════════════════');
      out('      📊 GDD METRICS SYNC');
      out('═══════════════════════════════════════════');
      out('');
    }

    // Collect metrics
    const collector = new MetricsCollector(this.rootDir);
    if (!ciMode) {
      out('📥 Collecting metrics from JSON sources...');
    }

    const metrics = await collector.collectAll();

    // Issue #621, CodeRabbit Major: Implement --metric filter
    const metricKey = this.options.metric && this.options.metric.toLowerCase();
    const aliases = {
      lighthouse: 'lighthouse',
      node: 'nodeCount',
      nodecount: 'nodeCount',
      nodes: 'nodeCount',
      health: 'healthScore',
      healthscore: 'healthScore',
      coverage: 'coverage'
    };

    let filtered = metrics;
    if (metricKey && aliases[metricKey]) {
      const k = aliases[metricKey];
      filtered = {
        lighthouse: null,
        nodeCount: null,
        healthScore: null,
        coverage: null,
        timestamp: metrics.timestamp
      };
      filtered[k] = metrics[k];
    }

    if (!ciMode) {
      out('');
      out('Collected Metrics:');
      if (filtered.lighthouse) {
        out(
          `  ✓ Lighthouse: ${filtered.lighthouse.score}/100 (from ${filtered.lighthouse.source})`
        );
      } else {
        out(`  ⚠ Lighthouse: Not available`);
      }

      if (filtered.nodeCount) {
        out(
          `  ✓ Node Count: ${filtered.nodeCount.healthy}/${filtered.nodeCount.total} (${filtered.nodeCount.orphans} orphans)`
        );
      } else {
        out(`  ⚠ Node Count: Not available`);
      }

      if (filtered.healthScore) {
        out(`  ✓ Health Score: ${filtered.healthScore.score.toFixed(1)}/100`);
      } else {
        out(`  ⚠ Health Score: Not available`);
      }

      if (filtered.coverage) {
        out(
          `  ✓ Coverage: ${filtered.coverage.lines.toFixed(1)}% lines, ${filtered.coverage.branches.toFixed(1)}% branches`
        );
      } else {
        out(`  ⚠ Coverage: Not available`);
      }
      out('');
    }

    // Validate mode
    if (this.options.validate) {
      const updater = new DocumentUpdater(this.rootDir, { dryRun: true });
      const issues = await updater.validate(filtered);

      if (ciMode) {
        process.stdout.write(JSON.stringify({ validation: issues, metrics: filtered }, null, 2));
        return issues.length === 0 ? 0 : 1;
      }

      out('🔍 Validation Results:');
      if (issues.length === 0) {
        out('  ✅ All metrics are consistent with documentation');
        return 0;
      }

      out(`  ⚠️  Found ${issues.length} inconsistencies:`);
      issues.forEach((issue) => {
        const severity = issue.severity === 'error' ? '❌' : '⚠️';
        out(
          `    ${severity} ${issue.metric}: documented=${issue.documented}, actual=${issue.actual}${issue.diff ? ` (diff: ${issue.diff})` : ''}`
        );
      });
      return 1;
    }

    // Update mode
    const updater = new DocumentUpdater(this.rootDir, { dryRun: this.options.dryRun });
    const results = await updater.updateAll(filtered);

    // Check for errors (Issue #621, CodeRabbit P1)
    if (results.summary.error) {
      if (ciMode) {
        process.stdout.write(
          JSON.stringify({ error: results.summary.error, results, metrics: filtered }, null, 2)
        );
        return 1;
      }
      err('');
      err('❌ Update failed:');
      err(`   ${results.summary.error}`);
      return 1;
    }

    if (ciMode) {
      process.stdout.write(JSON.stringify({ results, metrics: filtered }, null, 2));
      return 0;
    }

    // Report results
    out('📝 Update Results:');
    if (results.summary.updated) {
      out(`  ✓ GDD-IMPLEMENTATION-SUMMARY.md: ${results.summary.changes.length} changes`);
      results.summary.changes.forEach((change) => {
        out(`    - ${change.metric}: updated to ${change.new}`);
      });
    } else {
      out(`  — GDD-IMPLEMENTATION-SUMMARY.md: no changes needed`);
    }

    out('');
    if (this.options.dryRun) {
      out('🔍 Dry run complete (no files modified)');
    } else {
      out('✅ Sync complete');
      if (results.backupDir) {
        out(`💾 Backup created: ${path.relative(this.rootDir, results.backupDir)}`);
      }
    }

    return 0;
  }
}

// Run CLI if executed directly
if (require.main === module) {
  const cli = new CLI();
  cli
    .run()
    .then((exitCode) => process.exit(exitCode))
    .catch((error) => {
      err(`❌ Fatal error: ${error.message}`);
      if (error.stack) {
        err(error.stack);
      }
      process.exit(1);
    });
}

module.exports = { MetricsCollector, DocumentUpdater, CLI };
