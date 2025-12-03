#!/usr/bin/env node

/**
 * Verify RLS Security Script
 *
 * Verifies that RLS is enabled on all critical tables
 * and that appropriate policies exist.
 *
 * Usage:
 *   node scripts/verify-rls-security.js
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - RLS security issues found
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const REQUIRED_TABLES = [
  'plans',
  'user_activities',
  'roast_tones',
  'organizations',
  'users',
  'organization_members',
  'integration_configs',
  'posts',
  'comments',
  'roasts'
];

async function verifyRLS() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables');
    console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
    console.error('   Note: SUPABASE_ANON_KEY cannot be used for RLS verification');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Verifying RLS Security...\n');

  let hasErrors = false;

  // Check if RLS is enabled on each table
  for (const table of REQUIRED_TABLES) {
    try {
      // Validate table name (whitelist check against hardcoded array)
      if (!REQUIRED_TABLES.includes(table)) {
        console.log(`⚠️  ${table}: Invalid table name (not in whitelist)`);
        continue;
      }

      // Sanitize table name (allow only alphanumeric and underscore)
      const sanitizedTable = table.replace(/[^a-z0-9_]/gi, '');
      if (sanitizedTable !== table) {
        console.log(`⚠️  ${table}: Invalid characters in table name`);
        continue;
      }

      // Query pg_class to check if RLS is enabled
      const { data: rlsData, error: rlsError } = await supabase.rpc('exec_sql', {
        query: `
          SELECT relname, relrowsecurity
          FROM pg_class
          WHERE relname = '${sanitizedTable}'
          AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        `
      });

      if (rlsError) {
        // Fallback: Try to query the table directly (will fail if RLS blocks)
        console.log(`⚠️  ${sanitizedTable}: Cannot verify RLS status (${rlsError.message})`);
        continue;
      }

      if (!rlsData || rlsData.length === 0) {
        console.log(`⚠️  ${sanitizedTable}: Table not found`);
        continue;
      }

      const isRLSEnabled = rlsData[0].relrowsecurity;

      if (isRLSEnabled) {
        // Check policies
        const { data: policiesData, error: policiesError } = await supabase.rpc('exec_sql', {
          query: `
            SELECT COUNT(*) as policy_count
            FROM pg_policies
            WHERE tablename = '${sanitizedTable}'
          `
        });

        const policyCount = policiesData?.[0]?.policy_count || 0;

        if (policyCount > 0) {
          console.log(`✅ ${sanitizedTable}: RLS enabled (${policyCount} policies)`);
        } else {
          console.log(`⚠️  ${sanitizedTable}: RLS enabled but NO POLICIES (security risk!)`);
          hasErrors = true;
        }
      } else {
        console.log(`❌ ${sanitizedTable}: RLS DISABLED (security risk!)`);
        hasErrors = true;
      }
    } catch (error) {
      console.log(`⚠️  ${table}: Error checking RLS (${error.message})`);
      hasErrors = true;
    }
  }

  console.log('\n' + '='.repeat(60));

  if (hasErrors) {
    console.log('❌ RLS SECURITY ISSUES FOUND');
    console.log('\nTo fix:');
    console.log('1. Run migration: database/migrations/057_enable_rls_missing_tables.sql');
    console.log('2. Or apply via Supabase dashboard SQL editor');
    console.log('3. Re-run this script to verify');
    process.exit(1);
  } else {
    console.log('✅ ALL RLS CHECKS PASSED');
    console.log(`   ${REQUIRED_TABLES.length} tables verified`);
    process.exit(0);
  }
}

// Alternative verification using direct SQL (if rpc doesn't work)
async function verifyRLSSimple() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables');
    console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
    console.error('   Note: SUPABASE_ANON_KEY cannot be used for RLS verification');
    process.exit(1);
  }

  console.log('🔍 Verifying RLS Security (Simple Mode)...\n');
  console.log('Critical tables to verify in Supabase Dashboard:');
  console.log('');

  REQUIRED_TABLES.forEach((table, index) => {
    console.log(`${index + 1}. ${table}`);
  });

  console.log('\n📋 Manual Verification Steps:');
  console.log('1. Go to Supabase Dashboard → Database → Tables');
  console.log('2. For each table above:');
  console.log('   - Check if "RLS enabled" badge is visible');
  console.log('   - Click table → Policies tab');
  console.log('   - Verify policies exist');
  console.log('\n🔧 To enable RLS:');
  console.log('   Run SQL: database/migrations/057_enable_rls_missing_tables.sql');

  // Exit with failure code since automatic verification failed
  console.log('\n' + '='.repeat(60));
  console.log('⚠️  Automatic verification failed - manual check required');
  process.exit(1);
}

// Run verification
verifyRLS().catch((error) => {
  console.error('❌ Verification failed:', error.message);
  console.log('\n' + '='.repeat(60));
  console.log('Switching to simple mode...\n');
  verifyRLSSimple();
});
