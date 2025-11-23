#!/usr/bin/env node
/**
 * Diagnose RLS Issue
 *
 * Tests if RLS policies are working correctly by:
 * 1. Creating test data with serviceClient (bypasses RLS)
 * 2. Trying to read it with testClient (RLS enabled)
 * 3. Verifying JWT token configuration
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
  console.error('❌ ERROR: Missing Supabase credentials');
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error('❌ ERROR: Missing SUPABASE_JWT_SECRET or JWT_SECRET');
  console.error('   This is required to sign JWT tokens for RLS');
  process.exit(1);
}

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const testClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnose() {
  console.log('🔍 Diagnosing RLS issue...\n');

  // Step 1: Create a test organization and user
  console.log('📦 Step 1: Creating test organization...');
  const testOrgId = uuidv4();
  const testUserId = uuidv4();

  const { data: org, error: orgError } = await serviceClient
    .from('organizations')
    .insert({
      id: testOrgId,
      name: 'RLS Test Org',
      slug: `rls-test-${Date.now()}`,
      owner_id: testUserId,
      plan_id: 'free'
    })
    .select()
    .single();

  if (orgError) {
    console.error('❌ Failed to create organization:', orgError.message);
    return;
  }
  console.log('✅ Organization created:', testOrgId);

  // Step 2: Create test user
  console.log('\n📦 Step 2: Creating test user...');
  const { data: user, error: userError } = await serviceClient
    .from('users')
    .insert({
      id: testUserId,
      email: `test-${Date.now()}@example.com`,
      full_name: 'RLS Test User'
    })
    .select()
    .single();

  if (userError && !userError.message.includes('already exists')) {
    console.warn('⚠️  User creation:', userError.message);
  } else {
    console.log('✅ User created/verified:', testUserId);
  }

  // Step 3: Create test post with serviceClient (bypasses RLS)
  console.log('\n📦 Step 3: Creating test post (serviceClient - bypasses RLS)...');
  const testPostId = uuidv4();
  const { data: post, error: postError } = await serviceClient
    .from('posts')
    .insert({
      id: testPostId,
      organization_id: testOrgId,
      platform: 'twitter',
      platform_post_id: `test_${Date.now()}`,
      content: 'Test post for RLS diagnosis',
      author_username: 'testuser'
    })
    .select()
    .single();

  if (postError) {
    console.error('❌ Failed to create post:', postError.message);
    await cleanup(testOrgId, testPostId);
    return;
  }
  console.log('✅ Post created:', testPostId);

  // Step 4: Try to read with testClient WITHOUT JWT (should fail)
  console.log('\n📦 Step 4: Reading post WITHOUT JWT (should fail)...');
  const { data: dataNoAuth, error: errorNoAuth } = await testClient
    .from('posts')
    .select('*')
    .eq('id', testPostId);

  if (errorNoAuth) {
    console.log('✅ Expected: RLS blocked access (no auth)');
  } else if (dataNoAuth && dataNoAuth.length === 0) {
    console.log('✅ Expected: RLS filtered out data (empty array)');
  } else {
    console.warn('⚠️  Unexpected: Got data without auth:', dataNoAuth?.length);
  }

  // Step 5: Create JWT and set session
  console.log('\n📦 Step 5: Creating JWT token and setting session...');
  const token = jwt.sign(
    {
      sub: testUserId,
      organization_id: testOrgId,
      role: 'authenticated',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600
    },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );

  await testClient.auth.setSession({
    access_token: token,
    refresh_token: 'fake-refresh-token'
  });
  console.log('✅ JWT token created and session set');
  console.log(`   Token sub (user_id): ${testUserId}`);
  console.log(`   Token organization_id: ${testOrgId}`);

  // Step 6: Try to read with testClient WITH JWT (should succeed)
  console.log('\n📦 Step 6: Reading post WITH JWT (should succeed)...');
  const { data: dataWithAuth, error: errorWithAuth } = await testClient
    .from('posts')
    .select('*')
    .eq('id', testPostId);

  if (errorWithAuth) {
    console.error('❌ PROBLEM: RLS blocked access even with JWT');
    console.error('   Error:', errorWithAuth.message);
    console.error('   Code:', errorWithAuth.code);
    console.error('\n💡 Possible causes:');
    console.error(
      '   1. JWT_SECRET mismatch (token signed with different secret than Supabase expects)'
    );
    console.error('   2. RLS policy not matching organization_id correctly');
    console.error('   3. Policy checking auth.uid() vs organization.owner_id mismatch');
  } else if (dataWithAuth && dataWithAuth.length > 0) {
    console.log('✅ SUCCESS: RLS allowed access with JWT');
    console.log(`   Found ${dataWithAuth.length} post(s)`);
  } else {
    console.warn('⚠️  Unexpected: No data returned (RLS may be filtering)');
    console.warn('   This suggests RLS policy is blocking access');
  }

  // Cleanup
  await cleanup(testOrgId, testPostId);

  console.log('\n✅ Diagnosis complete');
}

async function cleanup(orgId, postId) {
  console.log('\n🧹 Cleaning up test data...');
  try {
    await serviceClient.from('posts').delete().eq('id', postId);
    await serviceClient.from('organizations').delete().eq('id', orgId);
    console.log('✅ Cleanup complete');
  } catch (err) {
    console.warn('⚠️  Cleanup warning:', err.message);
  }
}

diagnose().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
