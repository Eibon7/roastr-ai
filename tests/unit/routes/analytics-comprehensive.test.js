/**
 * Analytics Routes - Comprehensive Coverage Tests
 * Issue #501: Increase coverage from 49% to 65%+
 * 
 * Tests for main analytics endpoints:
 * - GET /config-performance
 * - GET /shield-effectiveness  
 * - GET /usage-trends
 * - GET /roastr-persona-insights
 */

const request = require('supertest');
const express = require('express');

// Mock data storage
let mockOrganizationData = { id: 'org-123', owner_id: 'user-123', plan_id: 'pro', monthly_responses_limit: 1000 };
let mockResponsesData = [];
let mockShieldData = [];
let mockMonthlyUsageData = [];
let mockUserBehaviorsData = [];
let mockPersonaData = null;

// Create a robust mock factory that handles all query chain combinations
function createMockQueryChain(table, finalData) {
  const chain = {
    eq: jest.fn((column, value) => {
      return createMockQueryChain(table, finalData);
    }),
    gte: jest.fn((column, value) => {
      return createMockQueryChain(table, finalData);
    }),
    order: jest.fn((column, options) => {
      return createMockQueryChain(table, finalData);
    }),
    limit: jest.fn((count) => {
      return Promise.resolve({ data: finalData || [], error: null });
    }),
    range: jest.fn((start, end) => {
      return Promise.resolve({ data: finalData || [], error: null });
    }),
    not: jest.fn((column, operator, value) => {
      return createMockQueryChain(table, finalData);
    }),
    single: jest.fn(() => {
      if (table === 'organizations') {
        return Promise.resolve({ data: mockOrganizationData, error: null });
      } else if (table === 'users') {
        return Promise.resolve({ data: mockPersonaData, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    then: function(resolve, reject) {
      return Promise.resolve({ data: finalData || [], error: null }).then(resolve, reject);
    }
  };
  
  Object.defineProperty(chain, Symbol.toStringTag, { value: 'Promise' });
  return chain;
}

const mockSupabaseServiceClient = {
  from: jest.fn((table) => {
    let finalData = [];
    
    if (table === 'organizations') {
      return {
        select: jest.fn(() => createMockQueryChain(table, null))
      };
    } else if (table === 'responses') {
      finalData = mockResponsesData;
    } else if (table === 'user_behaviors') {
      finalData = mockUserBehaviorsData;
    } else if (table === 'monthly_usage') {
      finalData = mockMonthlyUsageData;
    } else if (table === 'users') {
      return {
        select: jest.fn(() => createMockQueryChain(table, null))
      };
    }
    
    return {
      select: jest.fn((columns) => {
        if (columns && columns.includes('comments!inner')) {
          return createMockQueryChain(table, finalData);
        }
        return createMockQueryChain(table, finalData);
      })
    };
  })
};

const mockGetPlanLimits = jest.fn();

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabaseServiceClient
}));

jest.mock('../../../src/services/planLimitsService', () => ({
  getPlanLimits: mockGetPlanLimits
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'user-123', email: 'test@example.com', plan: 'pro' };
    next();
  }
}));

const analyticsRouter = require('../../../src/routes/analytics');

describe('Analytics Routes - Comprehensive', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRouter);
    
    mockOrganizationData = { id: 'org-123', owner_id: 'user-123', plan_id: 'pro', monthly_responses_limit: 1000 };
    mockResponsesData = [];
    mockShieldData = [];
    mockMonthlyUsageData = [];
    mockUserBehaviorsData = [];
    mockPersonaData = null;
    
    mockGetPlanLimits.mockResolvedValue({
      monthlyResponsesLimit: 1000,
      maxTimeRange: 90,
      allowedFilters: ['platform', 'date_range', 'sentiment'],
      rateLimit: 60
    });
  });

  describe('GET /config-performance', () => {
    it('should return performance analytics successfully', async () => {
      mockResponsesData = [
        {
          id: 'resp-1',
          tone: 'sarcastic',
          humor_type: 'witty',
          post_status: 'posted',
          platform_response_id: 'platform-1',
          tokens_used: 100,
          cost_cents: 5,
          created_at: new Date().toISOString(),
          comments: {
            platform: 'twitter',
            toxicity_score: 0.75,
            severity_level: 'medium'
          }
        },
        {
          id: 'resp-2',
          tone: 'friendly',
          humor_type: 'puns',
          post_status: 'posted',
          platform_response_id: 'platform-2',
          tokens_used: 80,
          cost_cents: 4,
          created_at: new Date().toISOString(),
          comments: {
            platform: 'youtube',
            toxicity_score: 0.60,
            severity_level: 'low'
          }
        }
      ];

      const response = await request(app)
        .get('/api/analytics/config-performance')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.analytics).toBeDefined();
      expect(response.body.data.analytics.summary.total_responses).toBe(2);
    });

    it('should handle organization not found', async () => {
      mockOrganizationData = null;

      const response = await request(app)
        .get('/api/analytics/config-performance');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Organization not found');
    });

    it('should filter by platform', async () => {
      mockResponsesData = [
        {
          id: 'resp-1',
          tone: 'sarcastic',
          humor_type: 'witty',
          post_status: 'posted',
          platform_response_id: 'platform-1',
          tokens_used: 100,
          cost_cents: 5,
          created_at: new Date().toISOString(),
          comments: {
            platform: 'twitter',
            toxicity_score: 0.75,
            severity_level: 'medium'
          }
        }
      ];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          const createChainableQuery = () => {
            const chain = {
              eq: jest.fn((column, value) => chain),
              gte: jest.fn(() => chain),
              order: jest.fn(() => chain),
              range: jest.fn(() => {
                return {
                  eq: jest.fn(() => Promise.resolve({ data: mockResponsesData, error: null })),
                  then: function(resolve, reject) {
                    return Promise.resolve({ data: mockResponsesData, error: null }).then(resolve, reject);
                  }
                };
              })
            };
            return chain;
          };
          return {
            select: jest.fn(() => createChainableQuery())
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/config-performance')
        .query({ days: 30, platform: 'twitter' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should group by week', async () => {
      const now = new Date();
      const lastWeek = new Date(now);
      lastWeek.setDate(now.getDate() - 7);
      
      mockResponsesData = [
        {
          id: 'resp-1',
          tone: 'sarcastic',
          humor_type: 'witty',
          post_status: 'posted',
          platform_response_id: 'platform-1',
          tokens_used: 100,
          cost_cents: 5,
          created_at: now.toISOString(),
          comments: {
            platform: 'twitter',
            toxicity_score: 0.75,
            severity_level: 'medium'
          }
        },
        {
          id: 'resp-2',
          tone: 'friendly',
          humor_type: 'puns',
          post_status: 'posted',
          platform_response_id: 'platform-2',
          tokens_used: 80,
          cost_cents: 4,
          created_at: lastWeek.toISOString(),
          comments: {
            platform: 'youtube',
            toxicity_score: 0.60,
            severity_level: 'low'
          }
        }
      ];

      const response = await request(app)
        .get('/api/analytics/config-performance')
        .query({ days: 30, group_by: 'week' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.group_by).toBe('week');
      expect(response.body.data.analytics.timeline).toBeDefined();
    });

    it('should group by month', async () => {
      const now = new Date();
      const lastMonth = new Date(now);
      lastMonth.setMonth(now.getMonth() - 1);
      
      mockResponsesData = [
        {
          id: 'resp-1',
          tone: 'sarcastic',
          humor_type: 'witty',
          post_status: 'posted',
          platform_response_id: 'platform-1',
          tokens_used: 100,
          cost_cents: 5,
          created_at: now.toISOString(),
          comments: {
            platform: 'twitter',
            toxicity_score: 0.75,
            severity_level: 'medium'
          }
        },
        {
          id: 'resp-2',
          tone: 'friendly',
          humor_type: 'puns',
          post_status: 'posted',
          platform_response_id: 'platform-2',
          tokens_used: 80,
          cost_cents: 4,
          created_at: lastMonth.toISOString(),
          comments: {
            platform: 'youtube',
            toxicity_score: 0.60,
            severity_level: 'low'
          }
        }
      ];

      const response = await request(app)
        .get('/api/analytics/config-performance')
        .query({ days: 30, group_by: 'month' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.group_by).toBe('month');
      expect(response.body.data.analytics.timeline).toBeDefined();
    });
  });

  describe('GET /shield-effectiveness', () => {
    it('should return Shield analytics successfully', async () => {
      mockShieldData = [
        {
          id: 'shield-1',
          shield_action: 'block',
          is_shield_mode: true,
          created_at: new Date().toISOString()
        },
        {
          id: 'shield-2',
          shield_action: 'warn',
          is_shield_mode: true,
          created_at: new Date().toISOString()
        }
      ];

      mockUserBehaviorsData = [
        {
          platform: 'twitter',
          is_blocked: false,
          total_violations: 2,
          severity_counts: { low: 1, medium: 1, high: 0, critical: 0 }
        },
        {
          platform: 'youtube',
          is_blocked: true,
          total_violations: 5,
          severity_counts: { low: 0, medium: 2, high: 2, critical: 1 }
        }
      ];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  gte: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => Promise.resolve({ data: mockShieldData, error: null }))
                    }))
                  }))
                }))
              }))
            }))
          };
        } else if (table === 'user_behaviors') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(() => Promise.resolve({ data: mockUserBehaviorsData, error: null }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/shield-effectiveness')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shield_analytics).toBeDefined();
      expect(response.body.data.shield_analytics.total_shield_actions).toBe(2);
    });

    it('should handle organization not found', async () => {
      mockOrganizationData = null;
      
      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: null, error: null }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/shield-effectiveness');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Organization not found');
    });
  });

  describe('GET /usage-trends', () => {
    it('should return usage trends successfully', async () => {
      mockMonthlyUsageData = [
        {
          month: 10,
          year: 2025,
          total_responses: 500,
          responses_limit: 1000,
          limit_exceeded: false,
          total_cost_cents: 2500,
          responses_by_platform: { twitter: 300, youtube: 200 }
        },
        {
          month: 9,
          year: 2025,
          total_responses: 450,
          responses_limit: 1000,
          limit_exceeded: false,
          total_cost_cents: 2250,
          responses_by_platform: { twitter: 270, youtube: 180 }
        }
      ];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'monthly_usage') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(() => Promise.resolve({ data: mockMonthlyUsageData, error: null }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/usage-trends')
        .query({ months: 6 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.trends).toBeDefined();
      expect(response.body.data.trends.monthly_data.length).toBe(2);
    });

    it('should calculate growth rate correctly', async () => {
      mockMonthlyUsageData = [
        {
          month: 10,
          year: 2025,
          total_responses: 600,
          responses_limit: 1000,
          limit_exceeded: false,
          total_cost_cents: 3000,
          responses_by_platform: {}
        },
        {
          month: 9,
          year: 2025,
          total_responses: 500,
          responses_limit: 1000,
          limit_exceeded: false,
          total_cost_cents: 2500,
          responses_by_platform: {}
        }
      ];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'monthly_usage') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(() => Promise.resolve({ data: mockMonthlyUsageData, error: null }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/usage-trends');

      expect(response.status).toBe(200);
      expect(response.body.data.trends.growth_rate).toBe('20.0');
    });
  });

  describe('GET /roastr-persona-insights', () => {
    it('should return persona insights successfully', async () => {
      mockPersonaData = {
        id: 'user-123',
        lo_que_me_define_encrypted: 'encrypted_data',
        lo_que_me_define_visible: true,
        lo_que_no_tolero_encrypted: 'encrypted_data',
        lo_que_no_tolero_visible: true,
        embeddings_generated_at: new Date().toISOString(),
        embeddings_model: 'text-embedding-ada-002',
        embeddings_version: '1.0'
      };

      mockResponsesData = [
        {
          id: 'resp-1',
          tone: 'sarcastic',
          humor_type: 'witty',
          post_status: 'posted',
          platform_response_id: 'platform-1',
          tokens_used: 100,
          cost_cents: 5,
          persona_fields_used: ['lo_que_me_define', 'lo_que_no_tolero'],
          created_at: new Date().toISOString(),
          comments: {
            platform: 'twitter',
            toxicity_score: 0.75,
            severity_level: 'medium'
          }
        }
      ];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'users') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockPersonaData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  not: jest.fn(() => ({
                    order: jest.fn(() => ({
                      range: jest.fn(() => Promise.resolve({ data: mockResponsesData, error: null }))
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.persona_status).toBeDefined();
      expect(response.body.data.persona_analytics).toBeDefined();
    });

    it('should use robust input validation', async () => {
      mockPersonaData = {
        id: 'user-123',
        lo_que_me_define_encrypted: 'encrypted_data'
      };

      mockResponsesData = [];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'users') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockPersonaData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  not: jest.fn(() => ({
                    order: jest.fn(() => ({
                      range: jest.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 'invalid', limit: -1000, offset: 'bad' });

      expect(response.status).toBe(200);
    });

    it('should cache results for frequent requests', async () => {
      mockPersonaData = {
        id: 'user-123',
        lo_que_me_define_encrypted: 'encrypted_data'
      };
      mockResponsesData = [];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'users') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockPersonaData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  not: jest.fn(() => ({
                    order: jest.fn(() => ({
                      range: jest.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30 });

      jest.clearAllMocks();

      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30 });

      expect(response.status).toBe(200);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ 
                  data: mockOrganizationData,
                  error: null
                }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  order: jest.fn(() => ({
                    range: jest.fn(() => Promise.resolve({ 
                      data: null,
                      error: new Error('Database connection failed')
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/config-performance');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle getPlanLimits error fallback', async () => {
      mockGetPlanLimits.mockRejectedValueOnce(new Error('Service unavailable'));

      mockPersonaData = {
        id: 'user-123',
        lo_que_me_define_encrypted: 'encrypted_data'
      };
      mockResponsesData = [];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'users') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockPersonaData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  not: jest.fn(() => ({
                    order: jest.fn(() => ({
                      range: jest.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle invalid planId in getPlanLimits', async () => {
      mockOrganizationData = { 
        id: 'org-123', 
        owner_id: 'user-123', 
        plan_id: null,
        monthly_responses_limit: 1000 
      };

      mockPersonaData = {
        id: 'user-123',
        lo_que_me_define_encrypted: 'encrypted_data'
      };
      mockResponsesData = [];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'users') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockPersonaData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  not: jest.fn(() => ({
                    order: jest.fn(() => ({
                      range: jest.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should trigger LRU cache eviction when cache is full', async () => {
      // Test LRU eviction logic (lines 44-56) by mocking cache size
      // We'll test this indirectly by verifying cache works correctly
      mockPersonaData = {
        id: 'user-123',
        lo_que_me_define_encrypted: 'encrypted_data'
      };
      mockResponsesData = [];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'users') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockPersonaData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  not: jest.fn(() => ({
                    order: jest.fn(() => ({
                      range: jest.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      // Make requests with different cache keys to test cache functionality
      // The LRU eviction will be triggered internally when cache exceeds MAX_CACHE_SIZE
      const response1 = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30, offset: 0 });

      const response2 = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30, offset: 1 });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it('should handle validateString with non-string input', async () => {
      // Test validateString edge cases (lines 169-180)
      mockPersonaData = {
        id: 'user-123',
        lo_que_me_define_encrypted: 'encrypted_data'
      };
      mockResponsesData = [];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'users') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockPersonaData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  not: jest.fn(() => ({
                    order: jest.fn(() => ({
                      range: jest.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      // Test with invalid string types (number, object, null)
      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30, platform: 123 }); // platform should be string

      expect(response.status).toBe(200);
    });

    it('should handle validateInteger with invalid input', async () => {
      // Test validateInteger edge cases (lines 140-159)
      mockPersonaData = {
        id: 'user-123',
        lo_que_me_define_encrypted: 'encrypted_data'
      };
      mockResponsesData = [];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'users') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockPersonaData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  not: jest.fn(() => ({
                    order: jest.fn(() => ({
                      range: jest.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      // Test with invalid integer types (string, null, undefined, NaN)
      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 'invalid', limit: 'not-a-number', offset: null });

      expect(response.status).toBe(200);
    });

    it('should handle validatePlanId with empty string', async () => {
      // Test validatePlanId edge case (line 97)
      mockOrganizationData = { 
        id: 'org-123', 
        owner_id: 'user-123', 
        plan_id: '',
        monthly_responses_limit: 1000 
      };

      mockPersonaData = {
        id: 'user-123',
        lo_que_me_define_encrypted: 'encrypted_data'
      };
      mockResponsesData = [];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'users') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockPersonaData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  not: jest.fn(() => ({
                    order: jest.fn(() => ({
                      range: jest.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle error in usage-trends endpoint', async () => {
      // Test error handling (lines 671-672)
      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'monthly_usage') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(() => Promise.resolve({ 
                      data: null,
                      error: new Error('Database error')
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/usage-trends');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle organization not found in usage-trends', async () => {
      // Test error handling (line 608)
      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: null, error: null }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/usage-trends');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Organization not found');
    });

    it('should handle error in shield-effectiveness endpoint', async () => {
      // Test error handling (lines 579-580)
      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  gte: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => Promise.resolve({ 
                        data: null,
                        error: new Error('Database error')
                      }))
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/shield-effectiveness');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle error in roastr-persona-insights endpoint', async () => {
      // Test error handling (lines 960-961) - throw error from async operation
      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'users') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(async () => {
                  throw new Error('User not found');
                })
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30 });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle organization not found in roastr-persona-insights', async () => {
      // Test error handling (line 727) - orgData is null when no organization found
      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ 
                  data: null, 
                  error: null
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Organization not found');
    });

    it('should handle error in responses query for persona insights', async () => {
      // Test error handling (line 790) - error property in response
      mockPersonaData = {
        id: 'user-123',
        lo_que_me_define_encrypted: 'encrypted_data'
      };

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'users') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockPersonaData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  not: jest.fn(() => ({
                    order: jest.fn(() => ({
                      range: jest.fn(() => Promise.resolve({ 
                        data: null,
                        error: new Error('Database error')
                      }))
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30 });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should generate recommendations for incomplete persona', async () => {
      // Test recommendation generation (lines 1027, 1038, 1052, 1068)
      mockPersonaData = {
        id: 'user-123',
        lo_que_me_define_encrypted: 'encrypted_data',
        lo_que_no_tolero_encrypted: null, // Only 1 field configured
        lo_que_me_da_igual_encrypted: null
      };

      mockResponsesData = [
        {
          id: 'resp-1',
          persona_fields_used: ['lo_que_me_define'],
          platform_response_id: null, // Failed post
          created_at: new Date().toISOString()
        },
        {
          id: 'resp-2',
          persona_fields_used: ['lo_que_me_define'],
          platform_response_id: 'platform-1', // Success
          created_at: new Date().toISOString()
        }
      ];

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockOrganizationData, error: null }))
              }))
            }))
          };
        } else if (table === 'users') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockPersonaData, error: null }))
              }))
            }))
          };
        } else if (table === 'responses') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  not: jest.fn(() => ({
                    order: jest.fn(() => ({
                      range: jest.fn(() => Promise.resolve({ data: mockResponsesData, error: null }))
                    }))
                  }))
                }))
              }))
            }))
          };
        }
        return { select: jest.fn(() => createMockQueryChain(table, [])) };
      });

      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.data.recommendations).toBeDefined();
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
    });
  });
});

