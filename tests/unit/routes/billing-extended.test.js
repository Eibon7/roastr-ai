/**
 * Extended tests for billing routes - Additional coverage for edge cases
 */

const request = require('supertest');
const express = require('express');

// Mock environment variables first
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';
process.env.STRIPE_PRICE_LOOKUP_PRO = 'plan_pro';
process.env.STRIPE_PRICE_LOOKUP_CREATOR = 'plan_creator_plus';
process.env.STRIPE_SUCCESS_URL = 'http://localhost:3000/success';
process.env.STRIPE_CANCEL_URL = 'http://localhost:3000/cancel';
process.env.STRIPE_PORTAL_RETURN_URL = 'http://localhost:3000/billing';

// Mock Stripe
const mockStripe = {
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

jest.mock('stripe', () => jest.fn(() => mockStripe));

// Mock Supabase
const mockSupabaseServiceClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis()
};

jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: mockSupabaseServiceClient,
    createUserClient: jest.fn()
}));

// Mock auth middleware
const mockAuthenticateToken = jest.fn((req, res, next) => {
    req.user = {
        id: 'test-user-id',
        email: 'test@example.com'
    };
    next();
});

jest.mock('../../../src/middleware/auth', () => ({
    authenticateToken: mockAuthenticateToken
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

const billingRoutes = require('../../../src/routes/billing');

describe('Billing Routes Extended Tests', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset Supabase mocks
        mockSupabaseServiceClient.from.mockReturnThis();
        mockSupabaseServiceClient.select.mockReturnThis();
        mockSupabaseServiceClient.eq.mockReturnThis();
        mockSupabaseServiceClient.update.mockReturnThis();
        mockSupabaseServiceClient.delete.mockReturnThis();
        mockSupabaseServiceClient.single.mockReturnValue(Promise.resolve({ data: null, error: null }));
        mockSupabaseServiceClient.upsert.mockReturnValue(Promise.resolve({ error: null }));

        // Setup Express app
        app = express();
        app.use(express.json());
        app.use('/api/billing', billingRoutes);
    });

    describe('Plan configuration edge cases', () => {
        it('should handle request for non-existent plan', async () => {
            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ plan: 'super_premium' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('plan is required (free|pro|creator_plus)');
        });

        it('should handle missing price lookup configuration', async () => {
            // Mock no existing subscription
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: null
            });

            // Mock customer creation
            mockStripe.customers.create.mockResolvedValueOnce({
                id: 'cus_test123',
                email: 'test@example.com'
            });

            // Mock empty price list (price not found)
            mockStripe.prices.list.mockResolvedValueOnce({
                data: []
            });

            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ lookupKey: 'plan_pro' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Price not found for lookup key');
        });

        it('should handle currency mismatch', async () => {
            // Test with invalid currency in plan config
            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ 
                    plan: 'pro',
                    currency: 'usd' // Plan is configured for EUR
                })
                .expect(200); // Should proceed with plan's default currency

            expect(response.body.success).toBe(true);
        });
    });

    describe('Customer management edge cases', () => {
        it('should handle Stripe customer retrieval failure', async () => {
            // Mock existing subscription with customer ID
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: { stripe_customer_id: 'cus_existing123' },
                error: null
            });

            // Mock customer retrieval failure
            mockStripe.customers.retrieve.mockRejectedValueOnce(
                new Error('Customer not found')
            );

            // Mock customer creation as fallback
            mockStripe.customers.create.mockResolvedValueOnce({
                id: 'cus_new123',
                email: 'test@example.com'
            });

            // Mock price lookup
            mockStripe.prices.list.mockResolvedValueOnce({
                data: [{
                    id: 'price_pro123',
                    lookup_key: 'plan_pro'
                }]
            });

            // Mock checkout session
            mockStripe.checkout.sessions.create.mockResolvedValueOnce({
                id: 'cs_test123',
                url: 'https://checkout.stripe.com/pay/cs_test123'
            });

            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ lookupKey: 'plan_pro' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(mockStripe.customers.create).toHaveBeenCalled();
        });

        it('should handle database error when saving customer ID', async () => {
            // Mock no existing subscription
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: null
            });

            // Mock customer creation
            mockStripe.customers.create.mockResolvedValueOnce({
                id: 'cus_test123',
                email: 'test@example.com'
            });

            // Mock upsert failure
            mockSupabaseServiceClient.upsert.mockResolvedValueOnce({
                error: { message: 'Database error' }
            });

            // Continue with checkout despite DB error
            mockStripe.prices.list.mockResolvedValueOnce({
                data: [{
                    id: 'price_pro123',
                    lookup_key: 'plan_pro'
                }]
            });

            mockStripe.checkout.sessions.create.mockResolvedValueOnce({
                id: 'cs_test123',
                url: 'https://checkout.stripe.com/pay/cs_test123'
            });

            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ lookupKey: 'plan_pro' })
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('Portal session edge cases', () => {
        it('should handle Stripe portal creation failure', async () => {
            // Mock subscription with customer ID
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: { stripe_customer_id: 'cus_test123' },
                error: null
            });

            // Mock portal creation failure
            mockStripe.billingPortal.sessions.create.mockRejectedValueOnce(
                new Error('Portal unavailable')
            );

            const response = await request(app)
                .post('/api/billing/create-portal-session')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to create portal session');
        });
    });

    describe('Webhook handling edge cases', () => {
        it('should handle subscription update with missing price data', async () => {
            const mockEvent = {
                type: 'customer.subscription.updated',
                id: 'evt_test123',
                data: {
                    object: {
                        id: 'sub_test123',
                        customer: 'cus_test123',
                        status: 'active',
                        current_period_start: 1234567890,
                        current_period_end: 1234567890,
                        cancel_at_period_end: false,
                        trial_end: null,
                        items: {
                            data: []  // No items
                        }
                    }
                }
            };

            const mockSignature = 'mock-signature';
            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            // Mock finding user
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: { user_id: 'test-user-id' },
                error: null
            });

            // Mock prices list (empty)
            mockStripe.prices.list.mockResolvedValueOnce({
                data: []
            });

            // Mock subscription update
            mockSupabaseServiceClient.update.mockReturnThis();
            mockSupabaseServiceClient.eq.mockResolvedValueOnce({
                error: null
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', mockSignature)
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
        });

        it('should handle payment failed event', async () => {
            const mockEvent = {
                type: 'invoice.payment_failed',
                id: 'evt_test123',
                data: {
                    object: {
                        customer: 'cus_test123',
                        subscription: 'sub_test123'
                    }
                }
            };

            const mockSignature = 'mock-signature';
            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            // Mock finding user
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: { user_id: 'test-user-id' },
                error: null
            });

            // Mock updating subscription status
            mockSupabaseServiceClient.update.mockReturnThis();
            mockSupabaseServiceClient.eq.mockReturnThis();
            mockSupabaseServiceClient.eq.mockResolvedValueOnce({
                error: null
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', mockSignature)
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
        });

        it('should handle subscription deletion', async () => {
            const mockEvent = {
                type: 'customer.subscription.deleted',
                id: 'evt_test123',
                data: {
                    object: {
                        id: 'sub_test123',
                        customer: 'cus_test123'
                    }
                }
            };

            const mockSignature = 'mock-signature';
            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            // Mock finding user
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: { user_id: 'test-user-id' },
                error: null
            });

            // Mock resetting to free plan
            mockSupabaseServiceClient.update.mockReturnThis();
            mockSupabaseServiceClient.eq.mockResolvedValueOnce({
                error: null
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', mockSignature)
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
        });

        it('should handle checkout session with missing metadata', async () => {
            const mockEvent = {
                type: 'checkout.session.completed',
                id: 'evt_test123',
                data: {
                    object: {
                        id: 'cs_test123',
                        customer: 'cus_test123',
                        subscription: 'sub_test123',
                        metadata: {} // Empty metadata
                    }
                }
            };

            const mockSignature = 'mock-signature';
            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', mockSignature)
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
        });
    });

    describe('Subscription status edge cases', () => {
        it('should handle missing subscription gracefully', async () => {
            // Mock no subscription found
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' } // Not found error
            });

            const response = await request(app)
                .get('/api/billing/subscription')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.subscription.plan).toBe('free');
            expect(response.body.data.subscription.status).toBe('active');
        });

        it('should handle subscription with unknown plan', async () => {
            // Mock subscription with invalid plan
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    user_id: 'test-user-id',
                    plan: 'enterprise', // Not in PLAN_CONFIG
                    status: 'active',
                    stripe_customer_id: 'cus_test123',
                    stripe_subscription_id: 'sub_test123'
                },
                error: null
            });

            const response = await request(app)
                .get('/api/billing/subscription')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.subscription.plan).toBe('enterprise');
            expect(response.body.data.planConfig).toBeUndefined();
        });
    });

    describe('Error handling scenarios', () => {
        it('should handle Stripe checkout session creation error', async () => {
            // Mock setup for successful customer creation
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: null
            });

            mockStripe.customers.create.mockResolvedValueOnce({
                id: 'cus_test123',
                email: 'test@example.com'
            });

            mockStripe.prices.list.mockResolvedValueOnce({
                data: [{
                    id: 'price_pro123',
                    lookup_key: 'plan_pro'
                }]
            });

            // Mock checkout session creation failure
            mockStripe.checkout.sessions.create.mockRejectedValueOnce(
                new Error('Payment method required')
            );

            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ lookupKey: 'plan_pro' })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to create checkout session');
        });

        it('should handle webhook processing error gracefully', async () => {
            const mockEvent = {
                type: 'invoice.payment_succeeded',
                id: 'evt_test123',
                data: {
                    object: {
                        customer: 'cus_test123'
                    }
                }
            };

            const mockSignature = 'mock-signature';
            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            // Mock database error
            mockSupabaseServiceClient.single.mockRejectedValueOnce(
                new Error('Database connection failed')
            );

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', mockSignature)
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(500);

            expect(response.body.error).toBe('Webhook processing failed');
        });
    });
});