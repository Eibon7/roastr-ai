/**
 * Usage Current API Tests
 * Issue #1066: Implementar endpoint de uso actual del usuario (backend)
 */

const { createSupabaseMock } = require('../../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls
// ============================================================================

// Create Supabase mock with defaults
const mockSupabase = createSupabaseMock({
  users: [],
  analysis_usage: [],
  roast_usage: []
});

// Mock dependencies
jest.mock('../../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

const mockAuthenticateToken = (req, res, next) => {
  req.user = { id: 'test-user-id', email: 'test@example.com' };
  next();
};

jest.mock('../../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken
}));

jest.mock('../../../../src/services/planLimitsService', () => ({
  getPlanLimits: jest.fn((plan) => {
    const limits = {
      free: {
        monthlyAnalysisLimit: 10,
        monthlyResponsesLimit: 5
      },
      pro: {
        monthlyAnalysisLimit: 100,
        monthlyResponsesLimit: 50
      },
      plus: {
        monthlyAnalysisLimit: 500,
        monthlyResponsesLimit: 250
      }
    };
    return Promise.resolve(limits[plan] || limits.free);
  })
}));

jest.mock('../../../../src/utils/logger', () => ({
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

// ============================================================================
// STEP 3: Require modules AFTER mocks are configured
// ============================================================================

const request = require('supertest');
const express = require('express');
const usageCurrentRouter = require('../../../../src/routes/usage/current');

describe('Usage Current API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Apply auth middleware for tests
    app.use((req, res, next) => {
      req.user = { id: 'test-user-id', email: 'test@example.com' };
      next();
    });
    app.use('/usage/current', usageCurrentRouter);

    jest.clearAllMocks();
    // Reset Supabase mock to defaults
    mockSupabase._reset();
  });

  describe('GET /usage/current', () => {
    it('should return current usage successfully', async () => {
      // Setup mock data
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      mockSupabase._setTableData('users', [{ id: 'test-user-id', plan: 'pro' }]);

      mockSupabase._setTableData('analysis_usage', [
        {
          user_id: 'test-user-id',
          count: 10,
          period_start: startOfMonth.toISOString(),
          period_end: endOfMonth.toISOString()
        },
        {
          user_id: 'test-user-id',
          count: 15,
          period_start: startOfMonth.toISOString(),
          period_end: endOfMonth.toISOString()
        }
      ]);

      mockSupabase._setTableData('roast_usage', [
        {
          user_id: 'test-user-id',
          count: 5,
          period_start: startOfMonth.toISOString(),
          period_end: endOfMonth.toISOString()
        },
        {
          user_id: 'test-user-id',
          count: 8,
          period_start: startOfMonth.toISOString(),
          period_end: endOfMonth.toISOString()
        }
      ]);

      const response = await request(app).get('/usage/current').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('analysis');
      expect(response.body.data).toHaveProperty('roasts');
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data).toHaveProperty('plan', 'pro');

      // Analysis: 10 + 15 = 25 consumed, 100 available, 75 remaining
      expect(response.body.data.analysis.consumed).toBe(25);
      expect(response.body.data.analysis.available).toBe(100);
      expect(response.body.data.analysis.remaining).toBe(75);

      // Roasts: 5 + 8 = 13 consumed, 50 available, 37 remaining
      expect(response.body.data.roasts.consumed).toBe(13);
      expect(response.body.data.roasts.available).toBe(50);
      expect(response.body.data.roasts.remaining).toBe(37);
    });

    it('should handle empty usage gracefully', async () => {
      mockSupabase._setTableData('users', [{ id: 'test-user-id', plan: 'free' }]);

      mockSupabase._setTableData('analysis_usage', []);
      mockSupabase._setTableData('roast_usage', []);

      const response = await request(app).get('/usage/current').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.analysis.consumed).toBe(0);
      expect(response.body.data.roasts.consumed).toBe(0);
      expect(response.body.data.plan).toBe('free');
    });

    it('should calculate remaining correctly', async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      mockSupabase._setTableData('users', [{ id: 'test-user-id', plan: 'free' }]);

      // Consumed more than available (should not go negative)
      mockSupabase._setTableData('analysis_usage', [
        {
          user_id: 'test-user-id',
          count: 15,
          period_start: startOfMonth.toISOString(),
          period_end: endOfMonth.toISOString()
        }
      ]);

      mockSupabase._setTableData('roast_usage', [
        {
          user_id: 'test-user-id',
          count: 10,
          period_start: startOfMonth.toISOString(),
          period_end: endOfMonth.toISOString()
        }
      ]);

      const response = await request(app).get('/usage/current').expect(200);

      // Free plan: 10 analysis limit, 5 roasts limit
      expect(response.body.data.analysis.consumed).toBe(15);
      expect(response.body.data.analysis.available).toBe(10);
      expect(response.body.data.analysis.remaining).toBe(0); // Should not be negative

      expect(response.body.data.roasts.consumed).toBe(10);
      expect(response.body.data.roasts.available).toBe(5);
      expect(response.body.data.roasts.remaining).toBe(0); // Should not be negative
    });

    it('should handle user not found gracefully', async () => {
      mockSupabase._setTableData('users', []);
      mockSupabase._setTableData('analysis_usage', []);
      mockSupabase._setTableData('roast_usage', []);

      const response = await request(app).get('/usage/current').expect(200);

      // Should default to 'free' plan
      expect(response.body.data.plan).toBe('free');
      expect(response.body.data.analysis.available).toBe(10); // Free plan limit
    });

    it('should filter usage by current month only', async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      mockSupabase._setTableData('users', [{ id: 'test-user-id', plan: 'pro' }]);

      // Mix of current month and last month
      mockSupabase._setTableData('analysis_usage', [
        {
          user_id: 'test-user-id',
          count: 10,
          period_start: startOfMonth.toISOString(),
          period_end: endOfMonth.toISOString()
        },
        {
          user_id: 'test-user-id',
          count: 20,
          period_start: lastMonth.toISOString(),
          period_end: lastMonthEnd.toISOString()
        } // Should be ignored
      ]);

      mockSupabase._setTableData('roast_usage', []);

      const response = await request(app).get('/usage/current').expect(200);

      // Should only count current month (10, not 30)
      expect(response.body.data.analysis.consumed).toBe(10);
    });

    it('should handle missing user ID', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      appWithoutAuth.use('/usage/current', usageCurrentRouter);

      const response = await request(appWithoutAuth).get('/usage/current').expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should handle service errors gracefully', async () => {
      // Mock service to throw error
      const usageService = require('../../../../src/services/usageService');
      const originalGetCurrentUsage = usageService.getCurrentUsage;
      usageService.getCurrentUsage = jest.fn().mockRejectedValue(new Error('Service error'));

      const response = await request(app).get('/usage/current').expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Failed to fetch current usage');

      // Restore original method
      usageService.getCurrentUsage = originalGetCurrentUsage;
    });

    it('should handle getCurrentUsage errors', async () => {
      // Mock getCurrentUsage to throw error
      const usageService = require('../../../../src/services/usageService');
      const originalGetCurrentUsage = usageService.getCurrentUsage;

      // Mock to throw error in getCurrentUsage
      usageService.getCurrentUsage = jest.fn().mockImplementation(() => {
        throw new Error('Error getting current usage');
      });

      const response = await request(app).get('/usage/current').expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Failed to fetch current usage');

      // Restore original method
      usageService.getCurrentUsage = originalGetCurrentUsage;
    });
  });
});
