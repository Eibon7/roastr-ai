#!/usr/bin/env node
/**
 * Check ALL RLS Tables Status
 *
 * Checks which of the 22 multi-tenant tables exist in the database
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

// 22 tables from multi-tenant.md
const ALL_TABLES = [
  'organization_settings',
  'platform_settings',
  'integration_configs',
  'comments',
  'responses',
  'usage_records',
  'monthly_usage',
  'shield_actions',
  'shield_events',
  'roast_metadata',
  'analysis_usage',
  'user_activities',
  'app_logs',
  'api_keys',
  'audit_logs',
  'account_deletion_requests',
  'password_history',
  'stylecards',
  'notifications',
  'webhook_events',
  'subscription_audit_log',
  'feature_flags'
];

// 9 already tested (Issue #504: posts, comments, roasts, integration_configs, usage_records, monthly_usage, responses, user_behaviors, user_activities)
const TESTED_TABLES = [
  'posts',
  'comments',
  'roasts',
  'integration_configs',
  'monthly_usage',
  'responses',
  'usage_records',
  'user_activities',
  'user_behaviors' // also tested but not in multi-tenant.md
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
  } catch {
    return false;
  }
}

async function main() {
  console.log('🔍 Checking ALL 22 RLS tables in database...\n');

  const results = [];
  for (const tableName of ALL_TABLES) {
    const exists = await checkTable(tableName);
    const tested = TESTED_TABLES.includes(tableName);
    results.push({ table: tableName, exists, tested });

    let status = '';
    if (tested) {
      status = '✅ TESTED';
    } else if (exists) {
      status = '🎯 EXISTS - NEEDS TEST';
    } else {
      status = '❌ MISSING';
    }

    console.log(`${status.padEnd(25)} ${tableName}`);
  }

  const testedCount = results.filter((r) => r.tested).length;
  const needsTestCount = results.filter((r) => r.exists && !r.tested).length;
  const missingCount = results.filter((r) => !r.exists).length;

  console.log(`\n📊 Summary:`);
  console.log(`   Total tables: ${ALL_TABLES.length}`);
  console.log(`   Already tested: ${testedCount}`);
  console.log(`   Exists, needs test: ${needsTestCount}`);
  console.log(`   Missing from DB: ${missingCount}`);

  if (needsTestCount > 0) {
    console.log(`\n🎯 These ${needsTestCount} tables EXIST and NEED TESTS:`);
    results
      .filter((r) => r.exists && !r.tested)
      .forEach((r, i) => console.log(`   ${i + 1}. ${r.table}`));
  }

  if (missingCount > 0) {
    console.log(`\n⚠️  These ${missingCount} tables are MISSING (need migrations):`);
    results.filter((r) => !r.exists).forEach((r, i) => console.log(`   ${i + 1}. ${r.table}`));
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
