#!/usr/bin/env node

/**
 * GDD Watcher
 *
 * Monitors changes in src/, docs/nodes/, system-map.yaml, spec.md
 * Automatically runs validation when changes are detected
 * Updates docs/system-validation.md and gdd-status.json in real-time
 *
 * Usage:
 *   node scripts/watch-gdd.js
 */

const fs = require('fs');
const path = require('path');
const { GDDValidator } = require('./validate-gdd-runtime');
const { GDDDriftPredictor } = require('./predict-gdd-drift');

class GDDWatcher {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.watchers = [];
    this.debounceTimer = null;
    this.debounceDelay = 2000; // 2 seconds
    this.isValidating = false;
    this.lastStatus = null;
  }

  /**
   * Start watching
   */
  async start() {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║     🔍 GDD Watcher Started            ║');
    console.log('╠════════════════════════════════════════╣');
    console.log('║  Monitoring:                          ║');
    console.log('║    • src/**                           ║');
    console.log('║    • docs/nodes/**                    ║');
    console.log('║    • docs/system-map.yaml             ║');
    console.log('║    • spec.md                          ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');

    // Run initial validation
    await this.validate();

    // Watch directories
    this.watchDirectory(path.join(this.rootDir, 'src'));
    this.watchDirectory(path.join(this.rootDir, 'docs', 'nodes'));
    this.watchFile(path.join(this.rootDir, 'docs', 'system-map.yaml'));
    this.watchFile(path.join(this.rootDir, 'spec.md'));

    // Keep process alive
    process.on('SIGINT', () => {
      this.stop();
    });
  }

  /**
   * Watch a directory recursively
   */
  watchDirectory(dir) {
    try {
      const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (filename) {
          this.onFileChange(path.join(dir, filename));
        }
      });

      this.watchers.push(watcher);
    } catch (error) {
      // Directory doesn't exist, skip
    }
  }

  /**
   * Watch a single file
   */
  watchFile(file) {
    try {
      const watcher = fs.watch(file, (eventType) => {
        this.onFileChange(file);
      });

      this.watchers.push(watcher);
    } catch (error) {
      // File doesn't exist, skip
    }
  }

  /**
   * Handle file change
   */
  onFileChange(file) {
    // Ignore generated files
    if (file.includes('system-validation.md') ||
        file.includes('gdd-status.json') ||
        file.includes('node_modules')) {
      return;
    }

    const relativePath = path.relative(this.rootDir, file);
    this.log(`📝 Changed: ${relativePath}`, 'info');

    // Debounce validation
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.validate();
    }, this.debounceDelay);
  }

  /**
   * Run validation
   */
  async validate() {
    if (this.isValidating) {
      this.log('⏳ Validation already in progress...', 'warning');
      return;
    }

    this.isValidating = true;

    try {
      console.log('');
      this.log('🔄 Running validation...', 'info');

      const validator = new GDDValidator({
        mode: 'full',
        ci: false,
        skipReports: false
      });

      const results = await validator.validate();

      // Run health scoring
      const { GDDHealthScorer } = require('./score-gdd-health');
      const scorer = new GDDHealthScorer({ json: true });
      const { stats } = await scorer.score();

      // Run drift prediction
      const driftPredictor = new GDDDriftPredictor({ mode: 'full', ci: true });
      const driftData = await driftPredictor.predict();

      // Print status bar with health and drift info
      this.printStatusBar(results, stats, driftData);

      this.lastStatus = results.status;
    } catch (error) {
      this.log(`❌ Validation error: ${error.message}`, 'error');
    } finally {
      this.isValidating = false;
    }
  }

  /**
   * Print visual status bar
   */
  printStatusBar(results, healthStats, driftData) {
    const statusColors = {
      healthy: '\x1b[42m',   // Green background
      warning: '\x1b[43m',   // Yellow background
      critical: '\x1b[41m'   // Red background
    };

    const statusEmojis = {
      healthy: '🟢',
      warning: '🟡',
      critical: '🔴'
    };

    const color = statusColors[results.status] || statusColors.warning;
    const emoji = statusEmojis[results.status] || '🟡';
    const reset = '\x1b[0m';

    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log(`║ ${color}  GDD STATUS: ${results.status.toUpperCase().padEnd(22)} ${reset}║`);
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ ${emoji} Nodes:        ${String(results.nodes_validated).padStart(3)}                    ║`);
    console.log(`║ ${results.orphans.length > 0 ? '❌' : '✅'} Orphans:      ${String(results.orphans.length).padStart(3)}                    ║`);
    console.log(`║ ${results.outdated.length > 3 ? '⚠️ ' : '✅'} Outdated:     ${String(results.outdated.length).padStart(3)}                    ║`);
    console.log(`║ ${results.cycles.length > 0 ? '❌' : '✅'} Cycles:       ${String(results.cycles.length).padStart(3)}                    ║`);
    console.log(`║ ${results.missing_refs.length > 0 ? '⚠️ ' : '✅'} Missing Refs: ${String(results.missing_refs.length).padStart(3)}                    ║`);
    console.log(`║ ${Object.keys(results.drift).length > 0 ? '⚠️ ' : '✅'} Drift Issues: ${String(Object.keys(results.drift).length).padStart(3)}                    ║`);
    console.log('╚════════════════════════════════════════╝');
    console.log('');

    // Add health summary
    if (healthStats) {
      console.log('────────────────────────────────────────');
      console.log('📊 NODE HEALTH STATUS');
      console.log(`🟢 ${healthStats.healthy_count} Healthy | 🟡 ${healthStats.degraded_count} Degraded | 🔴 ${healthStats.critical_count} Critical`);
      console.log(`Average Score: ${healthStats.average_score}/100`);
      console.log('────────────────────────────────────────');
      console.log('');
    }

    // Add drift risk summary
    if (driftData) {
      console.log('────────────────────────────────────────');
      console.log('🔮 DRIFT RISK STATUS');
      console.log(`🟢 ${driftData.healthy_count} Healthy | 🟡 ${driftData.at_risk_count} At Risk | 🔴 ${driftData.high_risk_count} Likely Drift`);
      console.log(`Average Drift Risk: ${driftData.average_drift_risk}/100`);

      // Show top 3 highest risk nodes
      if (driftData.nodes && Object.keys(driftData.nodes).length > 0) {
        const topRiskNodes = Object.entries(driftData.nodes)
          .sort((a, b) => b[1].drift_risk - a[1].drift_risk)
          .slice(0, 3);

        if (topRiskNodes.length > 0) {
          console.log('\nTop Risk Nodes:');
          for (const [nodeName, data] of topRiskNodes) {
            const emoji = data.status === 'likely_drift' ? '🔴' : data.status === 'at_risk' ? '🟡' : '🟢';
            console.log(`  ${emoji} ${nodeName}: ${data.drift_risk}/100`);
          }
        }
      }
      console.log('────────────────────────────────────────');
      console.log('');
    }

    console.log(`Last check: ${new Date().toLocaleTimeString()}`);
    console.log('');
  }

  /**
   * Stop watching
   */
  stop() {
    console.log('');
    this.log('🛑 Stopping GDD Watcher...', 'info');

    for (const watcher of this.watchers) {
      watcher.close();
    }

    console.log('');
    this.log('✅ Watcher stopped', 'success');
    console.log('');
    process.exit(0);
  }

  /**
   * Log message with formatting
   */
  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m'
    };

    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors[type] || colors.info}[${timestamp}] ${message}${colors.reset}`);
  }
}

/**
 * CLI entry point that instantiates a GDDWatcher and starts watching for changes.
 */
async function main() {
  const watcher = new GDDWatcher();
  await watcher.start();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { GDDWatcher };