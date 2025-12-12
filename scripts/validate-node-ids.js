#!/usr/bin/env node

/**
 * Validate Node IDs
 *
 * Validates that all node IDs referenced in nodes-v2 and code
 * are defined in system-map-v2.yaml. Detects legacy IDs and invalid references.
 *
 * Usage:
 *   node scripts/validate-node-ids.js --system-map=docs/system-map-v2.yaml
 *   node scripts/validate-node-ids.js --system-map docs/system-map-v2.yaml
 *   node scripts/validate-node-ids.js --ci
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const logger = require('../src/utils/logger');
const { LEGACY_IDS } = require('./shared/legacy-ids');
const { parseArgs, getOption, hasFlag } = require('./shared/cli-parser');

class NodeIDValidator {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = path.resolve(__dirname, '..');
    this.isCIMode = options.ci || false;
    this.errors = [];
    this.warnings = [];
    this.validIds = new Set();
    this.legacyIds = LEGACY_IDS;
  }

  log(message, type = 'info') {
    if (this.isCIMode && type === 'info') return;

    const prefix =
      {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌',
        step: '📊'
      }[type] || 'ℹ️';

    const formattedMessage = `${prefix} ${message}`;

    if (type === 'error') {
      logger.error(formattedMessage);
    } else if (type === 'warning') {
      logger.warn(formattedMessage);
    } else {
      logger.info(formattedMessage);
    }
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

              // Warn if subnode is not listed but parent node exists
              // This ensures we catch cases where a valid node introduces an unlisted subnode
              if (!this.validIds.has(subnodeId) && this.validIds.has(nodeId)) {
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

        const lines = content.split('\n');
        const legacyQueueIds = new Set(['generate_reply', 'billing', 'post_response']);
        const legacyNodeIds = new Set([
          'roast',
          'shield',
          'social-platforms',
          'billing',
          'analytics',
          'persona'
        ]);
        const contextTokens = [
          'job_type',
          'queueName',
          'queue',
          'queueKey',
          'queuePrefix',
          'workerType',
          'enabledWorkers',
          'workerClasses',
          'addJob',
          'rpush',
          'lpush',
          'lrange',
          'llen',
          'collectCoverageFrom',
          'affectsNodes',
          'relatedNodes',
          'requiredNodes'
        ];

        const isUsage = (line, legacyId) => {
          const literal = new RegExp(`['"\`]${legacyId}['"\`]`);
          const objectKey = new RegExp(`\\b${legacyId}\\s*:\\s`);
          const queueKey = new RegExp(`roastr:jobs:${legacyId}`);
          const jobType = new RegExp(`job_type\\s*[:=]\\s*['"\`]${legacyId}['"\`]`);
          const addJob = new RegExp(`addJob\\s*\\(\\s*['"\`]${legacyId}['"\`]`);
          const rpush = new RegExp(`rpush\\([^)]*['"\`]${legacyId}['"\`]`);
          return (
            literal.test(line) ||
            objectKey.test(line) ||
            queueKey.test(line) ||
            jobType.test(line) ||
            addJob.test(line) ||
            rpush.test(line)
          );
        };

        lines.forEach((line, idx) => {
          const hasContextToken = contextTokens.some((token) => line.includes(token));
          if (!hasContextToken) return;

          legacyQueueIds.forEach((legacyId) => {
            if (isUsage(line, legacyId)) {
              this.errors.push({
                type: 'legacy_id_in_code',
                location: `${relativePath}:${idx + 1}`,
                message: `Legacy queue ID "${legacyId}" found in code. Must use v2 equivalent.`
              });
            }
          });

          legacyNodeIds.forEach((legacyId) => {
            if (isUsage(line, legacyId)) {
              this.errors.push({
                type: 'legacy_id_in_code',
                location: `${relativePath}:${idx + 1}`,
                message: `Legacy node ID "${legacyId}" found in code. Must use v2 equivalent.`
              });
            }
          });
        });
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
  const parsed = parseArgs(args);
  const options = {
    ci: hasFlag(parsed, 'ci'),
    systemMap: getOption(parsed, 'system-map')
  };

  const validator = new NodeIDValidator(options);
  validator.validate().catch((error) => {
    logger.error(`Fatal error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  });
}

module.exports = { NodeIDValidator };
