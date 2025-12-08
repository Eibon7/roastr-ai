#!/usr/bin/env node

/**
 * Validate Drift
 *
 * Detects drift between SSOT-V2.md, nodes-v2, and system-map-v2.yaml.
 * Ensures all values are aligned according to SSOT hierarchy.
 *
 * Usage:
 *   node scripts/validate-drift.js --ssot docs/SSOT-V2.md --nodes docs/nodes-v2/ --system-map docs/system-map-v2.yaml
 *   node scripts/validate-drift.js --ci
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

class DriftValidator {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = path.resolve(__dirname, '..');
    this.isCIMode = options.ci || false;
    this.driftIssues = [];
    this.ssotValues = {};
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
      this.log('🔍 Detecting drift between SSOT, nodes, and system-map...', 'step');
      this.log('');

      // Load SSOT-V2.md
      const ssotContent = await this.loadSSOT();
      if (!ssotContent) {
        this.log('❌ SSOT-V2.md not found', 'error');
        if (this.isCIMode) process.exit(1);
        return { valid: false, errors: ['SSOT-V2.md not found'] };
      }

      // Extract values from SSOT
      this.extractSSOTValues(ssotContent);

      // Load and validate nodes-v2
      await this.validateNodesV2();

      // Load and validate system-map-v2.yaml
      await this.validateSystemMap();

      // Print summary
      this.printSummary();

      // Exit code for CI
      if (this.isCIMode && this.driftIssues.length > 0) {
        process.exit(1);
      }

      return {
        valid: this.driftIssues.length === 0,
        driftIssues: this.driftIssues,
        ssotValues: this.ssotValues
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

  extractSSOTValues(ssotContent) {
    // Extract plan IDs
    const planIdMatch = ssotContent.match(
      /type PlanId\s*=\s*['"]([^'"]+)['"]\s*\|\s*['"]([^'"]+)['"]\s*\|\s*['"]([^'"]+)['"]/
    );
    if (planIdMatch) {
      this.ssotValues.plans = [planIdMatch[1], planIdMatch[2], planIdMatch[3]];
    }

    // Extract plan limits
    const limitsTable = ssotContent.match(
      /\|\s*starter\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(true|false)\s*\|\s*(true|false)\s*\|/
    );
    if (limitsTable) {
      this.ssotValues.starter = {
        analysis_limit: parseInt(limitsTable[1]),
        roast_limit: parseInt(limitsTable[2]),
        accounts_per_platform: parseInt(limitsTable[3]),
        sponsors_allowed: limitsTable[4] === 'true',
        tone_personal_allowed: limitsTable[5] === 'true'
      };
    }

    // Extract subscription states
    const stateMatch = ssotContent.match(/type SubscriptionState\s*=\s*([\s\S]*?);/);
    if (stateMatch) {
      const states = stateMatch[1]
        .split('|')
        .map((s) => s.trim().replace(/['"]/g, ''))
        .filter((s) => s.length > 0);
      this.ssotValues.subscriptionStates = states;
    }

    this.log(
      `   ✅ Extracted ${Object.keys(this.ssotValues).length} value categories from SSOT`,
      'success'
    );
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

              // Check for hardcoded plan values
              this.checkHardcodedPlans(content, subnodePath);

              // Check for hardcoded subscription states
              this.checkHardcodedStates(content, subnodePath);
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

  checkHardcodedPlans(content, filePath) {
    const legacyPlans = ['free', 'basic', 'creator_plus'];
    const relativePath = path.relative(this.rootDir, filePath);

    legacyPlans.forEach((plan) => {
      if (content.includes(`"${plan}"`) || content.includes(`'${plan}'`)) {
        this.driftIssues.push({
          type: 'legacy_plan_in_node',
          location: relativePath,
          message: `Legacy plan "${plan}" found. Must use SSOT plans: ${this.ssotValues.plans?.join(', ') || 'starter, pro, plus'}`
        });
      }
    });
  }

  checkHardcodedStates(content, filePath) {
    if (!this.ssotValues.subscriptionStates) return;

    const relativePath = path.relative(this.rootDir, filePath);
    const statePattern =
      /['"](trialing|active|paused|canceled_pending|payment_retry|expired_trial_pending_payment)['"]/g;
    let match;

    while ((match = statePattern.exec(content)) !== null) {
      const state = match[1];
      if (!this.ssotValues.subscriptionStates.includes(state)) {
        this.driftIssues.push({
          type: 'invalid_state_in_node',
          location: relativePath,
          message: `Invalid subscription state "${state}". Valid states: ${this.ssotValues.subscriptionStates.join(', ')}`
        });
      }
    }
  }

  async validateSystemMap() {
    const systemMapPath =
      this.options.systemMap || path.join(this.rootDir, 'docs', 'system-map-v2.yaml');

    try {
      const content = await fs.readFile(systemMapPath, 'utf-8');
      const map = yaml.parse(content);

      // Check for hardcoded values in system-map
      if (map.nodes) {
        for (const [nodeId, nodeData] of Object.entries(map.nodes)) {
          const nodeStr = JSON.stringify(nodeData);

          // Check for legacy plans
          if (
            nodeStr.includes('"free"') ||
            nodeStr.includes('"basic"') ||
            nodeStr.includes('"creator_plus"')
          ) {
            this.driftIssues.push({
              type: 'legacy_plan_in_system_map',
              location: `docs/system-map-v2.yaml (node: ${nodeId})`,
              message: 'Legacy plan found in system-map. Must use SSOT plans.'
            });
          }
        }
      }

      this.log(`   ✅ Validated system-map-v2.yaml`, 'success');
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.log('   ⚠️  system-map-v2.yaml not found', 'warning');
        return;
      }
      throw error;
    }
  }

  printSummary() {
    this.log('');
    this.log('📊 Drift Detection Summary', 'step');
    this.log('');

    if (this.driftIssues.length === 0) {
      this.log('✅ No drift detected! All values are aligned with SSOT.', 'success');
      return;
    }

    this.log(`❌ Found ${this.driftIssues.length} drift issue(s):`, 'error');
    this.driftIssues.forEach((issue, idx) => {
      this.log(`   ${idx + 1}. [${issue.type}] ${issue.location}`, 'error');
      this.log(`      ${issue.message}`, 'error');
    });
    this.log('');
    this.log('💡 Action required: Align values with SSOT-V2.md', 'warning');
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    ci: args.includes('--ci'),
    ssot: args.find((arg) => arg.startsWith('--ssot='))?.split('=')[1],
    nodes: args.find((arg) => arg.startsWith('--nodes='))?.split('=')[1],
    systemMap: args.find((arg) => arg.startsWith('--system-map='))?.split('=')[1]
  };

  const validator = new DriftValidator(options);
  validator.validate().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { DriftValidator };
