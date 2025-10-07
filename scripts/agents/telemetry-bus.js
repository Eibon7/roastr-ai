#!/usr/bin/env node

/**
 * GDD 2.0 Phase 14.1 - Telemetry Bus
 *
 * Real-time event broadcasting system for GDD agent actions.
 * Supports WebSocket connections and maintains event buffer.
 *
 * @module telemetry-bus
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

/**
 * Telemetry Bus - Lightweight event broadcasting system
 */
class TelemetryBus extends EventEmitter {
  constructor() {
    super();
    this.events = [];
    this.maxEvents = 100; // Buffer size
    this.subscribers = new Set();
    this.startTime = Date.now();
    this.statsFile = path.join(process.cwd(), 'telemetry', 'telemetry-stats.json');

    this._ensureTelemetryDir();
    this._setupEventHandlers();
  }

  /**
   * Ensure telemetry directory exists
   * @private
   */
  _ensureTelemetryDir() {
    const telemetryDir = path.join(process.cwd(), 'telemetry');
    if (!fs.existsSync(telemetryDir)) {
      fs.mkdirSync(telemetryDir, { recursive: true });
    }
  }

  /**
   * Setup internal event handlers
   * @private
   */
  _setupEventHandlers() {
    this.on('agent-action', (event) => {
      this._recordEvent(event);
      this._broadcastToSubscribers(event);
    });
  }

  /**
   * Record event in buffer
   * @private
   */
  _recordEvent(event) {
    const enrichedEvent = {
      ...event,
      id: this._generateEventId(),
      receivedAt: new Date().toISOString()
    };

    this.events.push(enrichedEvent);

    // Maintain buffer size
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Update stats
    this._updateStats(enrichedEvent);
  }

  /**
   * Generate unique event ID
   * @private
   */
  _generateEventId() {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Broadcast event to all subscribers
   * @private
   */
  _broadcastToSubscribers(event) {
    const message = JSON.stringify(event);
    this.subscribers.forEach(subscriber => {
      try {
        subscriber.send(message);
      } catch (error) {
        console.warn('Failed to send to subscriber:', error.message);
        this.subscribers.delete(subscriber);
      }
    });
  }

  /**
   * Update statistics
   * @private
   */
  _updateStats(event) {
    const stats = this._loadStats();

    // Update counts
    stats.totalEvents = (stats.totalEvents || 0) + 1;
    stats.eventsByType = stats.eventsByType || {};
    stats.eventsByType[event.type] = (stats.eventsByType[event.type] || 0) + 1;

    stats.eventsByAgent = stats.eventsByAgent || {};
    stats.eventsByAgent[event.agent] = (stats.eventsByAgent[event.agent] || 0) + 1;

    // Update health delta stats
    if (event.deltaHealth !== undefined) {
      stats.totalHealthDelta = (stats.totalHealthDelta || 0) + event.deltaHealth;
      stats.healthEvents = (stats.healthEvents || 0) + 1;
      stats.avgHealthDelta = stats.totalHealthDelta / stats.healthEvents;
    }

    stats.lastUpdated = new Date().toISOString();

    this._saveStats(stats);
  }

  /**
   * Load statistics
   * @private
   */
  _loadStats() {
    try {
      if (fs.existsSync(this.statsFile)) {
        const content = fs.readFileSync(this.statsFile, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('Failed to load stats:', error.message);
    }
    return {
      created: new Date().toISOString(),
      totalEvents: 0,
      eventsByType: {},
      eventsByAgent: {}
    };
  }

  /**
   * Save statistics
   * @private
   */
  _saveStats(stats) {
    try {
      fs.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save stats:', error.message);
    }
  }

  /**
   * Subscribe to events (for WebSocket clients)
   * @param {Object} subscriber - Subscriber with send() method
   */
  subscribe(subscriber) {
    this.subscribers.add(subscriber);
    console.log(`📡 New subscriber connected (total: ${this.subscribers.size})`);

    // Send recent events to new subscriber
    this.events.slice(-10).forEach(event => {
      try {
        subscriber.send(JSON.stringify(event));
      } catch (error) {
        console.warn('Failed to send initial events:', error.message);
      }
    });
  }

  /**
   * Unsubscribe from events
   * @param {Object} subscriber - Subscriber to remove
   */
  unsubscribe(subscriber) {
    this.subscribers.delete(subscriber);
    console.log(`📡 Subscriber disconnected (remaining: ${this.subscribers.size})`);
  }

  /**
   * Get recent events
   * @param {number} count - Number of events to retrieve
   * @returns {Array} Recent events
   */
  getRecentEvents(count = 20) {
    return this.events.slice(-count);
  }

  /**
   * Get events by agent
   * @param {string} agent - Agent name
   * @param {number} count - Max events to return
   * @returns {Array} Filtered events
   */
  getEventsByAgent(agent, count = 20) {
    return this.events
      .filter(e => e.agent === agent)
      .slice(-count);
  }

  /**
   * Get events by type
   * @param {string} type - Event type
   * @param {number} count - Max events to return
   * @returns {Array} Filtered events
   */
  getEventsByType(type, count = 20) {
    return this.events
      .filter(e => e.type === type)
      .slice(-count);
  }

  /**
   * Get event statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const stats = this._loadStats();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      ...stats,
      currentBufferSize: this.events.length,
      maxBufferSize: this.maxEvents,
      activeSubscribers: this.subscribers.size,
      uptimeSeconds: uptime,
      uptimeFormatted: this._formatUptime(uptime)
    };
  }

  /**
   * Format uptime in human-readable format
   * @private
   */
  _formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  }

  /**
   * Clear event buffer
   */
  clearBuffer() {
    const count = this.events.length;
    this.events = [];
    console.log(`🗑️  Cleared ${count} events from buffer`);
  }

  /**
   * Export events to file
   * @param {string} filePath - Export file path
   */
  exportEvents(filePath) {
    const data = {
      exported: new Date().toISOString(),
      eventCount: this.events.length,
      events: this.events
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`📦 Exported ${this.events.length} events to ${filePath}`);
  }
}

// CLI interface
if (require.main === module) {
  const bus = new TelemetryBus();
  const command = process.argv[2];

  if (command === '--listen') {
    console.log('\n🎧 Telemetry Bus Listener Started\n');
    console.log('Listening for agent events... (Ctrl+C to exit)\n');

    bus.on('agent-action', (event) => {
      const timestamp = new Date(event.timestamp || event.receivedAt).toLocaleTimeString();
      const statusIcon = event.success === false ? '❌' : event.type === 'rollback' ? '🔄' : '✅';

      console.log(`[${timestamp}] ${statusIcon} ${event.agent} → ${event.action}`);

      if (event.target) {
        console.log(`  Target: ${event.target}`);
      }

      if (event.deltaHealth !== undefined) {
        const deltaSign = event.deltaHealth >= 0 ? '+' : '';
        const deltaColor = event.deltaHealth >= 0 ? '🟢' : '🔴';
        console.log(`  ΔHealth: ${deltaColor} ${deltaSign}${event.deltaHealth.toFixed(2)}`);
      }

      if (event.error) {
        console.log(`  Error: ${event.error}`);
      }

      console.log('');
    });

    // Display stats every 30 seconds
    setInterval(() => {
      const stats = bus.getStatistics();
      console.log(`\n📊 Stats: ${stats.totalEvents} events | ${stats.activeSubscribers} subscribers | Uptime: ${stats.uptimeFormatted}\n`);
    }, 30000);

    // Keep process alive
    process.stdin.resume();

  } else if (command === '--stats') {
    const stats = bus.getStatistics();
    console.log('\n📊 Telemetry Bus Statistics\n');
    console.log(`  Total Events: ${stats.totalEvents}`);
    console.log(`  Buffer: ${stats.currentBufferSize}/${stats.maxBufferSize}`);
    console.log(`  Active Subscribers: ${stats.activeSubscribers}`);
    console.log(`  Uptime: ${stats.uptimeFormatted}`);
    console.log('\n  Events by Type:');
    Object.entries(stats.eventsByType || {}).forEach(([type, count]) => {
      console.log(`    ${type}: ${count}`);
    });
    console.log('\n  Events by Agent:');
    Object.entries(stats.eventsByAgent || {}).forEach(([agent, count]) => {
      console.log(`    ${agent}: ${count}`);
    });
    if (stats.avgHealthDelta !== undefined) {
      console.log(`\n  Avg ΔHealth: ${stats.avgHealthDelta.toFixed(2)}`);
    }
    console.log('');

  } else if (command === '--recent') {
    const count = parseInt(process.argv[3]) || 10;
    const events = bus.getRecentEvents(count);
    console.log(`\n📜 Recent ${count} Events\n`);
    events.forEach((event, i) => {
      console.log(`${i + 1}. [${event.agent}] ${event.action} on ${event.target || 'system'}`);
      console.log(`   ${event.timestamp || event.receivedAt}`);
    });
    console.log('');

  } else if (command === '--export') {
    const filePath = process.argv[3] || `telemetry/export-${Date.now()}.json`;
    bus.exportEvents(filePath);

  } else if (command === '--clear') {
    bus.clearBuffer();

  } else {
    console.log(`
GDD Telemetry Bus CLI

Commands:
  --listen              Listen for events in real-time
  --stats               Show telemetry statistics
  --recent [N]          Show N recent events (default: 10)
  --export [file]       Export events to JSON file
  --clear               Clear event buffer

Examples:
  node telemetry-bus.js --listen
  node telemetry-bus.js --stats
  node telemetry-bus.js --recent 20
  node telemetry-bus.js --export telemetry/my-export.json

Integration:
  const TelemetryBus = require('./telemetry-bus.js');
  const bus = new TelemetryBus();

  // In agent-interface.js:
  ail.setTelemetryBus(bus);

  // Subscribe to events:
  bus.on('agent-action', (event) => {
    console.log('Event:', event);
  });
    `);
  }
}

module.exports = TelemetryBus;
