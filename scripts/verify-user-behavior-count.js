#!/usr/bin/env node

/**
 * User Behavior Count Verification Script
 *
 * Verifies that a user's total_violations count matches the expected value.
 * Used to validate atomic_update_user_behavior() RPC function correctness.
 *
 * Usage:
 *   node scripts/verify-user-behavior-count.js \
 *     --user-id=test_user \
 *     --expected-count=5 \
 *     [--platform=twitter] \
 *     [--org-id=...]
 *
 * Exit codes:
 *   0 - Count matches expected
 *   1 - Count mismatch or error
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

const USER_ID = args['user-id'];
const EXPECTED_COUNT = parseInt(args['expected-count'], 10);
const PLATFORM = args.platform || 'twitter';
const ORG_ID = args['org-id'] || '00000000-0000-0000-0000-000000000001'; // Test org

// Validate required arguments
if (!USER_ID) {
  console.error('❌ ERROR: Missing required argument --user-id');
  console.error('Usage: node scripts/verify-user-behavior-count.js --user-id=USER --expected-count=N');
  process.exit(1);
}

if (isNaN(EXPECTED_COUNT)) {
  console.error('❌ ERROR: Missing or invalid --expected-count argument');
  console.error('Usage: node scripts/verify-user-behavior-count.js --user-id=USER --expected-count=N');
  process.exit(1);
}

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
 * Query user_behavior record
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
      // No rows found
      return null;
    }
    throw new Error(`Database query failed: ${error.message}`);
  }

  return data;
}

/**
 * Main verification
 */
async function verifyCount() {
  console.log('🔍 User Behavior Count Verification');
  console.log('====================================\n');

  console.log(`Configuration:`);
  console.log(`  User ID: ${USER_ID}`);
  console.log(`  Platform: ${PLATFORM}`);
  console.log(`  Organization: ${ORG_ID}`);
  console.log(`  Expected Count: ${EXPECTED_COUNT}\n`);

  try {
    // Query user_behavior
    console.log('Querying user_behavior table...');
    const behavior = await getUserBehavior();

    if (!behavior) {
      console.error(`\n❌ FAILURE: No user_behavior record found!`);
      console.error(`   Expected: Record with ${EXPECTED_COUNT} violations`);
      console.error(`   Actual: No record exists\n`);
      process.exit(1);
    }

    console.log('\n✅ Record found\n');

    // Display full record
    console.log('User Behavior Record:');
    console.log(`  ID: ${behavior.id}`);
    console.log(`  Platform User ID: ${behavior.platform_user_id}`);
    console.log(`  Platform Username: ${behavior.platform_username || 'N/A'}`);
    console.log(`  Total Violations: ${behavior.total_violations}`);
    console.log(`  Severity Counts: ${JSON.stringify(behavior.severity_counts || {})}`);
    console.log(`  Actions Taken: ${behavior.actions_taken ? behavior.actions_taken.length : 0} entries`);
    console.log(`  Last Violation: ${behavior.last_violation_at}`);
    console.log(`  Last Seen: ${behavior.last_seen_at}`);
    console.log(`  Created: ${behavior.created_at}`);
    console.log(`  Updated: ${behavior.updated_at}\n`);

    // Verify count
    console.log('Verification:');
    console.log(`  Expected: ${EXPECTED_COUNT}`);
    console.log(`  Actual: ${behavior.total_violations}`);

    if (behavior.total_violations === EXPECTED_COUNT) {
      console.log(`\n✅ SUCCESS: Count matches! (${behavior.total_violations})\n`);
      process.exit(0);
    } else {
      console.error(`\n❌ FAILURE: Count mismatch!`);
      console.error(`   Expected: ${EXPECTED_COUNT}`);
      console.error(`   Actual: ${behavior.total_violations}`);
      console.error(`   Difference: ${behavior.total_violations - EXPECTED_COUNT}`);

      if (behavior.total_violations < EXPECTED_COUNT) {
        console.error(`\n   ⚠️  Lost updates detected! (${EXPECTED_COUNT - behavior.total_violations} updates missing)`);
        console.error(`   This indicates a race condition in atomic_update_user_behavior()!\n`);
      } else {
        console.error(`\n   ⚠️  Extra updates detected! (${behavior.total_violations - EXPECTED_COUNT} more than expected)`);
        console.error(`   This may indicate duplicate processing or incorrect test setup.\n`);
      }

      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ FATAL ERROR: ${error.message}`);
    console.error(`\nStack trace:`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute verification
verifyCount();
