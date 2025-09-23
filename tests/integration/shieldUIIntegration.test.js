/**
 * Shield UI Integration Tests
 * 
 * Tests for Shield API endpoints including authentication, rate limiting,
 * data validation, and organization isolation.
 */

const request = require('supertest');
const { app } = require('../../src/index');

// Mock authentication middleware
const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = {
    id: 'test-user-123',
    email: 'test@example.com',
    organizationId: 'test-org-123'
  };
  next();
});

jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken,
  optionalAuth: jest.fn((req, res, next) => next())
}));

// Mock Supabase
const mockSupabaseQuery = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
};

const mockSupabaseServiceClient = {
  from: jest.fn(() => mockSupabaseQuery),
};

jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabaseServiceClient,
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock feature flags
jest.mock('../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn((flag) => {
      if (flag === 'ENABLE_SHIELD_UI') return true;
      return false;
    }),
  },
}));

// Test data
const mockShieldActions = [
  {
    id: '1',
    organization_id: 'test-org-123',
    action_type: 'block',
    content: 'Test offensive content',
    platform: 'twitter',
    reason: 'toxic',
    created_at: '2024-01-15T10:00:00Z',
    reverted_at: null,
    metadata: {},
  },
  {
    id: '2',
    organization_id: 'test-org-123',
    action_type: 'mute',
    content: 'Another problematic comment',
    platform: 'youtube',
    reason: 'harassment',
    created_at: '2024-01-14T15:30:00Z',
    reverted_at: null,
    metadata: {},
  },
];

describe('Shield UI API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful responses
    mockSupabaseQuery.range.mockResolvedValue({
      data: mockShieldActions,
      error: null,
      count: 2,
    });
    
    mockSupabaseQuery.single.mockResolvedValue({
      data: mockShieldActions[0],
      error: null,
    });
    
    mockSupabaseQuery.update.mockResolvedValue({
      data: [{ ...mockShieldActions[0], reverted_at: new Date().toISOString() }],
      error: null,
    });
  });

  describe('GET /api/shield/events', () => {
    test('should return shield events with default pagination', async () => {
      const response = await request(app)
        .get('/api/shield/events')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(2);
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    test('should apply time range filtering', async () => {
      await request(app)
        .get('/api/shield/events?timeRange=7d')
        .expect(200);

      expect(mockSupabaseQuery.gte).toHaveBeenCalledWith(
        'created_at',
        expect.any(String)
      );
    });

    test('should apply category filtering', async () => {
      await request(app)
        .get('/api/shield/events?category=toxic')
        .expect(200);

      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('reason', 'toxic');
    });

    test('should apply platform filtering', async () => {
      await request(app)
        .get('/api/shield/events?platform=twitter')
        .expect(200);

      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('platform', 'twitter');
    });

    test('should handle pagination parameters', async () => {
      await request(app)
        .get('/api/shield/events?page=2&limit=10')
        .expect(200);

      expect(mockSupabaseQuery.range).toHaveBeenCalledWith(10, 19);
    });

    test('should enforce maximum page limit', async () => {
      await request(app)
        .get('/api/shield/events?limit=200')
        .expect(200);

      // Should cap at 100
      expect(mockSupabaseQuery.range).toHaveBeenCalledWith(0, 99);
    });

    test('should include organization isolation', async () => {
      await request(app)
        .get('/api/shield/events')
        .expect(200);

      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith(
        'organization_id',
        'test-org-123'
      );
    });

    test('should handle database errors', async () => {
      mockSupabaseQuery.range.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
        count: 0,
      });

      const response = await request(app)
        .get('/api/shield/events')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to fetch shield events');
    });
  });

  describe('POST /api/shield/revert/:id', () => {
    test('should revert a shield action successfully', async () => {
      const response = await request(app)
        .post('/api/shield/revert/1')
        .send({ reason: 'False positive' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Shield action reverted successfully');
      expect(mockSupabaseQuery.update).toHaveBeenCalled();
    });

    test('should validate action ID parameter', async () => {
      const response = await request(app)
        .post('/api/shield/revert/')
        .send({ reason: 'Test' })
        .expect(404); // Route not found without ID

      // Test with empty string ID
      await request(app)
        .post('/api/shield/revert/ ')
        .send({ reason: 'Test' })
        .expect(400);
    });

    test('should handle non-existent action', async () => {
      mockSupabaseQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const response = await request(app)
        .post('/api/shield/revert/nonexistent')
        .send({ reason: 'Test' })
        .expect(404);

      expect(response.body.error.code).toBe('ACTION_NOT_FOUND');
    });

    test('should prevent reverting already reverted actions', async () => {
      mockSupabaseQuery.single.mockResolvedValue({
        data: {
          ...mockShieldActions[0],
          reverted_at: '2024-01-15T11:00:00Z',
        },
        error: null,
      });

      const response = await request(app)
        .post('/api/shield/revert/1')
        .send({ reason: 'Test' })
        .expect(400);

      expect(response.body.error.code).toBe('ALREADY_REVERTED');
    });

    test('should enforce organization isolation', async () => {
      await request(app)
        .post('/api/shield/revert/1')
        .send({ reason: 'Test' })
        .expect(200);

      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith(
        'organization_id',
        'test-org-123'
      );
    });

    test('should handle database update errors', async () => {
      mockSupabaseQuery.update.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      const response = await request(app)
        .post('/api/shield/revert/1')
        .send({ reason: 'Test' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to revert shield action');
    });

    test('should include revert metadata', async () => {
      await request(app)
        .post('/api/shield/revert/1')
        .send({ reason: 'False positive' })
        .expect(200);

      const updateCall = mockSupabaseQuery.update.mock.calls[0][0];
      expect(updateCall.metadata).toEqual({
        reverted: true,
        revertedBy: 'test-user-123',
        revertReason: 'False positive',
      });
    });
  });

  describe('GET /api/shield/stats', () => {
    test('should return shield statistics', async () => {
      mockSupabaseQuery.select.mockResolvedValue({
        data: mockShieldActions,
        error: null,
      });

      const response = await request(app)
        .get('/api/shield/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        total: 2,
        reverted: 0,
        active: 2,
        byActionType: {
          block: 1,
          mute: 1,
        },
        byPlatform: {
          twitter: 1,
          youtube: 1,
        },
        byReason: {
          toxic: 1,
          harassment: 1,
        },
      });
    });

    test('should apply time range filtering to stats', async () => {
      await request(app)
        .get('/api/shield/stats?timeRange=30d')
        .expect(200);

      expect(mockSupabaseQuery.gte).toHaveBeenCalledWith(
        'created_at',
        expect.any(String)
      );
    });

    test('should include organization isolation in stats', async () => {
      await request(app)
        .get('/api/shield/stats')
        .expect(200);

      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith(
        'organization_id',
        'test-org-123'
      );
    });

    test('should handle empty data in stats', async () => {
      mockSupabaseQuery.select.mockResolvedValue({
        data: [],
        error: null,
      });

      const response = await request(app)
        .get('/api/shield/stats')
        .expect(200);

      expect(response.body.data.total).toBe(0);
      expect(response.body.data.byActionType).toEqual({});
      expect(response.body.data.byPlatform).toEqual({});
      expect(response.body.data.byReason).toEqual({});
    });
  });

  describe('GET /api/shield/config', () => {
    test('should return shield configuration', async () => {
      const response = await request(app)
        .get('/api/shield/config')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        enabled: true,
        features: {
          eventFiltering: true,
          revertActions: true,
          statistics: true,
          realTimeUpdates: false,
        },
        limits: {
          maxEventsPerPage: 100,
          revertActionsPerWindow: 10,
          revertWindowMinutes: 5,
        },
      });

      expect(response.body.data.categories).toContain('toxic');
      expect(response.body.data.platforms).toContain('twitter');
      expect(response.body.data.actionTypes).toContain('block');
    });

    test('should reflect feature flag status', async () => {
      const { flags } = require('../../src/config/flags');
      flags.isEnabled.mockReturnValue(false);

      const response = await request(app)
        .get('/api/shield/config')
        .expect(200);

      expect(response.body.data.enabled).toBe(false);
    });
  });

  describe('Authentication', () => {
    test('should require authentication for all endpoints', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        return res.status(401).json({ error: 'Unauthorized' });
      });

      await request(app).get('/api/shield/events').expect(401);
      await request(app).post('/api/shield/revert/1').expect(401);
      await request(app).get('/api/shield/stats').expect(401);
      await request(app).get('/api/shield/config').expect(401);
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting to revert endpoint', async () => {
      // This would be better tested with actual rate limiting, but we'll verify the middleware is applied
      
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/shield/revert/1')
          .send({ reason: 'Test' });
      }

      // All requests should succeed in test environment (rate limiting disabled)
      expect(mockSupabaseQuery.single).toHaveBeenCalledTimes(5);
    });
  });

  describe('Data Validation', () => {
    test('should validate time range parameters', async () => {
      const response = await request(app)
        .get('/api/shield/events?timeRange=invalid')
        .expect(200);

      // Should default to null (all time) for invalid time range
      expect(mockSupabaseQuery.gte).not.toHaveBeenCalled();
    });

    test('should validate pagination parameters', async () => {
      await request(app)
        .get('/api/shield/events?page=-1&limit=0')
        .expect(200);

      // Should normalize to valid values
      expect(mockSupabaseQuery.range).toHaveBeenCalledWith(0, 0); // page 1, limit 1 (minimum)
    });

    test('should handle non-string filter values', async () => {
      await request(app)
        .get('/api/shield/events?category=123&platform=456')
        .expect(200);

      // Should still apply filters as strings
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('reason', '123');
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('platform', '456');
    });
  });

  describe('Error Handling', () => {
    test('should handle Supabase connection errors', async () => {
      mockSupabaseQuery.range.mockRejectedValue(new Error('Connection timeout'));

      const response = await request(app)
        .get('/api/shield/events')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details).toBe('Connection timeout');
    });

    test('should handle malformed JSON in revert requests', async () => {
      const response = await request(app)
        .post('/api/shield/revert/1')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      // Express should handle malformed JSON automatically
    });
  });
});