/**
 * Tests for EntitlementsService Polar Integration (Issue #594)
 *
 * Verifies:
 * - setEntitlementsFromPolarPrice correctly maps price IDs to plan limits
 * - Polar client initialization
 * - Error handling for missing Polar integration
 * - Fallback entitlements on error
 */

const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls (Issue #892 - Fix Supabase Mock Pattern)
// ============================================================================

// Create Supabase mock with defaults
const mockSupabase = createSupabaseMock({
    user_activities: [],
    entitlements: []
});

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: mockSupabase
}));

const EntitlementsService = require('../../../src/services/entitlementsService');
const { getPlanFromPriceId } = require('../../../src/utils/polarHelpers');
const { logger } = require('../../../src/utils/logger');

jest.mock('../../../src/utils/polarHelpers');
jest.mock('../../../src/utils/logger');
jest.mock('@polar-sh/sdk');
jest.mock('../../../src/services/stripeWrapper', () => {
    // Mock StripeWrapper to prevent initialization errors
    return jest.fn().mockImplementation(() => ({
        prices: {
            retrieve: jest.fn()
        }
    }));
});
jest.mock('../../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn().mockReturnValue(true)
    }
}));

describe('EntitlementsService - Polar Integration', () => {
    let service;
    let mockFrom;
    let mockSelect;
    let mockUpsert;
    let mockEq;
    let mockSingle;

    const userId = 'test-user-123';
    const testPriceIds = {
        starter: 'price_starter_123',
        pro: 'price_pro_456',
        creator_plus: 'price_plus_789'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabase._reset();

        // Set up Polar env var
        process.env.POLAR_ACCESS_TOKEN = 'test_access_token';

        // Mock Supabase chains - Correctly chain .upsert().select().single()
        mockSingle = jest.fn(); // Dynamically set per test
        mockSelect = jest.fn(() => ({
            single: mockSingle
        }));
        mockUpsert = jest.fn((data) => {
            // Capture the data being upserted and make it available to .single()
            const upsertedData = {
                account_id: userId,
                ...data
            };
            mockSingle.mockResolvedValue({
                data: upsertedData,
                error: null
            });
            return {
                select: mockSelect
            };
        });
        mockEq = jest.fn(() => ({ single: mockSingle }));

        mockSupabase.from.mockImplementation((table) => ({
            select: mockSelect,
            upsert: mockUpsert,
            eq: mockEq
        }));

        // Mock polarHelpers
        getPlanFromPriceId.mockImplementation((priceId) => {
            if (priceId === testPriceIds.starter) return 'starter_trial';
            if (priceId === testPriceIds.pro) return 'pro';
            if (priceId === testPriceIds.creator_plus) return 'creator_plus';
            throw new Error(`Unknown price_id: ${priceId}`);
        });

        // Instantiate service
        service = new EntitlementsService();
    });

    afterEach(() => {
        delete process.env.POLAR_ACCESS_TOKEN;
    });

    describe('Constructor', () => {
        it('should initialize Polar client when POLAR_ACCESS_TOKEN is set', () => {
            expect(service.polarClient).toBeDefined();
        });

        it('should not initialize Polar client when POLAR_ACCESS_TOKEN is missing', () => {
            delete process.env.POLAR_ACCESS_TOKEN;
            const serviceNoPolar = new EntitlementsService();
            expect(serviceNoPolar.polarClient).toBeNull();
        });
    });

    describe('setEntitlementsFromPolarPrice', () => {
        it('should set entitlements for starter_trial plan', async () => {
            const result = await service.setEntitlementsFromPolarPrice(
                userId,
                testPriceIds.starter
            );

            expect(result.success).toBe(true);
            expect(result.source).toBe('polar_price');

            expect(mockUpsert).toHaveBeenCalled();
            const upsertCall = mockUpsert.mock.calls[0][0];
            expect(upsertCall.plan_name).toBe('starter_trial');
            expect(upsertCall.analysis_limit_monthly).toBe(100);
            expect(upsertCall.roast_limit_monthly).toBe(50);
            expect(upsertCall.persona_fields_limit).toBe(0);
            expect(upsertCall.roast_level_max).toBe(1);
            expect(upsertCall.shield_enabled).toBe(true);
            expect(upsertCall.model).toBe('gpt-3.5-turbo');
            expect(upsertCall.rqc_mode).toBe('basic');
            expect(upsertCall.polar_price_id).toBe(testPriceIds.starter);
        });

        it('should set entitlements for pro plan', async () => {
            const result = await service.setEntitlementsFromPolarPrice(
                userId,
                testPriceIds.pro
            );

            expect(result.success).toBe(true);

            const upsertCall = mockUpsert.mock.calls[0][0];
            expect(upsertCall.plan_name).toBe('pro');
            expect(upsertCall.analysis_limit_monthly).toBe(1000);
            expect(upsertCall.roast_limit_monthly).toBe(500);
            expect(upsertCall.persona_fields_limit).toBe(10);
            expect(upsertCall.roast_level_max).toBe(5);
            expect(upsertCall.model).toBe('gpt-4');
            expect(upsertCall.rqc_mode).toBe('advanced');
        });

        it('should set entitlements for creator_plus plan', async () => {
            // Mock getPlanFromPriceId to return 'plus' (the actual plan name used in code)
            getPlanFromPriceId.mockImplementation((priceId) => {
                if (priceId === testPriceIds.creator_plus) return 'plus';
                if (priceId === testPriceIds.starter) return 'starter_trial';
                if (priceId === testPriceIds.pro) return 'pro';
                throw new Error(`Unknown price_id: ${priceId}`);
            });

            const result = await service.setEntitlementsFromPolarPrice(
                userId,
                testPriceIds.creator_plus
            );

            expect(result.success).toBe(true);

            const upsertCall = mockUpsert.mock.calls[0][0];
            expect(upsertCall.plan_name).toBe('plus');
            expect(upsertCall.analysis_limit_monthly).toBe(10000);
            expect(upsertCall.roast_limit_monthly).toBe(5000);
            expect(upsertCall.persona_fields_limit).toBe(50);
            expect(upsertCall.roast_level_max).toBe(10);
            expect(upsertCall.model).toBe('gpt-4');
            expect(upsertCall.rqc_mode).toBe('premium');
        });

        it('should include metadata with updated_from and plan_name', async () => {
            await service.setEntitlementsFromPolarPrice(userId, testPriceIds.pro);

            const upsertCall = mockUpsert.mock.calls[0][0];
            expect(upsertCall.metadata).toMatchObject({
                updated_from: 'polar_price',
                plan_name: 'pro'
            });
            expect(upsertCall.metadata.updated_at).toBeDefined();
        });

        it('should merge custom metadata with default metadata', async () => {
            const customMetadata = { source_event: 'subscription.updated', webhook_id: 'evt_123' };
            
            await service.setEntitlementsFromPolarPrice(userId, testPriceIds.pro, {
                metadata: customMetadata
            });

            const upsertCall = mockUpsert.mock.calls[0][0];
            expect(upsertCall.metadata).toMatchObject({
                updated_from: 'polar_price',
                plan_name: 'pro',
                source_event: 'subscription.updated',
                webhook_id: 'evt_123'
            });
        });

        it('should log entitlements update with correct values', async () => {
            await service.setEntitlementsFromPolarPrice(userId, testPriceIds.pro);

            expect(logger.info).toHaveBeenCalledWith(
                'Entitlements updated from Polar Price',
                expect.objectContaining({
                    userId,
                    polarPriceId: testPriceIds.pro,
                    planName: 'pro',
                    analysisLimit: 1000,
                    roastLimit: 500
                })
            );
        });

        it('should throw error if Polar client is not initialized', async () => {
            service.polarClient = null;

            const result = await service.setEntitlementsFromPolarPrice(userId, testPriceIds.pro);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Polar integration not enabled');
        });

        it('should handle unknown price_id and return error', async () => {
            getPlanFromPriceId.mockImplementation(() => {
                throw new Error('Unknown price_id: invalid_price_123');
            });

            const result = await service.setEntitlementsFromPolarPrice(userId, 'invalid_price_123');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown price_id');
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to set entitlements from Polar Price',
                expect.objectContaining({
                    userId,
                    polarPriceId: 'invalid_price_123'
                })
            );
        });

        it('should apply fallback entitlements on error', async () => {
            mockUpsert.mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
            });

            // Mock _applyFallbackEntitlements
            service._applyFallbackEntitlements = jest.fn().mockResolvedValue(true);

            const result = await service.setEntitlementsFromPolarPrice(userId, testPriceIds.pro);

            expect(result.success).toBe(false);
            expect(result.fallback_applied).toBe(true);
            expect(service._applyFallbackEntitlements).toHaveBeenCalledWith(userId);
        });

        it('should return existing entitlements data on success', async () => {
            const result = await service.setEntitlementsFromPolarPrice(userId, testPriceIds.pro);

            expect(result.success).toBe(true);
            expect(result.entitlements).toBeDefined();
            expect(result.entitlements.plan_name).toBe('pro');
            expect(result.entitlements.analysis_limit_monthly).toBe(1000);
            expect(result.entitlements.roast_limit_monthly).toBe(500);
            expect(result.entitlements.model).toBe('gpt-4');
            expect(result.entitlements.rqc_mode).toBe('advanced');
        });
    });

    describe('_getPlanLimitsFromName', () => {
        it('should return correct limits for starter_trial', () => {
            const limits = service._getPlanLimitsFromName('starter_trial');

            expect(limits).toEqual({
                plan_name: 'starter_trial',
                analysis_limit_monthly: 100,
                roast_limit_monthly: 50,
                persona_fields_limit: 0,
                roast_level_max: 1,
                shield_enabled: true,
                model: 'gpt-3.5-turbo',
                rqc_mode: 'basic'
            });
        });

        it('should return correct limits for pro', () => {
            const limits = service._getPlanLimitsFromName('pro');

            expect(limits).toEqual({
                plan_name: 'pro',
                analysis_limit_monthly: 1000,
                roast_limit_monthly: 500,
                persona_fields_limit: 10,
                roast_level_max: 5,
                shield_enabled: true,
                model: 'gpt-4',
                rqc_mode: 'advanced'
            });
        });

        it('should return correct limits for creator_plus', () => {
            const limits = service._getPlanLimitsFromName('plus');

            expect(limits).toEqual({
                plan_name: 'plus',
                analysis_limit_monthly: 10000,
                roast_limit_monthly: 5000,
                persona_fields_limit: 50,
                roast_level_max: 10,
                shield_enabled: true,
                model: 'gpt-4',
                rqc_mode: 'premium'
            });
        });

        it('should return starter_trial limits for unknown plan (fallback)', () => {
            const limits = service._getPlanLimitsFromName('unknown_plan_xyz');

            expect(limits).toEqual({
                plan_name: 'starter_trial',
                analysis_limit_monthly: 100,
                roast_limit_monthly: 50,
                persona_fields_limit: 0,
                roast_level_max: 1,
                shield_enabled: true,
                model: 'gpt-3.5-turbo',
                rqc_mode: 'basic'
            });
        });
    });
});

