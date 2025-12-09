#!/usr/bin/env node

/**
 * Detect Legacy IDs
 *
 * Detects legacy node IDs (v1) that should be migrated to v2 equivalents.
 *
 * Usage:
 *   node scripts/detect-legacy-ids.js --system-map=docs/system-map-v2.yaml --nodes=docs/nodes-v2/ --code=src/
 *   node scripts/detect-legacy-ids.js --system-map docs/system-map-v2.yaml --nodes docs/nodes-v2/ --code src/
 *   node scripts/detect-legacy-ids.js --ci
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const logger = require('../src/utils/logger');
const { getAllMappings, isLegacyId, getV2Equivalent } = require('./shared/legacy-ids');
const { parseArgs, getOption, hasFlag } = require('./shared/cli-parser');

class LegacyIDDetector {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = path.resolve(__dirname, '..');
    this.isCIMode = options.ci || false;
    this.legacyIds = getAllMappings();
    this.detections = [];
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

  async detect() {
    try {
      this.log('🔍 Detecting legacy IDs...', 'step');
      this.log('');

      // Detect in system-map-v2.yaml
      await this.detectInSystemMap();

      // Detect in nodes-v2
      await this.detectInNodesV2();

      // Detect in code
      await this.detectInCode();

      // Print summary
      this.printSummary();

      // Exit code contract for CI mode:
      // 0 = no legacy IDs detected
      // 1 = legacy IDs in src/ only (WARN but allow CI to continue)
      // 2 = legacy IDs in docs/ (FAIL - must be fixed)
      if (this.isCIMode) {
        // Separate detections by location
        const docsErrors = this.detections.filter(d => 
          d.location && (
            d.location.includes('docs/system-map-v2.yaml') ||
            d.location.includes('docs/nodes-v2/') ||
            d.location.includes('docs/SSOT-V2.md')
          )
        );
        const srcErrors = this.detections.filter(d => 
          d.location && d.location.includes('src/')
        );
        const otherErrors = this.detections.filter(d => 
          d.location && !d.location.includes('src/') && 
          !d.location.includes('docs/system-map-v2.yaml') &&
          !d.location.includes('docs/nodes-v2/') &&
          !d.location.includes('docs/SSOT-V2.md')
        );

        // CRITICAL: Legacy IDs in docs/ → exit 2
        if (docsErrors.length > 0) {
          this.log(`❌ Found ${docsErrors.length} legacy ID(s) in docs (CRITICAL)`, 'error');
          this.log(`   Locations: ${docsErrors.map(d => d.location).join(', ')}`, 'error');
          process.exit(2); // Exit 2 = docs/ legacy IDs → CI FAIL
        }

        // WARN: Legacy IDs in src/ only → exit 1 (allowed for v2 PRs)
        if (srcErrors.length > 0) {
          this.log(`⚠️ Found ${srcErrors.length} legacy ID(s) in src/ (outside scope - WARN only)`, 'warning');
          this.log(`   Locations: ${srcErrors.map(d => d.location).join(', ')}`, 'warning');
          process.exit(1); // Exit 1 = src/ only → CI continues with warning
        }

        // UNEXPECTED: Legacy IDs in other locations → exit 2
        if (otherErrors.length > 0) {
          this.log(`❌ Found ${otherErrors.length} legacy ID(s) in unexpected locations`, 'error');
          this.log(`   Locations: ${otherErrors.map(d => d.location).join(', ')}`, 'error');
          process.exit(2); // Exit 2 = unexpected location → CI FAIL
        }

        // No legacy IDs detected → exit 0
        process.exit(0);
      }

      return {
        found: this.detections.length > 0,
        detections: this.detections,
        legacyIds: Array.from(this.legacyIds.keys())
      };
    } catch (error) {
      this.log(`❌ Detection failed: ${error.message}`, 'error');
      if (this.isCIMode) process.exit(1);
      throw error;
    }
  }

  async detectInSystemMap() {
    const systemMapPath =
      this.options.systemMap || path.join(this.rootDir, 'docs', 'system-map-v2.yaml');

    try {
      const content = await fs.readFile(systemMapPath, 'utf-8');
      const map = yaml.parse(content);

      if (map.nodes) {
        for (const [nodeId, nodeData] of Object.entries(map.nodes)) {
          // Check node ID itself
          if (this.legacyIds.has(nodeId)) {
            const mapping = this.legacyIds.get(nodeId);
            this.detections.push({
              type: 'legacy_node_id',
              location: `docs/system-map-v2.yaml (node: ${nodeId})`,
              legacyId: nodeId,
              suggestedMapping: mapping,
              message: mapping
                ? `Legacy ID "${nodeId}" found. Should use "${mapping}"`
                : `Legacy ID "${nodeId}" is deprecated and cannot be recreated.`
            });
          }

          // Check in depends_on
          if (nodeData.depends_on) {
            const deps = Array.isArray(nodeData.depends_on)
              ? nodeData.depends_on
              : [nodeData.depends_on];
            deps.forEach((dep) => {
              if (this.legacyIds.has(dep)) {
                const mapping = this.legacyIds.get(dep);
                this.detections.push({
                  type: 'legacy_id_in_depends_on',
                  location: `docs/system-map-v2.yaml (node: ${nodeId})`,
                  legacyId: dep,
                  suggestedMapping: mapping,
                  message: mapping
                    ? `Legacy ID "${dep}" in depends_on. Should use "${mapping}"`
                    : `Legacy ID "${dep}" is deprecated.`
                });
              }
            });
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async detectInNodesV2() {
    const nodesV2Dir = this.options.nodes || path.join(this.rootDir, 'docs', 'nodes-v2');

    try {
      const entries = await fs.readdir(nodesV2Dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const nodeId = entry.name;

          // Check node directory name
          if (this.legacyIds.has(nodeId)) {
            const mapping = this.legacyIds.get(nodeId);
            this.detections.push({
              type: 'legacy_node_directory',
              location: `docs/nodes-v2/${nodeId}/`,
              legacyId: nodeId,
              suggestedMapping: mapping,
              message: mapping
                ? `Legacy node directory "${nodeId}". Should use "${mapping}"`
                : `Legacy node directory "${nodeId}" is deprecated.`
            });
          }

          // Check in subnode files
          const nodeDir = path.join(nodesV2Dir, nodeId);
          const subnodes = await fs.readdir(nodeDir);

          for (const subnodeFile of subnodes) {
            if (subnodeFile.endsWith('.md')) {
              const subnodePath = path.join(nodeDir, subnodeFile);
              const content = await fs.readFile(subnodePath, 'utf-8');

              // Check for legacy ID references in content
              this.legacyIds.forEach((mapping, legacyId) => {
                const pattern = new RegExp(`['"\`]${legacyId}['"\`]`, 'g');
                if (pattern.test(content)) {
                  this.detections.push({
                    type: 'legacy_id_in_content',
                    location: `docs/nodes-v2/${nodeId}/${subnodeFile}`,
                    legacyId: legacyId,
                    suggestedMapping: mapping,
                    message: mapping
                      ? `Legacy ID "${legacyId}" referenced. Should use "${mapping}"`
                      : `Legacy ID "${legacyId}" is deprecated.`
                  });
                }
              });
            }
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async detectInCode() {
    const codeDir = this.options.code || path.join(this.rootDir, 'src');

    try {
      const files = await this.getAllFiles(codeDir);

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

        // Check for legacy IDs in strings
        this.legacyIds.forEach((mapping, legacyId) => {
          const pattern = new RegExp(`['"\`]${legacyId}['"\`]`, 'g');
          if (pattern.test(content)) {
            const lineNumber = this.getLineNumber(content, content.indexOf(`"${legacyId}"`));
            this.detections.push({
              type: 'legacy_id_in_code',
              location: `${relativePath}:${lineNumber}`,
              legacyId: legacyId,
              suggestedMapping: mapping,
              message: mapping
                ? `Legacy ID "${legacyId}" in code. Should use "${mapping}"`
                : `Legacy ID "${legacyId}" is deprecated.`
            });
          }
        });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async getAllFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

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
    this.log('📊 Legacy ID Detection Summary', 'step');
    this.log('');

    if (this.detections.length === 0) {
      this.log('✅ No legacy IDs detected!', 'success');
      return;
    }

    // Group by type
    const byType = {};
    this.detections.forEach((detection) => {
      if (!byType[detection.type]) {
        byType[detection.type] = [];
      }
      byType[detection.type].push(detection);
    });

    this.log(`❌ Found ${this.detections.length} legacy ID reference(s):`, 'error');
    this.log('');

    Object.entries(byType).forEach(([type, detections]) => {
      this.log(`   ${type} (${detections.length}):`, 'error');
      detections.forEach((detection, idx) => {
        this.log(`      ${idx + 1}. ${detection.location}`, 'error');
        this.log(`         ${detection.message}`, 'error');
        if (detection.suggestedMapping) {
          this.log(`         → Suggested: Use "${detection.suggestedMapping}"`, 'info');
        }
      });
      this.log('');
    });

    this.log('💡 Action required: Migrate legacy IDs to v2 equivalents', 'warning');
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  const options = {
    ci: hasFlag(parsed, 'ci'),
    systemMap: getOption(parsed, 'system-map'),
    nodes: getOption(parsed, 'nodes'),
    code: getOption(parsed, 'code')
  };

  const detector = new LegacyIDDetector(options);
  detector.detect().catch((error) => {
    logger.error(`Fatal error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  });
}

module.exports = { LegacyIDDetector };
