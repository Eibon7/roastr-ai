/**
 * Issue #95: Webhook Transaction Tests
 * Tests for atomic transaction support in Stripe webhooks
 */

const request = require('supertest');
const express = require('express');

// Set up environment
process.env.ENABLE_MOCK_MODE = 'true';
process.env.ENABLE_BILLING = 'true';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock123456789';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock123456789';
process.env.STRIPE_SUCCESS_URL = 'http://localhost:3000/success';
process.env.STRIPE_CANCEL_URL = 'http://localhost:3000/cancel';
process.env.STRIPE_PORTAL_RETURN_URL = 'http://localhost:3000/billing';
process.env.STRIPE_PRICE_LOOKUP_PRO = 'pro_monthly';
process.env.STRIPE_PRICE_LOOKUP_CREATOR = 'creator_plus_monthly';

// Also set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Mock Stripe
const mockStripe = {
    subscriptions: {
        retrieve: jest.fn(),
    },
    customers: {
        retrieve: jest.fn(),
    },
    prices: {
        list: jest.fn(),
    },
    webhooks: {
        constructEvent: jest.fn(),
    }
};

jest.mock('stripe', () => jest.fn(() => mockStripe));

// Mock StripeWrapper to return our mockStripe
jest.mock('../../../src/services/stripeWrapper', () => {
    return jest.fn().mockImplementation(() => mockStripe);
});

// Mock Supabase
const mockSupabaseServiceClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    rpc: jest.fn(),
};

// Setup chained mock responses
mockSupabaseServiceClient.from.mockReturnValue(mockSupabaseServiceClient);
mockSupabaseServiceClient.select.mockReturnValue(mockSupabaseServiceClient);
mockSupabaseServiceClient.eq.mockReturnValue(mockSupabaseServiceClient);

jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: mockSupabaseServiceClient,
    createUserClient: jest.fn()
}));

// Mock other services
jest.mock('../../../src/services/emailService', () => ({
    sendUpgradeSuccessNotification: jest.fn().mockResolvedValue(true),
    sendSubscriptionCanceledNotification: jest.fn().mockResolvedValue(true),
    sendPaymentFailedNotification: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../../src/services/notificationService', () => ({
    createUpgradeSuccessNotification: jest.fn().mockResolvedValue(true),
    createSubscriptionCanceledNotification: jest.fn().mockResolvedValue(true),
    createPaymentFailedNotification: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

// Mock flags to enable billing
jest.mock('../../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn((flag) => {
            if (flag === 'ENABLE_BILLING') return true;
            if (flag === 'ENABLE_MOCK_MODE') return true;
            return false;
        })
    }
}));

// Import after mocks
const billingRoutes = require('../../../src/routes/billing');

describe('Issue #95: Webhook Transaction Support', () => {
    let app;

    beforeEach(() => {
        app = express();
        // Don't use express.json() for the whole app, let the route handle it
        app.use('/api/billing', billingRoutes);

        // Reset all mocks
        jest.clearAllMocks();

        // Default mock responses
        mockStripe.webhooks.constructEvent.mockImplementation((body, sig, secret) => {
            // Return the parsed event
            return {
                id: 'evt_test_123',
                type: 'checkout.session.completed',
                created: Date.now() / 1000,
                data: {
                    object: {
                        id: 'cs_test_123',
                        customer: 'cus_test_123',
                        subscription: 'sub_test_123',
                        metadata: {
                            user_id: 'user_test_123',
                            lookup_key: 'pro_monthly'
                        }
                    }
                }
            };
        });

        // Default RPC responses
        mockSupabaseServiceClient.rpc.mockImplementation((fnName, params) => {
            console.log('RPC called:', fnName, params);
            if (fnName === 'is_webhook_event_processed') {
                return Promise.resolve({ data: false, error: null });
            }
            if (fnName === 'start_webhook_event_processing') {
                return Promise.resolve({ data: 'webhook_123', error: null });
            }
            if (fnName === 'complete_webhook_event_processing') {
                return Promise.resolve({ data: true, error: null });
            }
            if (fnName === 'execute_checkout_completed_transaction') {
                return Promise.resolve({ 
                    data: {
                        subscription_updated: true,
                        entitlements_updated: true,
                        plan_name: 'pro',
                        user_id: 'user_test_123',
                        subscription_id: 'sub_test_123'
                    },
                    error: null 
                });
            }
            return Promise.resolve({ data: null, error: 'Unknown RPC function' });
        });
    });

    describe('Checkout Completed Transaction', () => {
        it('should execute checkout completion in an atomic transaction', async () => {
            // Enable debug logging
            console.log('Starting checkout completion test');
            
            // Mock Stripe responses
            mockStripe.subscriptions.retrieve.mockResolvedValue({
                id: 'sub_test_123',
                customer: 'cus_test_123',
                status: 'active',
                current_period_start: 1640995200, // 2022-01-01
                current_period_end: 1672531200,   // 2023-01-01
                cancel_at_period_end: false,
                trial_end: null,
                items: {
                    data: [{
                        price: { id: 'price_test_123' }
                    }]
                }
            });

            mockStripe.customers.retrieve.mockResolvedValue({
                id: 'cus_test_123',
                email: 'test@example.com',
                name: 'Test User'
            });

            // Mock successful transaction
            mockSupabaseServiceClient.rpc.mockResolvedValue({
                error: null,
                data: {
                    subscription_updated: true,
                    entitlements_updated: true,
                    plan_name: 'pro',
                    user_id: 'user_test_123',
                    subscription_id: 'sub_test_123'
                }
            });

            const webhookPayload = {
                id: 'evt_test_123',
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_test_123',
                        customer: 'cus_test_123',
                        subscription: 'sub_test_123',
                        metadata: {
                            user_id: 'user_test_123',
                            lookup_key: 'pro_monthly'
                        }
                    }
                }
            };

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test_signature')
                .set('content-type', 'application/json')
                .send(Buffer.from(JSON.stringify(webhookPayload)));

            console.log('Response status:', response.status);
            console.log('Response body:', JSON.stringify(response.body, null, 2));
            
            if (response.status !== 200) {
                console.log('Response error - status:', response.status);
                console.log('Response body:', response.body);
                console.log('Response text:', response.text);
            }

            expect(response.status).toBe(200);
            expect(response.body.processed).toBe(true);
            
            // Log all RPC calls for debugging
            console.log('All RPC calls:', mockSupabaseServiceClient.rpc.mock.calls);
            
            // First, let's just check the RPC was called at all
            const rpcCalls = mockSupabaseServiceClient.rpc.mock.calls;
            expect(rpcCalls.length).toBeGreaterThan(0);
            
            // Find the transaction call
            const transactionCall = rpcCalls.find(call => call[0] === 'execute_checkout_completed_transaction');
            expect(transactionCall).toBeDefined();
            
            if (transactionCall) {
                expect(transactionCall[1]).toMatchObject({
                    p_user_id: 'user_test_123',
                    p_stripe_customer_id: 'cus_test_123',
                    p_stripe_subscription_id: 'sub_test_123',
                    p_plan: 'pro',
                    p_status: 'active'
                });
            }
        });

        it('should handle transaction failure gracefully', async () => {
            // Mock Stripe responses
            mockStripe.subscriptions.retrieve.mockResolvedValue({
                id: 'sub_test_123',
                customer: 'cus_test_123',
                status: 'active',
                current_period_start: 1640995200,
                current_period_end: 1672531200,
                cancel_at_period_end: false,
                trial_end: null,
                items: { data: [{ price: { id: 'price_test_123' } }] }
            });

            mockStripe.customers.retrieve.mockResolvedValue({
                id: 'cus_test_123',
                email: 'test@example.com'
            });

            // Mock transaction failure
            mockSupabaseServiceClient.rpc.mockResolvedValue({
                error: 'Database constraint violation',
                data: {
                    subscription_updated: false,
                    entitlements_updated: false
                }
            });

            const webhookPayload = {
                id: 'evt_test_123',
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_test_123',
                        customer: 'cus_test_123',
                        subscription: 'sub_test_123',
                        metadata: {
                            user_id: 'user_test_123',
                            lookup_key: 'pro_monthly'
                        }
                    }
                }
            };

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test_signature')
                .set('content-type', 'application/json')
                .send(Buffer.from(JSON.stringify(webhookPayload)));

            // Should still return 200 to prevent Stripe retries
            expect(response.status).toBe(200);
            expect(response.body.processed).toBe(false);
        });
    });

    describe('Subscription Deleted Transaction', () => {
        it('should execute subscription deletion in an atomic transaction', async () => {
            // Mock webhook event
            mockStripe.webhooks.constructEvent.mockReturnValue({
                id: 'evt_test_456',
                type: 'customer.subscription.deleted',
                created: Date.now() / 1000,
                data: {
                    object: {
                        id: 'sub_test_123',
                        customer: 'cus_test_123',
                        status: 'canceled'
                    }
                }
            });

            // Mock user lookup
            mockSupabaseServiceClient.single.mockResolvedValue({
                data: { user_id: 'user_test_123' },
                error: null
            });

            // Mock successful transaction
            mockSupabaseServiceClient.rpc.mockResolvedValue({
                error: null,
                data: {
                    subscription_updated: true,
                    entitlements_reset: true,
                    previous_plan: 'pro',
                    access_until_date: '2023-01-01T00:00:00Z',
                    user_id: 'user_test_123'
                }
            });

            mockStripe.customers.retrieve.mockResolvedValue({
                id: 'cus_test_123',
                email: 'test@example.com',
                name: 'Test User'
            });

            const webhookPayload = {
                id: 'evt_test_456',
                type: 'customer.subscription.deleted',
                data: {
                    object: {
                        id: 'sub_test_123',
                        customer: 'cus_test_123',
                        status: 'canceled'
                    }
                }
            };

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test_signature')
                .set('content-type', 'application/json')
                .send(Buffer.from(JSON.stringify(webhookPayload)));

            expect(response.status).toBe(200);
            expect(response.body.processed).toBe(true);

            // Verify transaction function was called
            expect(mockSupabaseServiceClient.rpc).toHaveBeenCalledWith(
                'execute_subscription_deleted_transaction',
                expect.objectContaining({
                    p_user_id: 'user_test_123',
                    p_subscription_id: 'sub_test_123',
                    p_customer_id: 'cus_test_123'
                })
            );
        });
    });

    describe('Payment Success/Failure Transactions', () => {
        it('should execute payment success in an atomic transaction', async () => {
            // Mock webhook event
            mockStripe.webhooks.constructEvent.mockReturnValue({
                id: 'evt_test_789',
                type: 'invoice.payment_succeeded',
                created: Date.now() / 1000,
                data: {
                    object: {
                        id: 'in_test_123',
                        customer: 'cus_test_123',
                        amount_paid: 2000
                    }
                }
            });

            // Mock user lookup
            mockSupabaseServiceClient.single.mockResolvedValue({
                data: { user_id: 'user_test_123' },
                error: null
            });

            // Mock successful transaction
            mockSupabaseServiceClient.rpc.mockResolvedValue({
                error: null,
                data: {
                    status_updated: true,
                    user_id: 'user_test_123',
                    invoice_id: 'in_test_123',
                    amount_paid: 2000,
                    rows_affected: 1
                }
            });

            const webhookPayload = {
                id: 'evt_test_789',
                type: 'invoice.payment_succeeded',
                data: {
                    object: {
                        id: 'in_test_123',
                        customer: 'cus_test_123',
                        amount_paid: 2000
                    }
                }
            };

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test_signature')
                .set('content-type', 'application/json')
                .send(Buffer.from(JSON.stringify(webhookPayload)));

            expect(response.status).toBe(200);
            expect(response.body.processed).toBe(true);

            // Verify transaction function was called
            expect(mockSupabaseServiceClient.rpc).toHaveBeenCalledWith(
                'execute_payment_succeeded_transaction',
                expect.objectContaining({
                    p_user_id: 'user_test_123',
                    p_customer_id: 'cus_test_123',
                    p_invoice_id: 'in_test_123',
                    p_amount_paid: 2000
                })
            );
        });

        it('should execute payment failure in an atomic transaction', async () => {
            // Mock webhook event
            mockStripe.webhooks.constructEvent.mockReturnValue({
                id: 'evt_test_101',
                type: 'invoice.payment_failed',
                created: Date.now() / 1000,
                data: {
                    object: {
                        id: 'in_test_456',
                        customer: 'cus_test_123',
                        amount_due: 2000,
                        attempt_count: 2
                    }
                }
            });

            // Mock user lookup
            mockSupabaseServiceClient.single.mockResolvedValue({
                data: { user_id: 'user_test_123' },
                error: null
            });

            // Mock successful transaction
            mockSupabaseServiceClient.rpc.mockResolvedValue({
                error: null,
                data: {
                    status_updated: true,
                    plan_name: 'pro',
                    user_id: 'user_test_123',
                    invoice_id: 'in_test_456',
                    amount_due: 2000,
                    attempt_count: 2,
                    rows_affected: 1
                }
            });

            mockStripe.customers.retrieve.mockResolvedValue({
                id: 'cus_test_123',
                email: 'test@example.com',
                name: 'Test User'
            });

            const webhookPayload = {
                id: 'evt_test_101',
                type: 'invoice.payment_failed',
                data: {
                    object: {
                        id: 'in_test_456',
                        customer: 'cus_test_123',
                        amount_due: 2000,
                        attempt_count: 2
                    }
                }
            };

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test_signature')
                .set('content-type', 'application/json')
                .send(Buffer.from(JSON.stringify(webhookPayload)));

            expect(response.status).toBe(200);
            expect(response.body.processed).toBe(true);

            // Verify transaction function was called
            expect(mockSupabaseServiceClient.rpc).toHaveBeenCalledWith(
                'execute_payment_failed_transaction',
                expect.objectContaining({
                    p_user_id: 'user_test_123',
                    p_customer_id: 'cus_test_123',
                    p_invoice_id: 'in_test_456',
                    p_amount_due: 2000,
                    p_attempt_count: 2
                })
            );
        });
    });

    describe('Transaction Rollback Scenarios', () => {
        it('should rollback subscription update on entitlements failure', async () => {
            // Mock webhook event
            mockStripe.webhooks.constructEvent.mockReturnValue({
                id: 'evt_test_rollback',
                type: 'customer.subscription.updated',
                created: Date.now() / 1000,
                data: {
                    object: {
                        id: 'sub_test_123',
                        customer: 'cus_test_123',
                        status: 'active',
                        current_period_start: 1640995200,
                        current_period_end: 1672531200,
                        cancel_at_period_end: false,
                        trial_end: null,
                        items: { data: [{ price: { id: 'price_test_123' } }] }
                    }
                }
            });

            // Mock user lookup
            mockSupabaseServiceClient.single.mockResolvedValue({
                data: { user_id: 'user_test_123' },
                error: null
            });

            // Mock Stripe price lookup
            mockStripe.prices.list.mockResolvedValue({
                data: [{
                    id: 'price_test_123',
                    lookup_key: 'pro_monthly'
                }]
            });

            // Mock transaction failure due to entitlements error
            mockSupabaseServiceClient.rpc.mockResolvedValue({
                error: 'Entitlements service unavailable',
                data: {
                    subscription_updated: false,
                    entitlements_updated: false,
                    old_plan: 'free',
                    new_plan: 'pro'
                }
            });

            const webhookPayload = {
                id: 'evt_test_rollback',
                type: 'customer.subscription.updated',
                data: {
                    object: {
                        id: 'sub_test_123',
                        customer: 'cus_test_123',
                        status: 'active',
                        current_period_start: 1640995200,
                        current_period_end: 1672531200,
                        cancel_at_period_end: false,
                        trial_end: null,
                        items: { data: [{ price: { id: 'price_test_123' } }] }
                    }
                }
            };

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test_signature')
                .set('content-type', 'application/json')
                .send(Buffer.from(JSON.stringify(webhookPayload)));

            expect(response.status).toBe(200);
            expect(response.body.processed).toBe(true); // Webhook should still be acknowledged

            // Verify transaction was attempted but handled gracefully
            expect(mockSupabaseServiceClient.rpc).toHaveBeenCalledWith(
                'execute_subscription_updated_transaction',
                expect.any(Object)
            );
        });
    });

    describe('Error Handling and Logging', () => {
        it('should provide detailed error context on transaction failure', async () => {
            const { logger } = require('../../../src/utils/logger');

            // Mock transaction with detailed error
            mockSupabaseServiceClient.rpc.mockResolvedValue({
                error: 'Database connection timeout',
                data: {
                    subscription_updated: false,
                    entitlements_updated: false,
                    error_detail: 'SQLSTATE 08006'
                }
            });

            mockStripe.subscriptions.retrieve.mockResolvedValue({
                id: 'sub_test_123',
                customer: 'cus_test_123',
                status: 'active',
                current_period_start: 1640995200,
                current_period_end: 1672531200,
                cancel_at_period_end: false,
                trial_end: null,
                items: { data: [{ price: { id: 'price_test_123' } }] }
            });

            mockStripe.customers.retrieve.mockResolvedValue({
                id: 'cus_test_123',
                email: 'test@example.com'
            });

            const webhookPayload = {
                id: 'evt_test_error',
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_test_123',
                        customer: 'cus_test_123',
                        subscription: 'sub_test_123',
                        metadata: {
                            user_id: 'user_test_123',
                            lookup_key: 'pro_monthly'
                        }
                    }
                }
            };

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test_signature')
                .set('content-type', 'application/json')
                .send(Buffer.from(JSON.stringify(webhookPayload)));

            expect(response.status).toBe(200);
            expect(response.body.processed).toBe(false);

            // Verify detailed error logging
            expect(logger.error).toHaveBeenCalledWith(
                'Transaction failed during checkout completion:',
                expect.objectContaining({
                    userId: 'user_test_123',
                    subscriptionId: 'sub_test_123',
                    error: 'Database connection timeout',
                    details: expect.objectContaining({
                        error_detail: 'SQLSTATE 08006'
                    })
                })
            );
        });
    });
});