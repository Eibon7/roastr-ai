#!/usr/bin/env node
/**
 * Ensure RLS Test Tables Exist
 *
 * Verifies and creates posts, comments (columns), and roasts tables if missing.
 * These tables are required for RLS integration tests and application functionality.
 *
 * Usage:
 *   node scripts/ensure-rls-test-tables.js
 *
 * Related:
 *   - Issue #583: RLS Integration Tests
 *   - Issue #412: Original RLS Tests
 *   - Migration: supabase/migrations/20251016000001_add_test_tables.sql
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  console.error('   Please check your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Check if a table exists
 */
async function tableExists(tableName) {
  try {
    // Try to query the table (will fail if doesn't exist)
    const { error } = await supabase.from(tableName).select('*').limit(0);

    // If error code is PGRST116 or mentions "does not exist", table doesn't exist
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        return false;
      }
      // Other errors might mean table exists but has issues
      console.warn(`⚠️  Warning checking ${tableName}:`, error.message);
      return true; // Assume exists if unclear
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Check if a column exists in a table
 */
async function columnExists(tableName, columnName) {
  try {
    // Use RPC to check column existence
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = '${tableName}' 
          AND column_name = '${columnName}'
        ) as exists;
      `
    });

    // If RPC doesn't exist, try direct query
    if (error) {
      // Fallback: try to select the column
      const { error: selectError } = await supabase.from(tableName).select(columnName).limit(0);

      return !selectError;
    }

    return data?.[0]?.exists || false;
  } catch (err) {
    return false;
  }
}

/**
 * Execute SQL migration
 */
async function executeMigration() {
  console.log('📦 Reading migration SQL...\n');

  // Read the migration file
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20251016000001_add_test_tables.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log('✅ Migration file loaded');
  console.log(`   Size: ${(migrationSQL.length / 1024).toFixed(2)} KB\n`);

  console.log('⚠️  Supabase JS client cannot execute raw SQL directly.');
  console.log('   Please execute the migration manually:\n');
  console.log('📋 Steps:');
  console.log('   1. Go to: https://supabase.com/dashboard/project/rpkhiemljhncddmhrilk/sql/new');
  console.log('   2. Copy the SQL below');
  console.log('   3. Paste into SQL Editor');
  console.log('   4. Click "Run"\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(migrationSQL);
  console.log('═══════════════════════════════════════════════════════════\n');

  return false; // Indicates manual execution needed
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Checking for required RLS test tables...\n');

  // Check tables
  const postsExists = await tableExists('posts');
  const roastsExists = await tableExists('roasts');
  const commentsExists = await tableExists('comments');

  console.log('📊 Table Status:');
  console.log(`   posts: ${postsExists ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   roasts: ${roastsExists ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   comments: ${commentsExists ? '✅ EXISTS' : '❌ MISSING'}\n`);

  // Check comments columns
  let commentsColumnsOk = true;
  if (commentsExists) {
    const postIdExists = await columnExists('comments', 'post_id');
    const contentExists = await columnExists('comments', 'content');
    const platformUsernameExists = await columnExists('comments', 'platform_username');

    console.log('📋 Comments Table Columns:');
    console.log(`   post_id: ${postIdExists ? '✅' : '❌ MISSING'}`);
    console.log(`   content: ${contentExists ? '✅' : '❌ MISSING'}`);
    console.log(`   platform_username: ${platformUsernameExists ? '✅' : '❌ MISSING'}\n`);

    commentsColumnsOk = postIdExists && contentExists && platformUsernameExists;
  }

  // Determine if migration needed
  const needsMigration = !postsExists || !roastsExists || !commentsColumnsOk;

  if (!needsMigration) {
    console.log('✅ All required tables and columns exist!\n');
    console.log('🎯 Next steps:');
    console.log('   - Run tests: npm test -- tests/integration/multi-tenant-rls-issue-412.test.js');
    return;
  }

  console.log('⚠️  Migration needed!\n');
  await executeMigration();

  console.log('💡 After executing the migration:');
  console.log('   1. Re-run this script to verify: node scripts/ensure-rls-test-tables.js');
  console.log(
    '   2. Run tests: npm test -- tests/integration/multi-tenant-rls-issue-412.test.js\n'
  );
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
