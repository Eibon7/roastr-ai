/**
 * Unit tests for EntitlementsService - Issue #168
 * Tests entitlements management, usage tracking, and Stripe integration
 */

const EntitlementsService = require('../../../src/services/entitlementsService');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const StripeWrapper = require('../../../src/services/stripeWrapper');
const { flags } = require('../../../src/config/flags');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        upsert: jest.fn(),
        rpc: jest.fn()
    }
}));

jest.mock('../../../src/services/stripeWrapper');
jest.mock('../../../src/config/flags');
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('EntitlementsService', () => {
    let entitlementsService;
    let mockStripeWrapper;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock flags to enable billing by default
        flags.isEnabled.mockReturnValue(true);
        
        // Mock Stripe wrapper
        mockStripeWrapper = {
            prices: {
                retrieve: jest.fn()
            }
        };
        StripeWrapper.mockImplementation(() => mockStripeWrapper);
        
        entitlementsService = new EntitlementsService();
    });

    describe('constructor', () => {
        it('should initialize with Stripe when billing is enabled', () => {
            flags.isEnabled.mockReturnValue(true);
            const service = new EntitlementsService();
            expect(StripeWrapper).toHaveBeenCalledWith(process.env.STRIPE_SECRET_KEY);
        });

        it('should initialize without Stripe when billing is disabled', () => {
            flags.isEnabled.mockReturnValue(false);
            jest.clearAllMocks();
            
            const service = new EntitlementsService();
            expect(StripeWrapper).not.toHaveBeenCalled();
        });
    });

    describe('setEntitlementsFromStripePrice', () => {
        const userId = 'test-user-123';
        const priceId = 'price_test123';
        
        const mockPrice = {
            id: priceId,
            lookup_key: 'pro_monthly',
            metadata: {
                analysis_limit_monthly: '2000',
                roast_limit_monthly: '1000',
                model: 'gpt-4',
                shield_enabled: 'true',
                rqc_mode: 'advanced',
                plan_name: 'pro'
            },
            product: {
                id: 'prod_test123',
                name: 'Pro Plan',
                metadata: {}
            }
        };

        it('should successfully set entitlements from Stripe Price metadata', async () => {
            mockStripeWrapper.prices.retrieve.mockResolvedValue(mockPrice);
            supabaseServiceClient.upsert.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                        data: { account_id: userId, plan_name: 'pro' }
                    })
                })
            });

            const result = await entitlementsService.setEntitlementsFromStripePrice(userId, priceId);

            expect(result.success).toBe(true);
            expect(mockStripeWrapper.prices.retrieve).toHaveBeenCalledWith(priceId, {
                expand: ['product']
            });
            expect(supabaseServiceClient.from).toHaveBeenCalledWith('account_entitlements');
        });

        it('should apply fallback entitlements when Stripe fails', async () => {
            mockStripeWrapper.prices.retrieve.mockRejectedValue(new Error('Stripe API error'));
            supabaseServiceClient.upsert.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                        data: { account_id: userId, plan_name: 'free' }
                    })
                })
            });

            const result = await entitlementsService.setEntitlementsFromStripePrice(userId, priceId);

            expect(result.success).toBe(false);
            expect(result.fallback_applied).toBe(true);
        });

        it('should handle missing price metadata gracefully', async () => {
            const priceWithoutMetadata = {
                ...mockPrice,
                metadata: {},
                product: { id: 'prod_test', name: 'Unknown Plan', metadata: {} }
            };

            mockStripeWrapper.prices.retrieve.mockResolvedValue(priceWithoutMetadata);
            supabaseServiceClient.upsert.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                        data: { account_id: userId, plan_name: 'free' }
                    })
                })
            });

            const result = await entitlementsService.setEntitlementsFromStripePrice(userId, priceId);

            expect(result.success).toBe(true);
            // Should apply defaults for missing metadata
        });

        it('should throw error when Stripe is not enabled', async () => {
            flags.isEnabled.mockReturnValue(false);
            const service = new EntitlementsService();

            const result = await service.setEntitlementsFromStripePrice(userId, priceId);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Stripe integration not enabled');
        });
    });

    describe('setEntitlements', () => {
        const userId = 'test-user-123';
        const entitlements = {
            analysis_limit_monthly: 500,
            roast_limit_monthly: 500,
            model: 'gpt-3.5-turbo',
            shield_enabled: false,
            rqc_mode: 'basic',
            plan_name: 'starter'
        };

        it('should successfully set entitlements directly', async () => {
            supabaseServiceClient.upsert.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                        data: { account_id: userId, ...entitlements }
                    })
                })
            });

            const result = await entitlementsService.setEntitlements(userId, entitlements);

            expect(result.success).toBe(true);
            expect(result.source).toBe('direct');
            expect(supabaseServiceClient.from).toHaveBeenCalledWith('account_entitlements');
        });

        it('should handle database errors', async () => {
            supabaseServiceClient.upsert.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockRejectedValue(new Error('Database error'))
                })
            });

            const result = await entitlementsService.setEntitlements(userId, entitlements);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database error');
        });
    });

    describe('getEntitlements', () => {
        const userId = 'test-user-123';

        it('should return user entitlements when found', async () => {
            const mockEntitlements = {
                account_id: userId,
                analysis_limit_monthly: 1000,
                roast_limit_monthly: 1000,
                model: 'gpt-4',
                plan_name: 'pro'
            };

            supabaseServiceClient.single.mockResolvedValue({
                data: mockEntitlements,
                error: null
            });

            const result = await entitlementsService.getEntitlements(userId);

            expect(result).toEqual(mockEntitlements);
            expect(supabaseServiceClient.from).toHaveBeenCalledWith('account_entitlements');
        });

        it('should return default entitlements when none found', async () => {
            supabaseServiceClient.single.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' } // No rows found
            });

            const result = await entitlementsService.getEntitlements(userId);

            expect(result.plan_name).toBe('free');
            expect(result.analysis_limit_monthly).toBe(100);
            expect(result.roast_limit_monthly).toBe(100);
        });

        it('should return default entitlements on database error', async () => {
            supabaseServiceClient.single.mockResolvedValue({
                data: null,
                error: new Error('Database connection failed')
            });

            const result = await entitlementsService.getEntitlements(userId);

            expect(result.plan_name).toBe('free');
        });
    });

    describe('checkUsageLimit', () => {
        const userId = 'test-user-123';

        it('should check analysis usage limit successfully', async () => {
            supabaseServiceClient.rpc.mockResolvedValue({
                data: true,
                error: null
            });

            // Mock getEntitlements and getCurrentUsage
            jest.spyOn(entitlementsService, 'getEntitlements').mockResolvedValue({
                analysis_limit_monthly: 1000
            });
            jest.spyOn(entitlementsService, 'getCurrentUsage').mockResolvedValue({
                analysis_used: 50,
                period_start: '2024-01-01',
                period_end: '2024-01-31'
            });

            const result = await entitlementsService.checkUsageLimit(userId, 'analysis');

            expect(result.allowed).toBe(true);
            expect(result.limit).toBe(1000);
            expect(result.used).toBe(50);
            expect(result.remaining).toBe(950);
            expect(supabaseServiceClient.rpc).toHaveBeenCalledWith('check_usage_limit', {
                user_id: userId,
                usage_type: 'analysis'
            });
        });

        it('should check roast usage limit successfully', async () => {
            supabaseServiceClient.rpc.mockResolvedValue({
                data: false,
                error: null
            });

            jest.spyOn(entitlementsService, 'getEntitlements').mockResolvedValue({
                roast_limit_monthly: 100
            });
            jest.spyOn(entitlementsService, 'getCurrentUsage').mockResolvedValue({
                roasts_used: 100,
                period_start: '2024-01-01',
                period_end: '2024-01-31'
            });

            const result = await entitlementsService.checkUsageLimit(userId, 'roasts');

            expect(result.allowed).toBe(false);
            expect(result.limit).toBe(100);
            expect(result.used).toBe(100);
            expect(result.remaining).toBe(0);
        });

        it('should handle unlimited limits correctly', async () => {
            supabaseServiceClient.rpc.mockResolvedValue({
                data: true,
                error: null
            });

            jest.spyOn(entitlementsService, 'getEntitlements').mockResolvedValue({
                analysis_limit_monthly: -1 // Unlimited
            });
            jest.spyOn(entitlementsService, 'getCurrentUsage').mockResolvedValue({
                analysis_used: 5000
            });

            const result = await entitlementsService.checkUsageLimit(userId, 'analysis');

            expect(result.allowed).toBe(true);
            expect(result.unlimited).toBe(true);
            expect(result.remaining).toBe(-1);
        });

        it('should reject invalid action types', async () => {
            const result = await entitlementsService.checkUsageLimit(userId, 'invalid');

            expect(result.allowed).toBe(false);
            expect(result.error).toContain('Invalid action type');
        });

        it('should fail safe on database errors', async () => {
            supabaseServiceClient.rpc.mockResolvedValue({
                data: null,
                error: new Error('Database error')
            });

            const result = await entitlementsService.checkUsageLimit(userId, 'analysis');

            expect(result.allowed).toBe(false);
            expect(result.error).toBe('Database error');
        });
    });

    describe('incrementUsage', () => {
        const userId = 'test-user-123';

        it('should increment analysis usage successfully', async () => {
            supabaseServiceClient.rpc.mockResolvedValue({
                data: true,
                error: null
            });

            const result = await entitlementsService.incrementUsage(userId, 'analysis', 1);

            expect(result.success).toBe(true);
            expect(result.action_type).toBe('analysis');
            expect(result.incremented_by).toBe(1);
            expect(supabaseServiceClient.rpc).toHaveBeenCalledWith('increment_usage', {
                user_id: userId,
                usage_type: 'analysis',
                increment_by: 1
            });
        });

        it('should increment roasts usage by custom amount', async () => {
            supabaseServiceClient.rpc.mockResolvedValue({
                data: true,
                error: null
            });

            const result = await entitlementsService.incrementUsage(userId, 'roasts', 5);

            expect(result.success).toBe(true);
            expect(result.incremented_by).toBe(5);
            expect(supabaseServiceClient.rpc).toHaveBeenCalledWith('increment_usage', {
                user_id: userId,
                usage_type: 'roasts',
                increment_by: 5
            });
        });

        it('should reject invalid action types', async () => {
            const result = await entitlementsService.incrementUsage(userId, 'invalid');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid action type');
        });

        it('should handle database errors', async () => {
            supabaseServiceClient.rpc.mockResolvedValue({
                data: false,
                error: new Error('Database error')
            });

            const result = await entitlementsService.incrementUsage(userId, 'analysis');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database error');
        });
    });

    describe('getCurrentUsage', () => {
        const userId = 'test-user-123';

        it('should return current usage when found', async () => {
            const mockUsage = {
                account_id: userId,
                analysis_used: 50,
                roasts_used: 25,
                period_start: '2024-01-01',
                period_end: '2024-01-31'
            };

            supabaseServiceClient.single.mockResolvedValue({
                data: mockUsage,
                error: null
            });

            const result = await entitlementsService.getCurrentUsage(userId);

            expect(result).toEqual(mockUsage);
        });

        it('should return default usage when none found', async () => {
            supabaseServiceClient.single.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
            });

            const result = await entitlementsService.getCurrentUsage(userId);

            expect(result.account_id).toBe(userId);
            expect(result.analysis_used).toBe(0);
            expect(result.roasts_used).toBe(0);
        });
    });

    describe('resetMonthlyUsageCounters', () => {
        it('should reset counters successfully', async () => {
            supabaseServiceClient.rpc.mockResolvedValue({
                data: 150, // Number of accounts reset
                error: null
            });

            const result = await entitlementsService.resetMonthlyUsageCounters();

            expect(result.success).toBe(true);
            expect(result.accounts_reset).toBe(150);
            expect(supabaseServiceClient.rpc).toHaveBeenCalledWith('reset_monthly_usage_counters');
        });

        it('should handle reset errors', async () => {
            supabaseServiceClient.rpc.mockResolvedValue({
                data: null,
                error: new Error('Reset failed')
            });

            const result = await entitlementsService.resetMonthlyUsageCounters();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Reset failed');
        });
    });

    describe('getUsageSummary', () => {
        const userId = 'test-user-123';

        it('should return comprehensive usage summary', async () => {
            const mockEntitlements = {
                analysis_limit_monthly: 1000,
                roast_limit_monthly: 500
            };
            
            const mockUsage = {
                analysis_used: 200,
                roasts_used: 100,
                period_start: '2024-01-01',
                period_end: '2024-01-31'
            };

            jest.spyOn(entitlementsService, 'getEntitlements').mockResolvedValue(mockEntitlements);
            jest.spyOn(entitlementsService, 'getCurrentUsage').mockResolvedValue(mockUsage);

            const result = await entitlementsService.getUsageSummary(userId);

            expect(result.user_id).toBe(userId);
            expect(result.entitlements).toEqual(mockEntitlements);
            expect(result.usage).toEqual(mockUsage);
            expect(result.utilization.analysis.percentage).toBe(20); // 200/1000 * 100
            expect(result.utilization.roasts.percentage).toBe(20); // 100/500 * 100
            expect(result.period.start).toBe('2024-01-01');
        });

        it('should handle unlimited plans correctly', async () => {
            jest.spyOn(entitlementsService, 'getEntitlements').mockResolvedValue({
                analysis_limit_monthly: -1,
                roast_limit_monthly: -1
            });
            jest.spyOn(entitlementsService, 'getCurrentUsage').mockResolvedValue({
                analysis_used: 5000,
                roasts_used: 2000
            });

            const result = await entitlementsService.getUsageSummary(userId);

            expect(result.utilization.analysis.unlimited).toBe(true);
            expect(result.utilization.roasts.unlimited).toBe(true);
            expect(result.utilization.analysis.percentage).toBe(0);
        });
    });

    describe('_extractEntitlementsFromPrice', () => {
        it('should extract entitlements from price metadata correctly', () => {
            const mockPrice = {
                metadata: {
                    analysis_limit_monthly: '2000',
                    roast_limit_monthly: '1000',
                    model: 'gpt-4',
                    shield_enabled: 'true',
                    rqc_mode: 'advanced',
                    plan_name: 'pro'
                },
                product: {
                    metadata: {
                        analysis_limit_monthly: '1000', // Should be overridden by price metadata
                        extra_field: 'value'
                    }
                }
            };

            const result = entitlementsService._extractEntitlementsFromPrice(mockPrice);

            expect(result.analysis_limit_monthly).toBe(2000); // From price metadata
            expect(result.roast_limit_monthly).toBe(1000);
            expect(result.model).toBe('gpt-4');
            expect(result.shield_enabled).toBe(true);
            expect(result.rqc_mode).toBe('advanced');
            expect(result.plan_name).toBe('pro');
        });
    });

    describe('_getPlanDefaults', () => {
        it('should return correct defaults for starter plan', () => {
            const result = entitlementsService._getPlanDefaults('starter_monthly');
            expect(result.plan_name).toBe('starter');
            expect(result.analysis_limit_monthly).toBe(500);
            expect(result.shield_enabled).toBe(false);
        });

        it('should return correct defaults for pro plan', () => {
            const result = entitlementsService._getPlanDefaults('pro_monthly');
            expect(result.plan_name).toBe('pro');
            expect(result.analysis_limit_monthly).toBe(2000);
            expect(result.shield_enabled).toBe(true);
            expect(result.model).toBe('gpt-4');
        });

        it('should return correct defaults for creator plus plan', () => {
            const result = entitlementsService._getPlanDefaults('creator_plus_monthly');
            expect(result.plan_name).toBe('creator_plus');
            expect(result.analysis_limit_monthly).toBe(-1); // Unlimited
            expect(result.roast_limit_monthly).toBe(-1); // Unlimited
            expect(result.rqc_mode).toBe('premium');
        });

        it('should default to free plan for unknown identifiers', () => {
            const result = entitlementsService._getPlanDefaults('unknown_plan');
            expect(result.plan_name).toBe('free');
            expect(result.analysis_limit_monthly).toBe(100);
            expect(result.roast_limit_monthly).toBe(100);
        });
    });
});