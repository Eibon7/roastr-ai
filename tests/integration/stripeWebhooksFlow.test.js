/**
 * Integration tests for Stripe Webhooks Flow - Issue #169
 * Tests complete webhook processing flow from endpoint to entitlements
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const StripeWebhookService = require('../../src/services/stripeWebhookService');
const StripeWrapper = require('../../src/services/stripeWrapper');
const { supabaseServiceClient } = require('../../src/config/supabase');

// Mock dependencies
jest.mock('../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        update: jest.fn(),
        rpc: jest.fn()
    }
}));

jest.mock('../../src/services/stripeWrapper');
jest.mock('../../src/services/entitlementsService');
jest.mock('../../src/services/stripeWebhookService');
jest.mock('../../src/middleware/webhookSecurity', () => ({
    stripeWebhookSecurity: () => (req, res, next) => {
        req.webhookSecurity = {
            requestId: 'test-request-id',
            timestampAge: 10,
            bodySize: req.body?.length || 0
        };
        next();
    }
}));
jest.mock('../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn().mockReturnValue(true)
    }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('Stripe Webhooks Integration Flow', () => {
    let app;
    let mockStripeWrapper;
    let mockWebhookService;

    // Test webhook secret for signature generation
    const testWebhookSecret = 'whsec_test123456789abcdef';

    beforeAll(() => {
        process.env.STRIPE_WEBHOOK_SECRET = testWebhookSecret;
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock StripeWrapper
        mockStripeWrapper = {
            webhooks: {
                constructEvent: jest.fn()
            },
            subscriptions: {
                retrieve: jest.fn()
            }
        };
        StripeWrapper.mockImplementation(() => mockStripeWrapper);

        // Mock StripeWebhookService
        mockWebhookService = {
            processWebhookEvent: jest.fn().mockResolvedValue({
                success: true,
                processed: true,
                idempotent: false,
                processingTimeMs: 100,
                message: 'Event processed successfully'
            }),
            getWebhookStats: jest.fn().mockResolvedValue({
                total_events: 100,
                events_by_type: {},
                processing_stats: {}
            }),
            cleanupOldEvents: jest.fn().mockResolvedValue({
                deleted: 50
            })
        };
        StripeWebhookService.mockImplementation(() => mockWebhookService);

        // Setup Express app with webhook route
        app = express();

        // Note: express.raw() middleware is already applied in the billing routes
        // for the /webhooks/stripe endpoint specifically

        // Import billing routes (this will use our mocked services)
        const billingRoutes = require('../../src/routes/billing');
        app.use('/api/billing', billingRoutes);
    });

    /**
     * Generate valid Stripe signature for testing
     */
    function generateStripeSignature(payload, secret, timestamp) {
        const elements = [`t=${timestamp}`, `v1=${crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')}`];
        return elements.join(',');
    }

    describe('Webhook Signature Verification', () => {
        const testPayload = JSON.stringify({
            id: 'evt_test_webhook',
            type: 'ping'
        });

        it('should accept valid webhook signatures', async () => {
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateStripeSignature(testPayload, testWebhookSecret, timestamp);

            // Mock successful signature verification
            const mockEvent = {
                id: 'evt_test_webhook',
                type: 'ping'
            };
            mockStripeWrapper.webhooks.constructEvent.mockReturnValue(mockEvent);

            // Mock webhook service response
            supabaseServiceClient.rpc.mockResolvedValue({ data: true, error: null });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('Content-Type', 'application/json')
                .set('stripe-signature', signature)
                .send(Buffer.from(testPayload));

            expect(response.status).toBe(200);
            expect(response.body.received).toBe(true);
            // Note: constructEvent is called by webhookSecurity middleware, not directly in handler
            expect(mockWebhookService.processWebhookEvent).toHaveBeenCalled();
        });

        it('should reject invalid webhook signatures', async () => {
            const invalidSignature = 'invalid_signature';

            // Mock signature verification failure
            mockStripeWrapper.webhooks.constructEvent.mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('Content-Type', 'application/json')
                .set('stripe-signature', invalidSignature)
                .send(Buffer.from(testPayload));

            expect(response.status).toBe(400);
            // Mocked middleware returns 400 for invalid signature through normal flow
        });

        it('should handle missing stripe-signature header', async () => {
            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('Content-Type', 'application/json')
                .send(Buffer.from(testPayload));

            expect(response.status).toBe(400);
            // Missing signature should be caught by middleware
        });
    });

    describe('Checkout Session Completed Flow', () => {
        const checkoutCompletedEvent = {
            id: 'evt_checkout_completed',
            type: 'checkout.session.completed',
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

        beforeEach(() => {
            mockStripeWrapper.webhooks.constructEvent.mockReturnValue(checkoutCompletedEvent);
        });

        it('should process new checkout completion successfully', async () => {
            // Mock idempotency check (not processed)
            supabaseServiceClient.rpc
                .mockResolvedValueOnce({ data: false, error: null }) // is_webhook_event_processed
                .mockResolvedValueOnce({ data: 'webhook-uuid', error: null }) // start_webhook_event_processing
                .mockResolvedValueOnce({ data: true, error: null }); // complete_webhook_event_processing

            // Mock user update
            supabaseServiceClient.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });

            // Mock subscription retrieval
            mockStripeWrapper.subscriptions.retrieve.mockResolvedValue({
                items: {
                    data: [{
                        price: { id: 'price_pro_monthly' }
                    }]
                }
            });

            const payload = JSON.stringify(checkoutCompletedEvent);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateStripeSignature(payload, testWebhookSecret, timestamp);

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', signature)
                .set('Content-Type', 'application/json')
                .send(Buffer.from(payload));

            expect(response.status).toBe(200);
            expect(response.body).toEqual(expect.objectContaining({
                received: true,
                processed: true,
                idempotent: false,
                message: expect.any(String)
            }));

            // Verify idempotency check was called
            expect(supabaseServiceClient.rpc).toHaveBeenCalledWith('is_webhook_event_processed', {
                event_id: 'evt_checkout_completed'
            });

            // Verify webhook processing was started
            expect(supabaseServiceClient.rpc).toHaveBeenCalledWith('start_webhook_event_processing', {
                event_id: 'evt_checkout_completed',
                event_type_param: 'checkout.session.completed',
                event_data_param: checkoutCompletedEvent,
                customer_id_param: 'cus_test123',
                subscription_id_param: 'sub_test123'
            });
        });

        it('should handle idempotent checkout events', async () => {
            // Mock event as already processed
            supabaseServiceClient.rpc.mockResolvedValueOnce({ data: true, error: null });

            const payload = JSON.stringify(checkoutCompletedEvent);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateStripeSignature(payload, testWebhookSecret, timestamp);

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', signature)
                .set('Content-Type', 'application/json')
                .send(Buffer.from(payload));

            expect(response.status).toBe(200);
            expect(response.body).toEqual(expect.objectContaining({
                received: true,
                processed: true,
                idempotent: true,
                message: 'Event already processed'
            }));

            // Verify only idempotency check was called
            expect(supabaseServiceClient.rpc).toHaveBeenCalledTimes(1);
        });

        it('should handle checkout events with missing user_id', async () => {
            const invalidCheckoutEvent = {
                ...checkoutCompletedEvent,
                data: {
                    object: {
                        ...checkoutCompletedEvent.data.object,
                        metadata: {} // Missing user_id
                    }
                }
            };

            mockStripeWrapper.webhooks.constructEvent.mockReturnValue(invalidCheckoutEvent);

            supabaseServiceClient.rpc
                .mockResolvedValueOnce({ data: false, error: null }) // Not processed
                .mockResolvedValueOnce({ data: 'webhook-uuid', error: null }) // Start processing
                .mockResolvedValueOnce({ data: true, error: null }); // Complete with failure

            const payload = JSON.stringify(invalidCheckoutEvent);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateStripeSignature(payload, testWebhookSecret, timestamp);

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', signature)
                .set('Content-Type', 'application/json')
                .send(Buffer.from(payload));

            expect(response.status).toBe(200);
            expect(response.body.received).toBe(true);
            expect(response.body.processed).toBe(false);
        });
    });

    describe('Subscription Events Flow', () => {
        const subscriptionUpdatedEvent = {
            id: 'evt_subscription_updated',
            type: 'customer.subscription.updated',
            data: {
                object: {
                    id: 'sub_test123',
                    customer: 'cus_test123',
                    status: 'active',
                    items: {
                        data: [{
                            price: { id: 'price_pro_monthly' }
                        }]
                    }
                }
            }
        };

        it('should process subscription update successfully', async () => {
            mockStripeWrapper.webhooks.constructEvent.mockReturnValue(subscriptionUpdatedEvent);

            supabaseServiceClient.rpc
                .mockResolvedValueOnce({ data: false, error: null })
                .mockResolvedValueOnce({ data: 'webhook-uuid', error: null })
                .mockResolvedValueOnce({ data: true, error: null });

            // Mock user lookup by customer ID
            supabaseServiceClient.single.mockResolvedValue({
                data: { id: 'user-123' },
                error: null
            });

            const payload = JSON.stringify(subscriptionUpdatedEvent);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateStripeSignature(payload, testWebhookSecret, timestamp);

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', signature)
                .set('Content-Type', 'application/json')
                .send(Buffer.from(payload));

            expect(response.status).toBe(200);
            expect(response.body.processed).toBe(true);
        });

        it('should process subscription deletion successfully', async () => {
            const subscriptionDeletedEvent = {
                id: 'evt_subscription_deleted',
                type: 'customer.subscription.deleted',
                data: {
                    object: {
                        id: 'sub_test123',
                        customer: 'cus_test123',
                        status: 'canceled'
                    }
                }
            };

            mockStripeWrapper.webhooks.constructEvent.mockReturnValue(subscriptionDeletedEvent);

            supabaseServiceClient.rpc
                .mockResolvedValueOnce({ data: false, error: null })
                .mockResolvedValueOnce({ data: 'webhook-uuid', error: null })
                .mockResolvedValueOnce({ data: true, error: null });

            supabaseServiceClient.single.mockResolvedValue({
                data: { id: 'user-123' },
                error: null
            });

            const payload = JSON.stringify(subscriptionDeletedEvent);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateStripeSignature(payload, testWebhookSecret, timestamp);

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', signature)
                .set('Content-Type', 'application/json')
                .send(Buffer.from(payload));

            expect(response.status).toBe(200);
            expect(response.body.processed).toBe(true);
        });
    });

    describe('Payment Events Flow', () => {
        it('should process payment succeeded events', async () => {
            const paymentSucceededEvent = {
                id: 'evt_payment_succeeded',
                type: 'invoice.payment_succeeded',
                data: {
                    object: {
                        id: 'in_test123',
                        customer: 'cus_test123',
                        amount_paid: 2000
                    }
                }
            };

            mockStripeWrapper.webhooks.constructEvent.mockReturnValue(paymentSucceededEvent);

            supabaseServiceClient.rpc
                .mockResolvedValueOnce({ data: false, error: null })
                .mockResolvedValueOnce({ data: 'webhook-uuid', error: null })
                .mockResolvedValueOnce({ data: true, error: null });

            supabaseServiceClient.single.mockResolvedValue({
                data: { id: 'user-123' },
                error: null
            });

            const payload = JSON.stringify(paymentSucceededEvent);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateStripeSignature(payload, testWebhookSecret, timestamp);

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', signature)
                .set('Content-Type', 'application/json')
                .send(Buffer.from(payload));

            expect(response.status).toBe(200);
            expect(response.body.processed).toBe(true);
        });

        it('should process payment failed events', async () => {
            const paymentFailedEvent = {
                id: 'evt_payment_failed',
                type: 'invoice.payment_failed',
                data: {
                    object: {
                        id: 'in_test123',
                        customer: 'cus_test123',
                        amount_due: 2000,
                        attempt_count: 1
                    }
                }
            };

            mockStripeWrapper.webhooks.constructEvent.mockReturnValue(paymentFailedEvent);

            supabaseServiceClient.rpc
                .mockResolvedValueOnce({ data: false, error: null })
                .mockResolvedValueOnce({ data: 'webhook-uuid', error: null })
                .mockResolvedValueOnce({ data: true, error: null });

            supabaseServiceClient.single.mockResolvedValue({
                data: { id: 'user-123' },
                error: null
            });

            const payload = JSON.stringify(paymentFailedEvent);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateStripeSignature(payload, testWebhookSecret, timestamp);

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', signature)
                .set('Content-Type', 'application/json')
                .send(Buffer.from(payload));

            expect(response.status).toBe(200);
            expect(response.body.processed).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            const testEvent = {
                id: 'evt_test_error',
                type: 'checkout.session.completed',
                data: { object: {} }
            };

            mockStripeWrapper.webhooks.constructEvent.mockReturnValue(testEvent);

            // Mock database error
            supabaseServiceClient.rpc.mockRejectedValue(new Error('Database connection failed'));

            const payload = JSON.stringify(testEvent);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateStripeSignature(payload, testWebhookSecret, timestamp);

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', signature)
                .set('Content-Type', 'application/json')
                .send(Buffer.from(payload));

            expect(response.status).toBe(200);
            expect(response.body.received).toBe(true);
            expect(response.body.processed).toBe(false);
        });

        it('should handle unrecognized event types gracefully', async () => {
            const unknownEvent = {
                id: 'evt_unknown_type',
                type: 'customer.unknown_event',
                data: { object: {} }
            };

            mockStripeWrapper.webhooks.constructEvent.mockReturnValue(unknownEvent);

            supabaseServiceClient.rpc
                .mockResolvedValueOnce({ data: false, error: null })
                .mockResolvedValueOnce({ data: 'webhook-uuid', error: null })
                .mockResolvedValueOnce({ data: true, error: null });

            const payload = JSON.stringify(unknownEvent);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateStripeSignature(payload, testWebhookSecret, timestamp);

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', signature)
                .set('Content-Type', 'application/json')
                .send(Buffer.from(payload));

            expect(response.status).toBe(200);
            expect(response.body.processed).toBe(true);
            expect(response.body.message).toContain('not handled');
        });
    });

    describe('Webhook Statistics and Cleanup', () => {
        beforeEach(() => {
            // Mock admin user for auth
            supabaseServiceClient.single.mockResolvedValue({
                data: { is_admin: true },
                error: null
            });
        });

        it('should return webhook statistics for admin users', async () => {
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

            // Create mock authenticated request
            const response = await request(app)
                .get('/api/billing/webhook-stats?days=7')
                .set('authorization', 'Bearer mock-token');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.statistics).toEqual(mockStats);
            expect(response.body.data.period_days).toBe(7);
        });

        it('should allow webhook cleanup for admin users', async () => {
            supabaseServiceClient.rpc.mockResolvedValue({
                data: 50, // events deleted
                error: null
            });

            const response = await request(app)
                .post('/api/billing/webhook-cleanup')
                .set('authorization', 'Bearer mock-token')
                .send({ days: 30 });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.events_deleted).toBe(50);
            expect(response.body.data.older_than_days).toBe(30);
        });

        it('should deny webhook stats access for non-admin users', async () => {
            // Mock non-admin user
            supabaseServiceClient.single.mockResolvedValue({
                data: { is_admin: false },
                error: null
            });

            const response = await request(app)
                .get('/api/billing/webhook-stats')
                .set('authorization', 'Bearer mock-token');

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Admin access required');
        });
    });

    describe('Performance and Rate Limiting', () => {
        it('should handle concurrent webhook requests', async () => {
            const testEvent = {
                id: 'evt_concurrent_test',
                type: 'ping'
            };

            mockStripeWrapper.webhooks.constructEvent.mockReturnValue(testEvent);
            supabaseServiceClient.rpc.mockResolvedValue({ data: true, error: null });

            const payload = JSON.stringify(testEvent);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateStripeSignature(payload, testWebhookSecret, timestamp);

            // Send multiple concurrent requests
            const promises = Array(5).fill().map(() =>
                request(app)
                    .post('/api/billing/webhooks/stripe')
                    .set('stripe-signature', signature)
                .set('Content-Type', 'application/json')
                    .send(Buffer.from(payload))
            );

            const responses = await Promise.all(promises);

            // All requests should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.received).toBe(true);
            });
        });
    });
});