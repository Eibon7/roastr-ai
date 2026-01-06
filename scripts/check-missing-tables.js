#!/usr/bin/env node
/**
 * Check Missing Tables for Issue #800
 *
 * Verifies which of the 13 required tables exist in the database.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const REQUIRED_TABLES = [
  'organization_settings',
  'platform_settings',
  'shield_actions',
  'shield_events',
  'audit_logs',
  'webhook_events',
  'usage_counters',
  'credit_consumption_log',
  'usage_resets',
  'pending_plan_changes',
  'user_style_profile',
  'user_subscriptions',
  'account_deletion_requests'
];

async function checkTable(tableName) {
  try {
    const { error } = await supabase.from(tableName).select('id').limit(0);

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return false;
      }
    }
    return true;
  } catch (_) {
    return false;
  }
}

async function main() {
  console.log('🔍 Checking for 13 required tables...\n');

  const results = [];
  for (const tableName of REQUIRED_TABLES) {
    const exists = await checkTable(tableName);
    results.push({ table: tableName, exists });
    console.log(`${exists ? '✅' : '❌'} ${tableName}`);
  }

  const existingCount = results.filter((r) => r.exists).length;
  const missingCount = results.filter((r) => !r.exists).length;

  console.log(`\n📊 Summary:`);
  console.log(`   Existing: ${existingCount}/${REQUIRED_TABLES.length}`);
  console.log(`   Missing: ${missingCount}/${REQUIRED_TABLES.length}`);

  if (missingCount > 0) {
    console.log(`\n⚠️  ${missingCount} tables need to be created.`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Check if /tmp/rls-800-safe.sql is in clipboard`);
    console.log(`   2. Go to: https://supabase.com/dashboard/project/rpkhiemljhncddmhrilk/sql/new`);
    console.log(`   3. Paste and click "Run"`);
    console.log(`   4. Re-run this script to verify`);
  } else {
    console.log(`\n✅ All tables exist! Ready to run tests.`);
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
