#!/usr/bin/env node
/**
 * Test Supabase Connection and Schema
 * Verifies database connection and table structure
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testConnection() {
  console.log('🔌 Testing Supabase Connection...\n');
  console.log(`URL: ${SUPABASE_URL}`);
  console.log(`Service Key: ${SUPABASE_SERVICE_KEY.substring(0, 20)}...\n`);

  // Test 1: List tables
  console.log('📊 Checking tables...');
  const tables = ['users', 'organizations', 'posts', 'comments', 'roasts'];

  for (const table of tables) {
    try {
      const { data, error, count } = await client
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: ${count !== null ? count : '?'} rows`);
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
    }
  }

  // Test 2: Check users table structure
  console.log('\n🔍 Checking users table structure...');
  try {
    const { data, error } = await client
      .from('users')
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ Cannot query users table: ${error.message}`);
      console.log('Error details:', JSON.stringify(error, null, 2));
    } else {
      if (data && data.length > 0) {
        console.log('✅ Users table columns:', Object.keys(data[0]));
      } else {
        console.log('⚠️  Users table is empty, testing INSERT...');

        // Try to insert a test user
        const testUser = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'test@example.com',
          name: 'Test User',
          plan: 'free'
        };

        const { data: inserted, error: insertError } = await client
          .from('users')
          .insert(testUser)
          .select()
          .single();

        if (insertError) {
          console.log(`❌ Cannot insert into users: ${insertError.message}`);
          console.log('Error details:', JSON.stringify(insertError, null, 2));
          console.log('\n🔍 Possible issues:');
          console.log('  1. Missing required columns');
          console.log('  2. RLS policy blocking service_role');
          console.log('  3. Foreign key constraints');
        } else {
          console.log('✅ Successfully inserted test user');
          console.log('Columns available:', Object.keys(inserted));

          // Clean up
          await client.from('users').delete().eq('id', testUser.id);
          console.log('✅ Cleaned up test user');
        }
      }
    }
  } catch (err) {
    console.log(`❌ Error checking users table: ${err.message}`);
  }

  // Test 3: Check organizations table
  console.log('\n🔍 Checking organizations table structure...');
  try {
    const { data, error } = await client
      .from('organizations')
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ Cannot query organizations: ${error.message}`);
    } else {
      if (data && data.length > 0) {
        console.log('✅ Organizations table columns:', Object.keys(data[0]));
      } else {
        console.log('⚠️  Organizations table is empty');
      }
    }
  } catch (err) {
    console.log(`❌ Error checking organizations: ${err.message}`);
  }
}

testConnection()
  .then(() => {
    console.log('\n✅ Connection test complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Connection test failed:', err);
    process.exit(1);
  });
