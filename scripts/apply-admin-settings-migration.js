#!/usr/bin/env node

/**
 * Admin Settings Migration Helper (ROA-268)
 *
 * This script provides instructions and guidance for manually applying
 * the admin_settings migration (031_create_admin_settings.sql) via the Supabase Dashboard SQL Editor.
 * It does not execute the migration automatically.
 *
 * @module scripts/apply-admin-settings-migration
 * @requires fs
 * @requires path
 * @requires dotenv
 * @example
 * // Run from command line:
 * // node scripts/apply-admin-settings-migration.js
 *
 * @description
 * Displays step-by-step instructions for applying the admin_settings
 * migration manually. Includes:
 * - Direct link to Supabase SQL Editor
 * - Migration file location
 * - SQL preview
 * - Verification steps
 *
 * Related: Issue #1090, ROA-268
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

console.log('🚀 Admin Settings Migration - Application Guide (ROA-268)\n');
console.log('📋 Project:', SUPABASE_URL);
console.log('📋 Issue: #1090 (ROA-268)\n');

// Read migration SQL
const migrationPath = path.join(
  __dirname,
  '..',
  'database',
  'migrations',
  '031_create_admin_settings.sql'
);

if (!fs.existsSync(migrationPath)) {
  console.error('❌ ERROR: Migration file not found:', migrationPath);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('✅ Migration file loaded:', migrationPath);
console.log('   Size:', (migrationSQL.length / 1024).toFixed(2), 'KB');
console.log('   Lines:', migrationSQL.split('\n').length, '\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📌 MANUAL APPLICATION REQUIRED');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Due to Supabase API limitations, this migration must be applied manually.\n');
console.log('👉 Follow these steps:\n');

const projectRef = (SUPABASE_URL || '').match(/^https:\/\/([^.]+)\./)?.[1] || '<your-project-ref>';
console.log('1. Open Supabase SQL Editor:');
console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new\n`);

console.log('2. Copy the SQL from:');
console.log('   database/migrations/031_create_admin_settings.sql\n');

console.log('3. Paste into the editor\n');

console.log('4. Click "Run" button\n');

console.log('5. Verify success:');
console.log('   SELECT COUNT(*) FROM admin_settings;');
console.log('   -- Should return 0 (empty table is expected initially)\n');

console.log('6. Verify table structure:');
console.log('   SELECT column_name, data_type FROM information_schema.columns');
console.log("   WHERE table_name = 'admin_settings';\n");

console.log('7. Test RLS policies:');
console.log('   -- Should only allow service_role access\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📄 SQL Preview (first 500 chars):');
console.log('━'.repeat(60));
console.log(migrationSQL.substring(0, 500) + '...');
console.log('━'.repeat(60));
console.log('\n✅ Ready to apply when you follow the steps above.');
console.log('💡 Tip: The migration takes ~1 minute to apply manually.\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📝 What this migration creates:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('- admin_settings table: Dynamic runtime configuration for SSOT v2');
console.log('  - key (TEXT PRIMARY KEY): Dot-separated key path');
console.log('  - value (JSONB): Setting value');
console.log('  - updated_at, created_at: Timestamps');
console.log('- RLS policies: Only service_role can access');
console.log('- Trigger: Auto-updates updated_at on changes');
console.log('- Index: On updated_at for efficient queries\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔗 Related Documentation:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('- Issue #1090: docs/plan/issue-1090.md');
console.log('- SSOT Architecture: docs/architecture/sources-of-truth.md');
console.log('- Backend v2: apps/backend-v2/src/lib/loadSettings.ts\n');

process.exit(0);
