/**
 * Shield API Routes Tests - CodeRabbit Round 2 Enhanced
 * 
 * Tests for src/routes/shield.js with enhancements:
 * - Input validation with whitelisted parameters
 * - Organization_id removal from responses
 * - Null/undefined data handling
 * - Enhanced pagination validation
 * - Comprehensive error handling
 * - Response sanitization functions
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
const mockSupabaseServiceClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis()
};

const mockFlags = {
  isEnabled: jest.fn()
};

const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
};

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = {
    id: 'test-user-123',
    organizationId: 'test-org-456'
  };
  next();
});

// Mock modules
jest.mock('@supabase/supabase-js');
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabaseServiceClient
}));
jest.mock('../../../src/config/flags', () => ({
  flags: mockFlags
}));
jest.mock('../../../src/utils/logger', () => ({
  logger: mockLogger
}));
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken
}));

// Import the shield routes after mocking
const shieldRoutes = require('../../../src/routes/shield');

describe('Shield API Routes - CodeRabbit Round 2 Enhanced', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/shield', shieldRoutes);
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set default mock returns
    mockFlags.isEnabled.mockReturnValue(true);
    
    // Default successful database response
    mockSupabaseServiceClient.from.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.select.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.eq.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.gte.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.order.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.range.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.single.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.insert.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.update.mockReturnValue(mockSupabaseServiceClient);
    mockSupabaseServiceClient.is.mockReturnValue(mockSupabaseServiceClient);
  });

  describe('GET /api/shield/events - Enhanced Input Validation', () => {
    const mockEventsData = [
      {
        id: '1',
        action_type: 'block',
        content_hash: 'abc123',
        content_snippet: 'Test content',
        platform: 'twitter',
        reason: 'toxic',
        created_at: '2024-01-15T10:00:00Z',
        reverted_at: null,
        metadata: {},
        organization_id: 'test-org-456' // Should be removed from response
      }
    ];

    beforeEach(() => {
      mockSupabaseServiceClient.from.mockResolvedValue({
        data: mockEventsData,
        error: null,
        count: 1
      });
    });

    test('should validate and sanitize query parameters with whitelisted values', async () => {
      const response = await request(app)
        .get('/api/shield/events')
        .query({
          page: '1',
          limit: '20',
          category: 'toxic',
          timeRange: '30d',
          platform: 'twitter',
          actionType: 'block'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.filters).toEqual({
        category: 'toxic',
        timeRange: '30d',
        platform: 'twitter',
        actionType: 'block',
        startDate: expect.any(String)
      });
    });

    test('should reject invalid category filters', async () => {
      mockSupabaseServiceClient.from.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      const response = await request(app)
        .get('/api/shield/events')
        .query({
          category: 'invalid_category'
        });

      expect(response.status).toBe(200);
      // Should default to 'all' for invalid category
      expect(response.body.data.filters.category).toBe('all');
    });

    test('should handle non-numeric pagination parameters', async () => {
      const response = await request(app)
        .get('/api/shield/events')
        .query({
          page: 'abc',
          limit: 'xyz'
        });

      expect(response.status).toBe(200);
      // Should default to valid numbers
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(20);
    });

    test('should enforce maximum limit of 100 items per page', async () => {
      const response = await request(app)
        .get('/api/shield/events')
        .query({
          limit: '500' // Exceeds max
        });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.limit).toBe(100); // Capped at max
    });

    test('should remove organization_id from response data (CodeRabbit feedback)', async () => {
      const response = await request(app)
        .get('/api/shield/events');

      expect(response.status).toBe(200);
      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.events[0]).not.toHaveProperty('organization_id');
      expect(response.body.data.events[0]).toHaveProperty('id');
      expect(response.body.data.events[0]).toHaveProperty('action_type');
    });

    test('should handle null/undefined data gracefully (CodeRabbit feedback)', async () => {
      mockSupabaseServiceClient.from.mockResolvedValue({
        data: null,
        error: null,
        count: 0
      });

      const response = await request(app)
        .get('/api/shield/events');

      expect(response.status).toBe(200);
      expect(response.body.data.events).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });

    test('should handle database errors with proper logging', async () => {
      const dbError = new Error('Database connection failed');
      mockSupabaseServiceClient.from.mockResolvedValue({
        data: null,
        error: dbError,
        count: null
      });

      const response = await request(app)
        .get('/api/shield/events');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to fetch shield events');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should apply date range filters correctly', async () => {
      await request(app)
        .get('/api/shield/events')
        .query({ timeRange: '7d' });

      expect(mockSupabaseServiceClient.gte).toHaveBeenCalledWith(
        'created_at',
        expect.any(String)
      );
    });

    test('should not apply date filter for "all" time range', async () => {
      await request(app)
        .get('/api/shield/events')
        .query({ timeRange: 'all' });

      expect(mockSupabaseServiceClient.gte).not.toHaveBeenCalled();
    });

    test('should apply organization isolation filter', async () => {
      await request(app)
        .get('/api/shield/events');

      expect(mockSupabaseServiceClient.eq).toHaveBeenCalledWith(
        'organization_id',
        'test-org-456'
      );
    });

    test('should handle array responses in sanitization', async () => {
      const arrayData = [
        { id: '1', organization_id: 'org-1', content: 'test1' },
        { id: '2', organization_id: 'org-2', content: 'test2' }
      ];

      mockSupabaseServiceClient.from.mockResolvedValue({
        data: arrayData,
        error: null,
        count: 2
      });

      const response = await request(app)
        .get('/api/shield/events');

      expect(response.status).toBe(200);
      response.body.data.events.forEach(event => {
        expect(event).not.toHaveProperty('organization_id');
      });
    });
  });

  describe('POST /api/shield/revert/:id - Enhanced Validation', () => {
    const mockExistingAction = {
      id: 'action-123',
      action_type: 'block',
      content_hash: 'abc123',
      content_snippet: 'Test content',
      platform: 'twitter',
      reverted_at: null,
      metadata: {}
    };

    beforeEach(() => {
      // Mock successful fetch of existing action
      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: mockExistingAction,
        error: null
      });

      // Mock successful update
      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: { ...mockExistingAction, reverted_at: '2024-01-15T12:00:00Z' },
        error: null
      });
    });

    test('should validate action ID parameter', async () => {
      // Test empty ID
      const response1 = await request(app)
        .post('/api/shield/revert/ ')
        .send({ reason: 'Test revert' });

      expect(response1.status).toBe(400);
      expect(response1.body.error.code).toBe('INVALID_ACTION_ID');
    });

    test('should validate revert reason if provided', async () => {
      const response = await request(app)
        .post('/api/shield/revert/action-123')
        .send({ reason: '' }); // Empty reason

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_REASON');
    });

    test('should handle action not found gracefully', async () => {
      const notFoundError = { code: 'PGRST116', message: 'No rows found' };
      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: null,
        error: notFoundError
      });

      const response = await request(app)
        .post('/api/shield/revert/nonexistent-action')
        .send({ reason: 'Test revert' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('ACTION_NOT_FOUND');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should prevent reverting already reverted actions', async () => {
      const revertedAction = {
        ...mockExistingAction,
        reverted_at: '2024-01-14T16:00:00Z'
      };

      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: revertedAction,
        error: null
      });

      const response = await request(app)
        .post('/api/shield/revert/action-123')
        .send({ reason: 'Test revert' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('ALREADY_REVERTED');
      expect(response.body.error.revertedAt).toBe('2024-01-14T16:00:00Z');
    });

    test('should handle null reverted_at safely (CodeRabbit feedback)', async () => {
      const actionWithNullRevert = {
        ...mockExistingAction,
        reverted_at: null
      };

      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: actionWithNullRevert,
        error: null
      });

      const response = await request(app)
        .post('/api/shield/revert/action-123')
        .send({ reason: 'Test revert' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should sanitize response data removing organization_id', async () => {
      const updatedActionWithOrgId = {
        ...mockExistingAction,
        organization_id: 'test-org-456',
        reverted_at: '2024-01-15T12:00:00Z'
      };

      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: updatedActionWithOrgId,
        error: null
      });

      const response = await request(app)
        .post('/api/shield/revert/action-123')
        .send({ reason: 'Test revert' });

      expect(response.status).toBe(200);
      expect(response.body.data.action).not.toHaveProperty('organization_id');
      expect(response.body.data.action).toHaveProperty('reverted_at');
    });

    test('should create proper revert metadata', async () => {
      await request(app)
        .post('/api/shield/revert/action-123')
        .send({ reason: 'False positive detection' });

      const updateCall = mockSupabaseServiceClient.update.mock.calls[0][0];
      expect(updateCall.metadata).toEqual({
        reverted: true,
        revertedBy: 'test-user-123',
        revertReason: 'False positive detection',
        revertedAt: expect.any(String)
      });
    });

    test('should handle update database errors', async () => {
      const updateError = new Error('Update failed');
      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: null,
        error: updateError
      });

      const response = await request(app)
        .post('/api/shield/revert/action-123')
        .send({ reason: 'Test revert' });

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('Failed to revert shield action');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should use default reason when none provided', async () => {
      await request(app)
        .post('/api/shield/revert/action-123')
        .send({});

      const updateCall = mockSupabaseServiceClient.update.mock.calls[0][0];
      expect(updateCall.metadata.revertReason).toBe('Manual revert via UI');
    });
  });

  describe('GET /api/shield/stats - Enhanced Null Safety', () => {
    const mockStatsData = [
      {
        action_type: 'block',
        platform: 'twitter',
        reason: 'toxic',
        created_at: '2024-01-15T10:00:00Z',
        reverted_at: null
      },
      {
        action_type: 'mute',
        platform: 'youtube',
        reason: 'harassment',
        created_at: '2024-01-14T15:30:00Z',
        reverted_at: '2024-01-14T16:00:00Z'
      }
    ];

    beforeEach(() => {
      mockSupabaseServiceClient.from.mockResolvedValue({
        data: mockStatsData,
        error: null
      });
    });

    test('should calculate statistics correctly', async () => {
      const response = await request(app)
        .get('/api/shield/stats');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        total: 2,
        reverted: 1,
        active: 1,
        byActionType: { block: 1, mute: 1 },
        byPlatform: { twitter: 1, youtube: 1 },
        byReason: { toxic: 1, harassment: 1 },
        timeRange: '30d',
        startDate: expect.any(String),
        generatedAt: expect.any(String)
      });
    });

    test('should handle null data safely (CodeRabbit feedback)', async () => {
      mockSupabaseServiceClient.from.mockResolvedValue({
        data: null,
        error: null
      });

      const response = await request(app)
        .get('/api/shield/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBe(0);
      expect(response.body.data.reverted).toBe(0);
      expect(response.body.data.active).toBe(0);
    });

    test('should handle array with null items safely', async () => {
      const dataWithNulls = [
        null,
        { action_type: 'block', platform: 'twitter', reason: 'toxic', reverted_at: null },
        undefined,
        { action_type: null, platform: 'youtube', reason: '', reverted_at: null }
      ];

      mockSupabaseServiceClient.from.mockResolvedValue({
        data: dataWithNulls,
        error: null
      });

      const response = await request(app)
        .get('/api/shield/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBe(4);
      expect(response.body.data.byActionType).toEqual({ block: 1 });
      expect(response.body.data.byPlatform).toEqual({ twitter: 1, youtube: 1 });
      expect(response.body.data.byReason).toEqual({ toxic: 1 });
    });

    test('should validate time range parameter', async () => {
      const response = await request(app)
        .get('/api/shield/stats')
        .query({ timeRange: 'invalid_range' });

      expect(response.status).toBe(200);
      expect(response.body.data.timeRange).toBe('30d'); // Should default
    });

    test('should handle whitespace in data fields', async () => {
      const dataWithWhitespace = [
        {
          action_type: '  block  ',
          platform: ' twitter ',
          reason: '  toxic  ',
          reverted_at: null
        }
      ];

      mockSupabaseServiceClient.from.mockResolvedValue({
        data: dataWithWhitespace,
        error: null
      });

      const response = await request(app)
        .get('/api/shield/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.byActionType).toEqual({ block: 1 });
      expect(response.body.data.byPlatform).toEqual({ twitter: 1 });
      expect(response.body.data.byReason).toEqual({ toxic: 1 });
    });

    test('should filter empty strings from statistics', async () => {
      const dataWithEmptyStrings = [
        {
          action_type: '',
          platform: 'twitter',
          reason: '',
          reverted_at: null
        }
      ];

      mockSupabaseServiceClient.from.mockResolvedValue({
        data: dataWithEmptyStrings,
        error: null
      });

      const response = await request(app)
        .get('/api/shield/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.byActionType).toEqual({});
      expect(response.body.data.byPlatform).toEqual({ twitter: 1 });
      expect(response.body.data.byReason).toEqual({});
    });
  });

  describe('GET /api/shield/config - Enhanced Configuration', () => {
    test('should return shield configuration with validation constants', async () => {
      const response = await request(app)
        .get('/api/shield/config');

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
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
          categories: expect.arrayContaining(['all', 'toxic', 'spam']),
          timeRanges: expect.arrayContaining(['7d', '30d', '90d', 'all']),
          platforms: expect.arrayContaining(['all', 'twitter', 'youtube']),
          actionTypes: expect.arrayContaining(['all', 'block', 'mute'])
        }
      });
    });

    test('should exclude "all" from category/platform lists', async () => {
      const response = await request(app)
        .get('/api/shield/config');

      expect(response.body.data.categories).not.toContain('all');
      expect(response.body.data.platforms).not.toContain('all');
      expect(response.body.data.actionTypes).not.toContain('all');
    });

    test('should respect feature flag for shield UI', async () => {
      mockFlags.isEnabled.mockReturnValue(false);

      const response = await request(app)
        .get('/api/shield/config');

      expect(response.status).toBe(200);
      expect(response.body.data.enabled).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/shield/revert/action-123')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    test('should handle very large pagination values', async () => {
      const response = await request(app)
        .get('/api/shield/events')
        .query({
          page: '999999999',
          limit: '999999999'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.limit).toBe(100); // Capped
      expect(response.body.data.pagination.page).toBe(999999999); // Allowed but impractical
    });

    test('should handle negative pagination values', async () => {
      const response = await request(app)
        .get('/api/shield/events')
        .query({
          page: '-1',
          limit: '-10'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.page).toBe(1); // Minimum 1
      expect(response.body.data.pagination.limit).toBe(1); // Minimum 1
    });

    test('should handle database timeout errors', async () => {
      const timeoutError = new Error('Connection timeout');
      timeoutError.code = 'TIMEOUT';

      mockSupabaseServiceClient.from.mockRejectedValue(timeoutError);

      const response = await request(app)
        .get('/api/shield/events');

      expect(response.status).toBe(500);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Shield events endpoint error',
        expect.objectContaining({
          error: 'Connection timeout'
        })
      );
    });
  });

  describe('Authentication and Authorization', () => {
    test('should require authentication for all endpoints', async () => {
      // Create app without auth middleware
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.use('/api/shield', shieldRoutes);

      const response = await request(unauthApp)
        .get('/api/shield/events');

      // This would fail without proper auth setup
      // The actual behavior depends on the auth middleware implementation
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should use organization ID from authenticated user', async () => {
      await request(app)
        .get('/api/shield/events');

      expect(mockSupabaseServiceClient.eq).toHaveBeenCalledWith(
        'organization_id',
        'test-org-456'
      );
    });
  });
});