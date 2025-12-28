#!/usr/bin/env node

/**
 * GDD Health Scoring (v2-aligned)
 *
 * v2 MUST be deterministic and SSOT-driven:
 * - Node IDs and docs mapping come exclusively from `docs/system-map-v2.yaml`.
 * - v2 scoring MUST NOT penalize missing v1-only concepts (spec.md, coverageEvidence, agentRelevance, etc).
 *
 * CI contract (used by scripts/sync-gdd-metrics.js):
 * - `node scripts/score-gdd-health.js --ci` prints: `Overall Health: <score>/100`
 * - exits 1 if score < threshold (default 87, override with GDD_MIN_HEALTH_SCORE)
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

class GDDHealthScorer {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = options.rootDir ? path.resolve(options.rootDir) : path.resolve(__dirname, '..');
    this.scores = {};
    this.validationData = { missing_refs: [], cycles: [] };
  }

  async score() {
    const systemMap = await this.loadSystemMap();
    this.validationData = await this.collectV2Validation(systemMap);

    const nodes = this.buildNodesFromSystemMap(systemMap);
    for (const [nodeId, nodeData] of Object.entries(nodes)) {
      this.scores[nodeId] = await this.scoreNode(nodeId, nodeData, systemMap);
    }

    const stats = this.calculateOverallStats();
    await this.generateReports(stats);

    if (!this.options.json && !this.options.ci) {
      this.printSummary(stats);
    }

    return { scores: this.scores, stats };
  }

  async loadSystemMap() {
    try {
      const filePath = path.join(this.rootDir, 'docs', 'system-map-v2.yaml');
      const content = await fs.readFile(filePath, 'utf-8');
      return yaml.parse(content);
    } catch {
      return { nodes: {}, validation: {} };
    }
  }

  buildNodesFromSystemMap(systemMap) {
    const nodes = {};
    for (const [nodeKey, nodeData] of Object.entries(systemMap?.nodes || {})) {
      const nodeId = nodeData?.id || nodeKey;
      nodes[nodeId] = {
        name: nodeId,
        metadata: {
          status: nodeData?.status || 'active',
          last_updated: nodeData?.last_updated || null,
          depends_on: Array.isArray(nodeData?.depends_on) ? nodeData.depends_on : [],
          required_by: Array.isArray(nodeData?.required_by) ? nodeData.required_by : []
        },
        systemMap: nodeData
      };
    }
    return nodes;
  }

  detectCycles(systemMap) {
    const cycles = [];
    const visited = new Set();
    const stack = new Set();

    const dfs = (node, pathAcc) => {
      if (stack.has(node)) {
        const idx = pathAcc.indexOf(node);
        cycles.push(pathAcc.slice(idx).concat(node));
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      stack.add(node);

      const nodeData = systemMap?.nodes?.[node];
      const deps = Array.isArray(nodeData?.depends_on) ? nodeData.depends_on : [];
      for (const dep of deps) dfs(dep, [...pathAcc, dep]);

      stack.delete(node);
    };

    for (const nodeId of Object.keys(systemMap?.nodes || {})) {
      if (!visited.has(nodeId)) dfs(nodeId, [nodeId]);
    }
    return cycles;
  }

  async collectV2Validation(systemMap) {
    const missing_refs = [];
    const cycles = this.detectCycles(systemMap);

    for (const [nodeKey, nodeData] of Object.entries(systemMap?.nodes || {})) {
      const nodeId = nodeData?.id || nodeKey;
      const deps = Array.isArray(nodeData?.depends_on) ? nodeData.depends_on : [];

      for (const dep of deps) {
        if (!systemMap.nodes?.[dep]) {
          missing_refs.push({
            type: 'missing_dependency',
            node: nodeId,
            dependency: dep,
            message: `${nodeId} depends_on ${dep} which doesn't exist in system-map-v2.yaml`
          });
        } else {
          const requiredBy = Array.isArray(systemMap.nodes[dep]?.required_by)
            ? systemMap.nodes[dep].required_by
            : [];
          if (!requiredBy.includes(nodeId)) {
            missing_refs.push({
              type: 'missing_bidirectional_edge',
              node: nodeId,
              dependency: dep,
              message: `${nodeId} depends_on ${dep} but ${dep} doesn't list ${nodeId} in required_by`
            });
          }
        }
      }

      const docs = Array.isArray(nodeData?.docs) ? nodeData.docs : nodeData?.docs ? [nodeData.docs] : [];
      for (const docsPath of docs) {
        if (typeof docsPath !== 'string' || docsPath.trim().length === 0) continue;
        const resolved = path.resolve(this.rootDir, docsPath);
        try {
          await fs.access(resolved);
        } catch {
          missing_refs.push({
            type: 'missing_doc_path',
            node: nodeId,
            doc: docsPath,
            message: `${nodeId} references missing docs file: ${docsPath}`
          });
        }
      }
    }

    return { missing_refs, cycles };
  }

  async scoreNode(nodeId, nodeData, systemMap) {
    const breakdown = {
      docsIntegrity: this.scoreDocsIntegrity(nodeId),
      dependencyIntegrity: this.scoreDependencyIntegrity(nodeId),
      symmetryIntegrity: this.scoreSymmetryIntegrity(nodeId),
      updateFreshness: this.scoreUpdateFreshness(systemMap, nodeData)
    };

    const totalScore =
      breakdown.docsIntegrity * 0.4 +
      breakdown.dependencyIntegrity * 0.3 +
      breakdown.symmetryIntegrity * 0.2 +
      breakdown.updateFreshness * 0.1;

    const rounded = Math.round(totalScore);
    return {
      score: Math.min(100, Math.max(0, rounded)),
      breakdown,
      status: this.getStatusFromScore(rounded),
      metadata: nodeData.metadata,
      issues: this.getNodeIssues(nodeId)
    };
  }

  scoreDocsIntegrity(nodeId) {
    const hasMissingDoc = this.validationData.missing_refs?.some(
      (r) => r.type === 'missing_doc_path' && r.node === nodeId
    );
    return hasMissingDoc ? 0 : 100;
  }

  scoreDependencyIntegrity(nodeId) {
    if (this.validationData.cycles?.some((c) => c.includes(nodeId))) return 0;
    const hasMissingDep = this.validationData.missing_refs?.some(
      (r) => r.type === 'missing_dependency' && r.node === nodeId
    );
    return hasMissingDep ? 0 : 100;
  }

  scoreSymmetryIntegrity(nodeId) {
    const hasSymmetryIssue = this.validationData.missing_refs?.some(
      (r) => r.type === 'missing_bidirectional_edge' && r.node === nodeId
    );
    return hasSymmetryIssue ? 50 : 100;
  }

  scoreUpdateFreshness(systemMap, nodeData) {
    const freshnessDays = systemMap?.validation?.update_freshness_days || 30;
    const last = nodeData?.metadata?.last_updated;
    if (!last) return 100;

    const lastDate = new Date(last);
    if (Number.isNaN(lastDate.getTime())) return 100;
    const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince <= freshnessDays ? 100 : 50;
  }

  getStatusFromScore(score) {
    if (score >= 80) return 'healthy';
    if (score >= 50) return 'degraded';
    return 'critical';
  }

  getNodeIssues(nodeId) {
    const issues = [];
    const missingRefs = this.validationData.missing_refs?.filter((r) => r.node === nodeId) || [];
    issues.push(...missingRefs.map((r) => r.message));
    if (this.validationData.cycles?.some((c) => c.includes(nodeId))) {
      issues.push('Part of dependency cycle');
    }
    return issues;
  }

  calculateOverallStats() {
    const scores = Object.values(this.scores);
    const total = scores.reduce((sum, n) => sum + n.score, 0);
    const avg = scores.length > 0 ? total / scores.length : 0;

    const healthy = scores.filter((n) => n.status === 'healthy').length;
    const degraded = scores.filter((n) => n.status === 'degraded').length;
    const critical = scores.filter((n) => n.status === 'critical').length;

    let overallStatus = 'HEALTHY';
    if (critical > 0) overallStatus = 'CRITICAL';
    else if (degraded > 2) overallStatus = 'DEGRADED';

    return {
      generated_at: new Date().toISOString(),
      status: overallStatus,
      overall_score: parseFloat(avg.toFixed(1)),
      total_nodes: scores.length,
      healthy_count: healthy,
      degraded_count: degraded,
      critical_count: critical
    };
  }

  async generateReports(stats) {
    await this.generateMarkdownReport(stats);
    await this.generateJSONReport(stats);
  }

  async generateMarkdownReport(stats) {
    const statusEmoji = { healthy: '🟢', degraded: '🟡', critical: '🔴' };
    const sortedNodes = Object.entries(this.scores).sort((a, b) => a[1].score - b[1].score);

    let markdown = `# 📊 GDD Node Health Report (v2)

**Generated:** ${stats.generated_at}
**Overall Status:** ${statusEmoji[stats.status.toLowerCase()]} ${stats.status}
**Overall Health:** ${stats.overall_score}/100

---

## Summary

- **Total Nodes:** ${stats.total_nodes}
- 🟢 **Healthy (80-100):** ${stats.healthy_count}
- 🟡 **Degraded (50-79):** ${stats.degraded_count}
- 🔴 **Critical (<50):** ${stats.critical_count}

---

## Node Scores

| Node | Score | Status | Last Updated | Issues |
|------|-------|--------|--------------|--------|
`;

    for (const [nodeName, data] of sortedNodes) {
      const emoji = statusEmoji[data.status];
      const lastUpdate = data.metadata.last_updated || 'N/A';
      const issueCount = data.issues.length;
      markdown += `| ${nodeName} | ${emoji} ${data.score} | ${data.status} | ${lastUpdate} | ${issueCount} |\n`;
    }

    const outputPath = path.join(this.rootDir, 'docs', 'system-health.md');
    await fs.writeFile(outputPath, markdown, 'utf-8');
  }

  async generateJSONReport(stats) {
    const output = { ...stats, nodes: {} };
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

  printSummary(stats) {
    console.log(`Overall Health: ${stats.overall_score}/100`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    json: args.includes('--json'),
    ci: args.includes('--ci')
  };

  const scorer = new GDDHealthScorer(options);
  const { stats } = await scorer.score();

  if (options.ci) {
    const minScore = process.env.GDD_MIN_HEALTH_SCORE ? Number(process.env.GDD_MIN_HEALTH_SCORE) : 87;
    const score = stats.overall_score || 0;
    console.log(`Overall Health: ${score}/100`);
    if (Number.isFinite(minScore) && score < minScore) {
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { GDDHealthScorer };
