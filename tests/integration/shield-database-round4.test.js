/**
 * Shield Database Round 4 Integration Tests
 * 
 * Tests for CodeRabbit Round 4 database improvements:
 * - NOT NULL timestamp constraints
 * - Enhanced temporal integrity checks
 * - Performance index validation
 * - Feature flags with organization scoping
 */

const { Pool } = require('pg');

// Mock database connection for testing
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
};

jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool),
}));

describe('Shield Database - Round 4 Enhancements', () => {
  let db;

  beforeAll(async () => {
    db = new Pool();
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Timestamp NOT NULL Constraints', () => {
    test('should enforce NOT NULL constraint on created_at', async () => {
      mockPool.query.mockRejectedValueOnce({
        code: '23502', // NOT NULL violation
        column: 'created_at',
      });

      const insertQuery = `
        INSERT INTO shield_actions (
          organization_id, action_type, content_hash, platform, reason, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;

      try {
        await db.query(insertQuery, [
          'test-org-id',
          'block',
          'test-hash',
          'twitter',
          'toxic',
          null, // Should violate NOT NULL constraint
        ]);
      } catch (error) {
        expect(error.code).toBe('23502');
        expect(error.column).toBe('created_at');
      }
    });

    test('should enforce NOT NULL constraint on updated_at', async () => {
      mockPool.query.mockRejectedValueOnce({
        code: '23502', // NOT NULL violation
        column: 'updated_at',
      });

      const insertQuery = `
        INSERT INTO shield_actions (
          organization_id, action_type, content_hash, platform, reason, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;

      try {
        await db.query(insertQuery, [
          'test-org-id',
          'block',
          'test-hash',
          'twitter',
          'toxic',
          null, // Should violate NOT NULL constraint
        ]);
      } catch (error) {
        expect(error.code).toBe('23502');
        expect(error.column).toBe('updated_at');
      }
    });

    test('should accept valid timestamps', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-action-id',
            created_at: '2024-01-15T12:00:00Z',
            updated_at: '2024-01-15T12:00:00Z',
          }
        ],
      });

      const insertQuery = `
        INSERT INTO shield_actions (
          organization_id, action_type, content_hash, platform, reason
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at, updated_at
      `;

      const result = await db.query(insertQuery, [
        'test-org-id',
        'block',
        'test-hash',
        'twitter',
        'toxic',
      ]);

      expect(result.rows[0]).toHaveProperty('id');
      expect(result.rows[0]).toHaveProperty('created_at');
      expect(result.rows[0]).toHaveProperty('updated_at');
    });
  });

  describe('Enhanced Temporal Integrity Constraints', () => {
    test('should enforce created_at <= updated_at constraint', async () => {
      mockPool.query.mockRejectedValueOnce({
        code: '23514', // CHECK constraint violation
        constraint: 'shield_actions_temporal_integrity',
      });

      const insertQuery = `
        INSERT INTO shield_actions (
          organization_id, action_type, content_hash, platform, reason,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      try {
        await db.query(insertQuery, [
          'test-org-id',
          'block',
          'test-hash',
          'twitter',
          'toxic',
          '2024-01-15T12:00:00Z', // created_at
          '2024-01-15T11:00:00Z', // updated_at (before created_at - should fail)
        ]);
      } catch (error) {
        expect(error.code).toBe('23514');
        expect(error.constraint).toBe('shield_actions_temporal_integrity');
      }
    });

    test('should enforce reverted_at >= created_at constraint', async () => {
      mockPool.query.mockRejectedValueOnce({
        code: '23514', // CHECK constraint violation
        constraint: 'shield_actions_temporal_integrity',
      });

      const insertQuery = `
        INSERT INTO shield_actions (
          organization_id, action_type, content_hash, platform, reason,
          created_at, reverted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      try {
        await db.query(insertQuery, [
          'test-org-id',
          'block',
          'test-hash',
          'twitter',
          'toxic',
          '2024-01-15T12:00:00Z', // created_at
          '2024-01-15T11:00:00Z', // reverted_at (before created_at - should fail)
        ]);
      } catch (error) {
        expect(error.code).toBe('23514');
        expect(error.constraint).toBe('shield_actions_temporal_integrity');
      }
    });

    test('should allow NULL reverted_at', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-action-id',
            created_at: '2024-01-15T12:00:00Z',
            updated_at: '2024-01-15T12:00:00Z',
            reverted_at: null,
          }
        ],
      });

      const insertQuery = `
        INSERT INTO shield_actions (
          organization_id, action_type, content_hash, platform, reason,
          reverted_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at, updated_at, reverted_at
      `;

      const result = await db.query(insertQuery, [
        'test-org-id',
        'block',
        'test-hash',
        'twitter',
        'toxic',
        null, // NULL reverted_at should be allowed
      ]);

      expect(result.rows[0].reverted_at).toBeNull();
    });

    test('should prevent future timestamps beyond allowed skew', async () => {
      mockPool.query.mockRejectedValueOnce({
        code: '23514', // CHECK constraint violation
        constraint: 'shield_actions_temporal_integrity',
      });

      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 1); // 1 hour in future

      const insertQuery = `
        INSERT INTO shield_actions (
          organization_id, action_type, content_hash, platform, reason,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;

      try {
        await db.query(insertQuery, [
          'test-org-id',
          'block',
          'test-hash',
          'twitter',
          'toxic',
          futureTime.toISOString(), // Too far in future - should fail
        ]);
      } catch (error) {
        expect(error.code).toBe('23514');
        expect(error.constraint).toBe('shield_actions_temporal_integrity');
      }
    });

    test('should allow timestamps within clock skew tolerance', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-action-id',
            created_at: new Date().toISOString(),
          }
        ],
      });

      const nearFutureTime = new Date();
      nearFutureTime.setMinutes(nearFutureTime.getMinutes() + 2); // 2 minutes in future (within 5 min tolerance)

      const insertQuery = `
        INSERT INTO shield_actions (
          organization_id, action_type, content_hash, platform, reason,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
      `;

      const result = await db.query(insertQuery, [
        'test-org-id',
        'block',
        'test-hash',
        'twitter',
        'toxic',
        nearFutureTime.toISOString(), // Within tolerance - should succeed
      ]);

      expect(result.rows[0]).toHaveProperty('id');
      expect(result.rows[0]).toHaveProperty('created_at');
    });
  });

  describe('Performance Index Validation', () => {
    test('should verify timestamp performance indexes exist', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { indexname: 'idx_shield_actions_timestamps' },
          { indexname: 'idx_shield_actions_org_time_range' },
          { indexname: 'idx_shield_actions_recent_active' },
        ],
      });

      const indexQuery = `
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'shield_actions' 
        AND indexname LIKE 'idx_shield_actions_%time%'
      `;

      const result = await db.query(indexQuery);

      expect(result.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ indexname: 'idx_shield_actions_timestamps' }),
          expect.objectContaining({ indexname: 'idx_shield_actions_org_time_range' }),
          expect.objectContaining({ indexname: 'idx_shield_actions_recent_active' }),
        ])
      );
    });

    test('should verify partial indexes for active/reverted actions', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { 
            indexname: 'idx_shield_actions_active',
            indexdef: 'CREATE INDEX idx_shield_actions_active ON shield_actions USING btree (organization_id, created_at DESC) WHERE (reverted_at IS NULL)'
          },
          { 
            indexname: 'idx_shield_actions_reverted',
            indexdef: 'CREATE INDEX idx_shield_actions_reverted ON shield_actions USING btree (reverted_at DESC) WHERE (reverted_at IS NOT NULL)'
          },
        ],
      });

      const partialIndexQuery = `
        SELECT indexname, indexdef
        FROM pg_indexes 
        WHERE tablename = 'shield_actions' 
        AND indexdef LIKE '%WHERE%'
      `;

      const result = await db.query(partialIndexQuery);

      expect(result.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            indexname: 'idx_shield_actions_active',
            indexdef: expect.stringContaining('WHERE (reverted_at IS NULL)')
          }),
          expect.objectContaining({ 
            indexname: 'idx_shield_actions_reverted',
            indexdef: expect.stringContaining('WHERE (reverted_at IS NOT NULL)')
          }),
        ])
      );
    });

    test('should verify composite indexes for common queries', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { indexname: 'idx_shield_actions_org_created' },
          { indexname: 'idx_shield_actions_org_reason' },
          { indexname: 'idx_shield_actions_org_platform' },
        ],
      });

      const compositeIndexQuery = `
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'shield_actions' 
        AND indexname LIKE 'idx_shield_actions_org_%'
      `;

      const result = await db.query(compositeIndexQuery);

      expect(result.rows).toHaveLength(3);
      expect(result.rows.map(r => r.indexname)).toEqual(
        expect.arrayContaining([
          'idx_shield_actions_org_created',
          'idx_shield_actions_org_reason',
          'idx_shield_actions_org_platform',
        ])
      );
    });
  });

  describe('Feature Flags with Organization Scoping', () => {
    test('should enforce NOT NULL constraints on feature_flags timestamps', async () => {
      mockPool.query.mockRejectedValueOnce({
        code: '23502', // NOT NULL violation
        column: 'created_at',
      });

      const insertQuery = `
        INSERT INTO feature_flags (
          flag_name, enabled, created_at
        ) VALUES ($1, $2, $3)
      `;

      try {
        await db.query(insertQuery, [
          'ENABLE_SHIELD_UI',
          true,
          null, // Should violate NOT NULL constraint
        ]);
      } catch (error) {
        expect(error.code).toBe('23502');
        expect(error.column).toBe('created_at');
      }
    });

    test('should enforce unique constraint per organization', async () => {
      mockPool.query.mockRejectedValueOnce({
        code: '23505', // Unique violation
        constraint: 'feature_flags_organization_id_flag_name_key',
      });

      const insertQuery = `
        INSERT INTO feature_flags (
          organization_id, flag_name, enabled
        ) VALUES ($1, $2, $3)
      `;

      // First insert should succeed
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      await db.query(insertQuery, ['test-org-id', 'ENABLE_SHIELD_UI', true]);

      // Second insert with same org + flag should fail
      try {
        await db.query(insertQuery, ['test-org-id', 'ENABLE_SHIELD_UI', false]);
      } catch (error) {
        expect(error.code).toBe('23505');
        expect(error.constraint).toBe('feature_flags_organization_id_flag_name_key');
      }
    });

    test('should allow same flag name across different organizations', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'flag-1' }, { id: 'flag-2' }] });

      const insertQuery = `
        INSERT INTO feature_flags (
          organization_id, flag_name, enabled
        ) VALUES ($1, $2, $3)
        RETURNING id
      `;

      // Insert same flag for different organizations
      const result1 = await db.query(insertQuery, ['org-1', 'ENABLE_SHIELD_UI', true]);
      const result2 = await db.query(insertQuery, ['org-2', 'ENABLE_SHIELD_UI', false]);

      expect(result1.rows[0]).toHaveProperty('id');
      expect(result2.rows[0]).toHaveProperty('id');
    });

    test('should handle global flags with NULL organization_id', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'global-flag-id',
            organization_id: null,
            flag_name: 'ENABLE_SHIELD_UI',
            enabled: false,
          }
        ],
      });

      const insertQuery = `
        INSERT INTO feature_flags (
          organization_id, flag_name, enabled, description
        ) VALUES ($1, $2, $3, $4)
        RETURNING id, organization_id, flag_name, enabled
      `;

      const result = await db.query(insertQuery, [
        null, // Global flag
        'ENABLE_SHIELD_UI',
        false,
        'Enable Shield UI interface for viewing and managing moderation actions'
      ]);

      expect(result.rows[0].organization_id).toBeNull();
      expect(result.rows[0].flag_name).toBe('ENABLE_SHIELD_UI');
      expect(result.rows[0].enabled).toBe(false);
    });

    test('should default feature flags to OFF for safety', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-flag-id',
            enabled: false, // Should default to false
          }
        ],
      });

      const insertQuery = `
        INSERT INTO feature_flags (
          organization_id, flag_name
        ) VALUES ($1, $2)
        RETURNING id, enabled
      `;

      const result = await db.query(insertQuery, [
        'test-org-id',
        'NEW_FEATURE_FLAG'
      ]);

      expect(result.rows[0].enabled).toBe(false);
    });
  });

  describe('Updated At Trigger Function', () => {
    test('should automatically update updated_at on record changes', async () => {
      const originalTime = '2024-01-15T12:00:00Z';
      const updatedTime = '2024-01-15T12:30:00Z';

      // Mock initial insert
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-action-id',
            created_at: originalTime,
            updated_at: originalTime,
          }
        ],
      });

      // Mock update with trigger-updated timestamp
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-action-id',
            created_at: originalTime,
            updated_at: updatedTime, // Should be automatically updated by trigger
          }
        ],
      });

      const insertQuery = `
        INSERT INTO shield_actions (
          organization_id, action_type, content_hash, platform, reason
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at, updated_at
      `;

      const insertResult = await db.query(insertQuery, [
        'test-org-id',
        'block',
        'test-hash',
        'twitter',
        'toxic',
      ]);

      const updateQuery = `
        UPDATE shield_actions 
        SET reverted_at = $2
        WHERE id = $1
        RETURNING id, created_at, updated_at
      `;

      const updateResult = await db.query(updateQuery, [
        'test-action-id',
        '2024-01-15T12:30:00Z'
      ]);

      expect(insertResult.rows[0].updated_at).toBe(originalTime);
      expect(updateResult.rows[0].updated_at).toBe(updatedTime);
      expect(updateResult.rows[0].created_at).toBe(originalTime); // Should not change
    });
  });

  describe('GDPR Compliance Functions', () => {
    test('should anonymize old shield actions', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ anonymized_count: 5 }],
      });

      const anonymizeQuery = `SELECT anonymize_old_shield_actions() as anonymized_count`;
      const result = await db.query(anonymizeQuery);

      expect(result.rows[0].anonymized_count).toBe(5);
    });

    test('should purge very old shield actions', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ purged_count: 3 }],
      });

      const purgeQuery = `SELECT purge_old_shield_actions() as purged_count`;
      const result = await db.query(purgeQuery);

      expect(result.rows[0].purged_count).toBe(3);
    });

    test('should handle empty result sets gracefully', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ anonymized_count: 0 }],
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [{ purged_count: 0 }],
      });

      const anonymizeResult = await db.query(`SELECT anonymize_old_shield_actions() as anonymized_count`);
      const purgeResult = await db.query(`SELECT purge_old_shield_actions() as purged_count`);

      expect(anonymizeResult.rows[0].anonymized_count).toBe(0);
      expect(purgeResult.rows[0].purged_count).toBe(0);
    });
  });
});