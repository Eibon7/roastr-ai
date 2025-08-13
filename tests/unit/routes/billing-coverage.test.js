/**
 * Additional coverage tests for billing routes
 * Focus on uncovered paths and edge cases in mock mode
 */

const request = require('supertest');
const express = require('express');

// Mock environment variables
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
    update: jest.fn().mockReturnThis()
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

describe('Billing Routes Coverage Tests', () => {
    let app;
    const { logger } = require('../../../src/utils/logger');

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset Supabase mocks
        mockSupabaseServiceClient.from.mockReturnThis();
        mockSupabaseServiceClient.select.mockReturnThis();
        mockSupabaseServiceClient.eq.mockReturnThis();
        mockSupabaseServiceClient.update.mockReturnThis();
        mockSupabaseServiceClient.single.mockReturnValue(Promise.resolve({ data: null, error: null }));
        mockSupabaseServiceClient.upsert.mockReturnValue(Promise.resolve({ error: null }));

        // Setup Express app
        app = express();
        app.use(express.json());
        app.use('/api/billing', billingRoutes);
    });

    describe('Price lookup edge cases', () => {
        it('should handle empty price list from Stripe', async () => {
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

            // Mock empty price list
            mockStripe.prices.list.mockResolvedValueOnce({
                data: []
            });

            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ lookupKey: 'plan_pro' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Price not found');
            expect(logger.error).toHaveBeenCalled();
        });

        it('should handle free plan selection directly', async () => {
            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ plan: 'free' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toBe('Free plan activated');
            expect(response.body.data.plan).toBe('free');
        });
    });

    describe('Customer retrieval scenarios', () => {
        it('should create new customer when retrieval fails', async () => {
            // Mock existing subscription with customer ID
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: { stripe_customer_id: 'cus_old123' },
                error: null
            });

            // Mock customer retrieval failure
            mockStripe.customers.retrieve.mockRejectedValueOnce(
                new Error('Customer deleted')
            );

            // Mock new customer creation
            mockStripe.customers.create.mockResolvedValueOnce({
                id: 'cus_new123',
                email: 'test@example.com'
            });

            // Mock successful upsert
            mockSupabaseServiceClient.upsert.mockResolvedValueOnce({
                error: null
            });

            // Mock price list
            mockStripe.prices.list.mockResolvedValueOnce({
                data: [{
                    id: 'price_123',
                    lookup_key: 'plan_pro'
                }]
            });

            // Mock checkout session
            mockStripe.checkout.sessions.create.mockResolvedValueOnce({
                id: 'cs_test123',
                url: 'https://checkout.stripe.com/cs_test123'
            });

            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ lookupKey: 'plan_pro' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(mockStripe.customers.create).toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Failed to retrieve existing customer'),
                expect.any(String)
            );
        });
    });

    describe('Webhook handler functions', () => {
        it('should handle checkout.session.completed with missing user_id', async () => {
            const mockEvent = {
                type: 'checkout.session.completed',
                id: 'evt_test123',
                data: {
                    object: {
                        id: 'cs_test123',
                        customer: 'cus_test123',
                        subscription: 'sub_test123',
                        metadata: {} // Missing user_id
                    }
                }
            };

            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test-sig')
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
            expect(logger.error).toHaveBeenCalledWith('No user_id in checkout session metadata');
        });

        it('should handle subscription update for unknown customer', async () => {
            const mockEvent = {
                type: 'customer.subscription.updated',
                id: 'evt_test123',
                data: {
                    object: {
                        id: 'sub_test123',
                        customer: 'cus_unknown',
                        status: 'active',
                        current_period_start: 1234567890,
                        current_period_end: 1234567890,
                        items: { data: [] }
                    }
                }
            };

            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            // Mock customer not found
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' }
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test-sig')
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
            expect(logger.error).toHaveBeenCalledWith(
                'Could not find user for customer:',
                'cus_unknown'
            );
        });

        it('should handle invoice.payment_succeeded event', async () => {
            const mockEvent = {
                type: 'invoice.payment_succeeded',
                id: 'evt_test123',
                data: {
                    object: {
                        customer: 'cus_test123',
                        subscription: 'sub_test123'
                    }
                }
            };

            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            // Mock finding user
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: { user_id: 'test-user-id' },
                error: null
            });

            // Mock status update
            mockSupabaseServiceClient.update.mockReturnThis();
            mockSupabaseServiceClient.eq.mockReturnThis();
            mockSupabaseServiceClient.eq.mockResolvedValueOnce({
                error: null
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test-sig')
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
            expect(logger.info).toHaveBeenCalledWith(
                'Payment succeeded for user:',
                'test-user-id'
            );
        });

        it('should handle invoice.payment_failed event', async () => {
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

            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            // Mock finding user
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: { user_id: 'test-user-id' },
                error: null
            });

            // Mock status update
            mockSupabaseServiceClient.update.mockReturnThis();
            mockSupabaseServiceClient.eq.mockResolvedValueOnce({
                error: null
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test-sig')
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
            expect(logger.warn).toHaveBeenCalledWith(
                'Payment failed for user:',
                'test-user-id'
            );
        });

        it('should handle customer.subscription.deleted event', async () => {
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

            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            // Mock finding user
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: { user_id: 'test-user-id' },
                error: null
            });

            // Mock subscription reset
            mockSupabaseServiceClient.update.mockReturnThis();
            mockSupabaseServiceClient.eq.mockResolvedValueOnce({
                error: null
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test-sig')
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
            expect(logger.info).toHaveBeenCalledWith(
                'Subscription reset to free:',
                expect.objectContaining({ userId: 'test-user-id' })
            );
        });
    });

    describe('Portal session errors', () => {
        it('should handle portal creation with database error', async () => {
            // Mock database error
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Database error' }
            });

            const response = await request(app)
                .post('/api/billing/create-portal-session')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('No active subscription found');
        });

        it('should handle Stripe portal API error', async () => {
            // Mock valid subscription
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: { stripe_customer_id: 'cus_test123' },
                error: null
            });

            // Mock portal creation error
            mockStripe.billingPortal.sessions.create.mockRejectedValueOnce(
                new Error('Portal temporarily unavailable')
            );

            const response = await request(app)
                .post('/api/billing/create-portal-session')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to create portal session');
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('Subscription details edge cases', () => {
        it('should return free plan when no subscription exists', async () => {
            // Mock no subscription
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' }
            });

            const response = await request(app)
                .get('/api/billing/subscription')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.subscription.plan).toBe('free');
            expect(response.body.data.subscription.status).toBe('active');
            expect(response.body.data.planConfig.name).toBe('Free');
        });

        it('should handle database error gracefully', async () => {
            // Mock database error
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Connection timeout' }
            });

            const response = await request(app)
                .get('/api/billing/subscription')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to fetch subscription');
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('Checkout session with plan parameter', () => {
        it('should map plan to correct lookup key', async () => {
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

            // Mock price list
            mockStripe.prices.list.mockResolvedValueOnce({
                data: [{
                    id: 'price_123',
                    lookup_key: 'plan_creator_plus'
                }]
            });

            // Mock checkout session
            mockStripe.checkout.sessions.create.mockResolvedValueOnce({
                id: 'cs_test123',
                url: 'https://checkout.stripe.com/cs_test123'
            });

            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ plan: 'creator_plus' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(mockStripe.prices.list).toHaveBeenCalledWith({
                lookup_keys: ['plan_creator_plus'],
                expand: ['data.product']
            });
        });
    });
});