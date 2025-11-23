#!/usr/bin/env node

/**
 * Test Migration 024 RPC Function Connection
 *
 * Validates that atomic_update_user_behavior() exists and works correctly.
 *
 * Related: Issue #653, Migration 024
 */

const { createClient } = require('@supabase/supabase-js');

// Get credentials from environment
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing required environment variables');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🔍 Testing Migration 024 RPC Function');
console.log('=====================================\n');

// Test RPC function exists
supabase
  .rpc('atomic_update_user_behavior', {
    p_organization_id: '00000000-0000-0000-0000-000000000001',
    p_platform: 'twitter',
    p_platform_user_id: 'test_migration_024',
    p_platform_username: 'testuser',
    p_violation_data: {
      severity: 'medium',
      toxicity_score: 0.75,
      comment_id: 'test_comment',
      action_tags: ['warning']
    }
  })
  .then((result) => {
    console.log('\n✅ SUCCESS: RPC function works!\n');
    console.log('Response:', JSON.stringify(result.data, null, 2));
    console.log('\n=====================================');
    console.log('Migration 024 is deployed and operational ✅');
    console.log('=====================================\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ FAILURE: RPC function error\n');
    console.error('Error:', error.message);

    if (error.message.includes('function') && error.message.includes('does not exist')) {
      console.error('\n⚠️  Migration 024 NOT deployed yet!');
      console.error('   The atomic_update_user_behavior() RPC function does not exist.');
      console.error('   You must deploy Migration 024 before merging PR #654.\n');
    }

    process.exit(1);
  });
