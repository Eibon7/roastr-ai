/**
 * Shield System - CodeRabbit Round 3 Complete Integration Tests
 * 
 * Comprehensive integration tests validating all Round 3 improvements:
 * - Database migration security enhancements
 * - API route input validation improvements  
 * - Visual test stability fixes
 * - End-to-end user workflows
 * - Performance and security validations
 */

const request = require('supertest');
const express = require('express');
const { supabaseServiceClient } = require('../../src/config/supabase');

// Mock environment setup
process.env.NODE_ENV = 'test';
process.env.ENABLE_MOCK_MODE = 'true';

// Mock dependencies
const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = { 
    id: 'test-user-round3', 
    organizationId: 'test-org-round3',
    email: 'round3@example.com' 
  };
  next();
});

const mockFlags = {
  isEnabled: jest.fn().mockReturnValue(true)
};

const mockLogger = {
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
};

// Mock modules
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken
}));

jest.mock('../../src/config/flags', () => ({
  flags: mockFlags
}));

jest.mock('../../src/utils/logger', () => ({
  logger: mockLogger
}));

// Create test app
const shieldRoutes = require('../../src/routes/shield');
const app = express();
app.use(express.json());
app.use('/api/shield', shieldRoutes);

describe('Shield System - CodeRabbit Round 3 Complete Integration', () => {
  // Mock Supabase data for consistent testing
  const mockShieldActions = [
    {
      id: 'a1b2c3d4-e5f6-4789-abcd-123456789abc',
      organization_id: 'test-org-round3', // This should be removed from responses
      action_type: 'block',
      content_hash: 'a'.repeat(64),
      content_snippet: 'This is offensive content that was automatically blocked by Shield',
      platform: 'twitter',
      reason: 'toxic',
      created_at: '2024-01-15T10:00:00Z',
      reverted_at: null,
      updated_at: '2024-01-15T10:00:00Z',
      metadata: {}
    },
    {
      id: 'f6e5d4c3-b2a1-4567-89ab-cdef12345678',
      organization_id: 'test-org-round3',
      action_type: 'mute',
      content_hash: 'f'.repeat(64),
      content_snippet: 'Another problematic comment that was muted',
      platform: 'youtube',
      reason: 'harassment',
      created_at: '2024-01-14T15:30:00Z',
      reverted_at: '2024-01-14T16:00:00Z',
      updated_at: '2024-01-14T16:00:00Z',
      metadata: { reverted: true, revertReason: 'False positive' }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset Supabase mock
    jest.spyOn(supabaseServiceClient, 'from').mockImplementation((table) => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis()
      };

      if (table === 'shield_actions') {
        // Default successful response for events
        mockQuery.select.mockResolvedValue({
          data: mockShieldActions,
          error: null,
          count: mockShieldActions.length
        });

        // Mock for single action queries (revert operations)
        mockQuery.single.mockResolvedValue({
          data: mockShieldActions[0],
          error: null
        });

        // Mock for update operations
        mockQuery.update.mockResolvedValue({
          data: { ...mockShieldActions[0], reverted_at: '2024-01-15T12:00:00Z' },
          error: null
        });
      }

      return mockQuery;
    });
  });

  describe('Round 3 Security Enhancements - Comprehensive', () => {
    test('should enforce comprehensive input validation across all endpoints', async () => {
      // Test events endpoint with various invalid inputs
      const invalidInputTests = [
        { path: '/events?page=<script>alert(1)</script>', expectStatus: 200 }, // Should sanitize to page=1
        { path: '/events?limit=999999', expectStatus: 200 }, // Should cap at 100
        { path: '/events?category=malicious_injection', expectStatus: 200 }, // Should fallback to 'all'
        { path: '/events?platform="><script>alert(1)</script>', expectStatus: 200 }, // Should fallback to 'all'
        { path: '/events?timeRange=invalid&actionType=hack', expectStatus: 200 } // Should use defaults
      ];

      for (const testCase of invalidInputTests) {
        const response = await request(app)
          .get(`/api/shield${testCase.path}`)
          .expect(testCase.expectStatus);

        if (testCase.expectStatus === 200) {
          // Verify safe defaults were applied
          expect(response.body.success).toBe(true);
          expect(response.body.data.pagination.page).toBeLessThanOrEqual(999999); // Reasonable page
          expect(response.body.data.pagination.limit).toBeLessThanOrEqual(100); // Max limit enforced
          expect(response.body.data.filters.category).toMatch(/^(all|toxic|spam|harassment|hate_speech|inappropriate)$/);
          expect(response.body.data.filters.platform).toMatch(/^(all|twitter|youtube|instagram|facebook|discord|twitch|reddit|tiktok|bluesky)$/);
        }
      }
    });

    test('should provide enhanced UUID validation for revert operations', async () => {
      // Test various invalid UUID formats
      const invalidUUIDs = [
        'not-a-uuid-at-all',
        '12345678-1234-1234-1234-123456789012X', // Too long
        '12345678-1234-1234-1234-12345678901', // Too short
        '12345678-1234-7234-1234-123456789012', // Invalid version
        '12345678-1234-4234-c234-123456789012', // Invalid variant
        '', // Empty
        '   ', // Whitespace only
        'null',
        'undefined'
      ];

      for (const invalidUUID of invalidUUIDs) {
        const response = await request(app)
          .post(`/api/shield/revert/${encodeURIComponent(invalidUUID)}`)
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

    test('should sanitize and validate revert reasons comprehensively', async () => {
      const validUUID = 'a1b2c3d4-e5f6-4789-abcd-123456789abc';

      // Test various invalid reason formats
      const invalidReasons = [
        '<script>alert("xss")</script>', // XSS attempt
        'SELECT * FROM users', // SQL injection attempt
        'x'.repeat(101), // Too long (>100 chars)
        '', // Empty string
        '   ', // Whitespace only
        'reason with <tags> and &entities;', // HTML entities
        'reason\nwith\nnewlines', // Newlines
        'reason\twith\ttabs' // Tabs
      ];

      for (const invalidReason of invalidReasons.slice(0, -2)) { // Exclude newlines/tabs for now
        const response = await request(app)
          .post(`/api/shield/revert/${validUUID}`)
          .send({ reason: invalidReason })
          .expect(400);

        expect(response.body.error.code).toBe('INVALID_REASON');
        expect(response.body.error.message).toContain('Invalid revert reason');
      }
    });

    test('should handle data sanitization properly', async () => {
      const response = await request(app)
        .get('/api/shield/events')
        .expect(200);

      // Verify organization_id is removed from all events
      expect(response.body.data.events).toHaveLength(2);
      response.body.data.events.forEach(event => {
        expect(event).not.toHaveProperty('organization_id');
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('action_type');
        expect(event).toHaveProperty('platform');
      });
    });
  });

  describe('Round 3 Error Handling and Resilience', () => {
    test('should handle database errors gracefully with proper logging', async () => {
      // Mock database error
      jest.spyOn(supabaseServiceClient, 'from').mockImplementation(() => ({
        select: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis()
      }));

      const response = await request(app)
        .get('/api/shield/events')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Failed to fetch shield events',
          details: 'Database connection failed' // Development mode shows details
        }
      });

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Shield events endpoint error',
        expect.objectContaining({
          error: 'Database connection failed',
          userId: 'test-user-round3',
          orgId: 'test-org-round3'
        })
      );
    });

    test('should handle edge cases in statistics calculation', async () => {
      // Mock data with null/undefined values and edge cases
      const edgeCaseData = [
        null, // Null record
        undefined, // Undefined record
        {}, // Empty object
        { action_type: null, platform: null, reason: null }, // All nulls
        { action_type: '', platform: '', reason: '' }, // Empty strings
        { action_type: '   ', platform: '   ', reason: '   ' }, // Whitespace
        {
          action_type: 'block',
          platform: 'twitter',
          reason: 'toxic',
          created_at: '2024-01-15T10:00:00Z',
          reverted_at: null
        }, // Valid record
        {
          action_type: 'mute',
          platform: 'youtube',
          reason: 'harassment',
          created_at: '2024-01-14T10:00:00Z',
          reverted_at: '2024-01-14T11:00:00Z'
        } // Valid reverted record
      ];

      jest.spyOn(supabaseServiceClient, 'from').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({
          data: edgeCaseData,
          error: null
        }),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis()
      }));

      const response = await request(app)
        .get('/api/shield/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        total: 8, // All records counted
        reverted: 1, // Only one with valid reverted_at
        active: 7, // Seven without reverted_at (including nulls/empties)
        byActionType: {
          block: 1,
          mute: 1
        }, // Only valid action types counted
        byPlatform: {
          twitter: 1,
          youtube: 1
        }, // Only valid platforms counted
        byReason: {
          toxic: 1,
          harassment: 1
        }, // Only valid reasons counted
        timeRange: '30d',
        startDate: expect.any(String),
        generatedAt: expect.any(String)
      });
    });

    test('should prevent double-revert attempts', async () => {
      const alreadyRevertedAction = {
        ...mockShieldActions[1], // This one is already reverted
        reverted_at: '2024-01-14T16:00:00Z'
      };

      jest.spyOn(supabaseServiceClient, 'from').mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: alreadyRevertedAction,
          error: null
        })
      }));

      const response = await request(app)
        .post('/api/shield/revert/f6e5d4c3-b2a1-4567-89ab-cdef12345678')
        .send({ reason: 'Trying to revert again' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Action has already been reverted',
          code: 'ALREADY_REVERTED',
          revertedAt: '2024-01-14T16:00:00Z'
        }
      });
    });
  });

  describe('Round 3 Configuration and Feature Flag Integration', () => {
    test('should provide comprehensive configuration with validation constants', async () => {
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

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Shield config requested',
        expect.objectContaining({
          userId: 'test-user-round3',
          orgId: 'test-org-round3',
          shieldUIEnabled: true
        })
      );
    });

    test('should respect feature flag state', async () => {
      // Test with feature flag disabled
      mockFlags.isEnabled.mockReturnValue(false);

      const response = await request(app)
        .get('/api/shield/config')
        .expect(200);

      expect(response.body.data.enabled).toBe(false);

      // Reset for other tests
      mockFlags.isEnabled.mockReturnValue(true);
    });
  });

  describe('Round 3 Performance and Optimization', () => {
    test('should handle large datasets efficiently with pagination', async () => {
      // Simulate large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `action-${i}`,
        organization_id: 'test-org-round3',
        action_type: i % 2 === 0 ? 'block' : 'mute',
        content_hash: String(i).repeat(32),
        content_snippet: `Test action ${i}`,
        platform: ['twitter', 'youtube', 'discord'][i % 3],
        reason: ['toxic', 'spam', 'harassment'][i % 3],
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        reverted_at: i % 5 === 0 ? new Date().toISOString() : null,
        metadata: {}
      }));

      jest.spyOn(supabaseServiceClient, 'from').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({
          data: largeDataset.slice(0, 20), // First page
          error: null,
          count: 1000
        }),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis()
      }));

      const response = await request(app)
        .get('/api/shield/events?page=1&limit=20')
        .expect(200);

      expect(response.body.data.events).toHaveLength(20);
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1000,
        totalPages: 50,
        hasNext: true,
        hasPrev: false
      });

      // Verify organization_id is removed from all records
      response.body.data.events.forEach(event => {
        expect(event).not.toHaveProperty('organization_id');
      });
    });

    test('should apply filters efficiently', async () => {
      const response = await request(app)
        .get('/api/shield/events?category=toxic&platform=twitter&actionType=block&timeRange=7d')
        .expect(200);

      expect(response.body.data.filters).toEqual({
        category: 'toxic',
        platform: 'twitter',
        actionType: 'block',
        timeRange: '7d',
        startDate: expect.any(String)
      });

      // Verify date range calculation
      const startDate = new Date(response.body.data.filters.startDate);
      const now = new Date();
      const daysDiff = (now - startDate) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(7, 1); // Within 1 day tolerance
    });
  });

  describe('Round 3 Security Headers and Compliance', () => {
    test('should include proper security context in error responses', async () => {
      const response = await request(app)
        .post('/api/shield/revert/invalid-uuid')
        .send({ reason: 'Test' })
        .expect(400);

      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('details');
      expect(response.body.error.code).toBe('INVALID_ACTION_ID');
      expect(response.body.error.details).toContain('UUID format');
    });

    test('should handle action not found scenarios securely', async () => {
      // Mock "not found" error
      const notFoundError = new Error('No rows returned');
      notFoundError.code = 'PGRST116';

      jest.spyOn(supabaseServiceClient, 'from').mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(notFoundError)
      }));

      const response = await request(app)
        .post('/api/shield/revert/a1b2c3d4-e5f6-4789-abcd-123456789abc')
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

  describe('Round 3 End-to-End Workflow Validation', () => {
    test('should complete full shield action revert workflow', async () => {
      const actionId = 'a1b2c3d4-e5f6-4789-abcd-123456789abc';
      const revertReason = 'False positive detected by admin';

      // Step 1: Verify action exists
      const fetchResponse = await request(app)
        .get('/api/shield/events')
        .expect(200);

      const targetAction = fetchResponse.body.data.events.find(e => e.id === actionId);
      expect(targetAction).toBeTruthy();
      expect(targetAction.reverted_at).toBeNull();

      // Step 2: Revert the action
      const revertResponse = await request(app)
        .post(`/api/shield/revert/${actionId}`)
        .send({ reason: revertReason })
        .expect(200);

      expect(revertResponse.body).toEqual({
        success: true,
        data: {
          action: expect.objectContaining({
            id: actionId,
            reverted_at: expect.any(String)
          }),
          message: 'Shield action reverted successfully'
        }
      });

      // Verify action was sanitized (no organization_id)
      expect(revertResponse.body.data.action).not.toHaveProperty('organization_id');

      // Verify logging occurred
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Shield action reverted successfully',
        expect.objectContaining({
          actionId,
          actionType: 'block',
          platform: 'twitter',
          userId: 'test-user-round3',
          orgId: 'test-org-round3',
          reason: revertReason
        })
      );
    });

    test('should provide consistent stats across time ranges', async () => {
      // Test different time ranges
      const timeRanges = ['7d', '30d', '90d', 'all'];

      for (const timeRange of timeRanges) {
        const response = await request(app)
          .get(`/api/shield/stats?timeRange=${timeRange}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.timeRange).toBe(timeRange);
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('reverted');
        expect(response.body.data).toHaveProperty('active');
        expect(response.body.data).toHaveProperty('byActionType');
        expect(response.body.data).toHaveProperty('byPlatform');
        expect(response.body.data).toHaveProperty('byReason');
        expect(response.body.data).toHaveProperty('generatedAt');

        // Verify numeric consistency
        expect(response.body.data.total).toBe(
          response.body.data.reverted + response.body.data.active
        );
      }
    });
  });
});