/**
 * Credits Middleware Unit Tests
 * 
 * Tests for credit verification and consumption middleware
 * including error handling, feature flag integration, and
 * proper HTTP response codes.
 */

const { 
  requireAnalysisCredits, 
  requireRoastCredits, 
  requireBothCredits 
} = require('../../../src/middleware/requireCredits');
const creditsService = require('../../../src/services/creditsService');
const { flags } = require('../../../src/config/flags');

// Mock dependencies
jest.mock('../../../src/services/creditsService', () => ({
    canConsume: jest.fn(),
    consume: jest.fn(),
    getOrCreateActivePeriod: jest.fn()
}));
jest.mock('../../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn()
    }
}));
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Credits Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    
    req = {
      user: { id: 'test-user-123' },
      body: { platform: 'twitter' },
      route: { path: '/api/test' },
      method: 'POST',
      path: '/api/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent')
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
    
    // Default: Credits v2 enabled
    flags.isEnabled.mockImplementation((flag) => {
      if (flag === 'ENABLE_CREDITS_V2') return true;
      return false;
    });
  });

  describe('requireAnalysisCredits', () => {
    it('should pass when sufficient credits available', async () => {
      creditsService.canConsume.mockResolvedValue({
        canConsume: true,
        remaining: 9950,
        limit: 10000,
        used: 50
      });
      
      creditsService.consume.mockResolvedValue(true);

      const middleware = requireAnalysisCredits({ amount: 5, actionType: 'gatekeeper_check' });
      await middleware(req, res, next);

      expect(creditsService.canConsume).toHaveBeenCalledWith('test-user-123', 'analysis', 5);
      expect(creditsService.consume).toHaveBeenCalledWith('test-user-123', 'analysis', {
        amount: 5,
        actionType: 'gatekeeper_check',
        platform: 'twitter',
        metadata: expect.objectContaining({
          endpoint: '/api/test',
          method: 'POST'
        })
      });
      expect(req.creditsConsumed).toEqual({ analysis: 5 });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 402 when insufficient credits', async () => {
      creditsService.canConsume.mockResolvedValue({
        canConsume: false,
        remaining: 5,
        limit: 10000,
        used: 9995,
        periodEnd: '2024-02-01T00:00:00Z'
      });

      const middleware = requireAnalysisCredits({ amount: 10 });
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient analysis credits',
        code: 'INSUFFICIENT_ANALYSIS_CREDITS',
        data: {
          creditType: 'analysis',
          required: 10,
          remaining: 5,
          limit: 10000,
          periodEnd: '2024-02-01T00:00:00Z'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should skip when credits v2 is disabled', async () => {
      flags.isEnabled.mockReturnValue(false);

      const middleware = requireAnalysisCredits();
      await middleware(req, res, next);

      expect(creditsService.canConsume).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 when user not authenticated', async () => {
      req.user = null;

      const middleware = requireAnalysisCredits();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    });

    it('should handle pre-check mode', async () => {
      creditsService.canConsume.mockResolvedValue({
        canConsume: true,
        remaining: 9950
      });

      const middleware = requireAnalysisCredits({ preCheck: true });
      await middleware(req, res, next);

      expect(creditsService.canConsume).toHaveBeenCalled();
      expect(creditsService.consume).not.toHaveBeenCalled();
      expect(req.creditsPreChecked).toEqual({
        analysis: { amount: 1, available: true }
      });
      expect(next).toHaveBeenCalled();
    });

    it('should fail open on service errors', async () => {
      creditsService.canConsume.mockRejectedValue(new Error('Service error'));

      const middleware = requireAnalysisCredits();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('requireRoastCredits', () => {
    it('should pass when sufficient roast credits available', async () => {
      creditsService.canConsume.mockResolvedValue({
        canConsume: true,
        remaining: 995,
        limit: 1000,
        used: 5
      });
      
      creditsService.consume.mockResolvedValue(true);

      const middleware = requireRoastCredits({ amount: 1, actionType: 'roast_generation' });
      await middleware(req, res, next);

      expect(creditsService.canConsume).toHaveBeenCalledWith('test-user-123', 'roast', 1);
      expect(creditsService.consume).toHaveBeenCalledWith('test-user-123', 'roast', {
        amount: 1,
        actionType: 'roast_generation',
        platform: 'twitter',
        metadata: expect.objectContaining({
          endpoint: '/api/test'
        })
      });
      expect(req.creditsConsumed).toEqual({ roast: 1 });
      expect(next).toHaveBeenCalled();
    });

    it('should return 402 when insufficient roast credits', async () => {
      creditsService.canConsume.mockResolvedValue({
        canConsume: false,
        remaining: 0,
        limit: 1000,
        used: 1000,
        periodEnd: '2024-02-01T00:00:00Z'
      });

      const middleware = requireRoastCredits({ amount: 1 });
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient roast credits',
        code: 'INSUFFICIENT_ROAST_CREDITS',
        data: {
          creditType: 'roast',
          required: 1,
          remaining: 0,
          limit: 1000,
          periodEnd: '2024-02-01T00:00:00Z'
        }
      });
    });
  });

  describe('requireBothCredits', () => {
    it('should pass when both credit types are sufficient', async () => {
      creditsService.canConsume
        .mockResolvedValueOnce({ canConsume: true, remaining: 9950 }) // analysis
        .mockResolvedValueOnce({ canConsume: true, remaining: 995 }); // roast
      
      creditsService.consume
        .mockResolvedValueOnce(true) // analysis
        .mockResolvedValueOnce(true); // roast

      const middleware = requireBothCredits({
        analysisAmount: 5,
        roastAmount: 1,
        actionType: 'full_roast_workflow'
      });
      
      await middleware(req, res, next);

      expect(creditsService.canConsume).toHaveBeenCalledTimes(2);
      expect(creditsService.consume).toHaveBeenCalledTimes(2);
      expect(req.creditsConsumed).toEqual({
        analysis: 5,
        roast: 1
      });
      expect(next).toHaveBeenCalled();
    });

    it('should return 402 when analysis credits insufficient', async () => {
      creditsService.canConsume
        .mockResolvedValueOnce({ 
          canConsume: false, 
          remaining: 2,
          limit: 10000,
          periodEnd: '2024-02-01T00:00:00Z'
        }) // analysis
        .mockResolvedValueOnce({ canConsume: true, remaining: 995 }); // roast

      const middleware = requireBothCredits({
        analysisAmount: 5,
        roastAmount: 1
      });
      
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient analysis credits',
        code: 'INSUFFICIENT_ANALYSIS_CREDITS',
        data: {
          creditType: 'analysis',
          required: 5,
          remaining: 2,
          limit: 10000,
          periodEnd: '2024-02-01T00:00:00Z'
        }
      });
      expect(creditsService.consume).not.toHaveBeenCalled();
    });

    it('should return 402 when roast credits insufficient', async () => {
      creditsService.canConsume
        .mockResolvedValueOnce({ canConsume: true, remaining: 9950 }) // analysis
        .mockResolvedValueOnce({ 
          canConsume: false, 
          remaining: 0,
          limit: 1000,
          periodEnd: '2024-02-01T00:00:00Z'
        }); // roast

      const middleware = requireBothCredits({
        analysisAmount: 5,
        roastAmount: 1
      });
      
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient roast credits',
        code: 'INSUFFICIENT_ROAST_CREDITS',
        data: {
          creditType: 'roast',
          required: 1,
          remaining: 0,
          limit: 1000,
          periodEnd: '2024-02-01T00:00:00Z'
        }
      });
    });

    it('should handle consumption failure', async () => {
      creditsService.canConsume
        .mockResolvedValueOnce({ canConsume: true, remaining: 9950 })
        .mockResolvedValueOnce({ canConsume: true, remaining: 995 });
      
      creditsService.consume
        .mockResolvedValueOnce(true) // analysis succeeds
        .mockResolvedValueOnce(false); // roast fails

      const middleware = requireBothCredits();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to consume required credits',
        code: 'CREDIT_CONSUMPTION_FAILED',
        data: {
          analysisConsumed: true,
          roastConsumed: false
        }
      });
    });
  });
});
