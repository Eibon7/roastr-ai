/**
 * Multi-Tenant Test Utilities
 * Helper functions for RLS testing with Supabase
 *
 * Related Issue: #412
 * Related Node: multi-tenant.md
 */

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

// Service client (bypasses RLS)
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test client (RLS-enabled)
const testClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const testTenants = [];
const testUsers = [];
const tenantUsers = new Map(); // Map<tenantId, userId> for JWT context
let currentTenantContext = null;

/**
 * Creates 2 test organizations with users
 */
async function createTestTenants() {
  console.log('🏗️  Creating test tenants...');

  // Create users first (required for owner_id FK)
  const userA = {
    id: uuidv4(),
    email: `test-user-a-${Date.now()}@example.com`,
    name: 'Test User A',
    plan: 'basic'
  };

  const userB = {
    id: uuidv4(),
    email: `test-user-b-${Date.now()}@example.com`,
    name: 'Test User B',
    plan: 'basic'
  };

  const { data: createdUserA, error: errorUserA } = await serviceClient
    .from('users')
    .insert(userA)
    .select()
    .single();

  if (errorUserA) throw new Error(`Failed to create User A: ${JSON.stringify(errorUserA)}`);

  const { data: createdUserB, error: errorUserB } = await serviceClient
    .from('users')
    .insert(userB)
    .select()
    .single();

  if (errorUserB) throw new Error(`Failed to create User B: ${JSON.stringify(errorUserB)}`);

  testUsers.push(createdUserA.id, createdUserB.id);

  // Now create organizations with required fields
  const tenantA = {
    id: uuidv4(),
    name: 'Acme Corp Test',
    slug: `acme-test-${Date.now()}`,
    owner_id: createdUserA.id,
    posts: [],
    comments: [],
    roasts: []
  };

  const tenantB = {
    id: uuidv4(),
    name: 'Beta Inc Test',
    slug: `beta-test-${Date.now()}`,
    owner_id: createdUserB.id,
    posts: [],
    comments: [],
    roasts: []
  };

  const { data: dataA, error: errorA } = await serviceClient
    .from('organizations')
    .insert({
      id: tenantA.id,
      name: tenantA.name,
      slug: tenantA.slug,
      owner_id: tenantA.owner_id,
      plan_id: 'free'
    })
    .select()
    .single();

  if (errorA) throw new Error(`Failed to create Tenant A: ${JSON.stringify(errorA)}`);

  const { data: dataB, error: errorB } = await serviceClient
    .from('organizations')
    .insert({
      id: tenantB.id,
      name: tenantB.name,
      slug: tenantB.slug,
      owner_id: tenantB.owner_id,
      plan_id: 'free'
    })
    .select()
    .single();

  if (errorB) throw new Error(`Failed to create Tenant B: ${JSON.stringify(errorB)}`);

  testTenants.push(tenantA.id, tenantB.id);

  // Map tenants to their owner user IDs for JWT context
  tenantUsers.set(tenantA.id, createdUserA.id);
  tenantUsers.set(tenantB.id, createdUserB.id);

  console.log(`✅ Tenant A: ${tenantA.id} (owner: ${createdUserA.id})`);
  console.log(`✅ Tenant B: ${tenantB.id} (owner: ${createdUserB.id})`);

  return { tenantA, tenantB };
}

/**
 * Seeds test data for a tenant
 */
async function createTestData(tenantId, type = 'all') {
  console.log(`📊 Creating test data for tenant ${tenantId}...`);

  const testData = { posts: [], comments: [], roasts: [] };

  if (type === 'posts' || type === 'all') {
    const posts = [
      {
        id: uuidv4(),
        organization_id: tenantId,
        platform: 'twitter',
        platform_post_id: `post_${Date.now()}_1`,
        content: 'Test post 1',
        author_username: 'testuser1'
      },
      {
        id: uuidv4(),
        organization_id: tenantId,
        platform: 'discord',
        platform_post_id: `post_${Date.now()}_2`,
        content: 'Test post 2',
        author_username: 'testuser2'
      }
    ];

    const { data, error } = await serviceClient
      .from('posts')
      .insert(posts)
      .select();

    if (error) throw new Error(`Failed to create posts: ${error.message}`);
    testData.posts = data;
    console.log(`  ✅ Created ${data.length} posts`);
  }

  if ((type === 'comments' || type === 'all') && testData.posts.length > 0) {
    const comments = testData.posts.map((post, i) => ({
      id: uuidv4(),
      organization_id: tenantId,
      post_id: post.id,
      platform: 'twitter',
      platform_comment_id: `comment_${Date.now()}_${i}`,
      content: `Test comment ${i + 1}`,
      platform_username: `commenter${i + 1}`,
      toxicity_score: 0.5 + (i * 0.1)
    }));

    const { data, error } = await serviceClient
      .from('comments')
      .insert(comments)
      .select();

    if (error) throw new Error(`Failed to create comments: ${error.message}`);
    testData.comments = data;
    console.log(`  ✅ Created ${data.length} comments`);
  }

  if ((type === 'roasts' || type === 'all') && testData.comments.length > 0) {
    const roasts = testData.comments.map((comment, i) => ({
      id: uuidv4(),
      organization_id: tenantId,
      comment_id: comment.id,
      generated_roast: `Test roast ${i + 1}`,
      tone: 'sarcastic',
      model_used: 'gpt-4',
      tokens_used: 100,
      cost_usd: 0.002
    }));

    const { data, error } = await serviceClient
      .from('roasts')
      .insert(roasts)
      .select();

    if (error) throw new Error(`Failed to create roasts: ${error.message}`);
    testData.roasts = data;
    console.log(`  ✅ Created ${data.length} roasts`);
  }

  return testData;
}

/**
 * Switches RLS context via JWT
 */
async function setTenantContext(tenantId) {
  console.log(`🔄 Switching to tenant: ${tenantId}`);

  // Get tenant owner's user ID
  const userId = tenantUsers.get(tenantId);
  if (!userId) {
    throw new Error(`No user found for tenant ${tenantId}`);
  }

  const token = jwt.sign(
    {
      sub: userId,  // Use actual tenant owner's user ID
      organization_id: tenantId,
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

  currentTenantContext = tenantId;

  // Verify
  const { data } = await testClient
    .from('organizations')
    .select('id')
    .eq('id', tenantId)
    .single();

  if (!data) throw new Error(`Failed to verify context for ${tenantId}`);

  console.log(`✅ Context set to: ${tenantId}`);
}

/**
 * Gets current tenant context
 */
function getTenantContext() {
  return currentTenantContext;
}

/**
 * Cleans up all test data
 * Order: roasts → comments → posts → organizations → users
 */
async function cleanupTestData() {
  console.log('🧹 Cleaning up...');

  if (testTenants.length === 0 && testUsers.length === 0) return;

  await serviceClient.from('roasts').delete().in('organization_id', testTenants);
  await serviceClient.from('comments').delete().in('organization_id', testTenants);
  await serviceClient.from('posts').delete().in('organization_id', testTenants);
  await serviceClient.from('organizations').delete().in('id', testTenants);
  await serviceClient.from('users').delete().in('id', testUsers);

  testTenants.length = 0;
  testUsers.length = 0;
  tenantUsers.clear();
  currentTenantContext = null;
  await testClient.auth.signOut();

  console.log('✅ Cleanup complete');
}

module.exports = {
  createTestTenants,
  createTestData,
  setTenantContext,
  getTenantContext,
  cleanupTestData,
  serviceClient,
  testClient
};
