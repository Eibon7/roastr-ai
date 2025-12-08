#!/usr/bin/env node

/**
 * Check System Map Drift
 *
 * Verifies consistency between system-map-v2.yaml and nodes-v2/ directory.
 * Ensures:
 * 1. All nodes in nodes-v2/ exist in system-map
 * 2. All nodes in system-map have their file in nodes-v2
 * 3. depends_on and required_by are symmetric
 * 4. No legacy v1 nodes exist
 * 5. No legacy workers exist
 * 6. No orphaned .md files outside system-map
 *
 * Usage:
 *   node scripts/check-system-map-drift.js --system-map docs/system-map-v2.yaml --nodes docs/nodes-v2/
 *   node scripts/check-system-map-drift.js --ci
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

class SystemMapDriftChecker {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = path.resolve(__dirname, '..');
    this.isCIMode = options.ci || false;
    this.errors = [];
    this.warnings = [];
    this.systemMapNodes = new Set();
    this.nodesV2Files = new Set();
  }

  log(message, type = 'info') {
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      step: '📊'
    }[type] || 'ℹ️';

    if (this.isCIMode && type === 'info') return;
    console.log(`${prefix} ${message}`);
  }

  async check() {
    try {
      this.log('🔍 Checking system-map drift...', 'step');
      this.log('');

      // Load system-map-v2.yaml
      const systemMap = await this.loadSystemMap();
      if (!systemMap) {
        this.log('❌ system-map-v2.yaml not found', 'error');
        if (this.isCIMode) process.exit(1);
        return { valid: false, errors: ['system-map-v2.yaml not found'] };
      }

      // Load nodes-v2 directory
      const nodesV2Dir = path.join(this.rootDir, 'docs', 'nodes-v2');
      const nodesV2Files = await this.loadNodesV2Files(nodesV2Dir);

      // Extract node IDs from system-map
      const systemMapNodeIds = Object.keys(systemMap.nodes || {});

      // Check 1: All nodes in nodes-v2/ exist in system-map
      await this.checkNodesV2InSystemMap(nodesV2Files, systemMapNodeIds);

      // Check 2: All nodes in system-map have their file in nodes-v2
      await this.checkSystemMapNodesInV2(systemMapNodeIds, nodesV2Files, systemMap);

      // Check 3: depends_on and required_by are symmetric
      await this.checkSymmetry(systemMap);

      // Check 4: No legacy v1 nodes exist
      await this.checkLegacyNodes(systemMapNodeIds);

      // Check 5: No legacy workers exist
      await this.checkLegacyWorkers(systemMap);

      // Check 6: No orphaned .md files
      await this.checkOrphanedFiles(nodesV2Dir, systemMapNodeIds);

      // Generate report
      const valid = this.errors.length === 0;
      this.printSummary(valid);

      if (this.isCIMode && !valid) {
        process.exit(1);
      }

      return { valid, errors: this.errors, warnings: this.warnings };
    } catch (error) {
      this.log(`❌ Check failed: ${error.message}`, 'error');
      if (this.isCIMode) process.exit(1);
      throw error;
    }
  }

  async loadSystemMap() {
    const systemMapPath = path.join(this.rootDir, 'docs', 'system-map-v2.yaml');
    try {
      const content = await fs.readFile(systemMapPath, 'utf-8');
      return yaml.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.log('❌ system-map-v2.yaml not found', 'error');
        return null;
      }
      throw error;
    }
  }

  async loadNodesV2Files(nodesV2Dir) {
    const files = new Set();
    try {
      const entries = await fs.readdir(nodesV2Dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          // Extract node ID from filename
          // Format: <node-id>.md or <number>-<node-id>.md
          const nodeId = entry.name
            .replace(/^\d+-/, '') // Remove leading number-
            .replace(/\.md$/, ''); // Remove .md extension
          files.add(nodeId);
        } else if (entry.isDirectory()) {
          // Handle subdirectories (subnodes)
          const subFiles = await fs.readdir(path.join(nodesV2Dir, entry.name), { withFileTypes: true });
          for (const subFile of subFiles) {
            if (subFile.isFile() && subFile.name.endsWith('.md')) {
              const nodeId = entry.name; // Directory name is the node ID
              files.add(nodeId);
            }
          }
        }
      }
      
      return files;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.log('⚠️ docs/nodes-v2/ directory not found', 'warning');
        return new Set();
      }
      throw error;
    }
  }

  async checkNodesV2InSystemMap(nodesV2Files, systemMapNodeIds) {
    this.log('Checking nodes-v2 files exist in system-map...', 'info');
    
    const systemMapSet = new Set(systemMapNodeIds);
    let foundIssues = false;

    for (const nodeId of nodesV2Files) {
      if (!systemMapSet.has(nodeId)) {
        this.errors.push(`Node "${nodeId}" exists in nodes-v2/ but not in system-map-v2.yaml`);
        foundIssues = true;
      }
    }

    if (!foundIssues) {
      this.log('✅ All nodes-v2 files exist in system-map', 'success');
    }
  }

  async checkSystemMapNodesInV2(systemMapNodeIds, nodesV2Files, systemMap) {
    this.log('Checking system-map nodes have files in nodes-v2...', 'info');
    
    let foundIssues = false;

    for (const nodeId of systemMapNodeIds) {
      const nodeData = systemMap.nodes[nodeId];
      const docs = nodeData?.docs || [];
      
      // Check if node has a doc file in nodes-v2
      const hasDocInV2 = docs.some(doc => doc.includes('nodes-v2/'));
      
      // Also check if nodeId exists in nodesV2Files
      const existsInV2 = nodesV2Files.has(nodeId);
      
      if (!hasDocInV2 && !existsInV2) {
        this.errors.push(`Node "${nodeId}" exists in system-map-v2.yaml but has no file in nodes-v2/`);
        foundIssues = true;
      }
    }

    if (!foundIssues) {
      this.log('✅ All system-map nodes have files in nodes-v2', 'success');
    }
  }

  async checkSymmetry(systemMap) {
    this.log('Checking depends_on and required_by symmetry...', 'info');
    
    const nodes = systemMap.nodes || {};
    let foundIssues = false;

    for (const [nodeId, nodeData] of Object.entries(nodes)) {
      const dependsOn = nodeData.depends_on || [];
      const requiredBy = nodeData.required_by || [];

      // Check: If A depends_on B, then B should have A in required_by
      for (const dep of dependsOn) {
        const depNode = nodes[dep];
        if (!depNode) {
          this.errors.push(`Node "${nodeId}" depends_on "${dep}" but "${dep}" does not exist`);
          foundIssues = true;
          continue;
        }

        const depRequiredBy = depNode.required_by || [];
        if (!depRequiredBy.includes(nodeId)) {
          this.errors.push(`Node "${nodeId}" depends_on "${dep}" but "${dep}" does not have "${nodeId}" in required_by`);
          foundIssues = true;
        }
      }

      // Check: If A has B in required_by, then B should have A in depends_on
      for (const req of requiredBy) {
        const reqNode = nodes[req];
        if (!reqNode) {
          this.errors.push(`Node "${nodeId}" has "${req}" in required_by but "${req}" does not exist`);
          foundIssues = true;
          continue;
        }

        const reqDependsOn = reqNode.depends_on || [];
        if (!reqDependsOn.includes(nodeId)) {
          this.errors.push(`Node "${nodeId}" has "${req}" in required_by but "${req}" does not have "${nodeId}" in depends_on`);
          foundIssues = true;
        }
      }
    }

    if (!foundIssues) {
      this.log('✅ Symmetry check passed', 'success');
    }
  }

  async checkLegacyNodes(systemMapNodeIds) {
    this.log('Checking for legacy v1 nodes...', 'info');
    
    const legacyIds = new Set([
      'roast',
      'shield',
      'social-platforms',
      'frontend-dashboard',
      'plan-features',
      'persona',
      'billing',
      'cost-control',
      'queue-system',
      'multi-tenant',
      'observability',
      'analytics',
      'trainer',
      'guardian'
    ]);

    let foundIssues = false;

    for (const nodeId of systemMapNodeIds) {
      if (legacyIds.has(nodeId)) {
        this.errors.push(`Legacy v1 node "${nodeId}" detected in system-map-v2.yaml`);
        foundIssues = true;
      }
    }

    if (!foundIssues) {
      this.log('✅ No legacy v1 nodes detected', 'success');
    }
  }

  async checkLegacyWorkers(systemMap) {
    this.log('Checking for legacy workers...', 'info');
    
    const nodes = systemMap.nodes || {};
    const legacyWorkers = new Set([
      'FetchCommentsWorker',
      'AnalyzeToxicityWorker',
      'GenerateReplyWorker',
      'ShieldActionWorker',
      'BaseWorker'
    ]);

    let foundIssues = false;

    for (const [nodeId, nodeData] of Object.entries(nodes)) {
      const workers = nodeData.workers || [];
      
      for (const worker of workers) {
        if (legacyWorkers.has(worker)) {
          this.warnings.push(`Node "${nodeId}" uses legacy worker "${worker}" (should use v2_* workers)`);
          foundIssues = true;
        }
      }
    }

    if (!foundIssues) {
      this.log('✅ No legacy workers detected', 'success');
    }
  }

  async checkOrphanedFiles(nodesV2Dir, systemMapNodeIds) {
    this.log('Checking for orphaned .md files...', 'info');
    
    const systemMapSet = new Set(systemMapNodeIds);
    let foundIssues = false;

    try {
      const entries = await fs.readdir(nodesV2Dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const nodeId = entry.name
            .replace(/^\d+-/, '')
            .replace(/\.md$/, '');
          
          // Skip README and other non-node files
          if (nodeId.toLowerCase() === 'readme' || 
              nodeId.toLowerCase().includes('generation') ||
              nodeId.toLowerCase().includes('validation') ||
              nodeId.toLowerCase().includes('checklist') ||
              nodeId.toLowerCase().includes('corrections')) {
            continue;
          }
          
          if (!systemMapSet.has(nodeId)) {
            this.warnings.push(`Orphaned file "${entry.name}" in nodes-v2/ (not referenced in system-map-v2.yaml)`);
            foundIssues = true;
          }
        }
      }
    } catch (error) {
      // Directory might not exist, that's okay
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    if (!foundIssues) {
      this.log('✅ No orphaned files detected', 'success');
    }
  }

  printSummary(valid) {
    this.log('');
    this.log('📊 Summary', 'step');
    this.log('');

    if (this.errors.length > 0) {
      this.log(`❌ Found ${this.errors.length} error(s):`, 'error');
      this.errors.forEach((error, index) => {
        this.log(`  ${index + 1}. ${error}`, 'error');
      });
    }

    if (this.warnings.length > 0) {
      this.log(`⚠️ Found ${this.warnings.length} warning(s):`, 'warning');
      this.warnings.forEach((warning, index) => {
        this.log(`  ${index + 1}. ${warning}`, 'warning');
      });
    }

    if (valid) {
      this.log('✅ System-map drift check passed', 'success');
    } else {
      this.log('❌ System-map drift check failed', 'error');
    }
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    ci: args.includes('--ci')
  };

  const checker = new SystemMapDriftChecker(options);
  checker.check().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { SystemMapDriftChecker };

