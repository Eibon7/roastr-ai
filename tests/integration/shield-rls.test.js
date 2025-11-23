/**
 * Shield Actions RLS Integration Tests - Issue #787 AC5
 *
 * Tests Row Level Security policies for Shield actions table:
 * - shield_actions (org-scoped)
 *
 * Related Issue: #787
 * Related Node: multi-tenant.md, shield.md
 * Related PR: #769
 */

const crypto = require('crypto');
const {
  createTestTenants,
  setTenantContext,
  cleanupTestData,
  testClient,
  serviceClient
} = require('../helpers/tenantTestUtils');
const { v4: uuidv4 } = require('uuid');

jest.setTimeout(30000);

function assertNoError(context, error) {
  if (error) {
    console.error(
      `❌ ${context} error:`,
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    );
    const message = error.message || error.details || JSON.stringify(error);
    throw new Error(`Failed to ${context}: ${message}`);
  }
}

describe('Shield Actions RLS Integration Tests - Issue #787 AC5', () => {
  let tenantA, tenantB;
  let shieldActionA, shieldActionB;
  let commentA, commentB;

  beforeAll(async () => {
    console.log('\n🚀 Setting up Shield RLS test environment...\n');

    const tenants = await createTestTenants();
    tenantA = tenants.tenantA;
    tenantB = tenants.tenantB;

    // Create test comments first (required for shield_actions FK)
    commentA = {
      id: uuidv4(),
      organization_id: tenantA.id,
      platform: 'twitter',
      platform_comment_id: `tweet_${Date.now()}_A`,
      platform_user_id: 'twitter_user_A',
      platform_username: '@testuserA',
      original_text: 'Test comment A',
      toxicity_score: 0.95
    };

    commentB = {
      id: uuidv4(),
      organization_id: tenantB.id,
      platform: 'twitter',
      platform_comment_id: `tweet_${Date.now()}_B`,
      platform_user_id: 'twitter_user_B',
      platform_username: '@testuserB',
      original_text: 'Test comment B',
      toxicity_score: 0.92
    };

    const { data: createdCommentA, error: commentAError } = await serviceClient
      .from('comments')
      .insert(commentA)
      .select()
      .single();

    assertNoError('create comment A', commentAError);

    const { data: createdCommentB, error: commentBError } = await serviceClient
      .from('comments')
      .insert(commentB)
      .select()
      .single();

    assertNoError('create comment B', commentBError);

    commentA = createdCommentA;
    commentB = createdCommentB;

    // Create shield_actions records
    // Note: shield_actions table structure: id, organization_id, action_type, content_hash,
    // content_snippet, platform, reason, created_at, reverted_at, updated_at, metadata
    const contentHashA = crypto.createHash('sha256').update(commentA.original_text).digest('hex');
    const contentHashB = crypto.createHash('sha256').update(commentB.original_text).digest('hex');

    shieldActionA = {
      id: uuidv4(),
      organization_id: tenantA.id,
      platform: 'twitter',
      action_type: 'block',
      content_hash: contentHashA,
      content_snippet: commentA.original_text.substring(0, 100),
      reason: 'toxic',
      metadata: {
        comment_id: commentA.id,
        platform_user_id: commentA.platform_user_id,
        platform_username: commentA.platform_username,
        toxicity_score: 0.95,
        severity: 'high'
      }
    };

    shieldActionB = {
      id: uuidv4(),
      organization_id: tenantB.id,
      platform: 'twitter',
      action_type: 'mute',
      content_hash: contentHashB,
      content_snippet: commentB.original_text.substring(0, 100),
      reason: 'toxic',
      metadata: {
        comment_id: commentB.id,
        platform_user_id: commentB.platform_user_id,
        platform_username: commentB.platform_username,
        toxicity_score: 0.92,
        severity: 'medium'
      }
    };

    const { data: actionA, error: actionAError } = await serviceClient
      .from('shield_actions')
      .insert(shieldActionA)
      .select()
      .single();

    assertNoError('create shield_action A', actionAError);

    const { data: actionB, error: actionBError } = await serviceClient
      .from('shield_actions')
      .insert(shieldActionB)
      .select()
      .single();

    assertNoError('create shield_action B', actionBError);

    shieldActionA = actionA;
    shieldActionB = actionB;

    console.log('\n✅ Shield actions test data created\n');
  });

  afterAll(async () => {
    console.log('\n🧹 Tearing down Shield RLS test environment...\n');
    await cleanupTestData();
    console.log('\n✅ Teardown complete\n');
  });

  describe('AC5.1: shield_actions - Listados restringidos por tenant_id', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Tenant A can only see their own shield_actions', async () => {
      const { data, error } = await testClient.from('shield_actions').select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((action) => action.organization_id === tenantA.id)).toBe(true);
      expect(data.some((action) => action.id === shieldActionA.id)).toBe(true);
      expect(data.some((action) => action.id === shieldActionB.id)).toBe(false);
    });

    test('Tenant A cannot see Tenant B shield_actions', async () => {
      const { data, error } = await testClient
        .from('shield_actions')
        .select('*')
        .eq('organization_id', tenantB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0); // RLS blocks cross-tenant access
    });
  });

  describe('AC5.2: shield_actions - Accesos directos por ID verifican tenant_id', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Tenant A can access their own shield_actions by ID', async () => {
      const { data, error } = await testClient
        .from('shield_actions')
        .select('*')
        .eq('id', shieldActionA.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.id).toBe(shieldActionA.id);
      expect(data.organization_id).toBe(tenantA.id);
      expect(data.action_type).toBe('block');
    });

    test('Tenant A cannot access Tenant B shield_actions by ID', async () => {
      const { data, error } = await testClient
        .from('shield_actions')
        .select('*')
        .eq('id', shieldActionB.id)
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('AC5.3: shield_actions - Cross-tenant access blocked', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Tenant A cannot insert shield_actions for Tenant B', async () => {
      const invalidHash = crypto.createHash('sha256').update('invalid content').digest('hex');
      const invalidAction = {
        organization_id: tenantB.id,
        platform: 'twitter',
        action_type: 'block',
        content_hash: invalidHash,
        content_snippet: 'Invalid content',
        reason: 'toxic',
        metadata: {
          platform_user_id: 'twitter_user_X',
          platform_username: '@testuserX'
        }
      };

      const { data, error } = await testClient
        .from('shield_actions')
        .insert(invalidAction)
        .select()
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    test('Tenant A cannot update Tenant B shield_actions', async () => {
      const { data, error } = await testClient
        .from('shield_actions')
        .update({ reason: 'spam' })
        .eq('id', shieldActionB.id)
        .select()
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    test('Tenant A cannot delete Tenant B shield_actions', async () => {
      const { data, error } = await testClient
        .from('shield_actions')
        .delete()
        .eq('id', shieldActionB.id)
        .select()
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('AC5.4: shield_actions - Filtering by platform and author', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Tenant A can filter shield_actions by platform', async () => {
      const { data, error } = await testClient
        .from('shield_actions')
        .select('*')
        .eq('platform', 'twitter');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.every((action) => action.platform === 'twitter')).toBe(true);
      expect(data.every((action) => action.organization_id === tenantA.id)).toBe(true);
    });

    test('Tenant A can filter shield_actions by platform_user_id in metadata', async () => {
      const { data, error } = await testClient
        .from('shield_actions')
        .select('*')
        .eq('metadata->>platform_user_id', 'twitter_user_A');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      expect(
        data.every((action) => {
          const metadata = action.metadata || {};
          return metadata.platform_user_id === 'twitter_user_A';
        })
      ).toBe(true);
      expect(data.every((action) => action.organization_id === tenantA.id)).toBe(true);
    });
  });
});
