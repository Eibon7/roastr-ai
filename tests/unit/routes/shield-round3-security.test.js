/**
 * Shield Routes - CodeRabbit Round 3 Security Tests
 * 
 * Tests for enhanced security features applied in Round 3:
 * - Enhanced input validation with stricter parameter checks
 * - Improved error messages with security context
 * - UUID validation enhancements for shield action IDs
 * - Additional XSS and injection protections
 * - Rate limiting enhancements
 */

const request = require('supertest');
const express = require('express');
const rateLimit = require('express-rate-limit');

// Mock dependencies
const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = { 
    id: 'test-user-id', 
    organizationId: 'test-org-id',
    email: 'test@example.com' 
  };
  next();
});

const mockSupabaseServiceClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis()
};

const mockFlags = {
  isEnabled: jest.fn().mockReturnValue(true)
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Mock modules
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken
}));

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabaseServiceClient
}));

jest.mock('../../../src/config/flags', () => ({
  flags: mockFlags
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: mockLogger
}));

// Import the shield routes
const shieldRoutes = require('../../../src/routes/shield');

const app = express();
app.use(express.json());
app.use('/api/shield', shieldRoutes);

describe('Shield Routes - CodeRabbit Round 3 Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockSupabaseServiceClient.from.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.select.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.eq.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.gte.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.order.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.range.mockReturnValue(mockSupabaseServiceClient);
  });

  describe('Enhanced Input Validation (Round 3)', () => {
    test('should handle non-numeric pagination parameters gracefully', async () => {
      mockSupabaseServiceClient.select.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      const response = await request(app)
        .get('/api/shield/events?page=abc&limit=xyz')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          events: [],
          pagination: {
            page: 1, // Should default to 1
            limit: 20, // Should default to 20
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          },
          filters: expect.objectContaining({
            category: 'all',
            timeRange: '30d',
            platform: 'all',
            actionType: 'all'
          })
        }
      });
    });

    test('should validate and sanitize filter parameters against whitelists', async () => {
      mockSupabaseServiceClient.select.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      // Test with invalid filter values
      const response = await request(app)
        .get('/api/shield/events?category=malicious&platform=evil&actionType=hack')
        .expect(200);

      expect(response.body.data.filters).toEqual({
        category: 'all', // Should fallback to 'all'
        timeRange: '30d',
        platform: 'all', // Should fallback to 'all'
        actionType: 'all', // Should fallback to 'all'
        startDate: expect.any(String)
      });
    });

    test('should enforce maximum limit of 100 items per page', async () => {
      mockSupabaseServiceClient.select.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      const response = await request(app)
        .get('/api/shield/events?limit=999')
        .expect(200);

      expect(response.body.data.pagination.limit).toBe(100); // Should be capped at 100
    });

    test('should enforce minimum page number of 1', async () => {
      mockSupabaseServiceClient.select.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      const response = await request(app)
        .get('/api/shield/events?page=-5')
        .expect(200);

      expect(response.body.data.pagination.page).toBe(1); // Should be minimum 1
    });
  });

  describe('Enhanced UUID Validation (Round 3)', () => {
    test('should validate UUID format strictly for revert actions', async () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '12345',
        'abc-def-ghi',
        '00000000-0000-0000-0000-00000000000', // Too short
        '00000000-0000-0000-0000-000000000000X', // Too long
        '00000000-0000-7000-0000-000000000000', // Invalid version
        '00000000-0000-4000-c000-000000000000' // Invalid variant
      ];

      for (const invalidUUID of invalidUUIDs) {
        const response = await request(app)
          .post(`/api/shield/revert/${invalidUUID}`)
          .send({ reason: 'Test revert' })
          .expect(400);

        expect(response.body).toEqual({
          success: false,
          error: {
            message: 'Invalid action ID format',
            code: 'INVALID_ACTION_ID',
            details: 'Action ID must be a valid UUID format'
          }
        });
      }
    });

    test('should accept valid UUID formats for revert actions', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      
      // Mock existing action
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: {
          id: validUUID,
          action_type: 'block',
          platform: 'twitter',
          reverted_at: null
        },
        error: null
      });

      // Mock successful update
      mockSupabaseServiceClient.update.mockResolvedValue({
        data: {
          id: validUUID,
          reverted_at: new Date().toISOString()
        },
        error: null
      });

      const response = await request(app)
        .post(`/api/shield/revert/${validUUID}`)
        .send({ reason: 'Valid test' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Enhanced Reason Validation (Round 3)', () => {
    test('should sanitize and validate revert reasons', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';

      const invalidReasons = [
        '<script>alert("xss")</script>', // XSS attempt
        'A'.repeat(101), // Too long
        '', // Empty
        '   ', // Whitespace only
        'test<>invalid&chars%', // Invalid characters
        null // Null (should be handled)
      ];

      for (const invalidReason of invalidReasons.slice(0, -1)) { // Exclude null for this test
        const response = await request(app)
          .post(`/api/shield/revert/${validUUID}`)
          .send({ reason: invalidReason })
          .expect(400);

        expect(response.body.error.code).toBe('INVALID_REASON');
      }
    });

    test('should accept valid sanitized reasons', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const validReason = 'False positive detected';

      // Mock existing action
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: {
          id: validUUID,
          action_type: 'block',
          platform: 'twitter',
          reverted_at: null
        },
        error: null
      });

      // Mock successful update
      mockSupabaseServiceClient.update.mockResolvedValue({
        data: {
          id: validUUID,
          reverted_at: new Date().toISOString(),
          metadata: {
            reverted: true,
            revertReason: validReason
          }
        },
        error: null
      });

      const response = await request(app)
        .post(`/api/shield/revert/${validUUID}`)
        .send({ reason: validReason })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle null/undefined reasons gracefully', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';

      // Mock existing action
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: {
          id: validUUID,
          action_type: 'block',
          platform: 'twitter',
          reverted_at: null
        },
        error: null
      });

      // Mock successful update
      mockSupabaseServiceClient.update.mockResolvedValue({
        data: {
          id: validUUID,
          reverted_at: new Date().toISOString()
        },
        error: null
      });

      // Test without reason
      const response = await request(app)
        .post(`/api/shield/revert/${validUUID}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Response Data Sanitization (Round 3)', () => {
    test('should remove organization_id from response data', async () => {
      const mockData = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          organization_id: 'test-org-id', // Should be removed
          action_type: 'block',
          platform: 'twitter',
          reason: 'toxic',
          created_at: '2024-01-15T10:00:00Z'
        }
      ];

      mockSupabaseServiceClient.select.mockResolvedValue({
        data: mockData,
        error: null,
        count: 1
      });

      const response = await request(app)
        .get('/api/shield/events')
        .expect(200);

      expect(response.body.data.events[0]).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        action_type: 'block',
        platform: 'twitter',
        reason: 'toxic',
        created_at: '2024-01-15T10:00:00Z'
        // organization_id should not be present
      });

      expect(response.body.data.events[0]).not.toHaveProperty('organization_id');
    });
  });

  describe('Enhanced Error Messages (Round 3)', () => {
    test('should provide detailed error context for invalid pagination', async () => {
      // This is actually handled gracefully now, but we test the error structure
      mockSupabaseServiceClient.select.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/shield/events')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Failed to fetch shield events',
          details: expect.any(String)
        }
      });
    });

    test('should provide security-conscious error messages', async () => {
      const response = await request(app)
        .post('/api/shield/revert/invalid-id')
        .send({ reason: 'test' })
        .expect(400);

      expect(response.body.error).toEqual({
        message: 'Invalid action ID format',
        code: 'INVALID_ACTION_ID',
        details: 'Action ID must be a valid UUID format'
      });
    });
  });

  describe('Null Safety Enhancements (Round 3)', () => {
    test('should handle null/undefined data gracefully in stats endpoint', async () => {
      // Mock data with null values
      const mockStatsData = [
        {
          action_type: 'block',
          platform: 'twitter',
          reason: 'toxic',
          created_at: '2024-01-15T10:00:00Z',
          reverted_at: null
        },
        {
          action_type: null, // Null action_type
          platform: 'youtube',
          reason: null, // Null reason
          created_at: '2024-01-14T10:00:00Z',
          reverted_at: '2024-01-14T11:00:00Z'
        },
        null, // Null record
        {
          action_type: '', // Empty string
          platform: '   ', // Whitespace
          reason: 'harassment',
          created_at: '2024-01-13T10:00:00Z',
          reverted_at: null
        }
      ];

      mockSupabaseServiceClient.select.mockResolvedValue({
        data: mockStatsData,
        error: null
      });

      const response = await request(app)
        .get('/api/shield/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(4); // All records counted
      expect(response.body.data.reverted).toBe(1); // Only one with reverted_at
      expect(response.body.data.active).toBe(3); // Three without reverted_at

      // Check that null/empty values are handled properly
      expect(response.body.data.byActionType).toEqual({
        block: 1 // Only valid action_type counted
      });

      expect(response.body.data.byReason).toEqual({
        toxic: 1,
        harassment: 1
      });
    });

    test('should handle empty data arrays gracefully', async () => {
      mockSupabaseServiceClient.select.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      const response = await request(app)
        .get('/api/shield/events')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          events: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          },
          filters: expect.objectContaining({
            category: 'all',
            timeRange: '30d',
            platform: 'all',
            actionType: 'all'
          })
        }
      });
    });
  });

  describe('Action Already Reverted Check (Round 3)', () => {
    test('should prevent reverting already reverted actions', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';

      // Mock already reverted action
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: {
          id: validUUID,
          action_type: 'block',
          platform: 'twitter',
          reverted_at: '2024-01-15T12:00:00Z' // Already reverted
        },
        error: null
      });

      const response = await request(app)
        .post(`/api/shield/revert/${validUUID}`)
        .send({ reason: 'Test' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Action has already been reverted',
          code: 'ALREADY_REVERTED',
          revertedAt: '2024-01-15T12:00:00Z'
        }
      });
    });
  });

  describe('Database Error Handling (Round 3)', () => {
    test('should handle database errors gracefully with proper logging', async () => {
      const dbError = new Error('Connection failed');
      mockSupabaseServiceClient.select.mockRejectedValue(dbError);

      const response = await request(app)
        .get('/api/shield/events')
        .expect(500);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Shield events endpoint error',
        expect.objectContaining({
          error: 'Connection failed',
          userId: 'test-user-id',
          orgId: 'test-org-id'
        })
      );

      expect(response.body.success).toBe(false);
    });

    test('should handle action not found errors properly', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';

      // Mock "not found" error from Supabase
      const notFoundError = new Error('No rows returned');
      notFoundError.code = 'PGRST116';

      mockSupabaseServiceClient.single.mockRejectedValue(notFoundError);

      const response = await request(app)
        .post(`/api/shield/revert/${validUUID}`)
        .send({ reason: 'Test' })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Shield action not found',
          code: 'ACTION_NOT_FOUND',
          details: 'The specified action does not exist or you do not have permission to access it'
        }
      });
    });
  });

  describe('Configuration Endpoint Security (Round 3)', () => {
    test('should return proper configuration with validation constants', async () => {
      mockFlags.isEnabled.mockReturnValue(true);

      const response = await request(app)
        .get('/api/shield/config')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          enabled: true,
          features: {
            eventFiltering: true,
            revertActions: true,
            statistics: true,
            realTimeUpdates: false
          },
          limits: {
            maxEventsPerPage: 100,
            revertActionsPerWindow: 10,
            revertWindowMinutes: 5
          },
          validation: {
            categories: ['all', 'toxic', 'spam', 'harassment', 'hate_speech', 'inappropriate'],
            timeRanges: ['7d', '30d', '90d', 'all'],
            platforms: ['all', 'twitter', 'youtube', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'],
            actionTypes: ['all', 'block', 'mute', 'flag', 'report']
          },
          categories: ['toxic', 'spam', 'harassment', 'hate_speech', 'inappropriate'],
          platforms: ['twitter', 'youtube', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'],
          actionTypes: ['block', 'mute', 'flag', 'report']
        }
      });
    });

    test('should log configuration requests for security monitoring', async () => {
      await request(app)
        .get('/api/shield/config')
        .expect(200);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Shield config requested',
        expect.objectContaining({
          userId: 'test-user-id',
          orgId: 'test-org-id',
          shieldUIEnabled: true
        })
      );
    });
  });
});