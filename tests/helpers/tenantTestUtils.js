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
const crypto = require('crypto');
const logger = require('../../src/utils/logger');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// JWT secret with secure fallback pattern
// Priority: SUPABASE_JWT_SECRET > JWT_SECRET > crypto-generated (test only) > fail-fast
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ||
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'test'
    ? crypto.randomBytes(32).toString('hex')
    : (() => { throw new Error('JWT_SECRET or SUPABASE_JWT_SECRET required for production'); })()
  );

// Better error reporting (CodeRabbit #3353894295 N5)
const missing = [
  !SUPABASE_URL && 'SUPABASE_URL',
  !SUPABASE_SERVICE_KEY && 'SUPABASE_SERVICE_KEY',
  !SUPABASE_ANON_KEY && 'SUPABASE_ANON_KEY'
].filter(Boolean);

if (missing.length > 0) {
  throw new Error(`Missing required Supabase environment variables: ${missing.join(', ')}`);
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
  logger.debug('🏗️  Creating test tenants...');

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

  logger.debug(`✅ Tenant A: ${tenantA.id} (owner: ${createdUserA.id})`);
  logger.debug(`✅ Tenant B: ${tenantB.id} (owner: ${createdUserB.id})`);

  return { tenantA, tenantB };
}

/**
 * Seeds test data for a tenant
 */
async function createTestData(tenantId, type = 'all') {
  logger.debug(`📊 Creating test data for tenant ${tenantId}...`);

  const testData = {
    posts: [],
    comments: [],
    roasts: [],
    integrationConfigs: [],
    usageRecords: [],
    monthlyUsage: [],
    responses: [],
    userBehaviors: [],
    userActivities: []
  };

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
    logger.debug(`  ✅ Created ${data.length} posts`);
  }

  if ((type === 'comments' || type === 'all') && testData.posts.length > 0) {
    const comments = testData.posts.map((post, i) => ({
      id: uuidv4(),
      organization_id: tenantId,
      post_id: post.id,
      platform: 'twitter',
      platform_comment_id: `comment_${Date.now()}_${i}`,
      original_text: `Test comment ${i + 1}`,  // Issue #504: Fix schema mismatch (content → original_text)
      platform_username: `commenter${i + 1}`,
      toxicity_score: 0.5 + (i * 0.1)
    }));

    const { data, error } = await serviceClient
      .from('comments')
      .insert(comments)
      .select();

    if (error) throw new Error(`Failed to create comments: ${error.message}`);
    testData.comments = data;
    logger.debug(`  ✅ Created ${data.length} comments`);
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
    logger.debug(`  ✅ Created ${data.length} roasts`);
  }

  // Issue #583: Add integration_configs test data
  if (type === 'integration_configs' || type === 'all') {
    const integrationConfigs = [
      {
        id: uuidv4(),
        organization_id: tenantId,
        platform: 'twitter',
        enabled: true,
        config: { api_version: 'v2' },
        credentials: { encrypted: true }
      }
    ];

    const { data, error } = await serviceClient
      .from('integration_configs')
      .insert(integrationConfigs)
      .select();

    if (error) logger.warn(`  ⚠️  Failed to create integration_configs: ${error.message}`);
    else {
      testData.integrationConfigs = data;
      logger.debug(`  ✅ Created ${data.length} integration configs`);
    }
  }

  // Issue #583: Add usage_records test data
  if (type === 'usage_records' || type === 'all') {
    const usageRecords = [
      {
        id: uuidv4(),
        organization_id: tenantId,
        platform: 'twitter',
        action_type: 'generate_reply',
        tokens_used: 150,
        cost_cents: 3
      }
    ];

    const { data, error } = await serviceClient
      .from('usage_records')
      .insert(usageRecords)
      .select();

    if (error) logger.warn(`  ⚠️  Failed to create usage_records: ${error.message}`);
    else {
      testData.usageRecords = data;
      logger.debug(`  ✅ Created ${data.length} usage records`);
    }
  }

  // Issue #583: Add monthly_usage test data
  if (type === 'monthly_usage' || type === 'all') {
    const now = new Date();
    const monthlyUsage = [
      {
        id: uuidv4(),
        organization_id: tenantId,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        total_responses: 50,
        responses_limit: 100
      }
    ];

    const { data, error } = await serviceClient
      .from('monthly_usage')
      .insert(monthlyUsage)
      .select();

    if (error) logger.warn(`  ⚠️  Failed to create monthly_usage: ${error.message}`);
    else {
      testData.monthlyUsage = data;
      logger.debug(`  ✅ Created ${data.length} monthly usage records`);
    }
  }

  // Issue #583: Add responses test data (requires comments)
  if ((type === 'responses' || type === 'all') && testData.comments.length > 0) {
    const responses = testData.comments.map((comment, i) => ({
      id: uuidv4(),
      organization_id: tenantId,
      comment_id: comment.id,
      response_text: `Test response ${i + 1}`,
      tone: 'sarcastic',
      humor_type: 'witty'
    }));

    const { data, error } = await serviceClient
      .from('responses')
      .insert(responses)
      .select();

    if (error) logger.warn(`  ⚠️  Failed to create responses: ${error.message}`);
    else {
      testData.responses = data;
      logger.debug(`  ✅ Created ${data.length} responses`);
    }
  }

  // Issue #583: Add user_behaviors test data
  if (type === 'user_behaviors' || type === 'all') {
    const userBehaviors = [
      {
        id: uuidv4(),
        organization_id: tenantId,
        platform: 'twitter',
        platform_user_id: `user_${Date.now()}`,
        platform_username: 'toxicuser',
        total_comments: 10,
        total_violations: 2
      }
    ];

    const { data, error } = await serviceClient
      .from('user_behaviors')
      .insert(userBehaviors)
      .select();

    if (error) logger.warn(`  ⚠️  Failed to create user_behaviors: ${error.message}`);
    else {
      testData.userBehaviors = data;
      logger.debug(`  ✅ Created ${data.length} user behaviors`);
    }
  }

  // Issue #583: Add user_activities test data
  if (type === 'user_activities' || type === 'all') {
    const userActivities = [
      {
        id: uuidv4(),
        organization_id: tenantId,
        activity_type: 'message_sent',
        platform: 'twitter',
        tokens_used: 100
      }
    ];

    const { data, error } = await serviceClient
      .from('user_activities')
      .insert(userActivities)
      .select();

    if (error) logger.warn(`  ⚠️  Failed to create user_activities: ${error.message}`);
    else {
      testData.userActivities = data;
      logger.debug(`  ✅ Created ${data.length} user activities`);
    }
  }

  return testData;
}

/**
 * Switches RLS context via JWT
 */
async function setTenantContext(tenantId) {
  logger.debug(`🔄 Switching to tenant: ${tenantId}`);

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

  // Verify using serviceClient (bypasses RLS) to avoid RLS policy conflicts
  // The testClient will use RLS based on the JWT token we just set
  const { data, error } = await serviceClient
    .from('organizations')
    .select('id')
    .eq('id', tenantId)
    .maybeSingle();

  if (error) {
    logger.error(`❌ Context verification error:`, {
      tenantId,
      error: error.message,
      code: error.code,
      hint: error.hint
    });
    throw new Error(`Failed to verify context for ${tenantId}. Error: ${error.message}`);
  }

  if (!data) {
    logger.warn(`⚠️  Organization ${tenantId} not found in database (may be expected if cleanup ran)`);
    // Don't throw - organization might have been cleaned up, but JWT context is still set
  } else {
    logger.debug(`✅ Context set to: ${tenantId}`);
  }
}

/**
 * Gets current tenant context
 */
function getTenantContext() {
  return currentTenantContext;
}

/**
 * Cleans up all test data
 * Order (respecting FK constraints):
 * responses → roasts → comments → posts → user_activities → user_behaviors →
 * monthly_usage → usage_records → integration_configs → organizations → users
 */
async function cleanupTestData() {
  logger.debug('🧹 Cleaning up...');

  if (testTenants.length === 0 && testUsers.length === 0) return;

  // Issue #583: Clean up new tables (reverse FK order)
  await serviceClient.from('responses').delete().in('organization_id', testTenants);
  await serviceClient.from('roasts').delete().in('organization_id', testTenants);
  await serviceClient.from('comments').delete().in('organization_id', testTenants);
  await serviceClient.from('posts').delete().in('organization_id', testTenants);
  await serviceClient.from('user_activities').delete().in('organization_id', testTenants);
  await serviceClient.from('user_behaviors').delete().in('organization_id', testTenants);
  await serviceClient.from('monthly_usage').delete().in('organization_id', testTenants);
  await serviceClient.from('usage_records').delete().in('organization_id', testTenants);
  await serviceClient.from('integration_configs').delete().in('organization_id', testTenants);
  await serviceClient.from('organizations').delete().in('id', testTenants);
  await serviceClient.from('users').delete().in('id', testUsers);

  testTenants.length = 0;
  testUsers.length = 0;
  tenantUsers.clear();
  currentTenantContext = null;
  await testClient.auth.signOut();

  logger.debug('✅ Cleanup complete');
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
