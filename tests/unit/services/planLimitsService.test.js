const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls (Issue #892 - Fix Supabase Mock Pattern)
// ============================================================================

// Create Supabase mock with defaults
const mockSupabase = createSupabaseMock({
    plan_limits: []
});

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: mockSupabase
}));

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

// ============================================================================
// STEP 3: Require modules AFTER mocks are configured
// ============================================================================

const planLimitsService = require('../../../src/services/planLimitsService');
const { logger } = require('../../../src/utils/logger');

describe('PlanLimitsService', () => {
    let mockFrom, mockSelect, mockEq, mockSingle, mockUpdate, mockOrder;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Reset Supabase mock to defaults
        mockSupabase._reset();
        
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
        
        // Configure mockSupabase.from to return our configured mockFrom
        mockSupabase.from.mockImplementation(mockFrom);
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

            expect(mockSupabase.from).toHaveBeenCalledWith('plan_limits');
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
            expect(mockSupabase.from).toHaveBeenCalledTimes(1);
            expect(limits.maxRoasts).toBe(1000);
        });

        it('should return default limits on database error', async () => {
            mockSingle.mockResolvedValue({ data: null, error: new Error('Database error') });

            const limits = await planLimitsService.getPlanLimits('pro');

            // Issue #841: planLimitsService now uses planService.js as fallback, so it doesn't log errors
            // It just returns defaults from planService.js when DB fails
            expect(limits).toEqual({
                maxRoasts: 1000,
                monthlyResponsesLimit: 1000,
                monthlyAnalysisLimit: 10000,
                maxPlatforms: 2,
                integrationsLimit: 2,
                shieldEnabled: true,
                customPrompts: false,
                prioritySupport: false,
                apiAccess: false,
                analyticsEnabled: false,
                customTones: false,
                dedicatedSupport: false,
                embeddedJudge: false,
                monthlyTokensLimit: 500000,
                dailyApiCallsLimit: 5000,
                ai_model: 'gpt-5.1'
            });
        });

        it('should return starter_trial plan limits for unknown plan', async () => {
            mockSingle.mockResolvedValue({ data: null, error: new Error('Not found') });

            const limits = await planLimitsService.getPlanLimits('unknown_plan');

            expect(limits.maxRoasts).toBe(5);
            expect(limits.shieldEnabled).toBe(true);
        });
    });

    describe('getAllPlanLimits', () => {
        const mockAllLimits = [
            {
                plan_id: 'starter_trial',
                max_roasts: 5,
                monthly_responses_limit: 5,
                monthly_analysis_limit: 1000,
                max_platforms: 1,
                integrations_limit: 1,
                shield_enabled: true,
                custom_prompts: false,
                priority_support: false,
                custom_tones: false,
                settings: {}
            },
            {
                plan_id: 'starter',
                max_roasts: 5,
                monthly_responses_limit: 5,
                monthly_analysis_limit: 1000,
                max_platforms: 1,
                integrations_limit: 1,
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
                max_platforms: 2,
                integrations_limit: 2,
                shield_enabled: true,
                custom_prompts: false,
                priority_support: false,
                custom_tones: false,
                settings: {}
            },
            {
                plan_id: 'plus',
                max_roasts: 5000,
                monthly_responses_limit: 5000,
                monthly_analysis_limit: 100000,
                max_platforms: 2,
                integrations_limit: 2,
                shield_enabled: true,
                custom_prompts: false,
                priority_support: false,
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

            expect(mockSupabase.from).toHaveBeenCalledWith('plan_limits');
            expect(mockSelect).toHaveBeenCalledWith('*');
            expect(allLimits).toHaveProperty('starter_trial');
            expect(allLimits).toHaveProperty('starter');
            expect(allLimits).toHaveProperty('pro');
            expect(allLimits).toHaveProperty('plus');
            expect(allLimits).toHaveProperty('custom');
            expect(allLimits.starter_trial.maxRoasts).toBe(5);
            expect(allLimits.starter.maxRoasts).toBe(5);
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
            expect(mockSupabase.from).toHaveBeenCalledTimes(3);
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

        it('should return true (fail-closed) on error', async () => {
            // Mock getPlanLimits to throw an error directly
            jest.spyOn(planLimitsService, 'getPlanLimits').mockRejectedValue(new Error('Database error'));

            // Issue #841: checkLimit now uses fail-closed behavior (returns true to deny action for security)
            const result = await planLimitsService.checkLimit('pro', 'roasts', 1500);
            expect(result).toBe(true); // Fail-closed: deny action for security
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
            
            expect(mockSupabase.from).toHaveBeenCalledTimes(2);
            expect(logger.debug).toHaveBeenCalledWith('Plan limits cache cleared');
        });
    });
});