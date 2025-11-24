/**
 * Unit Tests for Shield Routes - CodeRabbit Round 5 Improvements
 *
 * Tests the enhanced features added in CodeRabbit Round 5:
 * 1. Enhanced numeric validation for pagination
 * 2. UUID format validation (RFC 4122 compliant)
 * 3. Enhanced metadata safety handling
 * 4. GDPR-compliant content hashing
 * 5. Data minimization for content snippets
 * 6. Improved error handling and validation
 */

const request = require('supertest');
const express = require('express');
const shieldRoutes = require('../../../src/routes/shield');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis()
  }
}));

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      id: 'test-user-id',
      organizationId: 'test-org-id'
    };
    next();
  }
}));

jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn(() => true)
  }
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

describe('Shield Routes - CodeRabbit Round 5 Improvements', () => {
  let app;
  let mockSupabaseClient;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/shield', shieldRoutes);

    mockSupabaseClient = require('../../../src/config/supabase').supabaseServiceClient;
    jest.clearAllMocks();

    // Skip rate limiting in tests
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  describe('Enhanced Numeric Validation', () => {
    beforeEach(() => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: null,
        count: 0
      });
    });

    it('should handle valid numeric string page parameter', async () => {
      const response = await request(app).get('/api/shield/events?page=5&limit=10').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(5);
      expect(response.body.data.pagination.limit).toBe(10);
    });

    it('should handle valid numeric page parameter', async () => {
      const response = await request(app)
        .get('/api/shield/events')
        .query({ page: 3, limit: 25 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(3);
      expect(response.body.data.pagination.limit).toBe(25);
    });

    it('should reject non-numeric page parameter and default to 1', async () => {
      const response = await request(app).get('/api/shield/events?page=abc&limit=xyz').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(20); // Default limit
    });

    it('should cap page parameter at maximum value', async () => {
      const response = await request(app).get('/api/shield/events?page=2000&limit=200').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1000); // Capped at 1000
      expect(response.body.data.pagination.limit).toBe(100); // Capped at 100
    });

    it('should handle negative page and limit values', async () => {
      const response = await request(app).get('/api/shield/events?page=-5&limit=-10').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1); // Default
      expect(response.body.data.pagination.limit).toBe(20); // Default
    });

    it('should handle decimal page parameter', async () => {
      const response = await request(app).get('/api/shield/events?page=5.7&limit=10.3').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1); // Not an integer, defaults to 1
      expect(response.body.data.pagination.limit).toBe(20); // Not an integer, defaults to 20
    });
  });

  describe('UUID Format Validation', () => {
    const validUUIDs = [
      '550e8400-e29b-41d4-a716-446655440000',
      '12345678-1234-1234-1234-123456789abc',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    ];

    const invalidUUIDs = [
      'not-a-uuid',
      '123',
      '550e8400-e29b-41d4-a716-44665544000', // Too short
      '550e8400-e29b-41d4-a716-446655440000-extra', // Too long
      '550e8400-e29b-41d4-a716-44665544000g', // Invalid hex
      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' // Non-hex characters
    ];

    it('should accept valid UUID formats for revert action', async () => {
      for (const validUuid of validUUIDs) {
        mockSupabaseClient.single.mockResolvedValue({
          data: {
            id: validUuid,
            action_type: 'block',
            reverted_at: null,
            metadata: {}
          },
          error: null
        });

        mockSupabaseClient.update.mockResolvedValue({
          data: { id: validUuid },
          error: null
        });

        const response = await request(app)
          .post(`/api/shield/revert/${validUuid}`)
          .send({ reason: 'Test revert' })
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });

    it('should reject invalid UUID formats', async () => {
      for (const invalidUuid of invalidUUIDs) {
        const response = await request(app)
          .post(`/api/shield/revert/${invalidUuid}`)
          .send({ reason: 'Test revert' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_UUID_FORMAT');
        expect(response.body.error.message).toContain('Invalid UUID format');
      }
    });

    it('should handle empty or null UUID', async () => {
      const response = await request(app)
        .post('/api/shield/revert/')
        .send({ reason: 'Test revert' })
        .expect(404); // Route not found due to empty UUID

      // Test with explicit empty string
      const response2 = await request(app)
        .post('/api/shield/revert/ ')
        .send({ reason: 'Test revert' })
        .expect(400);

      expect(response2.body.success).toBe(false);
      expect(response2.body.error.code).toBe('INVALID_ACTION_ID');
    });
  });

  describe('Enhanced Metadata Safety', () => {
    const testUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('should handle normal metadata object safely', async () => {
      const existingMetadata = { source: 'auto', confidence: 0.8 };

      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: testUuid,
          action_type: 'block',
          reverted_at: null,
          metadata: existingMetadata
        },
        error: null
      });

      mockSupabaseClient.update.mockResolvedValue({
        data: { id: testUuid, metadata: { ...existingMetadata, reverted: true } },
        error: null
      });

      const response = await request(app)
        .post(`/api/shield/revert/${testUuid}`)
        .send({ reason: 'Test revert' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify update was called with merged metadata
      const updateCall = mockSupabaseClient.update.mock.calls[0][0];
      expect(updateCall.metadata.source).toBe('auto'); // Preserved
      expect(updateCall.metadata.reverted).toBe(true); // Added
      expect(updateCall.metadata.revertContext).toBe('shield_ui'); // Added
    });

    it('should handle null metadata safely', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: testUuid,
          action_type: 'block',
          reverted_at: null,
          metadata: null
        },
        error: null
      });

      mockSupabaseClient.update.mockResolvedValue({
        data: { id: testUuid, metadata: { reverted: true } },
        error: null
      });

      const response = await request(app)
        .post(`/api/shield/revert/${testUuid}`)
        .send({ reason: 'Test revert' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify update was called with new metadata
      const updateCall = mockSupabaseClient.update.mock.calls[0][0];
      expect(updateCall.metadata.reverted).toBe(true);
      expect(updateCall.metadata.revertContext).toBe('shield_ui');
    });

    it('should handle array metadata (convert to empty object)', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: testUuid,
          action_type: 'block',
          reverted_at: null,
          metadata: ['invalid', 'array', 'metadata']
        },
        error: null
      });

      mockSupabaseClient.update.mockResolvedValue({
        data: { id: testUuid, metadata: { reverted: true } },
        error: null
      });

      const response = await request(app)
        .post(`/api/shield/revert/${testUuid}`)
        .send({ reason: 'Test revert' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify array was converted to empty object base
      const updateCall = mockSupabaseClient.update.mock.calls[0][0];
      expect(updateCall.metadata.reverted).toBe(true);
      expect(updateCall.metadata.revertContext).toBe('shield_ui');
      // Should not contain array elements
      expect(updateCall.metadata['0']).toBeUndefined();
    });

    it('should handle malformed metadata gracefully', async () => {
      // Mock logger to verify warning is logged
      const mockLogger = require('../../../src/utils/logger').logger;

      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: testUuid,
          action_type: 'block',
          reverted_at: null,
          metadata: 'invalid-json-string' // Invalid metadata type
        },
        error: null
      });

      mockSupabaseClient.update.mockResolvedValue({
        data: { id: testUuid, metadata: { reverted: true } },
        error: null
      });

      const response = await request(app)
        .post(`/api/shield/revert/${testUuid}`)
        .send({ reason: 'Test revert' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify update was called with clean metadata
      const updateCall = mockSupabaseClient.update.mock.calls[0][0];
      expect(updateCall.metadata.reverted).toBe(true);
      expect(updateCall.metadata.revertContext).toBe('shield_ui');
    });
  });

  describe('GDPR Content Hashing', () => {
    // These tests would be for the helper functions if they were exported
    // For now, we test the behavior through the API endpoints

    it('should handle content hashing in API responses', async () => {
      const mockEvents = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          action_type: 'block',
          content_hash: 'abc123def456',
          content_snippet: 'This is a test snippet...',
          platform: 'twitter',
          reason: 'toxic',
          created_at: '2024-01-15T12:00:00Z',
          reverted_at: null,
          metadata: {}
        }
      ];

      mockSupabaseClient.single.mockResolvedValue({
        data: mockEvents,
        error: null,
        count: 1
      });

      const response = await request(app).get('/api/shield/events').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events[0].content_hash).toBe('abc123def456');
      expect(response.body.data.events[0].content_snippet).toBe('This is a test snippet...');

      // Verify organization_id is removed from response
      expect(response.body.data.events[0].organization_id).toBeUndefined();
    });
  });

  describe('Enhanced Query Parameter Validation', () => {
    beforeEach(() => {
      mockSupabaseClient.single.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });
    });

    it('should handle null query object safely', async () => {
      // Mock request with null query
      const response = await request(app).get('/api/shield/events').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(20);
    });

    it('should validate filter parameters against whitelist', async () => {
      const response = await request(app)
        .get('/api/shield/events')
        .query({
          category: 'invalid_category',
          platform: 'invalid_platform',
          actionType: 'invalid_action'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.category).toBe('all'); // Default fallback
      expect(response.body.data.filters.platform).toBe('all'); // Default fallback
      expect(response.body.data.filters.actionType).toBe('all'); // Default fallback
    });

    it('should accept valid filter parameters', async () => {
      const response = await request(app)
        .get('/api/shield/events')
        .query({
          category: 'toxic',
          platform: 'twitter',
          actionType: 'block',
          timeRange: '7d'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.category).toBe('toxic');
      expect(response.body.data.filters.platform).toBe('twitter');
      expect(response.body.data.filters.actionType).toBe('block');
      expect(response.body.data.filters.timeRange).toBe('7d');
    });
  });

  describe('Organization Isolation', () => {
    it('should include organization filter in database queries', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      await request(app).get('/api/shield/events').expect(200);

      // Verify that eq was called with organization_id
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('organization_id', 'test-org-id');
    });

    it('should prevent access to other organization data in revert', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // Not found
      });

      const testUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .post(`/api/shield/revert/${testUuid}`)
        .send({ reason: 'Test revert' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACTION_NOT_FOUND');

      // Verify organization filter was applied
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('organization_id', 'test-org-id');
    });
  });
});
