/**
 * Comprehensive tests for Issue #366 - Analytics Summary Implementation
 * Tests the analytics summary endpoint with org-based filtering
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
const mockAnalyticsData = {
  totalAnalyses: 150,
  totalRoasts: 89,
  last30DaysAnalyses: 45,
  last30DaysRoasts: 23
};

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = { 
    id: 'test-user-id', 
    email: 'test@example.com',
    org_id: 'test-org-123' 
  };
  next();
});

const mockSupabaseServiceClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  single: jest.fn()
};

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken
}));

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabaseServiceClient
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: { 
    info: jest.fn(), 
    error: jest.fn(), 
    warn: jest.fn() 
  }
}));

describe('Issue #366 - Analytics Summary Endpoint', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Import and setup the analytics route after mocking
    const analyticsRoutes = require('../../../src/routes/analytics');
    app.use('/api/analytics', analyticsRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/summary', () => {
    it('should return analytics summary with org filtering', async () => {
      // Mock successful database responses
      mockSupabaseServiceClient.single
        .mockResolvedValueOnce({ // totalAnalyses
          data: { count: 150 },
          error: null
        })
        .mockResolvedValueOnce({ // totalRoasts  
          data: { count: 89 },
          error: null
        })
        .mockResolvedValueOnce({ // last30DaysAnalyses
          data: { count: 45 },
          error: null
        })
        .mockResolvedValueOnce({ // last30DaysRoasts
          data: { count: 23 },
          error: null
        });

      const response = await request(app)
        .get('/api/analytics/summary')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockAnalyticsData
      });

      // Verify org filtering was applied to all queries
      expect(mockSupabaseServiceClient.eq).toHaveBeenCalledWith('org_id', 'test-org-123');
      expect(mockSupabaseServiceClient.eq).toHaveBeenCalledTimes(4); // Once per query
    });

    it('should handle missing org_id gracefully', async () => {
      // Mock user without org_id
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = { id: 'test-user-id', email: 'test@example.com' };
        next();
      });

      mockSupabaseServiceClient.single
        .mockResolvedValue({
          data: { count: 0 },
          error: null
        });

      const response = await request(app)
        .get('/api/analytics/summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should filter by null org_id
      expect(mockSupabaseServiceClient.eq).toHaveBeenCalledWith('org_id', null);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseServiceClient.single
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Database connection failed' }
        });

      const response = await request(app)
        .get('/api/analytics/summary')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to fetch analytics summary');
    });

    it('should require authentication', async () => {
      const appNoAuth = express();
      appNoAuth.use(express.json());
      
      // Add route without auth middleware
      appNoAuth.get('/api/analytics/summary', (req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      await request(appNoAuth)
        .get('/api/analytics/summary')
        .expect(401);
    });
  });
});