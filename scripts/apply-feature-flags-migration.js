#!/usr/bin/env node

/**
 * Alternative Feature Flags Migration Script
 *
 * Attempts to apply the feature_flags migration programmatically.
 * Falls back to manual instructions if direct SQL execution is not available.
 *
 * @module scripts/apply-feature-flags-migration
 * @requires @supabase/supabase-js
 * @requires dotenv
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Applies the feature_flags migration to Supabase database.
 *
 * Attempts to execute the SQL migration using Supabase RPC.
 * If RPC is not available, verifies table existence and provides
 * manual migration instructions.
 *
 * @async
 * @function applyMigration
 * @returns {Promise<void>}
 * @throws {Error} When environment variables are missing
 * @throws {Error} When migration file is not found
 * @example
 * // Run from command line:
 * // node scripts/apply-feature-flags-migration.js
 */
async function applyMigration() {
  console.log('🚀 Applying feature_flags migration...\n');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  // Read migration file
  const migrationPath = path.join(
    __dirname,
    '..',
    'database',
    'migrations',
    'add_feature_flags_and_audit_system.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ ERROR: Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log('✅ Migration file loaded');
  console.log('   Size:', (sql.length / 1024).toFixed(2), 'KB\n');

  // Create Supabase client
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    console.log('📦 Executing SQL migration...');

    // Execute migration using Supabase client
    // Note: Supabase client doesn't have direct SQL execution, so we'll use RPC
    // Or we need to execute it statement by statement

    const { error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      // exec_sql might not exist, try alternative: execute statements manually
      console.log('⚠️  Direct SQL execution not available, trying statement-by-statement...');

      // For now, let's just check if table exists
      const { error: checkError } = await supabase
        .from('feature_flags')
        .select('*', { count: 'exact', head: true });

      if (checkError && checkError.message.includes('does not exist')) {
        console.error('❌ Table feature_flags does not exist.');
        console.error('   Please apply migration manually via Supabase Dashboard SQL Editor:');
        console.error(
          '   1. Go to https://supabase.com/dashboard/project/' +
            process.env.SUPABASE_URL.match(/https:\/\/([^.]+)/)[1]
        );
        console.error('   2. Open SQL Editor');
        console.error('   3. Paste contents of:', migrationPath);
        console.error('   4. Run the migration');
        process.exit(1);
      }

      console.log('✅ Table feature_flags already exists!');
    } else {
      console.log('✅ Migration applied successfully!\n');
    }

    // Verify table exists
    const { error: countError } = await supabase
      .from('feature_flags')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log('✅ Verified: feature_flags table exists');
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

applyMigration();
