#!/usr/bin/env node

/**
 * GDD Health Computation & CI/CD Validation Script
 *
 * This script calculates the overall GDD system health score and can be used
 * in CI/CD pipelines to enforce minimum health standards.
 *
 * Usage:
 *   node scripts/compute-gdd-health.js                    # Display health score
 *   node scripts/compute-gdd-health.js --min-score 95     # Enforce minimum score
 *   node scripts/compute-gdd-health.js --ci               # CI mode (exit 1 if below threshold)
 *   node scripts/compute-gdd-health.js --json             # JSON output only
 *
 * Exit codes:
 *   0 - Health score meets or exceeds minimum threshold
 *   1 - Health score below minimum threshold
 *   2 - Script execution error
 */

const fs = require('fs').promises;
const path = require('path');

class GDDHealthComputer {
  constructor(options = {}) {
    this.options = {
      minScore: options.minScore || 95,
      ci: options.ci || false,
      json: options.json || false,
      verbose: options.verbose || false
    };
    this.rootDir = path.resolve(__dirname, '..');
  }

  /**
   * Main computation entry point
   */
  async compute() {
    try {
      // Load health data
      const healthData = await this.loadHealthData();

      // Validate health score
      const result = this.validateHealth(healthData);

      // Output results
      this.outputResults(result, healthData);

      // Return exit code
      return result.passed ? 0 : 1;
    } catch (error) {
      if (!this.options.json) {
        console.error(`❌ Health computation failed: ${error.message}`);
        if (this.options.verbose) {
          console.error(error.stack);
        }
      } else {
        console.log(JSON.stringify({
          error: error.message,
          success: false
        }, null, 2));
      }
      return 2;
    }
  }

  /**
   * Load health data from gdd-health.json
   */
  async loadHealthData() {
    const healthFile = path.join(this.rootDir, 'gdd-health.json');

    try {
      const content = await fs.readFile(healthFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load gdd-health.json: ${error.message}`);
    }
  }

  /**
   * Validate health against minimum threshold
   */
  validateHealth(healthData) {
    const score = healthData.overall_score;
    const passed = score >= this.options.minScore;

    // Identify nodes below threshold
    const nodesBelowThreshold = [];
    const criticalNodes = [];
    const degradedNodes = [];

    if (healthData.nodes) {
      Object.entries(healthData.nodes).forEach(([nodeName, nodeData]) => {
        if (nodeData.score < this.options.minScore) {
          nodesBelowThreshold.push({
            name: nodeName,
            score: nodeData.score,
            status: nodeData.status,
            breakdown: nodeData.breakdown
          });
        }

        if (nodeData.status === 'critical') {
          criticalNodes.push(nodeName);
        } else if (nodeData.status === 'degraded') {
          degradedNodes.push(nodeName);
        }
      });
    }

    return {
      passed,
      score,
      minScore: this.options.minScore,
      status: healthData.status,
      nodeCount: healthData.total_nodes,
      healthyCount: healthData.healthy_count,
      degradedCount: healthData.degraded_count,
      criticalCount: healthData.critical_count,
      nodesBelowThreshold,
      criticalNodes,
      degradedNodes,
      generatedAt: healthData.generated_at
    };
  }

  /**
   * Output results based on mode
   */
  outputResults(result, healthData) {
    if (this.options.json) {
      this.outputJSON(result, healthData);
    } else {
      this.outputHuman(result, healthData);
    }
  }

  /**
   * Output JSON format
   */
  outputJSON(result, healthData) {
    console.log(JSON.stringify({
      success: result.passed,
      score: result.score,
      minScore: result.minScore,
      status: result.status,
      nodes: {
        total: result.nodeCount,
        healthy: result.healthyCount,
        degraded: result.degradedCount,
        critical: result.criticalCount
      },
      belowThreshold: result.nodesBelowThreshold,
      generatedAt: result.generatedAt
    }, null, 2));
  }

  /**
   * Output human-readable format
   */
  outputHuman(result, healthData) {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('     🏥 GDD SYSTEM HEALTH VALIDATION');
    console.log('═══════════════════════════════════════════');
    console.log('');

    // Overall score
    const scoreEmoji = result.score >= this.options.minScore ? '✅' : '❌';
    const statusEmoji = this.getStatusEmoji(result.status);

    console.log(`${scoreEmoji} Overall Score:     ${result.score}/100`);
    console.log(`${statusEmoji} Overall Status:    ${result.status}`);
    console.log(`🎯 Minimum Required:  ${this.options.minScore}/100`);
    console.log('');

    // Node summary
    console.log('📊 Node Summary:');
    console.log(`   🟢 Healthy:   ${result.healthyCount}/${result.nodeCount}`);
    console.log(`   🟡 Degraded:  ${result.degradedCount}/${result.nodeCount}`);
    console.log(`   🔴 Critical:  ${result.criticalCount}/${result.nodeCount}`);
    console.log('');

    // Nodes below threshold
    if (result.nodesBelowThreshold.length > 0) {
      console.log(`⚠️  ${result.nodesBelowThreshold.length} node(s) below ${this.options.minScore} threshold:`);
      console.log('');

      result.nodesBelowThreshold.forEach(node => {
        console.log(`   📌 ${node.name} (${node.score}/100)`);

        if (this.options.verbose) {
          console.log(`      - Sync Accuracy: ${node.breakdown.syncAccuracy}/100`);
          console.log(`      - Update Freshness: ${node.breakdown.updateFreshness}/100`);
          console.log(`      - Dependency Integrity: ${node.breakdown.dependencyIntegrity}/100`);
          console.log(`      - Coverage Evidence: ${node.breakdown.coverageEvidence}/100`);
          console.log(`      - Agent Relevance: ${node.breakdown.agentRelevance}/100`);
          console.log('');
        }
      });
      console.log('');
    }

    // Critical/degraded nodes
    if (result.criticalNodes.length > 0) {
      console.log(`🔴 Critical nodes: ${result.criticalNodes.join(', ')}`);
      console.log('');
    }

    if (result.degradedNodes.length > 0 && this.options.verbose) {
      console.log(`🟡 Degraded nodes: ${result.degradedNodes.join(', ')}`);
      console.log('');
    }

    // Final verdict
    console.log('═══════════════════════════════════════════');
    if (result.passed) {
      console.log('✅ VALIDATION PASSED');
      console.log(`   System health (${result.score}/100) meets minimum threshold (${this.options.minScore}/100)`);
    } else {
      console.log('❌ VALIDATION FAILED');
      console.log(`   System health (${result.score}/100) below minimum threshold (${this.options.minScore}/100)`);
      console.log(`   Gap: ${(this.options.minScore - result.score).toFixed(1)} points`);

      if (!this.options.verbose) {
        console.log('');
        console.log('💡 Run with --verbose for detailed breakdown');
      }
    }
    console.log('═══════════════════════════════════════════');
    console.log('');

    // Generated timestamp
    if (result.generatedAt) {
      console.log(`📅 Report generated: ${new Date(result.generatedAt).toLocaleString()}`);
      console.log('');
    }
  }

  /**
   * Get emoji for status
   */
  getStatusEmoji(status) {
    const emojiMap = {
      'HEALTHY': '🟢',
      'DEGRADED': '🟡',
      'CRITICAL': '🔴'
    };
    return emojiMap[status] || '⚪';
  }
}

/**
 * Parse CLI arguments, run the GDD health computation, and handle process-level output and exits.
 *
 * Parses command-line options (--min-score, --ci, --json, --verbose/-v, --help), validates the
 * minimum score value, prints help or validation errors when appropriate, creates a
 * GDDHealthComputer with the resolved options, invokes its computation, and—if run in CI mode—
 * exits the process with the resulting exit code (0 = pass, 1 = fail, 2 = error).
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const options = {
    minScore: 95, // Default minimum score
    ci: args.includes('--ci'),
    json: args.includes('--json'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };

  // Parse --min-score
  const minScoreIndex = args.findIndex(arg => arg === '--min-score');
  if (minScoreIndex !== -1 && args[minScoreIndex + 1]) {
    options.minScore = parseFloat(args[minScoreIndex + 1]);
    if (isNaN(options.minScore) || options.minScore < 0 || options.minScore > 100) {
      console.error('❌ Invalid --min-score value. Must be between 0 and 100.');
      process.exit(2);
    }
  }

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
GDD Health Computation & CI/CD Validation Script

Usage:
  node scripts/compute-gdd-health.js [options]

Options:
  --min-score N    Minimum required health score (default: 95)
  --ci             CI mode (exit 1 if below threshold)
  --json           Output JSON only
  --verbose, -v    Show detailed breakdown
  --help, -h       Show this help message

Examples:
  # Display current health score
  node scripts/compute-gdd-health.js

  # Enforce minimum score of 90 in CI
  node scripts/compute-gdd-health.js --ci --min-score 90

  # Get JSON output for programmatic use
  node scripts/compute-gdd-health.js --json

  # Verbose output with detailed breakdown
  node scripts/compute-gdd-health.js --verbose

Exit Codes:
  0 - Health score meets or exceeds minimum threshold
  1 - Health score below minimum threshold
  2 - Script execution error
`);
    process.exit(0);
  }

  // Run computation
  const computer = new GDDHealthComputer(options);
  const exitCode = await computer.compute();

  // Exit with appropriate code (especially important for CI)
  if (options.ci) {
    process.exit(exitCode);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(2);
  });
}

module.exports = { GDDHealthComputer };