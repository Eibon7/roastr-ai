#!/usr/bin/env node

/**
 * Execute Migration 030 directly using node-postgres
 *
 * Creates roast_tones table for dynamic tone configuration.
 *
 * Usage:
 *   node scripts/execute-migration-030.js
 *
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_DB_PASSWORD
 *
 * Related: Issue #876, Migration 030, Issue #1022
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_DB_PASSWORD) {
  console.error('❌ ERROR: Missing required environment variables');
  console.error('   Required: SUPABASE_URL, SUPABASE_DB_PASSWORD');
  process.exit(1);
}

// Extract project ref from SUPABASE_URL
const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

// Construct PostgreSQL connection string
const connectionString = `postgres://postgres:${SUPABASE_DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres`;

console.log('🚀 Executing Migration 030');
console.log('==========================================\n');
console.log(`Project: ${projectRef}`);
console.log(`Host: db.${projectRef}.supabase.co\n`);

// Read migration SQL file
const migrationPath = path.join(__dirname, '../database/migrations/030_roast_tones_table.sql');

if (!fs.existsSync(migrationPath)) {
  console.error(`\n❌ ERROR: Migration file not found at ${migrationPath}`);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('📄 Migration SQL loaded');
console.log(`   Lines: ${migrationSQL.split('\n').length}`);
console.log(`   Size: ${migrationSQL.length} bytes\n`);

async function executeMigration() {
  const client = new Client({ connectionString });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');

    console.log('🔍 Checking if roast_tones table exists...');
    const checkResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'roast_tones';
    `);

    if (checkResult.rows.length > 0) {
      console.log('⚠️  Table roast_tones already exists!');
      console.log('   Migration may have already been applied.');
      console.log('   Skipping to avoid errors.\n');

      // Show table structure
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'roast_tones'
        ORDER BY ordinal_position;
      `);

      console.log('📊 Current table structure:');
      console.table(columnsResult.rows);

      return;
    }

    console.log('📝 Table does not exist, proceeding with migration...\n');

    console.log('⚡ Executing migration SQL...');
    await client.query(migrationSQL);
    console.log('✅ Migration executed successfully!\n');

    // Verify table was created
    console.log('🔍 Verifying table creation...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'roast_tones'
      ORDER BY ordinal_position;
    `);

    if (verifyResult.rows.length === 0) {
      throw new Error('Table was not created!');
    }

    console.log(`✅ Table created with ${verifyResult.rows.length} columns:\n`);
    console.table(verifyResult.rows.slice(0, 10)); // Show first 10 columns

    // Check indexes
    console.log('\n🔍 Checking indexes...');
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'roast_tones';
    `);

    console.log(`✅ Found ${indexResult.rows.length} indexes:\n`);
    indexResult.rows.forEach((row) => {
      console.log(`  - ${row.indexname}`);
    });

    // Check triggers
    console.log('\n🔍 Checking triggers...');
    const triggerResult = await client.query(`
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'roast_tones';
    `);

    console.log(`✅ Found ${triggerResult.rows.length} triggers:\n`);
    triggerResult.rows.forEach((row) => {
      console.log(`  - ${row.trigger_name} (${row.action_timing} ${row.event_manipulation})`);
    });

    console.log('\n✅ Migration 030 completed successfully!');
    console.log('   The roast_tones table is ready for use.\n');
  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('\nFull error:');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

executeMigration();
