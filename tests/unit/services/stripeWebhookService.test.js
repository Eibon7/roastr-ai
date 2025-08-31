/**
 * Unit tests for StripeWebhookService - Issue #169
 * Tests webhook processing with real Stripe payload examples
 */

const StripeWebhookService = require('../../../src/services/stripeWebhookService');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const EntitlementsService = require('../../../src/services/entitlementsService');
const StripeWrapper = require('../../../src/services/stripeWrapper');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        update: jest.fn(),
        rpc: jest.fn()
    }
}));

jest.mock('../../../src/services/entitlementsService');
jest.mock('../../../src/services/stripeWrapper');
jest.mock('../../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn().mockReturnValue(true)
    }
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('StripeWebhookService', () => {
    let webhookService;
    let mockEntitlementsService;
    let mockStripeWrapper;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock EntitlementsService
        mockEntitlementsService = {
            setEntitlementsFromStripePrice: jest.fn(),
            setEntitlements: jest.fn()
        };
        EntitlementsService.mockImplementation(() => mockEntitlementsService);
        
        // Mock StripeWrapper
        mockStripeWrapper = {
            subscriptions: {
                retrieve: jest.fn()
            }
        };
        StripeWrapper.mockImplementation(() => mockStripeWrapper);
        
        webhookService = new StripeWebhookService();
    });

    describe('processWebhookEvent', () => {
        const baseEvent = {
            id: 'evt_test_webhook',
            type: 'checkout.session.completed',
            created: 1677649600,
            data: {
                object: {}
            }
        };

        it('should handle idempotent events correctly', async () => {
            // Mock event as already processed
            supabaseServiceClient.rpc.mockResolvedValueOnce({
                data: true, // Already processed
                error: null
            });

            const result = await webhookService.processWebhookEvent(baseEvent);

            expect(result.success).toBe(true);
            expect(result.idempotent).toBe(true);
            expect(result.message).toBe('Event already processed');
            expect(supabaseServiceClient.rpc).toHaveBeenCalledWith('is_webhook_event_processed', {
                event_id: 'evt_test_webhook'
            });
        });

        it('should process new events correctly', async () => {
            // Mock event as not processed
            supabaseServiceClient.rpc
                .mockResolvedValueOnce({ data: false, error: null }) // is_webhook_event_processed
                .mockResolvedValueOnce({ data: 'webhook-uuid', error: null }) // start_webhook_event_processing
                .mockResolvedValueOnce({ data: true, error: null }); // complete_webhook_event_processing

            // Mock checkout session event
            const checkoutEvent = {
                ...baseEvent,
                data: {
                    object: {
                        id: 'cs_test_session',
                        customer: 'cus_test123',
                        subscription: 'sub_test123',
                        metadata: {
                            user_id: 'user-123'
                        }
                    }
                }
            };

            // Mock subscription with price
            mockStripeWrapper.subscriptions.retrieve.mockResolvedValue({
                items: {
                    data: [{
                        price: {
                            id: 'price_test_pro'
                        }
                    }]
                }
            });

            // Mock user update
            supabaseServiceClient.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });

            // Mock entitlements update
            mockEntitlementsService.setEntitlementsFromStripePrice.mockResolvedValue({
                success: true,
                entitlements: { plan_name: 'pro' }
            });

            const result = await webhookService.processWebhookEvent(checkoutEvent);

            expect(result.success).toBe(true);
            expect(result.idempotent).toBe(false);
            expect(result.message).toBe('Checkout completed and entitlements updated');
        });

        it('should handle processing failures gracefully', async () => {
            supabaseServiceClient.rpc
                .mockResolvedValueOnce({ data: false, error: null }) // is_webhook_event_processed
                .mockResolvedValueOnce({ data: 'webhook-uuid', error: null }) // start_webhook_event_processing
                .mockResolvedValueOnce({ data: true, error: null }); // complete_webhook_event_processing

            const checkoutEvent = {
                ...baseEvent,
                data: {
                    object: {
                        id: 'cs_test_session',
                        customer: 'cus_test123',
                        subscription: 'sub_test123',
                        metadata: {} // Missing user_id
                    }
                }
            };

            const result = await webhookService.processWebhookEvent(checkoutEvent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('No user_id in checkout session metadata');
        });

        it('should handle malformed event data gracefully (CodeRabbit fix)', async () => {
            // Test case for the CodeRabbit fix: event.data.object?.mode validation
            const malformedEvents = [
                // Case 1: event.data.object is null
                {
                    ...baseEvent,
                    data: {
                        object: null
                    }
                },
                // Case 2: event.data.object.mode is undefined
                {
                    ...baseEvent,
                    data: {
                        object: {
                            id: 'cs_test_session',
                            // mode is missing
                            metadata: { addon_key: 'test_addon' }
                        }
                    }
                },
                // Case 3: event.data.object exists but mode is null
                {
                    ...baseEvent,
                    data: {
                        object: {
                            id: 'cs_test_session',
                            mode: null,
                            metadata: { addon_key: 'test_addon' }
                        }
                    }
                }
            ];

            // Mock successful processing for all cases
            supabaseServiceClient.rpc
                .mockResolvedValue({ data: false, error: null }) // Not processed
                .mockResolvedValue({ data: 'webhook-uuid', error: null }) // Start processing
                .mockResolvedValue({ data: true, error: null }); // Complete processing

            for (const malformedEvent of malformedEvents) {
                const result = await webhookService.processWebhookEvent(malformedEvent);

                // Should not throw runtime error and should process as regular checkout
                expect(result.success).toBe(true);
                expect(result.error).toBeUndefined();
            }
        });

        it('should correctly identify addon purchases with proper validation', async () => {
            // Test that addon purchases are correctly identified when all properties exist
            const addonPurchaseEvent = {
                ...baseEvent,
                data: {
                    object: {
                        id: 'cs_test_session',
                        mode: 'payment',
                        customer: 'cus_test123',
                        metadata: {
                            addon_key: 'test_addon',
                            user_id: 'user-123'
                        }
                    }
                }
            };

            // Mock the addon purchase handler
            webhookService._handleAddonPurchaseCompleted = jest.fn().mockResolvedValue({
                success: true,
                addonKey: 'test_addon'
            });

            // Mock successful processing
            supabaseServiceClient.rpc
                .mockResolvedValueOnce({ data: false, error: null }) // Not processed
                .mockResolvedValueOnce({ data: 'webhook-uuid', error: null }) // Start processing
                .mockResolvedValueOnce({ data: true, error: null }); // Complete processing

            const result = await webhookService.processWebhookEvent(addonPurchaseEvent);

            expect(result.success).toBe(true);
            expect(webhookService._handleAddonPurchaseCompleted).toHaveBeenCalledWith(
                addonPurchaseEvent.data.object
            );
        });
    });

    describe('_handleCheckoutCompleted', () => {
        const checkoutSession = {
            id: 'cs_test_session',
            customer: 'cus_test123',
            subscription: 'sub_test123',
            metadata: {
                user_id: 'user-123'
            }
        };

        it('should handle checkout completion successfully', async () => {
            // Mock user update
            supabaseServiceClient.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });

            // Mock subscription retrieval
            mockStripeWrapper.subscriptions.retrieve.mockResolvedValue({
                items: {
                    data: [{
                        price: {
                            id: 'price_pro_monthly'
                        }
                    }]
                }
            });

            // Mock entitlements update
            mockEntitlementsService.setEntitlementsFromStripePrice.mockResolvedValue({
                success: true,
                entitlements: { plan_name: 'pro' }
            });

            const result = await webhookService._handleCheckoutCompleted(checkoutSession);

            expect(result.success).toBe(true);
            expect(result.accountId).toBe('user-123');
            expect(result.entitlementsUpdated).toBe(true);
            expect(result.planName).toBe('pro');
        });

        it('should fail when user_id is missing', async () => {
            const invalidSession = {
                ...checkoutSession,
                metadata: {} // No user_id
            };

            await expect(webhookService._handleCheckoutCompleted(invalidSession))
                .rejects.toThrow('No user_id in checkout session metadata');
        });

        it('should fail when subscription has no price', async () => {
            supabaseServiceClient.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });

            // Mock subscription without price
            mockStripeWrapper.subscriptions.retrieve.mockResolvedValue({
                items: { data: [] }
            });

            await expect(webhookService._handleCheckoutCompleted(checkoutSession))
                .rejects.toThrow('No price ID found in subscription');
        });
    });

    describe('_handleSubscriptionUpdated', () => {
        const subscription = {
            id: 'sub_test123',
            customer: 'cus_test123',
            status: 'active',
            items: {
                data: [{
                    price: {
                        id: 'price_pro_monthly'
                    }
                }]
            }
        };

        it('should handle subscription update successfully', async () => {
            // Mock user lookup by customer ID
            supabaseServiceClient.single.mockResolvedValue({
                data: { id: 'user-123' },
                error: null
            });

            // Mock entitlements update
            mockEntitlementsService.setEntitlementsFromStripePrice.mockResolvedValue({
                success: true,
                entitlements: { plan_name: 'pro' }
            });

            const result = await webhookService._handleSubscriptionUpdated(subscription);

            expect(result.success).toBe(true);
            expect(result.accountId).toBe('user-123');
            expect(result.entitlementsUpdated).toBe(true);
            expect(result.subscriptionStatus).toBe('active');
        });

        it('should handle subscription without price (canceled)', async () => {
            supabaseServiceClient.single.mockResolvedValue({
                data: { id: 'user-123' },
                error: null
            });

            const canceledSubscription = {
                ...subscription,
                status: 'canceled',
                items: { data: [] } // No price
            };

            // Mock reset to free plan
            mockEntitlementsService.setEntitlements.mockResolvedValue({
                success: true
            });

            const result = await webhookService._handleSubscriptionUpdated(canceledSubscription);

            expect(result.success).toBe(true);
            expect(result.accountId).toBe('user-123');
        });

        it('should fail when customer not found', async () => {
            supabaseServiceClient.single.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' } // No rows found
            });

            await expect(webhookService._handleSubscriptionUpdated(subscription))
                .rejects.toThrow('No user found for customer ID: cus_test123');
        });
    });

    describe('_handleSubscriptionDeleted', () => {
        const subscription = {
            id: 'sub_test123',
            customer: 'cus_test123'
        };

        it('should handle subscription deletion successfully', async () => {
            // Mock user lookup
            supabaseServiceClient.single.mockResolvedValue({
                data: { id: 'user-123' },
                error: null
            });

            // Mock reset to free plan
            mockEntitlementsService.setEntitlements.mockResolvedValue({
                success: true
            });

            const result = await webhookService._handleSubscriptionDeleted(subscription);

            expect(result.success).toBe(true);
            expect(result.accountId).toBe('user-123');
            expect(result.planName).toBe('free');
            expect(mockEntitlementsService.setEntitlements).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({
                    plan_name: 'free',
                    analysis_limit_monthly: 100,
                    roast_limit_monthly: 100
                })
            );
        });
    });

    describe('_handlePaymentSucceeded', () => {
        const invoice = {
            id: 'in_test123',
            customer: 'cus_test123',
            amount_paid: 2000
        };

        it('should handle payment success for known customer', async () => {
            supabaseServiceClient.single.mockResolvedValue({
                data: { id: 'user-123' },
                error: null
            });

            const result = await webhookService._handlePaymentSucceeded(invoice);

            expect(result.success).toBe(true);
            expect(result.accountId).toBe('user-123');
            expect(result.amount).toBe(2000);
        });

        it('should handle payment success for unknown customer gracefully', async () => {
            supabaseServiceClient.single.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
            });

            const result = await webhookService._handlePaymentSucceeded(invoice);

            expect(result.success).toBe(true);
            expect(result.message).toBe('Payment succeeded for unknown customer');
        });
    });

    describe('_handlePaymentFailed', () => {
        const invoice = {
            id: 'in_test123',
            customer: 'cus_test123',
            amount_due: 2000,
            attempt_count: 1
        };

        it('should handle payment failure for known customer', async () => {
            supabaseServiceClient.single.mockResolvedValue({
                data: { id: 'user-123' },
                error: null
            });

            const result = await webhookService._handlePaymentFailed(invoice);

            expect(result.success).toBe(true);
            expect(result.accountId).toBe('user-123');
            expect(result.amount).toBe(2000);
            expect(result.attemptCount).toBe(1);
        });
    });

    describe('Customer and Subscription ID extraction', () => {
        it('should extract customer ID from various event types', () => {
            const checkoutEvent = {
                data: { object: { customer: 'cus_test123' } }
            };
            
            const customerID = webhookService._extractCustomerID(checkoutEvent);
            expect(customerID).toBe('cus_test123');
        });

        it('should extract subscription ID from various event types', () => {
            const subscriptionEvent = {
                data: { object: { id: 'sub_test123' } }
            };
            
            const subscriptionID = webhookService._extractSubscriptionID(subscriptionEvent);
            expect(subscriptionID).toBe('sub_test123');
        });
    });

    describe('Statistics and cleanup', () => {
        it('should get webhook statistics', async () => {
            const mockStats = [
                {
                    event_type: 'checkout.session.completed',
                    total_events: 100,
                    completed_events: 95,
                    failed_events: 5,
                    success_rate: 95.0
                }
            ];

            supabaseServiceClient.rpc.mockResolvedValue({
                data: mockStats,
                error: null
            });

            const result = await webhookService.getWebhookStats(7);

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockStats);
            expect(supabaseServiceClient.rpc).toHaveBeenCalledWith(
                'get_webhook_stats',
                expect.objectContaining({
                    since_date: expect.any(String)
                })
            );
        });

        it('should cleanup old webhook events', async () => {
            supabaseServiceClient.rpc.mockResolvedValue({
                data: 50, // Number of events deleted
                error: null
            });

            const result = await webhookService.cleanupOldEvents(30);

            expect(result.success).toBe(true);
            expect(result.eventsDeleted).toBe(50);
            expect(supabaseServiceClient.rpc).toHaveBeenCalledWith(
                'cleanup_webhook_events',
                { older_than_days: 30 }
            );
        });
    });
});

describe('Integration with real Stripe payloads', () => {
    let webhookService;
    let mockEntitlementsService;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockEntitlementsService = {
            setEntitlementsFromStripePrice: jest.fn(),
            setEntitlements: jest.fn()
        };
        EntitlementsService.mockImplementation(() => mockEntitlementsService);
        
        webhookService = new StripeWebhookService();
    });

    const realStripePayloads = {
        checkoutCompleted: {
            "id": "evt_1MqQoHLkdIwHu7ixgeX2nWJK",
            "object": "event",
            "api_version": "2022-11-15",
            "created": 1677649600,
            "data": {
                "object": {
                    "id": "cs_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
                    "object": "checkout.session",
                    "customer": "cus_NffrFeUfNV2Hib",
                    "subscription": "sub_1MqQoHLkdIwHu7ixX2nWJKo",
                    "mode": "subscription",
                    "payment_status": "paid",
                    "metadata": {
                        "user_id": "auth0|507f1f77bcf86cd799439011"
                    }
                }
            },
            "type": "checkout.session.completed"
        },

        subscriptionUpdated: {
            "id": "evt_1MqQpLLkdIwHu7ixMfQ3gGpK",
            "object": "event",
            "api_version": "2022-11-15",
            "created": 1677649700,
            "data": {
                "object": {
                    "id": "sub_1MqQoHLkdIwHu7ixX2nWJKo",
                    "object": "subscription",
                    "customer": "cus_NffrFeUfNV2Hib",
                    "status": "active",
                    "items": {
                        "data": [
                            {
                                "price": {
                                    "id": "price_1MqN7BLkdIwHu7ixeub2pF1j"
                                }
                            }
                        ]
                    }
                }
            },
            "type": "customer.subscription.updated"
        },

        subscriptionDeleted: {
            "id": "evt_1MqQrLLkdIwHu7ixPgT4hHpK",
            "object": "event",
            "api_version": "2022-11-15",
            "created": 1677649800,
            "data": {
                "object": {
                    "id": "sub_1MqQoHLkdIwHu7ixX2nWJKo",
                    "object": "subscription",
                    "customer": "cus_NffrFeUfNV2Hib",
                    "status": "canceled"
                }
            },
            "type": "customer.subscription.deleted"
        },

        invoicePaymentSucceeded: {
            "id": "evt_1MqQsLLkdIwHu7ixQhU5iIpK",
            "object": "event",
            "api_version": "2022-11-15",
            "created": 1677649900,
            "data": {
                "object": {
                    "id": "in_1MqQsLLkdIwHu7ixQhU5iIpK",
                    "object": "invoice",
                    "customer": "cus_NffrFeUfNV2Hib",
                    "amount_paid": 2000,
                    "currency": "eur"
                }
            },
            "type": "invoice.payment_succeeded"
        }
    };

    it('should process real checkout.session.completed payload', async () => {
        // Setup mocks for successful processing
        supabaseServiceClient.rpc
            .mockResolvedValueOnce({ data: false, error: null }) // Not processed
            .mockResolvedValueOnce({ data: 'webhook-uuid', error: null }) // Start processing
            .mockResolvedValueOnce({ data: true, error: null }); // Complete processing

        supabaseServiceClient.update.mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
        });

        const mockStripeWrapper = {
            subscriptions: {
                retrieve: jest.fn().mockResolvedValue({
                    items: {
                        data: [{
                            price: { id: 'price_1MqN7BLkdIwHu7ixeub2pF1j' }
                        }]
                    }
                })
            }
        };
        StripeWrapper.mockImplementation(() => mockStripeWrapper);

        mockEntitlementsService.setEntitlementsFromStripePrice.mockResolvedValue({
            success: true,
            entitlements: { plan_name: 'pro' }
        });

        const result = await webhookService.processWebhookEvent(realStripePayloads.checkoutCompleted);

        expect(result.success).toBe(true);
        expect(result.message).toBe('Checkout completed and entitlements updated');
    });

    it('should process real subscription.updated payload', async () => {
        supabaseServiceClient.rpc
            .mockResolvedValueOnce({ data: false, error: null })
            .mockResolvedValueOnce({ data: 'webhook-uuid', error: null })
            .mockResolvedValueOnce({ data: true, error: null });

        supabaseServiceClient.single.mockResolvedValue({
            data: { id: 'auth0|507f1f77bcf86cd799439011' },
            error: null
        });

        mockEntitlementsService.setEntitlementsFromStripePrice.mockResolvedValue({
            success: true,
            entitlements: { plan_name: 'pro' }
        });

        const result = await webhookService.processWebhookEvent(realStripePayloads.subscriptionUpdated);

        expect(result.success).toBe(true);
        expect(result.message).toBe('Subscription updated and entitlements refreshed');
    });

    it('should process real subscription.deleted payload', async () => {
        supabaseServiceClient.rpc
            .mockResolvedValueOnce({ data: false, error: null })
            .mockResolvedValueOnce({ data: 'webhook-uuid', error: null })
            .mockResolvedValueOnce({ data: true, error: null });

        supabaseServiceClient.single.mockResolvedValue({
            data: { id: 'auth0|507f1f77bcf86cd799439011' },
            error: null
        });

        mockEntitlementsService.setEntitlements.mockResolvedValue({
            success: true
        });

        const result = await webhookService.processWebhookEvent(realStripePayloads.subscriptionDeleted);

        expect(result.success).toBe(true);
        expect(result.message).toBe('Subscription deleted and entitlements reset to free plan');
    });
});