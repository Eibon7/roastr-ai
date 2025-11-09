/**
 * Regression tests to detect inconsistencies between plan definitions and validation logic
 * Created to prevent Issue #110 from reoccurring
 */

const { getPlanFeatures, PLAN_FEATURES } = require('../../../src/services/planService');
const { getMaxIntegrations, getPlanTier } = require('../../../src/services/planValidation');

describe('Plan Consistency Tests (Issue #110)', () => {
    describe('Integration limits consistency', () => {
        it('should have matching integration limits between planService and planValidation', () => {
            // Test all standard plans
            const standardPlans = ['starter_trial', 'pro', 'plus', 'custom'];
            
            standardPlans.forEach(planId => {
                const planFeatures = getPlanFeatures(planId);
                const validationLimit = getMaxIntegrations(planId);
                
                if (planFeatures) {
                    expect(validationLimit).toBe(planFeatures.limits.platformIntegrations);
                }
            });
        });

        it('should enforce business rule: Pro plan has exactly 2 integrations (2 accounts per social network)', () => {
            const proPlan = getPlanFeatures('pro');
            const proValidationLimit = getMaxIntegrations('pro');
            
            expect(proPlan.limits.platformIntegrations).toBe(2);
            expect(proValidationLimit).toBe(2);
        });

        it('should enforce business rule: Free plan has exactly 1 integration', () => {
            const freePlan = getPlanFeatures('starter_trial');
            const freeValidationLimit = getMaxIntegrations('starter_trial');
            
            expect(freePlan.limits.platformIntegrations).toBe(1);
            expect(freeValidationLimit).toBe(1);
        });

        it('should enforce business rule: Creator+ plan has exactly 2 integrations', () => {
            const creatorPlan = getPlanFeatures('plus');
            const creatorValidationLimit = getMaxIntegrations('plus');

            expect(creatorPlan.limits.platformIntegrations).toBe(2);
            expect(creatorValidationLimit).toBe(2);
        });

        it('should enforce business rule: Custom plan has exactly 2 integrations', () => {
            const customPlan = getPlanFeatures('custom');
            const customValidationLimit = getMaxIntegrations('custom');
            
            expect(customPlan.limits.platformIntegrations).toBe(2);
            expect(customValidationLimit).toBe(2);
        });
    });

    describe('Plan tier consistency', () => {
        it('should have consistent plan tier ordering', () => {
            expect(getPlanTier('starter_trial')).toBeLessThan(getPlanTier('pro'));
            expect(getPlanTier('pro')).toBeLessThan(getPlanTier('plus'));
            expect(getPlanTier('plus')).toBeLessThan(getPlanTier('custom'));
        });
    });

    describe('Plan feature completeness', () => {
        it('should have all required plan properties defined', () => {
            Object.keys(PLAN_FEATURES).forEach(planId => {
                const plan = PLAN_FEATURES[planId];
                
                // Required properties
                expect(plan).toHaveProperty('id');
                expect(plan).toHaveProperty('name');
                expect(plan).toHaveProperty('price');
                expect(plan).toHaveProperty('currency');
                expect(plan).toHaveProperty('limits');
                expect(plan).toHaveProperty('features');
                
                // Required limits
                expect(plan.limits).toHaveProperty('roastsPerMonth');
                expect(plan.limits).toHaveProperty('commentsPerMonth');
                expect(plan.limits).toHaveProperty('platformIntegrations');
                
                // Validate platformIntegrations is a number or -1
                expect(typeof plan.limits.platformIntegrations).toBe('number');
                expect(plan.limits.platformIntegrations >= -1).toBe(true);
            });
        });
    });

    describe('Business policy validation', () => {
        it('should not allow agency-style usage on any plan (max 2 integrations)', () => {
            // Business rule: No plan should support agencies managing multiple client accounts
            const allPlans = ['starter_trial', 'pro', 'plus', 'custom'];
            
            allPlans.forEach(planId => {
                const plan = getPlanFeatures(planId);
                if (plan) {
                    // Max 2 integrations per social network prevents agency usage
                    expect(plan.limits.platformIntegrations).toBeLessThanOrEqual(2);
                }
            });
        });

        it('should prevent inconsistencies that led to Issue #110', () => {
            // This test specifically checks the original issue scenario
            const proPlanService = getPlanFeatures('pro').limits.platformIntegrations;
            const proValidation = getMaxIntegrations('pro');
            
            // These should always match
            expect(proPlanService).toBe(proValidation);
            
            // And both should be 2 as per new business policy
            expect(proPlanService).toBe(2);
            expect(proValidation).toBe(2);
        });
    });

    describe('Integration downgrade validation', () => {
        // Issue #202: Add explicit test for integration downgrade scenarios
        it('should block downgrade when user has more active integrations than new plan limit', async () => {
            const { isChangeAllowed } = require('../../../src/services/planValidation');
            
            // Scenario: User has 2 active integrations trying to downgrade from Pro to Free
            const currentUsage = {
                activeIntegrations: 2, // Pro plan allows 2
                roastsThisMonth: 50,
                commentsThisMonth: 200
            };
            
            // Should be blocked because Free plan only allows 1 integration
            const result = await isChangeAllowed('pro', 'starter_trial', currentUsage);
            
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('integrations'); // Should mention integration limit issue
        });

        it('should allow upgrade when user integrations are within new plan limit', async () => {
            const { isChangeAllowed } = require('../../../src/services/planValidation');

            // Scenario: User has 1 active integration trying to upgrade from Starter to Pro
            const currentUsage = {
                activeIntegrations: 1, // Within both plan limits
                roastsThisMonth: 50,
                commentsThisMonth: 200
            };

            // Should always allow upgrades when integration limits are satisfied
            const result = await isChangeAllowed('starter', 'pro', currentUsage);

            expect(result.allowed).toBe(true);
            expect(result.reason).toBeFalsy(); // null or undefined
        });

        it('should block downgrade with clear error message about integration limit', async () => {
            const { isChangeAllowed } = require('../../../src/services/planValidation');
            
            // Scenario: Edge case where user somehow has 3 integrations (data inconsistency)
            const currentUsage = {
                activeIntegrations: 3, // More than any plan should allow
                roastsThisMonth: 50,
                commentsThisMonth: 200
            };
            
            // Should be blocked for any downgrade
            const resultToFree = await isChangeAllowed('plus', 'starter_trial', currentUsage);
            const resultToPro = await isChangeAllowed('plus', 'pro', currentUsage);
            
            expect(resultToFree.allowed).toBe(false);
            expect(resultToFree.reason).toContain('integrations');
            
            expect(resultToPro.allowed).toBe(false);
            expect(resultToPro.reason).toContain('integrations');
        });

        it('should validate integration limits are enforced in all downgrade scenarios', async () => {
            const { isChangeAllowed, getMaxIntegrations } = require('../../../src/services/planValidation');
            
            const testCases = [
                { from: 'plus', to: 'pro', integrations: 3, shouldBlock: true },
                { from: 'plus', to: 'pro', integrations: 2, shouldBlock: false },
                { from: 'plus', to: 'starter_trial', integrations: 2, shouldBlock: true },
                { from: 'plus', to: 'starter_trial', integrations: 1, shouldBlock: false },
                { from: 'pro', to: 'starter_trial', integrations: 2, shouldBlock: true },
                { from: 'pro', to: 'starter_trial', integrations: 1, shouldBlock: false },
            ];
            
            for (const testCase of testCases) {
                const currentUsage = {
                    activeIntegrations: testCase.integrations,
                    roastsThisMonth: 50,
                    commentsThisMonth: 200
                };
                
                const result = await isChangeAllowed(testCase.from, testCase.to, currentUsage);
                const newPlanLimit = getMaxIntegrations(testCase.to);
                
                if (testCase.shouldBlock) {
                    expect(result.allowed).toBe(false);
                    expect(result.reason).toContain('integrations');
                    expect(testCase.integrations).toBeGreaterThan(newPlanLimit);
                } else {
                    // Should be allowed (integration-wise, might fail for other reasons)
                    expect(testCase.integrations).toBeLessThanOrEqual(newPlanLimit);
                    if (result.allowed === false && result.reason?.includes('integrations')) {
                        fail(`Expected integration check to pass but got: ${result.reason}`);
                    }
                }
            }
        });
    });
});