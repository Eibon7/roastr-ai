/**
 * BillingWorker clean unit tests without complex mocking
 * Focus on functionality that can be tested without database calls
 */

// Mock the config flags first
const mockFlags = {
    isEnabled: jest.fn().mockReturnValue(true)
};
jest.mock('../../../src/config/flags', () => ({
    flags: mockFlags
}));

// Mock Stripe
const mockStripe = {
    customers: { retrieve: jest.fn() },
    prices: { list: jest.fn() },
    balance: { retrieve: jest.fn() }
};
jest.mock('stripe', () => jest.fn(() => mockStripe));

// Mock all services to prevent actual calls
jest.mock('../../../src/services/emailService', () => ({
    sendPaymentFailedNotification: jest.fn(),
    sendSubscriptionCanceledNotification: jest.fn(),
    sendUpgradeSuccessNotification: jest.fn(),
    isConfigured: true
}));

jest.mock('../../../src/services/notificationService', () => ({
    createPaymentFailedNotification: jest.fn(),
    createSubscriptionCanceledNotification: jest.fn(),
    createUpgradeSuccessNotification: jest.fn(),
    createPaymentActionRequiredNotification: jest.fn(),
    createSubscriptionSuspendedNotification: jest.fn()
}));

jest.mock('../../../src/services/auditLogService', () => ({
    log: jest.fn()
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

// Import after mocking
const BillingWorker = require('../../../src/workers/BillingWorker');

describe('BillingWorker Clean Tests', () => {
    let billingWorker;

    beforeAll(() => {
        // Set test environment
        process.env.NODE_ENV = 'test';
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Create worker instance
        billingWorker = new BillingWorker();
        
        // Mock the queue service to prevent real connections
        billingWorker.queueService = {
            scheduleJob: jest.fn().mockResolvedValue(true),
            addJob: jest.fn().mockResolvedValue(true)
        };
        
        // Mock supabase to prevent real database calls
        billingWorker.supabase = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            update: jest.fn().mockReturnThis(),
            upsert: jest.fn().mockResolvedValue({ error: null }),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
        };
    });

    afterEach(() => {
        // Clean up any timeouts or intervals
        if (billingWorker && billingWorker.healthCheckTimer) {
            clearInterval(billingWorker.healthCheckTimer);
        }
    });

    describe('Constructor', () => {
        it('should initialize with correct worker type', () => {
            expect(billingWorker.workerType).toBe('billing');
        });

        it('should have higher retry count for billing operations', () => {
            expect(billingWorker.config.maxRetries).toBe(5);
        });

        it('should have lower concurrency for billing safety', () => {
            expect(billingWorker.config.maxConcurrency).toBe(2);
        });

        it('should initialize retry configuration', () => {
            expect(billingWorker.retryConfig.maxRetries).toBe(3);
            expect(billingWorker.retryConfig.baseDelay).toBe(3600000); // 1 hour
            expect(billingWorker.retryConfig.maxDelay).toBe(86400000); // 24 hours
            expect(billingWorker.retryConfig.exponentialBackoff).toBe(true);
        });

        it('should initialize Stripe when billing enabled', () => {
            expect(billingWorker.stripe).toBeDefined();
        });

        it('should not initialize Stripe when billing disabled', () => {
            mockFlags.isEnabled.mockReturnValue(false);
            const worker = new BillingWorker();
            expect(worker.stripe).toBeNull();
            mockFlags.isEnabled.mockReturnValue(true); // Reset
        });
    });

    describe('Job Routing', () => {
        it('should route payment_failed jobs correctly', async () => {
            const job = { job_type: 'payment_failed', data: {} };
            billingWorker.processPaymentFailed = jest.fn().mockResolvedValue({ success: true });

            const result = await billingWorker.processJob(job);

            expect(billingWorker.processPaymentFailed).toHaveBeenCalledWith(job);
            expect(result.success).toBe(true);
        });

        it('should route subscription_cancelled jobs correctly', async () => {
            const job = { job_type: 'subscription_cancelled', data: {} };
            billingWorker.processSubscriptionCancelled = jest.fn().mockResolvedValue({ success: true });

            const result = await billingWorker.processJob(job);

            expect(billingWorker.processSubscriptionCancelled).toHaveBeenCalledWith(job);
            expect(result.success).toBe(true);
        });

        it('should route subscription_updated jobs correctly', async () => {
            const job = { job_type: 'subscription_updated', data: {} };
            billingWorker.processSubscriptionUpdated = jest.fn().mockResolvedValue({ success: true });

            const result = await billingWorker.processJob(job);

            expect(billingWorker.processSubscriptionUpdated).toHaveBeenCalledWith(job);
            expect(result.success).toBe(true);
        });

        it('should route payment_succeeded jobs correctly', async () => {
            const job = { job_type: 'payment_succeeded', data: {} };
            billingWorker.processPaymentSucceeded = jest.fn().mockResolvedValue({ success: true });

            const result = await billingWorker.processJob(job);

            expect(billingWorker.processPaymentSucceeded).toHaveBeenCalledWith(job);
            expect(result.success).toBe(true);
        });

        it('should route invoice_payment_action_required jobs correctly', async () => {
            const job = { job_type: 'invoice_payment_action_required', data: {} };
            billingWorker.processPaymentActionRequired = jest.fn().mockResolvedValue({ success: true });

            const result = await billingWorker.processJob(job);

            expect(billingWorker.processPaymentActionRequired).toHaveBeenCalledWith(job);
            expect(result.success).toBe(true);
        });

        it('should route billing_retry jobs correctly', async () => {
            const job = { job_type: 'billing_retry', data: {} };
            billingWorker.processBillingRetry = jest.fn().mockResolvedValue({ success: true });

            const result = await billingWorker.processJob(job);

            expect(billingWorker.processBillingRetry).toHaveBeenCalledWith(job);
            expect(result.success).toBe(true);
        });

        it('should throw error for unknown job types', async () => {
            const job = { job_type: 'unknown_job_type', data: {} };

            await expect(billingWorker.processJob(job)).rejects.toThrow('Unknown billing job type: unknown_job_type');
        });
    });

    describe('Retry Logic', () => {
        it('should calculate exponential backoff correctly', () => {
            const delay0 = billingWorker.calculateRetryDelay(0);
            const delay1 = billingWorker.calculateRetryDelay(1);
            const delay2 = billingWorker.calculateRetryDelay(2);

            expect(delay0).toBe(3600000); // 1 hour
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

    describe('Retry Scheduling', () => {
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

    describe('Retry Processing', () => {
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

    describe('Health Check', () => {
        it('should return billing health details when Stripe enabled', async () => {
            mockStripe.balance.retrieve.mockResolvedValue({ available: [{ amount: 1000 }] });

            const details = await billingWorker.getSpecificHealthDetails();

            expect(details.billing.stripeEnabled).toBe(true);
            expect(details.billing.emailServiceConfigured).toBe(true);
            expect(details.billing.stripeConnection).toBe('healthy');
            expect(details.billing.retryConfig).toEqual(billingWorker.retryConfig);
        });

        it('should detect unhealthy Stripe connection', async () => {
            mockStripe.balance.retrieve.mockRejectedValue(new Error('Connection failed'));

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

    describe('Error Handling', () => {
        it('should handle missing queue service gracefully', () => {
            billingWorker.queueService = null;
            
            // Should not throw error
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
            mockFlags.isEnabled.mockReturnValue(false);
            const worker = new BillingWorker();

            expect(worker.stripe).toBeNull();
            mockFlags.isEnabled.mockReturnValue(true); // Reset
        });
    });

    describe('Configuration Validation', () => {
        it('should have appropriate timeout for billing operations', () => {
            expect(billingWorker.config.retryDelay).toBe(3000); // 3 seconds
        });

        it('should have proper concurrency limits', () => {
            expect(billingWorker.config.maxConcurrency).toBe(2); // Low for safety
        });

        it('should have extended retry count', () => {
            expect(billingWorker.config.maxRetries).toBe(5); // Higher for billing
        });
    });
});