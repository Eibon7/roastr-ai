#!/usr/bin/env node

/**
 * GDD Telemetry Collection Engine
 *
 * Collects metrics from GDD validation, health scoring, drift prediction,
 * and auto-repair systems to build historical analytics data.
 *
 * @module collect-gdd-telemetry
 * @version 1.0.0
 * @phase GDD 2.0 Phase 13 - Telemetry & Analytics
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

class TelemetryCollector {
  constructor(options = {}) {
    this.rootDir = path.resolve(__dirname, '..');
    this.config = this.loadConfig();
    this.timestamp = new Date().toISOString();
    this.verbose = options.verbose || false;
    this.ciMode = options.ci || false;
  }

  /**
   * Load telemetry configuration
   */
  loadConfig() {
    try {
      const configPath = path.join(this.rootDir, 'telemetry-config.json');
      if (!fs.existsSync(configPath)) {
        this.log('warn', 'telemetry-config.json not found, using defaults');
        return this.getDefaultConfig();
      }
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      this.log('error', `Failed to load config: ${error.message}`);
      return this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      interval_hours: 24,
      min_health_for_report: 95,
      include_auto_fixes: true,
      generate_markdown_report: true,
      retention_days: 90,
      metrics_to_track: [
        'health_score',
        'drift_score',
        'auto_fix_success_rate',
        'issues_created',
        'avg_node_health',
        'momentum'
      ],
      alert_thresholds: {
        health_below: 90,
        drift_above: 40,
        auto_fix_success_below: 80
      },
      output: {
        json_snapshot: 'telemetry/snapshots/gdd-metrics-history.json',
        markdown_reports: 'telemetry/reports/',
        enable_graphs: true
      }
    };
  }

  /**
   * Collect all metrics from GDD system
   */
  async collectMetrics() {
    this.log('info', 'Collecting GDD telemetry metrics...');

    const snapshot = {
      timestamp: this.timestamp,
      date: new Date().toISOString().split('T')[0],
      metrics: {},
      alerts: [],
      metadata: {
        version: '1.0.0',
        phase: 13,
        collector: 'collect-gdd-telemetry.js'
      }
    };

    // Collect from each GDD subsystem
    snapshot.metrics.health = this.collectHealthMetrics();
    snapshot.metrics.drift = this.collectDriftMetrics();
    snapshot.metrics.validation = this.collectValidationMetrics();
    snapshot.metrics.repair = this.collectRepairMetrics();
    snapshot.metrics.coverage = this.collectCoverageMetrics();

    // Calculate derived metrics
    snapshot.metrics.derived = this.calculateDerivedMetrics(snapshot.metrics);

    // Check for alerts
    snapshot.alerts = this.checkAlerts(snapshot.metrics);

    // Calculate momentum (requires historical data)
    snapshot.metrics.momentum = await this.calculateMomentum(snapshot.metrics);

    return snapshot;
  }

  /**
   * Collect health metrics from gdd-health.json
   */
  collectHealthMetrics() {
    try {
      const healthPath = path.join(this.rootDir, 'gdd-health.json');
      if (!fs.existsSync(healthPath)) {
        this.log('warn', 'gdd-health.json not found');
        return null;
      }

      const healthData = JSON.parse(fs.readFileSync(healthPath, 'utf8'));

      // Fix C3: Map field names correctly from gdd-health.json schema
      // gdd-health.json uses: node_count, overall_status, average_score
      // NOT: total_nodes, status, overall_score
      const averageScore = healthData.average_score || 0;
      const nodeCount = healthData.node_count || healthData.total_nodes || 0;
      const overallStatus = healthData.overall_status || healthData.status || 'unknown';

      // Calculate overall_score from average_score (they represent the same metric)
      const overallScore = averageScore;

      // Determine status from overall_status
      let status = 'unknown';
      if (overallStatus && typeof overallStatus === 'string') {
        status = overallStatus.toLowerCase();
      }

      return {
        overall_score: overallScore,
        average_score: averageScore,
        healthy_count: healthData.healthy_count || 0,
        degraded_count: healthData.degraded_count || 0,
        critical_count: healthData.critical_count || 0,
        total_nodes: nodeCount,
        status: status
      };
    } catch (error) {
      this.log('error', `Failed to collect health metrics: ${error.message}`);
      return null;
    }
  }

  /**
   * Collect drift metrics from gdd-drift.json
   */
  collectDriftMetrics() {
    try {
      const driftPath = path.join(this.rootDir, 'gdd-drift.json');
      if (!fs.existsSync(driftPath)) {
        this.log('warn', 'gdd-drift.json not found');
        return null;
      }

      const driftData = JSON.parse(fs.readFileSync(driftPath, 'utf8'));

      return {
        average_drift_risk: driftData.average_drift_risk || 0,
        high_risk_count: driftData.high_risk_count || 0,
        at_risk_count: driftData.at_risk_count || 0,
        healthy_count: driftData.healthy_count || 0,
        overall_status: driftData.overall_status || 'unknown'
      };
    } catch (error) {
      this.log('error', `Failed to collect drift metrics: ${error.message}`);
      return null;
    }
  }

  /**
   * Collect validation metrics from gdd-status.json
   */
  collectValidationMetrics() {
    try {
      const statusPath = path.join(this.rootDir, 'gdd-status.json');
      if (!fs.existsSync(statusPath)) {
        this.log('warn', 'gdd-status.json not found');
        return null;
      }

      const statusData = JSON.parse(fs.readFileSync(statusPath, 'utf8'));

      return {
        nodes_validated: statusData.nodes_validated || 0,
        orphans: (statusData.orphans || []).length,
        missing_refs: (statusData.missing_refs || []).length,
        cycles: (statusData.cycles || []).length,
        status: statusData.status || 'unknown'
      };
    } catch (error) {
      this.log('error', `Failed to collect validation metrics: ${error.message}`);
      return null;
    }
  }

  /**
   * Collect auto-repair metrics
   */
  collectRepairMetrics() {
    try {
      const repairPath = path.join(this.rootDir, 'docs', 'auto-repair-report.md');
      if (!fs.existsSync(repairPath)) {
        this.log('warn', 'auto-repair-report.md not found');
        return null;
      }

      // Parse markdown report (simple extraction)
      const content = fs.readFileSync(repairPath, 'utf8');
      const fixes = (content.match(/✅/g) || []).length;
      const failures = (content.match(/❌/g) || []).length;
      const total = fixes + failures;

      return {
        total_fixes_attempted: total,
        successful_fixes: fixes,
        failed_fixes: failures,
        success_rate: total > 0 ? Math.round((fixes / total) * 100) : 100
      };
    } catch (error) {
      this.log('error', `Failed to collect repair metrics: ${error.message}`);
      return {
        total_fixes_attempted: 0,
        successful_fixes: 0,
        failed_fixes: 0,
        success_rate: 100
      };
    }
  }

  /**
   * Collect coverage metrics from nodes
   */
  collectCoverageMetrics() {
    try {
      const nodesDir = path.join(this.rootDir, 'docs', 'nodes');
      if (!fs.existsSync(nodesDir)) {
        return null;
      }

      const nodeFiles = fs.readdirSync(nodesDir).filter(f => f.endsWith('.md'));
      let totalCoverage = 0;
      let nodeCount = 0;

      for (const file of nodeFiles) {
        const content = fs.readFileSync(path.join(nodesDir, file), 'utf8');
        const coverageMatch = content.match(/\*\*Coverage:\*\*\s+(\d+)%/);
        if (coverageMatch) {
          totalCoverage += parseInt(coverageMatch[1], 10);
          nodeCount++;
        }
      }

      return {
        avg_coverage: nodeCount > 0 ? Math.round(totalCoverage / nodeCount) : 0,
        nodes_with_coverage: nodeCount,
        total_nodes: nodeFiles.length
      };
    } catch (error) {
      this.log('error', `Failed to collect coverage metrics: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate derived metrics
   */
  calculateDerivedMetrics(metrics) {
    const derived = {};

    // System stability index (0-100)
    const healthScore = metrics.health?.overall_score || 0;
    const driftScore = 100 - (metrics.drift?.average_drift_risk || 0);
    const repairScore = metrics.repair?.success_rate || 100;

    derived.stability_index = Math.round((healthScore + driftScore + repairScore) / 3);

    // Node health variance
    if (metrics.health) {
      const { healthy_count, degraded_count, critical_count, total_nodes } = metrics.health;
      const variance = total_nodes > 0
        ? Math.abs((healthy_count / total_nodes) - 0.85) * 100
        : 0;
      derived.health_variance = Math.round(variance);
    }

    // Auto-fix efficiency
    if (metrics.repair) {
      derived.auto_fix_efficiency = metrics.repair.success_rate;
    }

    // Overall system status
    if (healthScore >= 95 && driftScore >= 60 && repairScore >= 90) {
      derived.system_status = 'STABLE';
    } else if (healthScore >= 80 && driftScore >= 40) {
      derived.system_status = 'DEGRADED';
    } else {
      derived.system_status = 'CRITICAL';
    }

    return derived;
  }

  /**
   * Check for alert conditions
   */
  checkAlerts(metrics) {
    const alerts = [];
    const thresholds = this.config.alert_thresholds;

    // Health alerts
    if (metrics.health && metrics.health.overall_score < thresholds.health_below) {
      alerts.push({
        type: 'health',
        severity: 'critical',
        message: `Health score ${metrics.health.overall_score} below threshold ${thresholds.health_below}`,
        value: metrics.health.overall_score,
        threshold: thresholds.health_below
      });
    }

    // Drift alerts
    if (metrics.drift && metrics.drift.average_drift_risk > thresholds.drift_above) {
      alerts.push({
        type: 'drift',
        severity: 'warning',
        message: `Drift risk ${metrics.drift.average_drift_risk} above threshold ${thresholds.drift_above}`,
        value: metrics.drift.average_drift_risk,
        threshold: thresholds.drift_above
      });
    }

    // Auto-fix alerts
    if (metrics.repair && metrics.repair.success_rate < thresholds.auto_fix_success_below) {
      alerts.push({
        type: 'auto_fix',
        severity: 'warning',
        message: `Auto-fix success rate ${metrics.repair.success_rate}% below threshold ${thresholds.auto_fix_success_below}%`,
        value: metrics.repair.success_rate,
        threshold: thresholds.auto_fix_success_below
      });
    }

    return alerts;
  }

  /**
   * Calculate momentum (trend over time)
   */
  async calculateMomentum(currentMetrics) {
    try {
      const historyPath = path.join(this.rootDir, this.config.output.json_snapshot);
      if (!fs.existsSync(historyPath)) {
        return { trend: 'neutral', delta: 0, message: 'No historical data' };
      }

      const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      if (!history.snapshots || history.snapshots.length === 0) {
        return { trend: 'neutral', delta: 0, message: 'Insufficient historical data' };
      }

      // Get last snapshot
      const lastSnapshot = history.snapshots[history.snapshots.length - 1];
      const currentHealth = currentMetrics.health?.overall_score || 0;
      const lastHealth = lastSnapshot.metrics?.health?.overall_score || 0;

      const delta = currentHealth - lastHealth;
      const trend = delta > 0 ? 'improving' : delta < 0 ? 'declining' : 'stable';

      return {
        trend,
        delta: Math.round(delta * 10) / 10,
        current_health: currentHealth,
        previous_health: lastHealth,
        message: `Health ${trend} by ${Math.abs(delta).toFixed(1)} points`
      };
    } catch (error) {
      this.log('error', `Failed to calculate momentum: ${error.message}`);
      return { trend: 'unknown', delta: 0, message: 'Error calculating momentum' };
    }
  }

  /**
   * Save snapshot to history
   */
  async saveSnapshot(snapshot) {
    try {
      const historyPath = path.join(this.rootDir, this.config.output.json_snapshot);
      let history = { snapshots: [] };

      // Load existing history
      if (fs.existsSync(historyPath)) {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      }

      // Add new snapshot
      history.snapshots.push(snapshot);

      // Apply retention policy
      if (this.config.retention_days > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retention_days);
        history.snapshots = history.snapshots.filter(s =>
          new Date(s.timestamp) >= cutoffDate
        );
      }

      // Update metadata
      history.last_updated = this.timestamp;
      history.total_snapshots = history.snapshots.length;
      history.retention_days = this.config.retention_days;

      // Ensure directory exists
      const dir = path.dirname(historyPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write history
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
      this.log('success', `Snapshot saved to ${historyPath}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to save snapshot: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate markdown report
   */
  async generateReport(snapshot) {
    if (!this.config.generate_markdown_report) {
      return;
    }

    try {
      const reportDir = path.join(this.rootDir, this.config.output.markdown_reports);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      const reportDate = snapshot.date;
      const reportPath = path.join(reportDir, `gdd-telemetry-${reportDate}.md`);

      const report = this.buildMarkdownReport(snapshot);
      fs.writeFileSync(reportPath, report);

      this.log('success', `Report generated: ${reportPath}`);
    } catch (error) {
      this.log('error', `Failed to generate report: ${error.message}`);
    }
  }

  /**
   * Build markdown report content
   */
  buildMarkdownReport(snapshot) {
    const { metrics, alerts, timestamp } = snapshot;

    let md = `# GDD Telemetry Report\n\n`;
    md += `**Generated:** ${new Date(timestamp).toLocaleString()}\n`;
    md += `**Date:** ${snapshot.date}\n`;
    md += `**Phase:** GDD 2.0 Phase 13 - Telemetry & Analytics\n\n`;
    md += `---\n\n`;

    // System Status
    md += `## 📊 System Status\n\n`;
    const status = metrics.derived?.system_status || 'UNKNOWN';
    const statusEmoji = status === 'STABLE' ? '🟢' : status === 'DEGRADED' ? '🟡' : '🔴';
    md += `${statusEmoji} **${status}**\n\n`;

    // Key Metrics Table
    md += `## 🎯 Key Metrics\n\n`;
    md += `| Metric | Value | Target | Status |\n`;
    md += `|--------|-------|--------|--------|\n`;

    if (metrics.health) {
      const healthStatus = metrics.health.overall_score >= 95 ? '✅' : metrics.health.overall_score >= 80 ? '⚠️' : '❌';
      md += `| Health Score | ${metrics.health.overall_score}/100 | ≥95 | ${healthStatus} |\n`;
    }

    if (metrics.drift) {
      const driftStatus = metrics.drift.average_drift_risk < 25 ? '✅' : metrics.drift.average_drift_risk < 40 ? '⚠️' : '❌';
      md += `| Drift Risk | ${metrics.drift.average_drift_risk}/100 | <25 | ${driftStatus} |\n`;
    }

    if (metrics.repair) {
      const repairStatus = metrics.repair.success_rate >= 90 ? '✅' : metrics.repair.success_rate >= 70 ? '⚠️' : '❌';
      md += `| Auto-Fix Success | ${metrics.repair.success_rate}% | ≥90% | ${repairStatus} |\n`;
    }

    if (metrics.derived) {
      const stabilityStatus = metrics.derived.stability_index >= 90 ? '✅' : metrics.derived.stability_index >= 70 ? '⚠️' : '❌';
      md += `| Stability Index | ${metrics.derived.stability_index}/100 | ≥90 | ${stabilityStatus} |\n`;
    }

    md += `\n`;

    // Momentum
    if (metrics.momentum) {
      md += `## 📈 Momentum\n\n`;
      const trendEmoji = metrics.momentum.trend === 'improving' ? '⬆️' : metrics.momentum.trend === 'declining' ? '⬇️' : '➡️';
      md += `${trendEmoji} **${metrics.momentum.message}**\n\n`;
    }

    // Alerts
    if (alerts && alerts.length > 0) {
      md += `## ⚠️ Alerts (${alerts.length})\n\n`;
      for (const alert of alerts) {
        const emoji = alert.severity === 'critical' ? '🔴' : '🟡';
        md += `- ${emoji} **${alert.type.toUpperCase()}:** ${alert.message}\n`;
      }
      md += `\n`;
    } else {
      md += `## ✅ No Alerts\n\nAll metrics within acceptable thresholds.\n\n`;
    }

    // Detailed Metrics
    md += `## 📋 Detailed Metrics\n\n`;

    if (metrics.health) {
      md += `### Health\n\n`;
      md += `- Overall Score: ${metrics.health.overall_score}/100\n`;
      md += `- Average Node Score: ${metrics.health.average_score}/100\n`;
      md += `- Healthy Nodes: ${metrics.health.healthy_count}\n`;
      md += `- Degraded Nodes: ${metrics.health.degraded_count}\n`;
      md += `- Critical Nodes: ${metrics.health.critical_count}\n\n`;
    }

    if (metrics.drift) {
      md += `### Drift\n\n`;
      md += `- Average Drift Risk: ${metrics.drift.average_drift_risk}/100\n`;
      md += `- High Risk Nodes: ${metrics.drift.high_risk_count}\n`;
      md += `- At Risk Nodes: ${metrics.drift.at_risk_count}\n`;
      md += `- Healthy Nodes: ${metrics.drift.healthy_count}\n\n`;
    }

    if (metrics.validation) {
      md += `### Validation\n\n`;
      md += `- Nodes Validated: ${metrics.validation.nodes_validated}\n`;
      md += `- Orphan Nodes: ${metrics.validation.orphans}\n`;
      md += `- Missing References: ${metrics.validation.missing_refs}\n`;
      md += `- Circular Dependencies: ${metrics.validation.cycles}\n\n`;
    }

    if (metrics.repair) {
      md += `### Auto-Repair\n\n`;
      md += `- Total Fixes Attempted: ${metrics.repair.total_fixes_attempted}\n`;
      md += `- Successful Fixes: ${metrics.repair.successful_fixes}\n`;
      md += `- Failed Fixes: ${metrics.repair.failed_fixes}\n`;
      md += `- Success Rate: ${metrics.repair.success_rate}%\n\n`;
    }

    if (metrics.coverage) {
      md += `### Coverage\n\n`;
      md += `- Average Coverage: ${metrics.coverage.avg_coverage}%\n`;
      md += `- Nodes with Coverage: ${metrics.coverage.nodes_with_coverage}/${metrics.coverage.total_nodes}\n\n`;
    }

    md += `---\n\n`;
    md += `*Generated by GDD Telemetry Engine (Phase 13)*\n`;

    return md;
  }

  /**
   * Logging utility
   */
  log(level, message) {
    if (this.ciMode && level === 'info') return;

    const icons = {
      info: '📊',
      success: '✅',
      warn: '⚠️',
      error: '❌'
    };

    const colorMap = {
      info: colors.cyan,
      success: colors.green,
      warn: colors.yellow,
      error: colors.red
    };

    const icon = icons[level] || '•';
    const color = colorMap[level] || colors.white;

    console.log(`${color}${icon} ${message}${colors.reset}`);
  }

  /**
   * Main execution
   */
  async run() {
    const startTime = Date.now();

    try {
      // Print header
      if (!this.ciMode) {
        console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}   GDD TELEMETRY COLLECTION${colors.reset}`);
        console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}\n`);
      }

      // Collect metrics
      const snapshot = await this.collectMetrics();

      // Save snapshot
      await this.saveSnapshot(snapshot);

      // Generate report
      await this.generateReport(snapshot);

      // Print summary
      if (!this.ciMode) {
        console.log(`\n${colors.bright}📊 SUMMARY${colors.reset}\n`);
        console.log(`Timestamp: ${snapshot.timestamp}`);
        console.log(`Status: ${snapshot.metrics.derived?.system_status || 'UNKNOWN'}`);
        console.log(`Health: ${snapshot.metrics.health?.overall_score || 'N/A'}/100`);
        console.log(`Drift Risk: ${snapshot.metrics.drift?.average_drift_risk || 'N/A'}/100`);
        console.log(`Alerts: ${snapshot.alerts.length}`);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n${colors.dim}Completed in ${elapsed}s${colors.reset}\n`);
      }

      // Exit with appropriate code
      if (snapshot.alerts.some(a => a.severity === 'critical')) {
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      this.log('error', `Telemetry collection failed: ${error.message}`);
      if (this.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    ci: args.includes('--ci')
  };

  const collector = new TelemetryCollector(options);
  collector.run();
}

module.exports = TelemetryCollector;
