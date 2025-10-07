#!/usr/bin/env node

/**
 * GDD 2.0 Phase 14 - Agent Interface Layer (AIL)
 *
 * Centralized API for bidirectional communication between agents and GDD system.
 * Provides secure, validated, and auditable operations.
 *
 * @module agent-interface
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execSync, execFileSync } = require('child_process');
const SecureWriteProtocol = require('./secure-write.js');

class AgentInterface {
  constructor() {
    this.projectRoot = process.cwd();
    this.nodesDir = path.join(this.projectRoot, 'docs', 'nodes');
    this.systemMapPath = path.join(this.projectRoot, 'system-map.yaml');
    this.permissionsPath = path.join(this.projectRoot, 'config', 'agent-permissions.json');
    this.logPath = path.join(this.projectRoot, 'gdd-agent-log.json');

    this.swp = new SecureWriteProtocol();
    this.permissions = this._loadPermissions();
    this.telemetryBus = null;
    this.actionLog = this._loadActionLog();

    // Rate limiting
    this.rateLimits = {
      actions: new Map(), // agent -> [timestamps]
      issues: new Map() // agent -> [timestamps]
    };
  }

  /**
   * Load permissions configuration
   * @private
   */
  _loadPermissions() {
    try {
      const content = fs.readFileSync(this.permissionsPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to load permissions:', error.message);
      return { agents: {}, global_rules: {} };
    }
  }

  /**
   * Load action log
   * @private
   */
  _loadActionLog() {
    try {
      if (fs.existsSync(this.logPath)) {
        const content = fs.readFileSync(this.logPath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('Failed to load action log:', error.message);
    }
    return { actions: [], metadata: { created: new Date().toISOString() } };
  }

  /**
   * Save action log
   * @private
   */
  _saveActionLog() {
    try {
      fs.writeFileSync(this.logPath, JSON.stringify(this.actionLog, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save action log:', error.message);
    }
  }

  /**
   * Check if agent has permission for action
   * @param {string} agent - Agent name
   * @param {string} action - Action to perform
   * @returns {boolean} True if permitted
   */
  hasPermission(agent, action) {
    const agentConfig = this.permissions.agents[agent];
    if (!agentConfig) {
      console.error(`❌ Unknown agent: ${agent}`);
      return false;
    }

    // Check read-only restriction
    // For read-only agents, block only mutating actions
    if (agentConfig.read_only) {
      const mutatingPrefixes = [
        'update_',
        'write_',
        'create_',
        'delete_',
        'trigger_auto_repair',
        'sync_',
        'mark_',
        'force_'
      ];
      if (mutatingPrefixes.some(prefix => action.startsWith(prefix))) {
        return false;
      }
    }

    // Check if action is permitted
    return agentConfig.permissions.includes(action);
  }

  /**
   * Check if field is restricted for agent
   * @param {string} agent - Agent name
   * @param {string} field - Field name
   * @returns {boolean} True if restricted
   */
  isFieldRestricted(agent, field) {
    const agentConfig = this.permissions.agents[agent];
    if (!agentConfig) return true;

    const restricted = agentConfig.restricted_fields || [];
    return restricted.includes('*') || restricted.includes(field);
  }

  /**
   * Check rate limits
   * @param {string} agent - Agent name
   * @param {string} type - Type of action ('actions' or 'issues')
   * @returns {boolean} True if within limits
   */
  checkRateLimit(agent, type = 'actions') {
    const now = Date.now();
    const limits = this.rateLimits[type];
    const agentActions = limits.get(agent) || [];

    // Remove old timestamps
    const timeWindow = type === 'actions' ? 60000 : 3600000; // 1 min or 1 hour
    const recentActions = agentActions.filter(ts => now - ts < timeWindow);

    const maxActions = type === 'actions'
      ? this.permissions.global_rules.max_actions_per_minute || 60
      : this.permissions.global_rules.max_issues_per_hour || 10;

    if (recentActions.length >= maxActions) {
      return false;
    }

    // Update rate limit tracking
    recentActions.push(now);
    limits.set(agent, recentActions);
    return true;
  }

  /**
   * Log agent action
   * @param {string} agent - Agent name
   * @param {string} action - Action performed
   * @param {string} target - Target of action
   * @param {Object} result - Action result
   */
  logAgentAction(agent, action, target, result) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      agent,
      action,
      target,
      result: {
        success: result.success || false,
        error: result.error || null
      },
      deltaHealth: result.deltaHealth || 0
    };

    this.actionLog.actions.push(logEntry);

    // Keep only last 1000 actions
    if (this.actionLog.actions.length > 1000) {
      this.actionLog.actions = this.actionLog.actions.slice(-1000);
    }

    this._saveActionLog();

    // Broadcast to telemetry
    if (this.telemetryBus) {
      this.telemetryBus.emit('agent-action', logEntry);
    }

    return logEntry;
  }

  /**
   * Read a GDD node
   * @param {string} nodeName - Node name
   * @param {string} agent - Agent requesting read
   * @returns {Object} Node content and metadata
   */
  readNode(nodeName, agent = 'unknown') {
    // Check permission
    if (!this.hasPermission(agent, 'read_nodes')) {
      const error = { success: false, error: 'Permission denied: read_nodes' };
      this.logAgentAction(agent, 'read_node', nodeName, error);
      throw new Error(error.error);
    }

    const nodePath = path.join(this.nodesDir, `${nodeName}.md`);
    if (!fs.existsSync(nodePath)) {
      const error = { success: false, error: `Node not found: ${nodeName}` };
      this.logAgentAction(agent, 'read_node', nodeName, error);
      throw new Error(error.error);
    }

    const content = fs.readFileSync(nodePath, 'utf8');
    const stats = fs.statSync(nodePath);

    const result = {
      success: true,
      nodeName,
      content,
      metadata: {
        path: nodePath,
        size: stats.size,
        lastModified: stats.mtime.toISOString()
      }
    };

    this.logAgentAction(agent, 'read_node', nodeName, result);
    return result;
  }

  /**
   * Write a field in a GDD node
   * @param {string} nodeName - Node name
   * @param {string} field - Field to update
   * @param {*} value - New value
   * @param {string} agent - Agent performing write
   * @returns {Promise<Object>} Write result
   */
  async writeNodeField(nodeName, field, value, agent) {
    // Check permissions
    if (!this.hasPermission(agent, 'update_metadata')) {
      const error = { success: false, error: 'Permission denied: update_metadata' };
      this.logAgentAction(agent, 'write_field', `${nodeName}:${field}`, error);
      throw new Error(error.error);
    }

    // Check rate limit
    if (!this.checkRateLimit(agent, 'actions')) {
      const error = { success: false, error: 'Rate limit exceeded' };
      this.logAgentAction(agent, 'write_field', `${nodeName}:${field}`, error);
      throw new Error(error.error);
    }

    // Check field restrictions
    if (this.isFieldRestricted(agent, field)) {
      const error = { success: false, error: `Field restricted: ${field}` };
      this.logAgentAction(agent, 'write_field', `${nodeName}:${field}`, error);
      throw new Error(error.error);
    }

    // Get current health
    const healthBefore = await this.getSystemHealth();

    // Read current node
    const nodeData = this.readNode(nodeName, agent);
    let content = nodeData.content;

    // Update field (simple markdown field replacement)
    // This is a simplified implementation - can be enhanced for specific fields
    const fieldRegex = new RegExp(`^(\\*\\*${field}:\\*\\*)(.*)$`, 'gm');
    if (fieldRegex.test(content)) {
      content = content.replace(fieldRegex, `$1 ${value}`);
    } else {
      // Add field if not exists
      content += `\n\n**${field}:** ${value}\n`;
    }

    // Execute secure write
    const nodePath = path.join(this.nodesDir, `${nodeName}.md`);
    const writeResult = await this.swp.executeWrite({
      agent,
      action: 'write_field',
      target: nodePath,
      content,
      healthBefore
    });

    // Get health after write
    const healthAfter = await this.getSystemHealth();
    const deltaHealth = healthAfter - healthBefore;

    // Check if rollback needed
    const rollbackResult = await this.swp.rollbackIfNeeded(writeResult, healthAfter);

    const result = {
      success: !rollbackResult.rollbackNeeded,
      nodeName,
      field,
      value,
      healthBefore,
      healthAfter,
      deltaHealth,
      rollback: rollbackResult.rollbackNeeded ? rollbackResult : null
    };

    this.logAgentAction(agent, 'write_field', `${nodeName}:${field}`, result);
    return result;
  }

  /**
   * Create GitHub issue
   * @param {string} agent - Agent creating issue
   * @param {string} title - Issue title
   * @param {string} body - Issue body
   * @returns {Promise<Object>} Issue creation result
   */
  async createIssue(agent, title, body) {
    // Check permission
    if (!this.hasPermission(agent, 'create_issue')) {
      const error = { success: false, error: 'Permission denied: create_issue' };
      this.logAgentAction(agent, 'create_issue', title, error);
      throw new Error(error.error);
    }

    // Check rate limit
    if (!this.checkRateLimit(agent, 'issues')) {
      const error = { success: false, error: 'Issue rate limit exceeded' };
      this.logAgentAction(agent, 'create_issue', title, error);
      throw new Error(error.error);
    }

    try {
      // Use GitHub CLI to create issue (secure: no shell interpretation)
      const output = execFileSync(
        'gh',
        [
          'issue',
          'create',
          '--title',
          title,
          '--body',
          body,
          '--label',
          `gdd-agent,${agent.toLowerCase()}`
        ],
        { encoding: 'utf8' }
      );

      const result = {
        success: true,
        title,
        url: output.trim()
      };

      this.logAgentAction(agent, 'create_issue', title, result);
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: error.message
      };
      this.logAgentAction(agent, 'create_issue', title, result);
      throw error;
    }
  }

  /**
   * Trigger auto-repair
   * @param {string} agent - Agent triggering repair
   * @returns {Promise<Object>} Repair result
   */
  async triggerRepair(agent) {
    // Check permission
    if (!this.hasPermission(agent, 'trigger_auto_repair')) {
      const error = { success: false, error: 'Permission denied: trigger_auto_repair' };
      this.logAgentAction(agent, 'trigger_repair', 'system', error);
      throw new Error(error.error);
    }

    try {
      const command = 'node scripts/auto-repair-gdd.js --auto-fix';
      const output = execSync(command, { encoding: 'utf8' });

      const result = {
        success: true,
        output: output.trim()
      };

      this.logAgentAction(agent, 'trigger_repair', 'system', result);
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: error.message
      };
      this.logAgentAction(agent, 'trigger_repair', 'system', result);
      throw error;
    }
  }

  /**
   * Get current system health score
   * @returns {Promise<number>} Health score (0-100)
   */
  async getSystemHealth() {
    try {
      const command = 'node scripts/compute-gdd-health.js --json';
      const output = execSync(command, { encoding: 'utf8' });
      const data = JSON.parse(output);
      return data.overallHealth || 0;
    } catch (error) {
      console.warn('Failed to get system health:', error.message);
      return 0;
    }
  }

  /**
   * Set telemetry bus for event broadcasting
   * @param {Object} telemetryBus - Telemetry bus instance
   */
  setTelemetryBus(telemetryBus) {
    this.telemetryBus = telemetryBus;
    this.swp.setTelemetryBus(telemetryBus);
  }

  /**
   * Get agent statistics
   * @param {string} agent - Agent name (optional)
   * @returns {Object} Statistics
   */
  getStatistics(agent = null) {
    const actions = agent
      ? this.actionLog.actions.filter(a => a.agent === agent)
      : this.actionLog.actions;

    const successful = actions.filter(a => a.result.success).length;
    const failed = actions.filter(a => !a.result.success).length;
    const avgDeltaHealth = actions.reduce((sum, a) => sum + (a.deltaHealth || 0), 0) / actions.length || 0;

    return {
      totalActions: actions.length,
      successful,
      failed,
      successRate: actions.length > 0 ? (successful / actions.length * 100).toFixed(2) : 0,
      avgDeltaHealth: avgDeltaHealth.toFixed(2)
    };
  }
}

// CLI interface
if (require.main === module) {
  const ail = new AgentInterface();

  const command = process.argv[2];

  if (command === '--simulate') {
    console.log('\n🧪 Running AIL Simulation...\n');

    // Test 1: Read node
    console.log('Test 1: Read node (Orchestrator)');
    try {
      const result = ail.readNode('shield', 'Orchestrator');
      console.log(`✅ Read successful: ${result.nodeName} (${result.metadata.size} bytes)`);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }

    // Test 2: Permission denied
    console.log('\nTest 2: Permission denied (RuntimeValidator write)');
    try {
      ail.writeNodeField('shield', 'test_field', 'test_value', 'RuntimeValidator');
      console.log('❌ Should have failed but succeeded');
    } catch (error) {
      console.log(`✅ Correctly denied: ${error.message}`);
    }

    // Test 3: Statistics
    console.log('\nTest 3: Agent statistics');
    const stats = ail.getStatistics();
    console.log('✅ Statistics:', stats);

    console.log('\n✅ Simulation complete\n');
  } else if (command === '--stats') {
    const agent = process.argv[3];
    const stats = ail.getStatistics(agent);
    console.log('\n📊 Agent Statistics:\n');
    console.log(`  Total Actions: ${stats.totalActions}`);
    console.log(`  Successful: ${stats.successful}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Success Rate: ${stats.successRate}%`);
    console.log(`  Avg ΔHealth: ${stats.avgDeltaHealth}\n`);
  } else {
    console.log(`
GDD Agent Interface Layer (AIL) CLI

Commands:
  --simulate              Run simulation tests
  --stats [agent]         Show statistics for agent (or all)

Examples:
  node agent-interface.js --simulate
  node agent-interface.js --stats Orchestrator
    `);
  }
}

module.exports = AgentInterface;
