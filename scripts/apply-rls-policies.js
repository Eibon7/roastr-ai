#!/usr/bin/env node
/**
 * Apply RLS Policies for posts, comments, roasts
 *
 * Ensures RLS policies are correctly configured for these tables.
 * This script provides the SQL to execute manually in Supabase SQL Editor.
 *
 * Related:
 *   - Issue #583: RLS Integration Tests
 *   - Migration: supabase/migrations/20251016000001_add_test_tables.sql
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('📋 RLS Policies Migration SQL\n');
console.log('═══════════════════════════════════════════════════════════');
console.log('Execute this SQL in Supabase SQL Editor:');
console.log('https://supabase.com/dashboard/project/rpkhiemljhncddmhrilk/sql/new\n');

// Read the migration file
const migrationPath = path.join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20251016000001_add_test_tables.sql'
);
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log(migrationSQL);
console.log('\n═══════════════════════════════════════════════════════════\n');

console.log('💡 What this migration does:');
console.log('   1. Creates posts table (if not exists)');
console.log('   2. Adds post_id, content, platform_username columns to comments');
console.log('   3. Creates roasts table (if not exists)');
console.log('   4. Creates indexes for performance');
console.log('   5. Enables RLS on posts and roasts');
console.log('   6. Creates RLS policies for organization isolation\n');

console.log('✅ After executing:');
console.log('   - Run: node scripts/ensure-rls-test-tables.js (to verify)');
console.log('   - Run: npm test -- tests/integration/multi-tenant-rls-issue-412.test.js\n');
