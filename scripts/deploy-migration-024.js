#!/usr/bin/env node

/**
 * Deploy Migration 024 to Supabase
 *
 * Deploys atomic_update_user_behavior() RPC function to Supabase database.
 *
 * Usage:
 *   node scripts/deploy-migration-024.js
 *
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 *
 * Related: Issue #653, Migration 024
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get credentials from environment
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing required environment variables');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Read migration SQL file
const migrationPath = path.join(__dirname, '../database/migrations/024_atomic_user_behavior_updates.sql');

console.log('🚀 Deploying Migration 024 to Supabase');
console.log('==========================================\n');
console.log(`Migration file: ${migrationPath}`);

if (!fs.existsSync(migrationPath)) {
  console.error(`\n❌ ERROR: Migration file not found at ${migrationPath}`);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('\n📄 Migration SQL loaded successfully');
console.log(`   Lines: ${migrationSQL.split('\n').length}`);
console.log(`   Size: ${migrationSQL.length} bytes\n`);

/**
 * Execute migration SQL
 */
async function deployMigration() {
  try {
    console.log('Executing migration SQL...\n');

    // Execute the SQL using rpc call to execute raw SQL
    // Note: Supabase doesn't have a direct SQL execution API from JS client
    // We need to use the REST API directly
    const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;

    // Actually, let's use a different approach - execute each statement separately
    // Split the SQL into statements (separated by `;` outside of function body)

    // For simplicity, we'll execute the whole migration as one statement
    // by using Supabase's query method directly

    console.log('⚠️  Note: Supabase JS client cannot execute raw SQL directly.');
    console.log('   You have two options:\n');
    console.log('Option 1: Use Supabase SQL Editor (Recommended)');
    console.log('   1. Go to https://supabase.com/dashboard/project/rpkhiemljhncddmhrilk/sql/new');
    console.log('   2. Copy the contents of database/migrations/024_atomic_user_behavior_updates.sql');
    console.log('   3. Paste into the SQL editor');
    console.log('   4. Click "Run" button\n');

    console.log('Option 2: Use psql command line (Advanced)');
    console.log('   psql -h db.rpkhiemljhncddmhrilk.supabase.co -U postgres -d postgres \\');
    console.log('     -f database/migrations/024_atomic_user_behavior_updates.sql\n');

    console.log('Option 3: I can provide the SQL statement for manual execution:');
    console.log('==========================================');
    console.log(migrationSQL);
    console.log('==========================================\n');

    // Test if function already exists
    console.log('Testing if function already exists...\n');

    const { data, error } = await supabase.rpc('atomic_update_user_behavior', {
      p_organization_id: '00000000-0000-0000-0000-000000000001',
      p_platform: 'twitter',
      p_platform_user_id: 'test_deployment',
      p_platform_username: 'testuser',
      p_violation_data: {
        severity: 'low',
        toxicity_score: 0.5,
        comment_id: 'test',
        action_tags: ['warning']
      }
    });

    if (error) {
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log('❌ Function NOT deployed yet.');
        console.log('   Please use one of the options above to deploy the migration.\n');
        process.exit(1);
      } else {
        console.error('❌ Unexpected error:', error.message);
        process.exit(1);
      }
    } else {
      console.log('✅ SUCCESS! Function already exists and is working!');
      console.log('   Response:', JSON.stringify(data, null, 2));
      console.log('\n✅ Migration 024 is already deployed.\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute deployment
deployMigration();
