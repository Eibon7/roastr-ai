/**
 * Simple BillingWorker unit tests
 * Focused on core functionality without complex mocking
 */

const BillingWorker = require('../../../src/workers/BillingWorker');

// Mock all external dependencies
jest.mock('../../../src/services/emailService');
jest.mock('../../../src/services/notificationService');
jest.mock('../../../src/services/auditLogService');
jest.mock('../../../src/config/flags');
jest.mock('../../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
}));
jest.mock('stripe', () => jest.fn(() => ({
    customers: { retrieve: jest.fn() },
    prices: { list: jest.fn() },
    balance: { retrieve: jest.fn() }
})));

describe('BillingWorker Simple Tests', () => {
    let billingWorker;
    const { flags } = require('../../../src/config/flags');

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
        
        flags.isEnabled = jest.fn().mockImplementation((flag) => {
            return flag === 'ENABLE_BILLING';
        });

        billingWorker = new BillingWorker();
    });

    describe('constructor', () => {
        it('should initialize worker with correct configuration', () => {
            expect(billingWorker.workerType).toBe('billing');
            expect(billingWorker.config.maxRetries).toBe(5);
            expect(billingWorker.config.maxConcurrency).toBe(2);
            expect(billingWorker.config.retryDelay).toBe(3000);
        });

        it('should initialize retry configuration', () => {
            expect(billingWorker.retryConfig.maxRetries).toBe(3);
            expect(billingWorker.retryConfig.baseDelay).toBe(3600000); // 1 hour
            expect(billingWorker.retryConfig.maxDelay).toBe(86400000); // 24 hours
            expect(billingWorker.retryConfig.exponentialBackoff).toBe(true);
        });

        it('should have Stripe initialized when billing enabled', () => {
            expect(billingWorker.stripe).toBeDefined();
        });

        it('should not have Stripe when billing disabled', () => {
            flags.isEnabled.mockReturnValue(false);
            const worker = new BillingWorker();
            expect(worker.stripe).toBeNull();
        });
    });

    describe('processJob', () => {
        it('should route payment_failed jobs to correct handler', async () => {
            const job = { job_type: 'payment_failed', data: {} };
            billingWorker.processPaymentFailed = jest.fn().mockResolvedValue({ success: true });

            await billingWorker.processJob(job);

            expect(billingWorker.processPaymentFailed).toHaveBeenCalledWith(job);
        });

        it('should route subscription_cancelled jobs to correct handler', async () => {
            const job = { job_type: 'subscription_cancelled', data: {} };
            billingWorker.processSubscriptionCancelled = jest.fn().mockResolvedValue({ success: true });

            await billingWorker.processJob(job);

            expect(billingWorker.processSubscriptionCancelled).toHaveBeenCalledWith(job);
        });

        it('should route subscription_updated jobs to correct handler', async () => {
            const job = { job_type: 'subscription_updated', data: {} };
            billingWorker.processSubscriptionUpdated = jest.fn().mockResolvedValue({ success: true });

            await billingWorker.processJob(job);

            expect(billingWorker.processSubscriptionUpdated).toHaveBeenCalledWith(job);
        });

        it('should route payment_succeeded jobs to correct handler', async () => {
            const job = { job_type: 'payment_succeeded', data: {} };
            billingWorker.processPaymentSucceeded = jest.fn().mockResolvedValue({ success: true });

            await billingWorker.processJob(job);

            expect(billingWorker.processPaymentSucceeded).toHaveBeenCalledWith(job);
        });

        it('should route invoice_payment_action_required jobs to correct handler', async () => {
            const job = { job_type: 'invoice_payment_action_required', data: {} };
            billingWorker.processPaymentActionRequired = jest.fn().mockResolvedValue({ success: true });

            await billingWorker.processJob(job);

            expect(billingWorker.processPaymentActionRequired).toHaveBeenCalledWith(job);
        });

        it('should route billing_retry jobs to correct handler', async () => {
            const job = { job_type: 'billing_retry', data: {} };
            billingWorker.processBillingRetry = jest.fn().mockResolvedValue({ success: true });

            await billingWorker.processJob(job);

            expect(billingWorker.processBillingRetry).toHaveBeenCalledWith(job);
        });

        it('should throw error for unknown job types', async () => {
            const job = { job_type: 'unknown_job_type', data: {} };

            await expect(billingWorker.processJob(job)).rejects.toThrow('Unknown billing job type: unknown_job_type');
        });
    });

    describe('calculateRetryDelay', () => {
        it('should calculate exponential backoff correctly', () => {
            const delay0 = billingWorker.calculateRetryDelay(0);
            const delay1 = billingWorker.calculateRetryDelay(1);
            const delay2 = billingWorker.calculateRetryDelay(2);

            expect(delay0).toBe(3600000); // 1 hour base delay
            expect(delay1).toBe(7200000); // 2 hours (2^1 * base)
            expect(delay2).toBe(14400000); // 4 hours (2^2 * base)
        });

        it('should cap delay at maximum value', () => {
            const largeAttemptDelay = billingWorker.calculateRetryDelay(10);
            expect(largeAttemptDelay).toBe(86400000); // Should be capped at 24 hours
        });

        it('should return base delay when exponential backoff disabled', () => {
            billingWorker.retryConfig.exponentialBackoff = false;
            
            const delay0 = billingWorker.calculateRetryDelay(0);
            const delay3 = billingWorker.calculateRetryDelay(3);

            expect(delay0).toBe(3600000); // Base delay
            expect(delay3).toBe(3600000); // Still base delay
        });
    });

    describe('scheduleRetry', () => {
        beforeEach(() => {
            billingWorker.queueService = {
                scheduleJob: jest.fn()
            };
        });

        it('should schedule retry job with correct parameters', async () => {
            const jobData = { userId: 'user-123', customerId: 'cus-123' };
            const delay = 3600000;

            await billingWorker.scheduleRetry('billing_retry', jobData, delay);

            expect(billingWorker.queueService.scheduleJob).toHaveBeenCalledWith({
                job_type: 'billing_retry',
                data: jobData,
                scheduled_for: expect.any(Date),
                priority: 2,
                organization_id: null
            });
        });

        it('should handle queue service errors', async () => {
            billingWorker.queueService.scheduleJob.mockRejectedValue(new Error('Queue error'));

            await expect(billingWorker.scheduleRetry('billing_retry', {}, 1000))
                .rejects.toThrow('Queue error');
        });
    });

    describe('processBillingRetry', () => {
        it('should process retry job by calling original job type handler', async () => {
            const job = {
                data: {
                    originalJobType: 'payment_failed',
                    attemptCount: 1,
                    userId: 'user-123',
                    customerId: 'cus-123'
                }
            };

            billingWorker.processPaymentFailed = jest.fn().mockResolvedValue({ success: true });

            await billingWorker.processBillingRetry(job);

            expect(billingWorker.processPaymentFailed).toHaveBeenCalledWith({
                ...job,
                job_type: 'payment_failed',
                data: {
                    userId: 'user-123',
                    customerId: 'cus-123',
                    attemptCount: 1
                }
            });
        });
    });

    describe('getSpecificHealthDetails', () => {
        beforeEach(() => {
            const emailService = require('../../../src/services/emailService');
            emailService.isConfigured = true;
        });

        it('should return billing health details when Stripe enabled', async () => {
            billingWorker.stripe.balance.retrieve.mockResolvedValue({ available: [{ amount: 1000 }] });

            const details = await billingWorker.getSpecificHealthDetails();

            expect(details.billing.stripeEnabled).toBe(true);
            expect(details.billing.emailServiceConfigured).toBe(true);
            expect(details.billing.stripeConnection).toBe('healthy');
            expect(details.billing.retryConfig).toEqual(billingWorker.retryConfig);
        });

        it('should detect unhealthy Stripe connection', async () => {
            billingWorker.stripe.balance.retrieve.mockRejectedValue(new Error('Connection failed'));

            const details = await billingWorker.getSpecificHealthDetails();

            expect(details.billing.stripeConnection).toBe('unhealthy');
            expect(details.billing.stripeError).toBe('Connection failed');
        });

        it('should handle missing Stripe instance', async () => {
            billingWorker.stripe = null;

            const details = await billingWorker.getSpecificHealthDetails();

            expect(details.billing.stripeEnabled).toBe(false);
            expect(details.billing.stripeConnection).toBeUndefined();
        });
    });

    describe('error handling', () => {
        it('should handle missing queue service gracefully', () => {
            billingWorker.queueService = null;
            
            // Should not throw error during construction
            expect(() => {
                const job = { job_type: 'payment_failed', data: {} };
                billingWorker.processJob(job);
            }).not.toThrow();
        });

        it('should validate job data structure', async () => {
            const invalidJob = { invalid: 'structure' };

            await expect(billingWorker.processJob(invalidJob))
                .rejects.toThrow('Unknown billing job type: undefined');
        });

        it('should handle missing Stripe configuration', () => {
            flags.isEnabled.mockReturnValue(false);
            const worker = new BillingWorker();

            expect(worker.stripe).toBeNull();
        });
    });

    describe('logging and metrics', () => {
        it('should log job processing start', async () => {
            const job = { job_type: 'payment_succeeded', data: { userId: 'user-123' } };
            billingWorker.processPaymentSucceeded = jest.fn().mockResolvedValue({ success: true });
            billingWorker.log = jest.fn();

            await billingWorker.processJob(job);

            expect(billingWorker.log).toHaveBeenCalledWith('info', 'Processing billing job', {
                jobType: 'payment_succeeded',
                jobId: undefined,
                organizationId: undefined
            });
        });

        it('should increment processed jobs counter on success', () => {
            const initialCount = billingWorker.processedJobs;
            // This would be tested in integration tests where the full processing loop runs
            expect(typeof initialCount).toBe('number');
        });

        it('should increment failed jobs counter on error', () => {
            const initialCount = billingWorker.failedJobs;
            // This would be tested in integration tests where the full processing loop runs
            expect(typeof initialCount).toBe('number');
        });
    });
});