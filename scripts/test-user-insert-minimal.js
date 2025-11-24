#!/usr/bin/env node
/**
 * Minimal Supabase User Insert Test
 * Bypasses Jest to isolate Supabase connection issues
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

console.log('🔌 Connecting to Supabase...');
console.log(`URL: ${SUPABASE_URL}`);
console.log(`Key: ${SUPABASE_SERVICE_KEY?.substring(0, 20)}...`);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testUserInsert() {
  const testUser = {
    id: uuidv4(),
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    plan: 'pro'
  };

  console.log('\n📝 Attempting to insert user...');
  console.log('User data:', JSON.stringify(testUser, null, 2));

  try {
    const response = await client.from('users').insert(testUser).select();

    console.log('\n📊 Full Supabase Response:');
    console.log('Type:', typeof response);
    console.log('Keys:', Object.keys(response));
    console.log('Full object:', JSON.stringify(response, null, 2));

    if (response.error) {
      console.log('\n❌ Error:', response.error);
      console.log('Error details:', JSON.stringify(response.error, null, 2));
    }

    if (response.data) {
      console.log('\n✅ Data:', response.data);
      console.log('Data length:', response.data.length);

      if (response.data.length > 0) {
        console.log('\n🎉 User successfully inserted!');
        console.log('Created user:', response.data[0]);

        // Clean up
        console.log('\n🧹 Cleaning up test user...');
        const deleteResponse = await client.from('users').delete().eq('id', testUser.id);

        if (deleteResponse.error) {
          console.log('⚠️  Cleanup error:', deleteResponse.error);
        } else {
          console.log('✅ Cleanup successful');
        }
      }
    }

    if (!response.data && !response.error) {
      console.log('\n⚠️  WARNING: Response has no data and no error');
      console.log('This suggests the response structure might be unexpected');
    }
  } catch (err) {
    console.error('\n💥 Exception thrown:', err);
    console.error('Stack:', err.stack);
  }
}

testUserInsert()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });
