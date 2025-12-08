#!/usr/bin/env node

/**
 * Validate Node IDs
 *
 * Validates that all node IDs referenced in nodes-v2 and code
 * are defined in system-map-v2.yaml. Detects legacy IDs and invalid references.
 *
 * Usage:
 *   node scripts/validate-node-ids.js --system-map docs/system-map-v2.yaml
 *   node scripts/validate-node-ids.js --ci
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

class NodeIDValidator {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = path.resolve(__dirname, '..');
    this.isCIMode = options.ci || false;
    this.errors = [];
    this.warnings = [];
    this.validIds = new Set();
    this.legacyIds = new Set([
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
  }

  log(message, type = 'info') {
    const prefix =
      {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌',
        step: '📊'
      }[type] || 'ℹ️';

    if (this.isCIMode && type === 'info') return;
    console.log(`${prefix} ${message}`);
  }

  async validate() {
    try {
      this.log('🔍 Validating Node IDs...', 'step');
      this.log('');

      // Load system-map-v2.yaml
      const systemMap = await this.loadSystemMap();
      if (!systemMap) {
        this.log('❌ system-map-v2.yaml not found', 'error');
        if (this.isCIMode) process.exit(1);
        return { valid: false, errors: ['system-map-v2.yaml not found'] };
      }

      // Extract valid IDs from system-map
      this.extractValidIds(systemMap);

      // Validate nodes-v2 directory
      await this.validateNodesV2();

      // Validate code references
      await this.validateCodeReferences();

      // Check for legacy IDs
      this.checkLegacyIds();

      // Print summary
      this.printSummary();

      // Exit code for CI
      if (this.isCIMode && (this.errors.length > 0 || this.warnings.length > 0)) {
        process.exit(1);
      }

      return {
        valid: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings,
        validIds: Array.from(this.validIds)
      };
    } catch (error) {
      this.log(`❌ Validation failed: ${error.message}`, 'error');
      if (this.isCIMode) process.exit(1);
      throw error;
    }
  }

  async loadSystemMap() {
    const systemMapPath =
      this.options.systemMap || path.join(this.rootDir, 'docs', 'system-map-v2.yaml');

    try {
      const content = await fs.readFile(systemMapPath, 'utf-8');
      const map = yaml.parse(content);
      this.log(`   ✅ Loaded system-map-v2.yaml`, 'success');
      return map;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.log(`   ⚠️  system-map-v2.yaml not found at ${systemMapPath}`, 'warning');
        return null;
      }
      throw error;
    }
  }

  extractValidIds(systemMap) {
    if (!systemMap.nodes) return;

    for (const [nodeId, nodeData] of Object.entries(systemMap.nodes)) {
      this.validIds.add(nodeId);

      // Also check subnodes if they exist
      if (nodeData.subnodes) {
        for (const subnode of nodeData.subnodes) {
          // Subnodes are typically referenced as <node>/<subnode>
          this.validIds.add(`${nodeId}/${subnode}`);
        }
      }
    }

    this.log(`   ✅ Found ${this.validIds.size} valid node IDs`, 'success');
  }

  async validateNodesV2() {
    const nodesV2Dir = path.join(this.rootDir, 'docs', 'nodes-v2');

    try {
      const entries = await fs.readdir(nodesV2Dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const nodeId = entry.name;

          // Check if node ID is valid
          if (!this.validIds.has(nodeId)) {
            this.errors.push({
              type: 'invalid_node_id',
              location: `docs/nodes-v2/${nodeId}/`,
              message: `Node ID "${nodeId}" not found in system-map-v2.yaml`
            });
          }

          // Check subnodes
          const subnodesDir = path.join(nodesV2Dir, nodeId);
          const subnodes = await fs.readdir(subnodesDir);

          for (const subnodeFile of subnodes) {
            if (subnodeFile.endsWith('.md')) {
              const subnodeName = subnodeFile.replace('.md', '');
              const subnodeId = `${nodeId}/${subnodeName}`;

              if (!this.validIds.has(subnodeId) && !this.validIds.has(nodeId)) {
                this.warnings.push({
                  type: 'subnode_not_in_system_map',
                  location: `docs/nodes-v2/${nodeId}/${subnodeFile}`,
                  message: `Subnode "${subnodeId}" not explicitly listed in system-map-v2.yaml`
                });
              }
            }
          }
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.log('   ⚠️  docs/nodes-v2/ not found', 'warning');
        return;
      }
      throw error;
    }
  }

  async validateCodeReferences() {
    const srcDir = path.join(this.rootDir, 'src');

    try {
      const files = await this.getAllFiles(srcDir);

      for (const file of files) {
        if (
          !file.endsWith('.js') &&
          !file.endsWith('.ts') &&
          !file.endsWith('.jsx') &&
          !file.endsWith('.tsx')
        ) {
          continue;
        }

        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(this.rootDir, file);

        // Look for node ID references (simple pattern matching)
        const nodeIdPattern = /['"`]([a-z-]+(?:-[a-z-]+)*)['"`]/g;
        let match;

        while ((match = nodeIdPattern.exec(content)) !== null) {
          const potentialId = match[1];

          // Check if it's a legacy ID
          if (this.legacyIds.has(potentialId)) {
            this.errors.push({
              type: 'legacy_id_in_code',
              location: relativePath,
              line: this.getLineNumber(content, match.index),
              message: `Legacy ID "${potentialId}" found in code. Must use v2 equivalent.`
            });
          }
        }
      }
    } catch (error) {
      // Ignore if src directory doesn't exist
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  checkLegacyIds() {
    // This is handled in validateCodeReferences, but we can add additional checks here
    this.log('   ✅ Checked for legacy IDs', 'success');
  }

  async getAllFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules and other ignored directories
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  printSummary() {
    this.log('');
    this.log('📊 Validation Summary', 'step');
    this.log('');

    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log('✅ All node IDs are valid!', 'success');
      return;
    }

    if (this.errors.length > 0) {
      this.log(`❌ Found ${this.errors.length} error(s):`, 'error');
      this.errors.forEach((error, idx) => {
        this.log(
          `   ${idx + 1}. [${error.type}] ${error.location}${error.line ? `:${error.line}` : ''}`,
          'error'
        );
        this.log(`      ${error.message}`, 'error');
      });
      this.log('');
    }

    if (this.warnings.length > 0) {
      this.log(`⚠️  Found ${this.warnings.length} warning(s):`, 'warning');
      this.warnings.forEach((warning, idx) => {
        this.log(`   ${idx + 1}. [${warning.type}] ${warning.location}`, 'warning');
        this.log(`      ${warning.message}`, 'warning');
      });
      this.log('');
    }
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    ci: args.includes('--ci'),
    systemMap: args.find((arg) => arg.startsWith('--system-map='))?.split('=')[1]
  };

  const validator = new NodeIDValidator(options);
  validator.validate().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { NodeIDValidator };
