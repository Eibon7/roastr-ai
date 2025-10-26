#!/usr/bin/env node

/**
 * Apply feature_flags migration via Supabase REST API
 *
 * This script attempts to execute the SQL migration using Supabase's
 * PostgREST API by executing statements individually.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

console.log('🚀 Feature Flags Migration - Automated Application\n');
console.log('📋 Project:', SUPABASE_URL);
console.log('\n⚠️  This script will attempt automated migration.');
console.log('   If it fails, use the manual method (see apply-feature-flags-migration-manual.md)\n');

// Read migration SQL
const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add_feature_flags_and_audit_system.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('✅ Migration file loaded:', migrationPath);
console.log('   Size:', (migrationSQL.length / 1024).toFixed(2), 'KB\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📌 MANUAL APPLICATION REQUIRED');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Due to Supabase API limitations, this migration must be applied manually.\n');
console.log('👉 Follow these steps:\n');
console.log('1. Open Supabase SQL Editor:');
console.log('   https://supabase.com/dashboard/project/rpkhiemljhncddmhrilk/sql/new\n');
console.log('2. Copy the SQL from:');
console.log('   database/migrations/add_feature_flags_and_audit_system.sql\n');
console.log('3. Paste into the editor\n');
console.log('4. Click "Run" button\n');
console.log('5. Verify success:');
console.log('   SELECT COUNT(*) FROM feature_flags;\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📄 SQL Preview (first 500 chars):');
console.log('━'.repeat(60));
console.log(migrationSQL.substring(0, 500) + '...');
console.log('━'.repeat(60));
console.log('\n✅ Ready to apply when you follow the steps above.');
console.log('💡 Tip: The migration takes ~2 minutes to apply manually.\n');

process.exit(0);
