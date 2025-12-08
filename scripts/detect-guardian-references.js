#!/usr/bin/env node

/**
 * Detect Guardian References
 *
 * Detects any references to the deprecated "guardian" node.
 * The guardian node is permanently removed and cannot be recreated.
 *
 * Usage:
 *   node scripts/detect-guardian-references.js --system-map docs/system-map-v2.yaml --nodes docs/nodes-v2/ --code src/
 *   node scripts/detect-guardian-references.js --ci
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

class GuardianReferenceDetector {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = path.resolve(__dirname, '..');
    this.isCIMode = options.ci || false;
    this.detections = [];
    this.guardianPatterns = [
      /guardian/i,
      /guardian-gdd/i,
      /guardian\.js/i,
      /guardianService/i,
      /GuardianNode/i,
      /product-guard/i,
      /guardian-ignore/i
    ];
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

  async detect() {
    try {
      this.log('🔍 Detecting guardian references...', 'step');
      this.log('');

      // Detect in system-map-v2.yaml
      await this.detectInSystemMap();

      // Detect in nodes-v2
      await this.detectInNodesV2();

      // Detect in code
      await this.detectInCode();

      // Detect in scripts
      await this.detectInScripts();

      // Print summary
      this.printSummary();

      // Exit code for CI
      if (this.isCIMode && this.detections.length > 0) {
        process.exit(1);
      }

      return {
        found: this.detections.length > 0,
        detections: this.detections
      };
    } catch (error) {
      this.log(`❌ Detection failed: ${error.message}`, 'error');
      if (this.isCIMode) process.exit(1);
      throw error;
    }
  }

  async detectInSystemMap() {
    const systemMapPath = path.join(this.rootDir, 'docs', 'system-map-v2.yaml');
    
    try {
      const content = await fs.readFile(systemMapPath, 'utf-8');
      const map = yaml.parse(content);
      
      // Check for guardian node
      if (map.nodes && map.nodes.guardian) {
        this.detections.push({
          type: 'guardian_node_in_system_map',
          location: 'docs/system-map-v2.yaml',
          message: 'Guardian node found in system-map-v2.yaml. Guardian node is deprecated and cannot be recreated.',
          severity: 'error'
        });
      }

      // Check for guardian in depends_on or required_by
      if (map.nodes) {
        for (const [nodeId, nodeData] of Object.entries(map.nodes)) {
          const nodeStr = JSON.stringify(nodeData);
          if (this.matchesGuardianPattern(nodeStr)) {
            this.detections.push({
              type: 'guardian_reference_in_node',
              location: `docs/system-map-v2.yaml (node: ${nodeId})`,
              message: 'Guardian reference found in node definition. Guardian node is deprecated.',
              severity: 'error'
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
    const nodesV2Dir = path.join(this.rootDir, 'docs', 'nodes-v2');
    
    try {
      const entries = await fs.readdir(nodesV2Dir, { withFileTypes: true });
      
      // Check for guardian directory
      if (entries.some(e => e.isDirectory() && e.name === 'guardian')) {
        this.detections.push({
          type: 'guardian_directory',
          location: 'docs/nodes-v2/guardian/',
          message: 'Guardian directory found. Guardian node is deprecated and cannot be recreated.',
          severity: 'error'
        });
      }

      // Check in all subnode files
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const nodeDir = path.join(nodesV2Dir, entry.name);
          const subnodes = await fs.readdir(nodeDir);
          
          for (const subnodeFile of subnodes) {
            if (subnodeFile.endsWith('.md')) {
              const subnodePath = path.join(nodeDir, subnodeFile);
              const content = await fs.readFile(subnodePath, 'utf-8');
              
              if (this.matchesGuardianPattern(content)) {
                const lineNumber = this.getLineNumber(content, content.toLowerCase().indexOf('guardian'));
                this.detections.push({
                  type: 'guardian_reference_in_node',
                  location: `docs/nodes-v2/${entry.name}/${subnodeFile}:${lineNumber}`,
                  message: 'Guardian reference found in node documentation. Guardian node is deprecated.',
                  severity: 'error'
                });
              }
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
    const codeDir = path.join(this.rootDir, 'src');
    
    try {
      const files = await this.getAllFiles(codeDir);
      
      for (const file of files) {
        if (!file.endsWith('.js') && !file.endsWith('.ts') && !file.endsWith('.jsx') && !file.endsWith('.tsx')) {
          continue;
        }

        const content = await fs.readFile(file, 'utf-8');
        
        if (this.matchesGuardianPattern(content)) {
          const relativePath = path.relative(this.rootDir, file);
          const lineNumber = this.getLineNumber(content, content.toLowerCase().indexOf('guardian'));
          this.detections.push({
            type: 'guardian_reference_in_code',
            location: `${relativePath}:${lineNumber}`,
            message: 'Guardian reference found in code. Guardian node is deprecated and cannot be recreated.',
            severity: 'error'
          });
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async detectInScripts() {
    const scriptsDir = path.join(this.rootDir, 'scripts');
    
    try {
      const files = await this.getAllFiles(scriptsDir);
      
      for (const file of files) {
        if (!file.endsWith('.js')) {
          continue;
        }

        // Skip this script itself
        if (file.includes('detect-guardian-references.js')) {
          continue;
        }

        const content = await fs.readFile(file, 'utf-8');
        
        if (this.matchesGuardianPattern(content)) {
          const relativePath = path.relative(this.rootDir, file);
          const lineNumber = this.getLineNumber(content, content.toLowerCase().indexOf('guardian'));
          this.detections.push({
            type: 'guardian_reference_in_script',
            location: `${relativePath}:${lineNumber}`,
            message: 'Guardian reference found in script. Guardian node is deprecated.',
            severity: 'warning'
          });
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  matchesGuardianPattern(content) {
    return this.guardianPatterns.some(pattern => pattern.test(content));
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
    if (index === -1) return 1;
    return content.substring(0, index).split('\n').length;
  }

  printSummary() {
    this.log('');
    this.log('📊 Guardian Reference Detection Summary', 'step');
    this.log('');
    
    if (this.detections.length === 0) {
      this.log('✅ No guardian references detected!', 'success');
      return;
    }

    // Group by severity
    const errors = this.detections.filter(d => d.severity === 'error');
    const warnings = this.detections.filter(d => d.severity === 'warning');

    if (errors.length > 0) {
      this.log(`❌ Found ${errors.length} error(s):`, 'error');
      errors.forEach((detection, idx) => {
        this.log(`   ${idx + 1}. [${detection.type}] ${detection.location}`, 'error');
        this.log(`      ${detection.message}`, 'error');
      });
      this.log('');
    }

    if (warnings.length > 0) {
      this.log(`⚠️  Found ${warnings.length} warning(s):`, 'warning');
      warnings.forEach((detection, idx) => {
        this.log(`   ${idx + 1}. [${detection.type}] ${detection.location}`, 'warning');
        this.log(`      ${detection.message}`, 'warning');
      });
      this.log('');
    }

    this.log('🚨 CRITICAL: Guardian node is deprecated and cannot be recreated.', 'error');
    this.log('   Action required: Remove all guardian references immediately.', 'error');
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    ci: args.includes('--ci'),
    systemMap: args.find(arg => arg.startsWith('--system-map='))?.split('=')[1],
    nodes: args.find(arg => arg.startsWith('--nodes='))?.split('=')[1],
    code: args.find(arg => arg.startsWith('--code='))?.split('=')[1]
  };

  const detector = new GuardianReferenceDetector(options);
  detector.detect().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { GuardianReferenceDetector };

