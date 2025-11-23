/**
 * Shield Routes Round 4 Enhancement Tests
 *
 * Tests for CodeRabbit Round 4 improvements:
 * - Enhanced input validation and sanitization
 * - UUID format validation
 * - Metadata safety handling
 * - Edge case resilience
 */

const request = require('supertest');
const express = require('express');

// Setup test app
const app = express();
app.use(express.json());

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis()
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

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = {
    id: 'test-user-id',
    organizationId: 'test-org-id'
  };
  next();
});

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken
}));

const shieldRoutes = require('../../../src/routes/shield');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const { logger } = require('../../../src/utils/logger');

app.use('/api/shield', shieldRoutes);

describe('Shield Routes - Round 4 Enhancements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced Input Validation', () => {
    test('should handle null/undefined query parameters safely', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0
        })
      });

      const response = await request(app)
        .get('/api/shield/events')
        .query({ page: null, limit: undefined, category: '' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(20);
    });

    test('should validate pagination with string numbers', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0
        })
      });

      const response = await request(app)
        .get('/api/shield/events')
        .query({ page: '5', limit: '25' });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.page).toBe(5);
      expect(response.body.data.pagination.limit).toBe(25);
    });

    test('should cap pagination at maximum limits', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0
        })
      });

      const response = await request(app)
        .get('/api/shield/events')
        .query({ page: '2000', limit: '500' });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.page).toBe(1000); // Capped at 1000
      expect(response.body.data.pagination.limit).toBe(100); // Capped at 100
    });

    test('should handle invalid string pagination gracefully', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0
        })
      });

      const response = await request(app)
        .get('/api/shield/events')
        .query({ page: 'abc', limit: 'xyz' });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.page).toBe(1); // Default
      expect(response.body.data.pagination.limit).toBe(20); // Default
    });

    test('should normalize filter parameters to lowercase', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0
        })
      });

      const response = await request(app).get('/api/shield/events').query({
        category: 'TOXIC',
        platform: 'TWITTER',
        actionType: 'BLOCK',
        timeRange: '30D'
      });

      expect(response.status).toBe(200);
      expect(response.body.data.filters.category).toBe('toxic');
      expect(response.body.data.filters.platform).toBe('twitter');
      expect(response.body.data.filters.actionType).toBe('block');
      expect(response.body.data.filters.timeRange).toBe('30d');
    });

    test('should handle non-string filter parameters', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0
        })
      });

      const response = await request(app).get('/api/shield/events').query({
        category: 123,
        platform: true,
        actionType: null
      });

      expect(response.status).toBe(200);
      expect(response.body.data.filters.category).toBe('all'); // Default
      expect(response.body.data.filters.platform).toBe('all'); // Default
      expect(response.body.data.filters.actionType).toBe('all'); // Default
    });
  });

  describe('UUID Validation for Revert Action', () => {
    test('should validate UUID format for action ID', async () => {
      const response = await request(app)
        .post('/api/shield/revert/invalid-uuid')
        .send({ reason: 'Test revert' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_UUID_FORMAT');
      expect(response.body.error.message).toBe('Invalid action ID format');
    });

    test('should accept valid UUID format', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';

      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' } // Not found
        })
      });

      const response = await request(app)
        .post(`/api/shield/revert/${validUuid}`)
        .send({ reason: 'Test revert' });

      expect(response.status).toBe(404); // Not found, but UUID format was accepted
      expect(response.body.error.code).toBe('ACTION_NOT_FOUND');
    });

    test('should reject empty or whitespace-only action ID', async () => {
      const response = await request(app)
        .post('/api/shield/revert/   ')
        .send({ reason: 'Test revert' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_ACTION_ID');
    });

    test('should handle various UUID formats correctly', async () => {
      const testCases = [
        { id: '00000000-0000-0000-0000-000000000000', valid: true },
        { id: 'AAAAAAAA-BBBB-1CCC-8DDD-EEEEEEEEEEEE', valid: true },
        { id: '123e4567-e89b-42d3-a456-426614174000', valid: true },
        { id: '123e4567-e89b-72d3-f456-426614174000', valid: false }, // Invalid version
        { id: '123e4567-e89b-12d3-c456-426614174000', valid: false }, // Invalid variant
        { id: '123e4567-e89b-12d3-a456-42661417400', valid: false } // Too short
      ];

      for (const testCase of testCases) {
        if (testCase.valid) {
          supabaseServiceClient.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          });
        }

        const response = await request(app)
          .post(`/api/shield/revert/${testCase.id}`)
          .send({ reason: 'Test revert' });

        if (testCase.valid) {
          expect(response.status).toBe(404); // UUID valid, but record not found
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error.code).toBe('INVALID_UUID_FORMAT');
        }
      }
    });
  });

  describe('Enhanced Metadata Safety', () => {
    test('should handle null metadata safely', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';

      supabaseServiceClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: validUuid,
              action_type: 'block',
              content_hash: 'test-hash',
              platform: 'twitter',
              reverted_at: null,
              metadata: null // Null metadata
            },
            error: null
          })
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: validUuid,
              reverted_at: '2024-01-15T12:00:00Z',
              metadata: { reverted: true }
            },
            error: null
          })
        });

      const response = await request(app)
        .post(`/api/shield/revert/${validUuid}`)
        .send({ reason: 'Test revert' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    test('should handle invalid metadata gracefully', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';

      // Mock an action with invalid metadata that could cause TypeError
      const invalidMetadata = 'invalid-json-string';

      supabaseServiceClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: validUuid,
              action_type: 'block',
              content_hash: 'test-hash',
              platform: 'twitter',
              reverted_at: null,
              metadata: invalidMetadata
            },
            error: null
          })
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: validUuid,
              reverted_at: '2024-01-15T12:00:00Z',
              metadata: { reverted: true }
            },
            error: null
          })
        });

      const response = await request(app)
        .post(`/api/shield/revert/${validUuid}`)
        .send({ reason: 'Test revert' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Should log warning about invalid metadata but continue processing
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid metadata found in shield action',
        expect.objectContaining({
          actionId: validUuid,
          metadataType: 'string'
        })
      );
    });

    test('should preserve valid metadata fields', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const existingMetadata = {
        source: 'automated',
        confidence: 0.95,
        tags: ['urgent', 'harassment']
      };

      supabaseServiceClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: validUuid,
              action_type: 'block',
              content_hash: 'test-hash',
              platform: 'twitter',
              reverted_at: null,
              metadata: existingMetadata
            },
            error: null
          })
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: validUuid,
              reverted_at: '2024-01-15T12:00:00Z',
              metadata: {
                ...existingMetadata,
                reverted: true,
                revertedBy: 'test-user-id',
                revertReason: 'Test revert',
                revertSource: 'shield_ui'
              }
            },
            error: null
          })
        });

      const response = await request(app)
        .post(`/api/shield/revert/${validUuid}`)
        .send({ reason: 'Test revert' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify update was called with preserved metadata
      // Issue #618 - Add defensive check for mock.calls array
      expect(supabaseServiceClient.update.mock.calls.length).toBeGreaterThan(0);
      const updateCall = supabaseServiceClient.update.mock.calls[0][0];
      expect(updateCall.metadata).toEqual(
        expect.objectContaining({
          source: 'automated',
          confidence: 0.95,
          tags: ['urgent', 'harassment'],
          reverted: true,
          revertedBy: 'test-user-id',
          revertReason: 'Test revert',
          revertSource: 'shield_ui'
        })
      );
    });

    test('should handle empty string reason safely', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';

      supabaseServiceClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: validUuid,
              action_type: 'block',
              content_hash: 'test-hash',
              platform: 'twitter',
              reverted_at: null,
              metadata: {}
            },
            error: null
          })
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: validUuid,
              reverted_at: '2024-01-15T12:00:00Z',
              metadata: { reverted: true }
            },
            error: null
          })
        });

      const response = await request(app)
        .post(`/api/shield/revert/${validUuid}`)
        .send({ reason: '   ' }); // Whitespace only

      expect(response.status).toBe(200);

      // Should use default reason for empty/whitespace
      const updateCall = supabaseServiceClient.update.mock.calls[0][0];
      expect(updateCall.metadata.revertReason).toBe('Manual revert via UI');
    });
  });

  describe('Edge Case Resilience', () => {
    test('should handle malformed query object gracefully', async () => {
      // Mock a scenario where req.query is not a proper object
      const originalGet = app.get;
      app.get(
        '/test-malformed-query',
        (req, res, next) => {
          req.query = 'not-an-object';
          next();
        },
        shieldRoutes
      );

      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0
        })
      });

      const response = await request(app).get('/test-malformed-query');

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.page).toBe(1); // Should use defaults
    });

    test('should handle organization ID validation edge cases', async () => {
      // Test with missing organizationId
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = { id: 'test-user-id' }; // Missing organizationId
        next();
      });

      const response = await request(app).get('/api/shield/events');

      // Should handle missing organizationId gracefully
      expect(response.status).toBe(200);
    });

    test('should handle database connection errors gracefully', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      });

      const response = await request(app).get('/api/shield/events');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to fetch shield events');
      expect(logger.error).toHaveBeenCalledWith(
        'Shield events endpoint error',
        expect.objectContaining({
          error: 'Database connection failed'
        })
      );
    });
  });

  describe('Response Data Sanitization', () => {
    test('should remove organization_id from response data', async () => {
      const mockData = [
        {
          id: 'action-1',
          organization_id: 'test-org-id', // Should be removed
          action_type: 'block',
          platform: 'twitter',
          reason: 'toxic'
        },
        {
          id: 'action-2',
          organization_id: 'test-org-id', // Should be removed
          action_type: 'mute',
          platform: 'youtube',
          reason: 'spam'
        }
      ];

      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: mockData,
          error: null,
          count: 2
        })
      });

      const response = await request(app).get('/api/shield/events');

      expect(response.status).toBe(200);
      expect(response.body.data.events).toHaveLength(2);

      response.body.data.events.forEach((event) => {
        expect(event).not.toHaveProperty('organization_id');
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('action_type');
        expect(event).toHaveProperty('platform');
        expect(event).toHaveProperty('reason');
      });
    });

    test('should handle null data arrays safely', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: null, // Null data
          error: null,
          count: 0
        })
      });

      const response = await request(app).get('/api/shield/events');

      expect(response.status).toBe(200);
      expect(response.body.data.events).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });
  });
});
