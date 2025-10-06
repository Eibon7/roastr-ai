#!/usr/bin/env node

/**
 * GDD Runtime Validator
 *
 * Validates the coherence between system-map.yaml, docs/nodes/, spec.md, and src/
 * Detects inconsistencies, orphans, cycles, and drift
 *
 * Usage:
 *   node scripts/validate-gdd-runtime.js --full
 *   node scripts/validate-gdd-runtime.js --diff
 *   node scripts/validate-gdd-runtime.js --node=shield
 *   node scripts/validate-gdd-runtime.js --report
 *   node scripts/validate-gdd-runtime.js --ci
 *   node scripts/validate-gdd-runtime.js --score    # Run validation + health scoring
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

class GDDValidator {
  constructor(options = {}) {
    this.options = options;
    this.startTime = Date.now();
    this.results = {
      timestamp: new Date().toISOString(),
      mode: options.mode || 'full',
      nodes_validated: 0,
      orphans: [],
      drift: {},
      outdated: [],
      cycles: [],
      missing_refs: [],
      broken_links: [],
      status: 'healthy'
    };
    this.rootDir = path.resolve(__dirname, '..');
    this.isCIMode = options.ci || false;
  }

  /**
   * Main validation entry point
   */
  async validate() {
    try {
      this.log('🔍 Running GDD Runtime Validation...', 'info');
      this.log('');

      // Load all necessary files
      const systemMap = await this.loadSystemMap();
      const nodes = await this.loadAllNodes();
      const specContent = await this.loadSpec();
      const sourceFiles = await this.scanSourceFiles();

      // Run validation checks
      await this.validateGraphConsistency(systemMap, nodes);
      await this.validateSpecSync(systemMap, nodes, specContent);
      await this.validateBidirectionalEdges(systemMap, nodes);
      await this.validateCodeIntegration(nodes, sourceFiles);
      await this.checkOutdatedNodes(nodes);
      await this.detectOrphans(systemMap, nodes);

      // Determine overall status
      this.determineStatus();

      // Generate reports
      await this.generateReports();

      // Output summary
      this.printSummary();

      // Exit code for CI
      if (this.isCIMode && this.results.status !== 'healthy') {
        process.exit(1);
      }

      return this.results;
    } catch (error) {
      this.log(`❌ Validation failed: ${error.message}`, 'error');
      if (this.isCIMode) {
        process.exit(1);
      }
      throw error;
    }
  }

  /**
   * Load system-map.yaml
   */
  async loadSystemMap() {
    this.log('📊 Loading system-map.yaml...', 'step');
    try {
      const filePath = path.join(this.rootDir, 'docs', 'system-map.yaml');
      const content = await fs.readFile(filePath, 'utf-8');
      const map = yaml.parse(content);
      this.log('   ✅ Loaded', 'success');
      return map;
    } catch (error) {
      this.log('   ⚠️  system-map.yaml not found, creating empty map', 'warning');
      return { nodes: {} };
    }
  }

  /**
   * Load all node files from docs/nodes/
   */
  async loadAllNodes() {
    this.log('📄 Loading GDD nodes...', 'step');
    const nodesDir = path.join(this.rootDir, 'docs', 'nodes');
    const nodes = {};

    try {
      const files = await fs.readdir(nodesDir);
      const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md');

      for (const file of mdFiles) {
        const filePath = path.join(nodesDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const nodeName = file.replace('.md', '');

        // Parse metadata from frontmatter or first section
        const metadata = this.parseNodeMetadata(content);

        nodes[nodeName] = {
          file: `docs/nodes/${file}`,
          content,
          metadata,
          name: nodeName
        };
      }

      this.log(`   ✅ Loaded ${Object.keys(nodes).length} nodes`, 'success');
      return nodes;
    } catch (error) {
      this.log('   ⚠️  docs/nodes/ not found', 'warning');
      return {};
    }
  }

  /**
   * Parse node metadata from content
   */
  parseNodeMetadata(content) {
    const metadata = {
      last_updated: null,
      status: 'active',
      dependencies: [],
      used_by: []
    };

    // Try to extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      try {
        const frontmatter = yaml.parse(frontmatterMatch[1]);
        Object.assign(metadata, frontmatter);
      } catch (e) {
        // Ignore YAML parse errors
      }
    }

    // Extract last_updated from text
    const dateMatch = content.match(/last[_\s]updated:?\s*(\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) {
      metadata.last_updated = dateMatch[1];
    }

    // Extract status
    const statusMatch = content.match(/status:?\s*(active|deprecated|experimental)/i);
    if (statusMatch) {
      metadata.status = statusMatch[1].toLowerCase();
    }

    // Extract dependencies section
    const depsMatch = content.match(/##\s*Dependencies[\s\S]*?-\s*([^\n]+)/gi);
    if (depsMatch) {
      depsMatch.forEach(match => {
        const dep = match.match(/-\s*([a-z-]+)\.md/i);
        if (dep) {
          metadata.dependencies.push(dep[1]);
        }
      });
    }

    return metadata;
  }

  /**
   * Load spec.md
   */
  async loadSpec() {
    this.log('📖 Loading spec.md...', 'step');
    try {
      const filePath = path.join(this.rootDir, 'spec.md');
      const content = await fs.readFile(filePath, 'utf-8');
      this.log('   ✅ Loaded', 'success');
      return content;
    } catch (error) {
      this.log('   ⚠️  spec.md not found', 'warning');
      return '';
    }
  }

  /**
   * Scan source files for @GDD tags and imports
   */
  async scanSourceFiles() {
    this.log('💾 Scanning source code...', 'step');
    const srcDir = path.join(this.rootDir, 'src');
    const sourceFiles = [];

    try {
      const files = await this.walkDirectory(srcDir);

      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.ts')) {
          const content = await fs.readFile(file, 'utf-8');
          sourceFiles.push({
            path: path.relative(this.rootDir, file),
            content,
            // Extract @GDD tags
            gddTags: this.extractGDDTags(content)
          });
        }
      }

      this.log(`   ✅ Scanned ${sourceFiles.length} source files`, 'success');
      return sourceFiles;
    } catch (error) {
      this.log('   ⚠️  src/ directory not accessible', 'warning');
      return [];
    }
  }

  /**
   * Walk directory recursively
   */
  async walkDirectory(dir) {
    const files = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...await this.walkDirectory(fullPath));
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
    return files;
  }

  /**
   * Extract @GDD tags from source code
   */
  extractGDDTags(content) {
    const tags = [];
    const regex = /@GDD:node=([a-z-]+)/gi;
    let match;

    while ((match = regex.exec(content)) !== null) {
      tags.push(match[1]);
    }

    return tags;
  }

  /**
   * Validate graph consistency (no cycles, all nodes exist)
   */
  async validateGraphConsistency(systemMap, nodes) {
    this.log('🧩 Checking graph consistency...', 'step');

    if (!systemMap.nodes || Object.keys(systemMap.nodes).length === 0) {
      this.log('   ⚠️  No nodes in system-map.yaml', 'warning');
      return;
    }

    // Check all nodes in system-map exist
    for (const [nodeName, nodeData] of Object.entries(systemMap.nodes)) {
      if (!nodes[nodeName]) {
        this.results.missing_refs.push({
          type: 'missing_node',
          node: nodeName,
          message: `Node ${nodeName} in system-map.yaml but file doesn't exist`
        });
      }

      // Check dependencies exist
      if (nodeData.dependencies) {
        for (const dep of nodeData.dependencies) {
          if (!nodes[dep] && !systemMap.nodes[dep]) {
            this.results.missing_refs.push({
              type: 'missing_dependency',
              node: nodeName,
              dependency: dep,
              message: `${nodeName} depends on ${dep} which doesn't exist`
            });
          }
        }
      }
    }

    // Check for cycles
    const cycles = this.detectCycles(systemMap);
    if (cycles.length > 0) {
      this.results.cycles = cycles;
      this.log('   ⚠️  Cycles detected in dependency graph', 'warning');
    }

    if (this.results.missing_refs.length === 0 && cycles.length === 0) {
      this.log('   ✅ Graph consistent', 'success');
    } else {
      this.log(`   ⚠️  ${this.results.missing_refs.length} inconsistencies found`, 'warning');
    }
  }

  /**
   * Detect cycles in dependency graph
   */
  detectCycles(systemMap) {
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();

    const dfs = (node, path = []) => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart).concat(node));
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const nodeData = systemMap.nodes[node];
      if (nodeData && nodeData.dependencies) {
        for (const dep of nodeData.dependencies) {
          dfs(dep, [...path]);
        }
      }

      recursionStack.delete(node);
    };

    for (const nodeName of Object.keys(systemMap.nodes || {})) {
      if (!visited.has(nodeName)) {
        dfs(nodeName);
      }
    }

    return cycles;
  }

  /**
   * Validate spec.md ↔ nodes synchronization
   */
  async validateSpecSync(systemMap, nodes, specContent) {
    this.log('📄 Validating spec ↔ nodes coherence...', 'step');

    // Check that all active nodes are referenced in spec.md
    for (const [nodeName, nodeData] of Object.entries(nodes)) {
      if (nodeData.metadata.status !== 'deprecated') {
        const nodeRef = `docs/nodes/${nodeName}.md`;
        if (!specContent.includes(nodeRef) && !specContent.includes(nodeName)) {
          this.results.missing_refs.push({
            type: 'node_not_in_spec',
            node: nodeName,
            message: `Active node ${nodeName} not referenced in spec.md`
          });
        }
      }
    }

    // Check that all spec.md references have corresponding nodes
    const nodeRefs = specContent.match(/docs\/nodes\/([a-z-]+)\.md/gi) || [];
    for (const ref of nodeRefs) {
      const nodeName = ref.match(/([a-z-]+)\.md/i)[1];
      if (!nodes[nodeName]) {
        this.results.missing_refs.push({
          type: 'spec_ref_missing_node',
          node: nodeName,
          message: `spec.md references ${nodeName} but node doesn't exist`
        });
      }
    }

    if (this.results.missing_refs.filter(r => r.type.includes('spec')).length === 0) {
      this.log('   ✅ spec.md synchronized', 'success');
    } else {
      const count = this.results.missing_refs.filter(r => r.type.includes('spec')).length;
      this.log(`   ⚠️  ${count} sync issues found`, 'warning');
    }
  }

  /**
   * Validate bidirectional edges
   */
  async validateBidirectionalEdges(systemMap, nodes) {
    this.log('🔗 Verifying bidirectional edges...', 'step');

    if (!systemMap.nodes) {
      this.log('   ⚠️  No system-map.yaml', 'warning');
      return;
    }

    for (const [nodeName, nodeData] of Object.entries(systemMap.nodes)) {
      if (nodeData.dependencies) {
        for (const dep of nodeData.dependencies) {
          const depNode = systemMap.nodes[dep];
          if (depNode) {
            if (!depNode.used_by || !depNode.used_by.includes(nodeName)) {
              this.results.missing_refs.push({
                type: 'missing_bidirectional_edge',
                node: nodeName,
                dependency: dep,
                message: `${nodeName} → ${dep} but ${dep} doesn't list ${nodeName} in used_by`
              });
            }
          }
        }
      }
    }

    const edgeIssues = this.results.missing_refs.filter(r => r.type === 'missing_bidirectional_edge').length;
    if (edgeIssues === 0) {
      this.log('   ✅ All edges bidirectional', 'success');
    } else {
      this.log(`   ⚠️  ${edgeIssues} missing bidirectional edges`, 'warning');
    }
  }

  /**
   * Validate code integration (@GDD tags)
   */
  async validateCodeIntegration(nodes, sourceFiles) {
    this.log('💾 Scanning source code for @GDD tags...', 'step');

    let totalTags = 0;
    let invalidTags = 0;

    for (const sourceFile of sourceFiles) {
      for (const tag of sourceFile.gddTags) {
        totalTags++;
        if (!nodes[tag]) {
          invalidTags++;
          this.results.drift[sourceFile.path] = this.results.drift[sourceFile.path] || [];
          this.results.drift[sourceFile.path].push(`@GDD:node=${tag} references non-existent node`);
        }
      }
    }

    if (invalidTags === 0) {
      this.log(`   ✅ ${totalTags} @GDD tags validated`, 'success');
    } else {
      this.log(`   ⚠️  ${invalidTags}/${totalTags} invalid tags`, 'warning');
    }
  }

  /**
   * Check for outdated nodes (>30 days)
   */
  async checkOutdatedNodes(nodes) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const [nodeName, nodeData] of Object.entries(nodes)) {
      if (nodeData.metadata.last_updated) {
        const lastUpdate = new Date(nodeData.metadata.last_updated);
        if (lastUpdate < thirtyDaysAgo) {
          this.results.outdated.push({
            node: nodeName,
            last_updated: nodeData.metadata.last_updated,
            days_ago: Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))
          });
        }
      }
    }

    this.results.nodes_validated = Object.keys(nodes).length;
  }

  /**
   * Detect orphan nodes
   */
  async detectOrphans(systemMap, nodes) {
    for (const [nodeName, nodeData] of Object.entries(nodes)) {
      // Orphan if not in system-map and status is active
      if (nodeData.metadata.status === 'active') {
        if (!systemMap.nodes || !systemMap.nodes[nodeName]) {
          this.results.orphans.push(nodeName);
        }
      }
    }
  }

  /**
   * Determine overall status
   */
  determineStatus() {
    if (this.results.cycles.length > 0 || this.results.missing_refs.length > 5) {
      this.results.status = 'critical';
    } else if (
      this.results.missing_refs.length > 0 ||
      this.results.orphans.length > 0 ||
      Object.keys(this.results.drift).length > 0 ||
      this.results.outdated.length > 3
    ) {
      this.results.status = 'warning';
    } else {
      this.results.status = 'healthy';
    }
  }

  /**
   * Generate reports
   */
  async generateReports() {
    if (!this.options.skipReports) {
      await this.generateMarkdownReport();
      await this.generateJSONReport();
    }
  }

  /**
   * Generate system-validation.md
   */
  async generateMarkdownReport() {
    const statusEmoji = {
      healthy: '🟢',
      warning: '🟡',
      critical: '🔴'
    };

    let markdown = `# 🧩 GDD Runtime Validation Report

**Date:** ${this.results.timestamp}
**Mode:** ${this.results.mode}
**Status:** ${statusEmoji[this.results.status]} ${this.results.status.toUpperCase()}

---

## Summary

- **Nodes Validated:** ${this.results.nodes_validated}
- **Orphan Nodes:** ${this.results.orphans.length}
- **Outdated Nodes:** ${this.results.outdated.length}
- **Missing References:** ${this.results.missing_refs.length}
- **Cycles Detected:** ${this.results.cycles.length}
- **Drift Issues:** ${Object.keys(this.results.drift).length}

---

## Validation Results

`;

    // Cycles
    if (this.results.cycles.length > 0) {
      markdown += `### ❌ Dependency Cycles

${this.results.cycles.map(cycle => `- ${cycle.join(' → ')}`).join('\n')}

`;
    }

    // Missing References
    if (this.results.missing_refs.length > 0) {
      markdown += `### ⚠️ Missing References

| Type | Node | Issue |
|------|------|-------|
${this.results.missing_refs.map(ref =>
  `| ${ref.type} | ${ref.node} | ${ref.message} |`
).join('\n')}

`;
    }

    // Orphan Nodes
    if (this.results.orphans.length > 0) {
      markdown += `### 🔴 Orphan Nodes

Nodes not referenced in system-map.yaml:

${this.results.orphans.map(node => `- \`${node}\``).join('\n')}

`;
    }

    // Outdated Nodes
    if (this.results.outdated.length > 0) {
      markdown += `### ⏰ Outdated Nodes

Nodes not updated in >30 days:

| Node | Last Updated | Days Ago |
|------|--------------|----------|
${this.results.outdated.map(node =>
  `| ${node.node} | ${node.last_updated} | ${node.days_ago} |`
).join('\n')}

`;
    }

    // Drift
    if (Object.keys(this.results.drift).length > 0) {
      markdown += `### 🔀 Code Drift

Files with potential drift:

${Object.entries(this.results.drift).map(([file, issues]) =>
  `- **${file}**\n${issues.map(i => `  - ${i}`).join('\n')}`
).join('\n')}

`;
    }

    markdown += `---

**Validation Time:** ${((Date.now() - this.startTime) / 1000).toFixed(2)}s
**Generated by:** GDD Runtime Validator
`;

    const outputPath = path.join(this.rootDir, 'docs', 'system-validation.md');
    await fs.writeFile(outputPath, markdown, 'utf-8');

    if (!this.isCIMode) {
      this.log(`\n📄 Report written to: docs/system-validation.md`, 'info');
    }
  }

  /**
   * Generate gdd-status.json
   */
  async generateJSONReport() {
    const outputPath = path.join(this.rootDir, 'gdd-status.json');
    await fs.writeFile(outputPath, JSON.stringify(this.results, null, 2), 'utf-8');

    if (!this.isCIMode) {
      this.log(`📊 JSON status: gdd-status.json`, 'info');
    }
  }

  /**
   * Print summary to console
   */
  printSummary() {
    if (this.isCIMode) return;

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('         VALIDATION SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log(`✔ ${this.results.nodes_validated} nodes validated`);

    if (this.results.orphans.length > 0) {
      console.log(`❌ ${this.results.orphans.length} orphan(s)`);
    }

    if (this.results.outdated.length > 0) {
      console.log(`⚠ ${this.results.outdated.length} outdated node(s)`);
    }

    if (this.results.cycles.length > 0) {
      console.log(`❌ ${this.results.cycles.length} cycle(s) detected`);
    }

    if (this.results.missing_refs.length > 0) {
      console.log(`⚠ ${this.results.missing_refs.length} missing reference(s)`);
    }

    if (Object.keys(this.results.drift).length > 0) {
      console.log(`⚠ ${Object.keys(this.results.drift).length} drift issue(s)`);
    }

    console.log('');
    console.log(`⏱  Completed in ${((Date.now() - this.startTime) / 1000).toFixed(2)}s`);
    console.log('');

    const statusSymbol = {
      healthy: '🟢',
      warning: '🟡',
      critical: '🔴'
    };
    console.log(`${statusSymbol[this.results.status]} Overall Status: ${this.results.status.toUpperCase()}`);
    console.log('');
  }

  /**
   * Log message with formatting
   */
  log(message, type = 'info') {
    if (this.isCIMode && type !== 'error') return;

    const colors = {
      info: '\x1b[36m',    // Cyan
      step: '\x1b[34m',    // Blue
      success: '\x1b[32m', // Green
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m'
    };

    console.log(`${colors[type] || colors.info}${message}${colors.reset}`);
  }
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);
  const runScoring = args.includes('--score');

  const options = {
    mode: 'full',
    ci: args.includes('--ci'),
    skipReports: args.includes('--report') && args.length === 1,
    node: null
  };

  if (args.includes('--diff')) {
    options.mode = 'diff';
  }

  const nodeArg = args.find(arg => arg.startsWith('--node='));
  if (nodeArg) {
    options.mode = 'single';
    options.node = nodeArg.split('=')[1];
  }

  const validator = new GDDValidator(options);
  await validator.validate();

  // Run health scoring if requested
  if (runScoring) {
    console.log('');
    console.log('\x1b[36m🧬 Running Node Health Scoring...\x1b[0m');
    console.log('');

    const { GDDHealthScorer } = require('./score-gdd-health');
    const scorer = new GDDHealthScorer({ json: false });
    const { stats } = await scorer.score();

    // Print integrated summary
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║     🧩 NODE HEALTH SUMMARY            ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`🟢 Healthy: ${stats.healthy_count} | 🟡 Degraded: ${stats.degraded_count} | 🔴 Critical: ${stats.critical_count}`);
    console.log(`Average Score: ${stats.average_score}/100`);
    console.log('');
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { GDDValidator };
