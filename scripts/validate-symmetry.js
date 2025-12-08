#!/usr/bin/env node

/**
 * Validate System-Map Symmetry
 *
 * Validates that depends_on and required_by relationships are symmetric
 * in system-map-v2.yaml.
 *
 * Usage:
 *   node scripts/validate-symmetry.js --system-map docs/system-map-v2.yaml
 *   node scripts/validate-symmetry.js --ci
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

class SymmetryValidator {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = path.resolve(__dirname, '..');
    this.isCIMode = options.ci || false;
    this.errors = [];
    this.warnings = [];
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
      this.log('🔍 Validating system-map symmetry...', 'step');
      this.log('');

      // Load system-map-v2.yaml
      const systemMap = await this.loadSystemMap();
      if (!systemMap) {
        this.log('❌ system-map-v2.yaml not found', 'error');
        if (this.isCIMode) process.exit(1);
        return { valid: false, errors: ['system-map-v2.yaml not found'] };
      }

      // Validate symmetry
      this.validateSymmetry(systemMap);

      // Print summary
      this.printSummary();

      // Exit code for CI
      if (this.isCIMode && this.errors.length > 0) {
        process.exit(1);
      }

      return {
        valid: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings
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

  validateSymmetry(systemMap) {
    if (!systemMap.nodes) {
      this.warnings.push({
        type: 'no_nodes',
        message: 'No nodes found in system-map-v2.yaml'
      });
      return;
    }

    const nodes = systemMap.nodes;
    const nodeIds = Object.keys(nodes);

    // Build dependency maps
    const dependsOnMap = {};
    const requiredByMap = {};

    // Initialize maps
    nodeIds.forEach((id) => {
      dependsOnMap[id] = new Set();
      requiredByMap[id] = new Set();
    });

    // Populate maps from node definitions
    for (const [nodeId, nodeData] of Object.entries(nodes)) {
      if (nodeData.depends_on) {
        const deps = Array.isArray(nodeData.depends_on)
          ? nodeData.depends_on
          : [nodeData.depends_on];

        deps.forEach((dep) => {
          dependsOnMap[nodeId].add(dep);
        });
      }

      if (nodeData.required_by) {
        const reqs = Array.isArray(nodeData.required_by)
          ? nodeData.required_by
          : [nodeData.required_by];

        reqs.forEach((req) => {
          requiredByMap[nodeId].add(req);
        });
      }
    }

    // Validate symmetry: if A depends_on B, then B should have A in required_by
    for (const [nodeId, deps] of Object.entries(dependsOnMap)) {
      deps.forEach((depId) => {
        if (!nodeIds.includes(depId)) {
          this.errors.push({
            type: 'invalid_dependency',
            location: `docs/system-map-v2.yaml (node: ${nodeId})`,
            message: `Node "${nodeId}" depends on "${depId}" which does not exist`
          });
          return;
        }

        // Check symmetry: depId should have nodeId in required_by
        if (!requiredByMap[depId].has(nodeId)) {
          this.errors.push({
            type: 'asymmetric_relationship',
            location: `docs/system-map-v2.yaml (node: ${nodeId})`,
            message: `Asymmetric relationship: "${nodeId}" depends_on "${depId}" but "${depId}" does not have "${nodeId}" in required_by`
          });
        }
      });
    }

    // Validate reverse: if A has B in required_by, then B should depend_on A
    for (const [nodeId, reqs] of Object.entries(requiredByMap)) {
      reqs.forEach((reqId) => {
        if (!nodeIds.includes(reqId)) {
          this.errors.push({
            type: 'invalid_requirement',
            location: `docs/system-map-v2.yaml (node: ${nodeId})`,
            message: `Node "${nodeId}" requires "${reqId}" which does not exist`
          });
          return;
        }

        // Check symmetry: reqId should have nodeId in depends_on
        if (!dependsOnMap[reqId].has(nodeId)) {
          this.errors.push({
            type: 'asymmetric_relationship',
            location: `docs/system-map-v2.yaml (node: ${nodeId})`,
            message: `Asymmetric relationship: "${nodeId}" has "${reqId}" in required_by but "${reqId}" does not depend_on "${nodeId}"`
          });
        }
      });
    }

    // Check for cycles
    this.detectCycles(dependsOnMap, nodeIds);
  }

  detectCycles(dependsOnMap, nodeIds) {
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (nodeId) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const deps = dependsOnMap[nodeId] || new Set();
      for (const depId of deps) {
        if (!visited.has(depId)) {
          if (hasCycle(depId)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          // Cycle detected
          this.errors.push({
            type: 'circular_dependency',
            location: `docs/system-map-v2.yaml`,
            message: `Circular dependency detected involving "${nodeId}" and "${depId}"`
          });
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        hasCycle(nodeId);
      }
    }
  }

  printSummary() {
    this.log('');
    this.log('📊 Symmetry Validation Summary', 'step');
    this.log('');

    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log('✅ All relationships are symmetric!', 'success');
      return;
    }

    if (this.errors.length > 0) {
      this.log(`❌ Found ${this.errors.length} error(s):`, 'error');
      this.errors.forEach((error, idx) => {
        this.log(`   ${idx + 1}. [${error.type}] ${error.location}`, 'error');
        this.log(`      ${error.message}`, 'error');
      });
      this.log('');
    }

    if (this.warnings.length > 0) {
      this.log(`⚠️  Found ${this.warnings.length} warning(s):`, 'warning');
      this.warnings.forEach((warning, idx) => {
        this.log(`   ${idx + 1}. [${warning.type}]`, 'warning');
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

  const validator = new SymmetryValidator(options);
  validator.validate().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { SymmetryValidator };
