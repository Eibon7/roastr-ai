/**
 * Tests for edge cases in plan validation
 */

// Mock the planService dependency
jest.mock('../../../src/services/planService');

const planValidation = require('../../../src/services/planValidation');

describe('Plan Validation Edge Cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock planService
        const { getPlanFeatures } = require('../../../src/services/planService');
        
        getPlanFeatures.mockImplementation((planId) => {
            const plans = {
                free: {
                    id: 'free',
                    limits: { roastsPerMonth: 100, commentsPerMonth: 500, platformIntegrations: 1 },
                    features: { basicSupport: true, prioritySupport: false, advancedAnalytics: false, teamCollaboration: false, customTones: false, apiAccess: false, shield: false, styleProfile: false }
                },
                pro: {
                    id: 'pro',
                    limits: { roastsPerMonth: 1000, commentsPerMonth: 5000, platformIntegrations: 2 },
                    features: { basicSupport: true, prioritySupport: true, advancedAnalytics: true, teamCollaboration: false, customTones: false, apiAccess: false, shield: true, styleProfile: false }
                },
                creator_plus: {
                    id: 'creator_plus',
                    limits: { roastsPerMonth: -1, commentsPerMonth: -1, platformIntegrations: 2 },
                    features: { basicSupport: true, prioritySupport: true, advancedAnalytics: true, teamCollaboration: true, customTones: true, apiAccess: true, shield: true, styleProfile: true }
                }
            };
            return plans[planId] || null;
        });
    });

    describe('Downgrade with exceeded usage', () => {
        it('should block downgrade from pro to free when roasts exceed limit', async () => {
            const result = await planValidation.isChangeAllowed('pro', 'free', {
                roastsThisMonth: 150,
                commentsThisMonth: 400,
                activeIntegrations: 1
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Current monthly roasts (150) exceeds new plan limit (100)');
        });

        it('should block downgrade from pro to free when comments exceed limit', async () => {
            const result = await planValidation.isChangeAllowed('pro', 'free', {
                roastsThisMonth: 50,
                commentsThisMonth: 600,
                activeIntegrations: 1
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Current monthly comments (600) exceeds new plan limit (500)');
        });

        it('should block downgrade from creator_plus to pro when roasts exceed limit', async () => {
            const result = await planValidation.isChangeAllowed('creator_plus', 'pro', {
                roastsThisMonth: 1500, // Exceeds pro limit of 1000
                commentsThisMonth: 2000,
                activeIntegrations: 2
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Current monthly roasts (1500) exceeds new plan limit (1000)');
        });

        it('should provide warnings about lost features on allowed downgrade', async () => {
            const result = await planValidation.isChangeAllowed('creator_plus', 'pro', {
                roastsThisMonth: 500,
                commentsThisMonth: 2000,
                activeIntegrations: 2
            });

            expect(result.allowed).toBe(true);
            expect(result.warnings).toContain('You will lose access to team collaboration features');
            expect(result.warnings).toContain('You will lose access to custom style profiles');
        });
    });

    describe('Edge cases with null/undefined usage', () => {
        it('should handle null usage gracefully', async () => {
            const result = await planValidation.isChangeAllowed('free', 'pro', null);
            
            expect(result.allowed).toBe(true);
        });

        it('should handle undefined usage gracefully', async () => {
            const result = await planValidation.isChangeAllowed('free', 'pro', undefined);
            
            expect(result.allowed).toBe(true);
        });

        it('should handle empty usage object', async () => {
            const result = await planValidation.isChangeAllowed('free', 'pro', {});
            
            expect(result.allowed).toBe(true);
        });
    });

    describe('Invalid plan scenarios', () => {
        it('should reject invalid current plan', async () => {
            const result = await planValidation.isChangeAllowed('invalid_plan', 'pro', {
                roastsThisMonth: 50,
                commentsThisMonth: 200,
                activeIntegrations: 1
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Invalid plan specified');
        });

        it('should reject invalid target plan', async () => {
            const result = await planValidation.isChangeAllowed('free', 'invalid_plan', {
                roastsThisMonth: 50,
                commentsThisMonth: 200,
                activeIntegrations: 1
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Invalid plan specified');
        });
    });

    describe('Upgrade scenarios', () => {
        it('should always allow upgrades regardless of usage', async () => {
            const result = await planValidation.isChangeAllowed('free', 'pro', {
                roastsThisMonth: 200,
                commentsThisMonth: 1000,
                activeIntegrations: 5
            });

            expect(result.allowed).toBe(true);
            expect(result.reason).toBeUndefined();
        });

        it('should allow upgrade from pro to creator_plus with high usage', async () => {
            const result = await planValidation.isChangeAllowed('pro', 'creator_plus', {
                roastsThisMonth: 5000,
                commentsThisMonth: 10000,
                activeIntegrations: 8
            });

            expect(result.allowed).toBe(true);
            expect(result.reason).toBeUndefined();
        });
    });

    describe('Same plan scenarios', () => {
        it('should allow "changes" to the same plan', async () => {
            const result = await planValidation.isChangeAllowed('pro', 'pro', {
                roastsThisMonth: 500,
                commentsThisMonth: 2000,
                activeIntegrations: 2
            });

            expect(result.allowed).toBe(true);
        });
    });

    describe('Proration calculations', () => {
        it('should calculate proration for mid-period changes', () => {
            const now = Date.now() / 1000;
            const periodEnd = now + (15 * 86400); // 15 days left

            const currentSubscription = {
                current_period_end: periodEnd,
                items: {
                    data: [{
                        price: { unit_amount: 2000 } // €20
                    }]
                }
            };

            const newPlan = { price: 5000 }; // €50

            const result = planValidation.calculateProration(currentSubscription, newPlan);
            
            expect(result.amount).toBeGreaterThan(0);
            expect(result.description).toContain('15 days remaining');
        });

        it('should return zero proration for expired subscriptions', () => {
            const currentSubscription = {
                current_period_end: Date.now() / 1000 - 86400 // Yesterday
            };

            const result = planValidation.calculateProration(currentSubscription, {});
            
            expect(result.amount).toBe(0);
            expect(result.description).toBe('No proration needed');
        });

        it('should handle missing subscription data', () => {
            const result = planValidation.calculateProration(null, { price: 5000 });
            
            expect(result.amount).toBe(0);
            expect(result.description).toBe('No proration needed');
        });
    });

    describe('Plan tier comparisons', () => {
        it('should correctly identify plan tiers', () => {
            expect(planValidation.getPlanTier('free')).toBe(0);
            expect(planValidation.getPlanTier('pro')).toBe(1);
            expect(planValidation.getPlanTier('creator_plus')).toBe(2);
            expect(planValidation.getPlanTier('invalid')).toBe(0);
        });

        it('should allow downgrades at period end', () => {
            expect(planValidation.canDowngradeAtPeriodEnd('pro', 'free')).toBe(true);
            expect(planValidation.canDowngradeAtPeriodEnd('creator_plus', 'pro')).toBe(true);
            expect(planValidation.canDowngradeAtPeriodEnd('creator_plus', 'free')).toBe(true);
            
            // Upgrades should return false (not downgrades)
            expect(planValidation.canDowngradeAtPeriodEnd('free', 'pro')).toBe(false);
        });
    });

    describe('Integration limits', () => {
        it('should return correct max integrations for each plan', () => {
            expect(planValidation.getMaxIntegrations('free')).toBe(1);
            expect(planValidation.getMaxIntegrations('pro')).toBe(2);
            expect(planValidation.getMaxIntegrations('creator_plus')).toBe(2);
            expect(planValidation.getMaxIntegrations('invalid')).toBe(1);
        });
    });
});