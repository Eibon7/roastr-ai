#!/usr/bin/env node

/**
 * GDD Auto-Repair Assistant - Phase 10
 *
 * Automatically detects and repairs GDD documentation issues:
 * - Missing metadata (timestamps, coverage, agents)
 * - Broken bidirectional edges
 * - Orphan nodes
 * - Missing spec.md references
 * - Outdated timestamps (>30 days)
 *
 * Usage:
 *   node scripts/auto-repair-gdd.js                  # Interactive mode
 *   node scripts/auto-repair-gdd.js --auto           # Auto-fix all
 *   node scripts/auto-repair-gdd.js --ci             # CI mode
 *   node scripts/auto-repair-gdd.js --dry-run        # Show what would be fixed
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const { CoverageHelper } = require('./gdd-coverage-helper');

class AutoRepairEngine {
  constructor(options = {}) {
    this.options = {
      auto: options.auto || false,
      ci: options.ci || false,
      dryRun: options.dryRun || false,
      verbose: options.verbose || false
    };
    this.rootDir = path.resolve(__dirname, '..');
    this.backupDir = null;
    this.fixes = [];
    this.issues = {
      autoFixable: [],
      humanReview: [],
      critical: []
    };
    this.healthBefore = null;
    this.healthAfter = null;
  }

  /**
   * Main repair entry point
   */
  async repair() {
    try {
      console.log('');
      console.log('═══════════════════════════════════════════');
      console.log('      🔧 GDD AUTO-REPAIR ASSISTANT');
      console.log('═══════════════════════════════════════════');
      console.log('');

      // 1. Load current health
      this.healthBefore = await this.loadHealth();
      console.log(`📊 Current Health Score: ${this.healthBefore}/100`);
      console.log('');

      // 2. Create backup (unless dry-run)
      if (!this.options.dryRun) {
        this.backupDir = await this.createBackup();
        console.log(`💾 Backup created: ${this.backupDir}`);
        console.log('');
      }

      // 3. Detect all issues
      console.log('🔍 Detecting issues...');
      await this.detectIssues();

      const totalIssues = this.issues.autoFixable.length +
                         this.issues.humanReview.length +
                         this.issues.critical.length;

      console.log(`   Found ${totalIssues} issues:`);
      console.log(`   - 🟢 Auto-fixable: ${this.issues.autoFixable.length}`);
      console.log(`   - 🟡 Human review: ${this.issues.humanReview.length}`);
      console.log(`   - 🔴 Critical: ${this.issues.critical.length}`);
      console.log('');

      // 4. Handle critical issues
      if (this.issues.critical.length > 0) {
        console.log('🔴 CRITICAL ISSUES DETECTED:');
        this.issues.critical.forEach(issue => {
          console.log(`   - ${issue.description}`);
        });
        console.log('');
        console.log('❌ Cannot proceed with auto-repair. Manual intervention required.');
        return { success: false, critical: this.issues.critical };
      }

      // 5. Apply auto-fixes
      if (this.issues.autoFixable.length > 0) {
        if (this.options.dryRun) {
          console.log('🔍 DRY RUN - Would apply these fixes:');
          this.issues.autoFixable.forEach((issue, i) => {
            console.log(`   ${i + 1}. ${issue.description}`);
          });
        } else {
          console.log('🔧 Applying auto-fixes...');
          await this.applyFixes();
          console.log(`   ✅ Applied ${this.fixes.length} fixes`);
        }
        console.log('');
      }

      // 6. Validate results (unless dry-run)
      if (!this.options.dryRun && this.fixes.length > 0) {
        console.log('✓ Validating repairs...');
        await this.validateFixes();
        console.log(`   Health Score: ${this.healthBefore} → ${this.healthAfter}`);
        console.log('');

        // Rollback if health worsened
        if (this.healthAfter < this.healthBefore) {
          console.log('⚠️  Health score decreased! Rolling back...');
          await this.rollback();
          console.log('   ↩️  Rollback complete');
          return { success: false, reason: 'health_degraded' };
        }
      }

      // 7. Generate reports
      if (!this.options.dryRun) {
        await this.generateReport();
        await this.updateChangelog();
        console.log('📄 Reports generated');
        console.log('');
      }

      // 8. Summary
      console.log('═══════════════════════════════════════════');
      if (this.options.dryRun) {
        console.log('🔍 DRY RUN COMPLETE');
        console.log(`   Would fix: ${this.issues.autoFixable.length} issues`);
      } else {
        console.log('✅ AUTO-REPAIR COMPLETE');
        console.log(`   Fixes applied: ${this.fixes.length}`);
        console.log(`   Health: ${this.healthBefore} → ${this.healthAfter || this.healthBefore}`);
      }
      console.log('═══════════════════════════════════════════');
      console.log('');

      // 9. Generate JSON output for CI/CD
      const jsonOutput = {
        timestamp: new Date().toISOString(),
        mode: this.options.dryRun ? 'dry-run' : 'apply',
        success: true,
        fixes_would_apply: this.options.dryRun ? this.issues.autoFixable.length : 0,
        fixes_applied: this.options.dryRun ? 0 : this.fixes.length,
        errors: 0,
        health_before: this.healthBefore,
        health_after: this.healthAfter || this.healthBefore,
        details: {
          fixes: this.options.dryRun
            ? this.issues.autoFixable.map(issue => ({
                type: 'auto',
                node: issue.node || 'unknown',
                action: issue.description
              }))
            : this.fixes.map(fix => ({
                type: 'auto',
                node: fix.node || 'unknown',
                action: fix.description || fix
              })),
          humanReview: this.issues.humanReview.map(issue => ({
            node: issue.node,
            description: issue.description
          })),
          errors: []
        }
      };

      const jsonPath = path.join(this.rootDir, 'gdd-repair.json');
      await fs.writeFile(jsonPath, JSON.stringify(jsonOutput, null, 2));

      return {
        success: true,
        fixes: this.fixes,
        humanReview: this.issues.humanReview,
        health: { before: this.healthBefore, after: this.healthAfter }
      };

    } catch (error) {
      console.error(`❌ Auto-repair failed: ${error.message}`);
      if (this.options.verbose) {
        console.error(error.stack);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Load current health score
   */
  async loadHealth() {
    try {
      const healthFile = path.join(this.rootDir, 'gdd-health.json');
      const content = await fs.readFile(healthFile, 'utf-8');
      const data = JSON.parse(content);
      return data.average_score;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create backup before repairs
   */
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join('/tmp', 'gdd-auto-repair-backups', timestamp);

    await fs.mkdir(backupDir, { recursive: true });

    // Backup files
    const filesToBackup = [
      'spec.md',
      'docs/system-map.yaml',
      'gdd-status.json',
      'gdd-health.json',
      ...await this.getNodeFiles()
    ];

    for (const file of filesToBackup) {
      const sourcePath = path.join(this.rootDir, file);
      const destPath = path.join(backupDir, file);

      try {
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(sourcePath, destPath);
      } catch (error) {
        // File might not exist, continue
      }
    }

    // Create manifest
    const manifest = {
      timestamp: new Date().toISOString(),
      trigger: this.options.ci ? 'CI/CD' : 'manual',
      health_before: this.healthBefore,
      files: filesToBackup
    };

    await fs.writeFile(
      path.join(backupDir, 'backup-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Cleanup old backups (keep last 10)
    await this.cleanupOldBackups();

    return backupDir;
  }

  /**
   * Get all node file paths
   */
  async getNodeFiles() {
    const nodesDir = path.join(this.rootDir, 'docs', 'nodes');
    const files = await fs.readdir(nodesDir);
    return files
      .filter(f => f.endsWith('.md') && f !== 'README.md')
      .map(f => `docs/nodes/${f}`);
  }

  /**
   * Cleanup old backups
   */
  async cleanupOldBackups() {
    const backupsRoot = path.join('/tmp', 'gdd-auto-repair-backups');

    try {
      const backups = await fs.readdir(backupsRoot);
      const sorted = backups.sort().reverse(); // Newest first

      // Delete all but the 10 most recent
      for (let i = 10; i < sorted.length; i++) {
        const oldBackup = path.join(backupsRoot, sorted[i]);
        await fs.rm(oldBackup, { recursive: true, force: true });
      }
    } catch (error) {
      // Backups directory might not exist yet
    }
  }

  /**
   * Detect all issues
   */
  async detectIssues() {
    // Load all necessary data
    const nodes = await this.loadAllNodes();
    const systemMap = await this.loadSystemMap();
    const spec = await this.loadSpec();

    // Run detection rules
    await this.detectMissingMetadata(nodes);
    await this.detectOutdatedTimestamps(nodes);
    await this.detectMissingCoverage(nodes);
    await this.detectMissingAgents(nodes);
    await this.detectBrokenEdges(systemMap);
    await this.detectOrphanNodes(nodes, systemMap);
    await this.detectMissingSpecReferences(nodes, spec);
    await this.detectCoverageIntegrity(nodes);  // Phase 15.1
  }

  /**
   * Load all node files
   */
  async loadAllNodes() {
    const nodeFiles = await this.getNodeFiles();
    const nodes = {};

    for (const file of nodeFiles) {
      const filePath = path.join(this.rootDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const nodeName = path.basename(file, '.md');

      nodes[nodeName] = {
        file,
        path: filePath,
        content,
        metadata: this.parseNodeMetadata(content)
      };
    }

    return nodes;
  }

  /**
   * Parse node metadata
   */
  parseNodeMetadata(content) {
    return {
      lastUpdated: (content.match(/\*?\*?last[_\s]updated:?\*?\*?\s*(\d{4}-\d{2}-\d{2})/i) || [])[1],
      coverage: parseInt((content.match(/\*?\*?coverage:?\*?\*?\s*(\d+)%/i) || [])[1]) || null,
      hasAgents: /##\s*Agentes Relevantes/i.test(content),
      status: (content.match(/\*?\*?status:?\*?\*?\s*(\w+)/i) || [])[1],
      priority: (content.match(/\*?\*?priority:?\*?\*?\s*(\w+)/i) || [])[1],
      owner: (content.match(/\*?\*?owner:?\*?\*?\s*([^\n]+)/i) || [])[1]
    };
  }

  /**
   * Load system-map.yaml
   */
  async loadSystemMap() {
    const mapPath = path.join(this.rootDir, 'docs', 'system-map.yaml');
    const content = await fs.readFile(mapPath, 'utf-8');
    return yaml.parse(content);
  }

  /**
   * Load spec.md
   */
  async loadSpec() {
    const specPath = path.join(this.rootDir, 'spec.md');
    return await fs.readFile(specPath, 'utf-8');
  }

  /**
   * Detect missing metadata
   */
  async detectMissingMetadata(nodes) {
    for (const [nodeName, node] of Object.entries(nodes)) {
      if (!node.metadata.status) {
        this.issues.autoFixable.push({
          type: 'missing_metadata',
          node: nodeName,
          field: 'status',
          description: `${nodeName}: Missing status field`,
          fix: async () => {
            // Add default status based on node (use lowercase for consistency)
            const defaultStatus = 'production';
            node.content = this.addMetadataField(node.content, 'Status', defaultStatus);
            await fs.writeFile(node.path, node.content);
            this.fixes.push({
              node: nodeName,
              description: `Added status to ${nodeName}`
            });
          }
        });
      }
    }
  }

  /**
   * Detect outdated timestamps
   */
  async detectOutdatedTimestamps(nodes) {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    for (const [nodeName, node] of Object.entries(nodes)) {
      if (!node.metadata.lastUpdated) {
        this.issues.autoFixable.push({
          type: 'missing_timestamp',
          node: nodeName,
          description: `${nodeName}: Missing last_updated timestamp`,
          fix: async () => {
            node.content = this.addMetadataField(node.content, 'Last Updated', this.getToday());
            await fs.writeFile(node.path, node.content);
            this.fixes.push({
              node: nodeName,
              description: `Added timestamp to ${nodeName}`
            });
          }
        });
      } else {
        const lastUpdate = new Date(node.metadata.lastUpdated);
        if (lastUpdate < thirtyDaysAgo) {
          this.issues.humanReview.push({
            type: 'outdated_timestamp',
            node: nodeName,
            age: Math.floor((today - lastUpdate) / (1000 * 60 * 60 * 24)),
            description: `${nodeName}: Timestamp >30 days old (${node.metadata.lastUpdated})`
          });
        }
      }
    }
  }

  /**
   * Detect missing coverage
   */
  async detectMissingCoverage(nodes) {
    for (const [nodeName, node] of Object.entries(nodes)) {
      if (node.metadata.coverage === null) {
        this.issues.autoFixable.push({
          type: 'missing_coverage',
          node: nodeName,
          description: `${nodeName}: Missing coverage field`,
          fix: async () => {
            // Default coverage = 50%
            const coverage = 50;
            node.content = this.addMetadataField(node.content, 'Coverage', `${coverage}%`);
            await fs.writeFile(node.path, node.content);
            this.fixes.push({
              node: nodeName,
              description: `Added coverage to ${nodeName}`
            });
          }
        });
      }
    }
  }

  /**
   * Detect missing agents section
   */
  async detectMissingAgents(nodes) {
    for (const [nodeName, node] of Object.entries(nodes)) {
      if (!node.metadata.hasAgents) {
        this.issues.autoFixable.push({
          type: 'missing_agents',
          node: nodeName,
          description: `${nodeName}: Missing 'Agentes Relevantes' section`,
          fix: async () => {
            const agentsSection = this.getDefaultAgentsSection(nodeName);
            node.content = this.addAgentsSection(node.content, agentsSection);
            await fs.writeFile(node.path, node.content);
            this.fixes.push({
              node: nodeName,
              description: `Added agents section to ${nodeName}`
            });
          }
        });
      }
    }
  }

  /**
   * Detect broken bidirectional edges
   */
  async detectBrokenEdges(systemMap) {
    const nodes = systemMap.nodes || {};

    for (const [nodeName, nodeData] of Object.entries(nodes)) {
      const dependsOn = nodeData.depends_on || [];

      for (const dep of dependsOn) {
        const depNode = nodes[dep];
        if (depNode) {
          const usedBy = depNode.used_by || [];
          if (!usedBy.includes(nodeName)) {
            this.issues.autoFixable.push({
              type: 'broken_edge',
              node: dep,
              description: `${dep}: Missing reverse edge from ${nodeName}`,
              fix: async () => {
                // Add to used_by
                if (!depNode.used_by) {
                  depNode.used_by = [];
                }
                depNode.used_by.push(nodeName);
                depNode.used_by.sort();

                // Save system-map preserving comments
                const mapPath = path.join(this.rootDir, 'docs', 'system-map.yaml');
                const originalContent = await fs.readFile(mapPath, 'utf-8');
                await this.saveSystemMapPreservingComments(systemMap, originalContent);
                this.fixes.push({
                  node: nodeName,
                  description: `Restored edge: ${dep} ← ${nodeName}`
                });
              }
            });
          }
        }
      }
    }
  }

  /**
   * Detect orphan nodes
   */
  async detectOrphanNodes(nodes, systemMap) {
    const mapNodes = Object.keys(systemMap.nodes || {});

    for (const nodeName of Object.keys(nodes)) {
      if (!mapNodes.includes(nodeName)) {
        this.issues.autoFixable.push({
          type: 'orphan_node',
          node: nodeName,
          description: `${nodeName}: Not in system-map.yaml`,
          fix: async () => {
            // Add to system-map with defaults
            if (!systemMap.nodes) {
              systemMap.nodes = {};
            }
            systemMap.nodes[nodeName] = {
              description: `${nodeName} node`,
              status: 'active',
              priority: 'medium',
              owner: 'Back-end Dev',
              depends_on: [],
              used_by: []
            };

            const mapPath = path.join(this.rootDir, 'docs', 'system-map.yaml');
            const originalContent = await fs.readFile(mapPath, 'utf-8');
            await this.saveSystemMapPreservingComments(systemMap, originalContent);
            this.fixes.push({
              node: nodeName,
              description: `Added ${nodeName} to system-map.yaml`
            });
          }
        });
      }
    }
  }

  /**
   * Detect missing spec references
   */
  async detectMissingSpecReferences(nodes, spec) {
    for (const nodeName of Object.keys(nodes)) {
      const nodeRef = `docs/nodes/${nodeName}.md`;
      if (!spec.includes(nodeRef) && !spec.includes(nodeName)) {
        this.issues.humanReview.push({
          type: 'missing_spec_ref',
          node: nodeName,
          description: `${nodeName}: Not referenced in spec.md (requires manual content)`
        });
      }
    }
  }

  /**
   * Detect coverage integrity violations (Phase 15.1)
   */
  async detectCoverageIntegrity(nodes) {
    const coverageHelper = new CoverageHelper();

    for (const [nodeName, node] of Object.entries(nodes)) {
      // Extract declared coverage
      const coverageMatch = node.content.match(/\*?\*?coverage:?\*?\*?\s*(\d+)%/i);
      if (!coverageMatch) {
        continue;  // No coverage declared, skip
      }

      const declaredCoverage = parseInt(coverageMatch[1], 10);

      // Check coverage source
      const sourceMatch = node.content.match(/\*?\*?coverage\s+source:?\*?\*?\s*(auto|manual)/i);
      const coverageSource = sourceMatch ? sourceMatch[1].toLowerCase() : null;

      // If no source specified or manual, add coverage source field
      if (!coverageSource) {
        this.issues.autoFixable.push({
          type: 'missing_coverage_source',
          node: nodeName,
          description: `${nodeName}: Missing coverage source field`,
          fix: async () => {
            // Add Coverage Source: auto after Coverage field
            node.content = node.content.replace(
              /(\*?\*?coverage:?\*?\*?\s*\d+%)/i,
              '$1\n**Coverage Source:** auto'
            );
            await fs.writeFile(node.path, node.content);
            this.fixes.push({
              node: nodeName,
              description: `Added coverage source to ${nodeName}`
            });
          }
        });
      } else if (coverageSource === 'manual') {
        this.issues.autoFixable.push({
          type: 'manual_coverage_source',
          node: nodeName,
          description: `${nodeName}: Coverage source is 'manual' (should be 'auto')`,
          fix: async () => {
            // Change manual → auto
            node.content = node.content.replace(
              /(\*?\*?coverage\s+source:?\*?\*?\s*)manual/i,
              '$1auto'
            );
            await fs.writeFile(node.path, node.content);
            this.fixes.push({
              node: nodeName,
              description: `Changed coverage source to 'auto' for ${nodeName}`
            });
          }
        });
      }

      // Validate coverage authenticity
      const validation = await coverageHelper.validateCoverageAuthenticity(
        nodeName,
        declaredCoverage,
        3  // 3% tolerance
      );

      if (!validation.valid && validation.actual !== null) {
        // Coverage mismatch detected
        this.issues.autoFixable.push({
          type: 'coverage_integrity_violation',
          node: nodeName,
          severity: validation.severity,
          description: `${nodeName}: Coverage mismatch - declared ${declaredCoverage}% but actual is ${validation.actual}% (diff: ${validation.diff}%)`,
          fix: async () => {
            // Reset coverage to actual value from report
            node.content = node.content.replace(
              /(\*?\*?coverage:?\*?\*?\s*)\d+%/i,
              `$1${validation.actual}%`
            );
            await fs.writeFile(node.path, node.content);
            this.fixes.push({
              node: nodeName,
              description: `Reset coverage to ${validation.actual}% for ${nodeName} (was ${declaredCoverage}%)`
            });
          }
        });
      }
    }
  }

  /**
   * Apply all auto-fixes
   */
  async applyFixes() {
    for (const issue of this.issues.autoFixable) {
      if (issue.fix) {
        await issue.fix();
      }
    }
  }

  /**
   * Safely update system-map.yaml preserving comments
   */
  async saveSystemMapPreservingComments(systemMap, originalContent) {
    const yamlLines = yaml.stringify(systemMap).split('\n');
    const originalLines = originalContent.split('\n');

    // Preserve header comments (lines starting with #)
    const headerComments = [];
    for (const line of originalLines) {
      if (line.trim().startsWith('#') || line.trim() === '') {
        headerComments.push(line);
      } else {
        break; // Stop at first non-comment line
      }
    }

    // Combine preserved comments + new YAML
    const finalContent = headerComments.length > 0
      ? headerComments.join('\n') + '\n' + yamlLines.join('\n')
      : yamlLines.join('\n');

    const mapPath = path.join(this.rootDir, 'docs', 'system-map.yaml');
    await fs.writeFile(mapPath, finalContent);
  }

  /**
   * Validate fixes didn't break anything
   */
  async validateFixes() {
    // Re-run health scoring
    const { GDDHealthScorer } = require('./score-gdd-health.js');
    const scorer = new GDDHealthScorer({ json: true });
    const result = await scorer.score();
    this.healthAfter = result.stats.average_score;
  }

  /**
   * Rollback to backup
   */
  async rollback() {
    if (!this.backupDir) {
      throw new Error('No backup available for rollback');
    }

    const manifest = JSON.parse(
      await fs.readFile(path.join(this.backupDir, 'backup-manifest.json'), 'utf-8')
    );

    for (const file of manifest.files) {
      const sourcePath = path.join(this.backupDir, file);
      const destPath = path.join(this.rootDir, file);

      try {
        await fs.copyFile(sourcePath, destPath);
      } catch (error) {
        // File might not exist in backup
      }
    }

    // Log rollback
    const logPath = path.join(this.rootDir, 'docs', 'auto-repair-history.log');
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: 'ROLLBACK',
      reason: 'health_degraded',
      backup: this.backupDir
    };

    try {
      const existingLog = await fs.readFile(logPath, 'utf-8');
      const logs = JSON.parse(existingLog);
      logs.push(logEntry);
      await fs.writeFile(logPath, JSON.stringify(logs, null, 2));
    } catch (error) {
      await fs.writeFile(logPath, JSON.stringify([logEntry], null, 2));
    }
  }

  /**
   * Generate repair report
   */
  async generateReport() {
    const report = `# Auto-Repair Report

**Generated:** ${new Date().toISOString()}
**Triggered by:** ${this.options.ci ? 'CI/CD' : 'Manual'}
**Health Score:** ${this.healthBefore} → ${this.healthAfter || this.healthBefore} (${this.healthAfter ? (this.healthAfter - this.healthBefore > 0 ? '+' : '') + (this.healthAfter - this.healthBefore).toFixed(1) : '±0'})

## ✅ Fixes Applied (${this.fixes.length})

${this.fixes.map((fix, i) => `${i + 1}. ${fix}`).join('\n')}

## ⚠️ Pending Human Review (${this.issues.humanReview.length})

${this.issues.humanReview.map((issue, i) => `${i + 1}. **${issue.node}** - ${issue.description}`).join('\n') || 'None'}

## 🔴 Critical Issues (${this.issues.critical.length})

${this.issues.critical.map((issue, i) => `${i + 1}. **${issue.node}** - ${issue.description}`).join('\n') || 'None'}

## 📊 Results

- 🟢 Health Score: ${this.healthAfter || this.healthBefore}/100
- ⚙️ Auto-fixes: ${this.fixes.length} applied
- 📋 Issues for review: ${this.issues.humanReview.length}
- 💾 Backup: \`${this.backupDir}\`

---

**Generated by:** GDD Auto-Repair Assistant (Phase 10)
`;

    const reportPath = path.join(this.rootDir, 'docs', 'auto-repair-report.md');
    await fs.writeFile(reportPath, report);
  }

  /**
   * Update changelog
   */
  async updateChangelog() {
    const entry = `
## ${new Date().toISOString()}

**Repair ID:** ${new Date().toISOString().split('T')[0]}T${new Date().toTimeString().split(' ')[0]}Z
**Triggered by:** ${this.options.ci ? 'CI/CD' : 'Manual'}
**Nodes affected:** ${[...new Set(this.issues.autoFixable.map(i => i.node))].join(', ')}

**Fixes applied:**
${this.fixes.map(f => `- ${f}`).join('\n')}

**Outcome:**
- Health score: ${this.healthBefore} → ${this.healthAfter || this.healthBefore}
- Issues created: ${this.issues.humanReview.length} (human review)
- Backup: \`${this.backupDir}\`

---
`;

    const changelogPath = path.join(this.rootDir, 'docs', 'auto-repair-changelog.md');

    try {
      const existing = await fs.readFile(changelogPath, 'utf-8');
      // Insert after header
      const parts = existing.split('\n\n');
      parts.splice(1, 0, entry.trim());
      await fs.writeFile(changelogPath, parts.join('\n\n'));
    } catch (error) {
      // Create new changelog
      const newChangelog = `# Auto-Repair Changelog\n${entry}`;
      await fs.writeFile(changelogPath, newChangelog);
    }
  }

  /**
   * Helper: Add metadata field
   */
  addMetadataField(content, field, value) {
    // Find the metadata section (usually after title and before first ##)
    const lines = content.split('\n');
    let insertIndex = -1;

    // Look for existing metadata fields
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      if (lines[i].match(/\*\*[A-Za-z\s]+:?\*\*/)) {
        insertIndex = i + 1;
      }
    }

    if (insertIndex === -1) {
      // Insert after title (first # line)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#')) {
          insertIndex = i + 2; // After title and blank line
          break;
        }
      }
    }

    // Fallback if still not found
    if (insertIndex === -1) {
      console.warn(`⚠️  Could not find insertion point for ${field} in node`);
      // Insert at beginning after any YAML frontmatter
      let yamlEnd = 0;
      if (lines[0] === '---') {
        for (let i = 1; i < lines.length; i++) {
          if (lines[i] === '---') {
            yamlEnd = i + 1;
            break;
          }
        }
      }
      insertIndex = yamlEnd > 0 ? yamlEnd + 1 : 0;
    }

    if (insertIndex >= 0 && insertIndex <= lines.length) {
      lines.splice(insertIndex, 0, `**${field}:** ${value}`);
    } else {
      // Last resort: append at end
      console.warn(`⚠️  Using fallback: appending ${field} at end of file`);
      lines.push('', `**${field}:** ${value}`);
    }

    return lines.join('\n');
  }

  /**
   * Helper: Add agents section
   */
  addAgentsSection(content, agentsSection) {
    // Add before ## Related Nodes or at end
    if (content.includes('## Related Nodes')) {
      return content.replace('## Related Nodes', `${agentsSection}\n\n## Related Nodes`);
    } else {
      return content + '\n\n' + agentsSection;
    }
  }

  /**
   * Helper: Get default agents for node
   */
  getDefaultAgentsSection(nodeName) {
    return `## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Documentation Agent**
- **Test Engineer**
- **Backend Developer**
`;
  }

  /**
   * Helper: Get today's date
   */
  getToday() {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Parse command-line arguments and run the AutoRepairEngine with the selected options.
 *
 * Reads flags (--auto, --ci, --dry-run, --verbose/-v, --help/-h) from process.argv,
 * prints usage and exits when help is requested, constructs an AutoRepairEngine
 * with the chosen options, invokes its repair flow, and exits with status 1 when
 * running in CI mode and the repair result indicates failure.
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    auto: args.includes('--auto'),
    ci: args.includes('--ci'),
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
GDD Auto-Repair Assistant

Usage:
  node scripts/auto-repair-gdd.js [options]

Options:
  --auto          Auto-fix all issues without prompts
  --ci            CI mode (exit 1 on failure)
  --dry-run       Show what would be fixed without applying
  --verbose, -v   Show detailed output
  --help, -h      Show this help message

Examples:
  # Interactive mode
  node scripts/auto-repair-gdd.js

  # Auto-fix everything
  node scripts/auto-repair-gdd.js --auto

  # See what would be fixed
  node scripts/auto-repair-gdd.js --dry-run

  # CI/CD mode
  node scripts/auto-repair-gdd.js --ci --auto
`);
    process.exit(0);
  }

  const engine = new AutoRepairEngine(options);
  const result = await engine.repair();

  if (options.ci && !result.success) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(2);
  });
}

module.exports = { AutoRepairEngine };