#!/usr/bin/env node

/**
 * GDD Predictive Drift Detection
 *
 * Analyzes historical patterns to predict documentation drift risk before it happens.
 *
 * Factors analyzed:
 * - Git commit activity (last 30 days)
 * - Last updated timestamps in nodes
 * - Current validation issues (gdd-status.json)
 * - Health scores (gdd-health.json)
 *
 * Drift Risk Score Calculation:
 * +20 pts if last_updated > 30 days
 * +10 pts per active warning
 * +15 pts if coverage < 80%
 * +25 pts if health < 70
 * -10 pts if last commit < 7 days
 *
 * Classification:
 * 🟢 0-30   Healthy
 * 🟡 31-60  At Risk
 * 🔴 61-100 Likely Drift
 *
 * Usage:
 *   node scripts/predict-gdd-drift.js --full
 *   node scripts/predict-gdd-drift.js --node=shield
 *   node scripts/predict-gdd-drift.js --ci
 *   node scripts/predict-gdd-drift.js --create-issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class GDDDriftPredictor {
  constructor(options = {}) {
    this.rootDir = path.resolve(__dirname, '..');
    this.options = {
      mode: options.mode || 'full',
      ci: options.ci || false,
      createIssues: options.createIssues || false,
      nodeFilter: options.nodeFilter || null
    };

    this.thresholds = {
      healthy: 30,
      atRisk: 60
    };

    this.driftData = {
      generated_at: new Date().toISOString(),
      analysis_period_days: 30,
      nodes: {},
      overall_status: 'HEALTHY',
      average_drift_risk: 0,
      high_risk_count: 0,
      at_risk_count: 0,
      healthy_count: 0
    };
  }

  /**
   * Main entry point
   */
  async predict() {
    const startTime = Date.now();

    if (!this.options.ci) {
      console.log('');
      console.log('╔════════════════════════════════════════╗');
      console.log('║  🔮 GDD Drift Risk Predictor         ║');
      console.log('╚════════════════════════════════════════╝');
      console.log('');
    }

    try {
      // Load necessary data
      const gitActivity = await this.analyzeGitActivity();
      const validationStatus = await this.loadValidationStatus();
      const healthScores = await this.loadHealthScores();
      const nodes = await this.loadAllNodes();

      // Calculate drift risk for each node
      for (const nodeName of Object.keys(nodes)) {
        if (this.options.nodeFilter && nodeName !== this.options.nodeFilter) {
          continue;
        }

        const nodeData = nodes[nodeName];
        const driftRisk = this.calculateDriftRisk(
          nodeName,
          nodeData,
          gitActivity,
          validationStatus,
          healthScores
        );

        this.driftData.nodes[nodeName] = driftRisk;
      }

      // Calculate overall statistics
      this.calculateOverallStats();

      // Generate reports
      await this.generateReports();

      // Create GitHub issues if requested
      if (this.options.createIssues) {
        await this.createHighRiskIssues();
      }

      const duration = Date.now() - startTime;

      if (!this.options.ci) {
        this.printSummary(duration);
      }

      // Exit code for CI
      if (this.options.ci) {
        return this.driftData.high_risk_count > 0 ? 1 : 0;
      }

      return this.driftData;
    } catch (error) {
      console.error('❌ Error during drift prediction:', error.message);
      if (!this.options.ci) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * Analyze git commit activity for the last 30 days
   */
  async analyzeGitActivity() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const since = thirtyDaysAgo.toISOString().split('T')[0];

      // Get all commits in the last 30 days with file paths
      const gitLog = execSync(
        `git log --since="${since}" --name-only --pretty=format:"COMMIT:%H|%at"`,
        { cwd: this.rootDir, encoding: 'utf8' }
      );

      const activity = {
        byNode: {},
        lastCommitByNode: {},
        totalCommits: 0
      };

      const lines = gitLog.split('\n').filter(l => l.trim());
      let currentCommit = null;
      let currentTimestamp = null;

      for (const line of lines) {
        if (line.startsWith('COMMIT:')) {
          const [hash, timestamp] = line.replace('COMMIT:', '').split('|');
          currentCommit = hash;
          currentTimestamp = parseInt(timestamp);
          activity.totalCommits++;
        } else if (currentCommit && line.trim()) {
          // Check if file is related to a node
          const nodeMatch = line.match(/docs\/nodes\/([^/]+)\.md/);
          if (nodeMatch) {
            const nodeName = nodeMatch[1];
            if (!activity.byNode[nodeName]) {
              activity.byNode[nodeName] = [];
            }
            activity.byNode[nodeName].push({
              commit: currentCommit,
              timestamp: currentTimestamp,
              file: line
            });

            // Track most recent commit
            if (!activity.lastCommitByNode[nodeName] ||
                currentTimestamp > activity.lastCommitByNode[nodeName]) {
              activity.lastCommitByNode[nodeName] = currentTimestamp;
            }
          }
        }
      }

      return activity;
    } catch (error) {
      // If git fails, return empty activity
      return { byNode: {}, lastCommitByNode: {}, totalCommits: 0 };
    }
  }

  /**
   * Load validation status from gdd-status.json
   */
  async loadValidationStatus() {
    const statusPath = path.join(this.rootDir, 'gdd-status.json');
    if (!fs.existsSync(statusPath)) {
      return { orphans: [], missing_refs: [], outdated: [], drift: {} };
    }

    const content = fs.readFileSync(statusPath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Load health scores from gdd-health.json
   */
  async loadHealthScores() {
    const healthPath = path.join(this.rootDir, 'gdd-health.json');
    if (!fs.existsSync(healthPath)) {
      return { nodes: {} };
    }

    const content = fs.readFileSync(healthPath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Load all node files
   */
  async loadAllNodes() {
    const nodesDir = path.join(this.rootDir, 'docs', 'nodes');
    const nodes = {};

    if (!fs.existsSync(nodesDir)) {
      return nodes;
    }

    const files = fs.readdirSync(nodesDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const nodeName = file.replace('.md', '');
      const filePath = path.join(nodesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Parse metadata from markdown headers
      const metadata = {};

      // Extract Last Updated
      const lastUpdatedMatch = content.match(/\*\*Last Updated:\*\*\s*(\d{4}-\d{2}-\d{2})/);
      if (lastUpdatedMatch) {
        metadata.last_updated = lastUpdatedMatch[1];
      }

      // Extract Coverage
      const coverageMatch = content.match(/\*\*Coverage:\*\*\s*(\d+)%/);
      if (coverageMatch) {
        metadata.coverage = coverageMatch[1];
      }

      // Extract Status
      const statusMatch = content.match(/\*\*Status:\*\*\s*(\w+)/);
      if (statusMatch) {
        metadata.status = statusMatch[1];
      }

      nodes[nodeName] = { metadata, content };
    }

    return nodes;
  }

  /**
   * Calculate drift risk score for a node
   */
  calculateDriftRisk(nodeName, nodeData, gitActivity, validationStatus, healthScores) {
    let risk = 0;
    const factors = [];
    const recommendations = [];

    // Factor 1: Last updated timestamp
    if (nodeData.metadata.last_updated) {
      const lastUpdated = new Date(nodeData.metadata.last_updated);
      const daysSince = Math.floor((Date.now() - lastUpdated) / (1000 * 60 * 60 * 24));

      if (daysSince > 30) {
        const points = 20;
        risk += points;
        factors.push(`+${points} pts: Last updated ${daysSince} days ago (>30)`);
        recommendations.push(`Update node documentation (${daysSince} days old)`);
      }
    } else {
      const points = 20;
      risk += points;
      factors.push(`+${points} pts: No last_updated timestamp`);
      recommendations.push('Add last_updated timestamp to metadata');
    }

    // Factor 2: Active warnings
    const warnings = this.getNodeWarnings(nodeName, validationStatus);
    if (warnings > 0) {
      const points = warnings * 10;
      risk += points;
      factors.push(`+${points} pts: ${warnings} active warning(s)`);
      recommendations.push(`Resolve ${warnings} validation warning(s)`);
    }

    // Factor 3: Coverage
    const coverage = nodeData.metadata.coverage;
    if (coverage !== undefined) {
      const coverageNum = parseInt(coverage);
      if (coverageNum < 80) {
        const points = 15;
        risk += points;
        factors.push(`+${points} pts: Coverage ${coverageNum}% (<80%)`);
        recommendations.push(`Increase test coverage to 80%+ (currently ${coverageNum}%)`);
      }
    }

    // Factor 4: Health score
    const healthData = healthScores.nodes?.[nodeName];
    if (healthData) {
      if (healthData.score < 70) {
        const points = 25;
        risk += points;
        factors.push(`+${points} pts: Health score ${healthData.score} (<70)`);
        recommendations.push(`Improve health score to 70+ (currently ${healthData.score})`);
      }
    }

    // Factor 5: Recent git activity (negative - reduces risk)
    if (gitActivity.lastCommitByNode[nodeName]) {
      const lastCommitTimestamp = gitActivity.lastCommitByNode[nodeName];
      const daysSinceCommit = Math.floor((Date.now() / 1000 - lastCommitTimestamp) / (60 * 60 * 24));

      if (daysSinceCommit < 7) {
        const points = -10;
        risk += points;
        factors.push(`${points} pts: Recent commit (${daysSinceCommit} days ago)`);
      }
    }

    // Cap risk at 0-100
    risk = Math.max(0, Math.min(100, risk));

    return {
      drift_risk: risk,
      status: this.getDriftStatus(risk),
      factors,
      recommendations,
      git_activity: {
        commits_last_30d: gitActivity.byNode[nodeName]?.length || 0,
        last_commit_days_ago: gitActivity.lastCommitByNode[nodeName]
          ? Math.floor((Date.now() / 1000 - gitActivity.lastCommitByNode[nodeName]) / (60 * 60 * 24))
          : null
      },
      health_score: healthData?.score || null,
      coverage: coverage || null
    };
  }

  /**
   * Get number of warnings for a node
   */
  getNodeWarnings(nodeName, validationStatus) {
    let warnings = 0;

    if (validationStatus.orphans?.includes(nodeName)) warnings++;
    if (validationStatus.missing_refs?.some(r => r.node === nodeName)) warnings++;
    if (validationStatus.outdated?.includes(nodeName)) warnings++;
    if (validationStatus.drift?.[nodeName]) warnings++;

    return warnings;
  }

  /**
   * Get drift status from score
   */
  getDriftStatus(score) {
    if (score <= this.thresholds.healthy) return 'healthy';
    if (score <= this.thresholds.atRisk) return 'at_risk';
    return 'likely_drift';
  }

  /**
   * Get emoji for drift status
   */
  getDriftEmoji(status) {
    const emojis = {
      healthy: '🟢',
      at_risk: '🟡',
      likely_drift: '🔴'
    };
    return emojis[status] || '⚪';
  }

  /**
   * Calculate overall statistics
   */
  calculateOverallStats() {
    const nodes = Object.values(this.driftData.nodes);

    this.driftData.high_risk_count = nodes.filter(n => n.status === 'likely_drift').length;
    this.driftData.at_risk_count = nodes.filter(n => n.status === 'at_risk').length;
    this.driftData.healthy_count = nodes.filter(n => n.status === 'healthy').length;

    this.driftData.average_drift_risk = nodes.length > 0
      ? Math.round(nodes.reduce((sum, n) => sum + n.drift_risk, 0) / nodes.length)
      : 0;

    if (this.driftData.high_risk_count > 0) {
      this.driftData.overall_status = 'CRITICAL';
    } else if (this.driftData.at_risk_count > 0) {
      this.driftData.overall_status = 'WARNING';
    } else {
      this.driftData.overall_status = 'HEALTHY';
    }
  }

  /**
   * Generate markdown and JSON reports
   */
  async generateReports() {
    // Generate JSON report
    const jsonPath = path.join(this.rootDir, 'gdd-drift.json');
    fs.writeFileSync(jsonPath, JSON.stringify(this.driftData, null, 2));

    // Generate markdown report
    const mdPath = path.join(this.rootDir, 'docs', 'drift-report.md');
    const markdown = this.generateMarkdownReport();
    fs.writeFileSync(mdPath, markdown);
  }

  /**
   * Generate markdown report content
   */
  generateMarkdownReport() {
    const nodes = Object.entries(this.driftData.nodes)
      .sort((a, b) => b[1].drift_risk - a[1].drift_risk);

    let md = '# 🔮 GDD Drift Risk Report\n\n';
    md += `**Generated:** ${this.driftData.generated_at}\n`;
    md += `**Analysis Period:** Last ${this.driftData.analysis_period_days} days\n`;
    md += `**Overall Status:** ${this.getDriftEmoji(this.driftData.overall_status.toLowerCase())} ${this.driftData.overall_status}\n`;
    md += `**Average Drift Risk:** ${this.driftData.average_drift_risk}/100\n\n`;
    md += '---\n\n';

    md += '## Summary\n\n';
    md += `- **Total Nodes:** ${nodes.length}\n`;
    md += `- 🟢 **Healthy (0-30):** ${this.driftData.healthy_count}\n`;
    md += `- 🟡 **At Risk (31-60):** ${this.driftData.at_risk_count}\n`;
    md += `- 🔴 **Likely Drift (61-100):** ${this.driftData.high_risk_count}\n\n`;
    md += '---\n\n';

    md += '## Drift Risk Scores\n\n';
    md += '| Node | Risk Score | Status | Health | Coverage | Last Commit | Warnings |\n';
    md += '|------|------------|--------|--------|----------|-------------|----------|\n';

    for (const [nodeName, data] of nodes) {
      const emoji = this.getDriftEmoji(data.status);
      const lastCommit = data.git_activity.last_commit_days_ago !== null
        ? `${data.git_activity.last_commit_days_ago}d ago`
        : 'N/A';
      const health = data.health_score !== null ? data.health_score : 'N/A';
      const coverage = data.coverage !== null ? `${data.coverage}%` : 'N/A';
      const warnings = data.factors.filter(f => f.includes('warning')).length;

      md += `| ${nodeName} | ${emoji} ${data.drift_risk} | ${data.status} | ${health} | ${coverage} | ${lastCommit} | ${warnings} |\n`;
    }

    md += '\n---\n\n';

    // Top 5 highest risk nodes
    md += '## ⚠️ Top 5 Nodes at Risk\n\n';
    const top5 = nodes.slice(0, 5);

    for (const [nodeName, data] of top5) {
      const emoji = this.getDriftEmoji(data.status);
      md += `### ${nodeName} (Risk: ${data.drift_risk})\n\n`;
      md += `**Status:** ${emoji} ${data.status.toUpperCase()}\n\n`;

      md += '**Risk Factors:**\n';
      for (const factor of data.factors) {
        md += `- ${factor}\n`;
      }
      md += '\n';

      if (data.recommendations.length > 0) {
        md += '**Recommendations:**\n';
        for (const rec of data.recommendations) {
          md += `- ${rec}\n`;
        }
        md += '\n';
      }

      md += `**Git Activity:** ${data.git_activity.commits_last_30d} commits in last 30 days\n\n`;
    }

    md += '---\n\n';
    md += '**Generated by:** GDD Predictive Drift Detection System\n';

    return md;
  }

  /**
   * Create GitHub issues for high-risk nodes (>70)
   */
  async createHighRiskIssues() {
    const highRiskNodes = Object.entries(this.driftData.nodes)
      .filter(([_, data]) => data.drift_risk > 70);

    if (highRiskNodes.length === 0) {
      console.log('✅ No high-risk nodes detected (risk > 70)');
      return;
    }

    console.log(`\n🚨 Creating ${highRiskNodes.length} issue(s) for high-risk nodes...\n`);

    for (const [nodeName, data] of highRiskNodes) {
      const title = `[Drift Alert] Node ${nodeName} shows high risk (Score = ${data.drift_risk})`;

      let body = `## 🔴 High Drift Risk Detected\n\n`;
      body += `**Node:** ${nodeName}\n`;
      body += `**Risk Score:** ${data.drift_risk}/100\n`;
      body += `**Status:** ${data.status.toUpperCase()}\n\n`;

      body += `### Risk Factors\n\n`;
      for (const factor of data.factors) {
        body += `- ${factor}\n`;
      }
      body += '\n';

      body += `### Recommendations\n\n`;
      for (const rec of data.recommendations) {
        body += `- [ ] ${rec}\n`;
      }
      body += '\n';

      body += `### Additional Info\n\n`;
      body += `- **Health Score:** ${data.health_score || 'N/A'}\n`;
      body += `- **Coverage:** ${data.coverage || 'N/A'}%\n`;
      body += `- **Commits (30d):** ${data.git_activity.commits_last_30d}\n`;
      body += `- **Last Commit:** ${data.git_activity.last_commit_days_ago !== null ? `${data.git_activity.last_commit_days_ago} days ago` : 'N/A'}\n\n`;

      body += `---\n*Auto-generated by GDD Drift Prediction System*`;

      try {
        // Create issue using gh CLI
        const issueCmd = `gh issue create --title "${title}" --body "${body.replace(/"/g, '\\"')}" --label "documentation,drift-risk"`;
        execSync(issueCmd, { cwd: this.rootDir, stdio: 'inherit' });
        console.log(`✅ Created issue for ${nodeName}`);
      } catch (error) {
        console.error(`❌ Failed to create issue for ${nodeName}:`, error.message);
      }
    }
  }

  /**
   * Print summary to console
   */
  printSummary(duration) {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log(`║ ${this.getDriftEmoji(this.driftData.overall_status.toLowerCase())}  DRIFT STATUS: ${this.driftData.overall_status.padEnd(22)} ║`);
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ 📊 Average Risk:  ${String(this.driftData.average_drift_risk).padStart(3)}/100              ║`);
    console.log(`║ 🟢 Healthy:       ${String(this.driftData.healthy_count).padStart(3)}                    ║`);
    console.log(`║ 🟡 At Risk:       ${String(this.driftData.at_risk_count).padStart(3)}                    ║`);
    console.log(`║ 🔴 Likely Drift:  ${String(this.driftData.high_risk_count).padStart(3)}                    ║`);
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log(`📁 Reports generated:`);
    console.log(`   - docs/drift-report.md`);
    console.log(`   - gdd-drift.json`);
    console.log('');
    console.log(`⏱️  Completed in ${duration}ms`);
    console.log('');
  }
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);

  const options = {
    mode: 'full',
    ci: args.includes('--ci'),
    createIssues: args.includes('--create-issues'),
    nodeFilter: null
  };

  // Parse --node=<name>
  const nodeArg = args.find(a => a.startsWith('--node='));
  if (nodeArg) {
    options.nodeFilter = nodeArg.split('=')[1];
    options.mode = 'single';
  }

  const predictor = new GDDDriftPredictor(options);
  const exitCode = await predictor.predict();

  if (options.ci && typeof exitCode === 'number') {
    process.exit(exitCode);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { GDDDriftPredictor };
