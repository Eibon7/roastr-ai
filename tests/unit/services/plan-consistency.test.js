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
            const standardPlans = ['free', 'pro', 'creator_plus', 'custom'];
            
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
            const freePlan = getPlanFeatures('free');
            const freeValidationLimit = getMaxIntegrations('free');
            
            expect(freePlan.limits.platformIntegrations).toBe(1);
            expect(freeValidationLimit).toBe(1);
        });

        it('should enforce business rule: Creator+ plan has exactly 2 integrations', () => {
            const creatorPlan = getPlanFeatures('creator_plus');
            const creatorValidationLimit = getMaxIntegrations('creator_plus');
            
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
            expect(getPlanTier('free')).toBeLessThan(getPlanTier('pro'));
            expect(getPlanTier('pro')).toBeLessThan(getPlanTier('creator_plus'));
            expect(getPlanTier('creator_plus')).toBeLessThan(getPlanTier('custom'));
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
            const allPlans = ['free', 'pro', 'creator_plus', 'custom'];
            
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
});