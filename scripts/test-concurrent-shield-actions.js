#!/usr/bin/env node

/**
 * Concurrent Shield Actions Test Script
 *
 * Tests atomic_update_user_behavior() RPC function under concurrent load.
 * Verifies that total_violations increments correctly when multiple Shield
 * actions execute simultaneously on the same user.
 *
 * Usage:
 *   node scripts/test-concurrent-shield-actions.js \
 *     --user-id=test_concurrent_user \
 *     --actions=5 \
 *     --platform=twitter
 *
 * Related: Issue #653, Migration 024
 */

const { createClient } = require('@supabase/supabase-js');

// Parse command-line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace(/^--/, '')] = value;
  return acc;
}, {});

const USER_ID = args['user-id'] || 'test_concurrent_user';
const NUM_ACTIONS = parseInt(args.actions || '5', 10);
const PLATFORM = args.platform || 'twitter';
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

/**
 * Generate test violation data for RPC call
 */
function generateViolationData(index) {
  return {
    severity: index % 3 === 0 ? 'high' : index % 2 === 0 ? 'medium' : 'low',
    toxicity_score: 0.5 + (index * 0.1),
    comment_id: `concurrent_test_comment_${Date.now()}_${index}`,
    action_tags: ['warning', 'content_removal']
  };
}

/**
 * Call atomic_update_user_behavior() RPC function
 */
async function callAtomicUpdate(index) {
  const violationData = generateViolationData(index);

  const startTime = Date.now();

  try {
    const { data, error } = await supabase.rpc('atomic_update_user_behavior', {
      p_organization_id: ORG_ID,
      p_platform: PLATFORM,
      p_platform_user_id: USER_ID,
      p_platform_username: `${USER_ID}_username`,
      p_violation_data: violationData
    });

    const latency = Date.now() - startTime;

    if (error) {
      return {
        success: false,
        index,
        error: error.message,
        latency
      };
    }

    return {
      success: true,
      index,
      data,
      latency
    };
  } catch (err) {
    const latency = Date.now() - startTime;
    return {
      success: false,
      index,
      error: err.message,
      latency
    };
  }
}

/**
 * Get current user_behavior record
 */
async function getUserBehavior() {
  const { data, error } = await supabase
    .from('user_behaviors')
    .select('*')
    .eq('organization_id', ORG_ID)
    .eq('platform', PLATFORM)
    .eq('platform_user_id', USER_ID)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found - return null
      return null;
    }
    throw new Error(`Failed to query user_behavior: ${error.message}`);
  }

  return data;
}

/**
 * Clean up test data (delete user_behavior record)
 */
async function cleanupTestData() {
  const { error } = await supabase
    .from('user_behaviors')
    .delete()
    .eq('organization_id', ORG_ID)
    .eq('platform', PLATFORM)
    .eq('platform_user_id', USER_ID);

  if (error) {
    console.warn(`⚠️  Warning: Failed to cleanup test data: ${error.message}`);
  }
}

/**
 * Main test execution
 */
async function runConcurrentTest() {
  console.log('🧪 Concurrent Shield Actions Test');
  console.log('==================================\n');
  console.log(`Configuration:`);
  console.log(`  User ID: ${USER_ID}`);
  console.log(`  Platform: ${PLATFORM}`);
  console.log(`  Organization: ${ORG_ID}`);
  console.log(`  Concurrent Actions: ${NUM_ACTIONS}\n`);

  // Step 1: Cleanup any existing test data
  console.log('Step 1: Cleaning up existing test data...');
  await cleanupTestData();

  const initialState = await getUserBehavior();
  if (initialState) {
    console.log(`⚠️  Warning: User behavior record exists after cleanup!`);
    console.log(`   Total violations: ${initialState.total_violations}`);
    console.log(`   Continuing anyway...\n`);
  } else {
    console.log('✅ No existing data found\n');
  }

  // Step 2: Execute concurrent RPC calls
  console.log(`Step 2: Executing ${NUM_ACTIONS} concurrent RPC calls...`);
  const startTime = Date.now();

  const promises = Array.from({ length: NUM_ACTIONS }, (_, i) => callAtomicUpdate(i));
  const results = await Promise.all(promises);

  const totalTime = Date.now() - startTime;

  // Step 3: Analyze results
  console.log('\nStep 3: Analyzing results...\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Results Summary:`);
  console.log(`  Total calls: ${NUM_ACTIONS}`);
  console.log(`  Successful: ${successful.length} (${(successful.length / NUM_ACTIONS * 100).toFixed(1)}%)`);
  console.log(`  Failed: ${failed.length} (${(failed.length / NUM_ACTIONS * 100).toFixed(1)}%)`);
  console.log(`  Total time: ${totalTime}ms`);
  console.log(`  Avg latency: ${(results.reduce((sum, r) => sum + r.latency, 0) / results.length).toFixed(2)}ms`);

  if (failed.length > 0) {
    console.log(`\n❌ Failed calls:`);
    failed.forEach(r => {
      console.log(`   [${r.index}] ${r.error}`);
    });
  }

  // Step 4: Verify final state
  console.log('\nStep 4: Verifying final user_behavior state...');

  const finalState = await getUserBehavior();

  if (!finalState) {
    console.error('\n❌ FAILURE: No user_behavior record found after concurrent updates!');
    process.exit(1);
  }

  console.log(`\nFinal State:`);
  console.log(`  Total violations: ${finalState.total_violations}`);
  console.log(`  Severity counts: ${JSON.stringify(finalState.severity_counts)}`);
  console.log(`  Actions taken count: ${finalState.actions_taken ? finalState.actions_taken.length : 0}`);
  console.log(`  Last violation: ${finalState.last_violation_at}`);

  // Step 5: Validate correctness
  console.log('\nStep 5: Validating correctness...\n');

  const expectedViolations = successful.length;
  const actualViolations = finalState.total_violations;

  console.log(`Expected violations: ${expectedViolations}`);
  console.log(`Actual violations: ${actualViolations}`);

  if (actualViolations !== expectedViolations) {
    console.error(`\n❌ FAILURE: Violation count mismatch!`);
    console.error(`   Expected: ${expectedViolations}`);
    console.error(`   Actual: ${actualViolations}`);
    console.error(`   Lost updates: ${expectedViolations - actualViolations}`);
    console.error(`\n   This indicates a race condition in atomic_update_user_behavior()!`);
    process.exit(1);
  }

  console.log('\n✅ SUCCESS: All concurrent updates applied correctly!');
  console.log('   No race conditions detected.');
  console.log('   Atomic behavior verified.\n');

  // Step 6: Cleanup
  console.log('Step 6: Cleaning up test data...');
  await cleanupTestData();
  console.log('✅ Cleanup complete\n');

  // Final report
  console.log('==================================');
  console.log('Test completed successfully! ✅');
  console.log('==================================\n');

  process.exit(0);
}

// Execute test
runConcurrentTest().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
});
