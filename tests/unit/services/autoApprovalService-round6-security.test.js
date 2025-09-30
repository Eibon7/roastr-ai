/**
 * Auto-Approval Service Round 6 Critical Security Tests
 * Tests for CodeRabbit review #3275898813 feedback implementation
 * 
 * COVERAGE:
 * - Content integrity validation with exact matching
 * - Organization policy validation with fail-closed patterns
 * - Enhanced transparency enforcement
 * - Circuit breaker patterns for external services
 * - Comprehensive error handling with stack traces
 */

const AutoApprovalService = require('../../../src/services/autoApprovalService');
const { jest } = require('@jest/globals');

// Mock external dependencies
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/transparencyService');
jest.mock('../../../src/services/planLimitsService');

describe('AutoApprovalService Round 6 Critical Security Tests', () => {
  let autoApprovalService;
  let mockSupabase;
  let mockLogger;
  let mockTransparencyService;
  let mockPlanLimitsService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn(),
      update: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis()
    };

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Mock transparency service
    mockTransparencyService = {
      isTransparencyRequired: jest.fn(),
      applyTransparency: jest.fn()
    };

    // Mock plan limits service
    mockPlanLimitsService = {
      getPlanLimits: jest.fn(),
      getDailyAutoApprovalLimits: jest.fn()
    };

    require('../../../src/config/supabase').supabaseServiceClient = mockSupabase;
    require('../../../src/utils/logger').logger = mockLogger;
    require('../../../src/services/transparencyService') = mockTransparencyService;
    require('../../../src/services/planLimitsService') = mockPlanLimitsService;

    autoApprovalService = new AutoApprovalService();
  });

  describe('CRITICAL: Content Integrity Validation', () => {
    test('should validate exact content match between approved variant and stored response', async () => {
      const organizationId = 'test-org-123';
      const approvedVariant = { text: 'This is the approved roast response' };
      const storedResponse = { text: 'This is the approved roast response' };

      const result = await autoApprovalService.validateContentIntegrity(
        approvedVariant,
        storedResponse,
        organizationId
      );

      expect(result.valid).toBe(true);
      expect(result.validationId).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Content integrity validation passed',
        expect.objectContaining({
          organizationId,
          validationId: expect.any(String),
          contentLength: approvedVariant.text.length,
          contentHash: expect.any(String)
        })
      );
    });

    test('should fail validation when content does not match exactly', async () => {
      const organizationId = 'test-org-123';
      const approvedVariant = { text: 'This is the approved roast response' };
      const storedResponse = { text: 'This is a DIFFERENT roast response' };

      const result = await autoApprovalService.validateContentIntegrity(
        approvedVariant,
        storedResponse,
        organizationId
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('content_mismatch');
      expect(result.details).toContain('length');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CRITICAL: Content mismatch detected - blocking auto-publication',
        expect.objectContaining({
          organizationId,
          reason: 'content_mismatch',
          securityEvent: 'potential_tampering'
        })
      );
    });

    test('should fail closed when approved variant is missing', async () => {
      const organizationId = 'test-org-123';
      const approvedVariant = null;
      const storedResponse = { text: 'Some response text' };

      const result = await autoApprovalService.validateContentIntegrity(
        approvedVariant,
        storedResponse,
        organizationId
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing_content_data');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CRITICAL: Content validation failed - missing data',
        expect.objectContaining({
          organizationId,
          hasApprovedVariant: false,
          hasStoredResponse: true,
          reason: 'missing_content_data'
        })
      );
    });

    test('should fail closed when stored response is missing', async () => {
      const organizationId = 'test-org-123';
      const approvedVariant = { text: 'Some approved text' };
      const storedResponse = null;

      const result = await autoApprovalService.validateContentIntegrity(
        approvedVariant,
        storedResponse,
        organizationId
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing_content_data');
    });

    test('should handle system errors gracefully and fail closed', async () => {
      const organizationId = 'test-org-123';
      const approvedVariant = { text: 'Test content' };
      const storedResponse = { text: 'Test content' };

      // Mock hash function to throw error
      const originalHash = autoApprovalService.hashContent;
      autoApprovalService.hashContent = jest.fn().mockImplementation(() => {
        throw new Error('Hash function error');
      });

      const result = await autoApprovalService.validateContentIntegrity(
        approvedVariant,
        storedResponse,
        organizationId
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('system_error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CRITICAL: Content validation system error - failing closed',
        expect.objectContaining({
          organizationId,
          error: 'Hash function error',
          stack: expect.any(String),
          reason: 'content_validation_system_error'
        })
      );

      // Restore original function
      autoApprovalService.hashContent = originalHash;
    });

    test('should validate empty text content and fail appropriately', async () => {
      const organizationId = 'test-org-123';
      const approvedVariant = { text: '' };
      const storedResponse = { text: 'Some content' };

      const result = await autoApprovalService.validateContentIntegrity(
        approvedVariant,
        storedResponse,
        organizationId
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('empty_text_content');
    });
  });

  describe('CRITICAL: Organization Policy Validation with Fail-Closed', () => {
    test('should validate organization policies successfully when they exist', async () => {
      const organizationId = 'test-org-123';
      const variant = { text: 'Test roast response' };

      mockSupabase.single.mockResolvedValue({
        data: {
          content_policies: {
            banned_phrases: ['inappropriate']
          },
          auto_approval_rules: {}
        },
        error: null
      });

      const result = await autoApprovalService.validateOrganizationPolicy(
        variant,
        organizationId
      );

      expect(result.valid).toBe(true);
      expect(result.policyValidationId).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('organization_policies');
      expect(mockSupabase.select).toHaveBeenCalledWith('content_policies, auto_approval_rules');
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', organizationId);
    });

    test('should fail closed when organization policy fetch fails', async () => {
      const organizationId = 'test-org-123';
      const variant = { text: 'Test roast response' };

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', code: 'PGRST301' }
      });

      const result = await autoApprovalService.validateOrganizationPolicy(
        variant,
        organizationId
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('policy_fetch_failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CRITICAL: Failed to fetch organization policies - failing closed',
        expect.objectContaining({
          organizationId,
          error: 'Database connection failed',
          errorCode: 'PGRST301',
          stack: expect.any(String),
          reason: 'policy_fetch_failed'
        })
      );
    });

    test('should fail closed when no organization policies found', async () => {
      const organizationId = 'test-org-123';
      const variant = { text: 'Test roast response' };

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await autoApprovalService.validateOrganizationPolicy(
        variant,
        organizationId
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('no_policies_found');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CRITICAL: No organization policies found - failing closed',
        expect.objectContaining({
          organizationId,
          reason: 'no_policies_found'
        })
      );
    });

    test('should validate content against banned phrases policy', async () => {
      const organizationId = 'test-org-123';
      const variant = { text: 'This contains inappropriate content' };

      mockSupabase.single.mockResolvedValue({
        data: {
          content_policies: {
            banned_phrases: ['inappropriate']
          }
        },
        error: null
      });

      const result = await autoApprovalService.validateOrganizationPolicy(
        variant,
        organizationId
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('banned_phrase_detected');
    });

    test('should handle policy fetch timeout and fail closed', async () => {
      const organizationId = 'test-org-123';
      const variant = { text: 'Test content' };

      // Mock timeout by making the promise never resolve
      mockSupabase.single.mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );

      // Override the timeout to be very short for testing
      const originalTimeout = autoApprovalService.config.policyFetchTimeout;
      autoApprovalService.config.policyFetchTimeout = 10;

      const result = await autoApprovalService.validateOrganizationPolicy(
        variant,
        organizationId
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('system_error');
      expect(result.error).toContain('Policy fetch timeout');

      // Restore original timeout
      autoApprovalService.config.policyFetchTimeout = originalTimeout;
    });

    test('should implement circuit breaker pattern for repeated policy failures', async () => {
      const organizationId = 'test-org-123';
      const variant = { text: 'Test content' };

      // Mock consecutive failures
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Connection refused' }
      });

      // First failure
      let result1 = await autoApprovalService.validateOrganizationPolicy(variant, organizationId);
      expect(result1.valid).toBe(false);
      expect(autoApprovalService.circuitBreaker.failures).toBe(1);
      expect(autoApprovalService.circuitBreaker.state).toBe('closed');

      // Simulate more failures to trigger circuit breaker
      for (let i = 0; i < 4; i++) {
        await autoApprovalService.validateOrganizationPolicy(variant, organizationId);
      }

      expect(autoApprovalService.circuitBreaker.state).toBe('open');
      expect(autoApprovalService.circuitBreaker.failures).toBeGreaterThanOrEqual(5);

      // Next call should fail immediately due to open circuit breaker
      const resultOpen = await autoApprovalService.validateOrganizationPolicy(variant, organizationId);
      expect(resultOpen.valid).toBe(false);
      expect(resultOpen.reason).toBe('circuit_breaker_open');
    });
  });

  describe('CRITICAL: Enhanced Transparency Enforcement', () => {
    test('should enforce transparency when required and validate indicators', async () => {
      const organizationId = 'test-org-123';
      const comment = { id: 'comment-123', text: 'Original comment', originalScore: 0.3 };
      const variant = { id: 'variant-123', text: 'Generated response', score: 0.4 };

      // Mock eligibility check
      mockSupabase.select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { plan: 'pro', settings: { auto_approval: true } },
            error: null
          })
        })
      });

      mockPlanLimitsService.getPlanLimits.mockResolvedValue({
        features: { autoApproval: true }
      });

      // Mock rate limits check
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'roast_approvals') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockResolvedValue({
                  data: [],
                  count: 0,
                  error: null
                })
              })
            })
          };
        }
        return mockSupabase;
      });

      mockPlanLimitsService.getDailyAutoApprovalLimits.mockResolvedValue({
        hourly: 50,
        daily: 200,
        plan: 'pro'
      });

      // Mock organization policies
      mockSupabase.single.mockResolvedValue({
        data: { content_policies: null },
        error: null
      });

      // Mock transparency required
      mockTransparencyService.isTransparencyRequired.mockResolvedValue(true);
      mockTransparencyService.applyTransparency.mockResolvedValue({
        text: 'Generated response 🤖',
        transparencyApplied: true
      });

      const result = await autoApprovalService.processAutoApproval(
        comment,
        variant,
        organizationId
      );

      expect(result.approved).toBe(true);
      expect(result.variant.text).toBe('Generated response 🤖');
      expect(mockTransparencyService.isTransparencyRequired).toHaveBeenCalledWith(organizationId);
      expect(mockTransparencyService.applyTransparency).toHaveBeenCalledWith(variant, organizationId);
    });

    test('should fail closed when transparency service fails', async () => {
      const organizationId = 'test-org-123';
      const comment = { id: 'comment-123', text: 'Original comment', originalScore: 0.3 };
      const variant = { id: 'variant-123', text: 'Generated response', score: 0.4 };

      // Mock basic setup similar to above test
      mockSupabase.select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { plan: 'pro', settings: { auto_approval: true } },
            error: null
          })
        })
      });

      mockPlanLimitsService.getPlanLimits.mockResolvedValue({
        features: { autoApproval: true }
      });

      // Mock transparency service failure
      mockTransparencyService.isTransparencyRequired.mockResolvedValue(true);
      mockTransparencyService.applyTransparency.mockRejectedValue(
        new Error('Transparency service unavailable')
      );

      const result = await autoApprovalService.processAutoApproval(
        comment,
        variant,
        organizationId
      );

      expect(result.approved).toBe(false);
      expect(result.reason).toBe('transparency_system_error');
      expect(result.requiresManualReview).toBe(true);
      expect(result.error).toContain('CRITICAL: Transparency system error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CRITICAL: Error in transparency enforcement - failing closed',
        expect.objectContaining({
          organizationId,
          error: 'Transparency service unavailable',
          stack: expect.any(String),
          reason: 'transparency_system_error'
        })
      );
    });

    test('should fail when transparency required but not applied', async () => {
      const organizationId = 'test-org-123';
      const comment = { id: 'comment-123', text: 'Original comment', originalScore: 0.3 };
      const variant = { id: 'variant-123', text: 'Generated response', score: 0.4 };

      // Mock setup
      mockSupabase.select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { plan: 'pro', settings: { auto_approval: true } },
            error: null
          })
        })
      });

      mockPlanLimitsService.getPlanLimits.mockResolvedValue({
        features: { autoApproval: true }
      });

      // Mock transparency required but not applied (same text returned)
      mockTransparencyService.isTransparencyRequired.mockResolvedValue(true);
      mockTransparencyService.applyTransparency.mockResolvedValue({
        text: 'Generated response', // Same as original - transparency not applied
        transparencyApplied: false
      });

      const result = await autoApprovalService.processAutoApproval(
        comment,
        variant,
        organizationId
      );

      expect(result.approved).toBe(false);
      expect(result.reason).toBe('transparency_not_applied');
      expect(result.error).toContain('CRITICAL: Required transparency was not applied to content');
    });

    test('should validate transparency indicators and fail if missing', async () => {
      const organizationId = 'test-org-123';
      const comment = { id: 'comment-123', text: 'Original comment', originalScore: 0.3 };
      const variant = { id: 'variant-123', text: 'Generated response', score: 0.4 };

      // Mock setup similar to previous tests
      mockSupabase.select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { plan: 'pro', settings: { auto_approval: true } },
            error: null
          })
        })
      });

      mockPlanLimitsService.getPlanLimits.mockResolvedValue({
        features: { autoApproval: true }
      });

      // Mock transparency applied but without valid indicators
      mockTransparencyService.isTransparencyRequired.mockResolvedValue(true);
      mockTransparencyService.applyTransparency.mockResolvedValue({
        text: 'Generated response with disclaimer', // No robot emoji or AI indicators
        transparencyApplied: true
      });

      const result = await autoApprovalService.processAutoApproval(
        comment,
        variant,
        organizationId
      );

      expect(result.approved).toBe(false);
      expect(result.reason).toBe('transparency_indicators_missing');
      expect(result.error).toContain('CRITICAL: Transparency indicators not detected in content');
    });
  });

  describe('Transparency Indicator Validation', () => {
    test('should detect robot emoji indicator', () => {
      const textWithRobot = 'This is a generated response 🤖';
      const result = autoApprovalService.validateTransparencyIndicators(textWithRobot);
      expect(result).toBe(true);
    });

    test('should detect AI keyword indicator', () => {
      const textWithAI = 'This is a generated AI response';
      const result = autoApprovalService.validateTransparencyIndicators(textWithAI);
      expect(result).toBe(true);
    });

    test('should detect multiple indicators', () => {
      const textWithMultiple = 'This automated AI response was generated by bot algorithms 🤖';
      const result = autoApprovalService.validateTransparencyIndicators(textWithMultiple);
      expect(result).toBe(true);
    });

    test('should fail when no indicators present', () => {
      const textWithoutIndicators = 'This is just a normal response';
      const result = autoApprovalService.validateTransparencyIndicators(textWithoutIndicators);
      expect(result).toBe(false);
    });

    test('should handle null or undefined text', () => {
      expect(autoApprovalService.validateTransparencyIndicators(null)).toBe(false);
      expect(autoApprovalService.validateTransparencyIndicators(undefined)).toBe(false);
      expect(autoApprovalService.validateTransparencyIndicators('')).toBe(false);
    });
  });

  describe('Content Hash Generation', () => {
    test('should generate consistent hashes for same content', () => {
      const content = 'This is test content for hashing';
      const hash1 = autoApprovalService.hashContent(content);
      const hash2 = autoApprovalService.hashContent(content);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe('empty');
    });

    test('should generate different hashes for different content', () => {
      const content1 = 'This is first content';
      const content2 = 'This is second content';
      const hash1 = autoApprovalService.hashContent(content1);
      const hash2 = autoApprovalService.hashContent(content2);
      expect(hash1).not.toBe(hash2);
    });

    test('should handle empty content', () => {
      expect(autoApprovalService.hashContent('')).toBe('empty');
      expect(autoApprovalService.hashContent(null)).toBe('empty');
      expect(autoApprovalService.hashContent(undefined)).toBe('empty');
    });
  });

  describe('Circuit Breaker Functionality', () => {
    test('should reset circuit breaker on successful operations', async () => {
      const organizationId = 'test-org-123';
      const variant = { text: 'Test content' };

      // Set up successful policy validation
      mockSupabase.single.mockResolvedValue({
        data: { content_policies: null },
        error: null
      });

      // Initial state should be closed
      expect(autoApprovalService.circuitBreaker.state).toBe('closed');
      expect(autoApprovalService.circuitBreaker.failures).toBe(0);

      const result = await autoApprovalService.validateOrganizationPolicy(variant, organizationId);

      expect(result.valid).toBe(true);
      expect(autoApprovalService.circuitBreaker.failures).toBe(0);
      expect(autoApprovalService.circuitBreaker.state).toBe('closed');
    });
  });

  describe('Error Logging and Stack Traces', () => {
    test('should log stack traces for all critical errors', async () => {
      const organizationId = 'test-org-123';
      const variant = { text: 'Test content' };

      // Mock a database error with stack trace
      const dbError = new Error('Database connection failed');
      dbError.stack = 'Error: Database connection failed\n    at test line 1\n    at test line 2';

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: dbError
      });

      await autoApprovalService.validateOrganizationPolicy(variant, organizationId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'CRITICAL: Failed to fetch organization policies - failing closed',
        expect.objectContaining({
          organizationId,
          error: 'Database connection failed',
          stack: expect.stringContaining('at test line'),
          reason: 'policy_fetch_failed'
        })
      );
    });

    test('should handle missing stack traces gracefully', async () => {
      const organizationId = 'test-org-123';
      const variant = { text: 'Test content' };

      const dbError = new Error('Database error');
      // Intentionally not setting stack property

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: dbError
      });

      await autoApprovalService.validateOrganizationPolicy(variant, organizationId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'CRITICAL: Failed to fetch organization policies - failing closed',
        expect.objectContaining({
          organizationId,
          error: 'Database error',
          stack: 'no stack trace', // Should provide fallback
          reason: 'policy_fetch_failed'
        })
      );
    });
  });
});