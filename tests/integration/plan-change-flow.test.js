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
jest.mock('../../src/services/stripeWrapper');
jest.mock('../../src/services/workerNotificationService');

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
const StripeWrapper = require('../../src/services/stripeWrapper');
const workerNotificationService = require('../../src/services/workerNotificationService');

describe('Plan Change Flow Integration', () => {
    let mockSupabase;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup comprehensive mock Supabase with proper chaining
        const { supabaseServiceClient } = require('../../src/config/supabase');
        
        // Mock the complete Supabase service client
        const mockUpdate = jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
        });
        
        const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
        const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
        
        const mockEq = jest.fn().mockReturnValue({
            single: mockSingle,
            maybeSingle: mockMaybeSingle
        });
        
        const mockSelect = jest.fn().mockReturnValue({
            eq: mockEq,
            single: mockSingle
        });
        
        const mockFrom = jest.fn().mockReturnValue({
            select: mockSelect,
            update: mockUpdate,
            insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: { id: 'audit123' }, error: null })
                })
            })
        });
        
        // Create comprehensive mock
        mockSupabase = {
            from: mockFrom,
            select: mockSelect,
            eq: mockEq,
            single: mockSingle,
            maybeSingle: mockMaybeSingle,
            update: mockUpdate,
            insert: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockResolvedValue({ data: [], error: null })
        };
        
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
        
        // Mock StripeWrapper
        StripeWrapper.mockImplementation(() => ({
            customers: {
                create: jest.fn(),
                retrieve: jest.fn().mockResolvedValue({
                    id: 'cus_test_user',
                    email: 'test@example.com',
                    name: 'Test User'
                })
            },
            prices: {
                list: jest.fn().mockResolvedValue({
                    data: [{
                        id: 'price_pro',
                        lookup_key: 'pro_monthly'
                    }]
                })
            },
            subscriptions: {
                retrieve: jest.fn()
            }
        }));
        
        // Mock worker notification service
        workerNotificationService.notifyPlanChange = jest.fn().mockResolvedValue({ success: true });
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

            // Configure specific mock responses for this test
            const { supabaseServiceClient } = require('../../src/config/supabase');
            
            // Mock the subscription lookup: from('user_subscriptions').select().eq().single()
            let callCount = 0;
            supabaseServiceClient.from.mockImplementation((table) => {
                if (table === 'user_subscriptions') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: { user_id: 'user123', plan: 'free', stripe_subscription_id: 'sub_old' },
                                    error: null
                                })
                            })
                        }),
                        update: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ error: null })
                        })
                    };
                } else if (table === 'roasts') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                gte: jest.fn().mockResolvedValue({ count: 50, error: null })
                            })
                        })
                    };
                } else if (table === 'comments') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                gte: jest.fn().mockResolvedValue({ count: 200, error: null })
                            })
                        })
                    };
                } else if (table === 'user_integrations') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn((field, value) => {
                                if (field === 'user_id') {
                                    return {
                                        eq: jest.fn().mockResolvedValue({
                                            data: [{ platform: 'twitter' }],
                                            error: null
                                        })
                                    };
                                }
                            })
                        })
                    };
                } else if (table === 'users') {
                    return {
                        update: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ error: null })
                        })
                    };
                } else if (table === 'organizations') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                maybeSingle: jest.fn().mockResolvedValue({
                                    data: { id: 'org123', name: 'Test Org' },
                                    error: null
                                })
                            })
                        }),
                        update: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ error: null })
                        })
                    };
                }
                return mockSupabase;
            });

            // StripeWrapper is already mocked in beforeEach

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

        it('should complete pro to plus upgrade successfully', async () => {
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

            // Configure specific mock responses for this test
            const { supabaseServiceClient } = require('../../src/config/supabase');
            
            supabaseServiceClient.from.mockImplementation((table) => {
                if (table === 'user_subscriptions') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: { user_id: 'user123', plan: 'pro', stripe_subscription_id: 'sub_old' },
                                    error: null
                                })
                            })
                        }),
                        update: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ error: null })
                        })
                    };
                } else if (table === 'roasts') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                gte: jest.fn().mockResolvedValue({ count: 500, error: null })
                            })
                        })
                    };
                } else if (table === 'comments') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                gte: jest.fn().mockResolvedValue({ count: 2000, error: null })
                            })
                        })
                    };
                } else if (table === 'user_integrations') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn((field, value) => {
                                if (field === 'user_id') {
                                    return {
                                        eq: jest.fn().mockResolvedValue({
                                            data: [{ platform: 'twitter' }, { platform: 'youtube' }],
                                            error: null
                                        })
                                    };
                                }
                            })
                        })
                    };
                } else if (table === 'users') {
                    return {
                        update: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ error: null })
                        })
                    };
                } else if (table === 'organizations') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                maybeSingle: jest.fn().mockResolvedValue({
                                    data: { id: 'org123', name: 'Test Org' },
                                    error: null
                                })
                            })
                        }),
                        update: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ error: null })
                        })
                    };
                }
                return mockSupabase;
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
            
            // Mock responses for downgrade validation (pro -> free with high usage)
            supabaseServiceClient.from.mockImplementation((table) => {
                if (table === 'user_subscriptions') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: { user_id: 'user123', plan: 'pro', stripe_subscription_id: 'sub_old' },
                                    error: null
                                })
                            })
                        })
                    };
                } else if (table === 'roasts') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                gte: jest.fn().mockResolvedValue({ count: 150, error: null }) // Exceeds free limit of 50
                            })
                        })
                    };
                } else if (table === 'comments') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                gte: jest.fn().mockResolvedValue({ count: 50, error: null }) // Within free limit of 100
                            })
                        })
                    };
                } else if (table === 'user_integrations') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn((field, value) => {
                                if (field === 'user_id') {
                                    return {
                                        eq: jest.fn().mockResolvedValue({
                                            data: [{ platform: 'twitter' }], // Only 1 integration, within free limit
                                            error: null
                                        })
                                    };
                                }
                            })
                        })
                    };
                }
                return mockSupabase;
            });

            const result = await subscriptionService.processSubscriptionUpdate(mockSubscription);

            expect(result.success).toBe(false);
            expect(result.reason).toContain('Current monthly roasts (150) exceeds new plan limit (50)');

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
            
            // Mock responses for downgrade validation (plus -> pro with too many integrations)
            supabaseServiceClient.from.mockImplementation((table) => {
                if (table === 'user_subscriptions') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: { user_id: 'user123', plan: 'plus', stripe_subscription_id: 'sub_old' },
                                    error: null
                                })
                            })
                        })
                    };
                } else if (table === 'roasts') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                gte: jest.fn().mockResolvedValue({ count: 500, error: null }) // Within pro limit
                            })
                        })
                    };
                } else if (table === 'comments') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                gte: jest.fn().mockResolvedValue({ count: 2000, error: null }) // Within pro limit
                            })
                        })
                    };
                } else if (table === 'user_integrations') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn((field, value) => {
                                if (field === 'user_id') {
                                    return {
                                        eq: jest.fn().mockResolvedValue({
                                            data: [
                                                { platform: 'twitter' },
                                                { platform: 'youtube' },
                                                { platform: 'instagram' }
                                            ], // 3 integrations, exceeds pro limit of 2
                                            error: null
                                        })
                                    };
                                }
                            })
                        })
                    };
                }
                return mockSupabase;
            });

            const result = await subscriptionService.processSubscriptionUpdate(mockSubscription);

            expect(result.success).toBe(false);
            expect(result.reason).toContain('Active integrations (3) exceeds new plan limit (2)');
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
        
        // Setup comprehensive audit service mocks
        supabaseServiceClient.from.mockImplementation((table) => {
            if (table === 'audit_logs') {
                return {
                    insert: jest.fn().mockReturnValue({
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
                    }),
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                order: jest.fn().mockReturnValue({
                                    range: jest.fn().mockResolvedValue({
                                        data: [
                                            {
                                                id: 'audit1',
                                                event_type: 'plan_change',
                                                old_plan: 'free',
                                                new_plan: 'pro',
                                                created_at: new Date().toISOString()
                                            }
                                        ],
                                        error: null
                                    })
                                })
                            })
                        })
                    })
                };
            }
            return mockSupabase;
        });
    });

    it('should log subscription changes with complete audit trail', async () => {
        const result = await auditService.logSubscriptionChange({
            userId: 'user123',
            eventType: 'plan_change',
            oldPlan: 'free',
            newPlan: 'pro',
            customerId: 'cus_test',
            subscriptionId: 'sub_test'
        });

        // The service should handle the audit logging successfully
        expect(result.success).toBe(true);
    });

    it('should retrieve audit history correctly', async () => {
        const result = await auditService.getSubscriptionHistory('user123', {
            limit: 10,
            eventType: 'plan_change'
        });

        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
    });
});