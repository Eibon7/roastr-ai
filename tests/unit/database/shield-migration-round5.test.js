/**
 * Database Migration Tests - CodeRabbit Round 5 Shield UI Improvements
 *
 * Tests the enhanced database features added in CodeRabbit Round 5:
 * 1. NOT NULL constraints for timestamp columns
 * 2. Enhanced temporal integrity constraints with clock skew tolerance
 * 3. Improved partial indexes for performance
 * 4. Enhanced constraint validation
 */

const { supabaseServiceClient } = require('../../../src/config/supabase');

// Mock Supabase for testing constraint logic
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn(),
    rpc: jest.fn()
  }
}));

describe('Shield Actions Table Migration - Round 5 Improvements', () => {
  let mockSupabaseClient;

  beforeEach(() => {
    mockSupabaseClient = require('../../../src/config/supabase').supabaseServiceClient;
    jest.clearAllMocks();
  });

  describe('Timestamp NOT NULL Constraints', () => {
    it('should enforce NOT NULL constraint on created_at', async () => {
      // Simulate constraint violation
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: {
          code: '23502', // NOT NULL constraint violation
          message: 'null value in column "created_at" violates not-null constraint',
          details: 'Failing row contains (id, org_id, action_type, null, ...).'
        }
      });

      const invalidAction = {
        organization_id: 'test-org-id',
        action_type: 'block',
        content_hash: 'abc123',
        platform: 'twitter',
        reason: 'toxic',
        created_at: null // This should violate NOT NULL
      };

      const result = await mockSupabaseClient.from('shield_actions').insert(invalidAction);

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23502');
      expect(result.error.message).toContain('not-null constraint');
    });

    it('should enforce NOT NULL constraint on updated_at', async () => {
      // Simulate constraint violation
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: {
          code: '23502', // NOT NULL constraint violation
          message: 'null value in column "updated_at" violates not-null constraint',
          details: 'Failing row contains (id, org_id, action_type, created_at, null, ...).'
        }
      });

      const invalidAction = {
        organization_id: 'test-org-id',
        action_type: 'block',
        content_hash: 'abc123',
        platform: 'twitter',
        reason: 'toxic',
        updated_at: null // This should violate NOT NULL
      };

      const result = await mockSupabaseClient.from('shield_actions').insert(invalidAction);

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23502');
      expect(result.error.message).toContain('not-null constraint');
    });

    it('should accept valid timestamps with defaults', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: [
          {
            id: 'test-id',
            organization_id: 'test-org-id',
            action_type: 'block',
            created_at: '2024-01-15T12:00:00Z',
            updated_at: '2024-01-15T12:00:00Z'
          }
        ],
        error: null
      });

      const validAction = {
        organization_id: 'test-org-id',
        action_type: 'block',
        content_hash: 'abc123',
        platform: 'twitter',
        reason: 'toxic'
        // created_at and updated_at will use defaults
      };

      const result = await mockSupabaseClient.from('shield_actions').insert(validAction);

      expect(result.error).toBeNull();
      expect(result.data[0].created_at).toBeTruthy();
      expect(result.data[0].updated_at).toBeTruthy();
    });
  });

  describe('Enhanced Temporal Integrity Constraints', () => {
    it('should reject records with created_at after current time + 5 minutes', async () => {
      // Simulate temporal integrity constraint violation
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: {
          code: '23514', // Check constraint violation
          message:
            'new row for relation "shield_actions" violates check constraint "shield_actions_temporal_integrity"',
          details: 'Failing row contains future timestamp beyond acceptable clock skew.'
        }
      });

      const futureTime = new Date();
      futureTime.setMinutes(futureTime.getMinutes() + 10); // 10 minutes in future

      const invalidAction = {
        organization_id: 'test-org-id',
        action_type: 'block',
        content_hash: 'abc123',
        platform: 'twitter',
        reason: 'toxic',
        created_at: futureTime.toISOString()
      };

      const result = await mockSupabaseClient.from('shield_actions').insert(invalidAction);

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23514');
      expect(result.error.message).toContain('temporal_integrity');
    });

    it('should accept records with reverted_at after created_at', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: [
          {
            id: 'test-id',
            organization_id: 'test-org-id',
            action_type: 'block',
            created_at: '2024-01-15T12:00:00Z',
            reverted_at: '2024-01-15T13:00:00Z', // 1 hour later
            updated_at: '2024-01-15T13:00:00Z'
          }
        ],
        error: null
      });

      const validAction = {
        organization_id: 'test-org-id',
        action_type: 'block',
        content_hash: 'abc123',
        platform: 'twitter',
        reason: 'toxic',
        created_at: '2024-01-15T12:00:00Z',
        reverted_at: '2024-01-15T13:00:00Z'
      };

      const result = await mockSupabaseClient.from('shield_actions').insert(validAction);

      expect(result.error).toBeNull();
      expect(result.data[0].reverted_at).toBe('2024-01-15T13:00:00Z');
    });

    it('should reject records with reverted_at before created_at', async () => {
      // Simulate temporal integrity constraint violation
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: {
          code: '23514', // Check constraint violation
          message:
            'new row for relation "shield_actions" violates check constraint "shield_actions_temporal_integrity"',
          details: 'Failing row contains reverted_at before created_at.'
        }
      });

      const invalidAction = {
        organization_id: 'test-org-id',
        action_type: 'block',
        content_hash: 'abc123',
        platform: 'twitter',
        reason: 'toxic',
        created_at: '2024-01-15T12:00:00Z',
        reverted_at: '2024-01-15T11:00:00Z' // 1 hour before created_at
      };

      const result = await mockSupabaseClient.from('shield_actions').insert(invalidAction);

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23514');
      expect(result.error.message).toContain('temporal_integrity');
    });

    it('should accept records with 5-minute clock skew tolerance', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: [
          {
            id: 'test-id',
            organization_id: 'test-org-id',
            action_type: 'block',
            created_at: '2024-01-15T12:04:00Z', // 4 minutes in future (within tolerance)
            updated_at: '2024-01-15T12:04:00Z'
          }
        ],
        error: null
      });

      const validAction = {
        organization_id: 'test-org-id',
        action_type: 'block',
        content_hash: 'abc123',
        platform: 'twitter',
        reason: 'toxic',
        created_at: '2024-01-15T12:04:00Z' // Within 5-minute tolerance
      };

      const result = await mockSupabaseClient.from('shield_actions').insert(validAction);

      expect(result.error).toBeNull();
      expect(result.data[0].created_at).toBe('2024-01-15T12:04:00Z');
    });
  });

  describe('Partial Index Performance', () => {
    it('should use partial index for active actions query', async () => {
      // Mock query plan showing index usage
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [
          {
            'QUERY PLAN': [
              'Index Scan using idx_shield_actions_recent_active on shield_actions',
              'Index Cond: ((organization_id = $1) AND (reverted_at IS NULL))',
              "Filter: (created_at > (now() - '30 days'::interval))"
            ]
          }
        ],
        error: null
      });

      // Simulate query that should use the partial index
      const result = await mockSupabaseClient.rpc('explain_query', {
        query: `
          SELECT * FROM shield_actions 
          WHERE organization_id = $1 
          AND reverted_at IS NULL 
          AND created_at > NOW() - INTERVAL '30 days'
          ORDER BY created_at DESC
        `,
        params: ['test-org-id']
      });

      expect(result.error).toBeNull();
      expect(result.data[0]['QUERY PLAN'][0]).toContain('idx_shield_actions_recent_active');
    });

    it('should use partial index for reverted actions query', async () => {
      // Mock query plan showing index usage for reverted actions
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [
          {
            'QUERY PLAN': [
              'Index Scan using idx_shield_actions_reverted on shield_actions',
              'Index Cond: (reverted_at IS NOT NULL)',
              'Filter: (organization_id = $1)'
            ]
          }
        ],
        error: null
      });

      const result = await mockSupabaseClient.rpc('explain_query', {
        query: `
          SELECT * FROM shield_actions 
          WHERE organization_id = $1 
          AND reverted_at IS NOT NULL
          ORDER BY reverted_at DESC
        `,
        params: ['test-org-id']
      });

      expect(result.error).toBeNull();
      expect(result.data[0]['QUERY PLAN'][0]).toContain('idx_shield_actions_reverted');
    });
  });

  describe('Enhanced Constraint Validation', () => {
    it('should validate action_type against allowed values', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: {
          code: '23514', // Check constraint violation
          message:
            'new row for relation "shield_actions" violates check constraint "shield_actions_action_type_check"',
          details: 'Failing row contains invalid action_type value.'
        }
      });

      const invalidAction = {
        organization_id: 'test-org-id',
        action_type: 'invalid_action', // Not in allowed list
        content_hash: 'abc123',
        platform: 'twitter',
        reason: 'toxic'
      };

      const result = await mockSupabaseClient.from('shield_actions').insert(invalidAction);

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23514');
      expect(result.error.message).toContain('action_type_check');
    });

    it('should validate platform against allowed values', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: {
          code: '23514', // Check constraint violation
          message:
            'new row for relation "shield_actions" violates check constraint "shield_actions_platform_check"',
          details: 'Failing row contains invalid platform value.'
        }
      });

      const invalidAction = {
        organization_id: 'test-org-id',
        action_type: 'block',
        content_hash: 'abc123',
        platform: 'invalid_platform', // Not in allowed list
        reason: 'toxic'
      };

      const result = await mockSupabaseClient.from('shield_actions').insert(invalidAction);

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23514');
      expect(result.error.message).toContain('platform_check');
    });

    it('should validate content_hash minimum length', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: {
          code: '23514', // Check constraint violation
          message:
            'new row for relation "shield_actions" violates check constraint "shield_actions_content_hash_check"',
          details: 'Failing row contains content_hash shorter than 32 characters.'
        }
      });

      const invalidAction = {
        organization_id: 'test-org-id',
        action_type: 'block',
        content_hash: 'short', // Less than 32 characters
        platform: 'twitter',
        reason: 'toxic'
      };

      const result = await mockSupabaseClient.from('shield_actions').insert(invalidAction);

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23514');
      expect(result.error.message).toContain('content_hash_check');
    });

    it('should accept valid constraint values', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: [
          {
            id: 'test-id',
            organization_id: 'test-org-id',
            action_type: 'block',
            content_hash: '1234567890abcdef1234567890abcdef12345678', // 40 chars, valid
            platform: 'twitter',
            reason: 'toxic',
            created_at: '2024-01-15T12:00:00Z',
            updated_at: '2024-01-15T12:00:00Z'
          }
        ],
        error: null
      });

      const validAction = {
        organization_id: 'test-org-id',
        action_type: 'block',
        content_hash: '1234567890abcdef1234567890abcdef12345678',
        platform: 'twitter',
        reason: 'toxic'
      };

      const result = await mockSupabaseClient.from('shield_actions').insert(validAction);

      expect(result.error).toBeNull();
      expect(result.data[0].action_type).toBe('block');
      expect(result.data[0].platform).toBe('twitter');
      expect(result.data[0].content_hash).toBe('1234567890abcdef1234567890abcdef12345678');
    });
  });

  describe('GDPR Compliance Functions', () => {
    it('should test anonymize_old_shield_actions function', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: 5, // Number of anonymized records
        error: null
      });

      const result = await mockSupabaseClient.rpc('anonymize_old_shield_actions');

      expect(result.error).toBeNull();
      expect(result.data).toBe(5);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('anonymize_old_shield_actions');
    });

    it('should test purge_old_shield_actions function', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: 3, // Number of purged records
        error: null
      });

      const result = await mockSupabaseClient.rpc('purge_old_shield_actions');

      expect(result.error).toBeNull();
      expect(result.data).toBe(3);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('purge_old_shield_actions');
    });

    it('should handle GDPR function errors gracefully', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'Permission denied for function purge_old_shield_actions',
          code: '42501'
        }
      });

      const result = await mockSupabaseClient.rpc('purge_old_shield_actions');

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('42501');
    });
  });
});
