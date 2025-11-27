#!/usr/bin/env node

/**
 * Apply Migration 030 to Supabase
 *
 * Creates roast_tones table for dynamic tone configuration.
 *
 * Usage:
 *   node scripts/apply-migration-030.js
 *
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 *
 * Related: Issue #876, Migration 030, Issue #1022
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
const migrationPath = path.join(__dirname, '../database/migrations/030_roast_tones_table.sql');

console.log('🚀 Applying Migration 030 to Supabase');
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

console.log('📋 Migration Contents (first 50 lines):');
console.log('==========================================');
console.log(migrationSQL.split('\n').slice(0, 50).join('\n'));
console.log('...(truncated)...\n==========================================\n');

console.log('⚠️  Note: Supabase JS client cannot execute raw SQL directly.');
console.log('   Please use one of the following options:\n');

console.log('Option 1: Use Supabase SQL Editor (Recommended)');
console.log('   1. Go to: https://supabase.com/dashboard/project/rpkhiemljhncddmhrilk/sql/new');
console.log('   2. Copy the migration SQL from:');
console.log(`      ${migrationPath}`);
console.log('   3. Paste into the SQL editor');
console.log('   4. Click "Run" button\n');

console.log('Option 2: Use psql command line');
const dbHost = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
console.log(`   psql -h db.${dbHost}.supabase.co -U postgres -d postgres \\`);
console.log(`     -f ${migrationPath}\n`);

console.log('Option 3: Use the full SQL below');
console.log('==========================================');
console.log(migrationSQL);
console.log('==========================================\n');

console.log('🔍 After applying, verify with this query:');
console.log('==========================================');
console.log(`SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'roast_tones'
ORDER BY ordinal_position;`);
console.log('==========================================\n');

console.log('Expected result: ~17 columns including:');
console.log('  - id (uuid)');
console.log('  - name (character varying)');
console.log('  - display_name (jsonb)');
console.log('  - description (jsonb)');
console.log('  - intensity (integer)');
console.log('  - personality (text)');
console.log('  - resources (ARRAY)');
console.log('  - restrictions (ARRAY)');
console.log('  - examples (jsonb)');
console.log('  - active (boolean)');
console.log('  - is_default (boolean)\n');

console.log('✅ Migration SQL ready to apply');
console.log('   Follow one of the options above to apply the migration.\n');
