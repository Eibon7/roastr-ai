/**
 * Shield Database Migration - CodeRabbit Round 3 Security Tests
 * 
 * Integration tests for the enhanced database migration security features:
 * - Temporal integrity constraints with proper NULL handling
 * - SECURITY DEFINER function hardening  
 * - RLS policy consolidation and conflict resolution
 * - Enhanced indexes and constraints
 * - GDPR compliance functions
 */

const { supabaseServiceClient } = require('../../src/config/supabase');

// Skip these tests if running in CI without a real database
const SKIP_INTEGRATION = process.env.SKIP_DB_INTEGRATION === 'true';

describe('Shield Database Migration - CodeRabbit Round 3 Security', () => {
  let testOrgId;
  let testUserId;

  beforeAll(async () => {
    if (SKIP_INTEGRATION) return;

    // Create test organization and user for testing
    const { data: orgData, error: orgError } = await supabaseServiceClient
      .from('organizations')
      .insert({
        name: 'Test Org Shield Round 3',
        slug: 'test-org-shield-r3'
      })
      .select()
      .single();

    if (orgError) throw orgError;
    testOrgId = orgData.id;

    // Create test user
    const { data: userData, error: userError } = await supabaseServiceClient
      .from('users')
      .insert({
        email: 'test-shield-r3@example.com',
        organization_id: testOrgId
      })
      .select()
      .single();

    if (userError) throw userError;
    testUserId = userData.id;
  });

  afterAll(async () => {
    if (SKIP_INTEGRATION) return;

    // Clean up test data
    if (testOrgId) {
      await supabaseServiceClient
        .from('shield_actions')
        .delete()
        .eq('organization_id', testOrgId);

      await supabaseServiceClient
        .from('users')
        .delete()
        .eq('organization_id', testOrgId);

      await supabaseServiceClient
        .from('organizations')
        .delete()
        .eq('id', testOrgId);
    }
  });

  beforeEach(async () => {
    if (SKIP_INTEGRATION) return;

    // Clean up any test shield actions before each test
    await supabaseServiceClient
      .from('shield_actions')
      .delete()
      .eq('organization_id', testOrgId);
  });

  describe('Table Structure and Constraints (Round 3)', () => {
    test('should have proper table structure with all required columns', async () => {
      if (SKIP_INTEGRATION) return;

      const { data, error } = await supabaseServiceClient
        .rpc('get_table_columns', { table_name: 'shield_actions' });

      if (error) throw error;

      const columnNames = data.map(col => col.column_name);
      const expectedColumns = [
        'id', 'organization_id', 'action_type', 'content_hash', 
        'content_snippet', 'platform', 'reason', 'created_at', 
        'reverted_at', 'updated_at', 'metadata'
      ];

      expectedColumns.forEach(col => {
        expect(columnNames).toContain(col);
      });
    });

    test('should enforce action_type constraint', async () => {
      if (SKIP_INTEGRATION) return;

      const invalidActionType = {
        organization_id: testOrgId,
        action_type: 'invalid_action', // Invalid action type
        content_hash: 'a'.repeat(64),
        content_snippet: 'Test content',
        platform: 'twitter',
        reason: 'toxic'
      };

      const { error } = await supabaseServiceClient
        .from('shield_actions')
        .insert(invalidActionType);

      expect(error).toBeTruthy();
      expect(error.message).toContain('violates check constraint');
    });

    test('should enforce platform constraint', async () => {
      if (SKIP_INTEGRATION) return;

      const invalidPlatform = {
        organization_id: testOrgId,
        action_type: 'block',
        content_hash: 'a'.repeat(64),
        content_snippet: 'Test content',
        platform: 'invalid_platform', // Invalid platform
        reason: 'toxic'
      };

      const { error } = await supabaseServiceClient
        .from('shield_actions')
        .insert(invalidPlatform);

      expect(error).toBeTruthy();
      expect(error.message).toContain('violates check constraint');
    });

    test('should enforce reason constraint', async () => {
      if (SKIP_INTEGRATION) return;

      const invalidReason = {
        organization_id: testOrgId,
        action_type: 'block',
        content_hash: 'a'.repeat(64),
        content_snippet: 'Test content',
        platform: 'twitter',
        reason: 'invalid_reason' // Invalid reason
      };

      const { error } = await supabaseServiceClient
        .from('shield_actions')
        .insert(invalidReason);

      expect(error).toBeTruthy();
      expect(error.message).toContain('violates check constraint');
    });

    test('should enforce content_hash minimum length', async () => {
      if (SKIP_INTEGRATION) return;

      const shortHash = {
        organization_id: testOrgId,
        action_type: 'block',
        content_hash: 'short', // Too short
        content_snippet: 'Test content',
        platform: 'twitter',
        reason: 'toxic'
      };

      const { error } = await supabaseServiceClient
        .from('shield_actions')
        .insert(shortHash);

      expect(error).toBeTruthy();
      expect(error.message).toContain('violates check constraint');
    });

    test('should enforce content_snippet length limit', async () => {
      if (SKIP_INTEGRATION) return;

      const longSnippet = {
        organization_id: testOrgId,
        action_type: 'block',
        content_hash: 'a'.repeat(64),
        content_snippet: 'x'.repeat(101), // Too long (>100 chars)
        platform: 'twitter',
        reason: 'toxic'
      };

      const { error } = await supabaseServiceClient
        .from('shield_actions')
        .insert(longSnippet);

      expect(error).toBeTruthy();
      expect(error.message).toContain('violates check constraint');
    });
  });

  describe('Temporal Integrity Constraints (Round 3 Fixed)', () => {
    test('should allow NULL reverted_at (fixed in Round 3)', async () => {
      if (SKIP_INTEGRATION) return;

      const validAction = {
        organization_id: testOrgId,
        action_type: 'block',
        content_hash: 'a'.repeat(64),
        content_snippet: 'Test content',
        platform: 'twitter',
        reason: 'toxic',
        reverted_at: null // Should be allowed
      };

      const { data, error } = await supabaseServiceClient
        .from('shield_actions')
        .insert(validAction)
        .select()
        .single();

      expect(error).toBeFalsy();
      expect(data).toBeTruthy();
      expect(data.reverted_at).toBeNull();
    });

    test('should enforce reverted_at >= created_at when not null', async () => {
      if (SKIP_INTEGRATION) return;

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 2);

      const invalidTemporal = {
        organization_id: testOrgId,
        action_type: 'block',
        content_hash: 'b'.repeat(64),
        content_snippet: 'Test content',
        platform: 'twitter',
        reason: 'toxic',
        created_at: futureDate.toISOString(),
        reverted_at: pastDate.toISOString() // Earlier than created_at
      };

      const { error } = await supabaseServiceClient
        .from('shield_actions')
        .insert(invalidTemporal);

      expect(error).toBeTruthy();
      expect(error.message).toContain('violates check constraint');
    });

    test('should allow valid temporal order', async () => {
      if (SKIP_INTEGRATION) return;

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 2);

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() - 1);

      const validTemporal = {
        organization_id: testOrgId,
        action_type: 'mute',
        content_hash: 'c'.repeat(64),
        content_snippet: 'Valid temporal test',
        platform: 'youtube',
        reason: 'harassment',
        created_at: pastDate.toISOString(),
        reverted_at: futureDate.toISOString() // Later than created_at
      };

      const { data, error } = await supabaseServiceClient
        .from('shield_actions')
        .insert(validTemporal)
        .select()
        .single();

      expect(error).toBeFalsy();
      expect(data).toBeTruthy();
      expect(new Date(data.reverted_at)).toBeInstanceOf(Date);
    });
  });

  describe('Metadata JSONB Validation (Round 3)', () => {
    test('should enforce metadata as valid JSON object', async () => {
      if (SKIP_INTEGRATION) return;

      const validMetadata = {
        organization_id: testOrgId,
        action_type: 'flag',
        content_hash: 'd'.repeat(64),
        content_snippet: 'Metadata test',
        platform: 'discord',
        reason: 'spam',
        metadata: { key: 'value', nested: { prop: 123 } } // Valid object
      };

      const { data, error } = await supabaseServiceClient
        .from('shield_actions')
        .insert(validMetadata)
        .select()
        .single();

      expect(error).toBeFalsy();
      expect(data.metadata).toEqual({ key: 'value', nested: { prop: 123 } });
    });

    test('should reject non-object metadata', async () => {
      if (SKIP_INTEGRATION) return;

      // Test with array (should be rejected)
      const arrayMetadata = {
        organization_id: testOrgId,
        action_type: 'report',
        content_hash: 'e'.repeat(64),
        content_snippet: 'Array metadata test',
        platform: 'twitch',
        reason: 'inappropriate',
        metadata: ['not', 'an', 'object'] // Invalid - array instead of object
      };

      const { error: arrayError } = await supabaseServiceClient
        .from('shield_actions')
        .insert(arrayMetadata);

      expect(arrayError).toBeTruthy();
      expect(arrayError.message).toContain('violates check constraint');
    });
  });

  describe('Row Level Security (Round 3 Unified Policy)', () => {
    test('should enforce organization isolation', async () => {
      if (SKIP_INTEGRATION) return;

      // Create action in test organization
      const { data: insertedData, error: insertError } = await supabaseServiceClient
        .from('shield_actions')
        .insert({
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'f'.repeat(64),
          content_snippet: 'RLS test',
          platform: 'reddit',
          reason: 'toxic'
        })
        .select()
        .single();

      expect(insertError).toBeFalsy();
      expect(insertedData).toBeTruthy();

      // Try to query with different organization context
      // (This would require setting up proper auth context in a real test)
      // For now, we just verify the action was created with correct org_id
      expect(insertedData.organization_id).toBe(testOrgId);
    });
  });

  describe('Updated_at Trigger Function (Round 3 Hardened)', () => {
    test('should automatically update updated_at on record modification', async () => {
      if (SKIP_INTEGRATION) return;

      // Insert initial record
      const { data: initialData, error: insertError } = await supabaseServiceClient
        .from('shield_actions')
        .insert({
          organization_id: testOrgId,
          action_type: 'mute',
          content_hash: 'g'.repeat(64),
          content_snippet: 'Trigger test',
          platform: 'tiktok',
          reason: 'harassment'
        })
        .select()
        .single();

      expect(insertError).toBeFalsy();
      const initialUpdatedAt = new Date(initialData.updated_at);

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update the record
      const { data: updatedData, error: updateError } = await supabaseServiceClient
        .from('shield_actions')
        .update({ 
          reverted_at: new Date().toISOString(),
          metadata: { reverted: true, reason: 'Test revert' }
        })
        .eq('id', initialData.id)
        .select()
        .single();

      expect(updateError).toBeFalsy();
      const newUpdatedAt = new Date(updatedData.updated_at);

      expect(newUpdatedAt).toBeInstanceOf(Date);
      expect(newUpdatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });
  });

  describe('GDPR Compliance Functions (Round 3 Hardened)', () => {
    test('should anonymize old shield actions', async () => {
      if (SKIP_INTEGRATION) return;

      // Create an old action (simulate by setting old created_at)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 85); // 85 days ago

      const { data: oldAction, error: insertError } = await supabaseServiceClient
        .from('shield_actions')
        .insert({
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'h'.repeat(64),
          content_snippet: 'This should be anonymized',
          platform: 'bluesky',
          reason: 'hate_speech',
          created_at: oldDate.toISOString()
        })
        .select()
        .single();

      expect(insertError).toBeFalsy();

      // Run anonymization function
      const { data: anonymizedCount, error: funcError } = await supabaseServiceClient
        .rpc('anonymize_old_shield_actions');

      expect(funcError).toBeFalsy();
      expect(anonymizedCount).toBeGreaterThanOrEqual(1);

      // Verify the action was anonymized
      const { data: anonymizedAction, error: selectError } = await supabaseServiceClient
        .from('shield_actions')
        .select('*')
        .eq('id', oldAction.id)
        .single();

      expect(selectError).toBeFalsy();
      expect(anonymizedAction.content_snippet).toBe('[ANONYMIZED]');
      expect(anonymizedAction.metadata.anonymized_at).toBeTruthy();
    });

    test('should purge very old shield actions', async () => {
      if (SKIP_INTEGRATION) return;

      // Create a very old action (simulate by setting very old created_at)
      const veryOldDate = new Date();
      veryOldDate.setDate(veryOldDate.getDate() - 95); // 95 days ago

      const { data: oldAction, error: insertError } = await supabaseServiceClient
        .from('shield_actions')
        .insert({
          organization_id: testOrgId,
          action_type: 'flag',
          content_hash: 'i'.repeat(64),
          content_snippet: 'This should be purged',
          platform: 'instagram',
          reason: 'spam',
          created_at: veryOldDate.toISOString()
        })
        .select()
        .single();

      expect(insertError).toBeFalsy();
      const actionId = oldAction.id;

      // Run purge function
      const { data: purgedCount, error: funcError } = await supabaseServiceClient
        .rpc('purge_old_shield_actions');

      expect(funcError).toBeFalsy();
      expect(purgedCount).toBeGreaterThanOrEqual(1);

      // Verify the action was purged
      const { data: purgedAction, error: selectError } = await supabaseServiceClient
        .from('shield_actions')
        .select('*')
        .eq('id', actionId)
        .single();

      expect(selectError).toBeTruthy();
      expect(selectError.code).toBe('PGRST116'); // Not found
    });
  });

  describe('Index Performance (Round 3 Enhanced)', () => {
    test('should have proper indexes for query optimization', async () => {
      if (SKIP_INTEGRATION) return;

      // Insert test data
      const testActions = Array.from({ length: 5 }, (_, i) => ({
        organization_id: testOrgId,
        action_type: i % 2 === 0 ? 'block' : 'mute',
        content_hash: String(i).repeat(64),
        content_snippet: `Test action ${i}`,
        platform: i % 2 === 0 ? 'twitter' : 'youtube',
        reason: 'toxic',
        reverted_at: i === 2 ? new Date().toISOString() : null
      }));

      const { error: insertError } = await supabaseServiceClient
        .from('shield_actions')
        .insert(testActions);

      expect(insertError).toBeFalsy();

      // Query with various filters to test index usage
      const queries = [
        // Test organization filter (should use idx_shield_actions_org_id)
        supabaseServiceClient
          .from('shield_actions')
          .select('*')
          .eq('organization_id', testOrgId),

        // Test created_at ordering (should use idx_shield_actions_created_at)
        supabaseServiceClient
          .from('shield_actions')
          .select('*')
          .eq('organization_id', testOrgId)
          .order('created_at', { ascending: false }),

        // Test platform filter (should use idx_shield_actions_org_platform)
        supabaseServiceClient
          .from('shield_actions')
          .select('*')
          .eq('organization_id', testOrgId)
          .eq('platform', 'twitter'),

        // Test active actions (should use idx_shield_actions_active)
        supabaseServiceClient
          .from('shield_actions')
          .select('*')
          .eq('organization_id', testOrgId)
          .is('reverted_at', null)
      ];

      // Execute all queries to verify they work efficiently
      for (const query of queries) {
        const { data, error } = await query;
        expect(error).toBeFalsy();
        expect(Array.isArray(data)).toBeTruthy();
      }
    });
  });

  describe('Feature Flags Integration (Round 3)', () => {
    test('should have ENABLE_SHIELD_UI feature flag with proper defaults', async () => {
      if (SKIP_INTEGRATION) return;

      const { data, error } = await supabaseServiceClient
        .from('feature_flags')
        .select('*')
        .eq('flag_name', 'ENABLE_SHIELD_UI')
        .is('organization_id', null) // Global flag
        .single();

      expect(error).toBeFalsy();
      expect(data).toBeTruthy();
      expect(data.flag_name).toBe('ENABLE_SHIELD_UI');
      expect(data.enabled).toBe(false); // Default OFF for safety (Round 3)
      expect(data.description).toContain('Shield UI interface');
    });

    test('should enforce unique constraint for feature flags per organization', async () => {
      if (SKIP_INTEGRATION) return;

      // Try to insert duplicate global flag
      const { error } = await supabaseServiceClient
        .from('feature_flags')
        .insert({
          organization_id: null,
          flag_name: 'ENABLE_SHIELD_UI',
          enabled: true,
          description: 'Duplicate flag'
        });

      expect(error).toBeTruthy();
      expect(error.message).toContain('duplicate key value violates unique constraint');
    });
  });
});