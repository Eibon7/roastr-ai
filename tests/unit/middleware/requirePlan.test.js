/**
 * Tests unitarios para middleware requirePlan
 */

// Mock dependencies
jest.mock('../../../src/config/supabase');
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

const { requirePlan, requirePlatformLimit, checkRoastLimit, PLAN_LIMITS, PLAN_HIERARCHY } = require('../../../src/middleware/requirePlan');

describe('requirePlan Middleware Tests', () => {
    let mockReq, mockRes, mockNext;
    let mockSupabaseServiceClient;

    beforeEach(() => {
        // Mock request object
        mockReq = {
            user: {
                id: 'test-user-id'
            }
        };

        // Mock response object
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        // Mock next function
        mockNext = jest.fn();

        // Mock Supabase client
        mockSupabaseServiceClient = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
            gte: jest.fn().mockReturnThis()
        };

        const { supabaseServiceClient } = require('../../../src/config/supabase');
        Object.assign(supabaseServiceClient, mockSupabaseServiceClient);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic Plan Validation', () => {
        it('should allow access for users with sufficient plan level', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    plan: 'pro',
                    status: 'active',
                    trial_end: null,
                    current_period_end: null
                },
                error: null
            });

            const middleware = requirePlan('pro');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.subscription).toBeDefined();
            expect(mockReq.subscription.plan).toBe('pro');
        });

        it('should deny access for users with insufficient plan level', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    plan: 'free',
                    status: 'active',
                    trial_end: null,
                    current_period_end: null
                },
                error: null
            });

            const middleware = requirePlan('pro');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Plan upgrade required. Current: free, Required: pro or higher',
                code: 'PLAN_UPGRADE_REQUIRED',
                details: {
                    currentPlan: 'free',
                    requiredPlan: 'pro',
                    upgradeUrl: '/billing.html'
                }
            });
        });

        it('should allow access for higher tier plans', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    plan: 'plus',
                    status: 'active',
                    trial_end: null,
                    current_period_end: null
                },
                error: null
            });

            const middleware = requirePlan('pro');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.subscription.plan).toBe('plus');
        });
    });

    describe('Array Plan Validation', () => {
        it('should allow access for exact plan matches', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    plan: 'pro',
                    status: 'active',
                    trial_end: null,
                    current_period_end: null
                },
                error: null
            });

            const middleware = requirePlan(['pro', 'plus']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny access for non-matching plans', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    plan: 'free',
                    status: 'active',
                    trial_end: null,
                    current_period_end: null
                },
                error: null
            });

            const middleware = requirePlan(['pro', 'plus']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Plan upgrade required. Current: free, Required: pro or plus',
                code: 'PLAN_UPGRADE_REQUIRED',
                details: {
                    currentPlan: 'free',
                    requiredPlans: ['pro', 'plus'],
                    upgradeUrl: '/billing.html'
                }
            });
        });
    });

    describe('Subscription Status Validation', () => {
        it('should allow access for active subscriptions', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    plan: 'pro',
                    status: 'active',
                    trial_end: null,
                    current_period_end: null
                },
                error: null
            });

            const middleware = requirePlan('pro');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny access for inactive subscriptions', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    plan: 'pro',
                    status: 'canceled',
                    trial_end: null,
                    current_period_end: null
                },
                error: null
            });

            const middleware = requirePlan('pro');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(402);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Active subscription required',
                code: 'SUBSCRIPTION_INACTIVE',
                details: {
                    currentPlan: 'pro',
                    status: 'canceled',
                    isExpired: true
                }
            });
        });

        it('should allow access during trial period', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 7);

            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    plan: 'pro',
                    status: 'trialing',
                    trial_end: futureDate.toISOString(),
                    current_period_end: null
                },
                error: null
            });

            const middleware = requirePlan('pro');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.subscription.isInTrial).toBe(true);
        });

        it('should allow access for past_due subscriptions within grace period', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    plan: 'pro',
                    status: 'past_due',
                    trial_end: null,
                    current_period_end: futureDate.toISOString()
                },
                error: null
            });

            const middleware = requirePlan('pro');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Feature-based Access Control', () => {
        it('should allow access to available features', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    plan: 'pro',
                    status: 'active',
                    trial_end: null,
                    current_period_end: null
                },
                error: null
            });

            const middleware = requirePlan('pro', { feature: 'advanced_tones' });
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny access to unavailable features', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    plan: 'free',
                    status: 'active',
                    trial_end: null,
                    current_period_end: null
                },
                error: null
            });

            const middleware = requirePlan('free', { feature: 'advanced_tones' });
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: "Feature 'advanced_tones' requires a higher plan",
                code: 'FEATURE_NOT_AVAILABLE',
                details: {
                    currentPlan: 'free',
                    requiredFeature: 'advanced_tones',
                    availableFeatures: ['basic_roasts']
                }
            });
        });
    });

    describe('Authentication Validation', () => {
        it('should require authentication', async () => {
            mockReq.user = undefined;

            const middleware = requirePlan('pro');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        });
    });

    describe('Database Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Database connection failed' }
            });

            const middleware = requirePlan('pro');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to verify subscription',
                code: 'SUBSCRIPTION_CHECK_FAILED'
            });
        });

        it('should handle missing subscription data', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: null
            });

            const middleware = requirePlan('free'); // Should pass with default free plan
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.subscription.plan).toBe('free');
        });
    });
});

describe('requirePlatformLimit Middleware Tests', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = {
            subscription: {
                plan: 'pro',
                limits: PLAN_LIMITS.pro
            }
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockNext = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should allow within platform limits', () => {
        const middleware = requirePlatformLimit(3);
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
    });

    it('should deny when exceeding platform limits', () => {
        const middleware = requirePlatformLimit(10);
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
            success: false,
            error: "Platform limit exceeded. Your plan allows 5 platforms, you're trying to use 10",
            code: 'PLATFORM_LIMIT_EXCEEDED',
            details: {
                currentPlan: 'pro',
                platformLimit: 5,
                requestedPlatforms: 10,
                upgradeUrl: '/billing.html'
            }
        });
    });

    it('should allow unlimited platforms for plus', () => {
        mockReq.subscription = {
            plan: 'plus',
            limits: PLAN_LIMITS.plus
        };

        const middleware = requirePlatformLimit(100);
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
    });

    it('should require subscription middleware to run first', () => {
        mockReq.subscription = undefined;

        const middleware = requirePlatformLimit(1);
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            success: false,
            error: 'Subscription middleware required before platform limit check'
        });
    });
});

describe('checkRoastLimit Function Tests', () => {
    let mockSupabaseServiceClient;

    beforeEach(() => {
        mockSupabaseServiceClient = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
            gte: jest.fn().mockReturnThis()
        };

        const { supabaseServiceClient } = require('../../../src/config/supabase');
        Object.assign(supabaseServiceClient, mockSupabaseServiceClient);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should allow roasts within limits for free plan', async () => {
        // Mock subscription query
        mockSupabaseServiceClient.single
            .mockResolvedValueOnce({
                data: { plan: 'free' },
                error: null
            });

        // Mock usage query - return 50 roasts this month
        mockSupabaseServiceClient.select.mockReturnThis();
        mockSupabaseServiceClient.eq.mockReturnThis();
        mockSupabaseServiceClient.gte.mockResolvedValueOnce({
            data: new Array(50), // 50 roasts used
            error: null
        });

        const result = await checkRoastLimit('test-user-id', 1);

        expect(result.allowed).toBe(true);
        expect(result.plan).toBe('free');
        expect(result.limit).toBe(100);
        expect(result.current).toBe(50);
        expect(result.afterIncrement).toBe(51);
    });

    it('should deny roasts when exceeding limits', async () => {
        mockSupabaseServiceClient.single
            .mockResolvedValueOnce({
                data: { plan: 'free' },
                error: null
            });

        // Mock usage query - return 100 roasts (at limit)
        mockSupabaseServiceClient.gte.mockResolvedValueOnce({
            data: new Array(100),
            error: null
        });

        const result = await checkRoastLimit('test-user-id', 1);

        expect(result.allowed).toBe(false);
        expect(result.current).toBe(100);
        expect(result.afterIncrement).toBe(101);
    });

    it('should allow unlimited roasts for plus plan', async () => {
        mockSupabaseServiceClient.single
            .mockResolvedValueOnce({
                data: { plan: 'plus' },
                error: null
            });

        const result = await checkRoastLimit('test-user-id', 100);

        expect(result.allowed).toBe(true);
        expect(result.plan).toBe('plus');
        expect(result.limit).toBe(-1);
        expect(result.current).toBe(0);
    });

    it('should handle database errors', async () => {
        mockSupabaseServiceClient.single
            .mockResolvedValueOnce({
                data: null,
                error: { message: 'Database error' }
            });

        await expect(checkRoastLimit('test-user-id', 1)).rejects.toThrow('Failed to fetch subscription: Database error');
    });
});

describe('Plan Configuration Tests', () => {
    it('should have correct plan hierarchy', () => {
        expect(PLAN_HIERARCHY.free).toBe(0);
        expect(PLAN_HIERARCHY.starter).toBe(1);
        expect(PLAN_HIERARCHY.pro).toBe(2);
        expect(PLAN_HIERARCHY.creator_plus).toBe(3);
    });

    it('should have correct plan limits', () => {
        expect(PLAN_LIMITS.free.maxPlatforms).toBe(1);
        expect(PLAN_LIMITS.free.maxRoastsPerMonth).toBe(10);
        expect(PLAN_LIMITS.starter.maxPlatforms).toBe(1);
        expect(PLAN_LIMITS.starter.maxRoastsPerMonth).toBe(10);
        expect(PLAN_LIMITS.pro.maxPlatforms).toBe(2);
        expect(PLAN_LIMITS.pro.maxRoastsPerMonth).toBe(1000);
        expect(PLAN_LIMITS.creator_plus.maxPlatforms).toBe(2);
        expect(PLAN_LIMITS.creator_plus.maxRoastsPerMonth).toBe(5000);
    });

    it('should have correct feature access', () => {
        expect(PLAN_LIMITS.free.features).toContain('basic_roasts');
        expect(PLAN_LIMITS.starter.features).toContain('basic_roasts');
        expect(PLAN_LIMITS.pro.features).toContain('advanced_tones');
        expect(PLAN_LIMITS.creator_plus.features).toContain('api_access');
    });
});