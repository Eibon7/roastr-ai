/**
 * Auto-Approval Security Integration Tests V2
 * Issue #405 - CodeRabbit Round 2 Security Fixes
 * 
 * End-to-end tests for the enhanced security flow with all fixes:
 * - Toxicity validation with dynamic thresholds
 * - Organization policy with fail-closed
 * - Rate limiting with health checks
 * - Content validation with checksums
 * - Transparency enforcement
 */

const request = require('supertest');
const app = require('../../src/index');
const { supabaseServiceClient } = require('../../src/config/supabase');

// Mock Supabase
jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn(),
    auth: {
      admin: {
        getUserById: jest.fn()
      }
    }
  }
}));

// Mock logger to reduce test noise
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Auto-Approval Security V2 - E2E Integration', () => {
  let authToken;
  const testOrgId = 'test-org-123';
  const testUserId = 'test-user-123';

  beforeAll(() => {
    // Generate test auth token
    authToken = 'Bearer test-token-123';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth
    supabaseServiceClient.auth.admin.getUserById.mockResolvedValue({
      data: { user: { id: testUserId, email: 'test@example.com' } },
      error: null
    });
  });

  describe('Complete Security Flow - Happy Path', () => {
    test('should successfully auto-approve when all security checks pass', async () => {
      // Mock all database queries for successful flow
      const mockQueries = {
        // Organization policy check
        organization_policies: {
          data: [{
            auto_approval_enabled: true,
            toxicity_threshold: 0.7,
            require_transparency: true,
            custom_restrictions: []
          }],
          error: null
        },
        // Rate limit health check
        roast_approvals_health: {
          data: [{ id: 1 }],
          error: null
        },
        // Rate limit counts
        roast_approvals_hourly: {
          count: 10,
          error: null
        },
        roast_approvals_daily: {
          count: 50,
          error: null
        },
        // Comment data
        comments: {
          data: {
            id: 'comment-123',
            content: 'This is a test comment',
            toxicity_score: 0.3,
            organization_id: testOrgId
          },
          error: null
        },
        // Roast generation result
        roasts: {
          data: {
            id: 'roast-123',
            content: 'This is a witty roast response',
            toxicity_score: 0.4, // Within acceptable increase
            transparency_applied: true,
            transparency_type: 'disclaimer'
          },
          error: null
        }
      };

      // Setup mock chain
      let queryCount = 0;
      supabaseServiceClient.from.mockImplementation((table) => {
        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis()
        };

        // Return appropriate mock data based on table
        if (table === 'organization_policies') {
          mockQuery.eq.mockResolvedValue(mockQueries.organization_policies);
        } else if (table === 'roast_approvals' && queryCount === 0) {
          // Health check
          queryCount++;
          mockQuery.limit.mockResolvedValue(mockQueries.roast_approvals_health);
        } else if (table === 'roast_approvals') {
          // Rate limit counts
          mockQuery.count.mockResolvedValueOnce(mockQueries.roast_approvals_hourly)
                       .mockResolvedValueOnce(mockQueries.roast_approvals_daily);
        } else if (table === 'comments') {
          mockQuery.single.mockResolvedValue(mockQueries.comments);
        } else if (table === 'roasts') {
          mockQuery.single.mockResolvedValue(mockQueries.roasts);
          mockQuery.update.mockResolvedValue({ data: mockQueries.roasts.data, error: null });
        }

        return mockQuery;
      });

      const response = await request(app)
        .post('/api/roast/auto-approve')
        .set('Authorization', authToken)
        .send({
          commentId: 'comment-123',
          roastId: 'roast-123',
          organizationId: testOrgId
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        approved: true,
        securityValidations: {
          toxicityValidation: true,
          policyValidation: true,
          rateLimitValidation: true,
          contentValidation: true,
          transparencyValidation: true
        },
        metadata: {
          toxicityIncrease: 0.1,
          hourlyUsage: 10,
          dailyUsage: 50,
          transparencyType: 'disclaimer'
        }
      });
    });
  });

  describe('Security Failures - Fail Closed Behaviors', () => {
    test('should fail closed when toxicity increase exceeds dynamic threshold', async () => {
      // Mock high toxicity original comment
      const mockQueries = {
        organization_policies: {
          data: [{ auto_approval_enabled: true, toxicity_threshold: 0.8 }],
          error: null
        },
        comments: {
          data: {
            content: 'Highly toxic comment',
            toxicity_score: 0.7 // High original toxicity
          },
          error: null
        },
        roasts: {
          data: {
            content: 'Even more toxic roast',
            toxicity_score: 0.95 // Exceeds allowed increase of 0.2
          },
          error: null
        }
      };

      setupMockQueries(mockQueries);

      const response = await request(app)
        .post('/api/roast/auto-approve')
        .set('Authorization', authToken)
        .send({
          commentId: 'comment-123',
          roastId: 'roast-123',
          organizationId: testOrgId
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        approved: false,
        reason: 'toxicity_threshold_exceeded',
        securityValidations: {
          toxicityValidation: false
        },
        metadata: {
          originalToxicity: 0.7,
          roastToxicity: 0.95,
          maxAllowedIncrease: 0.2,
          actualIncrease: 0.25
        }
      });
    });

    test('should fail closed when organization policy query times out', async () => {
      // Mock timeout for policy query
      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organization_policies') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(() => new Promise((resolve) => {
              // Never resolve - simulate timeout
              setTimeout(() => resolve({ data: null, error: { message: 'Timeout' } }), 10000);
            }))
          };
        }
        return mockSuccessfulQuery();
      });

      const response = await request(app)
        .post('/api/roast/auto-approve')
        .set('Authorization', authToken)
        .send({
          commentId: 'comment-123',
          roastId: 'roast-123',
          organizationId: testOrgId,
          timeout: 1000 // 1 second timeout
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        approved: false,
        reason: 'policy_validation_timeout',
        securityValidations: {
          policyValidation: false
        },
        error: expect.stringContaining('timeout')
      });
    });

    test('should fail closed when rate limit health check fails', async () => {
      // Mock health check failure
      let healthCheckAttempt = 0;
      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'roast_approvals' && healthCheckAttempt === 0) {
          healthCheckAttempt++;
          return {
            select: jest.fn().mockReturnThis(),
            limit: jest.fn().mockRejectedValue(new Error('Connection refused'))
          };
        }
        return mockSuccessfulQuery();
      });

      const response = await request(app)
        .post('/api/roast/auto-approve')
        .set('Authorization', authToken)
        .send({
          commentId: 'comment-123',
          roastId: 'roast-123',
          organizationId: testOrgId
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        approved: false,
        reason: 'rate_limit_check_failed',
        securityValidations: {
          rateLimitValidation: false
        },
        error: expect.stringContaining('health check failed')
      });
    });

    test('should fail closed when content validation detects mismatch', async () => {
      const mockQueries = {
        organization_policies: {
          data: [{ auto_approval_enabled: true }],
          error: null
        },
        comments: {
          data: { content: 'Original comment', toxicity_score: 0.3 },
          error: null
        },
        roasts: {
          data: {
            id: 'roast-123',
            content: 'Stored roast content',
            toxicity_score: 0.4,
            stored_at: '2025-01-26T10:00:00Z'
          },
          error: null
        }
      };

      setupMockQueries(mockQueries);

      // Send different content than what's stored
      const response = await request(app)
        .post('/api/roast/auto-approve')
        .set('Authorization', authToken)
        .send({
          commentId: 'comment-123',
          roastId: 'roast-123',
          organizationId: testOrgId,
          approvedContent: 'Different roast content', // Mismatch!
          approvalTimestamp: '2025-01-26T10:00:30Z'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        approved: false,
        reason: 'content_validation_failed',
        securityValidations: {
          contentValidation: false
        },
        metadata: {
          validationReason: 'content_text_mismatch',
          storedContentLength: 19,
          approvedContentLength: 23
        }
      });
    });

    test('should fail when transparency is not applied for auto-publish', async () => {
      const mockQueries = {
        organization_policies: {
          data: [{ 
            auto_approval_enabled: true,
            require_transparency: true 
          }],
          error: null
        },
        roasts: {
          data: {
            content: 'Roast without transparency',
            toxicity_score: 0.4,
            transparency_applied: false // Missing transparency!
          },
          error: null
        }
      };

      setupMockQueries(mockQueries);

      const response = await request(app)
        .post('/api/roast/auto-approve')
        .set('Authorization', authToken)
        .send({
          commentId: 'comment-123',
          roastId: 'roast-123',
          organizationId: testOrgId,
          autoPublish: true
        });

      expect(response.status).toBe(500); // Critical security failure
      expect(response.body).toMatchObject({
        success: false,
        error: 'Transparency validation failed for auto-publish',
        securityValidations: {
          transparencyValidation: false
        }
      });
    });
  });

  describe('Edge Cases and Robustness', () => {
    test('should handle null toxicity scores with fail-closed behavior', async () => {
      const mockQueries = {
        comments: {
          data: { 
            content: 'Comment without toxicity score',
            toxicity_score: null // No score available
          },
          error: null
        },
        roasts: {
          data: {
            content: 'Roast without toxicity score', 
            toxicity_score: null // No score available
          },
          error: null
        }
      };

      setupMockQueries(mockQueries);

      const response = await request(app)
        .post('/api/roast/auto-approve')
        .set('Authorization', authToken)
        .send({
          commentId: 'comment-123',
          roastId: 'roast-123',
          organizationId: testOrgId
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        approved: false,
        reason: 'toxicity_scores_unavailable',
        securityValidations: {
          toxicityValidation: false
        },
        warning: 'Both toxicity scores unavailable - failing closed for safety'
      });
    });

    test('should normalize toxicity scores from 0-100 scale', async () => {
      const mockQueries = {
        comments: {
          data: { 
            content: 'Test comment',
            toxicity_score: 30 // 0-100 scale
          },
          error: null
        },
        roasts: {
          data: {
            content: 'Test roast',
            toxicity_score: 45 // 0-100 scale, normalized to 0.45
          },
          error: null
        }
      };

      setupMockQueries(mockQueries);

      const response = await request(app)
        .post('/api/roast/auto-approve')
        .set('Authorization', authToken)
        .send({
          commentId: 'comment-123',
          roastId: 'roast-123',
          organizationId: testOrgId
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        approved: true, // 0.45 <= 0.3 + 0.3 (0.6)
        metadata: {
          normalizedScores: {
            original: 0.3,
            roast: 0.45
          }
        }
      });
    });

    test('should detect and prevent race conditions in content validation', async () => {
      const mockQueries = {
        roasts: {
          data: {
            content: 'Test roast',
            stored_at: '2025-01-26T10:00:00Z',
            toxicity_score: 0.4
          },
          error: null
        }
      };

      setupMockQueries(mockQueries);

      // Approval timestamp BEFORE storage timestamp (race condition)
      const response = await request(app)
        .post('/api/roast/auto-approve')
        .set('Authorization', authToken)
        .send({
          commentId: 'comment-123',
          roastId: 'roast-123',
          organizationId: testOrgId,
          approvalTimestamp: '2025-01-26T09:59:30Z'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        approved: false,
        reason: 'race_condition_detected',
        metadata: {
          storedAt: '2025-01-26T10:00:00Z',
          approvedAt: '2025-01-26T09:59:30Z',
          timeDifferenceMs: expect.any(Number)
        }
      });
    });
  });

  // Helper function to setup mock queries
  function setupMockQueries(mockData) {
    supabaseServiceClient.from.mockImplementation((table) => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis()
      };

      // Return mock data based on table
      Object.entries(mockData).forEach(([key, value]) => {
        if (table.includes(key) || key === table) {
          if (value.count !== undefined) {
            mockQuery.count.mockResolvedValue(value);
          } else {
            mockQuery.eq.mockResolvedValue(value);
            mockQuery.single.mockResolvedValue(value);
          }
        }
      });

      // Default successful responses for unmocked tables
      if (!mockData[table]) {
        mockQuery.eq.mockResolvedValue({ data: [], error: null });
        mockQuery.single.mockResolvedValue({ data: {}, error: null });
        mockQuery.count.mockResolvedValue({ count: 0, error: null });
        mockQuery.limit.mockResolvedValue({ data: [{ id: 1 }], error: null });
      }

      return mockQuery;
    });
  }

  function mockSuccessfulQuery() {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
      gte: jest.fn().mockReturnThis(),
      count: jest.fn().mockResolvedValue({ count: 0, error: null }),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      update: jest.fn().mockResolvedValue({ data: {}, error: null })
    };
  }
});