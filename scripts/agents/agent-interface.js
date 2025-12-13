#!/usr/bin/env node

/**
 * GDD Agent Interface Layer (AIL)
 *
 * Centralized API for bidirectional communication between agents and GDD system.
 * Provides secure read/write operations with permission validation, integrity checks,
 * and automatic rollback on health degradation.
 *
 * @module agent-interface
 * @version 1.0.0
 * @phase GDD 2.0 Phase 15 - Cross-Validation & Extended Health Metrics
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Agent Interface Layer
 *
 * Main class for agent-to-system communication
 */
class AgentInterface {
  constructor(options = {}) {
    this.rootDir = path.resolve(__dirname, '../..');
    this.nodesDir = path.join(this.rootDir, 'docs', 'nodes');
    this.permissions = this.loadPermissions();
    this.logPath = path.join(this.rootDir, 'gdd-agent-log.json');
    this.historyPath = path.join(this.rootDir, 'docs', 'gdd-agent-history.md');
    this.telemetryBus = options.telemetryBus || null;
    this.verbose = options.verbose || false;

    // Initialize log file if not exists
    this.initializeLogFile();
  }

  /**
   * Load agent permissions from config
   */
  loadPermissions() {
    try {
      const permissionsPath = path.join(this.rootDir, 'config', 'agent-permissions.json');
      if (!fs.existsSync(permissionsPath)) {
        this.log('warn', 'agent-permissions.json not found, using defaults');
        return this.getDefaultPermissions();
      }

      const config = JSON.parse(fs.readFileSync(permissionsPath, 'utf8'));

      // Handle new nested format: permissions.AgentName.allowed_actions
      if (config.permissions) {
        const permissions = {};
        for (const [agentName, agentConfig] of Object.entries(config.permissions)) {
          permissions[agentName] = agentConfig.allowed_actions || [];
        }
        return permissions;
      }

      // Fallback to old flat format
      return config;
    } catch (error) {
      this.log('error', `Failed to load permissions: ${error.message}`);
      return this.getDefaultPermissions();
    }
  }

  /**
   * Default permissions if config file not found
   */
  getDefaultPermissions() {
    return {
      DocumentationAgent: ['update_metadata', 'create_issue', 'update_dependencies'],
      Orchestrator: ['sync_nodes', 'update_health', 'mark_stale'],
      DriftWatcher: ['trigger_auto_repair', 'update_timestamp'],
      RuntimeValidator: ['read_only']
    };
  }

  /**
   * Initialize log file if it doesn't exist
   */
  initializeLogFile() {
    if (!fs.existsSync(this.logPath)) {
      const initialLog = {
        created_at: new Date().toISOString(),
        version: '1.0.0',
        phase: 15,
        events: []
      };
      fs.writeFileSync(this.logPath, JSON.stringify(initialLog, null, 2));
    }
  }

  /**
   * Check if agent has permission for action
   */
  hasPermission(agent, action) {
    const agentPermissions = this.permissions[agent];
    if (!agentPermissions) {
      return false;
    }

    // Check if action is allowed
    if (agentPermissions.includes(action)) {
      return true;
    }

    // Check for wildcard permissions
    if (agentPermissions.includes('*')) {
      return true;
    }

    // Check for read-only permission
    if (action === 'read_node' && agentPermissions.includes('read_only')) {
      return true;
    }

    return false;
  }

  /**
   * Read a GDD node
   *
   * @param {string} nodeName - Name of the node to read
   * @returns {object} Node data
   */
  async readNode(nodeName) {
    try {
      const nodePath = path.join(this.nodesDir, `${nodeName}.md`);

      if (!fs.existsSync(nodePath)) {
        throw new Error(`Node not found: ${nodeName}`);
      }

      const content = fs.readFileSync(nodePath, 'utf8');
      const metadata = this.parseNodeMetadata(content);

      return {
        name: nodeName,
        path: nodePath,
        content,
        metadata,
        hash: this.calculateHash(content)
      };
    } catch (error) {
      this.log('error', `Failed to read node ${nodeName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse node metadata from markdown content
   */
  parseNodeMetadata(content) {
    const metadata = {};

    // Extract common metadata fields
    const patterns = {
      status: /\*\*Status:\*\*\s+([^\n]+)/,
      coverage: /\*\*Coverage:\*\*\s+(\d+(?:\.\d+)?)%/,
      health: /\*\*Health:\*\*\s+(\d+(?:\.\d+)?)/,
      last_updated: /\*\*Last Updated:\*\*\s+([^\n]+)/,
      dependencies: /## Dependencies\n\n([\s\S]*?)(?=\n##|$)/
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = content.match(pattern);
      if (match) {
        if (key === 'dependencies') {
          // Extract dependency list
          const deps = match[1]
            .split('\n')
            .filter((line) => line.startsWith('- '))
            .map((line) => line.replace('- ', '').trim());
          metadata[key] = deps;
        } else {
          metadata[key] = match[1].trim();
        }
      }
    }

    return metadata;
  }

  /**
   * Write to a GDD node field (with security checks)
   *
   * @param {string} nodeName - Name of the node
   * @param {string} field - Field to update
   * @param {string} value - New value
   * @param {string} agent - Agent performing the write
   * @returns {object} Write result
   */
  async writeNodeField(nodeName, field, value, agent) {
    // Permission check
    if (!this.hasPermission(agent, 'update_metadata')) {
      const error = new Error('Permission denied');
      this.logAgentAction(agent, 'write_node_field', nodeName, {
        success: false,
        error: '403 Forbidden',
        field,
        value
      });
      throw error;
    }

    try {
      // Get current health before write
      const healthBefore = await this.getSystemHealth();

      // Read current node
      const nodeData = await this.readNode(nodeName);
      const hashBefore = nodeData.hash;

      // Create backup
      const backup = {
        content: nodeData.content,
        hash: hashBefore,
        timestamp: new Date().toISOString()
      };

      // Update field
      const updatedContent = this.updateNodeField(nodeData.content, field, value);
      const hashAfter = this.calculateHash(updatedContent);

      // Write to file (using Secure Write Protocol)
      const SecureWrite = require('./secure-write');
      const secureWrite = new SecureWrite();

      await secureWrite.write({
        path: nodeData.path,
        content: updatedContent,
        agent,
        action: 'update_field',
        metadata: {
          node: nodeName,
          field,
          value,
          hash_before: hashBefore,
          hash_after: hashAfter
        }
      });

      // Get health after write
      const healthAfter = await this.getSystemHealth();

      // Check if health degraded
      if (healthAfter.overall_score < healthBefore.overall_score) {
        this.log(
          'warn',
          `Health degraded after write: ${healthBefore.overall_score} → ${healthAfter.overall_score}`
        );

        // Rollback
        await secureWrite.rollback({
          path: nodeData.path,
          content: backup.content,
          reason: 'health_degradation',
          agent
        });

        this.logAgentAction(agent, 'write_node_field', nodeName, {
          success: false,
          rollback: true,
          reason: 'health_degradation',
          health_before: healthBefore.overall_score,
          health_after: healthAfter.overall_score
        });

        throw new Error('Write rolled back due to health degradation');
      }

      // Log successful write
      this.logAgentAction(agent, 'write_node_field', nodeName, {
        success: true,
        field,
        value,
        hash_before: hashBefore,
        hash_after: hashAfter,
        health_delta: healthAfter.overall_score - healthBefore.overall_score
      });

      // Notify telemetry bus
      if (this.telemetryBus) {
        this.telemetryBus.emit('agent_action', {
          agent,
          action: 'write_node_field',
          node: nodeName,
          field,
          deltaHealth: healthAfter.overall_score - healthBefore.overall_score,
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: true,
        node: nodeName,
        field,
        value,
        hash_after: hashAfter,
        health_delta: healthAfter.overall_score - healthBefore.overall_score
      };
    } catch (error) {
      this.log('error', `Failed to write node field: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a specific field in node content
   */
  updateNodeField(content, field, value) {
    const patterns = {
      status: /(\*\*Status:\*\*\s+)[^\n]+/,
      health: /(\*\*Health:\*\*\s+)\d+/,
      last_updated: /(\*\*Last Updated:\*\*\s+)[^\n]+/
    };

    const pattern = patterns[field];
    if (!pattern) {
      throw new Error(`Unknown field: ${field}`);
    }

    // Update field
    const updated = content.replace(pattern, `$1${value}`);

    // If field not found, add it
    if (updated === content) {
      // Add field after first heading
      const firstHeading = content.indexOf('\n##');
      if (firstHeading !== -1) {
        const before = content.substring(0, firstHeading);
        const after = content.substring(firstHeading);
        return `${before}\n\n**${field.charAt(0).toUpperCase() + field.slice(1)}:** ${value}${after}`;
      } else {
        // Fallback: If no heading found, append field at the end of document
        // This ensures metadata is always added even for malformed documents
        return `${content}\n\n**${field.charAt(0).toUpperCase() + field.slice(1)}:** ${value}\n`;
      }
    }

    return updated;
  }

  /**
   * Create GitHub issue from agent
   */
  async createIssue(agent, title, body) {
    if (!this.hasPermission(agent, 'create_issue')) {
      const error = new Error('Permission denied');
      this.logAgentAction(agent, 'create_issue', 'github', {
        success: false,
        error: '403 Forbidden',
        title
      });
      throw error;
    }

    try {
      // Log the action
      this.logAgentAction(agent, 'create_issue', 'github', {
        success: true,
        title,
        body: body.substring(0, 100) + '...'
      });

      // In real implementation, would use GitHub API
      // For now, just log
      this.log('info', `Issue created by ${agent}: ${title}`);

      // Notify telemetry bus
      if (this.telemetryBus) {
        this.telemetryBus.emit('agent_action', {
          agent,
          action: 'create_issue',
          target: 'github',
          title,
          timestamp: new Date().toISOString()
        });
      }

      return { success: true, title };
    } catch (error) {
      this.log('error', `Failed to create issue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Trigger auto-repair system
   */
  async triggerRepair(agent) {
    if (!this.hasPermission(agent, 'trigger_auto_repair')) {
      const error = new Error('Permission denied');
      this.logAgentAction(agent, 'trigger_repair', 'system', {
        success: false,
        error: '403 Forbidden'
      });
      throw error;
    }

    try {
      // Log the action
      this.logAgentAction(agent, 'trigger_repair', 'system', {
        success: true,
        timestamp: new Date().toISOString()
      });

      // Execute auto-repair
      const { execSync } = require('child_process');
      const output = execSync('node scripts/auto-repair-gdd.js --auto-fix', {
        cwd: this.rootDir,
        encoding: 'utf8',
        timeout: 120000, // 120s timeout to prevent hangs
        stdio: ['ignore', 'pipe', 'pipe'] // Capture stdout/stderr
      });

      this.log('info', `Auto-repair triggered by ${agent}`);

      // Notify telemetry bus
      if (this.telemetryBus) {
        this.telemetryBus.emit('agent_action', {
          agent,
          action: 'trigger_repair',
          target: 'system',
          timestamp: new Date().toISOString()
        });
      }

      return { success: true, output };
    } catch (error) {
      this.log('error', `Failed to trigger repair: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get system health score
   */
  async getSystemHealth() {
    try {
      const healthPath = path.join(this.rootDir, 'gdd-health.json');

      if (!fs.existsSync(healthPath)) {
        return {
          overall_score: 0,
          average_score: 0,
          healthy_count: 0,
          degraded_count: 0,
          critical_count: 0,
          total_nodes: 0,
          status: 'unknown'
        };
      }

      const healthData = JSON.parse(fs.readFileSync(healthPath, 'utf8'));

      return {
        overall_score: healthData.overall_score ?? 0, // ✅ NEW KEY
        average_score: healthData.overall_score ?? 0, // ✅ NEW KEY (alias for compatibility)
        healthy_count: healthData.healthy_count ?? 0,
        degraded_count: healthData.degraded_count ?? 0,
        critical_count: healthData.critical_count ?? 0,
        total_nodes: healthData.total_nodes ?? 0, // ✅ NEW KEY
        status: healthData.status || 'unknown' // ✅ NEW KEY
      };
    } catch (error) {
      this.log('error', `Failed to get system health: ${error.message}`);
      return {
        overall_score: 0,
        status: 'error'
      };
    }
  }

  /**
   * Log agent action
   */
  logAgentAction(agent, action, target, result) {
    try {
      // Load current log
      const log = JSON.parse(fs.readFileSync(this.logPath, 'utf8'));

      // Create event
      const event = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        agent,
        action,
        target,
        result
      };

      // Add to events
      log.events.push(event);

      // Keep only last 1000 events
      if (log.events.length > 1000) {
        log.events = log.events.slice(-1000);
      }

      // Update metadata
      log.last_updated = new Date().toISOString();
      log.total_events = log.events.length;

      // Write log
      fs.writeFileSync(this.logPath, JSON.stringify(log, null, 2));

      // Also append to markdown history
      this.appendToHistory(event);

      if (this.verbose) {
        this.log('info', `Logged action: ${agent} → ${action} → ${target}`);
      }

      return event;
    } catch (error) {
      this.log('error', `Failed to log action: ${error.message}`);
      return null;
    }
  }

  /**
   * Append event to markdown history
   */
  appendToHistory(event) {
    try {
      // Create history file if not exists
      if (!fs.existsSync(this.historyPath)) {
        const header =
          `# GDD Agent Activity History\n\n` +
          `**Version:** 1.0.0\n` +
          `**Phase:** GDD 2.0 Phase 15\n` +
          `**Created:** ${new Date().toISOString()}\n\n` +
          `---\n\n`;
        fs.writeFileSync(this.historyPath, header);
      }

      // Format event
      const timestamp = new Date(event.timestamp).toLocaleString();
      const status = event.result?.success ? '✅' : '❌';
      const entry =
        `## ${timestamp} - ${event.agent}\n\n` +
        `- ${status} **Action:** ${event.action}\n` +
        `- **Target:** ${event.target}\n` +
        `- **Result:** \`${JSON.stringify(event.result)}\`\n\n` +
        `---\n\n`;

      // Append to file
      fs.appendFileSync(this.historyPath, entry);
    } catch (error) {
      this.log('error', `Failed to append to history: ${error.message}`);
    }
  }

  /**
   * Calculate SHA-256 hash of content
   */
  calculateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Logging utility
   */
  log(level, message) {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };

    const icons = {
      info: '📊',
      success: '✅',
      warn: '⚠️',
      error: '❌'
    };

    const color = colors[level] || colors.info;
    const icon = icons[level] || '•';

    console.log(`${color}${icon} ${message}${colors.reset}`);
  }
}

// Export
module.exports = AgentInterface;

// CLI simulation mode
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--simulate')) {
    console.log('\n🧪 Running Agent Interface Simulation\n');

    const ail = new AgentInterface({ verbose: true });

    // Test scenarios
    (async () => {
      try {
        // 1. Read node
        console.log('\n1️⃣ Testing readNode...');
        const node = await ail.readNode('roasting-engine');
        console.log(`✅ Read node: ${node.name} (hash: ${node.hash.substring(0, 8)}...)`);

        // 2. Get system health
        console.log('\n2️⃣ Testing getSystemHealth...');
        const health = await ail.getSystemHealth();
        console.log(`✅ System health: ${health.overall_score}/100 (${health.status})`);

        // 3. Check permissions
        console.log('\n3️⃣ Testing permissions...');
        console.log(
          `Orchestrator can sync_nodes: ${ail.hasPermission('Orchestrator', 'sync_nodes')}`
        );
        console.log(
          `RuntimeValidator can update_metadata: ${ail.hasPermission('RuntimeValidator', 'update_metadata')}`
        );
        console.log(
          `DriftWatcher can trigger_auto_repair: ${ail.hasPermission('DriftWatcher', 'trigger_auto_repair')}`
        );

        console.log('\n✅ All simulation tests passed!\n');
      } catch (error) {
        console.error('\n❌ Simulation failed:', error.message, '\n');
        process.exit(1);
      }
    })();
  } else {
    console.log('Usage: node agent-interface.js --simulate');
  }
}
