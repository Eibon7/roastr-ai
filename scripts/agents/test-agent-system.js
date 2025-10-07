#!/usr/bin/env node

/**
 * GDD Phase 14 - Agent System Test Suite
 *
 * Comprehensive testing for Agent Interface Layer, Secure Write Protocol,
 * Telemetry Bus, and agent permissions.
 *
 * Test Scenarios:
 * 1. Dry Run - Basic functionality
 * 2. Live Telemetry - Event broadcasting
 * 3. Rollback - Health degradation recovery
 * 4. Permission Denial - Security validation
 * 5. 100 Operations - Stress test
 */

const fs = require('fs');
const path = require('path');
const AgentInterface = require('./agent-interface.js');
const TelemetryBus = require('./telemetry-bus.js');
const SecureWriteProtocol = require('./secure-write.js');

class AgentSystemTester {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.ail = null;
    this.telemetryBus = null;
    this.swp = null;
  }

  /**
   * Log test result
   */
  logTest(name, passed, details = '') {
    this.totalTests++;
    if (passed) {
      this.passedTests++;
      console.log(`✅ ${name}`);
    } else {
      this.failedTests++;
      console.log(`❌ ${name}`);
      if (details) {
        console.log(`   ${details}`);
      }
    }
    this.testResults.push({ name, passed, details });
  }

  /**
   * Test 1: Dry Run - Basic Functionality
   */
  async testDryRun() {
    console.log('\n📋 Test 1: Dry Run - Basic Functionality\n');

    try {
      // Initialize components
      this.ail = new AgentInterface();
      this.telemetryBus = new TelemetryBus();
      this.swp = new SecureWriteProtocol();

      this.ail.setTelemetryBus(this.telemetryBus);

      this.logTest('Agent Interface initialized', true);
      this.logTest('Telemetry Bus initialized', true);
      this.logTest('Secure Write Protocol initialized', true);

      // Test read permission (Orchestrator can read)
      try {
        const hasReadPerm = this.ail.hasPermission('Orchestrator', 'read_nodes');
        this.logTest('Orchestrator has read_nodes permission', hasReadPerm);
      } catch (error) {
        this.logTest('Orchestrator has read_nodes permission', false, error.message);
      }

      // Test read-only restriction (RuntimeValidator cannot write)
      try {
        const canWrite = this.ail.hasPermission('RuntimeValidator', 'update_metadata');
        this.logTest('RuntimeValidator correctly denied write', !canWrite);
      } catch (error) {
        this.logTest('RuntimeValidator correctly denied write', false, error.message);
      }

      // Test statistics retrieval
      try {
        const stats = this.ail.getStatistics();
        this.logTest('Statistics retrieval works', stats !== null);
      } catch (error) {
        this.logTest('Statistics retrieval works', false, error.message);
      }

      // Test telemetry stats
      try {
        const telStats = this.telemetryBus.getStatistics();
        this.logTest('Telemetry statistics work', telStats !== null);
      } catch (error) {
        this.logTest('Telemetry statistics work', false, error.message);
      }

    } catch (error) {
      this.logTest('Dry run initialization', false, error.message);
    }
  }

  /**
   * Test 2: Live Telemetry - Event Broadcasting
   */
  async testLiveTelemetry() {
    console.log('\n📡 Test 2: Live Telemetry - Event Broadcasting\n');

    let eventReceived = false;

    try {
      // Setup event listener
      this.telemetryBus.on('agent-action', (event) => {
        eventReceived = true;
        this.logTest('Telemetry event received', true);
      });

      // Emit test event
      this.telemetryBus.emit('agent-action', {
        type: 'test',
        agent: 'TestAgent',
        action: 'test_action',
        timestamp: new Date().toISOString(),
        success: true
      });

      // Wait briefly for event propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      this.logTest('Telemetry event emitted', eventReceived);

      // Check buffer
      const recentEvents = this.telemetryBus.getRecentEvents(1);
      this.logTest('Event stored in buffer', recentEvents.length > 0);

    } catch (error) {
      this.logTest('Live telemetry test', false, error.message);
    }
  }

  /**
   * Test 3: Rollback - Health Degradation Recovery
   */
  async testRollback() {
    console.log('\n🔄 Test 3: Rollback - Health Degradation Recovery\n');

    try {
      // Create a temporary test file
      const testFile = path.join(process.cwd(), '.test-rollback.txt');
      fs.writeFileSync(testFile, 'Original content', 'utf8');

      // Create backup
      const backup = this.swp.createBackup(testFile);
      this.logTest('Backup created', fs.existsSync(backup.backupPath));

      // Execute write with simulated health degradation
      const writeResult = await this.swp.executeWrite({
        agent: 'TestAgent',
        action: 'test_write',
        target: testFile,
        content: 'Modified content',
        healthBefore: 95
      });

      this.logTest('Write executed', writeResult.success);

      // Simulate health degradation and rollback
      const healthAfter = 90; // Degraded
      const rollbackResult = await this.swp.rollbackIfNeeded(writeResult, healthAfter);

      this.logTest('Rollback triggered on health degradation', rollbackResult.rollbackNeeded);
      this.logTest('Rollback successful', rollbackResult.rollbackSuccess || false);

      // Verify content restored
      const restoredContent = fs.readFileSync(testFile, 'utf8');
      this.logTest('Content restored to original', restoredContent === 'Original content');

      // Cleanup
      fs.unlinkSync(testFile);
      if (fs.existsSync(backup.backupPath)) {
        fs.unlinkSync(backup.backupPath);
        const metaPath = `${backup.backupPath}.meta.json`;
        if (fs.existsSync(metaPath)) {
          fs.unlinkSync(metaPath);
        }
      }

    } catch (error) {
      this.logTest('Rollback test', false, error.message);
    }
  }

  /**
   * Test 4: Permission Denial - Security Validation
   */
  async testPermissionDenial() {
    console.log('\n🔒 Test 4: Permission Denial - Security Validation\n');

    try {
      // Test 1: RuntimeValidator (read-only) attempts write
      try {
        await this.ail.writeNodeField('test', 'test_field', 'test_value', 'RuntimeValidator');
        this.logTest('RuntimeValidator write correctly denied', false);
      } catch (error) {
        this.logTest(
          'RuntimeValidator write correctly denied',
          error.message.includes('Permission denied'),
          error.message
        );
      }

      // Test 2: Unknown agent
      try {
        this.ail.hasPermission('UnknownAgent', 'read_nodes');
        this.logTest('Unknown agent correctly rejected', false);
      } catch (error) {
        this.logTest('Unknown agent correctly rejected', true);
      }

      // Test 3: Restricted field access
      const isRestricted = this.ail.isFieldRestricted('DriftWatcher', 'dependencies');
      this.logTest('Restricted field correctly identified', isRestricted);

      // Test 4: Rate limiting (simulate)
      let rateLimitHit = false;
      for (let i = 0; i < 65; i++) { // Exceed 60/min limit
        if (!this.ail.checkRateLimit('TestAgent', 'actions')) {
          rateLimitHit = true;
          break;
        }
      }
      this.logTest('Rate limiting works', rateLimitHit);

    } catch (error) {
      this.logTest('Permission denial test', false, error.message);
    }
  }

  /**
   * Test 5: 100 Operations - Stress Test
   */
  async test100Operations() {
    console.log('\n💪 Test 5: 100 Operations - Stress Test\n');

    let successCount = 0;
    const startTime = Date.now();

    try {
      for (let i = 0; i < 100; i++) {
        try {
          // Alternate between different operations
          if (i % 3 === 0) {
            // Read operation
            this.ail.hasPermission('Orchestrator', 'read_nodes');
            successCount++;
          } else if (i % 3 === 1) {
            // Emit telemetry event
            this.telemetryBus.emit('agent-action', {
              type: 'test',
              agent: 'StressTest',
              action: `operation_${i}`,
              timestamp: new Date().toISOString(),
              success: true
            });
            successCount++;
          } else {
            // Get statistics
            this.ail.getStatistics();
            successCount++;
          }
        } catch (error) {
          // Expected for some operations (rate limiting, etc.)
        }

        // Brief delay every 20 operations to avoid overwhelming
        if (i % 20 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      this.logTest(`100 operations completed in ${duration}ms`, true);
      this.logTest(`Success rate: ${successCount}%`, successCount >= 95);

      // Verify system health maintained
      const finalStats = this.ail.getStatistics();
      this.logTest('System statistics accessible after stress', finalStats !== null);

      const telemetryStats = this.telemetryBus.getStatistics();
      this.logTest('Telemetry operational after stress', telemetryStats !== null);

    } catch (error) {
      this.logTest('100 operations test', false, error.message);
    }
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`\nTotal Tests: ${this.totalTests}`);
    console.log(`✅ Passed: ${this.passedTests}`);
    console.log(`❌ Failed: ${this.failedTests}`);
    console.log(`\nSuccess Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);

    if (this.failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.name}`);
          if (r.details) {
            console.log(`    ${r.details}`);
          }
        });
    }

    console.log('\n' + '='.repeat(60));

    // Save results to file
    const resultsPath = path.join(process.cwd(), 'test-results-agent-system.json');
    fs.writeFileSync(resultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalTests: this.totalTests,
      passed: this.passedTests,
      failed: this.failedTests,
      successRate: (this.passedTests / this.totalTests) * 100,
      results: this.testResults
    }, null, 2), 'utf8');

    console.log(`\n📝 Results saved to: ${resultsPath}\n`);

    return this.failedTests === 0;
  }

  /**
   * Run all tests
   */
  async runAll() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  GDD Agent System Test Suite          ║');
    console.log('╚════════════════════════════════════════╝');

    await this.testDryRun();
    await this.testLiveTelemetry();
    await this.testRollback();
    await this.testPermissionDenial();
    await this.test100Operations();

    const success = this.printSummary();
    process.exit(success ? 0 : 1);
  }
}

// CLI
if (require.main === module) {
  const tester = new AgentSystemTester();

  const command = process.argv[2];

  if (command === '--help') {
    console.log(`
GDD Agent System Test Suite

Usage:
  node test-agent-system.js [test-name]

Tests:
  dry-run            Test 1: Basic functionality
  telemetry          Test 2: Live telemetry
  rollback           Test 3: Rollback on health degradation
  permissions        Test 4: Permission denial
  stress             Test 5: 100 operations stress test
  (no argument)      Run all tests

Examples:
  node test-agent-system.js
  node test-agent-system.js rollback
    `);
    process.exit(0);
  }

  (async () => {
    const tester = new AgentSystemTester();

    // Initialize components for single test mode
    tester.ail = new AgentInterface();
    tester.telemetryBus = new TelemetryBus();
    tester.swp = new SecureWriteProtocol();
    tester.ail.setTelemetryBus(tester.telemetryBus);

    if (command === 'dry-run') {
      await tester.testDryRun();
      tester.printSummary();
    } else if (command === 'telemetry') {
      await tester.testLiveTelemetry();
      tester.printSummary();
    } else if (command === 'rollback') {
      await tester.testRollback();
      tester.printSummary();
    } else if (command === 'permissions') {
      await tester.testPermissionDenial();
      tester.printSummary();
    } else if (command === 'stress') {
      await tester.test100Operations();
      tester.printSummary();
    } else {
      await tester.runAll();
    }
  })();
}

module.exports = AgentSystemTester;
