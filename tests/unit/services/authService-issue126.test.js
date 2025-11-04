const mockSupabaseServiceClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis()
};

const mockCreateUserClient = jest.fn();

// Mock Supabase client
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: mockSupabaseServiceClient,
    createUserClient: mockCreateUserClient
}));

// Mock logger
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

// Mock auditService
const mockAuditService = {
    logPlanChange: jest.fn()
};

jest.mock('../../../src/services/auditLogService', () => mockAuditService);

// Mock planService and other dependencies
jest.mock('../../../src/services/planService', () => ({
    getPlanFeatures: jest.fn((plan) => ({
        duration: { days: plan === 'custom' ? 90 : 30 }
    })),
    calculatePlanEndDate: jest.fn(() => new Date('2024-02-01'))
}));

jest.mock('../../../src/services/planValidation', () => ({
    isChangeAllowed: jest.fn(() => Promise.resolve({ allowed: true, warnings: [] }))
}));

// Mock applyPlanLimits and getUserUsage
const mockApplyPlanLimits = jest.fn();
const mockGetUserUsage = jest.fn();
jest.mock('../../../src/services/subscriptionService', () => ({
    applyPlanLimits: mockApplyPlanLimits,
    getUserUsage: mockGetUserUsage
}));

const authService = require('../../../src/services/authService');

describe('AuthService.updateUserPlan - Issue #126 Improvements', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Default successful mocks
        mockSupabaseServiceClient.single.mockResolvedValue({
            data: {
                id: 'user-123',
                email: 'test@example.com',
                plan: 'free',
                name: 'Test User'
            },
            error: null
        });

        mockSupabaseServiceClient.update.mockResolvedValue({
            data: [{
                id: 'user-123',
                email: 'test@example.com',
                plan: 'pro',
                name: 'Test User'
            }],
            error: null
        });

        mockSupabaseServiceClient.upsert.mockResolvedValue({
            data: [{ id: 'sub-123', user_id: 'user-123', plan: 'pro' }],
            error: null
        });

        mockApplyPlanLimits.mockResolvedValue(true);
        mockAuditService.logPlanChange.mockResolvedValue(true);
        mockGetUserUsage.mockResolvedValue({
            roastsThisMonth: 10,
            commentsThisMonth: 50,
            tokensUsed: 1000
        });
    });

    describe('Standardized Error Handling', () => {
        it('should handle subscription update failures gracefully with warnings', async () => {
            // Mock subscription update failure
            mockSupabaseServiceClient.update
                .mockResolvedValueOnce({ // User update succeeds
                    data: [{ id: 'user-123', plan: 'pro' }],
                    error: null
                })
                .mockResolvedValueOnce({ // Subscription update fails
                    data: null,
                    error: { message: 'Connection timeout' }
                });

            const result = await authService.updateUserPlan('user-123', 'pro', 'admin-123');

            expect(result.message).toContain('with warnings');
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].type).toBe('subscription_update_failed');
            expect(result.warnings[0].details).toBe('Connection timeout');
        });

        it('should provide complete success response when all updates work', async () => {
            const result = await authService.updateUserPlan('user-123', 'pro', 'admin-123');

            expect(result.message).toBe('User plan updated successfully');
            expect(result.warnings).toEqual([]);
            expect(result.limitsApplied).toBe(true);
            expect(result.auditLogged).toBe(true);
            expect(result.oldPlan).toBe('free');
            expect(result.newPlan).toBe('pro');
        });

        it('should fail fast on user update errors', async () => {
            mockSupabaseServiceClient.update.mockResolvedValueOnce({
                data: null,
                error: { message: 'User not found' }
            });

            await expect(authService.updateUserPlan('invalid-user', 'pro', 'admin-123'))
                .rejects
                .toThrow('Failed to update user plan: User not found');
        });
    });

    describe('Rollback Mechanism', () => {
        it('should rollback plan change when applyPlanLimits fails', async () => {
            // Mock applyPlanLimits failure
            mockApplyPlanLimits.mockRejectedValue(new Error('Organization limit exceeded'));

            // Spy on rollbackPlanChange method
            const rollbackSpy = jest.spyOn(authService, 'rollbackPlanChange')
                .mockResolvedValue(true);

            await expect(authService.updateUserPlan('user-123', 'pro', 'admin-123'))
                .rejects
                .toThrow('Plan change failed during limits application and was rolled back');

            expect(rollbackSpy).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({ plan: 'free' }),
                expect.any(Object)
            );

            expect(mockAuditService.logPlanChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    changeStatus: 'rolled_back',
                    fromPlan: 'pro', // Rolling back from new to old
                    toPlan: 'free'
                })
            );

            rollbackSpy.mockRestore();
        });

        it('should handle emergency rollback on unexpected errors', async () => {
            // Mock an unexpected error after successful DB update
            mockAuditService.logPlanChange.mockRejectedValue(new Error('Audit service down'));

            const rollbackSpy = jest.spyOn(authService, 'rollbackPlanChange')
                .mockResolvedValue(true);

            await expect(authService.updateUserPlan('user-123', 'pro', 'admin-123'))
                .rejects
                .toThrow('Audit service down');

            expect(rollbackSpy).toHaveBeenCalled();

            rollbackSpy.mockRestore();
        });
    });

    describe('Variable Plan Duration Support', () => {
        it('should handle custom plan with 90-day duration', async () => {
            const result = await authService.updateUserPlan('user-123', 'custom', 'admin-123');

            expect(result.planDurationDays).toBe(90);
            expect(mockAuditService.logPlanChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        plan_duration_days: 90
                    })
                })
            );
        });

        it('should default to 30-day duration for standard plans', async () => {
            const result = await authService.updateUserPlan('user-123', 'pro', 'admin-123');

            expect(result.planDurationDays).toBe(30);
        });
    });

    describe('Admin Context Tracking', () => {
        it('should properly track admin-initiated changes', async () => {
            await authService.updateUserPlan('user-123', 'pro', 'admin-456');

            expect(mockAuditService.logPlanChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    initiatedBy: 'admin-456',
                    metadata: expect.objectContaining({
                        admin_initiated: true
                    })
                })
            );
        });

        it('should handle missing admin ID gracefully', async () => {
            await authService.updateUserPlan('user-123', 'pro');

            expect(mockAuditService.logPlanChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    initiatedBy: 'admin_system'
                })
            );
        });
    });

    describe('Enhanced Audit Logging', () => {
        it('should log single audit entry per plan change (no duplication)', async () => {
            await authService.updateUserPlan('user-123', 'pro', 'admin-123');

            // Should only be called once for successful change
            expect(mockAuditService.logPlanChange).toHaveBeenCalledTimes(1);
            expect(mockAuditService.logPlanChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    changeStatus: 'completed',
                    fromPlan: 'free',
                    toPlan: 'pro'
                })
            );
        });

        it('should include comprehensive metadata in audit log', async () => {
            await authService.updateUserPlan('user-123', 'plus', 'admin-789');

            expect(mockAuditService.logPlanChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-123',
                    fromPlan: 'free',
                    toPlan: 'plus',
                    changeStatus: 'completed',
                    initiatedBy: 'admin-789',
                    metadata: expect.objectContaining({
                        admin_initiated: true,
                        validation_passed: true,
                        validation_warnings: expect.any(Array),
                        plan_duration_days: expect.any(Number)
                    }),
                    usageSnapshot: expect.objectContaining({
                        timestamp: expect.any(String),
                        change_trigger: 'admin_panel'
                    })
                })
            );
        });
    });
});