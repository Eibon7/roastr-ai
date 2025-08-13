/**
 * Simple additional coverage tests for billing routes
 * Focus on edge cases and uncovered paths in mock mode
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

describe('Billing Routes Simple Coverage Tests', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset Supabase mocks
        mockSupabaseServiceClient.from.mockReturnThis();
        mockSupabaseServiceClient.select.mockReturnThis();
        mockSupabaseServiceClient.eq.mockReturnThis();
        mockSupabaseServiceClient.single.mockReturnValue(Promise.resolve({ data: null, error: null }));
        mockSupabaseServiceClient.upsert.mockReturnValue(Promise.resolve({ error: null }));
        mockSupabaseServiceClient.update.mockReturnThis();

        // Setup Express app
        app = express();
        app.use(express.json());
        app.use('/api/billing', billingRoutes);
    });

    describe('Free plan handling', () => {
        it('should handle free plan directly without Stripe', async () => {
            // Free plan needs a lookupKey to pass the validation, but then gets handled specially
            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ plan: 'free', lookupKey: 'free_plan' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toBe('Free plan activated');
            expect(response.body.data.plan).toBe('free');
        });
    });

    describe('Price lookup failures', () => {
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

            // Mock upsert operation
            mockSupabaseServiceClient.upsert.mockResolvedValueOnce({
                error: null
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
        });
    });

    describe('Customer retrieval fallback', () => {
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
        });
    });

    describe('Plan parameter mapping', () => {
        it('should map plan parameter to lookup key', async () => {
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

    describe('Portal session edge cases', () => {
        it('should handle database error when getting customer ID', async () => {
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
    });

    describe('Subscription endpoint edge cases', () => {
        it('should handle unknown plan gracefully', async () => {
            // Mock subscription with unknown plan
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    user_id: 'test-user-id',
                    plan: 'enterprise', // Not in PLAN_CONFIG
                    status: 'active',
                    stripe_customer_id: 'cus_test123'
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

    describe('Webhook edge cases', () => {
        it('should handle webhook with missing user_id metadata', async () => {
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
        });

        it('should handle unhandled webhook events', async () => {
            const mockEvent = {
                type: 'unknown.event.type',
                id: 'evt_test123',
                data: { object: {} }
            };

            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test-sig')
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
        });
    });
});