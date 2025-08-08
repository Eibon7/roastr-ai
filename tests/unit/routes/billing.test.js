/**
 * Tests unitarios para rutas de facturación y Stripe
 */

const request = require('supertest');
const express = require('express');
const billingRoutes = require('../../../src/routes/billing');

// Mock Stripe
jest.mock('stripe', () => {
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

    return jest.fn(() => mockStripe);
});

// Mock dependencies
jest.mock('../../../src/middleware/auth');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/config/supabase');

describe('Billing Routes Tests', () => {
    let app;
    let mockStripe;
    let mockAuthenticateToken;
    let mockSupabaseServiceClient;

    beforeEach(() => {
        // Setup Express app
        app = express();
        app.use(express.json());
        
        // Mock Stripe instance
        const Stripe = require('stripe');
        mockStripe = Stripe();

        // Mock authentication middleware
        mockAuthenticateToken = require('../../../src/middleware/auth').authenticateToken;
        mockAuthenticateToken.mockImplementation((req, res, next) => {
            req.user = { 
                id: 'test-user-id',
                email: 'test@example.com'
            };
            next();
        });
        
        // Mock Supabase client
        mockSupabaseServiceClient = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn()
        };
        
        const { supabaseServiceClient } = require('../../../src/config/supabase');
        supabaseServiceClient.from = mockSupabaseServiceClient.from;

        // Use billing routes
        app.use('/api/billing', billingRoutes);
        
        // Setup webhook route with raw body parser
        app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), billingRoutes);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/billing/plans', () => {
        it('should return available subscription plans', async () => {
            const response = await request(app)
                .get('/api/billing/plans')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.plans).toBeDefined();
            expect(response.body.data.plans.free).toBeDefined();
            expect(response.body.data.plans.pro).toBeDefined();
            expect(response.body.data.plans.creator_plus).toBeDefined();
        });
    });

    describe('POST /api/billing/create-checkout-session', () => {
        beforeEach(() => {
            // Mock existing subscription check
            mockSupabaseServiceClient.single
                .mockResolvedValueOnce({
                    data: null,
                    error: null
                });
        });

        it('should create checkout session successfully for Pro plan', async () => {
            // Mock customer creation
            mockStripe.customers.create.mockResolvedValueOnce({
                id: 'cus_test123',
                email: 'test@example.com'
            });

            // Mock price lookup
            mockStripe.prices.list.mockResolvedValueOnce({
                data: [{
                    id: 'price_pro123',
                    lookup_key: 'pro_monthly'
                }]
            });

            // Mock checkout session creation
            mockStripe.checkout.sessions.create.mockResolvedValueOnce({
                id: 'cs_test123',
                url: 'https://checkout.stripe.com/pay/cs_test123'
            });

            // Mock upsert operation
            mockSupabaseServiceClient.upsert.mockResolvedValueOnce({
                error: null
            });

            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ lookupKey: 'pro_monthly' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.url).toBe('https://checkout.stripe.com/pay/cs_test123');
            expect(response.body.data.sessionId).toBe('cs_test123');
            expect(mockStripe.customers.create).toHaveBeenCalledWith({
                email: 'test@example.com',
                metadata: {
                    user_id: 'test-user-id'
                }
            });
        });

        it('should return error for missing lookupKey', async () => {
            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('lookupKey is required');
        });

        it('should return error for invalid lookupKey', async () => {
            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ lookupKey: 'invalid_key' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid lookup key');
        });

        it('should use existing customer if available', async () => {
            // Mock existing subscription with customer ID
            mockSupabaseServiceClient.single
                .mockResolvedValueOnce({
                    data: { stripe_customer_id: 'cus_existing123' },
                    error: null
                });

            // Mock customer retrieval
            mockStripe.customers.retrieve.mockResolvedValueOnce({
                id: 'cus_existing123',
                email: 'test@example.com'
            });

            // Mock price lookup
            mockStripe.prices.list.mockResolvedValueOnce({
                data: [{
                    id: 'price_pro123',
                    lookup_key: 'pro_monthly'
                }]
            });

            // Mock checkout session creation
            mockStripe.checkout.sessions.create.mockResolvedValueOnce({
                id: 'cs_test123',
                url: 'https://checkout.stripe.com/pay/cs_test123'
            });

            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ lookupKey: 'pro_monthly' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(mockStripe.customers.create).not.toHaveBeenCalled();
            expect(mockStripe.customers.retrieve).toHaveBeenCalledWith('cus_existing123');
        });
    });

    describe('POST /api/billing/create-portal-session', () => {
        it('should create portal session successfully', async () => {
            // Mock user subscription
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: { stripe_customer_id: 'cus_test123' },
                error: null
            });

            // Mock portal session creation
            mockStripe.billingPortal.sessions.create.mockResolvedValueOnce({
                id: 'bps_test123',
                url: 'https://billing.stripe.com/session/bps_test123'
            });

            const response = await request(app)
                .post('/api/billing/create-portal-session')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.url).toBe('https://billing.stripe.com/session/bps_test123');
            expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
                customer: 'cus_test123',
                return_url: undefined // Will be undefined in test without env var
            });
        });

        it('should return error when no subscription found', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Not found' }
            });

            const response = await request(app)
                .post('/api/billing/create-portal-session')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('No active subscription found');
        });
    });

    describe('GET /api/billing/subscription', () => {
        it('should return user subscription details', async () => {
            const mockSubscription = {
                user_id: 'test-user-id',
                plan: 'pro',
                status: 'active',
                stripe_customer_id: 'cus_test123',
                current_period_end: '2024-01-01T00:00:00.000Z'
            };

            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: mockSubscription,
                error: null
            });

            const response = await request(app)
                .get('/api/billing/subscription')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.subscription).toEqual(mockSubscription);
            expect(response.body.data.planConfig).toBeDefined();
        });

        it('should return default free subscription when none exists', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: null
            });

            const response = await request(app)
                .get('/api/billing/subscription')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.subscription.plan).toBe('free');
            expect(response.body.data.subscription.user_id).toBe('test-user-id');
        });
    });

    describe('POST /webhooks/stripe', () => {
        const mockWebhookSecret = 'whsec_test123';
        const mockSignature = 'test-signature';

        beforeEach(() => {
            process.env.STRIPE_WEBHOOK_SECRET = mockWebhookSecret;
        });

        it('should handle checkout.session.completed event', async () => {
            const mockEvent = {
                id: 'evt_test123',
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_test123',
                        customer: 'cus_test123',
                        subscription: 'sub_test123',
                        metadata: {
                            user_id: 'test-user-id',
                            lookup_key: 'pro_monthly'
                        }
                    }
                }
            };

            // Mock webhook signature verification
            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            // Mock Stripe API calls
            mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
                id: 'sub_test123',
                status: 'active',
                current_period_start: 1640995200, // 2022-01-01
                current_period_end: 1672531200,   // 2023-01-01
                cancel_at_period_end: false,
                trial_end: null
            });

            mockStripe.customers.retrieve.mockResolvedValueOnce({
                id: 'cus_test123',
                email: 'test@example.com'
            });

            // Mock database upsert
            mockSupabaseServiceClient.upsert.mockResolvedValueOnce({
                error: null
            });

            const response = await request(app)
                .post('/webhooks/stripe')
                .set('stripe-signature', mockSignature)
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
            expect(mockStripe.webhooks.constructEvent).toHaveBeenCalled();
            expect(mockSupabaseServiceClient.upsert).toHaveBeenCalledWith({
                user_id: 'test-user-id',
                stripe_customer_id: 'cus_test123',
                stripe_subscription_id: 'sub_test123',
                plan: 'pro',
                status: 'active',
                current_period_start: '2022-01-01T00:00:00.000Z',
                current_period_end: '2023-01-01T00:00:00.000Z',
                cancel_at_period_end: false,
                trial_end: null
            });
        });

        it('should handle customer.subscription.updated event', async () => {
            const mockEvent = {
                id: 'evt_test123',
                type: 'customer.subscription.updated',
                data: {
                    object: {
                        id: 'sub_test123',
                        customer: 'cus_test123',
                        status: 'active',
                        current_period_start: 1640995200,
                        current_period_end: 1672531200,
                        cancel_at_period_end: true,
                        items: {
                            data: [{
                                price: {
                                    id: 'price_creator123',
                                    lookup_key: 'creator_plus_monthly'
                                }
                            }]
                        }
                    }
                }
            };

            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            // Mock finding user by customer ID
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: { user_id: 'test-user-id' },
                error: null
            });

            // Mock prices list for plan determination
            mockStripe.prices.list.mockResolvedValueOnce({
                data: [{
                    id: 'price_creator123',
                    lookup_key: 'creator_plus_monthly'
                }]
            });

            // Mock database update
            mockSupabaseServiceClient.update.mockResolvedValueOnce({
                error: null
            });

            const response = await request(app)
                .post('/webhooks/stripe')
                .set('stripe-signature', mockSignature)
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
            expect(mockSupabaseServiceClient.update).toHaveBeenCalledWith({
                plan: 'creator_plus',
                status: 'active',
                current_period_start: '2022-01-01T00:00:00.000Z',
                current_period_end: '2023-01-01T00:00:00.000Z',
                cancel_at_period_end: true,
                trial_end: null
            });
        });

        it('should handle customer.subscription.deleted event', async () => {
            const mockEvent = {
                id: 'evt_test123',
                type: 'customer.subscription.deleted',
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

            // Mock database update to free plan
            mockSupabaseServiceClient.update.mockResolvedValueOnce({
                error: null
            });

            const response = await request(app)
                .post('/webhooks/stripe')
                .set('stripe-signature', mockSignature)
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
            expect(mockSupabaseServiceClient.update).toHaveBeenCalledWith({
                plan: 'free',
                status: 'canceled',
                stripe_subscription_id: null,
                current_period_start: null,
                current_period_end: null,
                cancel_at_period_end: false,
                trial_end: null
            });
        });

        it('should return error for invalid webhook signature', async () => {
            mockStripe.webhooks.constructEvent.mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            const response = await request(app)
                .post('/webhooks/stripe')
                .set('stripe-signature', 'invalid-signature')
                .send(Buffer.from('{}'))
                .expect(400);

            expect(response.text).toContain('Webhook Error: Invalid signature');
        });

        it('should handle unrecognized webhook events', async () => {
            const mockEvent = {
                id: 'evt_test123',
                type: 'unknown.event.type',
                data: { object: {} }
            };

            mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

            const response = await request(app)
                .post('/webhooks/stripe')
                .set('stripe-signature', mockSignature)
                .send(Buffer.from(JSON.stringify(mockEvent)))
                .expect(200);

            expect(response.body.received).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle Stripe API errors gracefully', async () => {
            mockStripe.customers.create.mockRejectedValueOnce(
                new Error('Stripe API Error')
            );

            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: null
            });

            const response = await request(app)
                .post('/api/billing/create-checkout-session')
                .send({ lookupKey: 'pro_monthly' })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to create checkout session');
        });

        it('should handle database errors', async () => {
            mockSupabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Database connection failed' }
            });

            const response = await request(app)
                .get('/api/billing/subscription')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to fetch subscription');
        });
    });

    describe('Authentication', () => {
        it('should require authentication for protected routes', async () => {
            mockAuthenticateToken.mockImplementation((req, res, next) => {
                res.status(401).json({ error: 'Unauthorized' });
            });

            const protectedRoutes = [
                '/api/billing/create-checkout-session',
                '/api/billing/create-portal-session', 
                '/api/billing/subscription'
            ];

            for (const route of protectedRoutes) {
                const response = await request(app)
                    .post(route)
                    .expect(401);

                expect(response.body.error).toBe('Unauthorized');
            }
        });
    });
});