const workerNotificationService = require('../../../src/services/workerNotificationService');
const planLimitsService = require('../../../src/services/planLimitsService');
const { logger } = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/services/planLimitsService');
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

describe('WorkerNotificationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset service state
        if (workerNotificationService.subscribers) {
            workerNotificationService.subscribers.clear();
        }
    });

    describe('notifyPlanChange', () => {
        it('should notify plan change with database limits', async () => {
            const mockLimits = {
                maxRoasts: 1000,
                maxPlatforms: 5,
                shieldEnabled: true,
                customPrompts: false,
                prioritySupport: true
            };
            
            planLimitsService.getPlanLimits.mockResolvedValue(mockLimits);
            
            const result = await workerNotificationService.notifyPlanChange(
                'user-123', 
                'free', 
                'pro', 
                'active'
            );
            
            expect(planLimitsService.getPlanLimits).toHaveBeenCalledWith('pro');
            expect(result).toEqual({ success: true });
            expect(logger.info).toHaveBeenCalledWith('🔄 Plan change notification sent:', {
                userId: 'user-123',
                oldPlan: 'free',
                newPlan: 'pro',
                status: 'active'
            });
        });

        it('should apply free plan limits when status is not active', async () => {
            const mockProLimits = {
                maxRoasts: 1000,
                maxPlatforms: 5,
                shieldEnabled: true
            };
            
            const mockFreeLimits = {
                maxRoasts: 100,
                maxPlatforms: 1,
                shieldEnabled: false
            };
            
            planLimitsService.getPlanLimits
                .mockResolvedValueOnce(mockProLimits) // First call for 'pro'
                .mockResolvedValueOnce(mockFreeLimits); // Second call for 'free'
            
            const result = await workerNotificationService.notifyPlanChange(
                'user-123', 
                'free', 
                'pro', 
                'cancelled'
            );
            
            expect(planLimitsService.getPlanLimits).toHaveBeenCalledWith('pro');
            expect(planLimitsService.getPlanLimits).toHaveBeenCalledWith('free');
            expect(result).toEqual({ success: true });
        });

        it('should use fallback limits on database error', async () => {
            planLimitsService.getPlanLimits.mockRejectedValue(new Error('Database error'));
            
            // Since the error is caught within getPlanLimits and fallback values are returned,
            // the notification should still succeed but with fallback limits
            const result = await workerNotificationService.notifyPlanChange(
                'user-123', 
                'free', 
                'pro', 
                'active'
            );
            
            // The service logs the error but still returns success with fallback limits
            expect(logger.error).toHaveBeenCalledWith('Failed to get plan limits:', expect.any(Error));
            expect(result).toEqual({ success: true });
        });
    });

    describe('notifyStatusChange', () => {
        it('should notify status change with database limits', async () => {
            const mockLimits = {
                maxRoasts: 1000,
                maxPlatforms: 5,
                shieldEnabled: true
            };
            
            planLimitsService.getPlanLimits.mockResolvedValue(mockLimits);
            
            const result = await workerNotificationService.notifyStatusChange(
                'user-123', 
                'pro', 
                'active'
            );
            
            expect(planLimitsService.getPlanLimits).toHaveBeenCalledWith('pro');
            expect(result).toEqual({ success: true });
            expect(logger.info).toHaveBeenCalledWith('🔄 Status change notification sent:', {
                userId: 'user-123',
                plan: 'pro',
                status: 'active'
            });
        });
    });

    describe('getPlanLimits', () => {
        it('should get plan limits from database service', async () => {
            const mockLimits = {
                maxRoasts: 1000,
                maxPlatforms: 5,
                shieldEnabled: true,
                customPrompts: false,
                prioritySupport: true
            };
            
            planLimitsService.getPlanLimits.mockResolvedValue(mockLimits);
            
            const limits = await workerNotificationService.getPlanLimits('pro', 'active');
            
            expect(planLimitsService.getPlanLimits).toHaveBeenCalledWith('pro');
            expect(limits).toEqual(mockLimits);
        });

        it('should apply free limits when status is not active', async () => {
            const mockProLimits = {
                maxRoasts: 1000,
                maxPlatforms: 5,
                shieldEnabled: true
            };
            
            const mockFreeLimits = {
                maxRoasts: 100,
                maxPlatforms: 1,
                shieldEnabled: false
            };
            
            planLimitsService.getPlanLimits
                .mockResolvedValueOnce(mockProLimits)
                .mockResolvedValueOnce(mockFreeLimits);
            
            const limits = await workerNotificationService.getPlanLimits('pro', 'cancelled');
            
            expect(limits).toEqual({
                ...mockProLimits,
                ...mockFreeLimits,
                suspended: true
            });
        });

        it('should use fallback limits on error', async () => {
            planLimitsService.getPlanLimits.mockRejectedValue(new Error('Database error'));
            
            const limits = await workerNotificationService.getPlanLimits('pro', 'active');
            
            expect(logger.error).toHaveBeenCalledWith('Failed to get plan limits:', expect.any(Error));
            expect(limits).toEqual({
                maxRoasts: 1000,
                maxPlatforms: 5,
                shieldEnabled: true,
                customPrompts: false,
                prioritySupport: true
            });
        });
    });

    describe('getFallbackLimits', () => {
        it('should return correct fallback limits for known plans', () => {
            const proLimits = workerNotificationService.getFallbackLimits('pro', 'active');
            expect(proLimits).toEqual({
                maxRoasts: 1000,
                maxPlatforms: 5,
                shieldEnabled: true,
                customPrompts: false,
                prioritySupport: true
            });
            
            const freeLimits = workerNotificationService.getFallbackLimits('free', 'active');
            expect(freeLimits).toEqual({
                maxRoasts: 100,
                maxPlatforms: 1,
                shieldEnabled: false,
                customPrompts: false,
                prioritySupport: false
            });
        });

        it('should apply free limits when status is not active', () => {
            const limits = workerNotificationService.getFallbackLimits('pro', 'cancelled');
            expect(limits).toEqual({
                maxRoasts: 100,
                maxPlatforms: 1,
                shieldEnabled: false,
                customPrompts: false,
                prioritySupport: false,
                suspended: true
            });
        });

        it('should return free limits for unknown plans', () => {
            const limits = workerNotificationService.getFallbackLimits('unknown', 'active');
            expect(limits).toEqual({
                maxRoasts: 100,
                maxPlatforms: 1,
                shieldEnabled: false,
                customPrompts: false,
                prioritySupport: false
            });
        });
    });

    describe('subscriber management', () => {
        it('should handle subscription and notification', () => {
            const mockCallback = jest.fn();
            
            // Subscribe
            workerNotificationService.subscribe('plan_changes', mockCallback);
            
            // Trigger notification
            const message = { type: 'PLAN_CHANGE', userId: 'test' };
            workerNotificationService.notifyInMemory('plan_changes', message);
            
            expect(mockCallback).toHaveBeenCalledWith(message);
            expect(logger.debug).toHaveBeenCalledWith('🔄 In-memory notification sent:', {
                channel: 'plan_changes',
                subscribers: 1,
                messageType: 'PLAN_CHANGE'
            });
        });

        it('should handle unsubscription', () => {
            const mockCallback = jest.fn();
            
            // Subscribe and unsubscribe
            workerNotificationService.subscribe('plan_changes', mockCallback);
            workerNotificationService.unsubscribe('plan_changes', mockCallback);
            
            // Trigger notification
            const message = { type: 'PLAN_CHANGE', userId: 'test' };
            workerNotificationService.notifyInMemory('plan_changes', message);
            
            expect(mockCallback).not.toHaveBeenCalled();
        });

        it('should return correct stats', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            
            workerNotificationService.subscribe('plan_changes', callback1);
            workerNotificationService.subscribe('status_changes', callback2);
            
            const stats = workerNotificationService.getStats();
            
            expect(stats).toEqual({
                channels: 2,
                totalSubscribers: 2,
                channelStats: {
                    plan_changes: 1,
                    status_changes: 1
                }
            });
        });
    });
});