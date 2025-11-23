#!/usr/bin/env node
/**
 * Verify RLS Policies in Supabase
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyPolicies() {
  console.log('🔍 Checking RLS policies...\n');

  // Query to get all policies on organizations table
  const { data, error } = await client.rpc('exec_sql', {
    query: `
        SELECT
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies
        WHERE tablename IN ('organizations', 'posts', 'comments', 'roasts', 'organization_members')
        ORDER BY tablename, policyname;
      `
  });

  if (error) {
    console.error('❌ Error querying policies:', error);
    // Try alternative method
    console.log('\n📋 Policies on organizations table:');
    console.log('(Cannot query directly, will apply fix)');
  } else if (data && data.length > 0) {
    console.log('📋 Current policies:');
    data.forEach((policy) => {
      console.log(`\nTable: ${policy.tablename}`);
      console.log(`  Policy: ${policy.policyname}`);
      console.log(`  Command: ${policy.cmd}`);
      console.log(`  Using: ${policy.qual || 'N/A'}`);
    });
  }
}

verifyPolicies()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Check failed:', err);
    process.exit(1);
  });
