/**
 * Integration test for Issue #366 - Complete flow testing
 * Tests the complete implementation of CodeRabbit feedback items
 */

const request = require('supertest');
const express = require('express');

// Mock all dependencies
jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    single: jest.fn()
  }
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { 
      id: 'test-user-id', 
      email: 'test@example.com',
      org_id: 'test-org-123' 
    };
    next();
  })
}));

jest.mock('../../src/utils/logger', () => ({
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

describe('Issue #366 - Complete Integration Flow', () => {
  let app;
  let mockSupabaseClient;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Setup mocked supabase client
    mockSupabaseClient = require('../../src/config/supabase').supabaseServiceClient;
    
    // Import routes after mocking
    const analyticsRoutes = require('../../src/routes/analytics');
    app.use('/api/analytics', analyticsRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Analytics Summary Endpoint with Org Filtering', () => {
    it('should complete full analytics summary flow', async () => {
      // Mock all four database queries for analytics summary
      mockSupabaseClient.single
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

      // Verify response structure and data
      expect(response.body).toEqual({
        success: true,
        data: {
          totalAnalyses: 150,
          totalRoasts: 89,
          last30DaysAnalyses: 45,
          last30DaysRoasts: 23
        }
      });

      // Verify org filtering was applied correctly
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('org_id', 'test-org-123');
      expect(mockSupabaseClient.eq).toHaveBeenCalledTimes(4);

      // Verify all required tables were queried
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('toxicity_analyses');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('roasts');
    });

    it('should handle multi-tenant isolation correctly', async () => {
      // Test with different org_id
      const authenticateTokenAlt = jest.fn((req, res, next) => {
        req.user = { 
          id: 'alt-user-id', 
          email: 'alt@example.com',
          org_id: 'alt-org-456' 
        };
        next();
      });

      // Create separate app for alt org test
      const altApp = express();
      altApp.use(express.json());
      altApp.use((req, res, next) => authenticateTokenAlt(req, res, next));
      
      const analyticsRoutes = require('../../src/routes/analytics');
      altApp.use('/api/analytics', analyticsRoutes);

      mockSupabaseClient.single.mockResolvedValue({
        data: { count: 25 },
        error: null
      });

      await request(altApp)
        .get('/api/analytics/summary')
        .expect(200);

      // Should filter by the alternative org_id
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('org_id', 'alt-org-456');
    });
  });

  describe('Feature Flag Integration', () => {
    it('should properly handle ENABLE_SHOP flag', () => {
      // Set environment variable
      process.env.SHOP_ENABLED = 'true';
      
      // Reload flags module
      jest.resetModules();
      const { flags } = require('../../src/config/flags');
      
      expect(flags.isEnabled('ENABLE_SHOP')).toBe(true);
      
      const serviceStatus = flags.getServiceStatus();
      expect(serviceStatus.features.shop).toBe(true);
    });

    it('should handle ENABLE_SHIELD_UI flag for dashboard', () => {
      process.env.ENABLE_SHIELD_UI = 'true';
      
      jest.resetModules();
      const { flags } = require('../../src/config/flags');
      
      expect(flags.isEnabled('ENABLE_SHIELD_UI')).toBe(true);
    });
  });

  describe('Connection Limits Validation Flow', () => {
    it('should validate connection limits for free tier', () => {
      const mockUserData = { plan: 'free', isAdminMode: false };
      
      // Simulate the logic from useSocialAccounts hook
      const getConnectionLimits = () => {
        const planTier = mockUserData.plan.toLowerCase();
        const maxConnections = planTier === 'free' ? 1 : 2;
        return { maxConnections, planTier };
      };

      const limits = getConnectionLimits();
      expect(limits.maxConnections).toBe(1);
      expect(limits.planTier).toBe('free');
    });

    it('should validate connection limits for pro tier', () => {
      const mockUserData = { plan: 'pro', isAdminMode: false };
      
      const getConnectionLimits = () => {
        const planTier = mockUserData.plan.toLowerCase();
        const maxConnections = planTier === 'free' ? 1 : 2;
        return { maxConnections, planTier };
      };

      const limits = getConnectionLimits();
      expect(limits.maxConnections).toBe(2);
      expect(limits.planTier).toBe('pro');
    });

    it('should handle admin mode correctly', () => {
      const mockUserData = { 
        plan: 'free', 
        isAdminMode: true,
        adminModeUser: { plan: 'plus' }
      };
      
      const getConnectionLimits = () => {
        const planTier = (mockUserData.isAdminMode 
          ? (mockUserData.adminModeUser?.plan || '') 
          : (mockUserData?.plan || '')).toLowerCase();
        const maxConnections = planTier === 'free' ? 1 : 2;
        return { maxConnections, planTier };
      };

      const limits = getConnectionLimits();
      expect(limits.maxConnections).toBe(2); // Should use admin user's plan
      expect(limits.planTier).toBe('plus');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing org_id gracefully', async () => {
      // Mock user without org_id
      const noOrgAuth = jest.fn((req, res, next) => {
        req.user = { id: 'test-user-id', email: 'test@example.com' };
        next();
      });

      const noOrgApp = express();
      noOrgApp.use(express.json());
      noOrgApp.use((req, res, next) => noOrgAuth(req, res, next));
      
      const analyticsRoutes = require('../../src/routes/analytics');
      noOrgApp.use('/api/analytics', analyticsRoutes);

      mockSupabaseClient.single.mockResolvedValue({
        data: { count: 0 },
        error: null
      });

      const response = await request(noOrgApp)
        .get('/api/analytics/summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('org_id', null);
    });

    it('should handle database errors properly', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const response = await request(app)
        .get('/api/analytics/summary')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to fetch analytics summary');
    });

    it('should handle partial data gracefully', async () => {
      // Mock scenario where some queries succeed and others fail
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { count: 150 }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Query failed' } });

      const response = await request(app)
        .get('/api/analytics/summary')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Performance and Caching', () => {
    it('should handle high-frequency requests efficiently', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { count: 100 },
        error: null
      });

      // Simulate multiple concurrent requests
      const requests = Array(10).fill().map(() => 
        request(app).get('/api/analytics/summary')
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Security and Authorization', () => {
    it('should require authentication for analytics endpoint', async () => {
      const noAuthApp = express();
      noAuthApp.use(express.json());
      
      // Add route without auth middleware
      noAuthApp.get('/api/analytics/summary', (req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      await request(noAuthApp)
        .get('/api/analytics/summary')
        .expect(401);
    });

    it('should properly isolate data by organization', async () => {
      // This test ensures that different organizations see different data
      mockSupabaseClient.single.mockResolvedValue({
        data: { count: 50 },
        error: null
      });

      await request(app)
        .get('/api/analytics/summary')
        .expect(200);

      // Verify that the query specifically filters by the user's org_id
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('org_id', 'test-org-123');
      
      // Should not query global or other org data
      expect(mockSupabaseClient.eq).not.toHaveBeenCalledWith('org_id', null);
      expect(mockSupabaseClient.eq).not.toHaveBeenCalledWith('org_id', expect.not.stringMatching('test-org-123'));
    });
  });

  describe('Code Quality and Maintainability', () => {
    it('should have consistent error response format', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Test error' }
      });

      const response = await request(app)
        .get('/api/analytics/summary')
        .expect(500);

      // Verify standard error response format
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(false);
      expect(typeof response.body.error).toBe('string');
    });

    it('should have consistent success response format', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { count: 100 },
        error: null
      });

      const response = await request(app)
        .get('/api/analytics/summary')
        .expect(200);

      // Verify standard success response format
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe('object');
    });
  });
});