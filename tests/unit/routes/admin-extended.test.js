/**
 * Extended Tests for Admin Routes - Issue #932
 *
 * Provides additional test coverage for endpoints not fully covered in admin.test.js:
 * - GET /api/admin/usage
 * - GET /api/admin/usage/organizations/:orgId
 * - POST /api/admin/usage/limits
 * - POST /api/admin/usage/reset
 * - GET /api/admin/usage/export
 * - GET /api/admin/alerts/history
 * - GET /api/admin/alerts/history/:orgId
 * - GET /api/admin/alerts/stats/:orgId
 * - GET /api/admin/plan-limits
 * - GET /api/admin/plan-limits/:planId
 * - PUT /api/admin/plan-limits/:planId
 * - POST /api/admin/plan-limits/refresh-cache
 * - PUT /api/admin/backoffice/thresholds
 * - GET /api/admin/plans
 * - PUT /api/admin/plans/:planId
 * - PATCH /api/admin/users/:userId/config
 * - POST /api/admin/users/:userId/reauth-integrations
 * - GET /api/admin/users/:userId/activity
 */

const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls
// ============================================================================

const mockSupabase = createSupabaseMock({
  users: [],
  organizations: [],
  usage_tracking: [],
  app_logs: [],
  plan_limits: [],
  global_shield_settings: [],
  integration_tokens: [],
  user_integrations: [],
  roast_responses: [],
  shield_actions: []
});

// Mock cost control service
const mockCostControlService = {
  getEnhancedUsageStats: jest.fn(() =>
    Promise.resolve({
      current: { roasts: 50, analysis: 200 },
      limit: { roasts: 100, analysis: 1000 },
      history: []
    })
  ),
  setUsageLimit: jest.fn(() =>
    Promise.resolve({
      success: true,
      organizationId: 'org-123',
      resourceType: 'roasts',
      limit: 200
    })
  ),
  resetAllMonthlyUsage: jest.fn(() =>
    Promise.resolve({
      organizationsReset: 10,
      resetAt: new Date().toISOString()
    })
  ),
  getAlertHistory: jest.fn(() =>
    Promise.resolve({
      alerts: [],
      pagination: { total: 0, limit: 50, offset: 0 }
    })
  ),
  getAlertStats: jest.fn(() =>
    Promise.resolve({
      total: 5,
      byType: { warning: 3, critical: 2 },
      byResource: { roasts: 3, analysis: 2 }
    })
  )
};

// Mock plan limits service
const mockPlanLimitsService = {
  getAllPlanLimits: jest.fn(() =>
    Promise.resolve({
      free: { maxRoasts: 10, maxPlatforms: 1 },
      pro: { maxRoasts: 100, maxPlatforms: 3 },
      creator_plus: { maxRoasts: 500, maxPlatforms: 10 }
    })
  ),
  getPlanLimits: jest.fn((planId) =>
    Promise.resolve({
      maxRoasts: planId === 'pro' ? 100 : 10,
      maxPlatforms: planId === 'pro' ? 3 : 1,
      monthlyAnalysisLimit: planId === 'pro' ? 1000 : 100,
      monthlyTokensLimit: planId === 'pro' ? 50000 : 5000
    })
  ),
  updatePlanLimits: jest.fn(() =>
    Promise.resolve({
      maxRoasts: 150,
      maxPlatforms: 5
    })
  ),
  clearCache: jest.fn()
};

// Mock plan service
const mockPlanService = {
  getAllPlans: jest.fn(() => ({
    free: {
      name: 'Free',
      price: 0,
      currency: 'EUR',
      features: { shield: false, customTones: false, prioritySupport: false, advancedAnalytics: false, apiAccess: false },
      duration: 'monthly'
    },
    pro: {
      name: 'Pro',
      price: 2000,
      currency: 'EUR',
      features: { shield: true, customTones: true, prioritySupport: false, advancedAnalytics: true, apiAccess: false },
      duration: 'monthly'
    },
    creator_plus: {
      name: 'Creator Plus',
      price: 5000,
      currency: 'EUR',
      features: { shield: true, customTones: true, prioritySupport: true, advancedAnalytics: true, apiAccess: true },
      duration: 'monthly'
    }
  })),
  getPlanFeatures: jest.fn((planId) => {
    const plans = {
      free: { name: 'Free', price: 0, features: {} },
      pro: { name: 'Pro', price: 2000, features: {} },
      creator_plus: { name: 'Creator Plus', price: 5000, features: {} }
    };
    return plans[planId] || null;
  })
};

// Mock supabase
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

// Mock middleware
jest.mock('../../../src/middleware/isAdmin', () => ({
  isAdminMiddleware: (req, res, next) => {
    req.user = {
      id: 'admin-123',
      email: 'admin@test.com',
      name: 'Admin User',
      is_admin: true
    };
    req.accessToken = 'valid-token';
    next();
  }
}));

jest.mock('../../../src/middleware/csrf', () => ({
  validateCsrfToken: (req, res, next) => next(),
  setCsrfToken: (req, res, next) => next()
}));

jest.mock('../../../src/middleware/adminRateLimiter', () => ({
  adminRateLimiter: (req, res, next) => next(),
  createAdminRateLimiter: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../../src/middleware/responseCache', () => ({
  cacheResponse: jest.fn(() => (req, res, next) => next()),
  invalidateCache: jest.fn(),
  invalidateAdminUsersCache: jest.fn()
}));

// Mock logger
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

// Mock cost control service (constructor mock)
jest.mock('../../../src/services/costControl', () => {
  return jest.fn().mockImplementation(() => mockCostControlService);
});

// Mock plan limits service
jest.mock('../../../src/services/planLimitsService', () => mockPlanLimitsService);

// Mock plan service
jest.mock('../../../src/services/planService', () => mockPlanService);

// Mock other services
jest.mock('../../../src/services/metricsService', () => ({
  getDashboardMetrics: jest.fn(() => Promise.resolve({}))
}));

jest.mock('../../../src/services/authService', () => ({
  suspendUser: jest.fn(),
  unsuspendUser: jest.fn()
}));

jest.mock('../../../src/services/auditLogService', () => ({
  auditLogger: {
    logAdminPlanChange: jest.fn(() => Promise.resolve()),
    logAdminUserModification: jest.fn(() => Promise.resolve()),
    logEvent: jest.fn(() => Promise.resolve())
  }
}));

// Mock sub-routes
jest.mock('../../../src/routes/revenue', () => {
  const express = require('express');
  return express.Router();
});

jest.mock('../../../src/routes/admin/featureFlags', () => {
  const express = require('express');
  return express.Router();
});

jest.mock('../../../src/routes/admin/backofficeSettings', () => {
  const express = require('express');
  return express.Router();
});

jest.mock('../../../src/routes/admin/tones', () => {
  const express = require('express');
  return express.Router();
});

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

// ============================================================================
// STEP 2: Require modules AFTER mocks are configured
// ============================================================================

const request = require('supertest');
const express = require('express');
const adminRoutes = require('../../../src/routes/admin');
const { auditLogger } = require('../../../src/services/auditLogService');

describe('Admin Routes Extended - Issue #932', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // GET /api/admin/usage
  // ==========================================================================
  describe('GET /api/admin/usage', () => {
    test('should return usage statistics successfully', async () => {
      const mockUsageQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                range: jest.fn(() =>
                  Promise.resolve({
                    data: [
                      {
                        id: 'usage-1',
                        organization_id: 'org-1',
                        resource_type: 'roasts',
                        platform: 'twitter',
                        quantity: 10,
                        year: 2024,
                        month: 1,
                        organizations: { id: 'org-1', name: 'Test Org', plan_id: 'pro' }
                      }
                    ],
                    error: null,
                    count: 1
                  })
                )
              }))
            }))
          }))
        }))
      };

      const mockRpcQuery = Promise.resolve({
        data: [{ resource_type: 'roasts', total: 100 }],
        error: null
      });

      mockSupabase.from.mockReturnValue(mockUsageQuery);
      mockSupabase.rpc.mockReturnValue(mockRpcQuery);

      const response = await request(app)
        .get('/api/admin/usage?period=current_month&limit=50')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('usage_records');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('filters');
    });

    test('should handle database error', async () => {
      const mockErrorQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                range: jest.fn(() =>
                  Promise.resolve({
                    data: null,
                    error: { message: 'Database error' }
                  })
                )
              }))
            }))
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockErrorQuery);

      const response = await request(app).get('/api/admin/usage').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch usage statistics');
    });
  });

  // ==========================================================================
  // GET /api/admin/usage/organizations/:orgId
  // ==========================================================================
  describe('GET /api/admin/usage/organizations/:orgId', () => {
    test('should return organization usage successfully', async () => {
      const response = await request(app)
        .get('/api/admin/usage/organizations/org-123?months=3')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockCostControlService.getEnhancedUsageStats).toHaveBeenCalledWith('org-123', 3);
    });

    test('should handle error', async () => {
      mockCostControlService.getEnhancedUsageStats.mockRejectedValueOnce(
        new Error('Usage stats failed')
      );

      const response = await request(app)
        .get('/api/admin/usage/organizations/org-123')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch organization usage statistics');
    });
  });

  // ==========================================================================
  // POST /api/admin/usage/limits
  // ==========================================================================
  describe('POST /api/admin/usage/limits', () => {
    test('should set usage limits successfully', async () => {
      const limitData = {
        organization_id: 'org-123',
        resource_type: 'roasts',
        monthly_limit: 200,
        daily_limit: 20,
        allow_overage: false,
        hard_limit: true
      };

      const response = await request(app)
        .post('/api/admin/usage/limits')
        .send(limitData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Usage limit for roasts updated');
      expect(mockCostControlService.setUsageLimit).toHaveBeenCalled();
    });

    test('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/admin/usage/limits')
        .send({ organization_id: 'org-123' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('should handle error', async () => {
      mockCostControlService.setUsageLimit.mockRejectedValueOnce(new Error('Set limit failed'));

      const response = await request(app)
        .post('/api/admin/usage/limits')
        .send({
          organization_id: 'org-123',
          resource_type: 'roasts',
          monthly_limit: 200
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to set usage limit');
    });
  });

  // ==========================================================================
  // POST /api/admin/usage/reset
  // ==========================================================================
  describe('POST /api/admin/usage/reset', () => {
    test('should require confirmation', async () => {
      const response = await request(app)
        .post('/api/admin/usage/reset')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('requires confirmation');
    });

    test('should reset usage with confirmation', async () => {
      const response = await request(app)
        .post('/api/admin/usage/reset')
        .send({ confirm: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Monthly usage reset completed');
      expect(mockCostControlService.resetAllMonthlyUsage).toHaveBeenCalled();
    });

    test('should handle error', async () => {
      mockCostControlService.resetAllMonthlyUsage.mockRejectedValueOnce(
        new Error('Reset failed')
      );

      const response = await request(app)
        .post('/api/admin/usage/reset')
        .send({ confirm: true })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to reset monthly usage');
    });
  });

  // ==========================================================================
  // GET /api/admin/usage/export
  // ==========================================================================
  describe('GET /api/admin/usage/export', () => {
    test('should export usage as JSON', async () => {
      const mockExportQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() =>
                  Promise.resolve({
                    data: [
                      {
                        organization_id: 'org-1',
                        resource_type: 'roasts',
                        platform: 'twitter',
                        quantity: 10,
                        cost_cents: 100,
                        tokens_used: 500,
                        year: 2024,
                        month: 1,
                        day: 15,
                        created_at: '2024-01-15T00:00:00Z',
                        organizations: { name: 'Test Org', plan_id: 'pro' }
                      }
                    ],
                    error: null
                  })
                )
              }))
            }))
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockExportQuery);

      const response = await request(app)
        .get('/api/admin/usage/export?format=json')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('usage_records');
      expect(response.body.data).toHaveProperty('exported_at');
    });

    test('should export usage as CSV', async () => {
      const mockExportQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() =>
                  Promise.resolve({
                    data: [
                      {
                        organization_id: 'org-1',
                        resource_type: 'roasts',
                        platform: 'twitter',
                        quantity: 10,
                        cost_cents: 100,
                        tokens_used: 500,
                        year: 2024,
                        month: 1,
                        day: 15,
                        created_at: '2024-01-15T00:00:00Z',
                        organizations: { name: 'Test Org', plan_id: 'pro' }
                      }
                    ],
                    error: null
                  })
                )
              }))
            }))
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockExportQuery);

      const response = await request(app)
        .get('/api/admin/usage/export?format=csv')
        .expect(200);

      expect(response.header['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.header['content-disposition']).toMatch(/attachment; filename=/);
      expect(response.text).toContain('Organization,Plan,Resource Type');
    });
  });

  // ==========================================================================
  // GET /api/admin/alerts/history
  // ==========================================================================
  describe('GET /api/admin/alerts/history', () => {
    test('should return alert history successfully', async () => {
      const mockAlertsQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      id: 'alert-1',
                      organization_id: 'org-1',
                      level: 'warning',
                      category: 'usage_alert',
                      message: 'Usage threshold reached',
                      metadata: { alertType: 'warning', resourceType: 'roasts' },
                      created_at: '2024-01-15T00:00:00Z',
                      organizations: { name: 'Test Org', plan_id: 'pro' }
                    }
                  ],
                  error: null
                })
              )
            }))
          }))
        }))
      };

      const mockCountQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() =>
            Promise.resolve({
              count: 1,
              error: null
            })
          )
        }))
      };

      mockSupabase.from
        .mockReturnValueOnce(mockAlertsQuery)
        .mockReturnValueOnce(mockCountQuery);

      const response = await request(app)
        .get('/api/admin/alerts/history?limit=50')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('filters');
    });
  });

  // ==========================================================================
  // GET /api/admin/alerts/history/:orgId
  // ==========================================================================
  describe('GET /api/admin/alerts/history/:orgId', () => {
    test('should return organization alert history', async () => {
      const response = await request(app)
        .get('/api/admin/alerts/history/org-123?limit=50')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockCostControlService.getAlertHistory).toHaveBeenCalledWith(
        'org-123',
        expect.objectContaining({ limit: 50, offset: 0 })
      );
    });

    test('should handle error', async () => {
      mockCostControlService.getAlertHistory.mockRejectedValueOnce(
        new Error('Alert history failed')
      );

      const response = await request(app)
        .get('/api/admin/alerts/history/org-123')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch alert history');
    });
  });

  // ==========================================================================
  // GET /api/admin/alerts/stats/:orgId
  // ==========================================================================
  describe('GET /api/admin/alerts/stats/:orgId', () => {
    test('should return alert statistics', async () => {
      const response = await request(app)
        .get('/api/admin/alerts/stats/org-123?days=30')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockCostControlService.getAlertStats).toHaveBeenCalledWith('org-123', 30);
    });

    test('should handle error', async () => {
      mockCostControlService.getAlertStats.mockRejectedValueOnce(
        new Error('Alert stats failed')
      );

      const response = await request(app).get('/api/admin/alerts/stats/org-123').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch alert statistics');
    });
  });

  // ==========================================================================
  // GET /api/admin/plan-limits
  // ==========================================================================
  describe('GET /api/admin/plan-limits', () => {
    test('should return all plan limits', async () => {
      const response = await request(app).get('/api/admin/plan-limits').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('plans');
      expect(response.body.data).toHaveProperty('last_updated');
      expect(mockPlanLimitsService.getAllPlanLimits).toHaveBeenCalled();
    });

    test('should handle error', async () => {
      mockPlanLimitsService.getAllPlanLimits.mockRejectedValueOnce(
        new Error('Plan limits failed')
      );

      const response = await request(app).get('/api/admin/plan-limits').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch plan limits');
    });
  });

  // ==========================================================================
  // GET /api/admin/plan-limits/:planId
  // ==========================================================================
  describe('GET /api/admin/plan-limits/:planId', () => {
    test('should return specific plan limits', async () => {
      const response = await request(app).get('/api/admin/plan-limits/pro').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('planId', 'pro');
      expect(response.body.data).toHaveProperty('limits');
      expect(mockPlanLimitsService.getPlanLimits).toHaveBeenCalledWith('pro');
    });

    test('should handle error', async () => {
      mockPlanLimitsService.getPlanLimits.mockRejectedValueOnce(
        new Error('Plan limits failed')
      );

      const response = await request(app).get('/api/admin/plan-limits/pro').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch plan limits');
    });
  });

  // ==========================================================================
  // PUT /api/admin/plan-limits/:planId
  // ==========================================================================
  describe('PUT /api/admin/plan-limits/:planId', () => {
    test('should update plan limits successfully', async () => {
      const updates = {
        maxRoasts: 150,
        maxPlatforms: 5
      };

      const response = await request(app)
        .put('/api/admin/plan-limits/pro')
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('planId');
      expect(response.body.data).toHaveProperty('limits');
      expect(mockPlanLimitsService.updatePlanLimits).toHaveBeenCalled();
    });

    test('should reject invalid plan', async () => {
      const response = await request(app)
        .put('/api/admin/plan-limits/invalid_plan')
        .send({ maxRoasts: 100 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid plan ID');
    });

    test('should reject invalid fields', async () => {
      const response = await request(app)
        .put('/api/admin/plan-limits/pro')
        .send({ invalidField: 100 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid fields in update request');
    });

    test('should handle error', async () => {
      mockPlanLimitsService.updatePlanLimits.mockRejectedValueOnce(
        new Error('Update failed')
      );

      const response = await request(app)
        .put('/api/admin/plan-limits/pro')
        .send({ maxRoasts: 150 })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to update plan limits');
    });
  });

  // ==========================================================================
  // POST /api/admin/plan-limits/refresh-cache
  // ==========================================================================
  describe('POST /api/admin/plan-limits/refresh-cache', () => {
    test('should clear plan limits cache', async () => {
      const response = await request(app)
        .post('/api/admin/plan-limits/refresh-cache')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Plan limits cache cleared successfully');
      expect(mockPlanLimitsService.clearCache).toHaveBeenCalled();
    });

    test('should handle error', async () => {
      mockPlanLimitsService.clearCache.mockImplementationOnce(() => {
        throw new Error('Clear cache failed');
      });

      const response = await request(app)
        .post('/api/admin/plan-limits/refresh-cache')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to clear plan limits cache');
    });
  });

  // ==========================================================================
  // PUT /api/admin/backoffice/thresholds
  // ==========================================================================
  describe('PUT /api/admin/backoffice/thresholds', () => {
    test('should update shield thresholds successfully', async () => {
      const thresholds = {
        tau_roast_lower: 0.3,
        tau_shield: 0.6,
        tau_critical: 0.85,
        aggressiveness: 95
      };

      // Mock existing settings fetch
      const mockFetchQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { tau_roast_lower: 0.2, tau_shield: 0.5, tau_critical: 0.8, aggressiveness: 90 },
                error: null
              })
            )
          }))
        }))
      };

      // Mock update
      const mockUpdateQuery = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: thresholds,
                  error: null
                })
              )
            }))
          }))
        }))
      };

      mockSupabase.from
        .mockReturnValueOnce(mockFetchQuery)
        .mockReturnValueOnce(mockUpdateQuery);

      const response = await request(app)
        .put('/api/admin/backoffice/thresholds')
        .send(thresholds)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Thresholds updated successfully');
    });

    test('should reject invalid tau_roast_lower', async () => {
      const response = await request(app)
        .put('/api/admin/backoffice/thresholds')
        .send({ tau_roast_lower: 1.5, tau_shield: 0.6, tau_critical: 0.85, aggressiveness: 95 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('tau_roast_lower');
    });

    test('should reject invalid aggressiveness', async () => {
      const response = await request(app)
        .put('/api/admin/backoffice/thresholds')
        .send({ tau_roast_lower: 0.3, tau_shield: 0.6, tau_critical: 0.85, aggressiveness: 85 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('aggressiveness');
    });

    test('should reject invalid threshold hierarchy', async () => {
      const response = await request(app)
        .put('/api/admin/backoffice/thresholds')
        .send({ tau_roast_lower: 0.7, tau_shield: 0.6, tau_critical: 0.85, aggressiveness: 95 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('tau_roast_lower must be less than tau_shield');
    });
  });

  // ==========================================================================
  // GET /api/admin/plans
  // ==========================================================================
  describe('GET /api/admin/plans', () => {
    test('should return all plans with user counts', async () => {
      // Mock organizations query for user counts
      const mockOrgQuery = {
        select: jest.fn(() => ({
          not: jest.fn(() =>
            Promise.resolve({
              data: [
                { plan_id: 'free' },
                { plan_id: 'free' },
                { plan_id: 'pro' },
                { plan_id: 'creator_plus' }
              ],
              error: null
            })
          )
        }))
      };

      mockSupabase.from.mockReturnValue(mockOrgQuery);

      const response = await request(app).get('/api/admin/plans').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('plans');
      expect(response.body.data).toHaveProperty('totalUsers');
      expect(Array.isArray(response.body.data.plans)).toBe(true);
    });

    test('should handle error', async () => {
      mockPlanService.getAllPlans.mockImplementationOnce(() => {
        throw new Error('Plans failed');
      });

      const response = await request(app).get('/api/admin/plans').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch plans data');
    });
  });

  // ==========================================================================
  // PUT /api/admin/plans/:planId
  // ==========================================================================
  describe('PUT /api/admin/plans/:planId', () => {
    test('should update plan limits successfully', async () => {
      const updates = {
        maxRoasts: 150,
        maxPlatforms: 5
      };

      const response = await request(app)
        .put('/api/admin/plans/pro')
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Plan limits updated successfully');
      expect(mockPlanLimitsService.updatePlanLimits).toHaveBeenCalled();
      expect(auditLogger.logEvent).toHaveBeenCalledWith(
        'admin.plan_update',
        expect.objectContaining({ targetId: 'pro' })
      );
    });

    test('should reject editing custom plan', async () => {
      // Mock getPlanFeatures to return a valid plan for 'custom' so we reach the 403 check
      mockPlanService.getPlanFeatures.mockReturnValueOnce({
        name: 'Custom',
        price: 0,
        features: {}
      });

      const response = await request(app)
        .put('/api/admin/plans/custom')
        .send({ maxRoasts: 100 })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Custom plan cannot be edited');
    });

    test('should reject non-existent plan', async () => {
      mockPlanService.getPlanFeatures.mockReturnValueOnce(null);

      const response = await request(app)
        .put('/api/admin/plans/nonexistent')
        .send({ maxRoasts: 100 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Plan not found');
    });

    test('should reject invalid fields', async () => {
      const response = await request(app)
        .put('/api/admin/plans/pro')
        .send({ invalidField: 100 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No valid fields to update');
    });
  });

  // ==========================================================================
  // PATCH /api/admin/users/:userId/config
  // ==========================================================================
  describe('PATCH /api/admin/users/:userId/config', () => {
    test('should update user config successfully', async () => {
      const mockUpdateQuery = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: {
                    id: 'user-123',
                    email: 'user@test.com',
                    plan: 'pro',
                    tone: 'sarcastic',
                    shield_enabled: true
                  },
                  error: null
                })
              )
            }))
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockUpdateQuery);

      const response = await request(app)
        .patch('/api/admin/users/user-123/config')
        .send({
          plan: 'pro',
          tone: 'sarcastic',
          shieldEnabled: true,
          autoReplyEnabled: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('User configuration updated successfully');
    });

    test('should update persona fields', async () => {
      const mockUpdateQuery = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { id: 'user-123' },
                  error: null
                })
              )
            }))
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockUpdateQuery);

      const response = await request(app)
        .patch('/api/admin/users/user-123/config')
        .send({
          persona: {
            defines: 'funny',
            doesntTolerate: 'spam',
            doesntCare: 'politics'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle user not found', async () => {
      const mockUpdateQuery = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: null,
                  error: null
                })
              )
            }))
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockUpdateQuery);

      const response = await request(app)
        .patch('/api/admin/users/nonexistent/config')
        .send({ plan: 'pro' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });

  // ==========================================================================
  // POST /api/admin/users/:userId/reauth-integrations
  // ==========================================================================
  describe('POST /api/admin/users/:userId/reauth-integrations', () => {
    test('should invalidate integration tokens successfully', async () => {
      // Mock user check
      const mockUserQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { id: 'user-123', email: 'user@test.com' },
                error: null
              })
            )
          }))
        }))
      };

      // Mock token invalidation
      const mockTokenQuery = {
        update: jest.fn(() => ({
          eq: jest.fn(() =>
            Promise.resolve({
              data: null,
              error: null
            })
          )
        }))
      };

      // Mock integration status update
      const mockIntegrationQuery = {
        update: jest.fn(() => ({
          eq: jest.fn(() =>
            Promise.resolve({
              data: null,
              error: null
            })
          )
        }))
      };

      mockSupabase.from
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockTokenQuery)
        .mockReturnValueOnce(mockIntegrationQuery);

      const response = await request(app)
        .post('/api/admin/users/user-123/reauth-integrations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Integration tokens invalidated');
    });

    test('should handle user not found', async () => {
      const mockUserQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: 'Not found' }
              })
            )
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockUserQuery);

      const response = await request(app)
        .post('/api/admin/users/nonexistent/reauth-integrations')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });

  // ==========================================================================
  // GET /api/admin/users/:userId/activity
  // ==========================================================================
  describe('GET /api/admin/users/:userId/activity', () => {
    test('should return user activity successfully', async () => {
      // Mock user check
      const mockUserQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { id: 'user-123', email: 'user@test.com' },
                error: null
              })
            )
          }))
        }))
      };

      // Mock roasts query
      const mockRoastsQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      id: 'roast-1',
                      original_comment: 'Test comment',
                      roast_response: 'Test roast',
                      platform: 'twitter',
                      created_at: '2024-01-15T00:00:00Z'
                    }
                  ],
                  error: null
                })
              )
            }))
          }))
        }))
      };

      // Mock shield intercepts query
      const mockShieldQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() =>
                Promise.resolve({
                  data: [],
                  error: null
                })
              )
            }))
          }))
        }))
      };

      // Mock integrations query
      const mockIntegrationsQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() =>
            Promise.resolve({
              data: [
                {
                  platform: 'twitter',
                  status: 'connected',
                  handle: 'testuser'
                }
              ],
              error: null
            })
          )
        }))
      };

      mockSupabase.from
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockRoastsQuery)
        .mockReturnValueOnce(mockShieldQuery)
        .mockReturnValueOnce(mockIntegrationsQuery);

      const response = await request(app)
        .get('/api/admin/users/user-123/activity?limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('recent_roasts');
      expect(response.body.data).toHaveProperty('shield_intercepts');
      expect(response.body.data).toHaveProperty('integrations_status');
    });

    test('should handle user not found', async () => {
      const mockUserQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: 'Not found' }
              })
            )
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockUserQuery);

      const response = await request(app).get('/api/admin/users/nonexistent/activity').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });

  // ==========================================================================
  // POST /api/admin/csrf-test
  // ==========================================================================
  describe('POST /api/admin/csrf-test', () => {
    test('should validate CSRF token successfully', async () => {
      const response = await request(app).post('/api/admin/csrf-test').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('CSRF validation passed');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});

