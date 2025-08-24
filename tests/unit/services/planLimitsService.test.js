const planLimitsService = require('../../../src/services/planLimitsService');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const { logger } = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn()
    }
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    }
}));

describe('PlanLimitsService', () => {
    let mockFrom, mockSelect, mockEq, mockSingle, mockUpdate, mockOrder;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Clear cache
        planLimitsService.clearCache();
        
        // Setup mock chain
        mockSingle = jest.fn();
        mockOrder = jest.fn();
        mockEq = jest.fn(() => ({ single: mockSingle }));
        mockSelect = jest.fn(() => ({ eq: mockEq, order: mockOrder }));
        
        // For update operations
        const mockUpdateSelect = jest.fn(() => ({ single: mockSingle }));
        const mockUpdateEq = jest.fn(() => ({ select: mockUpdateSelect }));
        mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));
        
        mockFrom = jest.fn(() => ({ 
            select: mockSelect,
            update: mockUpdate
        }));
        
        supabaseServiceClient.from.mockImplementation(mockFrom);
    });

    describe('getPlanLimits', () => {
        const mockPlanLimits = {
            plan_id: 'pro',
            max_roasts: 1000,
            monthly_responses_limit: 1000,
            monthly_analysis_limit: 10000,
            max_platforms: 5,
            integrations_limit: 5,
            shield_enabled: true,
            custom_prompts: false,
            priority_support: true,
            api_access: false,
            analytics_enabled: true,
            custom_tones: true,
            dedicated_support: false,
            monthly_tokens_limit: 500000,
            daily_api_calls_limit: 5000,
            settings: { extra: 'data' }
        };

        it('should fetch plan limits from database', async () => {
            mockSingle.mockResolvedValue({ data: mockPlanLimits, error: null });

            const limits = await planLimitsService.getPlanLimits('pro');

            expect(supabaseServiceClient.from).toHaveBeenCalledWith('plan_limits');
            expect(mockSelect).toHaveBeenCalledWith('*');
            expect(mockEq).toHaveBeenCalledWith('plan_id', 'pro');
            expect(limits).toEqual({
                maxRoasts: 1000,
                monthlyResponsesLimit: 1000,
                monthlyAnalysisLimit: 10000,
                maxPlatforms: 5,
                integrationsLimit: 5,
                shieldEnabled: true,
                customPrompts: false,
                prioritySupport: true,
                apiAccess: false,
                analyticsEnabled: true,
                customTones: true,
                dedicatedSupport: false,
                monthlyTokensLimit: 500000,
                dailyApiCallsLimit: 5000,
                extra: 'data'
            });
        });

        it('should return cached limits on second call', async () => {
            mockSingle.mockResolvedValue({ data: mockPlanLimits, error: null });

            // First call
            await planLimitsService.getPlanLimits('pro');
            
            // Second call (should use cache)
            const limits = await planLimitsService.getPlanLimits('pro');

            // Should only call database once
            expect(supabaseServiceClient.from).toHaveBeenCalledTimes(1);
            expect(limits.maxRoasts).toBe(1000);
        });

        it('should return default limits on database error', async () => {
            mockSingle.mockResolvedValue({ data: null, error: new Error('Database error') });

            const limits = await planLimitsService.getPlanLimits('pro');

            expect(logger.error).toHaveBeenCalledWith('Failed to fetch plan limits:', expect.any(Error));
            expect(limits).toEqual({
                maxRoasts: 1000,
                monthlyResponsesLimit: 1000,
                monthlyAnalysisLimit: 10000,
                maxPlatforms: 5,
                integrationsLimit: 5,
                shieldEnabled: true,
                customPrompts: false,
                prioritySupport: true,
                apiAccess: false,
                analyticsEnabled: true,
                customTones: true,
                dedicatedSupport: false,
                monthlyTokensLimit: 500000,
                dailyApiCallsLimit: 5000,
                ai_model: 'gpt-4o'
            });
        });

        it('should return free plan limits for unknown plan', async () => {
            mockSingle.mockResolvedValue({ data: null, error: new Error('Not found') });

            const limits = await planLimitsService.getPlanLimits('unknown_plan');

            expect(limits.maxRoasts).toBe(10);
            expect(limits.shieldEnabled).toBe(false);
        });
    });

    describe('getAllPlanLimits', () => {
        const mockAllLimits = [
            {
                plan_id: 'free',
                max_roasts: 10,
                monthly_responses_limit: 10,
                monthly_analysis_limit: 1000,
                max_platforms: 2,
                integrations_limit: 2,
                shield_enabled: false,
                custom_prompts: false,
                priority_support: false,
                custom_tones: false,
                settings: {}
            },
            {
                plan_id: 'starter',
                max_roasts: 10,
                monthly_responses_limit: 10,
                monthly_analysis_limit: 1000,
                max_platforms: 2,
                integrations_limit: 2,
                shield_enabled: true,
                custom_prompts: false,
                priority_support: false,
                custom_tones: false,
                settings: {}
            },
            {
                plan_id: 'pro',
                max_roasts: 1000,
                monthly_responses_limit: 1000,
                monthly_analysis_limit: 10000,
                max_platforms: 5,
                integrations_limit: 5,
                shield_enabled: true,
                custom_prompts: false,
                priority_support: true,
                custom_tones: true,
                settings: {}
            },
            {
                plan_id: 'plus',
                max_roasts: 5000,
                monthly_responses_limit: 5000,
                monthly_analysis_limit: 100000,
                max_platforms: 10,
                integrations_limit: 10,
                shield_enabled: true,
                custom_prompts: true,
                priority_support: true,
                custom_tones: true,
                settings: {}
            },
            {
                plan_id: 'custom',
                max_roasts: -1,
                monthly_responses_limit: -1,
                monthly_analysis_limit: -1,
                max_platforms: -1,
                integrations_limit: -1,
                shield_enabled: true,
                custom_prompts: true,
                priority_support: true,
                custom_tones: true,
                settings: {}
            }
        ];

        beforeEach(() => {
            // Setup for getAllPlanLimits
            const mockOrder = jest.fn(() => ({ data: mockAllLimits, error: null }));
            mockSelect.mockReturnValue({ order: mockOrder });
        });

        it('should fetch all plan limits from database', async () => {
            const allLimits = await planLimitsService.getAllPlanLimits();

            expect(supabaseServiceClient.from).toHaveBeenCalledWith('plan_limits');
            expect(mockSelect).toHaveBeenCalledWith('*');
            expect(allLimits).toHaveProperty('free');
            expect(allLimits).toHaveProperty('starter');
            expect(allLimits).toHaveProperty('pro');
            expect(allLimits).toHaveProperty('plus');
            expect(allLimits).toHaveProperty('custom');
            expect(allLimits.free.maxRoasts).toBe(10);
            expect(allLimits.starter.maxRoasts).toBe(10);
            expect(allLimits.pro.maxRoasts).toBe(1000);
            expect(allLimits.plus.maxRoasts).toBe(5000);
            expect(allLimits.custom.maxRoasts).toBe(-1);
        });
    });

    describe('updatePlanLimits', () => {
        it('should update plan limits successfully', async () => {
            const updates = {
                maxRoasts: 2000,
                monthlyResponsesLimit: 2000
            };
            
            mockSingle.mockResolvedValue({ 
                data: { plan_id: 'pro', max_roasts: 2000, monthly_responses_limit: 2000 }, 
                error: null 
            });

            const result = await planLimitsService.updatePlanLimits('pro', updates, 'admin-123');

            expect(mockUpdate).toHaveBeenCalledWith({
                max_roasts: 2000,
                monthly_responses_limit: 2000,
                updated_by: 'admin-123'
            });
            expect(mockEq).toHaveBeenCalledWith('plan_id', 'pro');
            expect(logger.info).toHaveBeenCalledWith('Plan limits updated:', {
                planId: 'pro',
                updatedBy: 'admin-123',
                changes: ['maxRoasts', 'monthlyResponsesLimit']
            });
        });

        it('should clear cache after update', async () => {
            const updates = { maxRoasts: 2000 };
            
            // First, populate cache
            mockSingle.mockResolvedValue({ 
                data: { plan_id: 'pro', max_roasts: 1000 }, 
                error: null 
            });
            await planLimitsService.getPlanLimits('pro');
            
            // Then update
            mockSingle.mockResolvedValue({ 
                data: { plan_id: 'pro', max_roasts: 2000 }, 
                error: null 
            });
            await planLimitsService.updatePlanLimits('pro', updates, 'admin-123');
            
            // Verify cache was cleared by checking next call hits database
            await planLimitsService.getPlanLimits('pro');
            
            // Should have called database 3 times (initial get, update, get after cache clear)
            expect(supabaseServiceClient.from).toHaveBeenCalledTimes(3);
        });

        it('should handle update errors', async () => {
            mockSingle.mockRejectedValue(new Error('Update failed'));

            await expect(
                planLimitsService.updatePlanLimits('pro', { maxRoasts: 2000 }, 'admin-123')
            ).rejects.toThrow('Update failed');
        });
    });

    describe('checkLimit', () => {
        beforeEach(() => {
            mockSingle.mockResolvedValue({
                data: {
                    plan_id: 'pro',
                    max_roasts: 1000,
                    max_platforms: 5,
                    monthly_responses_limit: 1000,
                    integrations_limit: 5,
                    monthly_tokens_limit: 100000,
                    daily_api_calls_limit: 1000
                },
                error: null
            });
        });

        it('should return false when usage is below limit', async () => {
            const result = await planLimitsService.checkLimit('pro', 'roasts', 500);
            expect(result).toBe(false);
        });

        it('should return true when usage equals limit', async () => {
            const result = await planLimitsService.checkLimit('pro', 'roasts', 1000);
            expect(result).toBe(true);
        });

        it('should return true when usage exceeds limit', async () => {
            const result = await planLimitsService.checkLimit('pro', 'roasts', 1500);
            expect(result).toBe(true);
        });

        it('should return false for unlimited (-1) limits', async () => {
            mockSingle.mockResolvedValue({
                data: { plan_id: 'custom', max_roasts: -1 },
                error: null
            });

            const result = await planLimitsService.checkLimit('custom', 'roasts', 999999);
            expect(result).toBe(false);
        });

        it('should handle unknown limit types', async () => {
            const result = await planLimitsService.checkLimit('pro', 'unknown_limit', 100);
            expect(result).toBe(false);
        });

        it('should check monthly analysis limits', async () => {
            mockSingle.mockResolvedValue({
                data: { plan_id: 'starter', monthly_analysis_limit: 1000 },
                error: null
            });

            const result = await planLimitsService.checkLimit('starter', 'monthly_analysis', 1500);
            expect(result).toBe(true);
        });

        it('should return false on error', async () => {
            // Mock getPlanLimits to throw an error directly
            jest.spyOn(planLimitsService, 'getPlanLimits').mockRejectedValue(new Error('Database error'));

            const result = await planLimitsService.checkLimit('pro', 'roasts', 1500);
            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalled();
            
            // Restore the spy
            planLimitsService.getPlanLimits.mockRestore();
        });
    });

    describe('clearCache', () => {
        it('should clear the cache', async () => {
            // Populate cache
            mockSingle.mockResolvedValue({
                data: { plan_id: 'pro', max_roasts: 1000 },
                error: null
            });
            await planLimitsService.getPlanLimits('pro');
            
            // Clear cache
            planLimitsService.clearCache();
            
            // Next call should hit database
            await planLimitsService.getPlanLimits('pro');
            
            expect(supabaseServiceClient.from).toHaveBeenCalledTimes(2);
            expect(logger.debug).toHaveBeenCalledWith('Plan limits cache cleared');
        });
    });
});