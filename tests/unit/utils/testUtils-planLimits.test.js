/**
 * Test for shared plan limits constants in testUtils.js
 * Verifies that PLAN_LIMITS are consistent across functions
 */

const { createMultiTenantTestScenario, createPlanBasedMockResponse } = require('../../helpers/testUtils');

describe('TestUtils Plan Limits Consistency', () => {
    describe('Shared PLAN_LIMITS constants', () => {
        it('should have consistent plan limits between createMultiTenantTestScenario and createPlanBasedMockResponse', () => {
            const planTypes = ['free', 'pro', 'enterprise'];
            
            planTypes.forEach(planType => {
                // Get limits from createMultiTenantTestScenario
                const scenario = createMultiTenantTestScenario('simple', { planType });
                const scenarioLimits = scenario.organization.entitlements;

                // Get limits from createPlanBasedMockResponse
                const mockResponse = createPlanBasedMockResponse(planType, 'test', 'GET');
                const mockLimits = mockResponse.data.limits;

                // Verify roasts/monthlyResponsesLimit consistency
                expect(scenarioLimits.monthlyResponsesLimit).toBe(mockLimits.roasts);

                // Verify integrationsLimit consistency
                expect(scenarioLimits.integrationsLimit).toBe(mockLimits.integrationsLimit);

                // Verify features consistency
                expect(mockLimits.features).toBeDefined();
                expect(Array.isArray(mockLimits.features)).toBe(true);

                // Verify shieldEnabled consistency
                expect(scenarioLimits.shieldEnabled).toBe(mockLimits.shieldEnabled);
            });
        });
        
        it('should have expected values for free plan', () => {
            const scenario = createMultiTenantTestScenario('simple', { planType: 'free' });
            const mockResponse = createPlanBasedMockResponse('free', 'test', 'GET');

            expect(scenario.organization.entitlements.monthlyResponsesLimit).toBe(10);
            expect(scenario.organization.entitlements.integrationsLimit).toBe(2);
            expect(scenario.organization.entitlements.shieldEnabled).toBe(false);

            expect(mockResponse.data.limits.roasts).toBe(10);
            expect(mockResponse.data.limits.integrationsLimit).toBe(2);
            expect(mockResponse.data.limits.shieldEnabled).toBe(false);
        });

        it('should have expected values for pro plan', () => {
            const scenario = createMultiTenantTestScenario('simple', { planType: 'pro' });
            const mockResponse = createPlanBasedMockResponse('pro', 'test', 'GET');

            expect(scenario.organization.entitlements.monthlyResponsesLimit).toBe(1000);
            expect(scenario.organization.entitlements.integrationsLimit).toBe(6);
            expect(scenario.organization.entitlements.shieldEnabled).toBe(true);

            expect(mockResponse.data.limits.roasts).toBe(1000);
            expect(mockResponse.data.limits.integrationsLimit).toBe(6);
            expect(mockResponse.data.limits.shieldEnabled).toBe(true);
        });

        it('should have expected values for enterprise plan', () => {
            const scenario = createMultiTenantTestScenario('simple', { planType: 'enterprise' });
            const mockResponse = createPlanBasedMockResponse('enterprise', 'test', 'GET');

            expect(scenario.organization.entitlements.monthlyResponsesLimit).toBe(10000);
            expect(scenario.organization.entitlements.integrationsLimit).toBe(18);
            expect(scenario.organization.entitlements.shieldEnabled).toBe(true);

            expect(mockResponse.data.limits.roasts).toBe(10000);
            expect(mockResponse.data.limits.integrationsLimit).toBe(18);
            expect(mockResponse.data.limits.shieldEnabled).toBe(true);
        });

        it('should preserve explicit integrationsLimit of 0', () => {
            const scenario = createMultiTenantTestScenario('simple', {
                planType: 'pro',
                entitlements: { integrationsLimit: 0 }
            });

            expect(scenario.organization.entitlements.integrationsLimit).toBe(0);
        });
    });
});
