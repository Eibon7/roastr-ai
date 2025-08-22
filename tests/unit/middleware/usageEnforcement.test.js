/**
 * Unit tests for UsageEnforcementMiddleware - Issue #168
 * Tests usage limit checking, enforcement, and feature access control
 */

const { UsageEnforcementMiddleware, initializeUsageEnforcement } = require('../../../src/middleware/usageEnforcement');
const EntitlementsService = require('../../../src/services/entitlementsService');

// Mock dependencies
jest.mock('../../../src/services/entitlementsService');
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('UsageEnforcementMiddleware', () => {
    let middleware;
    let mockEntitlementsService;
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock EntitlementsService
        mockEntitlementsService = {
            checkUsageLimit: jest.fn(),
            incrementUsage: jest.fn(),
            getUsageSummary: jest.fn(),
            getEntitlements: jest.fn()
        };
        EntitlementsService.mockImplementation(() => mockEntitlementsService);

        middleware = new UsageEnforcementMiddleware();

        // Mock Express request, response, and next
        mockReq = {
            user: { id: 'test-user-123' },
            app: {
                locals: {
                    entitlementsService: mockEntitlementsService
                }
            }
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        mockNext = jest.fn();
    });

    describe('constructor', () => {
        it('should create an instance with EntitlementsService', () => {
            expect(EntitlementsService).toHaveBeenCalled();
            expect(middleware.entitlementsService).toBeDefined();
        });
    });

    describe('checkLimit', () => {
        it('should allow action when under limit', async () => {
            mockEntitlementsService.checkUsageLimit.mockResolvedValue({
                allowed: true,
                used: 50,
                limit: 100,
                remaining: 50,
                error: null
            });

            const checkMiddleware = middleware.checkLimit('analysis');
            await checkMiddleware(mockReq, mockRes, mockNext);

            expect(mockEntitlementsService.checkUsageLimit).toHaveBeenCalledWith('test-user-123', 'analysis');
            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
            expect(mockReq.usageLimitInfo.allowed).toBe(true);
        });

        it('should deny action when limit exceeded', async () => {
            mockEntitlementsService.checkUsageLimit.mockResolvedValue({
                allowed: false,
                used: 100,
                limit: 100,
                remaining: 0,
                period_end: '2024-01-31',
                unlimited: false,
                error: null
            });

            const checkMiddleware = middleware.checkLimit('roasts');
            await checkMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Monthly roasts limit reached',
                code: 'LIMIT_REACHED',
                details: {
                    action_type: 'roasts',
                    used: 100,
                    limit: 100,
                    period_end: '2024-01-31',
                    unlimited: false
                }
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should deny access when user is not authenticated', async () => {
            mockReq.user = null;

            const checkMiddleware = middleware.checkLimit('analysis');
            await checkMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle usage check errors gracefully', async () => {
            mockEntitlementsService.checkUsageLimit.mockResolvedValue({
                error: 'Database connection failed',
                allowed: false
            });

            const checkMiddleware = middleware.checkLimit('analysis');
            await checkMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Usage validation failed',
                code: 'USAGE_CHECK_FAILED'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle exceptions during usage check', async () => {
            mockEntitlementsService.checkUsageLimit.mockRejectedValue(new Error('Network timeout'));

            const checkMiddleware = middleware.checkLimit('analysis');
            await checkMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Usage validation failed',
                code: 'USAGE_CHECK_FAILED'
            });
        });
    });

    describe('incrementUsage', () => {
        it('should increment usage after successful response', async () => {
            mockEntitlementsService.incrementUsage.mockResolvedValue({
                success: true,
                incremented_by: 1
            });

            const incrementMiddleware = middleware.incrementUsage('analysis', 1);
            await incrementMiddleware(mockReq, mockRes, mockNext);

            // Simulate successful response
            await mockRes.json({ success: true, data: 'test' });

            expect(mockEntitlementsService.incrementUsage).toHaveBeenCalledWith('test-user-123', 'analysis', 1);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should not increment usage on failed response', async () => {
            const incrementMiddleware = middleware.incrementUsage('roasts', 2);
            await incrementMiddleware(mockReq, mockRes, mockNext);

            // Simulate failed response
            await mockRes.json({ success: false, error: 'Request failed' });

            expect(mockEntitlementsService.incrementUsage).not.toHaveBeenCalled();
        });

        it('should not increment usage when user is not authenticated', async () => {
            mockReq.user = null;

            const incrementMiddleware = middleware.incrementUsage('analysis');
            await incrementMiddleware(mockReq, mockRes, mockNext);

            await mockRes.json({ success: true });

            expect(mockEntitlementsService.incrementUsage).not.toHaveBeenCalled();
        });

        it('should handle increment errors gracefully', async () => {
            mockEntitlementsService.incrementUsage.mockResolvedValue({
                success: false,
                error: 'Database write failed'
            });

            const incrementMiddleware = middleware.incrementUsage('analysis');
            await incrementMiddleware(mockReq, mockRes, mockNext);

            // Should not throw error, just log it
            await mockRes.json({ success: true });

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('enforceUsage', () => {
        it('should return array of middleware functions', () => {
            const middlewares = middleware.enforceUsage('analysis', 1);

            expect(Array.isArray(middlewares)).toBe(true);
            expect(middlewares).toHaveLength(2);
        });

        it('should check limit and increment usage in sequence', async () => {
            mockEntitlementsService.checkUsageLimit.mockResolvedValue({
                allowed: true,
                used: 10,
                limit: 100
            });
            mockEntitlementsService.incrementUsage.mockResolvedValue({
                success: true
            });

            const [checkMiddleware, incrementMiddleware] = middleware.enforceUsage('roasts', 2);

            // Execute check middleware
            await checkMiddleware(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(1);

            // Execute increment middleware
            await incrementMiddleware(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(2);
        });
    });

    describe('attachUsageSummary', () => {
        it('should attach usage summary to request', async () => {
            const mockSummary = {
                user_id: 'test-user-123',
                entitlements: { plan_name: 'pro' },
                usage: { analysis_used: 50 }
            };

            mockEntitlementsService.getUsageSummary.mockResolvedValue(mockSummary);

            const attachMiddleware = middleware.attachUsageSummary();
            await attachMiddleware(mockReq, mockRes, mockNext);

            expect(mockReq.usageSummary).toEqual(mockSummary);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should continue on error without failing request', async () => {
            mockEntitlementsService.getUsageSummary.mockRejectedValue(new Error('Database error'));

            const attachMiddleware = middleware.attachUsageSummary();
            await attachMiddleware(mockReq, mockRes, mockNext);

            expect(mockReq.usageSummary).toBeUndefined();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should skip when user is not authenticated', async () => {
            mockReq.user = null;

            const attachMiddleware = middleware.attachUsageSummary();
            await attachMiddleware(mockReq, mockRes, mockNext);

            expect(mockEntitlementsService.getUsageSummary).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('requireFeature', () => {
        it('should allow access when feature is enabled', async () => {
            mockEntitlementsService.getEntitlements.mockResolvedValue({
                shield_enabled: true,
                plan_name: 'pro'
            });

            const featureMiddleware = middleware.requireFeature('shield_enabled', true);
            await featureMiddleware(mockReq, mockRes, mockNext);

            expect(mockReq.entitlements.shield_enabled).toBe(true);
            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        it('should deny access when feature is not available', async () => {
            mockEntitlementsService.getEntitlements.mockResolvedValue({
                shield_enabled: false,
                plan_name: 'free'
            });

            const featureMiddleware = middleware.requireFeature('shield_enabled', true);
            await featureMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: "Feature 'shield_enabled' not available in your plan",
                code: 'FEATURE_NOT_AVAILABLE',
                details: {
                    feature: 'shield_enabled',
                    current_plan: 'free',
                    required_value: true,
                    actual_value: false
                }
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle array of required values', async () => {
            mockEntitlementsService.getEntitlements.mockResolvedValue({
                rqc_mode: 'advanced',
                plan_name: 'pro'
            });

            const featureMiddleware = middleware.requireFeature('rqc_mode', ['advanced', 'premium']);
            await featureMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny access for insufficient feature level', async () => {
            mockEntitlementsService.getEntitlements.mockResolvedValue({
                rqc_mode: 'basic',
                plan_name: 'free'
            });

            const featureMiddleware = middleware.requireFeature('rqc_mode', ['advanced', 'premium']);
            await featureMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle authentication errors', async () => {
            mockReq.user = null;

            const featureMiddleware = middleware.requireFeature('shield_enabled', true);
            await featureMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });
    });

    describe('static factory methods', () => {
        it('should create analysis middleware', () => {
            const middlewares = UsageEnforcementMiddleware.forAnalysis(2);
            expect(Array.isArray(middlewares)).toBe(true);
            expect(middlewares).toHaveLength(2);
        });

        it('should create roast middleware', () => {
            const middlewares = UsageEnforcementMiddleware.forRoasts(3);
            expect(Array.isArray(middlewares)).toBe(true);
            expect(middlewares).toHaveLength(2);
        });

        it('should create Shield requirement middleware', () => {
            const middleware = UsageEnforcementMiddleware.requireShield();
            expect(typeof middleware).toBe('function');
        });

        it('should create advanced RQC requirement middleware', () => {
            const middleware = UsageEnforcementMiddleware.requireAdvancedRQC();
            expect(typeof middleware).toBe('function');
        });

        it('should create premium RQC requirement middleware', () => {
            const middleware = UsageEnforcementMiddleware.requirePremiumRQC();
            expect(typeof middleware).toBe('function');
        });
    });

    describe('initializeUsageEnforcement', () => {
        it('should initialize entitlements service in app locals', () => {
            const mockApp = {
                locals: {}
            };

            initializeUsageEnforcement(mockApp);

            expect(mockApp.locals.entitlementsService).toBeInstanceOf(EntitlementsService);
        });
    });
});

describe('Integration scenarios', () => {
    let middleware;
    let mockEntitlementsService;
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockEntitlementsService = {
            checkUsageLimit: jest.fn(),
            incrementUsage: jest.fn(),
            getEntitlements: jest.fn()
        };
        EntitlementsService.mockImplementation(() => mockEntitlementsService);

        middleware = new UsageEnforcementMiddleware();

        mockReq = {
            user: { id: 'test-user-123' },
            app: {
                locals: {
                    entitlementsService: mockEntitlementsService
                }
            }
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockNext = jest.fn();
    });

    it('should handle complete flow for allowed request', async () => {
        // Setup mocks for allowed request
        mockEntitlementsService.checkUsageLimit.mockResolvedValue({
            allowed: true,
            used: 25,
            limit: 100,
            remaining: 75
        });
        mockEntitlementsService.incrementUsage.mockResolvedValue({
            success: true,
            incremented_by: 1
        });

        // Get combined middleware
        const [checkMiddleware, incrementMiddleware] = middleware.enforceUsage('analysis', 1);

        // Execute check
        await checkMiddleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();

        // Execute increment
        mockNext.mockClear();
        await incrementMiddleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();

        // Simulate successful API response
        await mockRes.json({ success: true, result: 'analysis complete' });
        expect(mockEntitlementsService.incrementUsage).toHaveBeenCalledWith('test-user-123', 'analysis', 1);
    });

    it('should block request when limit is reached', async () => {
        mockEntitlementsService.checkUsageLimit.mockResolvedValue({
            allowed: false,
            used: 100,
            limit: 100,
            remaining: 0,
            period_end: '2024-01-31'
        });

        const [checkMiddleware] = middleware.enforceUsage('roasts', 1);

        await checkMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(429);
        expect(mockRes.json).toHaveBeenCalledWith({
            success: false,
            error: 'Monthly roasts limit reached',
            code: 'LIMIT_REACHED',
            details: expect.objectContaining({
                action_type: 'roasts',
                used: 100,
                limit: 100
            })
        });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle feature requirements with Shield', async () => {
        mockEntitlementsService.getEntitlements.mockResolvedValue({
            shield_enabled: true,
            plan_name: 'pro'
        });

        const shieldMiddleware = UsageEnforcementMiddleware.requireShield();
        await shieldMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.entitlements.shield_enabled).toBe(true);
    });
});