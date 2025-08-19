/**
 * Integration tests for complete plan change flow
 * Tests end-to-end plan upgrade/downgrade scenarios
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock dependencies before requiring the modules
jest.mock('../../src/config/supabase');
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/emailService');
jest.mock('../../src/services/notificationService');
jest.mock('../../src/services/auditService');
jest.mock('stripe');

const subscriptionService = require('../../src/services/subscriptionService');
const planValidation = require('../../src/services/planValidation');
const auditService = require('../../src/services/auditService');
const emailService = require('../../src/services/emailService');
const notificationService = require('../../src/services/notificationService');

describe('Plan Change Flow Integration', () => {
    let mockSupabase;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup mock Supabase
        const { supabaseServiceClient } = require('../../src/config/supabase');
        mockSupabase = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
            update: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis()
        };
        Object.assign(supabaseServiceClient, mockSupabase);

        // Mock audit service
        auditService.logSubscriptionChange = jest.fn().mockResolvedValue({ success: true });
        auditService.logPlanChange = jest.fn().mockResolvedValue({ success: true });
        
        // Mock email service
        emailService.sendPlanChangeNotification = jest.fn().mockResolvedValue({ success: true });
        
        // Mock notification service
        notificationService.createPlanChangeNotification = jest.fn().mockResolvedValue({ success: true });
        notificationService.createPlanChangeBlockedNotification = jest.fn().mockResolvedValue({ success: true });
    });

    describe('Successful Plan Upgrade Flow', () => {
        it('should complete free to pro upgrade successfully', async () => {
            const mockSubscription = {
                id: 'sub_test_upgrade',
                customer: 'cus_test_user',
                status: 'active',
                items: {
                    data: [{
                        price: {
                            id: 'price_pro',
                            lookup_key: 'pro_monthly'
                        }
                    }]
                },
                current_period_start: Math.floor(Date.now() / 1000),
                current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
                cancel_at_period_end: false
            };

            // Mock user lookup
            mockSupabase.single
                .mockResolvedValueOnce({
                    data: { user_id: 'user123', plan: 'free' },
                    error: null
                })
                // Mock usage query (roasts count)
                .mockResolvedValueOnce({
                    count: 50,
                    error: null
                })
                // Mock usage query (comments count)  
                .mockResolvedValueOnce({
                    count: 200,
                    error: null
                });

            // Mock integrations query
            mockSupabase.select.mockResolvedValueOnce({
                data: [{ platform: 'twitter' }],
                error: null
            });

            // Mock subscription update
            mockSupabase.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });

            // Mock Stripe setup
            const stripe = require('stripe')();
            stripe.prices = { 
                list: jest.fn().mockResolvedValue({
                    data: [{
                        id: 'price_pro',
                        lookup_key: 'pro_monthly'
                    }]
                })
            };

            const result = await subscriptionService.processSubscriptionUpdate(mockSubscription);

            expect(result.success).toBe(true);
            expect(result.oldPlan).toBe('free');
            expect(result.newPlan).toBe('pro');
            expect(result.status).toBe('active');

            // Verify audit logging
            expect(auditService.logSubscriptionChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user123',
                    eventType: 'plan_change',
                    oldPlan: 'free',
                    newPlan: 'pro'
                })
            );

            expect(auditService.logPlanChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user123',
                    fromPlan: 'free',
                    toPlan: 'pro',
                    changeStatus: 'completed'
                })
            );

            // Verify notifications
            expect(emailService.sendPlanChangeNotification).toHaveBeenCalled();
            expect(notificationService.createPlanChangeNotification).toHaveBeenCalled();
        });

        it('should complete pro to creator_plus upgrade successfully', async () => {
            const mockSubscription = {
                id: 'sub_test_upgrade_premium',
                customer: 'cus_test_user',
                status: 'active',
                items: {
                    data: [{
                        price: {
                            id: 'price_creator',
                            lookup_key: 'creator_plus_monthly'
                        }
                    }]
                }
            };

            // Mock user with pro plan
            mockSupabase.single.mockResolvedValueOnce({
                data: { user_id: 'user123', plan: 'pro' },
                error: null
            });

            // Mock usage queries (within limits)
            mockSupabase.single
                .mockResolvedValueOnce({ count: 500, error: null })
                .mockResolvedValueOnce({ count: 2000, error: null });

            mockSupabase.select.mockResolvedValueOnce({
                data: [{ platform: 'twitter' }, { platform: 'youtube' }, { platform: 'instagram' }],
                error: null
            });

            mockSupabase.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });

            const result = await subscriptionService.processSubscriptionUpdate(mockSubscription);

            expect(result.success).toBe(true);
            expect(result.oldPlan).toBe('pro');
            expect(result.newPlan).toBe('creator_plus');
        });
    });

    describe('Blocked Plan Downgrade Flow', () => {
        it('should block downgrade when usage exceeds new plan limits', async () => {
            const mockSubscription = {
                id: 'sub_test_downgrade',
                customer: 'cus_test_user',
                status: 'active',
                items: {
                    data: [{
                        price: {
                            id: 'price_free',
                            lookup_key: 'free'
                        }
                    }]
                }
            };

            // Mock user with pro plan
            mockSupabase.single.mockResolvedValueOnce({
                data: { user_id: 'user123', plan: 'pro' },
                error: null
            });

            // Mock usage that exceeds free plan limits
            mockSupabase.single
                .mockResolvedValueOnce({ count: 150, error: null }) // 150 roasts > 100 free limit
                .mockResolvedValueOnce({ count: 400, error: null });

            mockSupabase.select.mockResolvedValueOnce({
                data: [{ platform: 'twitter' }],
                error: null
            });

            const result = await subscriptionService.processSubscriptionUpdate(mockSubscription);

            expect(result.success).toBe(false);
            expect(result.reason).toContain('Current monthly roasts (150) exceeds new plan limit (100)');

            // Verify blocked notification was sent
            expect(notificationService.createPlanChangeBlockedNotification).toHaveBeenCalledWith(
                'user123',
                expect.objectContaining({
                    oldPlan: 'pro',
                    newPlan: 'free',
                    reason: expect.stringContaining('exceeds new plan limit')
                })
            );

            // Verify no successful change notifications were sent
            expect(emailService.sendPlanChangeNotification).not.toHaveBeenCalled();
            expect(notificationService.createPlanChangeNotification).not.toHaveBeenCalled();
        });

        it('should block downgrade when active integrations exceed limit', async () => {
            const mockSubscription = {
                id: 'sub_test_downgrade_integrations',
                customer: 'cus_test_user',
                status: 'active',
                items: {
                    data: [{
                        price: {
                            id: 'price_pro',
                            lookup_key: 'pro_monthly'
                        }
                    }]
                }
            };

            // Mock user with creator_plus plan
            mockSupabase.single.mockResolvedValueOnce({
                data: { user_id: 'user123', plan: 'creator_plus' },
                error: null
            });

            // Mock usage within roast/comment limits but too many integrations
            mockSupabase.single
                .mockResolvedValueOnce({ count: 500, error: null })
                .mockResolvedValueOnce({ count: 2000, error: null });

            // Mock 7 active integrations (exceeds pro limit of 5)
            mockSupabase.select.mockResolvedValueOnce({
                data: [
                    { platform: 'twitter' },
                    { platform: 'youtube' },
                    { platform: 'instagram' },
                    { platform: 'facebook' },
                    { platform: 'discord' },
                    { platform: 'twitch' },
                    { platform: 'reddit' }
                ],
                error: null
            });

            const result = await subscriptionService.processSubscriptionUpdate(mockSubscription);

            expect(result.success).toBe(false);
            expect(result.reason).toContain('Active integrations (7) exceeds new plan limit (5)');
        });
    });

    describe('Plan Validation Integration', () => {
        it('should validate upgrade with warnings about lost features', async () => {
            const result = await planValidation.isChangeAllowed('creator_plus', 'pro', {
                roastsThisMonth: 500,
                commentsThisMonth: 2000,
                activeIntegrations: 5
            });

            expect(result.allowed).toBe(true);
            expect(result.warnings).toContain('You will lose access to team collaboration features');
            expect(result.warnings).toContain('You will lose access to custom style profiles');
        });

        it('should calculate proration correctly', () => {
            const now = Date.now() / 1000;
            const periodEnd = now + (15 * 86400); // 15 days remaining

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
    });

    describe('Error Handling and Recovery', () => {
        it('should handle database errors gracefully', async () => {
            const mockSubscription = {
                id: 'sub_test_error',
                customer: 'cus_test_user',
                status: 'active'
            };

            // Mock database error
            mockSupabase.single.mockRejectedValue(new Error('Database connection failed'));

            const result = await subscriptionService.processSubscriptionUpdate(mockSubscription);

            expect(result).toBeUndefined(); // Function should handle error and not return success
        });

        it('should continue processing even if audit logging fails', async () => {
            const mockSubscription = {
                id: 'sub_test_audit_fail',
                customer: 'cus_test_user',
                status: 'active',
                items: {
                    data: [{
                        price: {
                            lookup_key: 'pro_monthly'
                        }
                    }]
                }
            };

            // Mock successful database operations
            mockSupabase.single.mockResolvedValueOnce({
                data: { user_id: 'user123', plan: 'free' },
                error: null
            });

            mockSupabase.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });

            // Mock audit service failure
            auditService.logSubscriptionChange.mockRejectedValue(new Error('Audit service down'));
            auditService.logPlanChange.mockRejectedValue(new Error('Audit service down'));

            const result = await subscriptionService.processSubscriptionUpdate(mockSubscription);

            // Should still succeed despite audit logging failures
            expect(result.success).toBe(true);
        });
    });

    describe('Status Change Handling', () => {
        it('should handle subscription status changes correctly', async () => {
            const mockSubscription = {
                id: 'sub_test_status',
                customer: 'cus_test_user',
                status: 'past_due',
                items: {
                    data: [{
                        price: {
                            lookup_key: 'pro_monthly'
                        }
                    }]
                }
            };

            mockSupabase.single.mockResolvedValueOnce({
                data: { user_id: 'user123', plan: 'pro' },
                error: null
            });

            mockSupabase.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });

            const result = await subscriptionService.processSubscriptionUpdate(mockSubscription);

            expect(result.success).toBe(true);
            expect(result.status).toBe('past_due');

            // Should create status notification for non-active statuses
            expect(notificationService.createSubscriptionStatusNotification).toHaveBeenCalledWith(
                'user123',
                expect.objectContaining({
                    status: 'past_due'
                })
            );
        });
    });
});

describe('Audit Service Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        const { supabaseServiceClient } = require('../../src/config/supabase');
        const mockSupabase = {
            from: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis()
        };
        Object.assign(supabaseServiceClient, mockSupabase);
    });

    it('should log subscription changes with complete audit trail', async () => {
        const { supabaseServiceClient } = require('../../src/config/supabase');
        
        supabaseServiceClient.single.mockResolvedValue({
            data: { 
                id: 'audit123',
                user_id: 'user123',
                event_type: 'plan_change',
                old_plan: 'free',
                new_plan: 'pro'
            },
            error: null
        });

        const result = await auditService.logSubscriptionChange({
            userId: 'user123',
            eventType: 'plan_change',
            oldPlan: 'free',
            newPlan: 'pro',
            customerId: 'cus_test',
            subscriptionId: 'sub_test'
        });

        expect(supabaseServiceClient.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'user123',
                event_type: 'plan_change',
                old_plan: 'free',
                new_plan: 'pro'
            })
        );
    });

    it('should retrieve audit history correctly', async () => {
        const { supabaseServiceClient } = require('../../src/config/supabase');
        
        const mockHistory = [
            {
                id: 'audit1',
                event_type: 'plan_change',
                old_plan: 'free',
                new_plan: 'pro',
                created_at: new Date().toISOString()
            }
        ];

        supabaseServiceClient.range.mockResolvedValue({
            data: mockHistory,
            error: null
        });

        const result = await auditService.getSubscriptionHistory('user123', {
            limit: 10,
            eventType: 'plan_change'
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockHistory);
        expect(supabaseServiceClient.eq).toHaveBeenCalledWith('user_id', 'user123');
        expect(supabaseServiceClient.eq).toHaveBeenCalledWith('event_type', 'plan_change');
    });
});