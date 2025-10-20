#!/usr/bin/env node

/**
 * Verify Supabase Tables Script
 *
 * Checks that all expected tables and RLS policies were created successfully
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const logger = require('../src/utils/logger');

async function verifyTables() {
  logger.info('🔍 Verifying Supabase Deployment...\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    logger.error('❌ ERROR: Missing Supabase credentials');
    if (!supabaseUrl) {
      logger.error('   SUPABASE_URL not found in .env');
    }
    if (!serviceKey) {
      logger.error('   SUPABASE_SERVICE_KEY not found in .env');
    }
    logger.error('   Add them to your .env file:');
    logger.error('   SUPABASE_URL=https://your-project.supabase.co');
    logger.error('   SUPABASE_SERVICE_KEY=your_service_key_here\n');
    process.exit(1);
  }

  // Create admin client (service role - bypasses RLS)
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Create anon client for RLS verification (if available)
  let pub = null;
  if (!anonKey) {
    logger.warn('⚠️  SUPABASE_ANON_KEY not set; RLS checks will be skipped');
    logger.warn('   Add to .env: SUPABASE_ANON_KEY=your_anon_key_here\n');
  } else {
    pub = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

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
    logger.info('📋 Checking tables...');

    // Check each table by trying to select from it
    const results = [];

    for (const table of expectedTables) {
      try {
        // Existence check with admin client (bypasses RLS)
        const { error: adminErr } = await admin.from(table).select('id').limit(1);

        if (adminErr) {
          // Check if table doesn't exist
          if ((adminErr.code === '42P01') || /does not exist/i.test(adminErr.message)) {
            results.push({ table, status: '❌', message: 'Not found' });
          } else {
            // Unexpected admin error
            results.push({ table, status: '⚠️', message: adminErr.message.substring(0, 80) });
          }
        } else {
          // Table exists, now check RLS with anon client
          if (pub) {
            const { error: anonErr } = await pub.from(table).select('id').limit(1);

            if (anonErr) {
              // Check if RLS is enforced
              if (anonErr.code === 'PGRST301' || anonErr.status === 403 || /permission denied/i.test(anonErr.message)) {
                results.push({ table, status: '✅', message: 'Exists (RLS enforced)' });
              } else {
                results.push({ table, status: '⚠️', message: `Anon error: ${anonErr.message.substring(0, 80)}` });
              }
            } else {
              // Anon can read - RLS may be disabled or policies allow public read
              results.push({ table, status: '⚠️', message: 'Anon can read; RLS may be disabled or policies allow public read' });
            }
          } else {
            // No anon key available, skip RLS check
            results.push({ table, status: '✅', message: 'Exists (RLS not checked)' });
          }
        }
      } catch (err) {
        results.push({ table, status: '❌', message: err.message });
      }
    }

    // Display results
    logger.info('\n📊 Table Status:\n');
    results.forEach(r => {
      logger.info(`   ${r.status} ${r.table.padEnd(30)} ${r.message}`);
    });

    const successCount = results.filter(r => r.status === '✅').length;
    const failureCount = results.filter(r => r.status === '❌').length;

    logger.info(`\n📈 Summary: ${successCount}/${expectedTables.length} tables verified\n`);

    // Check for default plans data
    logger.info('🔍 Verifying default plans...');
    const { data: plans, error: plansError } = await admin
      .from('plans')
      .select('id, name');

    if (plansError) {
      logger.info('   ⚠️  Cannot verify plans (may need service role access)');
    } else if (plans && plans.length > 0) {
      logger.info(`   ✅ Found ${plans.length} plans:`);
      plans.forEach(p => logger.info(`      - ${p.id}: ${p.name}`));
    } else {
      logger.info('   ❌ No plans found (INSERT may have failed)');
    }

    logger.info('\n🎉 Verification complete!\n');

    if (failureCount === 0) {
      logger.info('✅ All tables created successfully');
      logger.info('✅ Supabase is fully configured');
      logger.info('\nNext step: Run RLS tests');
      logger.info('   npm test -- multi-tenant-rls\n');
      process.exit(0);
    } else {
      logger.info(`⚠️  ${failureCount} table(s) missing or inaccessible`);
      logger.info('   Review the SQL Editor for error messages\n');
      process.exit(1);
    }

  } catch (error) {
    logger.error('\n❌ ERROR during verification:', error.message);
    process.exit(1);
  }
}

verifyTables();
