/**
 * End-to-End Tests for Polar Payment Flow (Issue #594)
 *
 * Verifies the complete flow:
 * 1. User creates checkout session
 * 2. Polar processes payment (simulated via webhook)
 * 3. Webhook updates subscription in database
 * 4. Entitlements are updated based on plan
 * 5. User can access features according to their plan
 *
 * Related: Issue #594, #808
 */

const request = require('supertest');
const crypto = require('crypto');
const express = require('express');
const { supabaseServiceClient } = require('../../src/config/supabase');
const checkoutRouter = require('../../src/routes/checkout');
const polarWebhookRouter = require('../../src/routes/polarWebhook');
const EntitlementsService = require('../../src/services/entitlementsService');

// Mock Polar SDK
jest.mock('@polar-sh/sdk', () => {
    return {
        Polar: jest.fn().mockImplementation(() => ({
            checkouts: {
                create: jest.fn().mockResolvedValue({
                    id: 'checkout_test_123',
                    url: 'https://polar.sh/checkout/test',
                    customerEmail: 'test@example.com',
                    productPriceId: 'price_pro_456',
                    status: 'open'
                }),
                get: jest.fn().mockResolvedValue({
                    id: 'checkout_test_123',
                    status: 'confirmed',
                    customerEmail: 'test@example.com',
                    productPriceId: 'price_pro_456',
                    amount: 1500,
                    currency: 'EUR'
                })
            }
        }))
    };
});

// Mock dependencies
jest.mock('../../src/config/supabase');
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/stripeWrapper', () => {
    // Mock StripeWrapper to prevent initialization errors
    return jest.fn().mockImplementation(() => ({
        prices: {
            retrieve: jest.fn()
        }
    }));
});
jest.mock('../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn().mockReturnValue(true)
    }
}));

describe('Polar E2E Flow - Checkout to Entitlements', () => {
    let app;
    let mockSupabaseFrom;
    let mockSupabaseSelect;
    let mockSupabaseUpsert;
    let mockSupabaseEq;
    let mockSupabaseSingle;
    let entitlementsService;

    const testUser = {
        id: 'user_e2e_test_123',
        email: 'e2e@test.com'
    };

    const testPriceId = 'price_pro_456';

    beforeAll(() => {
        // Set required env vars
        process.env.POLAR_ACCESS_TOKEN = 'test_token_e2e';
        process.env.POLAR_SUCCESS_URL = 'https://app.roastr.ai/success';
        process.env.POLAR_ALLOWED_PRICE_IDS = testPriceId;
        process.env.POLAR_PRO_PRICE_ID = testPriceId;
        // No webhook secret for easier testing
        delete process.env.POLAR_WEBHOOK_SECRET;
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup Express app with both routers
        app = express();
        app.use(express.json());
        app.use('/api', checkoutRouter);
        app.use('/api/polar/webhook', polarWebhookRouter);

        // Mock Supabase chains
        mockSupabaseSingle = jest.fn().mockResolvedValue({
            data: null,
            error: null
        });
        mockSupabaseEq = jest.fn(() => ({ single: mockSupabaseSingle }));
        mockSupabaseSelect = jest.fn(() => ({ eq: mockSupabaseEq }));
        mockSupabaseUpsert = jest.fn().mockResolvedValue({
            data: [{
                user_id: testUser.id,
                plan_name: 'pro',
                analysis_limit_monthly: 1000
            }],
            error: null
        });

        mockSupabaseFrom = jest.fn((table) => ({
            select: mockSupabaseSelect,
            upsert: mockSupabaseUpsert,
            eq: mockSupabaseEq
        }));

        supabaseServiceClient.from = mockSupabaseFrom;

        // Instantiate EntitlementsService
        entitlementsService = new EntitlementsService();
    });

    afterAll(() => {
        delete process.env.POLAR_ACCESS_TOKEN;
        delete process.env.POLAR_SUCCESS_URL;
        delete process.env.POLAR_ALLOWED_PRICE_IDS;
        delete process.env.POLAR_PRO_PRICE_ID;
    });

    describe('Full Flow: Checkout → Payment → Webhook → Entitlements', () => {
        it('should complete entire flow from checkout to entitlements update', async () => {
            // STEP 1: User creates checkout session
            const checkoutRes = await request(app)
                .post('/api/checkout')
                .send({
                    customer_email: testUser.email,
                    price_id: testPriceId,
                    metadata: {
                        user_id: testUser.id
                    }
                });

            expect(checkoutRes.status).toBe(200);
            expect(checkoutRes.body.success).toBe(true);
            expect(checkoutRes.body.checkout.url).toContain('polar.sh');

            const checkoutId = checkoutRes.body.checkout.id;

            // STEP 2: Simulate Polar webhook for order.created
            const webhookPayload = {
                type: 'order.created',
                id: `evt_${Date.now()}`,
                data: {
                    id: 'order_test_123',
                    user_id: testUser.id,
                    user_email: testUser.email,
                    product: {
                        id: 'prod_pro',
                        name: 'Roastr Pro Plan'
                    },
                    product_price: {
                        id: testPriceId,
                        price_amount: 1500,
                        price_currency: 'EUR'
                    },
                    subscription: {
                        id: 'sub_test_123',
                        status: 'active',
                        current_period_start: new Date().toISOString(),
                        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                    }
                }
            };

            const webhookRes = await request(app)
                .post('/api/polar/webhook')
                .send(webhookPayload);

            expect(webhookRes.status).toBe(200);
            expect(webhookRes.body.received).toBe(true);

            // Verify subscription was created/updated
            expect(mockSupabaseUpsert).toHaveBeenCalled();
            const subscriptionCall = mockSupabaseUpsert.mock.calls.find(call =>
                call[0].polar_subscription_id === 'sub_test_123'
            );
            expect(subscriptionCall).toBeDefined();
            expect(subscriptionCall[0].plan).toBe('pro');
            expect(subscriptionCall[0].status).toBe('active');

            // STEP 3: Verify entitlements can be set
            const entitlementsResult = await entitlementsService.setEntitlementsFromPolarPrice(
                testUser.id,
                testPriceId
            );

            expect(entitlementsResult.success).toBe(true);
            expect(entitlementsResult.source).toBe('polar_price');

            // Verify entitlements were persisted
            const entitlementsCall = mockSupabaseUpsert.mock.calls.find(call =>
                call[0].user_id === testUser.id && call[0].polar_price_id === testPriceId
            );
            expect(entitlementsCall).toBeDefined();
            expect(entitlementsCall[0].plan_name).toBe('pro');
            expect(entitlementsCall[0].analysis_limit_monthly).toBe(1000);
            expect(entitlementsCall[0].roast_limit_monthly).toBe(500);
        });

        it('should handle subscription.updated webhook and update entitlements', async () => {
            // Simulate subscription update webhook (e.g., plan upgrade)
            const webhookPayload = {
                type: 'subscription.updated',
                id: `evt_${Date.now()}`,
                data: {
                    id: 'sub_test_123',
                    user_id: testUser.id,
                    status: 'active',
                    product_price_id: testPriceId,
                    current_period_start: new Date().toISOString(),
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                }
            };

            const webhookRes = await request(app)
                .post('/api/polar/webhook')
                .send(webhookPayload);

            expect(webhookRes.status).toBe(200);

            // Verify subscription was updated
            expect(mockSupabaseUpsert).toHaveBeenCalled();
            const updateCall = mockSupabaseUpsert.mock.calls[0][0];
            expect(updateCall.polar_subscription_id).toBe('sub_test_123');
            expect(updateCall.plan).toBe('pro');
        });

        it('should handle subscription.canceled webhook', async () => {
            const webhookPayload = {
                type: 'subscription.canceled',
                id: `evt_${Date.now()}`,
                data: {
                    id: 'sub_test_123',
                    user_id: testUser.id,
                    status: 'canceled',
                    canceled_at: new Date().toISOString()
                }
            };

            const webhookRes = await request(app)
                .post('/api/polar/webhook')
                .send(webhookPayload);

            expect(webhookRes.status).toBe(200);

            // Verify subscription status was updated to canceled
            expect(mockSupabaseUpsert).toHaveBeenCalled();
            const cancelCall = mockSupabaseUpsert.mock.calls[0][0];
            expect(cancelCall.polar_subscription_id).toBe('sub_test_123');
            expect(cancelCall.status).toBe('canceled');
        });
    });

    describe('Error Handling in E2E Flow', () => {
        it('should reject checkout with invalid price_id', async () => {
            const invalidPriceId = 'price_unauthorized_123';

            const res = await request(app)
                .post('/api/checkout')
                .send({
                    customer_email: testUser.email,
                    price_id: invalidPriceId
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid price_id');
        });

        it('should handle webhook with missing user_id gracefully', async () => {
            const webhookPayload = {
                type: 'order.created',
                id: `evt_${Date.now()}`,
                data: {
                    id: 'order_missing_user',
                    // user_id missing
                    user_email: 'test@example.com',
                    product_price: {
                        id: testPriceId
                    }
                }
            };

            const res = await request(app)
                .post('/api/polar/webhook')
                .send(webhookPayload);

            // Should still return 200 to prevent retries
            expect(res.status).toBe(200);
        });

        it('should handle entitlements update failure gracefully', async () => {
            // Force database error
            mockSupabaseUpsert.mockResolvedValue({
                data: null,
                error: { message: 'Database connection failed' }
            });

            const result = await entitlementsService.setEntitlementsFromPolarPrice(
                testUser.id,
                testPriceId
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('Database');
        });
    });

    describe('Checkout Session Retrieval', () => {
        it('should retrieve checkout session by ID', async () => {
            const checkoutId = 'checkout_test_123';

            const res = await request(app)
                .get(`/api/checkout/${checkoutId}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.checkout.id).toBe(checkoutId);
            expect(res.body.checkout.status).toBe('confirmed');
        });
    });
});

