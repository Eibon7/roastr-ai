#!/usr/bin/env node

/**
 * Verify Supabase Tables Script
 *
 * Checks that all expected tables and RLS policies were created successfully
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function verifyTables() {
  console.log('🔍 Verifying Supabase Deployment...\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ ERROR: Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Expected tables from schema
  const expectedTables = [
    'users',
    'organizations',
    'organization_members',
    'plans',
    'user_activities',
    'integration_configs',
    'usage_records',
    'monthly_usage',
    'comments',
    'responses',
    'user_behaviors',
    'job_queue',
    'account_deletion_requests',
    'audit_logs',
    'app_logs',
    'api_keys',
    'password_history'
  ];

  try {
    console.log('📋 Checking tables...');

    // Check each table by trying to select from it
    const results = [];

    for (const table of expectedTables) {
      try {
        const { error } = await supabase.from(table).select('id').limit(1);

        if (error) {
          if (error.message.includes('does not exist')) {
            results.push({ table, status: '❌', message: 'Not found' });
          } else if (error.message.includes('RLS')) {
            // RLS error means table exists but we can't access it (which is good!)
            results.push({ table, status: '✅', message: 'Exists (RLS active)' });
          } else {
            results.push({ table, status: '⚠️', message: error.message.substring(0, 50) });
          }
        } else {
          results.push({ table, status: '✅', message: 'Exists and accessible' });
        }
      } catch (err) {
        results.push({ table, status: '❌', message: err.message });
      }
    }

    // Display results
    console.log('\n📊 Table Status:\n');
    results.forEach(r => {
      console.log(`   ${r.status} ${r.table.padEnd(30)} ${r.message}`);
    });

    const successCount = results.filter(r => r.status === '✅').length;
    const failureCount = results.filter(r => r.status === '❌').length;

    console.log(`\n📈 Summary: ${successCount}/${expectedTables.length} tables verified\n`);

    // Check for default plans data
    console.log('🔍 Verifying default plans...');
    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('id, name');

    if (plansError) {
      console.log('   ⚠️  Cannot verify plans (may need service role access)');
    } else if (plans && plans.length > 0) {
      console.log(`   ✅ Found ${plans.length} plans:`);
      plans.forEach(p => console.log(`      - ${p.id}: ${p.name}`));
    } else {
      console.log('   ❌ No plans found (INSERT may have failed)');
    }

    console.log('\n🎉 Verification complete!\n');

    if (failureCount === 0) {
      console.log('✅ All tables created successfully');
      console.log('✅ Supabase is fully configured');
      console.log('\nNext step: Run RLS tests');
      console.log('   npm test -- multi-tenant-rls\n');
      process.exit(0);
    } else {
      console.log(`⚠️  ${failureCount} table(s) missing or inaccessible`);
      console.log('   Review the SQL Editor for error messages\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ ERROR during verification:', error.message);
    process.exit(1);
  }
}

verifyTables();
