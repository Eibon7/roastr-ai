#!/usr/bin/env node

/**
 * Test Suite for CodeRabbit Review #3311652574 Fixes
 *
 * Tests the following security and architecture fixes:
 * 1. Command injection prevention in createIssue (execFileSync)
 * 2. Read-only agent permission logic (whitelist approach)
 * 3. Memory leak prevention in AgentActivityMonitor (interval cleanup)
 *
 * Run with: node scripts/agents/test-agent-interface-fixes.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AgentInterface = require('./agent-interface.js');

class ReviewFixesTester {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
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
   * Test 1: Command Injection Prevention
   * Verify that createIssue uses execFileSync instead of execSync
   */
  testCommandInjectionPrevention() {
    console.log('\n🔒 Test 1: Command Injection Prevention\n');

    try {
      // Read the agent-interface.js file
      const filePath = path.join(__dirname, 'agent-interface.js');
      const content = fs.readFileSync(filePath, 'utf8');

      // Check that execFileSync is imported
      const hasExecFileSync = content.includes('execFileSync');
      this.logTest(
        'execFileSync is imported',
        hasExecFileSync,
        hasExecFileSync ? '' : 'execFileSync not found in imports'
      );

      // Check that createIssue uses execFileSync with array arguments
      const createIssueMatch = content.match(/async createIssue[\s\S]+?execFileSync\s*\(\s*'gh'\s*,\s*\[/);
      this.logTest(
        'createIssue uses execFileSync with array arguments',
        createIssueMatch !== null,
        createIssueMatch ? '' : 'createIssue does not use execFileSync with array syntax'
      );

      // Verify no dangerous execSync patterns in createIssue
      const createIssueSection = content.match(/async createIssue[\s\S]+?catch \(error\)/);
      if (createIssueSection) {
        const hasExecSync = createIssueSection[0].includes('execSync(');
        this.logTest(
          'createIssue does not use execSync',
          !hasExecSync,
          hasExecSync ? 'Found execSync in createIssue - security risk!' : ''
        );
      }

      // Check that gh CLI arguments are properly separated
      const hasProperArgs = content.includes("'gh',") &&
                           content.includes("'issue',") &&
                           content.includes("'create',");
      this.logTest(
        'gh CLI arguments are properly separated',
        hasProperArgs,
        hasProperArgs ? '' : 'gh CLI arguments not properly separated in array'
      );

    } catch (error) {
      this.logTest('Command injection prevention test', false, error.message);
    }
  }

  /**
   * Test 2: Read-only Agent Permission Logic
   * Verify that read-only agents can call non-mutating actions
   */
  testReadOnlyPermissionLogic() {
    console.log('\n🔐 Test 2: Read-only Agent Permission Logic\n');

    try {
      const ail = new AgentInterface();

      // Test 1: RuntimeValidator (read-only) can call trigger_validation
      const canTriggerValidation = ail.hasPermission('RuntimeValidator', 'trigger_validation');
      this.logTest(
        'RuntimeValidator can call trigger_validation',
        canTriggerValidation,
        canTriggerValidation ? '' : 'trigger_validation should be allowed for read-only agents'
      );

      // Test 2: RuntimeValidator (read-only) can call read_nodes
      const canReadNodes = ail.hasPermission('RuntimeValidator', 'read_nodes');
      this.logTest(
        'RuntimeValidator can call read_nodes',
        canReadNodes,
        canReadNodes ? '' : 'read_nodes should be allowed for read-only agents'
      );

      // Test 3: RuntimeValidator (read-only) CANNOT call update_metadata
      const cannotUpdate = !ail.hasPermission('RuntimeValidator', 'update_metadata');
      this.logTest(
        'RuntimeValidator cannot call update_metadata',
        cannotUpdate,
        cannotUpdate ? '' : 'update_metadata should be blocked for read-only agents'
      );

      // Test 4: RuntimeValidator (read-only) CANNOT call write_field
      const cannotWrite = !ail.hasPermission('RuntimeValidator', 'write_field');
      this.logTest(
        'RuntimeValidator cannot call write_field',
        cannotWrite,
        cannotWrite ? '' : 'write_field should be blocked for read-only agents'
      );

      // Test 5: RuntimeValidator (read-only) CANNOT call create_issue
      const cannotCreate = !ail.hasPermission('RuntimeValidator', 'create_issue');
      this.logTest(
        'RuntimeValidator cannot call create_issue',
        cannotCreate,
        cannotCreate ? '' : 'create_issue should be blocked for read-only agents'
      );

      // Test 6: RuntimeValidator (read-only) CANNOT call trigger_auto_repair
      const cannotRepair = !ail.hasPermission('RuntimeValidator', 'trigger_auto_repair');
      this.logTest(
        'RuntimeValidator cannot call trigger_auto_repair',
        cannotRepair,
        cannotRepair ? '' : 'trigger_auto_repair should be blocked for read-only agents'
      );

      // Test 7: Verify whitelist approach by checking code
      const filePath = path.join(__dirname, 'agent-interface.js');
      const content = fs.readFileSync(filePath, 'utf8');
      const hasMutatingPrefixes = content.includes('mutatingPrefixes');
      this.logTest(
        'Code uses whitelist approach (mutatingPrefixes)',
        hasMutatingPrefixes,
        hasMutatingPrefixes ? '' : 'mutatingPrefixes array not found - whitelist not implemented'
      );

      // Test 8: Verify the mutating prefixes list includes critical operations
      const hasCriticalPrefixes = content.includes("'update_'") &&
                                  content.includes("'write_'") &&
                                  content.includes("'create_'") &&
                                  content.includes("'delete_'") &&
                                  content.includes("'trigger_auto_repair'");
      this.logTest(
        'Mutating prefixes include all critical operations',
        hasCriticalPrefixes,
        hasCriticalPrefixes ? '' : 'Missing critical prefixes in mutatingPrefixes array'
      );

    } catch (error) {
      this.logTest('Read-only permission logic test', false, error.message);
    }
  }

  /**
   * Test 3: Memory Leak Prevention
   * Verify that AgentActivityMonitor properly cleans up intervals
   */
  testMemoryLeakPrevention() {
    console.log('\n🧠 Test 3: Memory Leak Prevention\n');

    try {
      // Read the AgentActivityMonitor.tsx file
      const filePath = path.join(
        process.cwd(),
        'admin-dashboard',
        'src',
        'components',
        'dashboard',
        'AgentActivityMonitor.tsx'
      );

      if (!fs.existsSync(filePath)) {
        this.logTest(
          'AgentActivityMonitor.tsx exists',
          false,
          'File not found - skipping memory leak tests'
        );
        return;
      }

      const content = fs.readFileSync(filePath, 'utf8');

      // Test 1: pollIntervalRef is declared
      const hasPollIntervalRef = content.includes('pollIntervalRef');
      this.logTest(
        'pollIntervalRef is declared',
        hasPollIntervalRef,
        hasPollIntervalRef ? '' : 'pollIntervalRef not found in component'
      );

      // Test 2: useRef is used for pollIntervalRef
      const usesUseRef = content.match(/pollIntervalRef\s*=\s*useRef/);
      this.logTest(
        'pollIntervalRef uses useRef',
        usesUseRef !== null,
        usesUseRef ? '' : 'pollIntervalRef should use useRef hook'
      );

      // Test 3: Interval is stored in pollIntervalRef.current
      const storesInterval = content.match(/pollIntervalRef\.current\s*=\s*setInterval/);
      this.logTest(
        'setInterval result is stored in pollIntervalRef.current',
        storesInterval !== null,
        storesInterval ? '' : 'setInterval result not stored in ref'
      );

      // Test 4: disconnectWebSocket clears interval
      const clearsInterval = content.match(/disconnectWebSocket[\s\S]*clearInterval\s*\(\s*pollIntervalRef\.current/);
      this.logTest(
        'disconnectWebSocket clears interval',
        clearsInterval !== null,
        clearsInterval ? '' : 'disconnectWebSocket does not clear interval'
      );

      // Test 5: pollIntervalRef is nulled after clearing
      const nullsRef = content.match(/clearInterval[\s\S]{0,100}pollIntervalRef\.current\s*=\s*null/);
      this.logTest(
        'pollIntervalRef.current is set to null after clearing',
        nullsRef !== null,
        nullsRef ? '' : 'pollIntervalRef.current should be set to null after clearing'
      );

      // Test 6: connectWebSocket checks for existing interval before creating new one
      const checksExisting = content.match(/connectWebSocket[\s\S]{0,200}if\s*\(\s*pollIntervalRef\.current/);
      this.logTest(
        'connectWebSocket checks for existing interval',
        checksExisting !== null,
        checksExisting ? '' : 'connectWebSocket should check for existing interval'
      );

    } catch (error) {
      this.logTest('Memory leak prevention test', false, error.message);
    }
  }

  /**
   * Test 4: Workflow Auto-commit Fix
   * Verify that gdd-telemetry.yml has proper conditional
   */
  testWorkflowAutocommit() {
    console.log('\n⚙️  Test 4: Workflow Auto-commit Conditional\n');

    try {
      const filePath = path.join(process.cwd(), '.github', 'workflows', 'gdd-telemetry.yml');

      if (!fs.existsSync(filePath)) {
        this.logTest(
          'gdd-telemetry.yml exists',
          false,
          'File not found - skipping workflow tests'
        );
        return;
      }

      const content = fs.readFileSync(filePath, 'utf8');

      // Test 1: Commit step has conditional
      const hasConditional = content.match(/name:\s*Commit telemetry data[\s\S]{0,100}if:\s*github\.event_name\s*!=\s*'pull_request'/);
      this.logTest(
        'Commit step has pull_request conditional',
        hasConditional !== null,
        hasConditional ? '' : 'Commit step missing conditional to skip on pull requests'
      );

      // Test 2: Uses stefanzweifel/git-auto-commit-action
      const usesAutoCommit = content.includes('stefanzweifel/git-auto-commit-action');
      this.logTest(
        'Uses git-auto-commit-action',
        usesAutoCommit,
        usesAutoCommit ? '' : 'git-auto-commit-action not found'
      );

      // Test 3: Conditional comes before action
      const lines = content.split('\n');
      let commitLineIndex = -1;
      let ifLineIndex = -1;
      let usesLineIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('name: Commit telemetry data')) {
          commitLineIndex = i;
        }
        if (commitLineIndex !== -1 && ifLineIndex === -1 && lines[i].trim().startsWith('if:')) {
          ifLineIndex = i;
        }
        if (commitLineIndex !== -1 && lines[i].includes('stefanzweifel/git-auto-commit-action')) {
          usesLineIndex = i;
          break;
        }
      }

      const properOrder = commitLineIndex !== -1 &&
                         ifLineIndex !== -1 &&
                         usesLineIndex !== -1 &&
                         commitLineIndex < ifLineIndex &&
                         ifLineIndex < usesLineIndex;

      this.logTest(
        'Conditional appears before action invocation',
        properOrder,
        properOrder ? '' : 'if: conditional must come before uses: in the step'
      );

    } catch (error) {
      this.logTest('Workflow auto-commit test', false, error.message);
    }
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 REVIEW FIXES TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`\nCodeRabbit Review: #3311652574`);
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
    const resultsPath = path.join(process.cwd(), 'test-results-review-3311652574.json');
    fs.writeFileSync(resultsPath, JSON.stringify({
      review: '3311652574',
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
    console.log('║  CodeRabbit Review #3311652574 Tests  ║');
    console.log('║  Security & Architecture Fixes        ║');
    console.log('╚════════════════════════════════════════╝');

    this.testCommandInjectionPrevention();
    this.testReadOnlyPermissionLogic();
    this.testMemoryLeakPrevention();
    this.testWorkflowAutocommit();

    const success = this.printSummary();
    process.exit(success ? 0 : 1);
  }
}

// CLI
if (require.main === module) {
  const tester = new ReviewFixesTester();
  tester.runAll();
}

module.exports = ReviewFixesTester;
