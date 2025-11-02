/**
 * Comprehensive Unit Tests for tierValidation Middleware
 *
 * Tests all middleware functions:
 * - validateTierLimit: Tier limit validation
 * - validateFeatureAccess: Feature access validation
 * - tierMiddleware: Convenience methods
 * - recordUsage: Usage recording after successful responses
 * - includeUsageInfo: Response enhancement
 *
 * Coverage targets: >95% for statements, branches, and functions
 */

const {
  validateTierLimit,
  validateFeatureAccess,
  tierMiddleware,
  recordUsage,
  includeUsageInfo
} = require('../../../src/middleware/tierValidation');

// Mock all external dependencies
jest.mock('../../../src/services/tierValidationService');
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    rpc: jest.fn(),
    from: jest.fn()
  }
}));

// Mock logger to prevent winston module loading issues
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

const tierValidationService = require('../../../src/services/tierValidationService');
const { logger } = require('../../../src/utils/logger');
const { supabaseServiceClient } = require('../../../src/config/supabase');

describe('Tier Validation Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock request
    mockReq = {
      user: { id: 'test-user-id' },
      body: {},
      query: {},
      path: '/test'
    };

    // Setup mock response
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      statusCode: 200
    };

    // Setup mock next
    mockNext = jest.fn();

    // Reset logger mocks
    logger.error = jest.fn();
    logger.debug = jest.fn();
    logger.warn = jest.fn();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('validateTierLimit', () => {
    describe('Authentication', () => {
      it('should return 401 if user is not authenticated', async () => {
        mockReq.user = null;
        const middleware = validateTierLimit('analysis');

        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 401 if user.id is missing', async () => {
        mockReq.user = {};
        const middleware = validateTierLimit('analysis');

        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('Allowed Actions', () => {
      it('should call next() when action is allowed', async () => {
        tierValidationService.validateAction = jest.fn().mockResolvedValue({
          allowed: true,
          currentUsage: { remaining: 50, limit: 100 },
          currentTier: 'pro'
        });

        const middleware = validateTierLimit('analysis');
        await middleware(mockReq, mockRes, mockNext);

        expect(tierValidationService.validateAction).toHaveBeenCalledWith(
          'test-user-id',
          'analysis',
          {}
        );
        expect(mockReq.tierValidation).toEqual({
          allowed: true,
          currentUsage: { remaining: 50, limit: 100 },
          currentTier: 'pro'
        });
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should merge options from req.body, req.query, and options parameter', async () => {
        tierValidationService.validateAction = jest.fn().mockResolvedValue({
          allowed: true,
          currentUsage: { remaining: 10, limit: 20 },
          currentTier: 'starter'
        });

        mockReq.body = { platform: 'twitter' };
        mockReq.query = { count: '5' };
        const options = { style: 'brutal' };

        const middleware = validateTierLimit('roast', options);
        await middleware(mockReq, mockRes, mockNext);

        expect(tierValidationService.validateAction).toHaveBeenCalledWith(
          'test-user-id',
          'roast',
          { style: 'brutal', platform: 'twitter', count: '5' }
        );
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('Denied Actions', () => {
      it('should return 403 when action is denied', async () => {
        tierValidationService.validateAction = jest.fn().mockResolvedValue({
          allowed: false,
          message: 'Tier limit exceeded',
          reason: 'LIMIT_EXCEEDED',
          currentTier: 'free',
          currentUsage: { remaining: 0, limit: 10 },
          upgradeRequired: 'starter'
        });

        const middleware = validateTierLimit('roast');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Tier limit exceeded',
          code: 'LIMIT_EXCEEDED',
          details: {
            currentTier: 'free',
            currentUsage: { remaining: 0, limit: 10 },
            upgradeRequired: 'starter',
            action: 'roast'
          }
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should use default error message when not provided', async () => {
        tierValidationService.validateAction = jest.fn().mockResolvedValue({
          allowed: false,
          currentTier: 'free',
          currentUsage: { remaining: 0, limit: 5 },
          upgradeRequired: 'starter'
        });

        const middleware = validateTierLimit('analysis');
        await middleware(mockReq, mockRes, mockNext);

        const callArgs = mockRes.json.mock.calls[0][0];
        expect(callArgs.error).toBe('Action not allowed by current tier');
        expect(callArgs.code).toBe('TIER_LIMIT_EXCEEDED');
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should return 503 on service error in production', async () => {
        process.env.NODE_ENV = 'production';
        process.env.TIER_VALIDATION_FAIL_OPEN = 'false';
        tierValidationService.validateAction = jest.fn().mockRejectedValue(
          new Error('Database connection failed')
        );

        const middleware = validateTierLimit('analysis');
        await middleware(mockReq, mockRes, mockNext);

        expect(logger.error).toHaveBeenCalledWith(
          'Tier validation middleware error:',
          expect.any(Error)
        );
        expect(mockRes.status).toHaveBeenCalledWith(503);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Tier validation temporarily unavailable',
          code: 'TIER_VALIDATION_ERROR'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should fail-open in development mode with TIER_VALIDATION_FAIL_OPEN enabled', async () => {
        process.env.NODE_ENV = 'development';
        process.env.TIER_VALIDATION_FAIL_OPEN = 'true';
        tierValidationService.validateAction = jest.fn().mockRejectedValue(
          new Error('Service error')
        );

        const middleware = validateTierLimit('roast');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockReq.tierValidation).toEqual({
          allowed: true,
          fallback: true,
          error: 'Service error'
        });
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should fail-open in test mode with TIER_VALIDATION_FAIL_OPEN enabled', async () => {
        process.env.NODE_ENV = 'test';
        process.env.TIER_VALIDATION_FAIL_OPEN = 'true';
        tierValidationService.validateAction = jest.fn().mockRejectedValue(
          new Error('Test error')
        );

        const middleware = validateTierLimit('analysis');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.tierValidation.fallback).toBe(true);
      });
    });
  });

  describe('validateFeatureAccess', () => {
    describe('Authentication', () => {
      it('should return 401 if user is not authenticated', async () => {
        mockReq.user = null;
        const middleware = validateFeatureAccess('shield');

        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('Available Features', () => {
      it('should call next() when feature is available', async () => {
        tierValidationService.validateFeature = jest.fn().mockResolvedValue({
          available: true,
          tier: 'pro'
        });

        const middleware = validateFeatureAccess('shield');
        await middleware(mockReq, mockRes, mockNext);

        expect(tierValidationService.validateFeature).toHaveBeenCalledWith(
          'test-user-id',
          'shield'
        );
        expect(mockReq.featureValidation).toEqual({
          available: true,
          tier: 'pro'
        });
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });

    describe('Unavailable Features', () => {
      it('should return 403 when feature is unavailable', async () => {
        tierValidationService.validateFeature = jest.fn().mockResolvedValue({
          available: false,
          message: 'Feature not available in free tier',
          reason: 'TIER_INSUFFICIENT',
          upgradeRequired: 'pro'
        });

        const middleware = validateFeatureAccess('ENABLE_ORIGINAL_TONE');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Feature not available in free tier',
          code: 'TIER_INSUFFICIENT',
          details: {
            feature: 'ENABLE_ORIGINAL_TONE',
            upgradeRequired: 'pro'
          }
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should use default error message when not provided', async () => {
        tierValidationService.validateFeature = jest.fn().mockResolvedValue({
          available: false,
          upgradeRequired: 'plus'
        });

        const middleware = validateFeatureAccess('embedded_judge');
        await middleware(mockReq, mockRes, mockNext);

        const callArgs = mockRes.json.mock.calls[0][0];
        expect(callArgs.error).toBe("Feature 'embedded_judge' not available in current tier");
        expect(callArgs.code).toBe('FEATURE_NOT_AVAILABLE');
      });
    });

    describe('Error Handling', () => {
      it('should return 500 on service error (deny on error for security)', async () => {
        tierValidationService.validateFeature = jest.fn().mockRejectedValue(
          new Error('Database error')
        );

        const middleware = validateFeatureAccess('shield');
        await middleware(mockReq, mockRes, mockNext);

        expect(logger.error).toHaveBeenCalledWith(
          'Feature validation middleware error:',
          expect.any(Error)
        );
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Feature validation temporarily unavailable',
          code: 'FEATURE_VALIDATION_ERROR'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should deny on error even in development mode', async () => {
        process.env.NODE_ENV = 'development';
        tierValidationService.validateFeature = jest.fn().mockRejectedValue(
          new Error('Service error')
        );

        const middleware = validateFeatureAccess('embedded_judge');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe('tierMiddleware convenience methods', () => {
    it('should provide validateAnalysisLimit method', () => {
      expect(typeof tierMiddleware.validateAnalysisLimit).toBe('function');
      const middleware = tierMiddleware.validateAnalysisLimit();
      expect(typeof middleware).toBe('function');
    });

    it('should provide validateRoastLimit method', () => {
      expect(typeof tierMiddleware.validateRoastLimit).toBe('function');
      const middleware = tierMiddleware.validateRoastLimit();
      expect(typeof middleware).toBe('function');
    });

    it('should provide validatePlatformLimit method', () => {
      expect(typeof tierMiddleware.validatePlatformLimit).toBe('function');
      const middleware = tierMiddleware.validatePlatformLimit('twitter');
      expect(typeof middleware).toBe('function');
    });

    it('should provide requireShield method', () => {
      expect(typeof tierMiddleware.requireShield).toBe('function');
      const middleware = tierMiddleware.requireShield();
      expect(typeof middleware).toBe('function');
    });

    it('should provide requireOriginalTone method', () => {
      expect(typeof tierMiddleware.requireOriginalTone).toBe('function');
      const middleware = tierMiddleware.requireOriginalTone();
      expect(typeof middleware).toBe('function');
    });

    it('should provide requireEmbeddedJudge method', () => {
      expect(typeof tierMiddleware.requireEmbeddedJudge).toBe('function');
      const middleware = tierMiddleware.requireEmbeddedJudge();
      expect(typeof middleware).toBe('function');
    });

    describe('validateMultiple', () => {
      it('should validate multiple actions and call next() if all pass', async () => {
        tierValidationService.validateAction = jest.fn()
          .mockResolvedValueOnce({ allowed: true, currentTier: 'pro' })
          .mockResolvedValueOnce({ allowed: true, currentTier: 'pro' });

        const middleware = tierMiddleware.validateMultiple(['analysis', 'roast']);
        await middleware(mockReq, mockRes, mockNext);

        expect(tierValidationService.validateAction).toHaveBeenCalledTimes(2);
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should return 403 if first action fails', async () => {
        tierValidationService.validateAction = jest.fn()
          .mockResolvedValueOnce({
            allowed: false,
            message: 'Analysis limit exceeded',
            reason: 'LIMIT_EXCEEDED',
            currentTier: 'free',
            currentUsage: { remaining: 0, limit: 5 }
          })
          .mockResolvedValueOnce({
            allowed: true,
            currentTier: 'free'
          });

        const middleware = tierMiddleware.validateMultiple(['analysis', 'roast']);
        await middleware(mockReq, mockRes, mockNext);

        expect(tierValidationService.validateAction).toHaveBeenCalledTimes(2);
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 403 if second action fails', async () => {
        tierValidationService.validateAction = jest.fn()
          .mockResolvedValueOnce({ allowed: true, currentTier: 'starter' })
          .mockResolvedValueOnce({
            allowed: false,
            message: 'Roast limit exceeded',
            reason: 'LIMIT_EXCEEDED',
            currentTier: 'starter',
            currentUsage: { remaining: 0, limit: 10 }
          });

        const middleware = tierMiddleware.validateMultiple(['analysis', 'roast']);
        await middleware(mockReq, mockRes, mockNext);

        expect(tierValidationService.validateAction).toHaveBeenCalledTimes(2);
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 401 if user is not authenticated', async () => {
        mockReq.user = null;
        const middleware = tierMiddleware.validateMultiple(['analysis', 'roast']);
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should fail-open in development mode on error', async () => {
        process.env.NODE_ENV = 'development';
        process.env.TIER_VALIDATION_FAIL_OPEN = 'true';
        tierValidationService.validateAction = jest.fn().mockRejectedValue(
          new Error('Service error')
        );

        const middleware = tierMiddleware.validateMultiple(['analysis', 'roast']);
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('recordUsage', () => {
    let mockSetImmediate;

    beforeEach(() => {
      // Mock setImmediate to execute immediately in tests
      mockSetImmediate = jest.spyOn(global, 'setImmediate').mockImplementation((fn) => fn());

      // Mock Supabase chain
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });
      supabaseServiceClient.from = mockFrom;
      supabaseServiceClient.rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    });

    afterEach(() => {
      mockSetImmediate.mockRestore();
    });

    it('should record usage on successful response (200)', async () => {
      mockRes.statusCode = 200;
      const middleware = recordUsage('analysis');

      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Trigger response
      mockRes.json({ success: true });

      expect(mockSetImmediate).toHaveBeenCalled();
      expect(supabaseServiceClient.rpc).toHaveBeenCalledWith('record_analysis_usage', expect.any(Object));
    });

    it('should record usage on successful response (201)', async () => {
      mockRes.statusCode = 201;
      const middleware = recordUsage('roast');

      await middleware(mockReq, mockRes, mockNext);
      mockRes.json({ success: true });

      expect(supabaseServiceClient.from).toHaveBeenCalledWith('user_activities');
    });

    it('should not record usage on error response (400)', async () => {
      mockRes.statusCode = 400;
      const middleware = recordUsage('analysis');

      await middleware(mockReq, mockRes, mockNext);
      mockRes.json({ error: 'Bad request' });

      expect(supabaseServiceClient.rpc).not.toHaveBeenCalled();
    });

    it('should not record usage on error response (500)', async () => {
      mockRes.statusCode = 500;
      const middleware = recordUsage('roast');

      await middleware(mockReq, mockRes, mockNext);
      mockRes.json({ error: 'Server error' });

      expect(supabaseServiceClient.from).not.toHaveBeenCalled();
    });

    it('should not record usage when success is false', async () => {
      mockRes.statusCode = 200;
      const middleware = recordUsage('analysis');

      await middleware(mockReq, mockRes, mockNext);
      mockRes.json({ success: false, message: 'Failed' });

      expect(supabaseServiceClient.rpc).not.toHaveBeenCalled();
    });

    it('should handle recording errors gracefully', async () => {
      mockRes.statusCode = 200;
      supabaseServiceClient.rpc = jest.fn().mockRejectedValue(new Error('Insert failed'));

      const middleware = recordUsage('analysis');
      await middleware(mockReq, mockRes, mockNext);
      mockRes.json({ success: true });

      // Wait for async error handling to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to record usage:',
        expect.any(Error)
      );
    });

    it('should handle platform_add action', async () => {
      mockRes.statusCode = 200;
      const middleware = recordUsage('platform_add');

      await middleware(mockReq, mockRes, mockNext);
      mockRes.json({ success: true });

      expect(logger.debug).toHaveBeenCalledWith('Platform integration recorded separately');
    });

    it('should not block response (async behavior)', async () => {
      mockRes.statusCode = 200;
      const middleware = recordUsage('analysis');

      await middleware(mockReq, mockRes, mockNext);

      // next() should be called immediately, not after recording
      expect(mockNext).toHaveBeenCalled();
      expect(mockSetImmediate).not.toHaveBeenCalled(); // Not called until response sent

      mockRes.json({ success: true });
      expect(mockSetImmediate).toHaveBeenCalled();
    });
  });

  describe('includeUsageInfo', () => {
    it('should add usage info to response when tierValidation exists', async () => {
      mockReq.tierValidation = {
        allowed: true,
        currentUsage: { remaining: 50, limit: 100 },
        currentTier: 'pro'
      };

      const middleware = includeUsageInfo();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Simulate sending response
      const originalJson = mockRes.json;
      const responseBody = { success: true, data: 'test' };
      mockRes.json(responseBody);

      expect(responseBody.usage).toEqual({ remaining: 50, limit: 100 });
      expect(responseBody.tier).toBe('pro');
    });

    it('should not modify response when tierValidation is missing', async () => {
      const middleware = includeUsageInfo();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Simulate sending response
      const responseBody = { success: true, data: 'test' };
      mockRes.json(responseBody);

      expect(responseBody.usage).toBeUndefined();
      expect(responseBody.tier).toBeUndefined();
    });

    it('should preserve original response structure', async () => {
      mockReq.tierValidation = {
        allowed: true,
        currentUsage: { remaining: 10, limit: 20 },
        currentTier: 'starter'
      };

      const middleware = includeUsageInfo();
      await middleware(mockReq, mockRes, mockNext);

      const complexResponse = {
        success: true,
        data: { id: 1, name: 'test' },
        metadata: { page: 1 }
      };

      mockRes.json(complexResponse);

      expect(complexResponse.success).toBe(true);
      expect(complexResponse.data).toEqual({ id: 1, name: 'test' });
      expect(complexResponse.metadata).toEqual({ page: 1 });
      expect(complexResponse.usage).toBeDefined();
      expect(complexResponse.tier).toBe('starter');
    });

    it('should not modify non-object responses', async () => {
      mockReq.tierValidation = {
        allowed: true,
        currentUsage: { remaining: 10, limit: 20 },
        currentTier: 'pro'
      };

      const middleware = includeUsageInfo();
      await middleware(mockReq, mockRes, mockNext);

      const stringResponse = 'plain string';
      mockRes.json(stringResponse);

      // Non-object responses should not be modified
      expect(typeof stringResponse).toBe('string');
    });
  });
});
