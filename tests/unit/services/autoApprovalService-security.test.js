/**
 * AutoApprovalService Security Tests
 * Issue #405 - CodeRabbit Round 2 Security Fixes
 * 
 * Tests critical security validations after CodeRabbit feedback:
 * - Enhanced toxicity score validation with fail-closed
 * - Organization policy lookup with robust error handling  
 * - Rate limiting with fail-closed during DB errors
 * - Comprehensive edge case coverage
 */

const AutoApprovalService = require('../../../src/services/autoApprovalService');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn(),
    select: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
    gte: jest.fn(),
    count: jest.fn()
  }
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

const { supabaseServiceClient } = require('../../../src/config/supabase');
const { logger } = require('../../../src/utils/logger');

describe('AutoApprovalService - Security Validations', () => {
  let autoApprovalService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    autoApprovalService = new AutoApprovalService();
    
    // Reset mock chain
    supabaseServiceClient.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis()
    });
  });

  describe('validateToxicityScore - Enhanced Logic', () => {
    describe('Dynamic threshold validation', () => {
      test('should allow higher increase for low toxicity original comments', () => {
        // Low toxicity (≤0.2) - allows 0.4 increase
        const result = autoApprovalService.validateToxicityScore(0.5, 0.15);
        expect(result).toBe(true);
        
        // Just at boundary
        const boundary = autoApprovalService.validateToxicityScore(0.55, 0.15);
        expect(boundary).toBe(true);
        
        // Over boundary should fail
        const overBoundary = autoApprovalService.validateToxicityScore(0.6, 0.15);
        expect(overBoundary).toBe(false);
      });

      test('should allow medium increase for medium toxicity original comments', () => {
        // Medium toxicity (0.2-0.5) - allows 0.3 increase
        const result = autoApprovalService.validateToxicityScore(0.6, 0.3);
        expect(result).toBe(true);
        
        // Just at boundary
        const boundary = autoApprovalService.validateToxicityScore(0.6, 0.3);
        expect(boundary).toBe(true);
        
        // Over boundary should fail
        const overBoundary = autoApprovalService.validateToxicityScore(0.65, 0.3);
        expect(overBoundary).toBe(false);
      });

      test('should allow minimal increase for high toxicity original comments', () => {
        // High toxicity (>0.5) - allows 0.2 increase
        const result = autoApprovalService.validateToxicityScore(0.8, 0.6);
        expect(result).toBe(true);
        
        // Just at boundary
        const boundary = autoApprovalService.validateToxicityScore(0.8, 0.6);
        expect(boundary).toBe(true);
        
        // Over boundary should fail
        const overBoundary = autoApprovalService.validateToxicityScore(0.85, 0.6);
        expect(overBoundary).toBe(false);
      });
    });

    describe('Null/undefined score handling - Enhanced fail-closed', () => {
      test('should fail closed when both scores are null', () => {
        const result = autoApprovalService.validateToxicityScore(null, null);
        expect(result).toBe(false);
        expect(logger.warn).toHaveBeenCalledWith(
          'Both toxicity scores unavailable - failing closed for safety',
          expect.objectContaining({
            variantScore: null,
            originalScore: null,
            reason: 'no_scores_available'
          })
        );
      });

      test('should fail closed when both scores are undefined', () => {
        const result = autoApprovalService.validateToxicityScore(undefined, undefined);
        expect(result).toBe(false);
        expect(logger.warn).toHaveBeenCalledWith(
          'Both toxicity scores unavailable - failing closed for safety',
          expect.objectContaining({
            reason: 'no_scores_available'
          })
        );
      });

      test('should use 0.5 default for null variant score but warn', () => {
        const result = autoApprovalService.validateToxicityScore(null, 0.3);
        expect(result).toBe(false); // 0.5 > 0.3 + 0.3 (0.6)
        expect(logger.warn).toHaveBeenCalledWith(
          'Variant toxicity score missing - using default for safety',
          expect.objectContaining({
            variantScore: null,
            defaultUsed: 0.5
          })
        );
      });

      test('should use 0.3 default for null original score but warn', () => {
        const result = autoApprovalService.validateToxicityScore(0.4, null);
        expect(result).toBe(true); // 0.4 <= 0.3 + 0.3 (0.6)
        expect(logger.warn).toHaveBeenCalledWith(
          'Original toxicity score missing - using default for safety',
          expect.objectContaining({
            originalScore: null,
            defaultUsed: 0.3
          })
        );
      });
    });

    describe('Score normalization and validation', () => {
      test('should normalize 0-100 scale scores to 0-1', () => {
        // Scores > 1 should be normalized
        const result = autoApprovalService.validateToxicityScore(50, 30); // 0.5, 0.3
        expect(result).toBe(true);
        
        const result2 = autoApprovalService.validateToxicityScore(80, 30); // 0.8, 0.3  
        expect(result2).toBe(false); // 0.8 > 0.3 + 0.3 (0.6)
      });

      test('should handle invalid score formats gracefully', () => {
        const result1 = autoApprovalService.validateToxicityScore('invalid', 0.3);
        expect(result1).toBe(false);
        
        const result2 = autoApprovalService.validateToxicityScore(0.3, 'invalid');
        expect(result2).toBe(false);
        
        const result3 = autoApprovalService.validateToxicityScore(-1, 0.3);
        expect(result3).toBe(false);
        
        const result4 = autoApprovalService.validateToxicityScore(0.3, -1);
        expect(result4).toBe(false);
      });

      test('should log detailed validation reasoning', () => {
        autoApprovalService.validateToxicityScore(0.8, 0.3);
        
        expect(logger.info).toHaveBeenCalledWith(
          'Toxicity validation details',
          expect.objectContaining({
            variantScore: 0.8,
            originalScore: 0.3,
            maxAllowedIncrease: 0.3,
            actualIncrease: 0.5,
            maxAllowed: 0.6,
            passed: false
          })
        );
      });
    });
  });

  describe('validateOrganizationPolicy - Robust Fail-Closed', () => {
    const mockPolicyQuery = () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      };
      supabaseServiceClient.from.mockReturnValue(mockQuery);
      return mockQuery;
    };

    test('should fail closed on policy query timeout', async () => {
      const mockQuery = mockPolicyQuery();
      mockQuery.eq.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ data: [], error: null }), 2000); // 2s delay
        });
      });

      const result = await autoApprovalService.validateOrganizationPolicy('test-org', {}, 1000);
      
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Organization policy validation failed due to timeout',
        expect.objectContaining({
          organizationId: 'test-org',
          timeout: 1000,
          reason: 'query_timeout'
        })
      );
    });

    test('should fail closed on policy query error', async () => {
      const mockQuery = mockPolicyQuery();
      mockQuery.eq.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', code: 'CONNECTION_ERROR' }
      });

      const result = await autoApprovalService.validateOrganizationPolicy('test-org', {});
      
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Organization policy query failed - failing closed for security',
        expect.objectContaining({
          organizationId: 'test-org',
          error: 'Database connection failed',
          errorCode: 'CONNECTION_ERROR'
        })
      );
    });

    test('should distinguish between no policies vs query failure', async () => {
      const mockQuery = mockPolicyQuery();
      mockQuery.eq.mockResolvedValue({
        data: [], // Empty but successful
        error: null
      });

      const result = await autoApprovalService.validateOrganizationPolicy('test-org', {});
      
      expect(result).toBe(true); // No policies = allowed
      expect(logger.info).toHaveBeenCalledWith(
        'No organization policies found - allowing by default',
        expect.objectContaining({
          organizationId: 'test-org'
        })
      );
    });

    test('should handle partial policy data gracefully', async () => {
      const mockQuery = mockPolicyQuery();
      mockQuery.eq.mockResolvedValue({
        data: [
          { auto_approval_enabled: true }, // Missing other fields
          { toxicity_threshold: 0.7 }, // Missing auto_approval_enabled
        ],
        error: null
      });

      const result = await autoApprovalService.validateOrganizationPolicy('test-org', {
        toxicityScore: 0.5
      });
      
      expect(result).toBe(true); // Should handle gracefully
      expect(logger.debug).toHaveBeenCalledWith(
        'Applying organization policy validation',
        expect.any(Object)
      );
    });
  });

  describe('checkRateLimits - Ultra-Robust Fail-Closed', () => {
    const mockRateLimitQuery = () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        count: jest.fn()
      };
      supabaseServiceClient.from.mockReturnValue(mockQuery);
      return mockQuery;
    };

    test('should perform pre-flight health check', async () => {
      const mockQuery = mockRateLimitQuery();
      
      // Health check fails
      const healthQuery = {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(new Error('Connection refused'))
      };
      supabaseServiceClient.from.mockReturnValueOnce(healthQuery);

      const result = await autoApprovalService.checkRateLimits('test-org');
      
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Rate limit check failed - database health check failed',
        expect.objectContaining({
          organizationId: 'test-org',
          reason: 'health_check_failed'
        })
      );
    });

    test('should fail closed on database connectivity issues', async () => {
      const mockQuery = mockRateLimitQuery();
      
      // Health check passes
      const healthQuery = {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      };
      supabaseServiceClient.from.mockReturnValueOnce(healthQuery);
      
      // But actual query fails
      mockQuery.count.mockRejectedValue(new Error('Connection lost'));

      const result = await autoApprovalService.checkRateLimits('test-org');
      
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Rate limit check failed - failing closed for safety',
        expect.objectContaining({
          organizationId: 'test-org',
          error: 'Connection lost'
        })
      );
    });

    test('should validate count values are valid numbers', async () => {
      const mockQuery = mockRateLimitQuery();
      
      // Health check passes
      const healthQuery = {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      };
      supabaseServiceClient.from.mockReturnValueOnce(healthQuery);
      
      // Return invalid count data
      mockQuery.count
        .mockResolvedValueOnce({ count: 'invalid', error: null }) // Hourly
        .mockResolvedValueOnce({ count: null, error: null }); // Daily

      const result = await autoApprovalService.checkRateLimits('test-org');
      
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid rate limit count received - failing closed',
        expect.objectContaining({
          hourlyCount: 'invalid',
          dailyCount: null
        })
      );
    });

    test('should handle timeout scenarios correctly', async () => {
      const mockQuery = mockRateLimitQuery();
      
      // Health check passes quickly
      const healthQuery = {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      };
      supabaseServiceClient.from.mockReturnValueOnce(healthQuery);
      
      // Mock slow query that exceeds timeout
      mockQuery.count.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ count: 10, error: null }), 2000);
        });
      });

      const result = await autoApprovalService.checkRateLimits('test-org', { queryTimeout: 1000 });
      
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Rate limit check timed out - failing closed for safety',
        expect.objectContaining({
          organizationId: 'test-org',
          timeout: 1000
        })
      );
    });

    test('should log comprehensive rate limit status', async () => {
      const mockQuery = mockRateLimitQuery();
      
      // Health check passes
      const healthQuery = {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      };
      supabaseServiceClient.from.mockReturnValueOnce(healthQuery);
      
      // Return valid counts
      mockQuery.count
        .mockResolvedValueOnce({ count: 45, error: null }) // Hourly
        .mockResolvedValueOnce({ count: 150, error: null }); // Daily

      const result = await autoApprovalService.checkRateLimits('test-org');
      
      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Rate limit check completed successfully',
        expect.objectContaining({
          organizationId: 'test-org',
          hourlyCount: 45,
          hourlyLimit: 50,
          dailyCount: 150,
          dailyLimit: 200,
          withinLimits: true
        })
      );
    });
  });

  describe('Integration - End-to-End Security Flow', () => {
    test('should reject when any security validation fails', async () => {
      const mockContent = {
        toxicityScore: 0.8,
        originalToxicityScore: 0.3,
        organizationId: 'test-org'
      };

      // Mock policy query success
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [{ auto_approval_enabled: true, toxicity_threshold: 0.6 }],
          error: null
        })
      };
      supabaseServiceClient.from.mockReturnValue(mockQuery);

      const result = await autoApprovalService.shouldAutoApprove(mockContent);
      
      expect(result.approved).toBe(false);
      expect(result.reason).toBe('toxicity_threshold_exceeded');
      expect(result.securityValidations).toMatchObject({
        toxicityValidation: false,
        policyValidation: true,
        rateLimitValidation: expect.any(Boolean)
      });
    });

    test('should pass when all security validations succeed', async () => {
      const mockContent = {
        toxicityScore: 0.4,
        originalToxicityScore: 0.3,
        organizationId: 'test-org'
      };

      // Mock successful policy query
      const policyQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [{ auto_approval_enabled: true, toxicity_threshold: 0.8 }],
          error: null
        })
      };
      
      // Mock successful rate limit checks
      const rateLimitQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        count: jest.fn()
          .mockResolvedValueOnce({ count: 10, error: null }) // Hourly
          .mockResolvedValueOnce({ count: 50, error: null }), // Daily
        limit: jest.fn().mockResolvedValue({ data: [], error: null }) // Health check
      };
      
      supabaseServiceClient.from
        .mockReturnValueOnce(rateLimitQuery) // Health check
        .mockReturnValueOnce(policyQuery) // Policy query
        .mockReturnValueOnce(rateLimitQuery) // Hourly rate limit
        .mockReturnValueOnce(rateLimitQuery); // Daily rate limit

      const result = await autoApprovalService.shouldAutoApprove(mockContent);
      
      expect(result.approved).toBe(true);
      expect(result.securityValidations).toMatchObject({
        toxicityValidation: true,
        policyValidation: true,
        rateLimitValidation: true
      });
    });
  });
});