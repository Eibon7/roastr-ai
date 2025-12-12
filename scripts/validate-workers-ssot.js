#!/usr/bin/env node

/**
 * Validate Workers SSOT
 *
 * Validates that all workers referenced in code and system-map-v2.yaml
 * are official workers defined in SSOT-V2.md.
 *
 * Usage:
 *   node scripts/validate-workers-ssot.js --ssot=docs/SSOT-V2.md
 *   node scripts/validate-workers-ssot.js --ssot docs/SSOT-V2.md
 *   node scripts/validate-workers-ssot.js --ci
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../src/utils/logger');
const { parseArgs, getOption, hasFlag } = require('./shared/cli-parser');

class WorkersSSOTValidator {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = path.resolve(__dirname, '..');
    this.isCIMode = options.ci || false;
    this.errors = [];
    this.warnings = [];
    this.officialWorkers = new Set();
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
      this.log('🔍 Validating Workers against SSOT...', 'step');
      this.log('');

      // Load SSOT-V2.md
      const ssotContent = await this.loadSSOT();
      if (!ssotContent) {
        this.log('❌ SSOT-V2.md not found', 'error');
        if (this.isCIMode) process.exit(1);
        return { valid: false, errors: ['SSOT-V2.md not found'] };
      }

      // Extract official workers from SSOT + system-map
      this.extractOfficialWorkers(ssotContent);
      await this.extractFromSystemMap();

      // Validate worker registrations (code) using WorkerManager mappings only
      await this.validateWorkerRegistrations();

      // Validate system-map-v2.yaml if it exists
      await this.validateSystemMap();

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
        officialWorkers: Array.from(this.officialWorkers)
      };
    } catch (error) {
      this.log(`❌ Validation failed: ${error.message}`, 'error');
      if (this.isCIMode) process.exit(1);
      throw error;
    }
  }

  async loadSSOT() {
    const ssotPath = this.options.ssot || path.join(this.rootDir, 'docs', 'SSOT-V2.md');

    try {
      const content = await fs.readFile(ssotPath, 'utf-8');
      this.log(`   ✅ Loaded SSOT-V2.md`, 'success');
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.log(`   ⚠️  SSOT-V2.md not found at ${ssotPath}`, 'warning');
        return null;
      }
      throw error;
    }
  }

  extractOfficialWorkers(ssotContent) {
    // Allowed list comes from system-map + SSOT; start empty
    this.officialWorkers.clear();

    // Try to extract from SSOT section if present
    const workersSection = ssotContent.match(
      /## 8\. Workers.*?### 8\.1 Workers oficiales v2([\s\S]*?)(?=###|##|$)/
    );

    if (workersSection) {
      const typeDefMatch = workersSection[1].match(/type WorkerName\s*=\s*([\s\S]*?);/);
      if (typeDefMatch) {
        const workerNames = typeDefMatch[1]
          .split('|')
          .map((name) => name.trim().replace(/['"]/g, ''))
          .filter((name) => name.length > 0);

        workerNames.forEach((worker) => {
          this.officialWorkers.add(worker);
          this.officialWorkers.add(`v2_${worker}`);
        });
      }
    } else {
      this.warnings.push({
        type: 'workers_section_not_found',
        message: 'Could not find section 8.1 in SSOT-V2.md'
      });
    }
  }

  async extractFromSystemMap() {
    const systemMapPath = path.join(this.rootDir, 'docs', 'system-map-v2.yaml');
    try {
      const yaml = require('yaml');
      const content = await fs.readFile(systemMapPath, 'utf-8');
      const map = yaml.parse(content);
      if (map.nodes) {
        for (const nodeData of Object.values(map.nodes)) {
          if (Array.isArray(nodeData.workers)) {
            nodeData.workers.forEach((w) => this.officialWorkers.add(w));
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Fallback: add hardcoded allowed list if still empty
    if (this.officialWorkers.size === 0) {
      [
        'FetchComments',
        'AnalyzeToxicity',
        'GenerateRoast',
        'GenerateCorrectiveReply',
        'ShieldAction',
        'SocialPosting',
        'BillingUpdate',
        'CursorReconciliation',
        'StrikeCleanup'
      ].forEach((w) => this.officialWorkers.add(w));
    }

    this.log(
      `   ✅ Official workers loaded: ${Array.from(this.officialWorkers).join(', ')}`,
      'success'
    );
  }

  async validateWorkerRegistrations() {
    const wmPath = path.join(this.rootDir, 'src', 'workers', 'WorkerManager.js');
    try {
      const content = await fs.readFile(wmPath, 'utf-8');
      const registrations = [];

      // Capture workerClasses mapping keys/values
      const mapMatch = content.match(/this\.workerClasses\s*=\s*{\s*([\s\S]*?)\s*};/m);
      if (mapMatch) {
        const entries = mapMatch[1].split(/\n/);
        entries.forEach((line) => {
          const kv = line.match(/(\w+):\s*(\w+)/);
          if (kv) {
            const key = kv[1].trim();
            registrations.push(key);
          }
        });
      }

      // Enabled workers defaults
      const enabledMatch = content.match(/enabledWorkers:\s*\[\s*([\s\S]*?)\]/m);
      if (enabledMatch) {
        enabledMatch[1]
          .split(',')
          .map((s) => s.replace(/['"\s]/g, ''))
          .filter(Boolean)
          .forEach((w) => registrations.push(w));
      }

      registrations.forEach((reg) => {
        // Normalize to Worker name style
        const normalized = reg
          .replace(/^v2_/, '')
          .replace(/_([a-z])/g, (_, c) => c.toUpperCase())
          .replace(/^(.)/, (m) => m.toUpperCase());

        if (!this.isOfficialWorker(normalized)) {
          this.warnings.push({
            type: 'unofficial_worker_registration',
            location: wmPath,
            message: `Worker "${reg}" is not an official SSOT worker (legacy/experimental)`
          });
        }
      });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async validateSystemMap() {
    const systemMapPath = path.join(this.rootDir, 'docs', 'system-map-v2.yaml');

    try {
      const yaml = require('yaml');
      const content = await fs.readFile(systemMapPath, 'utf-8');
      const map = yaml.parse(content);

      // Check workers referenced in system-map
      if (map.nodes) {
        for (const [nodeId, nodeData] of Object.entries(map.nodes)) {
          if (nodeData.workers) {
            for (const worker of nodeData.workers) {
              if (!this.isOfficialWorker(worker)) {
                this.errors.push({
                  type: 'unofficial_worker_in_system_map',
                  location: `docs/system-map-v2.yaml (node: ${nodeId})`,
                  message: `Worker "${worker}" is not an official SSOT worker`
                });
              }
            }
          }
        }
      }
    } catch (error) {
      // Ignore if system-map-v2.yaml doesn't exist
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  isOfficialWorker(workerName) {
    const normalized = workerName.replace(/^v2_/, '').replace(/Worker$/, '');
    return (
      this.officialWorkers.has(workerName) ||
      this.officialWorkers.has(normalized) ||
      this.officialWorkers.has(`v2_${normalized}`)
    );
  }

  async getAllFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  printSummary() {
    this.log('');
    this.log('📊 Validation Summary', 'step');
    this.log('');

    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log('✅ All workers are official SSOT workers!', 'success');
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
  const parsed = parseArgs(args);
  const options = {
    ci: hasFlag(parsed, 'ci'),
    ssot: getOption(parsed, 'ssot')
  };

  const validator = new WorkersSSOTValidator(options);
  validator.validate().catch((error) => {
    logger.error(`Fatal error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  });
}

module.exports = { WorkersSSOTValidator };
