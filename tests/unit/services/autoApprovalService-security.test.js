/**
 * AutoApprovalService Security Tests
 * Issue #405 - CodeRabbit Round 5 Security Fixes
 * 
 * Comprehensive security test suite combining Round 2-5 fixes:
 * - Enhanced toxicity score validation with fail-closed
 * - Organization policy lookup with robust error handling  
 * - Rate limiting with fail-closed during DB errors
 * - Transparency enforcement and validation
 * - Comprehensive edge case coverage
 */

const AutoApprovalService = require('../../../src/services/autoApprovalService');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    gte: jest.fn().mockReturnThis(),
    count: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis()
  }
}));

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

jest.mock('../../../src/services/shieldService', () => {
  return jest.fn().mockImplementation(() => ({
    analyzeContent: jest.fn().mockResolvedValue({ action: 'allow' })
  }));
});

jest.mock('../../../src/services/transparencyService', () => ({
  isTransparencyRequired: jest.fn().mockResolvedValue(false),
  applyTransparency: jest.fn()
}));

jest.mock('../../../src/services/planLimitsService', () => ({
  getPlanLimits: jest.fn().mockResolvedValue({
    features: { autoApproval: true }
  }),
  getDailyAutoApprovalLimits: jest.fn().mockResolvedValue({
    hourly: 50,
    daily: 200
  })
}));

const { supabaseServiceClient } = require('../../../src/config/supabase');
const { logger } = require('../../../src/utils/logger');
const transparencyService = require('../../../src/services/transparencyService');

describe('AutoApprovalService - Security Tests Round 5', () => {
  let service;

  beforeEach(() => {
    service = new AutoApprovalService();
    jest.clearAllMocks();
    
    // Reset mock chain
    supabaseServiceClient.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis()
    });
  });

  describe('validateToxicityScore - Enhanced Logic', () => {
    describe('Dynamic threshold validation', () => {
      test('should allow higher increase for low toxicity original comments', () => {
        // Low toxicity (≤0.2) - allows 0.4 increase
        const result = service.validateToxicityScore(0.5, 0.15);
        expect(result).toBe(true);
        
        // Just at boundary
        const boundary = service.validateToxicityScore(0.55, 0.15);
        expect(boundary).toBe(true);
        
        // Over boundary should fail
        const overBoundary = service.validateToxicityScore(0.6, 0.15);
        expect(overBoundary).toBe(false);
      });

      test('should allow medium increase for medium toxicity original comments', () => {
        // Medium toxicity (0.2-0.5) - allows 0.3 increase
        const result = service.validateToxicityScore(0.6, 0.3);
        expect(result).toBe(true);
        
        // Just at boundary
        const boundary = service.validateToxicityScore(0.6, 0.3);
        expect(boundary).toBe(true);
        
        // Over boundary should fail
        const overBoundary = service.validateToxicityScore(0.65, 0.3);
        expect(overBoundary).toBe(false);
      });

      test('should allow minimal increase for high toxicity original comments', () => {
        // High toxicity (>0.5) - allows 0.2 increase
        const result = service.validateToxicityScore(0.8, 0.6);
        expect(result).toBe(true);
        
        // Just at boundary
        const boundary = service.validateToxicityScore(0.8, 0.6);
        expect(boundary).toBe(true);
        
        // Over boundary should fail
        const overBoundary = service.validateToxicityScore(0.85, 0.6);
        expect(overBoundary).toBe(false);
      });
    });

    describe('Null/undefined score handling - Enhanced fail-closed', () => {
      test('should fail closed when both scores are null', () => {
        const result = service.validateToxicityScore(null, null);
        expect(result).toBe(false);
      });

      test('should fail closed when both scores are undefined', () => {
        const result = service.validateToxicityScore(undefined, undefined);
        expect(result).toBe(false);
      });

      test('should handle invalid score formats gracefully', () => {
        const result1 = service.validateToxicityScore('invalid', 0.3);
        expect(result1).toBe(false);
        
        const result2 = service.validateToxicityScore(0.3, 'invalid');
        expect(result2).toBe(false);
        
        const result3 = service.validateToxicityScore(-1, 0.3);
        expect(result3).toBe(false);
        
        const result4 = service.validateToxicityScore(0.3, -1);
        expect(result4).toBe(false);
      });
    });

    describe('Score normalization and validation', () => {
      test('should normalize 0-100 scale scores to 0-1', () => {
        // Scores > 1 should be normalized
        const result = service.validateToxicityScore(50, 30); // 0.5, 0.3
        expect(result).toBe(true);
        
        const result2 = service.validateToxicityScore(80, 30); // 0.8, 0.3  
        expect(result2).toBe(false); // 0.8 > 0.3 + 0.3 (0.6)
      });
    });
  });

  describe('Fail-Closed Error Handling', () => {
    test('should fail closed when organization query times out', async () => {
      // Mock timeout scenario
      supabaseServiceClient.single.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 100)
        )
      );

      const result = await service.checkAutoApprovalEligibility('test-org');
      
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('system_error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error checking auto-approval eligibility'),
        expect.any(Object)
      );
    });

    test('should fail closed when organization query returns error', async () => {
      supabaseServiceClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', code: 'PGRST301' }
      });

      const result = await service.checkAutoApprovalEligibility('test-org');
      
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('organization_not_found');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get organization'),
        expect.objectContaining({
          organizationId: 'test-org',
          error: 'Database connection failed'
        })
      );
    });

    test('should fail closed when database connection is unhealthy', async () => {
      // Mock unhealthy database connection
      supabaseServiceClient.select.mockResolvedValue({
        data: null,
        error: { message: 'Connection refused' }
      });

      const result = await service.checkRateLimits('test-org');
      
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('database_connectivity_failed');
      expect(result.reason).toContain('Cannot verify database connectivity');
    });
  });

  describe('Rate Limiting Bypass Prevention', () => {
    test('should perform health check before rate limit queries', async () => {
      // Mock successful health check
      supabaseServiceClient.select
        .mockResolvedValueOnce({ data: [], error: null }) // Health check
        .mockResolvedValueOnce({ data: [], count: 5, error: null }) // Hourly check
        .mockResolvedValueOnce({ data: [], count: 20, error: null }); // Daily check

      const result = await service.checkRateLimits('test-org');
      
      expect(result.allowed).toBe(true);
      expect(supabaseServiceClient.select).toHaveBeenCalledTimes(3);
    });

    test('should validate organization ID format for rate limiting', async () => {
      const invalidOrgIds = [null, undefined, '', 123, {}, []];
      
      for (const invalidId of invalidOrgIds) {
        const result = await service.checkRateLimits(invalidId);
        
        expect(result.allowed).toBe(false);
        expect(result.error).toBe('invalid_input');
        expect(result.reason).toBe('Invalid organization ID provided');
      }
    });
  });

  describe('Enhanced Transparency Enforcement', () => {
    test('should fail closed when transparency service throws error', async () => {
      // Mock valid organization and security checks
      supabaseServiceClient.single.mockResolvedValue({
        data: { plan: 'pro', settings: { auto_approval: true } },
        error: null
      });

      // Mock transparency service error
      transparencyService.isTransparencyRequired.mockRejectedValue(
        new Error('Transparency service unavailable')
      );

      const comment = { id: 'comment-1', text: 'test comment', platform: 'twitter' };
      const variant = { id: 'variant-1', text: 'test response', score: 0.3 };

      const result = await service.processAutoApproval(comment, variant, 'test-org');
      
      expect(result.approved).toBe(false);
      expect(result.reason).toBe('transparency_system_error');
      expect(result.requiresManualReview).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in transparency enforcement'),
        expect.any(Object)
      );
    });

    test('should pass when transparency is properly applied with indicators', async () => {
      // Mock valid organization and security checks
      supabaseServiceClient.single.mockResolvedValue({
        data: { plan: 'pro', settings: { auto_approval: true } },
        error: null
      });

      // Mock rate limit check
      supabaseServiceClient.select
        .mockResolvedValueOnce({ data: [], error: null }) // Health check
        .mockResolvedValueOnce({ data: [], count: 5, error: null }) // Hourly
        .mockResolvedValueOnce({ data: [], count: 20, error: null }); // Daily

      // Mock transparency properly applied
      transparencyService.isTransparencyRequired.mockResolvedValue(true);
      transparencyService.applyTransparency.mockResolvedValue({
        text: 'This is a response 🤖 generated by AI'
      });

      // Mock approval record creation
      supabaseServiceClient.insert.mockResolvedValue({
        data: { id: 'approval-1' },
        error: null
      });

      const comment = { id: 'comment-1', text: 'test comment', platform: 'twitter' };
      const variant = { id: 'variant-1', text: 'test response', score: 0.3 };

      const result = await service.processAutoApproval(comment, variant, 'test-org');
      
      expect(result.approved).toBe(true);
      expect(result.variant.text).toContain('🤖');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Transparency successfully applied and validated'),
        expect.any(Object)
      );
    });
  });

  describe('Toxicity Score Validation - Conservative Approach', () => {
    test('should use conservative thresholds for auto-approval', () => {
      // Test the new conservative configuration
      expect(service.config.maxToxicityScore).toBe(0.6); // Reduced from 0.7
      
      // Test conservative toxicity validation
      const result1 = service.validateToxicityScore(0.5, 0.3); // Should pass
      expect(result1).toBe(true);
      
      const result2 = service.validateToxicityScore(0.7, 0.3); // Should fail (above 0.6)
      expect(result2).toBe(false);
    });

    test('should fail closed with null/undefined toxicity scores', () => {
      const testCases = [
        [null, null],
        [undefined, undefined],
        [null, 0.5],
        [0.5, null],
        ['', 0.5],
        [0.5, '']
      ];

      testCases.forEach(([variantScore, originalScore]) => {
        const result = service.validateToxicityScore(variantScore, originalScore);
        if (variantScore === null || variantScore === undefined || variantScore === '') {
          expect(result).toBe(false);
        }
      });
    });
  });

  describe('Input Validation Security', () => {
    test('should validate organization ID in all methods', async () => {
      const invalidOrgIds = [null, undefined, '', 123, {}, []];
      
      for (const invalidId of invalidOrgIds) {
        const eligibilityResult = await service.checkAutoApprovalEligibility(invalidId);
        expect(eligibilityResult.eligible).toBe(false);
        
        const rateLimitResult = await service.checkRateLimits(invalidId);
        expect(rateLimitResult.allowed).toBe(false);
      }
    });
  });

  describe('Error Logging and Security Monitoring', () => {
    test('should log security events with proper context', async () => {
      supabaseServiceClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Unauthorized access', code: 'PGRST301' }
      });

      await service.checkAutoApprovalEligibility('test-org');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get organization'),
        expect.objectContaining({
          organizationId: 'test-org',
          error: 'Unauthorized access'
        })
      );
    });

    test('should include validation IDs for audit trails', async () => {
      const result = await service.checkRateLimits('test-org');
      
      expect(result).toHaveProperty('rateLimitId');
      expect(typeof result.rateLimitId).toBe('string');
      expect(result.rateLimitId).toMatch(/^rate_\d+_[a-z0-9]+$/);
    });
  });
});