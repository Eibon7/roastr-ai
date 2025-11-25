/**
 * Tests for Revenue Dashboard Routes - Issue #932
 *
 * Provides test coverage for:
 * - GET /api/admin/revenue/overview - Revenue overview with MRR
 * - GET /api/admin/revenue/churn - Churn rate and retention metrics
 * - GET /api/admin/revenue/trends - Revenue trends over time
 */

const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls
// ============================================================================

const mockSupabase = createSupabaseMock({
  users: [],
  user_subscriptions: []
});

// Track current user for requireAdmin middleware
// Note: Must use 'mock' prefix for Jest to allow variable access in jest.mock()
let mockCurrentUser = {
  id: 'user-123',
  email: 'test@example.com',
  is_admin: false
};

// Mock Stripe
const mockStripe = {
  customers: {
    list: jest.fn(() =>
      Promise.resolve({
        data: [
          { id: 'cus_1', email: 'customer1@test.com' },
          { id: 'cus_2', email: 'customer2@test.com' }
        ]
      })
    )
  },
  subscriptions: {
    list: jest.fn(() =>
      Promise.resolve({
        data: [
          { id: 'sub_1', status: 'active' },
          { id: 'sub_2', status: 'active' }
        ]
      })
    )
  }
};

// Mock Stripe constructor
jest.mock('stripe', () => {
  return jest.fn(() => mockStripe);
});

// Mock supabase
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

// Mock authentication middleware
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = mockCurrentUser;
    next();
  }
}));

// Mock flags
jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn((flag) => flag === 'ENABLE_BILLING')
  }
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

// ============================================================================
// STEP 2: Require modules AFTER mocks are configured
// ============================================================================

const request = require('supertest');
const express = require('express');
const revenueRoutes = require('../../../src/routes/revenue');

describe('Revenue Dashboard Routes - Issue #932', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin/revenue', revenueRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset to admin user by default
    mockCurrentUser = {
      id: 'admin-123',
      email: 'admin@example.com',
      is_admin: true
    };
  });

  // ==========================================================================
  // Authorization Tests
  // ==========================================================================
  describe('Authorization', () => {
    test('should deny non-admin users for overview', async () => {
      mockCurrentUser = {
        id: 'user-123',
        email: 'user@example.com',
        is_admin: false
      };

      // Mock the admin check query
      const mockQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { is_admin: false },
                error: null
              })
            )
          }))
        }))
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const response = await request(app).get('/api/admin/revenue/overview').expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });

    test('should deny non-admin users for churn', async () => {
      mockCurrentUser = {
        id: 'user-123',
        email: 'user@example.com',
        is_admin: false
      };

      // Mock the admin check query
      const mockQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { is_admin: false },
                error: null
              })
            )
          }))
        }))
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const response = await request(app).get('/api/admin/revenue/churn').expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });

    test('should deny non-admin users for trends', async () => {
      mockCurrentUser = {
        id: 'user-123',
        email: 'user@example.com',
        is_admin: false
      };

      // Mock the admin check query
      const mockQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { is_admin: false },
                error: null
              })
            )
          }))
        }))
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const response = await request(app).get('/api/admin/revenue/trends').expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });
  });

  // ==========================================================================
  // GET /api/admin/revenue/overview
  // ==========================================================================
  describe('GET /api/admin/revenue/overview', () => {
    const setupAdminMock = () => {
      // Mock admin check - first query
      const mockAdminQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { is_admin: true },
                error: null
              })
            )
          }))
        }))
      };

      return mockAdminQuery;
    };

    const setupSubscriptionMocks = () => {
      // Mock current subscriptions query
      const mockCurrentSubsQuery = {
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: [
                  { plan: 'pro', status: 'active', created_at: new Date().toISOString() },
                  { plan: 'creator_plus', status: 'active', created_at: new Date().toISOString() }
                ],
                error: null
              })
            )
          }))
        }))
      };

      // Mock previous subscriptions query
      const mockPreviousSubsQuery = {
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            lt: jest.fn(() => ({
              neq: jest.fn(() =>
                Promise.resolve({
                  data: [{ plan: 'pro', status: 'active', created_at: new Date().toISOString() }],
                  error: null
                })
              )
            }))
          }))
        }))
      };

      // Mock active subscriptions query
      const mockActiveSubsQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: [
                  { plan: 'pro', status: 'active' },
                  { plan: 'pro', status: 'active' },
                  { plan: 'creator_plus', status: 'active' }
                ],
                error: null
              })
            )
          }))
        }))
      };

      return { mockCurrentSubsQuery, mockPreviousSubsQuery, mockActiveSubsQuery };
    };

    test('should return revenue overview successfully', async () => {
      const mockAdminQuery = setupAdminMock();
      const { mockCurrentSubsQuery, mockPreviousSubsQuery, mockActiveSubsQuery } =
        setupSubscriptionMocks();

      mockSupabase.from
        .mockReturnValueOnce(mockAdminQuery) // Admin check
        .mockReturnValueOnce(mockCurrentSubsQuery) // Current period subs
        .mockReturnValueOnce(mockPreviousSubsQuery) // Previous period subs
        .mockReturnValueOnce(mockActiveSubsQuery); // Active subs for MRR

      const response = await request(app).get('/api/admin/revenue/overview?period=30').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('mrr');
      expect(response.body.data).toHaveProperty('customers');
      expect(response.body.data).toHaveProperty('revenue');
      expect(response.body.data).toHaveProperty('planDistribution');
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data.mrr).toHaveProperty('current');
      expect(response.body.data.mrr).toHaveProperty('currency', 'EUR');
    });

    test('should calculate MRR correctly', async () => {
      const mockAdminQuery = setupAdminMock();

      // Mock with specific subscription data for MRR calculation
      // 2 pro (€20 each) + 1 creator_plus (€50) = €90 MRR
      const mockCurrentSubsQuery = {
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: [
                  { plan: 'pro', status: 'active', created_at: new Date().toISOString() },
                  { plan: 'pro', status: 'active', created_at: new Date().toISOString() },
                  { plan: 'creator_plus', status: 'active', created_at: new Date().toISOString() }
                ],
                error: null
              })
            )
          }))
        }))
      };

      const mockPreviousSubsQuery = {
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            lt: jest.fn(() => ({
              neq: jest.fn(() =>
                Promise.resolve({
                  data: [],
                  error: null
                })
              )
            }))
          }))
        }))
      };

      const mockActiveSubsQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: [
                  { plan: 'pro', status: 'active' },
                  { plan: 'pro', status: 'active' },
                  { plan: 'creator_plus', status: 'active' }
                ],
                error: null
              })
            )
          }))
        }))
      };

      mockSupabase.from
        .mockReturnValueOnce(mockAdminQuery)
        .mockReturnValueOnce(mockCurrentSubsQuery)
        .mockReturnValueOnce(mockPreviousSubsQuery)
        .mockReturnValueOnce(mockActiveSubsQuery);

      const response = await request(app).get('/api/admin/revenue/overview').expect(200);

      expect(response.body.success).toBe(true);
      // 2 * €20 + 1 * €50 = €90
      expect(response.body.data.mrr.current).toBe(90);
    });

    test('should include Stripe metrics when available', async () => {
      const mockAdminQuery = setupAdminMock();
      const { mockCurrentSubsQuery, mockPreviousSubsQuery, mockActiveSubsQuery } =
        setupSubscriptionMocks();

      mockSupabase.from
        .mockReturnValueOnce(mockAdminQuery)
        .mockReturnValueOnce(mockCurrentSubsQuery)
        .mockReturnValueOnce(mockPreviousSubsQuery)
        .mockReturnValueOnce(mockActiveSubsQuery);

      const response = await request(app).get('/api/admin/revenue/overview').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('stripe');
      expect(response.body.data.stripe).toHaveProperty('totalCustomers');
      expect(response.body.data.stripe).toHaveProperty('activeSubscriptions');
    });

    test('should handle database error gracefully', async () => {
      const mockAdminQuery = setupAdminMock();

      const mockErrorQuery = {
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: 'Database error' }
              })
            )
          }))
        }))
      };

      mockSupabase.from.mockReturnValueOnce(mockAdminQuery).mockReturnValueOnce(mockErrorQuery);

      const response = await request(app).get('/api/admin/revenue/overview').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch revenue overview');
    });

    test('should handle custom period parameter', async () => {
      const mockAdminQuery = setupAdminMock();
      const { mockCurrentSubsQuery, mockPreviousSubsQuery, mockActiveSubsQuery } =
        setupSubscriptionMocks();

      mockSupabase.from
        .mockReturnValueOnce(mockAdminQuery)
        .mockReturnValueOnce(mockCurrentSubsQuery)
        .mockReturnValueOnce(mockPreviousSubsQuery)
        .mockReturnValueOnce(mockActiveSubsQuery);

      const response = await request(app).get('/api/admin/revenue/overview?period=60').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period.days).toBe(60);
    });
  });

  // ==========================================================================
  // GET /api/admin/revenue/churn
  // ==========================================================================
  describe('GET /api/admin/revenue/churn', () => {
    const setupAdminMock = () => {
      const mockAdminQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { is_admin: true },
                error: null
              })
            )
          }))
        }))
      };
      return mockAdminQuery;
    };

    test('should return churn metrics successfully', async () => {
      const mockAdminQuery = setupAdminMock();

      // Mock cohort subscriptions
      const mockCohortQuery = {
        select: jest.fn(() => ({
          lt: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: [
                  {
                    user_id: 'user-1',
                    plan: 'pro',
                    status: 'active',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z'
                  },
                  {
                    user_id: 'user-2',
                    plan: 'pro',
                    status: 'active',
                    created_at: '2024-01-15T00:00:00Z',
                    updated_at: '2024-01-15T00:00:00Z'
                  },
                  {
                    user_id: 'user-3',
                    plan: 'creator_plus',
                    status: 'canceled',
                    created_at: '2024-01-20T00:00:00Z',
                    updated_at: '2024-02-01T00:00:00Z'
                  }
                ],
                error: null
              })
            )
          }))
        }))
      };

      // Mock canceled subscriptions
      const mockCanceledQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              neq: jest.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      user_id: 'user-3',
                      plan: 'creator_plus',
                      status: 'canceled',
                      created_at: '2024-01-20T00:00:00Z',
                      updated_at: '2024-02-01T00:00:00Z'
                    }
                  ],
                  error: null
                })
              )
            }))
          }))
        }))
      };

      mockSupabase.from
        .mockReturnValueOnce(mockAdminQuery)
        .mockReturnValueOnce(mockCohortQuery)
        .mockReturnValueOnce(mockCanceledQuery);

      const response = await request(app).get('/api/admin/revenue/churn?period=30').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('churnRate');
      expect(response.body.data).toHaveProperty('retentionRate');
      expect(response.body.data).toHaveProperty('churned');
      expect(response.body.data).toHaveProperty('cohort');
      expect(response.body.data).toHaveProperty('avgCustomerLifetime');
      expect(response.body.data).toHaveProperty('cohortAnalysis');
      expect(response.body.data).toHaveProperty('period');
    });

    test('should calculate churn rate correctly', async () => {
      const mockAdminQuery = setupAdminMock();

      // 10 users in cohort, 2 churned = 20% churn rate
      const mockCohortQuery = {
        select: jest.fn(() => ({
          lt: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: Array(10)
                  .fill(null)
                  .map((_, i) => ({
                    user_id: `user-${i}`,
                    plan: 'pro',
                    status: i < 8 ? 'active' : 'canceled',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z'
                  })),
                error: null
              })
            )
          }))
        }))
      };

      const mockCanceledQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              neq: jest.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      user_id: 'user-8',
                      plan: 'pro',
                      status: 'canceled',
                      created_at: '2024-01-01T00:00:00Z',
                      updated_at: '2024-02-01T00:00:00Z'
                    },
                    {
                      user_id: 'user-9',
                      plan: 'pro',
                      status: 'canceled',
                      created_at: '2024-01-01T00:00:00Z',
                      updated_at: '2024-02-01T00:00:00Z'
                    }
                  ],
                  error: null
                })
              )
            }))
          }))
        }))
      };

      mockSupabase.from
        .mockReturnValueOnce(mockAdminQuery)
        .mockReturnValueOnce(mockCohortQuery)
        .mockReturnValueOnce(mockCanceledQuery);

      const response = await request(app).get('/api/admin/revenue/churn').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.churnRate).toBe(20); // 2/10 = 20%
      expect(response.body.data.retentionRate).toBe(80); // 8/10 = 80%
      expect(response.body.data.churned.total).toBe(2);
      expect(response.body.data.cohort.size).toBe(10);
      expect(response.body.data.cohort.retained).toBe(8);
    });

    test('should group churn by plan', async () => {
      const mockAdminQuery = setupAdminMock();

      const mockCohortQuery = {
        select: jest.fn(() => ({
          lt: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: [
                  {
                    user_id: 'user-1',
                    plan: 'pro',
                    status: 'active',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z'
                  },
                  {
                    user_id: 'user-2',
                    plan: 'creator_plus',
                    status: 'canceled',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-02-01T00:00:00Z'
                  }
                ],
                error: null
              })
            )
          }))
        }))
      };

      const mockCanceledQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              neq: jest.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      user_id: 'user-2',
                      plan: 'creator_plus',
                      status: 'canceled',
                      created_at: '2024-01-01T00:00:00Z',
                      updated_at: '2024-02-01T00:00:00Z'
                    }
                  ],
                  error: null
                })
              )
            }))
          }))
        }))
      };

      mockSupabase.from
        .mockReturnValueOnce(mockAdminQuery)
        .mockReturnValueOnce(mockCohortQuery)
        .mockReturnValueOnce(mockCanceledQuery);

      const response = await request(app).get('/api/admin/revenue/churn').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.churned.byPlan).toHaveProperty('creator_plus', 1);
    });

    test('should handle database error gracefully', async () => {
      const mockAdminQuery = setupAdminMock();

      const mockErrorQuery = {
        select: jest.fn(() => ({
          lt: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: 'Database error' }
              })
            )
          }))
        }))
      };

      mockSupabase.from.mockReturnValueOnce(mockAdminQuery).mockReturnValueOnce(mockErrorQuery);

      const response = await request(app).get('/api/admin/revenue/churn').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch churn metrics');
    });
  });

  // ==========================================================================
  // GET /api/admin/revenue/trends
  // ==========================================================================
  describe('GET /api/admin/revenue/trends', () => {
    const setupAdminMock = () => {
      const mockAdminQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { is_admin: true },
                error: null
              })
            )
          }))
        }))
      };
      return mockAdminQuery;
    };

    test('should return revenue trends successfully', async () => {
      const mockAdminQuery = setupAdminMock();

      const mockTrendsQuery = {
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: [
                  {
                    plan: 'pro',
                    status: 'active',
                    created_at: '2024-01-15T00:00:00Z',
                    updated_at: '2024-01-15T00:00:00Z'
                  },
                  {
                    plan: 'pro',
                    status: 'active',
                    created_at: '2024-01-16T00:00:00Z',
                    updated_at: '2024-01-16T00:00:00Z'
                  },
                  {
                    plan: 'creator_plus',
                    status: 'active',
                    created_at: '2024-01-17T00:00:00Z',
                    updated_at: '2024-01-17T00:00:00Z'
                  },
                  {
                    plan: 'pro',
                    status: 'canceled',
                    created_at: '2024-01-18T00:00:00Z',
                    updated_at: '2024-01-20T00:00:00Z'
                  }
                ],
                error: null
              })
            )
          }))
        }))
      };

      mockSupabase.from.mockReturnValueOnce(mockAdminQuery).mockReturnValueOnce(mockTrendsQuery);

      const response = await request(app)
        .get('/api/admin/revenue/trends?period=90&granularity=week')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('trends');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('period');
      expect(Array.isArray(response.body.data.trends)).toBe(true);
      expect(response.body.data.summary).toHaveProperty('totalRevenue');
      expect(response.body.data.summary).toHaveProperty('totalNewSubs');
      expect(response.body.data.summary).toHaveProperty('totalChurn');
      expect(response.body.data.summary).toHaveProperty('netGrowth');
    });

    test('should calculate revenue by date correctly', async () => {
      const mockAdminQuery = setupAdminMock();

      // 2 pro subs on same day = €40, 1 creator_plus = €50
      const mockTrendsQuery = {
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: [
                  {
                    plan: 'pro',
                    status: 'active',
                    created_at: '2024-01-15T00:00:00Z',
                    updated_at: '2024-01-15T00:00:00Z'
                  },
                  {
                    plan: 'pro',
                    status: 'active',
                    created_at: '2024-01-15T00:00:00Z',
                    updated_at: '2024-01-15T00:00:00Z'
                  },
                  {
                    plan: 'creator_plus',
                    status: 'active',
                    created_at: '2024-01-16T00:00:00Z',
                    updated_at: '2024-01-16T00:00:00Z'
                  }
                ],
                error: null
              })
            )
          }))
        }))
      };

      mockSupabase.from.mockReturnValueOnce(mockAdminQuery).mockReturnValueOnce(mockTrendsQuery);

      const response = await request(app).get('/api/admin/revenue/trends').expect(200);

      expect(response.body.success).toBe(true);
      // Total: 2*€20 + 1*€50 = €90
      expect(response.body.data.summary.totalRevenue).toBe(90);
      expect(response.body.data.summary.totalNewSubs).toBe(3);
    });

    test('should track net growth (subs - churn)', async () => {
      const mockAdminQuery = setupAdminMock();

      const mockTrendsQuery = {
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: [
                  {
                    plan: 'pro',
                    status: 'active',
                    created_at: '2024-01-15T00:00:00Z',
                    updated_at: '2024-01-15T00:00:00Z'
                  },
                  {
                    plan: 'pro',
                    status: 'active',
                    created_at: '2024-01-15T00:00:00Z',
                    updated_at: '2024-01-15T00:00:00Z'
                  },
                  {
                    plan: 'pro',
                    status: 'active',
                    created_at: '2024-01-16T00:00:00Z',
                    updated_at: '2024-01-16T00:00:00Z'
                  },
                  {
                    plan: 'pro',
                    status: 'canceled',
                    created_at: '2024-01-16T00:00:00Z',
                    updated_at: '2024-01-20T00:00:00Z'
                  }
                ],
                error: null
              })
            )
          }))
        }))
      };

      mockSupabase.from.mockReturnValueOnce(mockAdminQuery).mockReturnValueOnce(mockTrendsQuery);

      const response = await request(app).get('/api/admin/revenue/trends').expect(200);

      expect(response.body.success).toBe(true);
      // 4 new subs - 1 churn = 3 net growth
      expect(response.body.data.summary.totalNewSubs).toBe(4);
      expect(response.body.data.summary.totalChurn).toBe(1);
      expect(response.body.data.summary.netGrowth).toBe(3);
    });

    test('should handle different granularities', async () => {
      const mockAdminQuery = setupAdminMock();

      const mockTrendsQuery = {
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: [
                  {
                    plan: 'pro',
                    status: 'active',
                    created_at: '2024-01-15T00:00:00Z',
                    updated_at: '2024-01-15T00:00:00Z'
                  }
                ],
                error: null
              })
            )
          }))
        }))
      };

      mockSupabase.from.mockReturnValueOnce(mockAdminQuery).mockReturnValueOnce(mockTrendsQuery);

      const response = await request(app)
        .get('/api/admin/revenue/trends?granularity=day')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period.granularity).toBe('day');
    });

    test('should handle database error gracefully', async () => {
      const mockAdminQuery = setupAdminMock();

      const mockErrorQuery = {
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: 'Database error' }
              })
            )
          }))
        }))
      };

      mockSupabase.from.mockReturnValueOnce(mockAdminQuery).mockReturnValueOnce(mockErrorQuery);

      const response = await request(app).get('/api/admin/revenue/trends').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch revenue trends');
    });

    test('should handle empty trends data', async () => {
      const mockAdminQuery = setupAdminMock();

      const mockEmptyQuery = {
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            neq: jest.fn(() =>
              Promise.resolve({
                data: [],
                error: null
              })
            )
          }))
        }))
      };

      mockSupabase.from.mockReturnValueOnce(mockAdminQuery).mockReturnValueOnce(mockEmptyQuery);

      const response = await request(app).get('/api/admin/revenue/trends').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trends).toHaveLength(0);
      expect(response.body.data.summary.totalRevenue).toBe(0);
      expect(response.body.data.summary.totalNewSubs).toBe(0);
      expect(response.body.data.summary.netGrowth).toBe(0);
    });
  });
});
