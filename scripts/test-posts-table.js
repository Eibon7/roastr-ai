#!/usr/bin/env node
/**
 * Test Posts Table Access
 * Diagnose 404 error when inserting posts
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testPostsTable() {
  console.log('🔍 Testing posts table...\n');

  // Test 1: SELECT
  console.log('1️⃣ Testing SELECT...');
  const selectResponse = await client
    .from('posts')
    .select('*')
    .limit(1);

  console.log('Response:', JSON.stringify(selectResponse, null, 2));

  if (selectResponse.status === 404) {
    console.log('\n❌ 404 - Table not found in REST API');
    console.log('Possible causes:');
    console.log('  - Table not exposed in Supabase API settings');
    console.log('  - Schema is not "public"');
    console.log('  - Table name mismatch (case sensitive?)');
    return;
  }

  // Test 2: Try different table names
  console.log('\n2️⃣ Testing alternative table names...');
  for (const tableName of ['posts', 'Posts', 'post', 'Post']) {
    const resp = await client.from(tableName).select('count').limit(0);
    console.log(`  ${tableName}: status ${resp.status}`);
  }

  // Test 3: List all tables (if possible)
  console.log('\n3️⃣ Checking other tables...');
  const tables = ['users', 'organizations', 'comments', 'roasts'];
  for (const table of tables) {
    const resp = await client.from(table).select('count').limit(0);
    console.log(`  ${table}: status ${resp.status}`);
  }

  // Test 4: Try INSERT if SELECT works
  if (selectResponse.status === 200) {
    console.log('\n4️⃣ Testing INSERT...');

    // First create a test org and user
    const userId = uuidv4();
    const orgId = uuidv4();

    const userResp = await client.from('users').insert({
      id: userId,
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      plan: 'pro'
    }).select();

    console.log('User creation:', userResp.status, userResp.statusText);

    if (userResp.status === 201) {
      const orgResp = await client.from('organizations').insert({
        id: orgId,
        name: 'Test Org',
        slug: `test-${Date.now()}`,
        owner_id: userId,
        plan_id: 'free'
      }).select();

      console.log('Org creation:', orgResp.status, orgResp.statusText);

      if (orgResp.status === 201) {
        const postResp = await client.from('posts').insert({
          id: uuidv4(),
          organization_id: orgId,
          platform: 'twitter',
          platform_post_id: `test_${Date.now()}`,
          content: 'Test post',
          author_username: 'testuser'
        }).select();

        console.log('Post creation:', JSON.stringify(postResp, null, 2));

        // Cleanup
        await client.from('posts').delete().eq('organization_id', orgId);
        await client.from('organizations').delete().eq('id', orgId);
        await client.from('users').delete().eq('id', userId);
        console.log('✅ Cleanup done');
      }
    }
  }
}

testPostsTable()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });
