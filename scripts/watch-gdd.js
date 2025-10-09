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

// Phase 14 + 14.1: Agent-Aware Integration
const AgentInterface = require('./agents/agent-interface');
const { getInstance: getTelemetryBus } = require('./agents/telemetry-bus');

class GDDWatcher {
  constructor(options = {}) {
    this.rootDir = path.resolve(__dirname, '..');
    this.watchers = [];
    this.debounceTimer = null;
    this.debounceDelay = 2000; // 2 seconds
    this.isValidating = false;
    this.lastStatus = null;

    // Phase 14 + 14.1: Agent integration
    this.agentsActive = options.agentsActive || false;
    this.telemetryEnabled = options.telemetry || false;

    // Initialize telemetry bus if enabled
    if (this.telemetryEnabled) {
      this.telemetryBus = getTelemetryBus({ verbose: false });
      this.log('📡 Telemetry Bus enabled', 'info');
    }

    // Initialize agent interface if agents active
    if (this.agentsActive) {
      this.agentInterface = new AgentInterface();
      if (this.telemetryBus) {
        this.agentInterface.setTelemetryBus(this.telemetryBus);
      }
      this.log('🤖 Agents active', 'info');
    }
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

    if (this.agentsActive || this.telemetryEnabled) {
      console.log('╠════════════════════════════════════════╣');
      console.log('║  Phase 14 + 14.1 Features:            ║');
      if (this.agentsActive) {
        console.log('║    🤖 Agents Active                   ║');
      }
      if (this.telemetryEnabled) {
        console.log('║    📡 Telemetry Bus                   ║');
      }
    }

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

      // Phase 14 + 14.1: Execute agent actions based on conditions
      if (this.agentsActive) {
        await this.executeAgentActions(results, stats, driftData);
      }

      this.lastStatus = results.status;
    } catch (error) {
      this.log(`❌ Validation error: ${error.message}`, 'error');
    } finally {
      this.isValidating = false;
    }
  }

  /**
   * Execute agent actions based on validation results
   * Phase 14 + 14.1: Agent-Aware Integration
   */
  async executeAgentActions(results, healthStats, driftData) {
    try {
      // 1. DriftWatcher: Trigger auto-repair if drift > 60
      if (driftData && driftData.average_drift_risk > 60) {
        this.log('🔧 DriftWatcher: High drift detected, triggering auto-repair...', 'warning');

        try {
          await this.agentInterface.triggerRepair('DriftWatcher');
          this.log('✅ DriftWatcher: Auto-repair triggered', 'success');
        } catch (error) {
          this.log(`❌ DriftWatcher: Auto-repair failed: ${error.message}`, 'error');
        }
      }

      // 2. DocumentationAgent: Create issue for orphan nodes
      if (results.orphans && results.orphans.length > 0) {
        this.log(`📝 DocumentationAgent: ${results.orphans.length} orphan node(s) detected`, 'warning');

        for (const orphan of results.orphans.slice(0, 3)) { // Limit to 3 per run
          try {
            await this.agentInterface.createIssue(
              'DocumentationAgent',
              `Orphan GDD node detected: ${orphan}`,
              `The node \`${orphan}\` is not referenced by any other node in the system.\n\n` +
              `This could indicate:\n` +
              `- Missing dependency declarations\n` +
              `- Node should be removed\n` +
              `- Documentation out of sync\n\n` +
              `**Action required:** Review and update node dependencies or remove if obsolete.`
            );
          } catch (error) {
            this.log(`❌ DocumentationAgent: Failed to create issue: ${error.message}`, 'error');
          }
        }
      }

      // 3. Orchestrator: Mark nodes stale if outdated > 7
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      if (results.outdated && results.outdated.length > 7) {
        this.log(`⏰ Orchestrator: ${results.outdated.length} outdated nodes detected`, 'warning');

        for (const outdatedNode of results.outdated.slice(0, 5)) { // Limit to 5 per run
          try {
            await this.agentInterface.writeNodeField(
              outdatedNode,
              'status',
              'stale',
              'Orchestrator'
            );
            this.log(`✅ Orchestrator: Marked ${outdatedNode} as stale`, 'success');
          } catch (error) {
            this.log(`❌ Orchestrator: Failed to mark ${outdatedNode}: ${error.message}`, 'error');
          }
        }
      }

      // 4. RuntimeValidator: Update health scores
      if (healthStats && this.agentInterface) {
        this.log('📊 RuntimeValidator: Health scores updated', 'info');
        // Health scores are already updated by the scorer, just log
      }

      // Emit telemetry event for validation completion
      if (this.telemetryBus) {
        this.telemetryBus.emit('validation_complete', {
          agent: 'GDDWatcher',
          results: {
            status: results.status,
            nodes_validated: results.nodes_validated,
            orphans: results.orphans.length,
            outdated: results.outdated.length,
            health_score: healthStats?.average_score || 0,
            drift_risk: driftData?.average_drift_risk || 0
          },
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      this.log(`❌ Agent actions error: ${error.message}`, 'error');
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

    // Phase 14.1: Show telemetry stats
    if (this.telemetryEnabled && this.telemetryBus) {
      console.log('────────────────────────────────────────');
      console.log('📡 TELEMETRY STATUS');

      const telemetryStats = this.telemetryBus.getStatistics();
      console.log(`Buffer: ${telemetryStats.currentBufferSize}/${telemetryStats.maxBufferSize} events`);
      console.log(`Subscribers: ${telemetryStats.activeSubscribers}`);
      console.log(`Total Events: ${telemetryStats.totalEvents || 0}`);

      if (telemetryStats.avgHealthDelta && telemetryStats.avgHealthDelta !== 0) {
        const deltaSymbol = telemetryStats.avgHealthDelta > 0 ? '⬆️' : '⬇️';
        console.log(`Avg ΔHealth: ${deltaSymbol} ${telemetryStats.avgHealthDelta.toFixed(2)}`);
      }

      console.log('────────────────────────────────────────');
    }

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
  const args = process.argv.slice(2);

  // Phase 14 + 14.1: Parse flags
  const options = {
    agentsActive: args.includes('--agents-active'),
    telemetry: args.includes('--telemetry')
  };

  const watcher = new GDDWatcher(options);
  await watcher.start();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { GDDWatcher };