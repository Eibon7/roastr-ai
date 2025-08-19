/**
 * Billing webhook edge cases tests
 * Tests complex scenarios: disputes, partial payments, grace periods, etc.
 */

const request = require('supertest');
const express = require('express');
const billingRoutes = require('../../../src/routes/billing');
const { flags } = require('../../../src/config/flags');

// Create test app
const app = express();
app.use(express.json());
app.use(express.raw({ type: 'application/json' })); // For webhook endpoint
app.use('/api/billing', billingRoutes);

// Mock dependencies
const mockStripe = {
    customers: { create: jest.fn(), retrieve: jest.fn() },
    prices: { list: jest.fn() },
    subscriptions: { retrieve: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
    billingPortal: { sessions: { create: jest.fn() } },
    webhooks: { constructEvent: jest.fn() },
    balance: { retrieve: jest.fn() }
};
jest.mock('stripe', () => jest.fn(() => mockStripe));

const mockSupabaseServiceClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn()
};
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: mockSupabaseServiceClient,
    createUserClient: jest.fn()
}));

const mockQueueService = {
    initialize: jest.fn(),
    addJob: jest.fn()
};
jest.mock('../../../src/services/queueService', () => jest.fn(() => mockQueueService));

const mockAuthenticateToken = jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
});
jest.mock('../../../src/middleware/auth', () => ({ authenticateToken: mockAuthenticateToken }));

jest.mock('../../../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock('../../../src/config/flags');

describe('Billing Webhook Edge Cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        flags.isEnabled = jest.fn().mockImplementation((flag) => {
            return flag === 'ENABLE_BILLING';
        });

        // Setup default environment
        process.env.STRIPE_SECRET_KEY = 'sk_test_mock123';
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock123';
    });

    describe('Disputed Payments', () => {
        it('should handle charge.dispute.created webhook', async () => {
            const disputeEvent = {
                id: 'evt_dispute_123',
                type: 'charge.dispute.created',
                data: {
                    object: {
                        id: 'dp_dispute123',
                        charge: 'ch_charge123',
                        amount: 2000,
                        currency: 'eur',
                        reason: 'fraudulent',
                        status: 'warning_needs_response',
                        customer: 'cus_customer123'
                    }
                }
            };

            mockStripe.webhooks.constructEvent.mockReturnValue(disputeEvent);
            mockSupabaseServiceClient.single.mockResolvedValue({
                data: { user_id: 'user-123', plan: 'pro' },
                error: null
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test-signature')
                .send(JSON.stringify(disputeEvent));

            expect(response.status).toBe(200);
            expect(response.body.received).toBe(true);

            // Should log unhandled event type since we don't specifically handle disputes yet
            expect(mockQueueService.addJob).not.toHaveBeenCalled();
        });
    });

    describe('Partial Payment Scenarios', () => {
        it('should handle invoice with partial payment attempt', async () => {
            const partialPaymentEvent = {
                id: 'evt_partial_123',
                type: 'invoice.payment_failed',
                data: {
                    object: {
                        id: 'in_partial123',
                        customer: 'cus_customer123',
                        amount_due: 2000,
                        amount_paid: 1000, // Partial payment
                        amount_remaining: 1000,
                        status: 'open',
                        attempt_count: 2
                    }
                }
            };

            mockStripe.webhooks.constructEvent.mockReturnValue(partialPaymentEvent);
            mockSupabaseServiceClient.single.mockResolvedValue({
                data: { user_id: 'user-123', plan: 'pro' },
                error: null
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test-signature')
                .send(JSON.stringify(partialPaymentEvent));

            expect(response.status).toBe(200);
            
            // Verify billing job was queued with partial payment data
            expect(mockQueueService.addJob).toHaveBeenCalledWith({
                job_type: 'payment_failed',
                data: {
                    userId: 'user-123',
                    customerId: 'cus_customer123',
                    invoiceId: 'in_partial123',
                    amount: 2000,
                    attemptCount: 0
                },
                priority: 2,
                organization_id: null
            });
        });
    });

    describe('Grace Period Scenarios', () => {
        it('should handle subscription in grace period', async () => {
            const gracePeriodEvent = {
                id: 'evt_grace_123',
                type: 'customer.subscription.updated',
                data: {
                    object: {
                        id: 'sub_grace123',
                        customer: 'cus_customer123',
                        status: 'past_due',
                        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 3, // 3 days from now
                        cancel_at_period_end: false,
                        items: {
                            data: [{
                                price: { id: 'price_pro123' }
                            }]
                        }
                    }
                }
            };

            mockStripe.webhooks.constructEvent.mockReturnValue(gracePeriodEvent);
            mockSupabaseServiceClient.single.mockResolvedValue({
                data: { user_id: 'user-123', plan: 'free' },
                error: null
            });
            
            // Mock price lookup for plan determination
            mockStripe.prices.list.mockResolvedValue({
                data: [{
                    id: 'price_pro123',
                    lookup_key: 'pro_monthly'
                }]
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test-signature')
                .send(JSON.stringify(gracePeriodEvent));

            expect(response.status).toBe(200);
            
            // Verify subscription update job queued with grace period status
            expect(mockQueueService.addJob).toHaveBeenCalledWith({
                job_type: 'subscription_updated',
                data: {
                    userId: 'user-123',
                    customerId: 'cus_customer123',
                    subscriptionId: 'sub_grace123',
                    newPlan: 'pro',
                    newStatus: 'past_due'
                },
                priority: 2,
                organization_id: null
            });
        });
    });

    describe('High-Volume Payment Failures', () => {
        it('should handle rapid successive payment failures', async () => {
            const failureEvents = Array.from({ length: 5 }, (_, i) => ({
                id: `evt_rapid_${i}`,
                type: 'invoice.payment_failed',
                data: {
                    object: {
                        id: `in_rapid_${i}`,
                        customer: 'cus_customer123',
                        amount_due: 2000,
                        attempt_count: i + 1,
                        next_payment_attempt: Math.floor(Date.now() / 1000) + 86400
                    }
                }
            }));

            mockSupabaseServiceClient.single.mockResolvedValue({
                data: { user_id: 'user-123', plan: 'pro' },
                error: null
            });

            // Test each failure event
            for (let i = 0; i < failureEvents.length; i++) {
                mockStripe.webhooks.constructEvent.mockReturnValue(failureEvents[i]);

                const response = await request(app)
                    .post('/api/billing/webhooks/stripe')
                    .set('stripe-signature', 'test-signature')
                    .send(JSON.stringify(failureEvents[i]));

                expect(response.status).toBe(200);
            }

            // Should have queued 5 payment failure jobs
            expect(mockQueueService.addJob).toHaveBeenCalledTimes(5);
        });
    });

    describe('Subscription Downgrade Scenarios', () => {
        it('should handle immediate downgrade to free plan', async () => {
            const downgradeEvent = {
                id: 'evt_downgrade_123',
                type: 'customer.subscription.updated',
                data: {
                    object: {
                        id: 'sub_downgrade123',
                        customer: 'cus_customer123',
                        status: 'active',
                        cancel_at_period_end: true,
                        current_period_end: Math.floor(Date.now() / 1000) + 86400, // Ends in 1 day
                        items: {
                            data: [{
                                price: { id: 'price_free123' }
                            }]
                        }
                    }
                }
            };

            mockStripe.webhooks.constructEvent.mockReturnValue(downgradeEvent);
            mockSupabaseServiceClient.single.mockResolvedValue({
                data: { user_id: 'user-123', plan: 'creator_plus' },
                error: null
            });
            
            // Mock price lookup - no matching lookup key means free plan
            mockStripe.prices.list.mockResolvedValue({
                data: [{
                    id: 'price_free123',
                    lookup_key: 'free_plan'
                }]
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test-signature')
                .send(JSON.stringify(downgradeEvent));

            expect(response.status).toBe(200);
            
            // Verify downgrade job queued
            expect(mockQueueService.addJob).toHaveBeenCalledWith({
                job_type: 'subscription_updated',
                data: {
                    userId: 'user-123',
                    customerId: 'cus_customer123',
                    subscriptionId: 'sub_downgrade123',
                    newPlan: 'free',
                    newStatus: 'active'
                },
                priority: 2,
                organization_id: null
            });
        });
    });

    describe('3D Secure Authentication', () => {
        it('should handle invoice requiring 3D Secure authentication', async () => {
            const actionRequiredEvent = {
                id: 'evt_3ds_123',
                type: 'invoice.payment_action_required',
                data: {
                    object: {
                        id: 'in_3ds123',
                        customer: 'cus_customer123',
                        amount_due: 2000,
                        payment_intent: 'pi_3ds_intent123',
                        status: 'open'
                    }
                }
            };

            mockStripe.webhooks.constructEvent.mockReturnValue(actionRequiredEvent);
            mockSupabaseServiceClient.single.mockResolvedValue({
                data: { user_id: 'user-123', plan: 'pro' },
                error: null
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test-signature')
                .send(JSON.stringify(actionRequiredEvent));

            expect(response.status).toBe(200);
            
            // Verify 3D Secure job queued
            expect(mockQueueService.addJob).toHaveBeenCalledWith({
                job_type: 'invoice_payment_action_required',
                data: {
                    userId: 'user-123',
                    customerId: 'cus_customer123',
                    invoiceId: 'in_3ds123',
                    paymentIntentId: 'pi_3ds_intent123'
                },
                priority: 2,
                organization_id: null
            });
        });
    });

    describe('Webhook Signature Validation', () => {
        it('should reject webhook with invalid signature', async () => {
            const event = {
                id: 'evt_invalid_sig',
                type: 'invoice.payment_failed',
                data: { object: { id: 'test' } }
            };

            mockStripe.webhooks.constructEvent.mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'invalid-signature')
                .send(JSON.stringify(event));

            expect(response.status).toBe(400);
            expect(response.text).toContain('Webhook Error: Invalid signature');
        });

        it('should handle missing user for webhook event gracefully', async () => {
            const event = {
                id: 'evt_no_user',
                type: 'invoice.payment_failed',
                data: {
                    object: {
                        id: 'in_no_user',
                        customer: 'cus_nonexistent'
                    }
                }
            };

            mockStripe.webhooks.constructEvent.mockReturnValue(event);
            mockSupabaseServiceClient.single.mockResolvedValue({
                data: null,
                error: { message: 'User not found' }
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test-signature')
                .send(JSON.stringify(event));

            expect(response.status).toBe(200);
            
            // Job should still be queued with null userId for BillingWorker to handle
            expect(mockQueueService.addJob).toHaveBeenCalledWith({
                job_type: 'payment_failed',
                data: {
                    userId: null,
                    customerId: 'cus_nonexistent',
                    invoiceId: 'in_no_user',
                    amount: undefined,
                    attemptCount: 0
                },
                priority: 2,
                organization_id: null
            });
        });
    });

    describe('Queue Service Fallback', () => {
        it('should fallback to synchronous processing when queue fails', async () => {
            const event = {
                id: 'evt_queue_fail',
                type: 'invoice.payment_succeeded',
                data: {
                    object: {
                        id: 'in_queue_fail',
                        customer: 'cus_customer123',
                        amount_paid: 2000
                    }
                }
            };

            mockStripe.webhooks.constructEvent.mockReturnValue(event);
            mockSupabaseServiceClient.single.mockResolvedValue({
                data: { user_id: 'user-123' },
                error: null
            });
            mockSupabaseServiceClient.update.mockResolvedValue({ error: null });
            
            // Mock queue service failure
            mockQueueService.addJob.mockRejectedValue(new Error('Queue unavailable'));

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test-signature')
                .send(JSON.stringify(event));

            expect(response.status).toBe(200);
            
            // Should have attempted to queue job
            expect(mockQueueService.addJob).toHaveBeenCalled();
            
            // Should have fallen back to synchronous processing
            expect(mockSupabaseServiceClient.update).toHaveBeenCalledWith({
                status: 'active',
                updated_at: expect.any(String)
            });
        });
    });

    describe('Concurrent Webhook Processing', () => {
        it('should handle concurrent webhooks for same customer', async () => {
            const concurrentEvents = [
                {
                    id: 'evt_concurrent_1',
                    type: 'invoice.payment_failed',
                    data: {
                        object: {
                            id: 'in_concurrent_1',
                            customer: 'cus_customer123',
                            amount_due: 2000
                        }
                    }
                },
                {
                    id: 'evt_concurrent_2',
                    type: 'customer.subscription.updated',
                    data: {
                        object: {
                            id: 'sub_concurrent_2',
                            customer: 'cus_customer123',
                            status: 'past_due'
                        }
                    }
                }
            ];

            mockSupabaseServiceClient.single.mockResolvedValue({
                data: { user_id: 'user-123', plan: 'pro' },
                error: null
            });

            // Process concurrent webhooks
            const promises = concurrentEvents.map(event => {
                mockStripe.webhooks.constructEvent.mockReturnValue(event);
                
                return request(app)
                    .post('/api/billing/webhooks/stripe')
                    .set('stripe-signature', 'test-signature')
                    .send(JSON.stringify(event));
            });

            const responses = await Promise.all(promises);

            // Both should succeed
            expect(responses[0].status).toBe(200);
            expect(responses[1].status).toBe(200);
            
            // Both jobs should be queued
            expect(mockQueueService.addJob).toHaveBeenCalledTimes(2);
        });
    });
});