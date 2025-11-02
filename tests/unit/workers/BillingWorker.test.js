/**
 * BillingWorker unit tests
 * Tests billing job processing, retry logic, and notifications
 */

const BillingWorker = require('../../../src/workers/BillingWorker');
const emailService = require('../../../src/services/emailService');
const notificationService = require('../../../src/services/notificationService');
const auditLogService = require('../../../src/services/auditLogService');
const { flags } = require('../../../src/config/flags');

// Mock all dependencies
jest.mock('../../../src/services/emailService');
jest.mock('../../../src/services/notificationService');
jest.mock('../../../src/services/auditLogService');
jest.mock('../../../src/config/flags');
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(() => ({
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        }))
    }
}));

// Mock Stripe
const mockStripe = {
    customers: {
        create: jest.fn(),
        retrieve: jest.fn()
    },
    prices: {
        list: jest.fn()
    },
    balance: {
        retrieve: jest.fn()
    }
};
jest.mock('stripe', () => jest.fn(() => mockStripe));

// Mock Supabase
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn()
    },
    createUserClient: jest.fn()
}));

// Get reference to the mocked supabase client
const { supabaseServiceClient: mockSupabaseChain } = require('../../../src/config/supabase');

// Mock queue service
const mockQueueService = {
    initialize: jest.fn(),
    getNextJob: jest.fn(),
    completeJob: jest.fn(),
    failJob: jest.fn(),
    shutdown: jest.fn(),
    addJob: jest.fn(),
    scheduleJob: jest.fn()
};

describe('BillingWorker', () => {
    let billingWorker;

    afterAll(async () => {
        // Clean up any lingering resources
        if (billingWorker && billingWorker.queueService && billingWorker.queueService.shutdown) {
            await billingWorker.queueService.shutdown();
        }
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup default flag responses
        flags.isEnabled = jest.fn().mockImplementation((flag) => {
            return flag === 'ENABLE_BILLING';
        });

        // Create worker instance
        billingWorker = new BillingWorker();
        
        // Mock the queue service
        billingWorker.queueService = mockQueueService;
        
        // Mock the supabase client
        billingWorker.supabase = mockSupabaseChain;
    });

    describe('constructor', () => {
        it('should initialize worker with correct type and config', () => {
            expect(billingWorker.workerType).toBe('billing');
            expect(billingWorker.config.maxRetries).toBe(5);
            expect(billingWorker.config.maxConcurrency).toBe(2);
            expect(billingWorker.stripe).toBeDefined();
        });

        it('should initialize without Stripe when billing disabled', () => {
            flags.isEnabled.mockReturnValue(false);
            const worker = new BillingWorker();
            expect(worker.stripe).toBeNull();
        });
    });

    describe('processJob', () => {
        it('should route payment_failed jobs correctly', async () => {
            const job = {
                job_type: 'payment_failed',
                data: { userId: 'user-123', customerId: 'cus-123' }
            };

            billingWorker.processPaymentFailed = jest.fn().mockResolvedValue({ success: true });

            await billingWorker.processJob(job);

            expect(billingWorker.processPaymentFailed).toHaveBeenCalledWith(job);
        });

        it('should route subscription_cancelled jobs correctly', async () => {
            const job = {
                job_type: 'subscription_cancelled',
                data: { userId: 'user-123', customerId: 'cus-123' }
            };

            billingWorker.processSubscriptionCancelled = jest.fn().mockResolvedValue({ success: true });

            await billingWorker.processJob(job);

            expect(billingWorker.processSubscriptionCancelled).toHaveBeenCalledWith(job);
        });

        it('should throw error for unknown job type', async () => {
            const job = {
                job_type: 'unknown_type',
                data: {}
            };

            await expect(billingWorker.processJob(job)).rejects.toThrow('Unknown billing job type: unknown_type');
        });
    });

    describe('processPaymentFailed', () => {
        beforeEach(() => {
            mockSupabaseChain.single.mockResolvedValue({
                data: { user_id: 'user-123', plan: 'pro' },
                error: null
            });
            
            mockSupabaseChain.update.mockResolvedValue({ error: null });
            
            mockStripe.customers.retrieve.mockResolvedValue({
                email: 'user@example.com',
                name: 'Test User'
            });
            
            emailService.sendPaymentFailedNotification = jest.fn().mockResolvedValue();
            notificationService.createPaymentFailedNotification = jest.fn().mockResolvedValue();
            auditLogService.log = jest.fn().mockResolvedValue();
        });

        it('should process payment failure successfully', async () => {
            const job = {
                data: {
                    userId: 'user-123',
                    customerId: 'cus-123',
                    invoiceId: 'inv-123',
                    amount: 2000,
                    attemptCount: 0
                }
            };

            billingWorker.scheduleRetry = jest.fn().mockResolvedValue();

            const result = await billingWorker.processPaymentFailed(job);

            expect(result.success).toBe(true);
            expect(result.summary).toContain('Payment failed processed for user user-123');
            
            // Verify database update
            expect(mockSupabaseChain.update).toHaveBeenCalledWith({
                status: 'past_due',
                updated_at: expect.any(String)
            });

            // Verify notifications sent
            expect(emailService.sendPaymentFailedNotification).toHaveBeenCalledWith(
                'user@example.com',
                expect.objectContaining({
                    userName: 'Test User',
                    planName: 'Pro',
                    failedAmount: '€20.00',
                    attemptCount: 1
                })
            );

            expect(notificationService.createPaymentFailedNotification).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({
                    planName: 'Pro',
                    failedAmount: '€20.00',
                    attemptCount: 1
                })
            );

            // Verify audit logging
            expect(auditLogService.log).toHaveBeenCalledWith(
                'billing.payment_failed',
                'user-123',
                expect.objectContaining({
                    customerId: 'cus-123',
                    invoiceId: 'inv-123',
                    amount: 2000,
                    attemptCount: 1
                })
            );

            // Verify retry scheduled
            expect(billingWorker.scheduleRetry).toHaveBeenCalledWith(
                'billing_retry',
                expect.objectContaining({
                    attemptCount: 1,
                    originalJobType: 'payment_failed'
                }),
                expect.any(Number)
            );
        });

        it('should handle final payment failure after max retries', async () => {
            const job = {
                data: {
                    userId: 'user-123',
                    customerId: 'cus-123',
                    invoiceId: 'inv-123',
                    amount: 2000,
                    attemptCount: 3 // Exceeds max retries
                }
            };

            billingWorker.handleFinalPaymentFailure = jest.fn().mockResolvedValue();

            await billingWorker.processPaymentFailed(job);

            expect(billingWorker.handleFinalPaymentFailure).toHaveBeenCalledWith(
                'user-123',
                'cus-123',
                expect.objectContaining({ name: 'Pro' })
            );
        });

        it('should handle email service failures gracefully', async () => {
            const job = {
                data: {
                    userId: 'user-123',
                    customerId: 'cus-123',
                    invoiceId: 'inv-123',
                    amount: 2000,
                    attemptCount: 0
                }
            };

            emailService.sendPaymentFailedNotification = jest.fn().mockRejectedValue(new Error('Email failed'));
            billingWorker.scheduleRetry = jest.fn().mockResolvedValue();

            const result = await billingWorker.processPaymentFailed(job);

            expect(result.success).toBe(true);
            expect(notificationService.createPaymentFailedNotification).toHaveBeenCalled();
        });

        it('should throw error when user subscription not found', async () => {
            mockSupabaseChain.single.mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
            });

            const job = {
                data: {
                    userId: 'user-123',
                    customerId: 'cus-123',
                    invoiceId: 'inv-123',
                    amount: 2000
                }
            };

            await expect(billingWorker.processPaymentFailed(job))
                .rejects.toThrow('User subscription not found for customer: cus-123');
        });
    });

    describe('processSubscriptionCancelled', () => {
        beforeEach(() => {
            mockSupabaseChain.single.mockResolvedValue({
                data: { 
                    user_id: 'user-123', 
                    plan: 'pro',
                    current_period_end: '2024-12-31T00:00:00Z'
                },
                error: null
            });
            
            mockSupabaseChain.update.mockResolvedValue({ error: null });
            mockSupabaseChain.maybeSingle.mockResolvedValue({
                data: { id: 'org-123' },
                error: null
            });
            
            mockStripe.customers.retrieve.mockResolvedValue({
                email: 'user@example.com',
                name: 'Test User'
            });
            
            emailService.sendSubscriptionCanceledNotification = jest.fn().mockResolvedValue();
            notificationService.createSubscriptionCanceledNotification = jest.fn().mockResolvedValue();
            auditLogService.log = jest.fn().mockResolvedValue();
        });

        it('should process subscription cancellation successfully', async () => {
            const job = {
                data: {
                    userId: 'user-123',
                    customerId: 'cus-123',
                    subscriptionId: 'sub-123',
                    cancelReason: 'user_requested'
                }
            };

            const result = await billingWorker.processSubscriptionCancelled(job);

            expect(result.success).toBe(true);
            expect(result.summary).toContain('Subscription canceled for user user-123');
            
            // Verify user subscription reset to free
            expect(mockSupabaseChain.update).toHaveBeenCalledWith({
                plan: 'free',
                status: 'canceled',
                stripe_subscription_id: null,
                current_period_start: null,
                current_period_end: null,
                cancel_at_period_end: false,
                trial_end: null,
                updated_at: expect.any(String)
            });

            // Verify user limits updated
            expect(mockSupabaseChain.update).toHaveBeenCalledWith({
                plan: 'free',
                monthly_messages_sent: 0,
                monthly_tokens_consumed: 0,
                updated_at: expect.any(String)
            });

            // Verify organization limits updated
            expect(mockSupabaseChain.update).toHaveBeenCalledWith({
                plan_id: 'free',
                subscription_status: 'canceled',
                monthly_responses_limit: 100,
                updated_at: expect.any(String)
            });

            // Verify notifications sent
            expect(emailService.sendSubscriptionCanceledNotification).toHaveBeenCalledWith(
                'user@example.com',
                expect.objectContaining({
                    userName: 'Test User',
                    planName: 'Pro',
                    cancelReason: 'user_requested'
                })
            );

            expect(notificationService.createSubscriptionCanceledNotification).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({
                    planName: 'Pro',
                    cancelReason: 'user_requested'
                })
            );

            // Verify audit logging
            expect(auditLogService.log).toHaveBeenCalledWith(
                'billing.subscription_cancelled',
                'user-123',
                expect.objectContaining({
                    customerId: 'cus-123',
                    subscriptionId: 'sub-123',
                    oldPlan: 'pro',
                    newPlan: 'free',
                    cancelReason: 'user_requested'
                })
            );
        });
    });

    describe('processSubscriptionUpdated', () => {
        beforeEach(() => {
            mockSupabaseChain.single.mockResolvedValue({
                data: { user_id: 'user-123', plan: 'free' },
                error: null
            });
            
            mockSupabaseChain.update.mockResolvedValue({ error: null });
            
            mockStripe.customers.retrieve.mockResolvedValue({
                email: 'user@example.com',
                name: 'Test User'
            });
            
            emailService.sendUpgradeSuccessNotification = jest.fn().mockResolvedValue();
            auditLogService.log = jest.fn().mockResolvedValue();
        });

        it('should process subscription upgrade successfully', async () => {
            const job = {
                data: {
                    userId: 'user-123',
                    customerId: 'cus-123',
                    subscriptionId: 'sub-123',
                    newPlan: 'pro',
                    newStatus: 'active'
                }
            };

            const result = await billingWorker.processSubscriptionUpdated(job);

            expect(result.success).toBe(true);
            expect(result.summary).toContain('Subscription updated for user user-123');
            
            // Verify database update
            expect(mockSupabaseChain.update).toHaveBeenCalledWith({
                plan: 'pro',
                status: 'active',
                updated_at: expect.any(String)
            });

            // Verify upgrade email sent for plan change
            expect(emailService.sendUpgradeSuccessNotification).toHaveBeenCalledWith(
                'user@example.com',
                expect.objectContaining({
                    userName: 'Test User',
                    oldPlanName: 'Free',
                    newPlanName: 'Pro'
                })
            );

            // Verify audit logging
            expect(auditLogService.log).toHaveBeenCalledWith(
                'billing.subscription_updated',
                'user-123',
                expect.objectContaining({
                    customerId: 'cus-123',
                    subscriptionId: 'sub-123',
                    oldPlan: 'free',
                    newPlan: 'pro',
                    newStatus: 'active',
                    planChanged: true
                })
            );
        });

        it('should not send upgrade email when plan unchanged', async () => {
            mockSupabaseChain.single.mockResolvedValue({
                data: { user_id: 'user-123', plan: 'pro' },
                error: null
            });

            const job = {
                data: {
                    userId: 'user-123',
                    customerId: 'cus-123',
                    subscriptionId: 'sub-123',
                    newPlan: 'pro',
                    newStatus: 'active'
                }
            };

            await billingWorker.processSubscriptionUpdated(job);

            expect(emailService.sendUpgradeSuccessNotification).not.toHaveBeenCalled();
        });
    });

    describe('processPaymentSucceeded', () => {
        beforeEach(() => {
            mockSupabaseChain.update.mockResolvedValue({ error: null });
            auditLogService.log = jest.fn().mockResolvedValue();
        });

        it('should process payment success successfully', async () => {
            const job = {
                data: {
                    userId: 'user-123',
                    customerId: 'cus-123',
                    invoiceId: 'inv-123',
                    amount: 2000
                }
            };

            const result = await billingWorker.processPaymentSucceeded(job);

            expect(result.success).toBe(true);
            expect(result.summary).toContain('Payment succeeded for user user-123');
            
            // Verify subscription reactivated
            expect(mockSupabaseChain.update).toHaveBeenCalledWith({
                status: 'active',
                updated_at: expect.any(String)
            });

            // Verify audit logging
            expect(auditLogService.log).toHaveBeenCalledWith(
                'billing.payment_succeeded',
                'user-123',
                expect.objectContaining({
                    customerId: 'cus-123',
                    invoiceId: 'inv-123',
                    amount: 2000
                })
            );
        });
    });

    describe('processPaymentActionRequired', () => {
        beforeEach(() => {
            mockSupabaseChain.single.mockResolvedValue({
                data: { user_id: 'user-123', plan: 'pro' },
                error: null
            });
            
            mockStripe.customers.retrieve.mockResolvedValue({
                email: 'user@example.com',
                name: 'Test User'
            });
            
            notificationService.createPaymentActionRequiredNotification = jest.fn().mockResolvedValue();
            auditLogService.log = jest.fn().mockResolvedValue();
        });

        it('should process payment action required successfully', async () => {
            const job = {
                data: {
                    userId: 'user-123',
                    customerId: 'cus-123',
                    invoiceId: 'inv-123',
                    paymentIntentId: 'pi-123'
                }
            };

            const result = await billingWorker.processPaymentActionRequired(job);

            expect(result.success).toBe(true);
            expect(result.summary).toContain('Payment action required processed for user user-123');
            
            // Verify notification created
            expect(notificationService.createPaymentActionRequiredNotification).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({
                    planName: 'Pro',
                    paymentIntentId: 'pi-123'
                })
            );
        });
    });

    describe('calculateRetryDelay', () => {
        it('should calculate exponential backoff delay', () => {
            const delay1 = billingWorker.calculateRetryDelay(0);
            const delay2 = billingWorker.calculateRetryDelay(1);
            const delay3 = billingWorker.calculateRetryDelay(2);

            expect(delay1).toBe(3600000); // 1 hour base
            expect(delay2).toBe(7200000); // 2 hours
            expect(delay3).toBe(14400000); // 4 hours
        });

        it('should cap delay at maximum', () => {
            const delay = billingWorker.calculateRetryDelay(10); // Very high attempt
            expect(delay).toBe(86400000); // Capped at 24 hours
        });
    });

    describe('scheduleRetry', () => {
        it('should schedule retry job successfully', async () => {
            mockQueueService.scheduleJob.mockResolvedValue();

            await billingWorker.scheduleRetry('billing_retry', { userId: 'user-123' }, 3600000);

            expect(mockQueueService.scheduleJob).toHaveBeenCalledWith({
                job_type: 'billing_retry',
                data: { userId: 'user-123' },
                scheduled_for: expect.any(Date),
                priority: 2,
                organization_id: null
            });
        });

        it('should handle schedule retry failures', async () => {
            mockQueueService.scheduleJob.mockRejectedValue(new Error('Queue failed'));

            await expect(billingWorker.scheduleRetry('billing_retry', {}, 3600000))
                .rejects.toThrow('Queue failed');
        });
    });

    describe('getSpecificHealthDetails', () => {
        it('should return billing health details', async () => {
            mockStripe.balance.retrieve.mockResolvedValue({ available: [{ amount: 1000 }] });
            emailService.isConfigured = true;

            const details = await billingWorker.getSpecificHealthDetails();

            expect(details.billing).toEqual({
                stripeEnabled: true,
                emailServiceConfigured: true,
                retryConfig: billingWorker.retryConfig,
                stripeConnection: 'healthy'
            });
        });

        it('should detect unhealthy Stripe connection', async () => {
            mockStripe.balance.retrieve.mockRejectedValue(new Error('API error'));

            const details = await billingWorker.getSpecificHealthDetails();

            expect(details.billing.stripeConnection).toBe('unhealthy');
            expect(details.billing.stripeError).toBe('API error');
        });
    });

    describe('handleFinalPaymentFailure', () => {
        beforeEach(() => {
            mockSupabaseChain.update.mockResolvedValue({ error: null });
            mockStripe.customers.retrieve.mockResolvedValue({
                email: 'user@example.com',
                name: 'Test User'
            });
            
            notificationService.createSubscriptionSuspendedNotification = jest.fn().mockResolvedValue();
            auditLogService.log = jest.fn().mockResolvedValue();
        });

        it('should handle final payment failure correctly', async () => {
            const planConfig = { name: 'Pro' };

            await billingWorker.handleFinalPaymentFailure('user-123', 'cus-123', planConfig);

            // Verify subscription suspended
            expect(mockSupabaseChain.update).toHaveBeenCalledWith({
                plan: 'free',
                status: 'suspended',
                updated_at: expect.any(String)
            });

            // Verify suspension notification
            expect(notificationService.createSubscriptionSuspendedNotification).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({
                    planName: 'Pro',
                    reason: 'payment_failed_final'
                })
            );

            // Verify audit log
            expect(auditLogService.log).toHaveBeenCalledWith(
                'billing.subscription_suspended',
                'user-123',
                expect.objectContaining({
                    customerId: 'cus-123',
                    reason: 'payment_failed_final',
                    oldPlan: 'Pro',
                    newPlan: 'free'
                })
            );
        });
    });
});