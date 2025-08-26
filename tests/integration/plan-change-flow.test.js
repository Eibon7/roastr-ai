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

// Mock Stripe with proper constructor function
const mockStripeInstance = {
    customers: {
        create: jest.fn(),
        retrieve: jest.fn()
    },
    prices: {
        list: jest.fn()
    },
    checkout: {
        sessions: {
            create: jest.fn()
        }
    },
    billingPortal: {
        sessions: {
            create: jest.fn()
        }
    },
    subscriptions: {
        retrieve: jest.fn()
    },
    webhooks: {
        constructEvent: jest.fn()
    }
};

jest.mock('stripe', () => {
    return jest.fn(() => mockStripeInstance);
});

const subscriptionService = require('../../src/services/subscriptionService');
const planValidation = require('../../src/services/planValidation');
const auditService = require('../../src/services/auditService');
const emailService = require('../../src/services/emailService');
const notificationService = require('../../src/services/notificationService');

describe('Plan Change Flow Integration', () => {
    let mockSupabase;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup comprehensive mock Supabase with proper chaining
        const { supabaseServiceClient } = require('../../src/config/supabase');
        
        // Create a chainable mock that returns proper structures
        const createChainableMock = () => ({
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            update: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis()
        });
        
        mockSupabase = createChainableMock();
        Object.assign(supabaseServiceClient, mockSupabase);

        // Mock audit service
        auditService.logSubscriptionChange = jest.fn().mockResolvedValue({ success: true });
        auditService.logPlanChange = jest.fn().mockResolvedValue({ success: true });
        auditService.getSubscriptionHistory = jest.fn().mockResolvedValue({ 
            success: true, 
            data: []
        });
        
        // Mock email service
        emailService.sendPlanChangeNotification = jest.fn().mockResolvedValue({ success: true });
        
        // Mock notification service
        notificationService.createPlanChangeNotification = jest.fn().mockResolvedValue({ success: true });
        notificationService.createPlanChangeBlockedNotification = jest.fn().mockResolvedValue({ success: true });
        notificationService.createSubscriptionStatusNotification = jest.fn().mockResolvedValue({ success: true });
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

            // Configure complete mock chain for subscription processing
            const { supabaseServiceClient } = require('../../src/config/supabase');
            
            // Mock method chain calls in sequence
            let callCount = 0;
            const mockSingle = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({ data: { user_id: 'user123', plan: 'free' }, error: null });
                } else if (callCount === 2) {
                    return Promise.resolve({ count: 50, error: null });
                } else if (callCount === 3) {
                    return Promise.resolve({ count: 200, error: null });
                }
                return Promise.resolve({ data: null, error: null });
            });
            
            const mockEq = jest.fn((field, value) => {
                if (field === 'is_active') {
                    return Promise.resolve({ data: [{ platform: 'twitter' }], error: null });
                }
                return { single: mockSingle };
            });
            
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            
            supabaseServiceClient.from = jest.fn().mockReturnValue({ select: mockSelect });
            supabaseServiceClient.select = mockSelect;
            supabaseServiceClient.eq = mockEq;
            supabaseServiceClient.single = mockSingle;
            
            // Mock update operations - this needs to return the destructured { error }
            supabaseServiceClient.update = jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });
            
            // Also mock the update chain for updateUserSubscription
            supabaseServiceClient.from = jest.fn((table) => {
                if (table === 'user_subscriptions') {
                    return {
                        update: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ error: null })
                        })
                    };
                }
                return { select: mockSelect };
            });
            
            // Mock organization query
            supabaseServiceClient.maybeSingle = jest.fn().mockResolvedValue({
                data: { id: 'org123', name: 'Test Org' },
                error: null
            });

            // Mock Stripe setup
            const stripe = require('stripe')();
            stripe.prices.list.mockResolvedValue({
                data: [{
                    id: 'price_pro',
                    lookup_key: 'pro_monthly'
                }]
            });

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
                            lookup_key: 'plus_monthly'
                        }
                    }]
                }
            };

            // Configure complete mock chain for pro to plus upgrade
            const { supabaseServiceClient } = require('../../src/config/supabase');
            
            let callCount = 0;
            const mockSingle = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({ data: { user_id: 'user123', plan: 'pro' }, error: null });
                } else if (callCount === 2) {
                    return Promise.resolve({ count: 500, error: null });
                } else if (callCount === 3) {
                    return Promise.resolve({ count: 2000, error: null });
                }
                return Promise.resolve({ data: null, error: null });
            });
            
            const mockEq = jest.fn((field, value) => {
                if (field === 'is_active') {
                    return Promise.resolve({ 
                        data: [{ platform: 'twitter' }, { platform: 'youtube' }, { platform: 'instagram' }], 
                        error: null 
                    });
                }
                return { single: mockSingle };
            });
            
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            
            supabaseServiceClient.from = jest.fn().mockReturnValue({ select: mockSelect });
            supabaseServiceClient.select = mockSelect;
            supabaseServiceClient.eq = mockEq;
            supabaseServiceClient.single = mockSingle;
            
            supabaseServiceClient.update = jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });
            
            // Mock update chain for updateUserSubscription
            supabaseServiceClient.from = jest.fn((table) => {
                if (table === 'user_subscriptions') {
                    return {
                        update: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ error: null })
                        })
                    };
                }
                return { select: mockSelect };
            });
            
            supabaseServiceClient.maybeSingle = jest.fn().mockResolvedValue({
                data: { id: 'org123', name: 'Test Org' },
                error: null
            });

            const result = await subscriptionService.processSubscriptionUpdate(mockSubscription);

            expect(result.success).toBe(true);
            expect(result.oldPlan).toBe('pro');
            expect(result.newPlan).toBe('plus');
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

            // Reset and configure mock responses for downgrade test
            jest.clearAllMocks();
            const { supabaseServiceClient } = require('../../src/config/supabase');
            
            // Mock the user lookup chain: from().select().eq().single()
            const mockSingle = jest.fn()
                .mockResolvedValueOnce({
                    data: { user_id: 'user123', plan: 'pro' },
                    error: null
                })
                .mockResolvedValueOnce({ count: 150, error: null }) // roasts count
                .mockResolvedValueOnce({ count: 400, error: null }); // comments count
            
            const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });
            
            // Mock integrations query: from().select().eq().eq()
            const mockIntegrationsEq2 = jest.fn().mockResolvedValue({
                data: [{ platform: 'twitter' }],
                error: null
            });
            const mockIntegrationsEq1 = jest.fn().mockReturnValue({ eq: mockIntegrationsEq2 });
            const mockIntegrationsSelect = jest.fn().mockReturnValue({ eq: mockIntegrationsEq1 });
            
            // Configure supabaseServiceClient.from to return different chains based on table
            supabaseServiceClient.from = jest.fn((table) => {
                if (table === 'user_integrations') {
                    return { select: mockIntegrationsSelect };
                }
                return { select: mockSelect };
            });
            
            // Mock update chain
            const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
            const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });
            supabaseServiceClient.update = mockUpdate;
            
            // Mock maybeSingle for organization query
            supabaseServiceClient.maybeSingle = jest.fn().mockResolvedValue({
                data: { id: 'org123', name: 'Test Org' },
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

            // Reset and configure mock for integrations test
            jest.clearAllMocks();
            const { supabaseServiceClient } = require('../../src/config/supabase');
            
            // Mock user lookup chain for plus plan
            const mockSingle = jest.fn()
                .mockResolvedValueOnce({
                    data: { user_id: 'user123', plan: 'plus' },
                    error: null
                })
                .mockResolvedValueOnce({ count: 500, error: null }) // roasts count
                .mockResolvedValueOnce({ count: 2000, error: null }); // comments count
            
            const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });
            
            // Mock integrations query with 7 integrations (exceeds pro limit of 2)
            const mockIntegrationsEq2 = jest.fn().mockResolvedValue({
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
            const mockIntegrationsEq1 = jest.fn().mockReturnValue({ eq: mockIntegrationsEq2 });
            const mockIntegrationsSelect = jest.fn().mockReturnValue({ eq: mockIntegrationsEq1 });
            
            // Configure supabaseServiceClient.from to return different chains
            supabaseServiceClient.from = jest.fn((table) => {
                if (table === 'user_integrations') {
                    return { select: mockIntegrationsSelect };
                }
                return { select: mockSelect };
            });
            
            // Mock update chain
            const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
            supabaseServiceClient.update = jest.fn().mockReturnValue({ eq: mockUpdateEq });
            
            // Mock maybeSingle for organization query
            supabaseServiceClient.maybeSingle = jest.fn().mockResolvedValue({
                data: { id: 'org123', name: 'Test Org' },
                error: null
            });

            const result = await subscriptionService.processSubscriptionUpdate(mockSubscription);

            expect(result.success).toBe(false);
            expect(result.reason).toContain('Active integrations (7) exceeds new plan limit (5)');
        });
    });

    describe('Plan Validation Integration', () => {
        it('should validate downgrade with warnings about lost features', async () => {
            const result = await planValidation.isChangeAllowed('plus', 'pro', {
                roastsThisMonth: 500,
                commentsThisMonth: 2000,
                activeIntegrations: 2
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

            // The service throws on database errors, so we expect it to throw
            await expect(subscriptionService.processSubscriptionUpdate(mockSubscription))
                .rejects
                .toThrow('Database connection failed');
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
        const mockAuditSupabase = {
            from: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis()
        };
        Object.assign(supabaseServiceClient, mockAuditSupabase);
    });

    it('should log subscription changes with complete audit trail', async () => {
        const { supabaseServiceClient } = require('../../src/config/supabase');
        
        // Mock the insert chain to return success
        supabaseServiceClient.insert.mockReturnValue({
            select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                    data: { 
                        id: 'audit123',
                        user_id: 'user123',
                        event_type: 'plan_change',
                        old_plan: 'free',
                        new_plan: 'pro'
                    },
                    error: null
                })
            })
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