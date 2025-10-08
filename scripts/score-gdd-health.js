#!/usr/bin/env node

/**
 * GDD Node Health Scoring System
 *
 * Calculates a health score (0-100) for each GDD node based on:
 * 1. Sync Accuracy (25%) - spec.md ↔ node ↔ code alignment
 * 2. Update Freshness (20%) - Days since last_updated
 * 3. Dependency Integrity (20%) - Bidirectional edges, no cycles
 * 4. Coverage Evidence (20%) - Tests documented, coverage metrics
 * 5. Agent Relevance (10%) - Agent list complete and valid
 * 6. Integrity Score (10%) - Coverage authenticity (Phase 15.1)
 *
 * Usage:
 *   node scripts/score-gdd-health.js
 *   node scripts/score-gdd-health.js --json
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const { CoverageHelper } = require('./gdd-coverage-helper');

class GDDHealthScorer {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = path.resolve(__dirname, '..');
    this.scores = {};
    this.validationData = null;
  }

  /**
   * Main scoring entry point
   */
  async score() {
    try {
      // Load validation data
      await this.loadValidationData();

      // Load nodes
      const nodes = await this.loadAllNodes();
      const systemMap = await this.loadSystemMap();
      const specContent = await this.loadSpec();

      // Score each node
      for (const [nodeName, nodeData] of Object.entries(nodes)) {
        const score = await this.scoreNode(nodeName, nodeData, nodes, systemMap, specContent);
        this.scores[nodeName] = score;
      }

      // Calculate overall stats
      const stats = this.calculateOverallStats();

      // Generate reports
      await this.generateReports(stats);

      // Print summary
      this.printSummary(stats);

      return { scores: this.scores, stats };
    } catch (error) {
      console.error(`❌ Scoring failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load validation data from gdd-status.json
   */
  async loadValidationData() {
    try {
      const filePath = path.join(this.rootDir, 'gdd-status.json');
      const content = await fs.readFile(filePath, 'utf-8');
      this.validationData = JSON.parse(content);
    } catch (error) {
      this.validationData = {
        orphans: [],
        missing_refs: [],
        cycles: [],
        drift: {}
      };
    }
  }

  /**
   * Load all nodes
   */
  async loadAllNodes() {
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
      return {};
    }
  }

  /**
   * Parse node metadata
   */
  parseNodeMetadata(content) {
    const metadata = {
      last_updated: null,
      status: 'active',
      dependencies: [],
      used_by: [],
      agents: [],
      tests: [],
      coverage: null
    };

    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      try {
        const frontmatter = yaml.parse(frontmatterMatch[1]);
        Object.assign(metadata, frontmatter);
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Extract last_updated (supports both "last_updated:" and "**Last Updated:**")
    const dateMatch = content.match(/\*?\*?last[_\s]updated:?\*?\*?\s*(\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) {
      metadata.last_updated = dateMatch[1];
    }

    // Extract status
    const statusMatch = content.match(/status:?\s*(active|deprecated|experimental)/i);
    if (statusMatch) {
      metadata.status = statusMatch[1].toLowerCase();
    }

    // Extract dependencies
    const depsSection = content.match(/##\s*Dependencies[\s\S]*?(?=##|$)/i);
    if (depsSection) {
      const depMatches = depsSection[0].match(/-\s*([a-z-]+)\.md/gi) || [];
      metadata.dependencies = depMatches.map(m => m.match(/([a-z-]+)\.md/i)[1]);
    }

    // Extract agents (supports both "- Agent" and "- **Agent**")
    const agentsSection = content.match(/##\s*Agentes Relevantes[\s\S]*?(?=##|$)/i);
    if (agentsSection) {
      // Match lines starting with "- " followed by optional ** and agent name
      const agentMatches = agentsSection[0].match(/-\s*\*?\*?([A-Za-z\s]+(?:Agent|Developer|Engineer|Analyst|Orchestrator))\*?\*?/gi) || [];
      metadata.agents = agentMatches.map(m => {
        // Remove leading "- " and optional "**"
        return m.replace(/^-\s*\*?\*?/, '').replace(/\*?\*?$/, '').trim();
      });
    }

    // Extract coverage (supports both "coverage: 60%" and "**Coverage:** 60%")
    const coverageMatch = content.match(/\*?\*?coverage:?\*?\*?\s*(\d+)%/i);
    if (coverageMatch) {
      metadata.coverage = parseInt(coverageMatch[1]);
    }

    // Extract test files
    const testSection = content.match(/##\s*Testing[\s\S]*?(?=##|$)/i);
    if (testSection) {
      const testMatches = testSection[0].match(/tests\/[^\s\n)]+\.test\.js/gi) || [];
      metadata.tests = testMatches;
    }

    return metadata;
  }

  /**
   * Load system-map.yaml
   */
  async loadSystemMap() {
    try {
      const filePath = path.join(this.rootDir, 'docs', 'system-map.yaml');
      const content = await fs.readFile(filePath, 'utf-8');
      return yaml.parse(content);
    } catch (error) {
      return { nodes: {} };
    }
  }

  /**
   * Load spec.md
   */
  async loadSpec() {
    try {
      const filePath = path.join(this.rootDir, 'spec.md');
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      return '';
    }
  }

  /**
   * Score a single node (0-100)
   */
  async scoreNode(nodeName, nodeData, allNodes, systemMap, specContent) {
    const scores = {
      syncAccuracy: this.scoreSyncAccuracy(nodeName, nodeData, specContent),
      updateFreshness: this.scoreUpdateFreshness(nodeData),
      dependencyIntegrity: this.scoreDependencyIntegrity(nodeName, nodeData, systemMap),
      coverageEvidence: this.scoreCoverageEvidence(nodeData),
      agentRelevance: this.scoreAgentRelevance(nodeData),
      integrityScore: await this.scoreIntegrity(nodeName, nodeData)  // Phase 15.1
    };

    // Weighted average (adjusted to include integrity score)
    const totalScore =
      scores.syncAccuracy * 0.25 +           // Reduced from 30%
      scores.updateFreshness * 0.20 +
      scores.dependencyIntegrity * 0.20 +
      scores.coverageEvidence * 0.20 +
      scores.agentRelevance * 0.10 +
      scores.integrityScore * 0.10;          // New 10%

    return {
      score: Math.round(totalScore),
      breakdown: scores,
      status: this.getStatusFromScore(Math.round(totalScore)),
      metadata: nodeData.metadata,
      issues: this.getNodeIssues(nodeName)
    };
  }

  /**
   * Score sync accuracy (30%)
   */
  scoreSyncAccuracy(nodeName, nodeData, specContent) {
    let score = 100;
    const nodeRef = `docs/nodes/${nodeName}.md`;

    // Check if referenced in spec.md
    if (!specContent.includes(nodeRef) && !specContent.includes(nodeName)) {
      const isInMissingRefs = this.validationData.missing_refs?.some(
        ref => ref.node === nodeName && ref.type === 'node_not_in_spec'
      );
      if (isInMissingRefs) {
        score -= 10; // Critical mismatch
      }
    }

    // Check if node is orphaned
    if (this.validationData.orphans?.includes(nodeName)) {
      score -= 10;
    }

    // Check for drift
    if (this.validationData.drift && Object.keys(this.validationData.drift).length > 0) {
      // Check if this node has drift issues
      const hasDrift = Object.entries(this.validationData.drift).some(([file, issues]) => {
        return file.includes(nodeName);
      });
      if (hasDrift) {
        score -= 10;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Score update freshness (20%)
   */
  scoreUpdateFreshness(nodeData) {
    if (!nodeData.metadata.last_updated) {
      return 50; // No date = moderate penalty
    }

    const lastUpdate = new Date(nodeData.metadata.last_updated);
    const now = new Date();
    const daysSince = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));

    // Formula: 100 - (days * 2), min 0
    const score = Math.max(0, 100 - (daysSince * 2));
    return score;
  }

  /**
   * Score dependency integrity (20%)
   */
  scoreDependencyIntegrity(nodeName, nodeData, systemMap) {
    let score = 100;

    // Check for cycles
    if (this.validationData.cycles?.some(cycle => cycle.includes(nodeName))) {
      score -= 20;
    }

    // Check bidirectional edges
    const hasBidirectionalIssues = this.validationData.missing_refs?.some(
      ref => ref.type === 'missing_bidirectional_edge' && ref.node === nodeName
    );
    if (hasBidirectionalIssues) {
      score -= 20;
    }

    // Check missing dependencies
    const hasMissingDeps = this.validationData.missing_refs?.some(
      ref => ref.type === 'missing_dependency' && ref.node === nodeName
    );
    if (hasMissingDeps) {
      score -= 20;
    }

    return Math.max(0, score);
  }

  /**
   * Score coverage evidence (20%)
   */
  scoreCoverageEvidence(nodeData) {
    const coverage = nodeData.metadata.coverage;
    const hasTests = nodeData.metadata.tests && nodeData.metadata.tests.length > 0;

    // If coverage is explicitly documented, use it regardless of Testing section
    if (coverage !== null && coverage !== undefined) {
      // Score based on coverage percentage
      if (coverage >= 80) {
        return 100;
      } else if (coverage >= 60) {
        return 70;
      } else if (coverage >= 40) {
        return 50;
      } else {
        return 30;
      }
    }

    // If no coverage but tests are documented
    if (hasTests) {
      return 50; // Tests exist but no coverage documented
    }

    // No tests or coverage documented
    return 0;
  }

  /**
   * Score agent relevance (10%)
   */
  scoreAgentRelevance(nodeData) {
    const agents = nodeData.metadata.agents;

    if (!agents || agents.length === 0) {
      return 0; // No agents listed
    }

    // Check if agents section seems complete (has at least 1-2 agents)
    if (agents.length >= 2) {
      return 100; // Complete
    } else if (agents.length === 1) {
      return 50; // Partial
    } else {
      return 0;
    }
  }

  /**
   * Score coverage integrity (10%) - Phase 15.1
   */
  async scoreIntegrity(nodeName, nodeData) {
    const coverageHelper = new CoverageHelper();

    // Extract declared coverage
    const coverageMatch = nodeData.content.match(/\*?\*?coverage:?\*?\*?\s*(\d+)%/i);
    if (!coverageMatch) {
      // No coverage declared, integrity N/A → full score
      return 100;
    }

    const declaredCoverage = parseInt(coverageMatch[1], 10);

    // Check coverage source
    const sourceMatch = nodeData.content.match(/\*?\*?coverage\s+source:?\*?\*?\s*(auto|manual)/i);
    const coverageSource = sourceMatch ? sourceMatch[1].toLowerCase() : null;

    let score = 100;

    // Penalize if no source specified
    if (!coverageSource) {
      score -= 10;
    }

    // Penalize if manual source
    if (coverageSource === 'manual') {
      score -= 20;  // Manual coverage is discouraged
    }

    // Validate coverage authenticity
    const validation = await coverageHelper.validateCoverageAuthenticity(
      nodeName,
      declaredCoverage,
      3  // 3% tolerance
    );

    if (!validation.valid && validation.actual !== null) {
      // Coverage mismatch detected - critical integrity violation
      const diffPenalty = Math.min(50, validation.diff * 5);  // Up to 50% penalty
      score -= diffPenalty;
    }

    return Math.max(0, score);
  }

  /**
   * Get status from score
   */
  getStatusFromScore(score) {
    if (score >= 80) return 'healthy';
    if (score >= 50) return 'degraded';
    return 'critical';
  }

  /**
   * Get issues for a node
   */
  getNodeIssues(nodeName) {
    const issues = [];

    if (this.validationData.orphans?.includes(nodeName)) {
      issues.push('Orphan node (not in system-map.yaml)');
    }

    const missingRefs = this.validationData.missing_refs?.filter(ref => ref.node === nodeName);
    if (missingRefs && missingRefs.length > 0) {
      issues.push(...missingRefs.map(ref => ref.message));
    }

    if (this.validationData.cycles?.some(cycle => cycle.includes(nodeName))) {
      issues.push('Part of dependency cycle');
    }

    return issues;
  }

  /**
   * Calculate overall statistics
   */
  calculateOverallStats() {
    const scores = Object.values(this.scores);
    const totalScore = scores.reduce((sum, node) => sum + node.score, 0);
    const averageScore = scores.length > 0 ? totalScore / scores.length : 0;

    const healthy = scores.filter(n => n.status === 'healthy').length;
    const degraded = scores.filter(n => n.status === 'degraded').length;
    const critical = scores.filter(n => n.status === 'critical').length;

    let overallStatus = 'HEALTHY';
    if (critical > 0) overallStatus = 'CRITICAL';
    else if (degraded > 2) overallStatus = 'DEGRADED';

    return {
      generated_at: new Date().toISOString(),
      overall_status: overallStatus,
      average_score: parseFloat(averageScore.toFixed(1)),
      node_count: scores.length,
      healthy_count: healthy,
      degraded_count: degraded,
      critical_count: critical
    };
  }

  /**
   * Generate reports
   */
  async generateReports(stats) {
    await this.generateMarkdownReport(stats);
    await this.generateJSONReport(stats);
  }

  /**
   * Generate system-health.md
   */
  async generateMarkdownReport(stats) {
    const statusEmoji = {
      healthy: '🟢',
      degraded: '🟡',
      critical: '🔴'
    };

    // Sort nodes by score (worst first)
    const sortedNodes = Object.entries(this.scores).sort((a, b) => a[1].score - b[1].score);

    let markdown = `# 📊 GDD Node Health Report

**Generated:** ${stats.generated_at}
**Overall Status:** ${statusEmoji[stats.overall_status.toLowerCase()]} ${stats.overall_status}
**Average Score:** ${stats.average_score}/100

---

## Summary

- **Total Nodes:** ${stats.node_count}
- 🟢 **Healthy (80-100):** ${stats.healthy_count}
- 🟡 **Degraded (50-79):** ${stats.degraded_count}
- 🔴 **Critical (<50):** ${stats.critical_count}

---

## Node Scores

| Node | Score | Status | Last Updated | Coverage | Dependencies | Issues |
|------|-------|--------|--------------|----------|--------------|--------|
`;

    for (const [nodeName, data] of sortedNodes) {
      const emoji = statusEmoji[data.status];
      const lastUpdate = data.metadata.last_updated || 'N/A';
      const coverage = data.metadata.coverage !== null ? `${data.metadata.coverage}%` : 'N/A';
      const deps = data.metadata.dependencies.length;
      const issueCount = data.issues.length;

      markdown += `| ${nodeName} | ${emoji} ${data.score} | ${data.status} | ${lastUpdate} | ${coverage} | ${deps} | ${issueCount} |\n`;
    }

    // Top 5 nodes to review
    const topReview = sortedNodes.slice(0, 5);
    markdown += `\n---

## ⚠️ Top 5 Nodes to Review

`;

    for (const [nodeName, data] of topReview) {
      markdown += `### ${nodeName} (Score: ${data.score})\n\n`;
      markdown += `**Status:** ${statusEmoji[data.status]} ${data.status.toUpperCase()}\n\n`;
      markdown += `**Score Breakdown:**\n`;
      markdown += `- Sync Accuracy: ${data.breakdown.syncAccuracy}/100\n`;
      markdown += `- Update Freshness: ${data.breakdown.updateFreshness}/100\n`;
      markdown += `- Dependency Integrity: ${data.breakdown.dependencyIntegrity}/100\n`;
      markdown += `- Coverage Evidence: ${data.breakdown.coverageEvidence}/100\n`;
      markdown += `- Agent Relevance: ${data.breakdown.agentRelevance}/100\n`;
      markdown += `- Integrity Score: ${data.breakdown.integrityScore}/100\n\n`;

      if (data.issues.length > 0) {
        markdown += `**Issues:**\n`;
        data.issues.forEach(issue => {
          markdown += `- ${issue}\n`;
        });
      }
      markdown += `\n`;
    }

    markdown += `---

**Generated by:** GDD Health Scoring System
`;

    const outputPath = path.join(this.rootDir, 'docs', 'system-health.md');
    await fs.writeFile(outputPath, markdown, 'utf-8');
  }

  /**
   * Generate gdd-health.json
   */
  async generateJSONReport(stats) {
    const output = {
      ...stats,
      nodes: {}
    };

    for (const [nodeName, data] of Object.entries(this.scores)) {
      output.nodes[nodeName] = {
        score: data.score,
        status: data.status,
        breakdown: data.breakdown,
        issues: data.issues
      };
    }

    const outputPath = path.join(this.rootDir, 'gdd-health.json');
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  }

  /**
   * Print summary to console
   */
  printSummary(stats) {
    if (this.options.json) return;

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('       📊 NODE HEALTH SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log(`🟢 Healthy:   ${stats.healthy_count}`);
    console.log(`🟡 Degraded:  ${stats.degraded_count}`);
    console.log(`🔴 Critical:  ${stats.critical_count}`);
    console.log('');
    console.log(`Average Score: ${stats.average_score}/100`);
    console.log('');
    console.log(`Overall Status: ${stats.overall_status}`);
    console.log('');
    console.log('📄 Reports generated:');
    console.log('   - docs/system-health.md');
    console.log('   - gdd-health.json');
    console.log('');
  }
}

/**
 * CLI entry point that parses command-line options and runs the GDD health scoring workflow.
 *
 * Parses the `--json` flag, instantiates a GDDHealthScorer with the derived options, and invokes its scoring process which generates the health reports and console summary (console output is suppressed when `--json` is provided).
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    json: args.includes('--json')
  };

  const scorer = new GDDHealthScorer(options);
  await scorer.score();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { GDDHealthScorer };