/**
 * Tests for billing webhook handlers
 */

const request = require('supertest');
const express = require('express');
const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock dependencies
jest.mock('stripe');
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/emailService');
jest.mock('../../../src/services/notificationService');
jest.mock('../../../src/services/workerNotificationService');
jest.mock('../../../src/services/queueService');
jest.mock('../../../src/services/subscriptionService');
jest.mock('../../../src/middleware/auth');
jest.mock('../../../src/config/flags');

describe('Billing Webhooks', () => {
    let app;
    let mockStripe;
    let mockSupabase;
    let mockEmailService;
    let mockNotificationService;
    let mockSubscriptionService;
    let mockQueueService;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup mock Stripe
        const Stripe = require('stripe');
        mockStripe = {
            customers: { create: jest.fn(), retrieve: jest.fn() },
            prices: { list: jest.fn() },
            checkout: { sessions: { create: jest.fn() } },
            billingPortal: { sessions: { create: jest.fn() } },
            subscriptions: { retrieve: jest.fn() },
            webhooks: { constructEvent: jest.fn() }
        };
        Stripe.mockReturnValue(mockStripe);

        // Setup mock Supabase
        mockSupabase = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn().mockReturnThis(),
            insert: jest.fn()
        };
        const { supabaseServiceClient } = require('../../../src/config/supabase');
        Object.assign(supabaseServiceClient, mockSupabase);

        // Setup mock services
        mockEmailService = require('../../../src/services/emailService');
        mockNotificationService = require('../../../src/services/notificationService');
        mockSubscriptionService = require('../../../src/services/subscriptionService');
        
        // Setup mock queue service
        mockQueueService = {
            initialize: jest.fn(),
            addJob: jest.fn().mockResolvedValue({ success: true })
        };
        const QueueService = require('../../../src/services/queueService');
        QueueService.mockImplementation(() => mockQueueService);

        // Setup feature flags
        const { flags } = require('../../../src/config/flags');
        flags.isEnabled = jest.fn().mockReturnValue(true);

        // Setup environment variables
        process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
        process.env.STRIPE_PRICE_LOOKUP_PRO = 'pro_monthly';
        process.env.STRIPE_PRICE_LOOKUP_CREATOR = 'creator_plus_monthly';

        // Create Express app with routes
        app = express();
        app.use(express.json());
        app.use(express.raw({ type: 'application/json' }));
        
        const billingRoutes = require('../../../src/routes/billing');
        app.use('/api/billing', billingRoutes);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('POST /api/billing/webhooks/stripe', () => {
        const webhookEndpoint = '/api/billing/webhooks/stripe';

        it('should handle subscription.updated event successfully', async () => {
            const mockSubscription = {
                id: 'sub_test123',
                customer: 'cus_test123',
                status: 'active',
                items: {
                    data: [{
                        price: {
                            id: 'price_test123',
                            lookup_key: 'pro_monthly'
                        }
                    }]
                },
                current_period_start: 1234567890,
                current_period_end: 1234567890,
                cancel_at_period_end: false
            };

            const mockEvent = {
                type: 'customer.subscription.updated',
                id: 'evt_test123',
                data: { object: mockSubscription }
            };

            // Mock webhook signature verification
            mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

            // Mock subscription service response
            mockSubscriptionService.processSubscriptionUpdate.mockResolvedValue({
                success: true,
                userId: 'user123',
                oldPlan: 'free',
                newPlan: 'pro',
                status: 'active'
            });

            const response = await request(app)
                .post(webhookEndpoint)
                .set('stripe-signature', 'test_sig')
                .send(JSON.stringify(mockEvent))
                .expect(200);

            expect(response.body).toEqual({ received: true });
            expect(mockQueueService.addJob).toHaveBeenCalledWith({
                job_type: 'subscription_updated',
                data: expect.objectContaining({
                    customerId: 'cus_test123',
                    subscriptionId: 'sub_test123',
                    newPlan: 'pro',
                    newStatus: 'active'
                }),
                priority: 2,
                organization_id: null
            });
        });

        it('should handle subscription.deleted event successfully', async () => {
            const mockSubscription = {
                id: 'sub_test123',
                customer: 'cus_test123',
                cancellation_details: { reason: 'cancellation_requested' }
            };

            const mockEvent = {
                type: 'customer.subscription.deleted',
                id: 'evt_test123',
                data: { object: mockSubscription }
            };

            mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
            
            // Mock user lookup
            mockSupabase.single.mockResolvedValue({
                data: { user_id: 'user123' },
                error: null
            });

            const response = await request(app)
                .post(webhookEndpoint)
                .set('stripe-signature', 'test_sig')
                .send(JSON.stringify(mockEvent))
                .expect(200);

            expect(response.body).toEqual({ received: true });
            expect(mockQueueService.addJob).toHaveBeenCalledWith({
                job_type: 'subscription_cancelled',
                data: expect.objectContaining({
                    userId: 'user123',
                    customerId: 'cus_test123',
                    subscriptionId: 'sub_test123',
                    cancelReason: 'cancellation_requested'
                }),
                priority: 2,
                organization_id: null
            });
        });

        it('should handle invalid webhook signature', async () => {
            mockStripe.webhooks.constructEvent.mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            const response = await request(app)
                .post(webhookEndpoint)
                .set('stripe-signature', 'invalid_sig')
                .send('{}')
                .expect(400);

            expect(response.text).toContain('Webhook Error: Invalid signature');
        });

        it('should handle checkout.session.completed event', async () => {
            const mockSession = {
                id: 'cs_test123',
                customer: 'cus_test123',
                subscription: 'sub_test123',
                metadata: {
                    user_id: 'user123',
                    lookup_key: 'pro_monthly'
                }
            };

            const mockEvent = {
                type: 'checkout.session.completed',
                id: 'evt_test123',
                data: { object: mockSession }
            };

            mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
            
            // Mock subscription retrieval
            mockStripe.subscriptions.retrieve.mockResolvedValue({
                id: 'sub_test123',
                status: 'active',
                current_period_start: 1234567890,
                current_period_end: 1234567890,
                cancel_at_period_end: false
            });

            // Mock customer retrieval
            mockStripe.customers.retrieve.mockResolvedValue({
                id: 'cus_test123',
                email: 'test@example.com',
                name: 'Test User'
            });

            // Mock database upsert
            mockSupabase.upsert.mockResolvedValue({ error: null });

            const response = await request(app)
                .post(webhookEndpoint)
                .set('stripe-signature', 'test_sig')
                .send(JSON.stringify(mockEvent))
                .expect(200);

            expect(response.body).toEqual({ received: true });
            expect(mockSupabase.upsert).toHaveBeenCalled();
            expect(mockEmailService.sendUpgradeSuccessNotification).toHaveBeenCalled();
            expect(mockNotificationService.createUpgradeSuccessNotification).toHaveBeenCalled();
        });

        it('should handle payment_failed event', async () => {
            const mockInvoice = {
                id: 'in_test123',
                customer: 'cus_test123',
                amount_due: 2000,
                attempt_count: 1
            };

            const mockEvent = {
                type: 'invoice.payment_failed',
                id: 'evt_test123',
                data: { object: mockInvoice }
            };

            mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
            
            // Mock user lookup
            mockSupabase.single.mockResolvedValue({
                data: { user_id: 'user123' },
                error: null
            });

            const response = await request(app)
                .post(webhookEndpoint)
                .set('stripe-signature', 'test_sig')
                .send(JSON.stringify(mockEvent))
                .expect(200);

            expect(response.body).toEqual({ received: true });
            expect(mockQueueService.addJob).toHaveBeenCalledWith({
                job_type: 'payment_failed',
                data: expect.objectContaining({
                    userId: 'user123',
                    customerId: 'cus_test123',
                    invoiceId: 'in_test123',
                    amount: 2000,
                    attemptCount: 0
                }),
                priority: 2,
                organization_id: null
            });
        });

        it('should fallback to sync processing if queue service fails', async () => {
            const mockSubscription = {
                id: 'sub_test123',
                customer: 'cus_test123',
                status: 'canceled'
            };

            const mockEvent = {
                type: 'customer.subscription.deleted',
                id: 'evt_test123',
                data: { object: mockSubscription }
            };

            mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
            
            // Make queue service fail
            mockQueueService.addJob.mockRejectedValue(new Error('Queue error'));
            
            // Mock user lookup for fallback
            mockSupabase.single.mockResolvedValue({
                data: { user_id: 'user123' },
                error: null
            });
            
            // Mock update for fallback
            mockSupabase.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });

            // Mock customer retrieval for fallback
            mockStripe.customers.retrieve.mockResolvedValue({
                id: 'cus_test123',
                email: 'test@example.com'
            });

            const response = await request(app)
                .post(webhookEndpoint)
                .set('stripe-signature', 'test_sig')
                .send(JSON.stringify(mockEvent))
                .expect(200);

            expect(response.body).toEqual({ received: true });
            expect(mockQueueService.addJob).toHaveBeenCalled();
            // Verify fallback was executed
            expect(mockSupabase.update).toHaveBeenCalled();
        });

        it('should handle billing disabled scenario', async () => {
            const { flags } = require('../../../src/config/flags');
            flags.isEnabled.mockReturnValue(false);

            const response = await request(app)
                .post(webhookEndpoint)
                .set('stripe-signature', 'test_sig')
                .send('{}')
                .expect(503);

            expect(response.body).toEqual({ error: 'Billing temporarily unavailable' });
        });
    });

    describe('Subscription Update Validation', () => {
        it('should block downgrade with exceeded usage', async () => {
            const mockSubscription = {
                id: 'sub_test123',
                customer: 'cus_test123',
                status: 'active',
                items: {
                    data: [{
                        price: {
                            id: 'price_test123',
                            lookup_key: 'free' // Downgrading to free
                        }
                    }]
                }
            };

            const mockEvent = {
                type: 'customer.subscription.updated',
                id: 'evt_test123',
                data: { object: mockSubscription }
            };

            mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

            // Mock subscription service to return blocked result
            mockSubscriptionService.processSubscriptionUpdate.mockResolvedValue({
                success: false,
                reason: 'Current monthly roasts (150) exceeds new plan limit (100)',
                warnings: ['You will lose access to priority support']
            });

            const response = await request(app)
                .post('/api/billing/webhooks/stripe')
                .set('stripe-signature', 'test_sig')
                .send(JSON.stringify(mockEvent))
                .expect(200);

            expect(response.body).toEqual({ received: true });
            expect(mockSubscriptionService.processSubscriptionUpdate).toHaveBeenCalled();
        });
    });
});

describe('Plan Validation Service', () => {
    const { isChangeAllowed, calculateProration } = require('../../../src/services/planValidation');

    describe('isChangeAllowed', () => {
        it('should allow all upgrades', async () => {
            const result = await isChangeAllowed('free', 'pro', {
                roastsThisMonth: 200,
                commentsThisMonth: 1000,
                activeIntegrations: 5
            });

            expect(result.allowed).toBe(true);
        });

        it('should block downgrade with exceeded roasts', async () => {
            const result = await isChangeAllowed('pro', 'free', {
                roastsThisMonth: 150,
                commentsThisMonth: 100,
                activeIntegrations: 1
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Current monthly roasts (150) exceeds new plan limit (100)');
        });

        it('should block downgrade with exceeded integrations', async () => {
            const result = await isChangeAllowed('creator_plus', 'pro', {
                roastsThisMonth: 500,
                commentsThisMonth: 1000,
                activeIntegrations: 7
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Active integrations (7) exceeds new plan limit (5)');
        });

        it('should provide warnings for lost features', async () => {
            const result = await isChangeAllowed('creator_plus', 'pro', {
                roastsThisMonth: 100,
                commentsThisMonth: 100,
                activeIntegrations: 3
            });

            expect(result.allowed).toBe(true);
            expect(result.warnings).toContain('You will lose access to team collaboration features');
            expect(result.warnings).toContain('You will lose access to custom style profiles');
        });
    });

    describe('calculateProration', () => {
        it('should calculate proration for mid-period upgrade', () => {
            const now = Date.now() / 1000;
            const periodEnd = now + (15 * 86400); // 15 days left

            const currentSubscription = {
                current_period_end: periodEnd,
                items: {
                    data: [{
                        price: { unit_amount: 2000 } // €20
                    }]
                }
            };

            const newPlan = { price: 5000 }; // €50

            const result = calculateProration(currentSubscription, newPlan);
            
            expect(result.amount).toBeGreaterThan(0);
            expect(result.description).toContain('15 days remaining');
        });

        it('should return zero proration for expired period', () => {
            const currentSubscription = {
                current_period_end: Date.now() / 1000 - 86400 // Yesterday
            };

            const result = calculateProration(currentSubscription, {});
            
            expect(result.amount).toBe(0);
            expect(result.description).toBe('No proration needed');
        });
    });
});