#!/usr/bin/env node

/**
 * Shield Performance Benchmark Script
 *
 * Benchmarks Shield action execution performance before and after Migration 024.
 * Measures latency, database calls, and error rates for executeActionsFromTags().
 *
 * Usage:
 *   node scripts/benchmark-shield-performance.js \
 *     --actions=100 \
 *     --output=benchmark-migration-024.json \
 *     [--baseline]  # Run baseline (before migration) instead of post-migration
 *
 * Output: JSON file with metrics
 *
 * Related: Issue #653, Migration 024
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const ShieldService = require('../src/services/shieldService');

// Parse command-line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace(/^--/, '')] = value;
  return acc;
}, {});

const NUM_ACTIONS = parseInt(args.actions || '100', 10);
const OUTPUT_FILE = args.output || `benchmark-shield-${Date.now()}.json`;
const IS_BASELINE = args.baseline === 'true' || args.baseline === true;
const ORG_ID = args['org-id'] || '00000000-0000-0000-0000-000000000001'; // Test org

// 🔐 Requires environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing required environment variables');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Initialize ShieldService
const shieldService = new ShieldService({
  enabled: true,
  autoActions: true
});

/**
 * Generate test comment for Shield action
 */
function generateTestComment(index) {
  return {
    id: `benchmark_comment_${Date.now()}_${index}`,
    platform: 'twitter',
    platform_user_id: `benchmark_user_${index}`,
    platform_username: `@benchmark_user_${index}`,
    text: `Test toxic comment ${index} for benchmarking`,
    author_id: `author_${index}`,
    created_at: new Date().toISOString()
  };
}

/**
 * Generate test metadata for Shield action
 */
function generateTestMetadata(index) {
  const severity =
    index % 4 === 0 ? 'critical' : index % 3 === 0 ? 'high' : index % 2 === 0 ? 'medium' : 'low';
  const toxicityScore = 0.5 + (index % 5) * 0.1;

  return {
    toxicity: {
      toxicity_score: toxicityScore,
      severity_level: severity,
      categories: ['insult', 'profanity']
    },
    platform_violations: {
      reportable: severity === 'critical' || severity === 'high',
      violations: ['hate_speech', 'harassment']
    },
    decision: {
      severity_level: severity
    }
  };
}

/**
 * Track database calls (mock Supabase client wrapper)
 */
let dbCallCount = 0;
let dbCallTimes = [];

const originalRpc = supabase.rpc.bind(supabase);
supabase.rpc = async function (...args) {
  const startTime = Date.now();
  dbCallCount++;
  try {
    const result = await originalRpc(...args);
    dbCallTimes.push(Date.now() - startTime);
    return result;
  } catch (error) {
    dbCallTimes.push(Date.now() - startTime);
    throw error;
  }
};

const originalInsert = supabase.from.bind(supabase);
supabase.from = function (table) {
  const query = originalInsert(table);
  const originalInsertMethod = query.insert.bind(query);
  query.insert = async function (...args) {
    const startTime = Date.now();
    dbCallCount++;
    try {
      const result = await originalInsertMethod(...args);
      dbCallTimes.push(Date.now() - startTime);
      return result;
    } catch (error) {
      dbCallTimes.push(Date.now() - startTime);
      throw error;
    }
  };
  return query;
};

/**
 * Execute single Shield action and measure performance
 */
async function executeShieldAction(index) {
  const comment = generateTestComment(index);
  const metadata = generateTestMetadata(index);
  const actionTags = ['hide_comment', 'add_strike_1', 'check_reincidence'];

  const startTime = Date.now();
  let success = false;
  let latency = 0;

  try {
    // Reset DB call tracking for this action
    const initialDbCalls = dbCallCount;
    const initialDbTimes = dbCallTimes.length;

    const result = await shieldService.executeActionsFromTags(
      ORG_ID,
      comment,
      actionTags,
      metadata
    );

    latency = Date.now() - startTime;
    success = result.success !== false;

    // Calculate DB calls for this action
    const actionDbCalls = dbCallCount - initialDbCalls;
    const actionDbTimes = dbCallTimes.slice(initialDbTimes);

    return {
      index,
      success,
      latency,
      dbCalls: actionDbCalls,
      dbCallTimes: actionDbTimes,
      avgDbCallTime:
        actionDbTimes.length > 0
          ? actionDbTimes.reduce((a, b) => a + b, 0) / actionDbTimes.length
          : 0,
      error: result.error || null
    };
  } catch (err) {
    latency = Date.now() - startTime;
    return {
      index,
      success: false,
      latency,
      dbCalls: 0,
      dbCallTimes: [],
      avgDbCallTime: 0,
      error: err.message
    };
  }
}

/**
 * Main benchmark execution
 */
async function runBenchmark() {
  console.log('📊 Shield Performance Benchmark');
  console.log('=================================\n');
  console.log(`Configuration:`);
  console.log(
    `  Mode: ${IS_BASELINE ? 'BASELINE (before migration)' : 'POST-MIGRATION (after migration)'}`
  );
  console.log(`  Actions: ${NUM_ACTIONS}`);
  console.log(`  Organization: ${ORG_ID}`);
  console.log(`  Output: ${OUTPUT_FILE}\n`);

  const startTime = Date.now();
  const results = [];

  console.log(`Executing ${NUM_ACTIONS} Shield actions...`);
  console.log('Progress: [', ' '.repeat(50), '] 0%', '\r');

  // Execute actions sequentially to avoid overwhelming the system
  for (let i = 0; i < NUM_ACTIONS; i++) {
    const result = await executeShieldAction(i);
    results.push(result);

    // Progress indicator
    const progress = Math.floor(((i + 1) / NUM_ACTIONS) * 50);
    const percent = Math.floor(((i + 1) / NUM_ACTIONS) * 100);
    process.stdout.write(
      `\rProgress: [${'='.repeat(progress)}${' '.repeat(50 - progress)}] ${percent}%`
    );
  }

  console.log('\n\nAnalyzing results...\n');

  const totalTime = Date.now() - startTime;
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  // Calculate metrics
  const latencies = results.map((r) => r.latency);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const p50Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.5)];
  const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
  const p99Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)];

  const totalDbCalls = results.reduce((sum, r) => sum + r.dbCalls, 0);
  const avgDbCallsPerAction = totalDbCalls / results.length;
  const dbCallTimes = results.flatMap((r) => r.dbCallTimes);
  const avgDbCallTime =
    dbCallTimes.length > 0 ? dbCallTimes.reduce((a, b) => a + b, 0) / dbCallTimes.length : 0;

  const errorRate = (failed.length / results.length) * 100;

  // Build report
  const report = {
    metadata: {
      timestamp: new Date().toISOString(),
      mode: IS_BASELINE ? 'baseline' : 'post_migration',
      migration: '024_atomic_user_behavior_updates',
      issue: '#653',
      actions: NUM_ACTIONS,
      organization_id: ORG_ID
    },
    summary: {
      total_actions: NUM_ACTIONS,
      successful: successful.length,
      failed: failed.length,
      success_rate: ((successful.length / NUM_ACTIONS) * 100).toFixed(2) + '%',
      error_rate: errorRate.toFixed(2) + '%',
      total_time_ms: totalTime,
      total_time_seconds: (totalTime / 1000).toFixed(2)
    },
    latency: {
      avg_ms: Math.round(avgLatency * 100) / 100,
      min_ms: minLatency,
      max_ms: maxLatency,
      p50_ms: p50Latency,
      p95_ms: p95Latency,
      p99_ms: p99Latency
    },
    database: {
      total_calls: totalDbCalls,
      avg_calls_per_action: Math.round(avgDbCallsPerAction * 100) / 100,
      avg_call_time_ms: Math.round(avgDbCallTime * 100) / 100
    },
    errors:
      failed.length > 0
        ? failed.map((r) => ({
            index: r.index,
            error: r.error
          }))
        : []
  };

  // Display summary
  console.log('Results Summary:');
  console.log('================\n');
  console.log(`Total Actions: ${report.summary.total_actions}`);
  console.log(`Successful: ${report.summary.successful} (${report.summary.success_rate})`);
  console.log(`Failed: ${report.summary.failed} (${report.summary.error_rate})`);
  console.log(`Total Time: ${report.summary.total_time_seconds}s\n`);

  console.log('Latency Metrics:');
  console.log(`  Average: ${report.latency.avg_ms}ms`);
  console.log(`  Min: ${report.latency.min_ms}ms`);
  console.log(`  Max: ${report.latency.max_ms}ms`);
  console.log(`  P50: ${report.latency.p50_ms}ms`);
  console.log(`  P95: ${report.latency.p95_ms}ms`);
  console.log(`  P99: ${report.latency.p99_ms}ms\n`);

  console.log('Database Metrics:');
  console.log(`  Total Calls: ${report.database.total_calls}`);
  console.log(`  Avg Calls/Action: ${report.database.avg_calls_per_action}`);
  console.log(`  Avg Call Time: ${report.database.avg_call_time_ms}ms\n`);

  if (failed.length > 0) {
    console.log(`Errors (${failed.length}):`);
    failed.slice(0, 10).forEach((r) => {
      console.log(`  [${r.index}] ${r.error}`);
    });
    if (failed.length > 10) {
      console.log(`  ... and ${failed.length - 10} more`);
    }
    console.log();
  }

  // Save report
  const outputPath = path.join(process.cwd(), OUTPUT_FILE);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`✅ Report saved to: ${outputPath}\n`);

  // Exit with error code if failure rate > 5%
  if (errorRate > 5) {
    console.error(`⚠️  WARNING: High error rate (${errorRate.toFixed(2)}%)`);
    process.exit(1);
  }

  process.exit(0);
}

// Execute benchmark
runBenchmark().catch((error) => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
});
