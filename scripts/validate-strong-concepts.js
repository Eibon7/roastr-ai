#!/usr/bin/env node

/**
 * Validate Strong Concepts
 *
 * Validates that Strong Concepts are not duplicated and have a single owner.
 * Ensures Soft Concepts can appear in multiple nodes without duplication.
 *
 * Usage:
 *   node scripts/validate-strong-concepts.js --system-map=docs/system-map-v2.yaml --nodes=docs/nodes-v2/
 *   node scripts/validate-strong-concepts.js --system-map docs/system-map-v2.yaml --nodes docs/nodes-v2/
 *   node scripts/validate-strong-concepts.js --ci
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const logger = require('../src/utils/logger');
const { parseArgs, getOption, hasFlag } = require('./shared/cli-parser');

class StrongConceptsValidator {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = path.resolve(__dirname, '..');
    this.isCIMode = options.ci || false;
    this.errors = [];
    this.warnings = [];
    this.strongConcepts = new Map(); // concept -> owner node
    this.knownStrongConcepts = [
      'Persona',
      'Tones',
      'Prompt Architecture',
      'Workers oficiales SSOT',
      'Shield thresholds & weights',
      'Billing state machine',
      'SSOT loader & feature flags',
      'Queue system & RLS',
      'Platform constraints',
      'GDPR retention rules'
    ];
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
      this.log('🔍 Validating Strong Concepts...', 'step');
      this.log('');

      // Load system-map-v2.yaml
      const systemMap = await this.loadSystemMap();
      if (!systemMap) {
        this.log('❌ system-map-v2.yaml not found', 'error');
        if (this.isCIMode) process.exit(1);
        return { valid: false, errors: ['system-map-v2.yaml not found'] };
      }

      // Extract Strong Concepts from system-map
      this.extractStrongConcepts(systemMap);

      // Validate nodes-v2 for Strong Concept violations
      await this.validateNodesV2();

      // Print summary
      this.printSummary();

      // Exit code for CI
      if (this.isCIMode && this.errors.length > 0) {
        process.exit(1);
      }

      return {
        valid: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings,
        strongConcepts: Object.fromEntries(this.strongConcepts)
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

  extractStrongConcepts(systemMap) {
    if (!systemMap.nodes) return;

    for (const [nodeId, nodeData] of Object.entries(systemMap.nodes)) {
      if (nodeData.strong_concept) {
        const concept = nodeData.strong_concept;

        // Check if concept already has an owner
        if (this.strongConcepts.has(concept)) {
          const existingOwner = this.strongConcepts.get(concept);
          this.errors.push({
            type: 'duplicate_strong_concept',
            location: `docs/system-map-v2.yaml (node: ${nodeId})`,
            message: `Strong Concept "${concept}" is already owned by "${existingOwner}". Strong Concepts can only have one owner.`
          });
        } else {
          this.strongConcepts.set(concept, nodeId);
        }
      }
    }

    this.log(`   ✅ Found ${this.strongConcepts.size} Strong Concept owner(s)`, 'success');
  }

  async validateNodesV2() {
    const nodesV2Dir = this.options.nodes || path.join(this.rootDir, 'docs', 'nodes-v2');

    try {
      const entries = await fs.readdir(nodesV2Dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const nodeDir = path.join(nodesV2Dir, entry.name);
          const subnodes = await fs.readdir(nodeDir);

          for (const subnodeFile of subnodes) {
            if (subnodeFile.endsWith('.md')) {
              const subnodePath = path.join(nodeDir, subnodeFile);
              const content = await fs.readFile(subnodePath, 'utf-8');

              // Check for Strong Concept definitions
              this.checkStrongConceptDefinitions(content, entry.name, subnodeFile);
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

  checkStrongConceptDefinitions(content, nodeId, subnodeFile) {
    const relativePath = `docs/nodes-v2/${nodeId}/${subnodeFile}`;

    // Check for known Strong Concepts being defined
    this.knownStrongConcepts.forEach((concept) => {
      // Look for section headers that suggest definition (not just reference)
      const definitionPatterns = [
        new RegExp(`##\\s+${concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+Configuration`, 'i'),
        new RegExp(`##\\s+${concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+Definition`, 'i'),
        new RegExp(`##\\s+Defining\\s+${concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
      ];

      const isDefinition = definitionPatterns.some((pattern) => pattern.test(content));

      if (isDefinition) {
        // Check if this node owns the concept
        const owner = this.strongConcepts.get(concept);

        if (!owner) {
          this.warnings.push({
            type: 'strong_concept_not_in_system_map',
            location: relativePath,
            message: `Strong Concept "${concept}" is defined but not listed in system-map-v2.yaml`
          });
        } else if (owner !== nodeId) {
          this.errors.push({
            type: 'strong_concept_redefinition',
            location: relativePath,
            message: `Strong Concept "${concept}" is being redefined. It is owned by "${owner}" according to system-map-v2.yaml. This node should only reference it, not redefine it.`
          });
        }
      }
    });
  }

  printSummary() {
    this.log('');
    this.log('📊 Strong Concepts Validation Summary', 'step');
    this.log('');

    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log('✅ All Strong Concepts are properly owned!', 'success');
      this.log('');
      this.log('Strong Concept Owners:', 'info');
      this.strongConcepts.forEach((owner, concept) => {
        this.log(`   • ${concept} → ${owner}`, 'info');
      });
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
    systemMap: getOption(parsed, 'system-map'),
    nodes: getOption(parsed, 'nodes')
  };

  const validator = new StrongConceptsValidator(options);
  validator.validate().catch((error) => {
    logger.error(`Fatal error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  });
}

module.exports = { StrongConceptsValidator };
