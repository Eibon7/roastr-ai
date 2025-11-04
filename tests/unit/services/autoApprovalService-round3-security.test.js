/**
 * Security Tests for AutoApprovalService - Round 3 Fixes
 * Tests fail-closed error handling, rate limiting bypass prevention, and transparency enforcement
 */

const AutoApprovalService = require('../../../src/services/autoApprovalService');
const { logger } = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    gte: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis()
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

const { supabaseServiceClient } = require('../../../src/config/supabase');
const transparencyService = require('../../../src/services/transparencyService');

describe('AutoApprovalService - Security Tests Round 3', () => {
  let service;

  beforeEach(() => {
    service = new AutoApprovalService();
    jest.clearAllMocks();
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
      // First call should be health check with limit(1)
      expect(supabaseServiceClient.select).toHaveBeenNthCalledWith(1, 'id');
    });

    test('should fail closed when health check response structure is invalid', async () => {
      // Mock health check with invalid response structure
      supabaseServiceClient.select.mockResolvedValue({
        data: { invalid: 'structure' }, // Should be array
        error: null
      });

      const result = await service.checkRateLimits('test-org');
      
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('database_connectivity_failed');
      expect(result.reason).toContain('Cannot verify database connectivity');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Database health check returned invalid response structure'),
        expect.any(Object)
      );
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

    test('should fail closed when transparency is required but not applied', async () => {
      // Mock valid organization and security checks
      supabaseServiceClient.single.mockResolvedValue({
        data: { plan: 'pro', settings: { auto_approval: true } },
        error: null
      });

      // Mock transparency required
      transparencyService.isTransparencyRequired.mockResolvedValue(true);
      transparencyService.applyTransparency.mockResolvedValue(null); // Failed to apply

      const comment = { id: 'comment-1', text: 'test comment', platform: 'twitter' };
      const variant = { id: 'variant-1', text: 'test response', score: 0.3 };

      const result = await service.processAutoApproval(comment, variant, 'test-org');
      
      expect(result.approved).toBe(false);
      expect(result.reason).toBe('transparency_enforcement_failed');
      expect(result.requiresManualReview).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Transparency required but not applied'),
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

  describe('Conservative Toxicity Thresholds', () => {
    test('should use conservative thresholds for auto-approval', () => {
      // Test the new conservative configuration
      expect(service.config.maxToxicityScore).toBe(0.6); // Reduced from 0.7
      
      // Test conservative toxicity validation
      const result1 = service.validateToxicityScore(0.5, 0.3); // Should pass
      expect(result1).toBe(true);
      
      const result2 = service.validateToxicityScore(0.7, 0.3); // Should fail (above 0.6)
      expect(result2).toBe(false);
      
      const result3 = service.validateToxicityScore(0.5, 0.4); // Should fail (increase > 0.15)
      expect(result3).toBe(false);
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
      expect(result.rateLimitId).toMatch(/^rate_\\d+_[a-z0-9]+$/);
    });
  });
});