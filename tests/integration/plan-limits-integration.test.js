/**
 * Integration tests for Plan Limits system
 * Issue #99: Database-based plan limit configuration
 */

const { supabaseServiceClient } = require('../../src/config/supabase');
const planLimitsService = require('../../src/services/planLimitsService');
const workerNotificationService = require('../../src/services/workerNotificationService');
const authService = require('../../src/services/authService');

// Mock Supabase for integration testing
jest.mock('../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn(() => Promise.resolve({
                        data: {
                            plan_id: 'pro',
                            max_roasts: 1000,
                            monthly_responses_limit: 1000,
                            max_platforms: 5,
                            integrations_limit: 5,
                            shield_enabled: true,
                            custom_prompts: false,
                            priority_support: true,
                            api_access: false,
                            analytics_enabled: true,
                            custom_tones: false,
                            dedicated_support: false,
                            monthly_tokens_limit: 100000,
                            daily_api_calls_limit: 1000,
                            settings: {}
                        },
                        error: null
                    }))
                }))
            })),
            update: jest.fn(() => ({
                eq: jest.fn(() => ({
                    select: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({
                            data: {
                                plan_id: 'pro',
                                max_roasts: 2000,
                                monthly_responses_limit: 2000
                            },
                            error: null
                        }))
                    }))
                }))
            }))
        }))
    }
}));

describe('Plan Limits Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        planLimitsService.clearCache();
    });

    describe('End-to-end plan limits flow', () => {
        it('should work across all services', async () => {
            // 1. PlanLimitsService should fetch from database
            const limits = await planLimitsService.getPlanLimits('pro');
            expect(limits.maxRoasts).toBe(1000);
            expect(limits.shieldEnabled).toBe(true);

            // 2. WorkerNotificationService should use plan limits
            const result = await workerNotificationService.notifyPlanChange(
                'user-123',
                'free',
                'pro',
                'active'
            );
            expect(result.success).toBe(true);

            // 3. AuthService should get async plan limits
            const authLimits = await authService.getPlanLimits('pro');
            expect(authLimits.monthly_messages).toBe(1000);
            expect(authLimits.monthly_tokens).toBe(100000);
        });

        it('should handle database failures gracefully', async () => {
            // Mock database error
            supabaseServiceClient.from.mockImplementation(() => ({
                select: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({
                            data: null,
                            error: new Error('Database connection failed')
                        })
                    })
                })
            }));

            // Services should fall back to default values
            const limits = await planLimitsService.getPlanLimits('pro');
            expect(limits.maxRoasts).toBe(1000); // Default pro value
            expect(limits.shieldEnabled).toBe(true);

            const authLimits = await authService.getPlanLimits('pro');
            expect(authLimits.monthly_messages).toBe(1000);
        });
    });

    describe('Cache behavior integration', () => {
        it('should cache limits across service calls', async () => {
            // First call to planLimitsService
            await planLimitsService.getPlanLimits('pro');
            
            // Second call should use cache
            await planLimitsService.getPlanLimits('pro');
            
            // Should only call database once
            expect(supabaseServiceClient.from).toHaveBeenCalledTimes(1);
        });

        it('should refresh cache after update', async () => {
            // Initial fetch
            await planLimitsService.getPlanLimits('pro');
            
            // Update should clear cache
            await planLimitsService.updatePlanLimits('pro', { maxRoasts: 2000 }, 'admin-123');
            
            // Next fetch should hit database again
            await planLimitsService.getPlanLimits('pro');
            
            // Should have called database 3 times: initial fetch, update, post-update fetch
            expect(supabaseServiceClient.from).toHaveBeenCalledTimes(3);
        });
    });

    describe('Plan validation integration', () => {
        it('should validate plan IDs consistently', async () => {
            // Valid plans
            const validPlans = ['free', 'pro', 'creator_plus', 'custom'];
            
            for (const plan of validPlans) {
                const limits = await planLimitsService.getPlanLimits(plan);
                expect(limits).toBeDefined();
                expect(limits.maxRoasts).toBeGreaterThanOrEqual(-1); // -1 means unlimited
            }
        });

        it('should handle unknown plans consistently', async () => {
            // Unknown plan should return free plan defaults
            const limits = await planLimitsService.getPlanLimits('unknown_plan');
            expect(limits.maxRoasts).toBe(100); // Free plan default
            expect(limits.shieldEnabled).toBe(false);
        });
    });

    describe('Limit checking integration', () => {
        it('should check limits correctly', async () => {
            // Under limit
            const underLimit = await planLimitsService.checkLimit('pro', 'roasts', 500);
            expect(underLimit).toBe(false);

            // At limit
            const atLimit = await planLimitsService.checkLimit('pro', 'roasts', 1000);
            expect(atLimit).toBe(true);

            // Over limit
            const overLimit = await planLimitsService.checkLimit('pro', 'roasts', 1500);
            expect(overLimit).toBe(true);
        });

        it('should handle unlimited limits', async () => {
            // Mock creator_plus with unlimited roasts
            supabaseServiceClient.from.mockImplementation(() => ({
                select: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({
                            data: {
                                plan_id: 'creator_plus',
                                max_roasts: -1,
                                monthly_responses_limit: 5000,
                                shield_enabled: true
                            },
                            error: null
                        })
                    })
                })
            }));

            const isOverLimit = await planLimitsService.checkLimit('creator_plus', 'roasts', 999999);
            expect(isOverLimit).toBe(false); // Should never be over unlimited limit
        });
    });

    describe('Service compatibility', () => {
        it('should maintain backward compatibility with old plan names', async () => {
            // AuthService maps 'basic' to 'free'
            const basicLimits = await authService.getPlanLimits('basic');
            expect(basicLimits.monthly_messages).toBeDefined();
            expect(basicLimits.monthly_tokens).toBeDefined();
        });

        it('should handle async conversion properly', async () => {
            // All services should now handle async getPlanLimits
            const promises = [
                planLimitsService.getPlanLimits('pro'),
                authService.getPlanLimits('pro'),
                workerNotificationService.getPlanLimits('pro', 'active')
            ];

            const results = await Promise.all(promises);
            results.forEach(result => {
                expect(result).toBeDefined();
                expect(typeof result).toBe('object');
            });
        });
    });

    describe('Error handling integration', () => {
        it('should handle partial database failures', async () => {
            // Mock intermittent failures
            let callCount = 0;
            supabaseServiceClient.from.mockImplementation(() => ({
                select: () => ({
                    eq: () => ({
                        single: () => {
                            callCount++;
                            if (callCount === 1) {
                                return Promise.resolve({ data: null, error: new Error('Temp failure') });
                            }
                            return Promise.resolve({
                                data: { plan_id: 'pro', max_roasts: 1000, shield_enabled: true },
                                error: null
                            });
                        }
                    })
                })
            }));

            // First call should use fallback
            const limits1 = await planLimitsService.getPlanLimits('pro');
            expect(limits1.maxRoasts).toBe(1000); // Fallback value

            // Clear cache to force second database call
            planLimitsService.clearCache();

            // Second call should succeed
            const limits2 = await planLimitsService.getPlanLimits('pro');
            expect(limits2.maxRoasts).toBe(1000); // Database value
        });

        it('should log errors appropriately', async () => {
            const { logger } = require('../../src/utils/logger');
            jest.spyOn(logger, 'error');

            // Force database error
            supabaseServiceClient.from.mockImplementation(() => ({
                select: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({
                            data: null,
                            error: new Error('Database down')
                        })
                    })
                })
            }));

            await planLimitsService.getPlanLimits('pro');
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to fetch plan limits:',
                expect.any(Error)
            );

            logger.error.mockRestore();
        });
    });
});