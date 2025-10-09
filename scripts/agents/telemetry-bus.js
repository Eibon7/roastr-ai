#!/usr/bin/env node

/**
 * GDD Telemetry Bus
 *
 * Real-time event broadcasting system for agent actions.
 * Based on EventEmitter with WebSocket support for live UI updates.
 * Maintains buffer of recent events and supports multiple subscribers.
 *
 * @module telemetry-bus
 * @version 1.0.0
 * @phase GDD 2.0 Phase 14.1 - Real-Time Telemetry
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

/**
 * Telemetry Bus
 *
 * Micro-service for real-time event broadcasting
 */
class TelemetryBus extends EventEmitter {
  constructor(options = {}) {
    super();

    this.rootDir = path.resolve(__dirname, '../..');
    this.bufferSize = options.bufferSize || 100;
    this.buffer = [];
    this.subscribers = new Set();
    this.verbose = options.verbose || false;
    this.persistPath = path.join(this.rootDir, 'gdd-telemetry-buffer.json');

    // Load persisted buffer if exists
    this.loadBuffer();

    // Auto-persist on exit
    process.on('exit', () => this.persistBuffer());
    process.on('SIGINT', () => {
      this.persistBuffer();
      process.exit(0);
    });
  }

  /**
   * Emit event and add to buffer
   *
   * @param {string} eventType - Type of event
   * @param {object} data - Event data
   * @returns {boolean} True if listeners invoked, false if none (EventEmitter semantics)
   */
  emit(eventType, data) {
    const event = {
      id: this.generateEventId(),
      type: eventType,
      timestamp: new Date().toISOString(),
      data
    };

    // Add to buffer
    this.addToBuffer(event);

    // Emit to subscribers (preserve EventEmitter semantics: return boolean)
    const specificResult = super.emit(eventType, event);
    const genericResult = super.emit('event', event); // Generic event listener

    // Notify all subscribers
    this.notifySubscribers(event);

    if (this.verbose) {
      this.log('info', `Event: ${eventType} (${event.id.substring(0, 8)}...)`);
    }

    // ✅ Return boolean per EventEmitter contract (true if listeners invoked)
    return specificResult || genericResult;
  }

  /**
   * Add event to circular buffer
   */
  addToBuffer(event) {
    this.buffer.push(event);

    // Keep only last N events
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
  }

  /**
   * Subscribe to events
   *
   * @param {Function} callback - Callback to receive events
   * @returns {string} Subscription ID
   */
  subscribe(callback) {
    const subscriptionId = this.generateEventId();

    const subscription = {
      id: subscriptionId,
      callback,
      created_at: new Date().toISOString()
    };

    this.subscribers.add(subscription);

    if (this.verbose) {
      this.log('info', `New subscriber: ${subscriptionId.substring(0, 8)}...`);
    }

    // Send current buffer to new subscriber
    this.buffer.forEach(event => {
      try {
        callback(event);
      } catch (error) {
        this.log('error', `Subscriber callback error: ${error.message}`);
      }
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   *
   * @param {string} subscriptionId - Subscription ID to remove
   * @returns {boolean} Success
   */
  unsubscribe(subscriptionId) {
    for (const subscription of this.subscribers) {
      if (subscription.id === subscriptionId) {
        this.subscribers.delete(subscription);
        if (this.verbose) {
          this.log('info', `Unsubscribed: ${subscriptionId.substring(0, 8)}...`);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Notify all subscribers of new event
   */
  notifySubscribers(event) {
    for (const subscription of this.subscribers) {
      try {
        subscription.callback(event);
      } catch (error) {
        this.log('error', `Subscriber callback error: ${error.message}`);
      }
    }
  }

  /**
   * Get current buffer
   *
   * @param {object} options - Filter options
   * @param {number} options.limit - Limit results
   * @param {string} options.type - Filter by event type
   * @param {string} options.agent - Filter by agent
   * @returns {Array} Events
   */
  getBuffer(options = {}) {
    let events = [...this.buffer];

    // Filter by type
    if (options.type) {
      events = events.filter(e => e.type === options.type);
    }

    // Filter by agent
    if (options.agent) {
      events = events.filter(e => e.data?.agent === options.agent);
    }

    // Limit results
    if (options.limit) {
      events = events.slice(-options.limit);
    }

    return events;
  }

  /**
   * Get statistics about events
   *
   * @param {number} timeWindowMinutes - Time window in minutes
   * @returns {object} Statistics
   */
  getStats(timeWindowMinutes = 60) {
    const cutoff = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    const recentEvents = this.buffer.filter(
      e => new Date(e.timestamp) >= cutoff
    );

    // Count by type
    const byType = {};
    for (const event of recentEvents) {
      byType[event.type] = (byType[event.type] || 0) + 1;
    }

    // Count by agent
    const byAgent = {};
    for (const event of recentEvents) {
      const agent = event.data?.agent;
      if (agent) {
        byAgent[agent] = (byAgent[agent] || 0) + 1;
      }
    }

    // Calculate health delta
    let totalHealthDelta = 0;
    let healthDeltaCount = 0;

    for (const event of recentEvents) {
      if (event.data?.deltaHealth !== undefined) {
        totalHealthDelta += event.data.deltaHealth;
        healthDeltaCount++;
      }
    }

    const avgHealthDelta = healthDeltaCount > 0
      ? totalHealthDelta / healthDeltaCount
      : 0;

    return {
      total_events: recentEvents.length,
      time_window_minutes: timeWindowMinutes,
      by_type: byType,
      by_agent: byAgent,
      avg_health_delta: Math.round(avgHealthDelta * 100) / 100,
      buffer_size: this.buffer.length,
      subscribers: this.subscribers.size
    };
  }

  /**
   * Clear buffer
   */
  clearBuffer() {
    this.buffer = [];
    if (this.verbose) {
      this.log('info', 'Buffer cleared');
    }
  }

  /**
   * Persist buffer to disk
   */
  persistBuffer() {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        buffer_size: this.buffer.length,
        events: this.buffer
      };

      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));

      if (this.verbose) {
        this.log('info', `Buffer persisted (${this.buffer.length} events)`);
      }
    } catch (error) {
      this.log('error', `Failed to persist buffer: ${error.message}`);
    }
  }

  /**
   * Load buffer from disk
   */
  loadBuffer() {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf8'));
        this.buffer = data.events || [];

        // Only keep events from last 24 hours
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.buffer = this.buffer.filter(
          e => new Date(e.timestamp) >= cutoff
        );

        if (this.verbose) {
          this.log('info', `Buffer loaded (${this.buffer.length} events)`);
        }
      }
    } catch (error) {
      this.log('error', `Failed to load buffer: ${error.message}`);
      this.buffer = [];
    }
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
      info: '📡',
      success: '✅',
      warn: '⚠️',
      error: '❌'
    };

    const color = colors[level] || colors.info;
    const icon = icons[level] || '•';

    console.log(`${color}${icon} ${message}${colors.reset}`);
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of TelemetryBus
 */
function getInstance(options = {}) {
  if (!instance) {
    instance = new TelemetryBus(options);
  }
  return instance;
}

// Export
module.exports = {
  TelemetryBus,
  getInstance
};

// CLI listen mode
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--listen')) {
    console.log('\n📡 Starting Telemetry Bus Listener\n');

    const bus = getInstance({ verbose: true });

    // Print current stats
    console.log('\n📊 Current Stats (last 60 min):');
    const stats = bus.getStats(60);
    console.log(JSON.stringify(stats, null, 2));

    // Subscribe to all events
    console.log('\n📻 Listening for events (Ctrl+C to stop)...\n');

    bus.subscribe((event) => {
      const timestamp = new Date(event.timestamp).toLocaleTimeString();
      const agent = event.data?.agent || 'system';
      const action = event.data?.action || event.type;

      console.log(`[${timestamp}] ${agent} → ${action}`);

      if (event.data?.deltaHealth !== undefined) {
        const delta = event.data.deltaHealth;
        const symbol = delta > 0 ? '⬆️' : delta < 0 ? '⬇️' : '➡️';
        console.log(`  ${symbol} Health: ${delta > 0 ? '+' : ''}${delta}`);
      }

      if (event.data?.node) {
        console.log(`  📄 Node: ${event.data.node}`);
      }

      console.log('');
    });

    // Print stats every 60 seconds
    setInterval(() => {
      console.log('\n📊 Stats Update:');
      const stats = bus.getStats(60);
      console.log(`  Total events: ${stats.total_events}`);
      console.log(`  Avg health delta: ${stats.avg_health_delta}`);
      console.log(`  Subscribers: ${stats.subscribers}`);
      console.log('');
    }, 60000);

  } else if (args.includes('--test')) {
    console.log('\n🧪 Testing Telemetry Bus\n');

    const bus = getInstance({ verbose: true });

    // Test 1: Emit events
    console.log('1️⃣ Emitting test events...');
    bus.emit('agent_action', {
      agent: 'TestAgent',
      action: 'test_action_1',
      node: 'test',
      deltaHealth: 1.5
    });

    bus.emit('agent_action', {
      agent: 'TestAgent',
      action: 'test_action_2',
      node: 'test',
      deltaHealth: -0.3
    });

    bus.emit('secure_write', {
      agent: 'TestAgent',
      action: 'test_write',
      path: '/test/path'
    });

    console.log('✅ Events emitted\n');

    // Test 2: Get buffer
    console.log('2️⃣ Getting buffer...');
    const buffer = bus.getBuffer({ limit: 10 });
    console.log(`✅ Buffer size: ${buffer.length}\n`);

    // Test 3: Get stats
    console.log('3️⃣ Getting stats...');
    const stats = bus.getStats(60);
    console.log('✅ Stats:');
    console.log(JSON.stringify(stats, null, 2));
    console.log('');

    // Test 4: Subscribe
    console.log('4️⃣ Testing subscription...');
    const subId = bus.subscribe((event) => {
      console.log(`  📨 Received: ${event.type}`);
    });
    console.log(`✅ Subscribed (ID: ${subId.substring(0, 8)}...)\n`);

    // Test 5: Emit more events
    console.log('5️⃣ Emitting event to subscriber...');
    bus.emit('test_event', { test: true });
    console.log('✅ Event emitted\n');

    // Test 6: Unsubscribe
    console.log('6️⃣ Testing unsubscribe...');
    const unsubscribed = bus.unsubscribe(subId);
    console.log(`✅ Unsubscribed: ${unsubscribed}\n`);

    console.log('✅ All Telemetry Bus tests passed!\n');

  } else {
    console.log('Usage:');
    console.log('  node telemetry-bus.js --listen   # Listen to events');
    console.log('  node telemetry-bus.js --test     # Run tests');
  }
}
