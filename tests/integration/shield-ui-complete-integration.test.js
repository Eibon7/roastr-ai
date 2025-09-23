/**
 * Shield UI Complete Integration Tests
 * Issue #365 - Complete Shield UI implementation
 * 
 * Tests the complete Shield UI system including:
 * - Feature flag integration
 * - API endpoint integration  
 * - Frontend component integration
 * - Revert functionality
 * - 30-day filtering
 * - Real-time data updates
 */

const request = require('supertest');
const express = require('express');
const { supabaseServiceClient } = require('../../src/config/supabase');

// Create Express app with Shield routes
const app = express();
app.use(express.json());

// Mock authentication middleware
const mockAuth = (req, res, next) => {
  req.user = {
    id: 'test-user-123',
    organizationId: 'test-org-456'
  };
  next();
};

app.use('/api/shield', mockAuth);
app.use('/api/shield', require('../../src/routes/shield'));

// Mock Supabase responses
const mockShieldActions = [
  {
    id: '1',
    organization_id: 'test-org-456',
    action_type: 'block',
    content_hash: 'abc123hash456',
    content_snippet: 'Este es contenido tóxico interceptado...',
    platform: 'twitter',
    reason: 'toxic',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    reverted_at: null,
    metadata: {}
  },
  {
    id: '2', 
    organization_id: 'test-org-456',
    action_type: 'mute',
    content_hash: 'def789hash012',
    content_snippet: 'Spam comercial detectado automáticamente...',
    platform: 'youtube',
    reason: 'spam',
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-01-11T09:00:00Z',
    reverted_at: '2024-01-11T09:00:00Z',
    metadata: {
      reverted: true,
      revertedBy: 'test-user-123',
      revertReason: 'False positive',
      revertedAt: '2024-01-11T09:00:00Z'
    }
  },
  {
    id: '3',
    organization_id: 'test-org-456', 
    action_type: 'report',
    content_hash: 'ghi345hash678',
    content_snippet: 'Comentario de acoso dirigido...',
    platform: 'instagram',
    reason: 'harassment',
    created_at: '2024-01-05T15:30:00Z',
    updated_at: '2024-01-05T15:30:00Z',
    reverted_at: null,
    metadata: {}
  }
];

describe('Shield UI Complete Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock Supabase service client
    jest.spyOn(supabaseServiceClient, 'from').mockImplementation((table) => {
      if (table === 'shield_actions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          mockResolve: (data, error = null, count = null) => {
            return Promise.resolve({ data, error, count });
          }
        };
      }
      return {};
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Feature Flag Integration', () => {
    it('should respect ENABLE_SHIELD_UI feature flag in config endpoint', async () => {
      // Mock flag as enabled
      process.env.ENABLE_SHIELD_UI = 'true';
      
      const response = await request(app)
        .get('/api/shield/config')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(true);
      expect(response.body.data.features.revertActions).toBe(true);
      expect(response.body.data.features.eventFiltering).toBe(true);
    });

    it('should disable Shield UI when feature flag is false', async () => {
      // Mock flag as disabled
      process.env.ENABLE_SHIELD_UI = 'false';
      
      const response = await request(app)
        .get('/api/shield/config')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(false);
    });
  });

  describe('Shield Events API Integration', () => {
    it('should fetch shield events with proper filtering and pagination', async () => {
      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.range = jest.fn().mockResolvedValue({
        data: mockShieldActions,
        error: null,
        count: 3
      });

      const response = await request(app)
        .get('/api/shield/events')
        .query({
          page: 1,
          limit: 20,
          category: 'all',
          timeRange: '30d',
          platform: 'all'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(3);
      expect(response.body.data.pagination.total).toBe(3);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.filters.timeRange).toBe('30d');

      // Verify the database query was called correctly
      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith('organization_id', 'test-org-456');
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQuery.range).toHaveBeenCalledWith(0, 19); // First page
    });

    it('should filter events by category', async () => {
      const toxicEvents = mockShieldActions.filter(item => item.reason === 'toxic');
      
      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.eq = jest.fn().mockReturnThis();
      mockQuery.range = jest.fn().mockResolvedValue({
        data: toxicEvents,
        error: null,
        count: 1
      });

      const response = await request(app)
        .get('/api/shield/events')
        .query({ category: 'toxic' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.events[0].reason).toBe('toxic');

      // Verify category filter was applied
      expect(mockQuery.eq).toHaveBeenCalledWith('reason', 'toxic');
    });

    it('should filter events by platform', async () => {
      const twitterEvents = mockShieldActions.filter(item => item.platform === 'twitter');
      
      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.eq = jest.fn().mockReturnThis();
      mockQuery.range = jest.fn().mockResolvedValue({
        data: twitterEvents,
        error: null,
        count: 1
      });

      const response = await request(app)
        .get('/api/shield/events')
        .query({ platform: 'twitter' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.events[0].platform).toBe('twitter');

      // Verify platform filter was applied
      expect(mockQuery.eq).toHaveBeenCalledWith('platform', 'twitter');
    });

    it('should filter events by time range (30 days)', async () => {
      const recentEvents = mockShieldActions.filter(item => 
        new Date(item.created_at) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
      
      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.gte = jest.fn().mockReturnThis();
      mockQuery.range = jest.fn().mockResolvedValue({
        data: recentEvents,
        error: null,
        count: recentEvents.length
      });

      const response = await request(app)
        .get('/api/shield/events')
        .query({ timeRange: '30d' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.timeRange).toBe('30d');
      expect(response.body.data.filters.startDate).toBeDefined();

      // Verify time range filter was applied
      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', expect.any(String));
    });

    it('should sanitize response data to remove sensitive information', async () => {
      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.range = jest.fn().mockResolvedValue({
        data: mockShieldActions,
        error: null,
        count: 3
      });

      const response = await request(app)
        .get('/api/shield/events')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Check that organization_id is not in the response
      response.body.data.events.forEach(event => {
        expect(event.organization_id).toBeUndefined();
        expect(event.content_snippet).toBeDefined(); // Safe to include
        expect(event.id).toBeDefined(); // Safe to include
        expect(event.platform).toBeDefined(); // Safe to include
      });
    });

    it('should handle pagination correctly', async () => {
      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.range = jest.fn().mockResolvedValue({
        data: mockShieldActions.slice(0, 2), // Simulate page 1 with 2 items
        error: null,
        count: 50 // Total count indicates more pages
      });

      const response = await request(app)
        .get('/api/shield/events')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.total).toBe(50);
      expect(response.body.data.pagination.totalPages).toBe(25);
      expect(response.body.data.pagination.hasNext).toBe(true);
      expect(response.body.data.pagination.hasPrev).toBe(false);

      // Verify correct range was requested
      expect(mockQuery.range).toHaveBeenCalledWith(0, 1); // Page 1 with limit 2
    });
  });

  describe('Shield Action Revert Integration', () => {
    it('should successfully revert a shield action', async () => {
      const actionId = '1';
      const mockQuery = supabaseServiceClient.from('shield_actions');
      
      // Mock finding the action
      mockQuery.single = jest.fn().mockResolvedValue({
        data: mockShieldActions[0],
        error: null
      });

      // Mock updating the action
      mockQuery.update = jest.fn().mockResolvedValue({
        data: {
          ...mockShieldActions[0],
          reverted_at: '2024-01-15T11:00:00Z',
          metadata: {
            reverted: true,
            revertedBy: 'test-user-123',
            revertReason: 'Manual revert via UI',
            revertedAt: '2024-01-15T11:00:00Z'
          }
        },
        error: null
      });

      const response = await request(app)
        .post(`/api/shield/revert/${actionId}`)
        .send({ reason: 'Manual revert via UI' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Shield action reverted successfully');
      expect(response.body.data.action.reverted_at).toBeDefined();

      // Verify database operations
      expect(mockQuery.single).toHaveBeenCalled();
      expect(mockQuery.update).toHaveBeenCalledWith({
        reverted_at: expect.any(String),
        metadata: expect.objectContaining({
          reverted: true,
          revertedBy: 'test-user-123',
          revertReason: 'Manual revert via UI'
        })
      });
    });

    it('should prevent reverting already reverted actions', async () => {
      const actionId = '2'; // This action is already reverted
      const mockQuery = supabaseServiceClient.from('shield_actions');
      
      mockQuery.single = jest.fn().mockResolvedValue({
        data: mockShieldActions[1], // Already has reverted_at
        error: null
      });

      const response = await request(app)
        .post(`/api/shield/revert/${actionId}`)
        .send({ reason: 'Attempting to revert again' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ALREADY_REVERTED');
      expect(response.body.error.revertedAt).toBeDefined();
    });

    it('should handle non-existent action IDs', async () => {
      const actionId = 'non-existent-id';
      const mockQuery = supabaseServiceClient.from('shield_actions');
      
      mockQuery.single = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // Supabase "not found" error
      });

      const response = await request(app)
        .post(`/api/shield/revert/${actionId}`)
        .send({ reason: 'Test' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACTION_NOT_FOUND');
    });

    it('should validate UUID format for action IDs', async () => {
      const invalidId = 'invalid-uuid-format';

      const response = await request(app)
        .post(`/api/shield/revert/${invalidId}`)
        .send({ reason: 'Test' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_UUID_FORMAT');
    });

    it('should apply rate limiting to revert actions', async () => {
      const actionId = '1';
      const mockQuery = supabaseServiceClient.from('shield_actions');
      
      mockQuery.single = jest.fn().mockResolvedValue({
        data: mockShieldActions[0],
        error: null
      });
      
      mockQuery.update = jest.fn().mockResolvedValue({
        data: { ...mockShieldActions[0] },
        error: null
      });

      // Make multiple rapid requests (simulating rate limit)
      const requests = Array(12).fill().map(() => 
        request(app)
          .post(`/api/shield/revert/${actionId}`)
          .send({ reason: 'Rate limit test' })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Shield Statistics Integration', () => {
    it('should calculate and return shield statistics', async () => {
      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.eq = jest.fn().mockReturnThis();
      mockQuery.gte = jest.fn().mockResolvedValue({
        data: mockShieldActions,
        error: null
      });

      const response = await request(app)
        .get('/api/shield/stats')
        .query({ timeRange: '30d' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        total: 3,
        reverted: 1,
        active: 2,
        timeRange: '30d',
        byActionType: expect.any(Object),
        byPlatform: expect.any(Object),
        byReason: expect.any(Object)
      });

      expect(response.body.data.byActionType).toEqual({
        block: 1,
        mute: 1,
        report: 1
      });

      expect(response.body.data.byPlatform).toEqual({
        twitter: 1,
        youtube: 1,
        instagram: 1
      });

      expect(response.body.data.byReason).toEqual({
        toxic: 1,
        spam: 1,
        harassment: 1
      });
    });

    it('should handle different time ranges in statistics', async () => {
      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.eq = jest.fn().mockReturnThis();
      
      // Test 7-day range
      mockQuery.gte = jest.fn().mockResolvedValue({
        data: [mockShieldActions[0]], // Only recent item
        error: null
      });

      const response = await request(app)
        .get('/api/shield/stats')
        .query({ timeRange: '7d' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.timeRange).toBe('7d');
      expect(response.body.data.startDate).toBeDefined();
      
      // Verify 7-day filter was applied
      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', expect.any(String));
    });

    it('should handle "all time" statistics', async () => {
      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.eq = jest.fn().mockReturnThis();
      mockQuery.gte = jest.fn(); // Should not be called for "all" time range
      
      // Mock query without time filter
      const queryWithoutGte = {
        ...mockQuery,
        gte: undefined
      };
      
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        ...queryWithoutGte,
        select: jest.fn().mockResolvedValue({
          data: mockShieldActions,
          error: null
        })
      });

      const response = await request(app)
        .get('/api/shield/stats')
        .query({ timeRange: 'all' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.timeRange).toBe('all');
      expect(response.body.data.startDate).toBeNull();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database connection errors gracefully', async () => {
      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.range = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
        count: 0
      });

      const response = await request(app)
        .get('/api/shield/events')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to fetch shield events');
    });

    it('should validate query parameters and return proper error messages', async () => {
      const response = await request(app)
        .get('/api/shield/events')
        .query({ 
          page: -1, 
          limit: 1000, 
          category: 'invalid-category'
        })
        .expect(200); // Should sanitize and normalize params

      expect(response.body.success).toBe(true);
      // Parameters should be normalized to valid values
      expect(response.body.data.pagination.page).toBe(1); // Normalized from -1
      expect(response.body.data.pagination.limit).toBe(100); // Capped at 100
      expect(response.body.data.filters.category).toBe('all'); // Normalized from invalid
    });
  });

  describe('Security Integration', () => {
    it('should enforce organization isolation', async () => {
      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.range = jest.fn().mockResolvedValue({
        data: mockShieldActions,
        error: null,
        count: 3
      });

      await request(app)
        .get('/api/shield/events')
        .expect(200);

      // Verify that organization filter was applied
      expect(mockQuery.eq).toHaveBeenCalledWith('organization_id', 'test-org-456');
    });

    it('should sanitize sensitive data from responses', async () => {
      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.range = jest.fn().mockResolvedValue({
        data: mockShieldActions.map(item => ({
          ...item,
          organization_id: 'test-org-456', // This should be removed
          sensitive_field: 'should-be-removed'
        })),
        error: null,
        count: 3
      });

      const response = await request(app)
        .get('/api/shield/events')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.events.forEach(event => {
        expect(event.organization_id).toBeUndefined();
        expect(event.sensitive_field).toBeUndefined();
        // Safe fields should remain
        expect(event.id).toBeDefined();
        expect(event.action_type).toBeDefined();
        expect(event.content_snippet).toBeDefined();
      });
    });

    it('should apply proper rate limiting', async () => {
      const requests = Array(150).fill().map(() => 
        request(app).get('/api/shield/events')
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Integration', () => {
    it('should handle large datasets efficiently', async () => {
      // Create mock data for 1000 items
      const largeDataset = Array(1000).fill().map((_, index) => ({
        ...mockShieldActions[0],
        id: `action-${index}`,
        created_at: new Date(Date.now() - index * 60000).toISOString()
      }));

      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.range = jest.fn().mockResolvedValue({
        data: largeDataset.slice(0, 20), // First page
        error: null,
        count: 1000
      });

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/shield/events')
        .query({ page: 1, limit: 20 })
        .expect(200);
      const endTime = Date.now();

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(20);
      expect(response.body.data.pagination.total).toBe(1000);
      expect(response.body.data.pagination.totalPages).toBe(50);
      
      // Should respond in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should optimize queries with proper indexing', async () => {
      const mockQuery = supabaseServiceClient.from('shield_actions');
      mockQuery.range = jest.fn().mockResolvedValue({
        data: mockShieldActions,
        error: null,
        count: 3
      });

      await request(app)
        .get('/api/shield/events')
        .query({
          category: 'toxic',
          platform: 'twitter',
          timeRange: '30d'
        })
        .expect(200);

      // Verify that proper filters were applied for index usage
      expect(mockQuery.eq).toHaveBeenCalledWith('organization_id', 'test-org-456');
      expect(mockQuery.eq).toHaveBeenCalledWith('reason', 'toxic');
      expect(mockQuery.eq).toHaveBeenCalledWith('platform', 'twitter');
      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', expect.any(String));
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });
});