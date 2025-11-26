#!/usr/bin/env node

/**
 * Apply Migration 026 to Supabase
 *
 * Adds roasting_enabled columns to users table.
 *
 * Usage:
 *   node scripts/apply-migration-026.js
 *
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 *
 * Related: Issue #596, Migration 026, Issue #1022
 */

const fs = require('fs');
const path = require('path');

// Get credentials from environment
// Try multiple .env locations for worktree support
const envPaths = [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../../.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`📋 Loading .env from: ${envPath}`);
    require('dotenv').config({ path: envPath });
    break;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing required environment variables');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Read migration SQL file
const migrationPath = path.join(__dirname, '../database/migrations/026_add_roasting_control.sql');

console.log('🚀 Applying Migration 026 to Supabase');
console.log('==========================================\n');
console.log(`Migration file: ${migrationPath}`);
console.log(`Supabase URL: ${SUPABASE_URL}\n`);

if (!fs.existsSync(migrationPath)) {
  console.error(`\n❌ ERROR: Migration file not found at ${migrationPath}`);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('📄 Migration SQL loaded successfully');
console.log(`   Lines: ${migrationSQL.split('\n').length}`);
console.log(`   Size: ${migrationSQL.length} bytes\n`);

console.log('📋 Migration Contents:');
console.log('==========================================');
console.log(migrationSQL);
console.log('==========================================\n');

console.log('⚠️  Note: Supabase JS client cannot execute raw SQL directly.');
console.log('   Please use one of the following options:\n');

console.log('Option 1: Use Supabase SQL Editor (Recommended)');
console.log('   1. Go to: https://supabase.com/dashboard/project/rpkhiemljhncddmhrilk/sql/new');
console.log('   2. Copy the migration SQL above');
console.log('   3. Paste into the SQL editor');
console.log('   4. Click "Run" button\n');

console.log('Option 2: Use psql command line');
const dbHost = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
console.log(`   psql -h db.${dbHost}.supabase.co -U postgres -d postgres \\`);
console.log(`     -f ${migrationPath}\n`);

console.log('Option 3: Execute using this script\'s output');
console.log('   1. Copy the SQL between the ========== lines above');
console.log('   2. Connect to your database');
console.log('   3. Execute the SQL\n');

console.log('🔍 After applying, verify with this query:');
console.log('==========================================');
console.log(`SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name LIKE 'roasting%'
ORDER BY column_name;`);
console.log('==========================================\n');

console.log('Expected result: 3 columns');
console.log('  - roasting_enabled (boolean, not null, default: true)');
console.log('  - roasting_disabled_at (timestamp with time zone, nullable)');
console.log('  - roasting_disabled_reason (text, nullable)\n');

console.log('✅ Migration SQL ready to apply');
console.log('   Follow one of the options above to apply the migration.\n');
