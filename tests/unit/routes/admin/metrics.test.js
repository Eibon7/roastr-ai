/**
 * Admin Metrics API Tests
 * Issue #1065: Implementar endpoint de métricas agregadas (backend)
 */

const { createSupabaseMock } = require('../../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls
// ============================================================================

// Create Supabase mock with defaults
const mockSupabase = createSupabaseMock({
  analysis_usage: [],
  roast_usage: [],
  users: [],
  sponsors: [],
  usage_tracking: []
});

// Mock dependencies
jest.mock('../../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

jest.mock('../../../../src/middleware/isAdmin', () => ({
  isAdminMiddleware: (req, res, next) => {
    req.user = { id: 'admin-user-id', email: 'admin@test.com', is_admin: true };
    next();
  }
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
const metricsRouter = require('../../../../src/routes/admin/metrics');
const { supabaseServiceClient } = require('../../../../src/config/supabase');

describe('Admin Metrics API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/admin/metrics', metricsRouter);

    jest.clearAllMocks();
    // Reset Supabase mock to defaults
    mockSupabase._reset();
  });

  describe('GET /admin/metrics', () => {
    it('should return aggregated metrics successfully', async () => {
      // Setup mock data
      mockSupabase._setTableData('analysis_usage', [{ count: 10 }, { count: 20 }, { count: 15 }]);

      mockSupabase._setTableData('roast_usage', [{ count: 5 }, { count: 8 }, { count: 12 }]);

      mockSupabase._setTableData('users', [
        { id: '1', plan: 'free', active: true },
        { id: '2', plan: 'pro', active: true },
        { id: '3', plan: 'plus', active: true },
        { id: '4', plan: 'free', active: false } // Inactive user
      ]);

      mockSupabase._setTableData('sponsors', [
        { user_id: '2', active: true },
        { user_id: '3', active: true }
      ]);

      mockSupabase._setTableData('usage_tracking', [
        { resource_type: 'comment_analysis', cost_cents: 1, tokens_used: 150 },
        { resource_type: 'comment_analysis', cost_cents: 2, tokens_used: 200 },
        { resource_type: 'roasts', cost_cents: 5, tokens_used: 250 },
        { resource_type: 'roasts', cost_cents: 6, tokens_used: 300 }
      ]);

      const response = await request(app).get('/admin/metrics').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total_analysis', 45);
      expect(response.body.data).toHaveProperty('total_roasts', 25);
      expect(response.body.data).toHaveProperty('active_users', 3);
      expect(response.body.data).toHaveProperty('avg_analysis_per_user');
      expect(response.body.data).toHaveProperty('avg_roasts_per_user');
      expect(response.body.data).toHaveProperty('users_by_plan');
      expect(response.body.data).toHaveProperty('feature_usage');
      expect(response.body.data).toHaveProperty('costs');
    });

    it('should handle empty data gracefully', async () => {
      // All tables empty
      mockSupabase._setTableData('analysis_usage', []);
      mockSupabase._setTableData('roast_usage', []);
      mockSupabase._setTableData('users', []);
      mockSupabase._setTableData('sponsors', []);
      mockSupabase._setTableData('usage_tracking', []);

      const response = await request(app).get('/admin/metrics').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('total_analysis', 0);
      expect(response.body.data).toHaveProperty('total_roasts', 0);
      expect(response.body.data).toHaveProperty('active_users', 0);
      expect(response.body.data).toHaveProperty('avg_analysis_per_user', 0);
      expect(response.body.data).toHaveProperty('avg_roasts_per_user', 0);
    });

    it('should calculate averages correctly', async () => {
      mockSupabase._setTableData('analysis_usage', [{ count: 100 }, { count: 200 }]);

      mockSupabase._setTableData('roast_usage', [{ count: 50 }, { count: 100 }]);

      mockSupabase._setTableData('users', [
        { id: '1', plan: 'free', active: true },
        { id: '2', plan: 'pro', active: true }
      ]);

      const response = await request(app).get('/admin/metrics').expect(200);

      expect(response.body.data.total_analysis).toBe(300);
      expect(response.body.data.total_roasts).toBe(150);
      expect(response.body.data.active_users).toBe(2);
      expect(response.body.data.avg_analysis_per_user).toBe(150);
      expect(response.body.data.avg_roasts_per_user).toBe(75);
    });

    it('should calculate plan distribution correctly', async () => {
      mockSupabase._setTableData('analysis_usage', []);
      mockSupabase._setTableData('roast_usage', []);
      mockSupabase._setTableData('users', [
        { id: '1', plan: 'free', active: true },
        { id: '2', plan: 'free', active: true },
        { id: '3', plan: 'pro', active: true },
        { id: '4', plan: 'plus', active: true }
      ]);

      const response = await request(app).get('/admin/metrics').expect(200);

      expect(response.body.data.users_by_plan).toHaveProperty('free');
      expect(response.body.data.users_by_plan).toHaveProperty('pro');
      expect(response.body.data.users_by_plan).toHaveProperty('plus');
      expect(response.body.data.users_by_plan.free).toBe(50);
      expect(response.body.data.users_by_plan.pro).toBe(25);
      expect(response.body.data.users_by_plan.plus).toBe(25);
    });

    it('should calculate feature usage percentages', async () => {
      mockSupabase._setTableData('analysis_usage', []);
      mockSupabase._setTableData('roast_usage', []);
      mockSupabase._setTableData('users', [
        {
          id: '1',
          plan: 'free',
          active: true,
          lo_que_me_define_encrypted: 'test persona'
        },
        { id: '2', plan: 'pro', active: true, lo_que_me_define_encrypted: null },
        { id: '3', plan: 'plus', active: true, lo_que_me_define_encrypted: null },
        { id: '4', plan: 'free', active: true, lo_que_me_define_encrypted: null }
      ]);

      mockSupabase._setTableData('sponsors', [{ user_id: '3', active: true }]);

      const response = await request(app).get('/admin/metrics').expect(200);

      expect(response.body.data.feature_usage).toHaveProperty('persona');
      expect(response.body.data.feature_usage).toHaveProperty('sponsors');
      expect(response.body.data.feature_usage).toHaveProperty('custom_tone');
      // 1 out of 4 users has persona = 25%
      expect(response.body.data.feature_usage.persona).toBe(25);
      // 1 out of 4 users has sponsors = 25%
      expect(response.body.data.feature_usage.sponsors).toBe(25);
    });

    it('should calculate cost averages correctly', async () => {
      mockSupabase._setTableData('analysis_usage', []);
      mockSupabase._setTableData('roast_usage', []);
      mockSupabase._setTableData('users', [{ id: '1', plan: 'free', active: true }]);

      mockSupabase._setTableData('usage_tracking', [
        { resource_type: 'comment_analysis', cost_cents: 1, tokens_used: 100 },
        { resource_type: 'comment_analysis', cost_cents: 3, tokens_used: 200 },
        { resource_type: 'roasts', cost_cents: 5, tokens_used: 250 },
        { resource_type: 'roasts', cost_cents: 7, tokens_used: 350 }
      ]);

      const response = await request(app).get('/admin/metrics').expect(200);

      expect(response.body.data.costs).toHaveProperty('avg_cost_per_analysis');
      expect(response.body.data.costs).toHaveProperty('avg_tokens_per_analysis');
      expect(response.body.data.costs).toHaveProperty('avg_cost_per_roast');
      expect(response.body.data.costs).toHaveProperty('avg_tokens_per_roast');

      // (1 + 3) / 2 = 2 cents per analysis
      expect(response.body.data.costs.avg_cost_per_analysis).toBe(2);
      // (100 + 200) / 2 = 150 tokens per analysis
      expect(response.body.data.costs.avg_tokens_per_analysis).toBe(150);
      // (5 + 7) / 2 = 6 cents per roast
      expect(response.body.data.costs.avg_cost_per_roast).toBe(6);
      // (250 + 350) / 2 = 300 tokens per roast
      expect(response.body.data.costs.avg_tokens_per_roast).toBe(300);
    });

    it('should handle database errors gracefully', async () => {
      // Simulate database error
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app).get('/admin/metrics').expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });
});
