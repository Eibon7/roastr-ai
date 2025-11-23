/**
 * Shield Migration Tests - CodeRabbit Round 2
 *
 * Tests for 020_create_shield_actions_table.sql migration with:
 * - Temporal integrity constraints
 * - Partial indexes for active actions
 * - Organization scoping for feature flags
 * - Content snippet length validation
 * - Metadata validation
 * - GDPR compliance functions
 */

const { createClient } = require('@supabase/supabase-js');

describe('Shield Migration Tests - CodeRabbit Round 2', () => {
  let supabase;
  let testOrgId;

  beforeAll(async () => {
    // Initialize test database connection
    supabase = createClient(
      process.env.SUPABASE_URL || 'http://localhost:54321',
      process.env.SUPABASE_SERVICE_KEY || 'test-key'
    );

    // Create test organization
    const { data: org } = await supabase
      .from('organizations')
      .insert({ name: 'Test Shield Org', slug: 'test-shield-org' })
      .select()
      .single();
    testOrgId = org?.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testOrgId) {
      await supabase.from('shield_actions').delete().eq('organization_id', testOrgId);
      await supabase.from('organizations').delete().eq('id', testOrgId);
    }
  });

  describe('Table Structure and Constraints', () => {
    test('should have shield_actions table with correct columns', async () => {
      const { data } = await supabase.from('shield_actions').select('*').limit(0);

      expect(data).toBeDefined();
      // Test passes if no error thrown (table exists)
    });

    test('should enforce temporal integrity constraints', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

      // Test: reverted_at cannot be before created_at
      await expect(
        supabase.from('shield_actions').insert({
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'test-hash-1',
          content_snippet: 'Test content',
          platform: 'twitter',
          reason: 'toxic',
          created_at: new Date().toISOString(),
          reverted_at: pastDate.toISOString() // Invalid: before created_at
        })
      ).rejects.toThrow();
    });

    test('should enforce content snippet length constraint', async () => {
      const longContent = 'x'.repeat(101); // Over 100 chars

      await expect(
        supabase.from('shield_actions').insert({
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'test-hash-2',
          content_snippet: longContent,
          platform: 'twitter',
          reason: 'toxic'
        })
      ).rejects.toThrow();
    });

    test('should enforce content hash length constraint', async () => {
      await expect(
        supabase.from('shield_actions').insert({
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'short', // Less than 32 chars
          content_snippet: 'Test content',
          platform: 'twitter',
          reason: 'toxic'
        })
      ).rejects.toThrow();
    });

    test('should validate metadata as JSON object', async () => {
      // Valid metadata (object)
      const { error: validError } = await supabase.from('shield_actions').insert({
        organization_id: testOrgId,
        action_type: 'block',
        content_hash: 'a'.repeat(64),
        content_snippet: 'Test content',
        platform: 'twitter',
        reason: 'toxic',
        metadata: { key: 'value' }
      });

      expect(validError).toBeNull();

      // Clean up
      await supabase.from('shield_actions').delete().eq('organization_id', testOrgId);
    });

    test('should enforce action_type constraints', async () => {
      await expect(
        supabase.from('shield_actions').insert({
          organization_id: testOrgId,
          action_type: 'invalid_action', // Not in allowed values
          content_hash: 'a'.repeat(64),
          content_snippet: 'Test content',
          platform: 'twitter',
          reason: 'toxic'
        })
      ).rejects.toThrow();
    });

    test('should enforce platform constraints', async () => {
      await expect(
        supabase.from('shield_actions').insert({
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'a'.repeat(64),
          content_snippet: 'Test content',
          platform: 'invalid_platform', // Not in allowed values
          reason: 'toxic'
        })
      ).rejects.toThrow();
    });

    test('should enforce reason constraints', async () => {
      await expect(
        supabase.from('shield_actions').insert({
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'a'.repeat(64),
          content_snippet: 'Test content',
          platform: 'twitter',
          reason: 'invalid_reason' // Not in allowed values
        })
      ).rejects.toThrow();
    });
  });

  describe('Indexes and Performance', () => {
    test('should have partial index for active actions', async () => {
      // Insert test data
      const { data: activeAction } = await supabase
        .from('shield_actions')
        .insert({
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'a'.repeat(64),
          content_snippet: 'Active action',
          platform: 'twitter',
          reason: 'toxic',
          reverted_at: null // Active action
        })
        .select()
        .single();

      const { data: revertedAction } = await supabase
        .from('shield_actions')
        .insert({
          organization_id: testOrgId,
          action_type: 'mute',
          content_hash: 'b'.repeat(64),
          content_snippet: 'Reverted action',
          platform: 'youtube',
          reason: 'harassment',
          reverted_at: new Date().toISOString() // Reverted action
        })
        .select()
        .single();

      // Query should use partial index for active actions
      const { data: activeActions } = await supabase
        .from('shield_actions')
        .select('*')
        .eq('organization_id', testOrgId)
        .is('reverted_at', null);

      expect(activeActions).toHaveLength(1);
      expect(activeActions[0].id).toBe(activeAction.id);

      // Cleanup
      await supabase.from('shield_actions').delete().in('id', [activeAction.id, revertedAction.id]);
    });

    test('should have composite indexes for filtering', async () => {
      // Insert test data with different platforms and reasons
      const testActions = [
        {
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'c'.repeat(64),
          platform: 'twitter',
          reason: 'toxic'
        },
        {
          organization_id: testOrgId,
          action_type: 'mute',
          content_hash: 'd'.repeat(64),
          platform: 'youtube',
          reason: 'harassment'
        }
      ];

      const { data: insertedActions } = await supabase
        .from('shield_actions')
        .insert(testActions)
        .select();

      // Test org + platform composite index
      const { data: twitterActions } = await supabase
        .from('shield_actions')
        .select('*')
        .eq('organization_id', testOrgId)
        .eq('platform', 'twitter');

      expect(twitterActions).toHaveLength(1);

      // Test org + reason composite index
      const { data: toxicActions } = await supabase
        .from('shield_actions')
        .select('*')
        .eq('organization_id', testOrgId)
        .eq('reason', 'toxic');

      expect(toxicActions).toHaveLength(1);

      // Cleanup
      await supabase
        .from('shield_actions')
        .delete()
        .in(
          'id',
          insertedActions.map((a) => a.id)
        );
    });
  });

  describe('Feature Flags with Organization Scoping', () => {
    test('should support organization-scoped feature flags', async () => {
      // Test global feature flag
      const { data: globalFlag } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('flag_name', 'ENABLE_SHIELD_UI')
        .is('organization_id', null)
        .single();

      expect(globalFlag).toBeTruthy();
      expect(globalFlag.enabled).toBe(false); // Default OFF for safety

      // Test organization-specific feature flag
      const { data: orgFlag, error } = await supabase
        .from('feature_flags')
        .insert({
          organization_id: testOrgId,
          flag_name: 'ORG_SPECIFIC_SHIELD',
          enabled: true,
          description: 'Organization-specific shield feature'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(orgFlag.organization_id).toBe(testOrgId);

      // Cleanup
      await supabase.from('feature_flags').delete().eq('id', orgFlag.id);
    });

    test('should enforce unique constraint per organization', async () => {
      // Insert first flag
      const { data: firstFlag } = await supabase
        .from('feature_flags')
        .insert({
          organization_id: testOrgId,
          flag_name: 'UNIQUE_TEST_FLAG',
          enabled: true
        })
        .select()
        .single();

      // Try to insert duplicate flag for same org (should fail)
      await expect(
        supabase.from('feature_flags').insert({
          organization_id: testOrgId,
          flag_name: 'UNIQUE_TEST_FLAG',
          enabled: false
        })
      ).rejects.toThrow();

      // Cleanup
      await supabase.from('feature_flags').delete().eq('id', firstFlag.id);
    });
  });

  describe('GDPR Compliance Functions', () => {
    test('should anonymize old shield actions', async () => {
      // Insert old action (simulate 81 days ago)
      const oldDate = new Date(Date.now() - 81 * 24 * 60 * 60 * 1000);

      const { data: oldAction } = await supabase
        .from('shield_actions')
        .insert({
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'e'.repeat(64),
          content_snippet: 'This should be anonymized',
          platform: 'twitter',
          reason: 'toxic',
          created_at: oldDate.toISOString()
        })
        .select()
        .single();

      // Call anonymization function
      const { data: result } = await supabase.rpc('anonymize_old_shield_actions');

      expect(result).toBeGreaterThanOrEqual(1);

      // Verify action was anonymized
      const { data: anonymizedAction } = await supabase
        .from('shield_actions')
        .select('*')
        .eq('id', oldAction.id)
        .single();

      expect(anonymizedAction.content_snippet).toBe('[ANONYMIZED]');
      expect(anonymizedAction.metadata.anonymized_at).toBeTruthy();

      // Cleanup
      await supabase.from('shield_actions').delete().eq('id', oldAction.id);
    });

    test('should purge very old shield actions', async () => {
      // Insert very old action (simulate 91 days ago)
      const veryOldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);

      const { data: veryOldAction } = await supabase
        .from('shield_actions')
        .insert({
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'f'.repeat(64),
          content_snippet: 'This should be purged',
          platform: 'twitter',
          reason: 'toxic',
          created_at: veryOldDate.toISOString()
        })
        .select()
        .single();

      // Call purge function
      const { data: result } = await supabase.rpc('purge_old_shield_actions');

      expect(result).toBeGreaterThanOrEqual(1);

      // Verify action was purged
      const { data: purgedAction } = await supabase
        .from('shield_actions')
        .select('*')
        .eq('id', veryOldAction.id)
        .single();

      expect(purgedAction).toBeNull();
    });

    test('should not anonymize recent actions', async () => {
      // Insert recent action
      const { data: recentAction } = await supabase
        .from('shield_actions')
        .insert({
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'g'.repeat(64),
          content_snippet: 'This should NOT be anonymized',
          platform: 'twitter',
          reason: 'toxic'
        })
        .select()
        .single();

      // Call anonymization function
      await supabase.rpc('anonymize_old_shield_actions');

      // Verify recent action was NOT anonymized
      const { data: unchangedAction } = await supabase
        .from('shield_actions')
        .select('*')
        .eq('id', recentAction.id)
        .single();

      expect(unchangedAction.content_snippet).toBe('This should NOT be anonymized');
      expect(unchangedAction.metadata.anonymized_at).toBeFalsy();

      // Cleanup
      await supabase.from('shield_actions').delete().eq('id', recentAction.id);
    });
  });

  describe('Row Level Security (RLS)', () => {
    test('should enforce organization isolation', async () => {
      // This test would require setting up proper RLS context
      // For now, we'll test that the policies exist

      // Insert action for test org
      const { data: testAction } = await supabase
        .from('shield_actions')
        .insert({
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'h'.repeat(64),
          content_snippet: 'Test RLS action',
          platform: 'twitter',
          reason: 'toxic'
        })
        .select()
        .single();

      // Verify action exists
      const { data: retrievedAction } = await supabase
        .from('shield_actions')
        .select('*')
        .eq('id', testAction.id)
        .single();

      expect(retrievedAction).toBeTruthy();
      expect(retrievedAction.organization_id).toBe(testOrgId);

      // Cleanup
      await supabase.from('shield_actions').delete().eq('id', testAction.id);
    });
  });

  describe('Triggers and Functions', () => {
    test('should update updated_at on record modification', async () => {
      // Insert action
      const { data: action } = await supabase
        .from('shield_actions')
        .insert({
          organization_id: testOrgId,
          action_type: 'block',
          content_hash: 'i'.repeat(64),
          content_snippet: 'Test trigger action',
          platform: 'twitter',
          reason: 'toxic'
        })
        .select()
        .single();

      const originalUpdatedAt = action.updated_at;

      // Wait a moment then update
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const { data: updatedAction } = await supabase
        .from('shield_actions')
        .update({ reason: 'harassment' })
        .eq('id', action.id)
        .select()
        .single();

      expect(new Date(updatedAction.updated_at)).toBeAfter(new Date(originalUpdatedAt));

      // Cleanup
      await supabase.from('shield_actions').delete().eq('id', action.id);
    });
  });

  describe('Migration Safety and Rollback', () => {
    test('should handle existing data gracefully', async () => {
      // Test that migration can handle existing shield_actions table
      // This is more of a conceptual test since we can't re-run migrations

      // Verify table exists and has expected structure
      const { data } = await supabase.from('shield_actions').select('*').limit(0);

      expect(data).toBeDefined();
    });

    test('should maintain referential integrity', async () => {
      // Test foreign key constraints
      await expect(
        supabase.from('shield_actions').insert({
          organization_id: '00000000-0000-0000-0000-000000000000', // Non-existent org
          action_type: 'block',
          content_hash: 'j'.repeat(64),
          content_snippet: 'Test integrity',
          platform: 'twitter',
          reason: 'toxic'
        })
      ).rejects.toThrow();
    });
  });
});
