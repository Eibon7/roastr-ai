#!/usr/bin/env node

/**
 * Validate Workers SSOT
 *
 * Validates that all workers referenced in code and system-map-v2.yaml
 * are official workers defined in SSOT-V2.md.
 *
 * Usage:
 *   node scripts/validate-workers-ssot.js --ssot docs/SSOT-V2.md
 *   node scripts/validate-workers-ssot.js --ci
 */

const fs = require('fs').promises;
const path = require('path');

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
      this.log('🔍 Validating Workers against SSOT...', 'step');
      this.log('');

      // Load SSOT-V2.md
      const ssotContent = await this.loadSSOT();
      if (!ssotContent) {
        this.log('❌ SSOT-V2.md not found', 'error');
        if (this.isCIMode) process.exit(1);
        return { valid: false, errors: ['SSOT-V2.md not found'] };
      }

      // Extract official workers from SSOT
      this.extractOfficialWorkers(ssotContent);

      // Validate code references
      await this.validateCodeReferences();

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
    // Look for section 8.1 Workers oficiales v2
    const workersSection = ssotContent.match(
      /## 8\. Workers.*?### 8\.1 Workers oficiales v2([\s\S]*?)(?=###|##|$)/
    );

    if (!workersSection) {
      this.warnings.push({
        type: 'workers_section_not_found',
        message: 'Could not find section 8.1 in SSOT-V2.md'
      });
      return;
    }

    // Extract worker names from TypeScript type definition
    const typeDefMatch = workersSection[1].match(/type WorkerName\s*=\s*([\s\S]*?);/);

    if (typeDefMatch) {
      const workerNames = typeDefMatch[1]
        .split('|')
        .map((name) => name.trim().replace(/['"]/g, ''))
        .filter((name) => name.length > 0);

      workerNames.forEach((worker) => {
        this.officialWorkers.add(worker);
        // Also add v2_ prefix variants if they exist
        this.officialWorkers.add(`v2_${worker}`);
      });
    }

    // Also check for worker names in routing table (8.5)
    const routingSection = ssotContent.match(
      /### 8\.5 Routing Contractual Workers([\s\S]*?)(?=###|##|$)/
    );
    if (routingSection) {
      const workerMatches = routingSection[1].match(/\|\s*`([^`]+)`\s*\|/g);
      if (workerMatches) {
        workerMatches.forEach((match) => {
          const worker = match.replace(/[|`]/g, '').trim();
          if (worker && !worker.includes('---')) {
            this.officialWorkers.add(worker);
          }
        });
      }
    }

    this.log(`   ✅ Found ${this.officialWorkers.size} official worker(s)`, 'success');
    this.log(`      ${Array.from(this.officialWorkers).join(', ')}`, 'info');
  }

  async validateCodeReferences() {
    const srcDir = path.join(this.rootDir, 'src');
    const workersDir = path.join(srcDir, 'workers');

    try {
      const files = await this.getAllFiles(workersDir);

      for (const file of files) {
        if (!file.endsWith('.js') && !file.endsWith('.ts')) {
          continue;
        }

        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(this.rootDir, file);

        // Extract class name (worker name)
        const classMatch = content.match(/class\s+(\w+Worker)\s+extends/);
        if (classMatch) {
          const workerName = classMatch[1];

          // Check if it's an official worker
          if (!this.isOfficialWorker(workerName)) {
            this.errors.push({
              type: 'unofficial_worker',
              location: relativePath,
              message: `Worker "${workerName}" is not an official SSOT worker`
            });
          }
        }
      }
    } catch (error) {
      // Ignore if workers directory doesn't exist
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
    // Remove common prefixes/suffixes
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
  const options = {
    ci: args.includes('--ci'),
    ssot: args.find((arg) => arg.startsWith('--ssot='))?.split('=')[1]
  };

  const validator = new WorkersSSOTValidator(options);
  validator.validate().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { WorkersSSOTValidator };
