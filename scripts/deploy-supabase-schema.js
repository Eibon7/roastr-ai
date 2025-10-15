#!/usr/bin/env node

/**
 * Deploy Supabase Schema Script
 *
 * This script deploys the database/schema.sql to your Supabase instance.
 * It uses the direct Postgres connection for maximum compatibility.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Extract project ref from Supabase URL
const supabaseUrl = process.env.SUPABASE_URL || '';
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

// Postgres connection string for Supabase
// User needs to provide SUPABASE_DB_PASSWORD
const connectionString = process.env.DATABASE_URL ||
  `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres`;

async function deploySchema() {
  console.log('🚀 Starting Supabase Schema Deployment...\n');

  // Validate environment variables
  if (!projectRef) {
    console.error('❌ ERROR: SUPABASE_URL not found in .env');
    console.error('   Your SUPABASE_URL:', supabaseUrl);
    process.exit(1);
  }

  if (!process.env.SUPABASE_DB_PASSWORD && !process.env.DATABASE_URL) {
    console.error('❌ ERROR: Database password required\n');
    console.error('Please add ONE of these to your .env file:\n');
    console.error('Option 1 (Recommended):');
    console.error('  SUPABASE_DB_PASSWORD=your_postgres_password\n');
    console.error('Option 2:');
    console.error('  DATABASE_URL=postgresql://postgres:password@db.rpkhiemljhncddmhrilk.supabase.co:5432/postgres\n');
    console.error('📍 To find your password:');
    console.error('   1. Go to https://supabase.com/dashboard/project/' + projectRef);
    console.error('   2. Settings → Database');
    console.error('   3. Look for "Connection string" or "Database password"');
    console.error('   4. Click "Reset database password" if needed\n');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log('   Project:', projectRef);
  console.log('   Host:', `db.${projectRef}.supabase.co`);
  console.log('   Database: postgres\n');

  // Read schema file
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    console.error('❌ ERROR: schema.sql not found at:', schemaPath);
    process.exit(1);
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');
  console.log('✅ Schema file loaded:', schemaPath);
  console.log('   Size:', (schema.length / 1024).toFixed(2), 'KB');
  console.log('   Lines:', schema.split('\n').length, '\n');

  // Connect to database
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to Supabase...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Check current tables
    console.log('🔍 Checking existing tables...');
    const { rows: existingTables } = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    if (existingTables.length > 0) {
      console.log('⚠️  WARNING: Found existing tables:');
      existingTables.forEach(t => console.log('   -', t.tablename));
      console.log('\n⚠️  The schema will be applied. Existing tables may cause conflicts.');
      console.log('   Consider backing up your data first.\n');

      // Ask for confirmation (in a real scenario, you'd use readline)
      // For now, we'll proceed
    } else {
      console.log('✅ No existing tables (clean slate)\n');
    }

    // Execute schema
    console.log('📦 Executing schema.sql...');
    console.log('   This may take a few seconds...\n');

    await client.query(schema);

    console.log('✅ Schema executed successfully!\n');

    // Verify deployment
    console.log('🔍 Verifying deployment...');
    const { rows: newTables } = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log('✅ Tables created:', newTables.length);
    newTables.forEach(t => console.log('   ✓', t.tablename));

    // Check RLS policies
    const { rows: policies } = await client.query(`
      SELECT schemaname, tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);

    console.log('\n✅ RLS Policies created:', policies.length);
    const policiesByTable = {};
    policies.forEach(p => {
      if (!policiesByTable[p.tablename]) {
        policiesByTable[p.tablename] = [];
      }
      policiesByTable[p.tablename].push(p.policyname);
    });

    Object.entries(policiesByTable).forEach(([table, pols]) => {
      console.log(`   ${table}: ${pols.length} policies`);
    });

    console.log('\n🎉 Deployment completed successfully!\n');
    console.log('Next steps:');
    console.log('   1. Run RLS tests: npm test -- multi-tenant-rls');
    console.log('   2. Verify in Supabase Dashboard: Table Editor');
    console.log('   3. Check issue #490 as resolved\n');

  } catch (error) {
    console.error('\n❌ ERROR during deployment:');
    console.error('   Message:', error.message);

    if (error.code) {
      console.error('   Code:', error.code);
    }

    if (error.message.includes('password authentication failed')) {
      console.error('\n💡 TIP: Your database password might be incorrect.');
      console.error('   Reset it at: https://supabase.com/dashboard/project/' + projectRef + '/settings/database');
    } else if (error.message.includes('already exists')) {
      console.error('\n💡 TIP: Some objects already exist. The schema was partially applied.');
      console.error('   This might be OK if you\'re re-running the script.');
    }

    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Connection closed');
  }
}

// Run deployment
deploySchema().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
