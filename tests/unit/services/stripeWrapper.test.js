/**
 * Unit tests for StripeWrapper retry logic and error handling
 * Tests Issue #112 requirements: 
 * - Retry with exponential backoff (3 attempts: 500ms → 1000ms → 2000ms)
 * - Differentiated logging for 4xx, 5xx, and 429 errors
 * - Protection against traffic spikes and transient failures
 */

const StripeWrapper = require('../../../src/services/stripeWrapper');
const { logger } = require('../../../src/utils/logger');

// Mock Stripe module
jest.mock('stripe');
const Stripe = require('stripe');

// Mock logger
jest.mock('../../../src/utils/logger');

describe('StripeWrapper', () => {
    let stripeWrapper;
    let mockStripe;
    let mockCustomers;
    let mockWebhooks;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock Stripe instance
        mockCustomers = {
            create: jest.fn(),
            retrieve: jest.fn(),
            update: jest.fn(),
            list: jest.fn()
        };

        mockWebhooks = {
            constructEvent: jest.fn()
        };

        mockStripe = {
            customers: mockCustomers,
            webhooks: mockWebhooks,
            subscriptions: {
                create: jest.fn(),
                retrieve: jest.fn(),
                update: jest.fn(),
                list: jest.fn(),
                cancel: jest.fn()
            },
            prices: {
                list: jest.fn(),
                retrieve: jest.fn()
            },
            checkout: {
                sessions: {
                    create: jest.fn(),
                    retrieve: jest.fn()
                }
            },
            billingPortal: {
                sessions: {
                    create: jest.fn()
                }
            },
            balance: {
                retrieve: jest.fn()
            }
        };

        Stripe.mockReturnValue(mockStripe);

        // Create wrapper instance
        stripeWrapper = new StripeWrapper('sk_test_123');
    });

    describe('Constructor', () => {
        it('should initialize with secret key', () => {
            expect(Stripe).toHaveBeenCalledWith('sk_test_123');
            expect(stripeWrapper.maxRetries).toBe(3);
            expect(stripeWrapper.baseDelay).toBe(500);
            expect(stripeWrapper.maxDelay).toBe(2000);
        });

        it('should throw error if no secret key provided', () => {
            expect(() => new StripeWrapper()).toThrow('Stripe secret key is required');
        });
    });

    describe('Exponential backoff calculation', () => {
        it('should calculate correct retry delays', () => {
            expect(stripeWrapper.calculateRetryDelay(0)).toBe(500);  // 500ms * 2^0 = 500ms
            expect(stripeWrapper.calculateRetryDelay(1)).toBe(1000); // 500ms * 2^1 = 1000ms  
            expect(stripeWrapper.calculateRetryDelay(2)).toBe(2000); // 500ms * 2^2 = 2000ms (capped)
            expect(stripeWrapper.calculateRetryDelay(3)).toBe(2000); // Capped at maxDelay
        });
    });

    describe('Error logging differentiation', () => {
        it('should log 429 rate limit errors correctly', () => {
            const error = { statusCode: 429, message: 'Rate limit exceeded', type: 'rate_limit_error' };
            stripeWrapper.logError(error, 'test_operation', 0);

            expect(logger.warn).toHaveBeenCalledWith(
                '🚦 Stripe rate limit hit - will retry with backoff',
                expect.objectContaining({
                    operation: 'test_operation',
                    attempt: 1,
                    statusCode: 429,
                    rateLimitType: 'stripe_api_limit',
                    nextRetryIn: 500
                })
            );
        });

        it('should log 4xx client errors correctly', () => {
            const error = { 
                statusCode: 400, 
                message: 'Bad request', 
                type: 'invalid_request_error',
                code: 'parameter_invalid',
                param: 'email'
            };
            stripeWrapper.logError(error, 'test_operation', 0);

            expect(logger.error).toHaveBeenCalledWith(
                '❌ Stripe client error (4xx) - check request validity',
                expect.objectContaining({
                    operation: 'test_operation',
                    statusCode: 400,
                    errorCategory: 'client_error',
                    retryRecommended: false,
                    stripeCode: 'parameter_invalid',
                    stripeParam: 'email'
                })
            );
        });

        it('should log 5xx server errors correctly', () => {
            const error = { statusCode: 500, message: 'Internal server error', type: 'api_error' };
            stripeWrapper.logError(error, 'test_operation', 1);

            expect(logger.error).toHaveBeenCalledWith(
                '⚠️ Stripe server error (5xx) - transient issue possible',
                expect.objectContaining({
                    operation: 'test_operation',
                    statusCode: 500,
                    errorCategory: 'server_error',
                    retryRecommended: true,
                    nextRetryIn: 1000 // Second retry
                })
            );
        });

        it('should log network errors correctly', () => {
            const error = { message: 'Network error', type: 'connection_error' };
            stripeWrapper.logError(error, 'test_operation', 0);

            expect(logger.error).toHaveBeenCalledWith(
                '🔌 Stripe request failed - network or connection issue',
                expect.objectContaining({
                    operation: 'test_operation',
                    errorCategory: 'network_error',
                    retryRecommended: true
                })
            );
        });
    });

    describe('Retry logic', () => {
        beforeEach(() => {
            // Mock sleep to make tests faster
            jest.spyOn(stripeWrapper, 'sleep').mockImplementation(() => Promise.resolve());
        });

        it('should succeed on first attempt', async () => {
            const mockResult = { id: 'cus_123', email: 'test@example.com' };
            mockCustomers.create.mockResolvedValueOnce(mockResult);

            const result = await stripeWrapper.customers.create({ email: 'test@example.com' });

            expect(result).toEqual(mockResult);
            expect(mockCustomers.create).toHaveBeenCalledTimes(1);
            expect(stripeWrapper.sleep).not.toHaveBeenCalled();
            expect(logger.debug).toHaveBeenCalledWith(
                '✅ Stripe customers.create succeeded on first try',
                expect.objectContaining({ 
                    context: expect.objectContaining({ email: 'test@example.com' })
                })
            );
        });

        it('should retry on 5xx errors and succeed on second attempt', async () => {
            const serverError = { statusCode: 500, message: 'Internal server error' };
            const mockResult = { id: 'cus_123', email: 'test@example.com' };

            mockCustomers.create
                .mockRejectedValueOnce(serverError)
                .mockResolvedValueOnce(mockResult);

            const result = await stripeWrapper.customers.create({ email: 'test@example.com' });

            expect(result).toEqual(mockResult);
            expect(mockCustomers.create).toHaveBeenCalledTimes(2);
            expect(stripeWrapper.sleep).toHaveBeenCalledWith(500);
            expect(logger.info).toHaveBeenCalledWith(
                '✅ Stripe customers.create succeeded after retries',
                expect.objectContaining({ attempt: 2 })
            );
        });

        it('should retry on 429 rate limit errors', async () => {
            const rateLimitError = { statusCode: 429, message: 'Rate limit exceeded' };
            const mockResult = { id: 'cus_123', email: 'test@example.com' };

            mockCustomers.create
                .mockRejectedValueOnce(rateLimitError)
                .mockResolvedValueOnce(mockResult);

            const result = await stripeWrapper.customers.create({ email: 'test@example.com' });

            expect(result).toEqual(mockResult);
            expect(mockCustomers.create).toHaveBeenCalledTimes(2);
            expect(stripeWrapper.sleep).toHaveBeenCalledWith(500);
        });

        it('should not retry on 4xx errors (except 429)', async () => {
            const clientError = { statusCode: 400, message: 'Bad request' };

            mockCustomers.create.mockRejectedValueOnce(clientError);

            await expect(stripeWrapper.customers.create({ email: 'invalid' }))
                .rejects.toEqual(clientError);

            expect(mockCustomers.create).toHaveBeenCalledTimes(1);
            expect(stripeWrapper.sleep).not.toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(
                '❌ Stripe customers.create failed with client error - not retrying',
                expect.objectContaining({ statusCode: 400 })
            );
        });

        it('should exhaust all retries and throw final error', async () => {
            const serverError = { statusCode: 500, message: 'Internal server error' };

            mockCustomers.create.mockRejectedValue(serverError);

            await expect(stripeWrapper.customers.create({ email: 'test@example.com' }))
                .rejects.toEqual(serverError);

            expect(mockCustomers.create).toHaveBeenCalledTimes(3);
            expect(stripeWrapper.sleep).toHaveBeenCalledTimes(2);
            expect(stripeWrapper.sleep).toHaveBeenNthCalledWith(1, 500);
            expect(stripeWrapper.sleep).toHaveBeenNthCalledWith(2, 1000);
            
            expect(logger.error).toHaveBeenCalledWith(
                '💥 Stripe customers.create failed after 3 attempts',
                expect.objectContaining({
                    finalError: 'Internal server error',
                    finalStatusCode: 500
                })
            );
        });

        it('should apply exponential backoff delays correctly', async () => {
            const networkError = { message: 'Network error' };

            mockCustomers.create.mockRejectedValue(networkError);

            await expect(stripeWrapper.customers.create({ email: 'test@example.com' }))
                .rejects.toEqual(networkError);

            expect(stripeWrapper.sleep).toHaveBeenCalledTimes(2);
            expect(stripeWrapper.sleep).toHaveBeenNthCalledWith(1, 500);  // First retry: 500ms
            expect(stripeWrapper.sleep).toHaveBeenNthCalledWith(2, 1000); // Second retry: 1000ms
        });
    });

    describe('Stripe API wrapper methods', () => {
        it('should wrap customers.create correctly', async () => {
            const mockResult = { id: 'cus_123' };
            mockCustomers.create.mockResolvedValueOnce(mockResult);

            const result = await stripeWrapper.customers.create({ email: 'test@example.com' });

            expect(mockCustomers.create).toHaveBeenCalledWith({ email: 'test@example.com' });
            expect(result).toEqual(mockResult);
        });

        it('should wrap customers.retrieve correctly', async () => {
            const mockResult = { id: 'cus_123', email: 'test@example.com' };
            mockCustomers.retrieve.mockResolvedValueOnce(mockResult);

            const result = await stripeWrapper.customers.retrieve('cus_123');

            expect(mockCustomers.retrieve).toHaveBeenCalledWith('cus_123', {});
            expect(result).toEqual(mockResult);
        });

        it('should wrap subscriptions operations correctly', async () => {
            const mockSub = { id: 'sub_123' };
            mockStripe.subscriptions.create.mockResolvedValueOnce(mockSub);

            const result = await stripeWrapper.subscriptions.create({
                customer: 'cus_123',
                items: [{ price: 'price_123' }]
            });

            expect(result).toEqual(mockSub);
        });

        it('should wrap prices.list correctly', async () => {
            const mockPrices = { data: [{ id: 'price_123' }] };
            mockStripe.prices.list.mockResolvedValueOnce(mockPrices);

            const result = await stripeWrapper.prices.list({ lookup_keys: ['pro_monthly'] });

            expect(mockStripe.prices.list).toHaveBeenCalledWith({ lookup_keys: ['pro_monthly'] });
            expect(result).toEqual(mockPrices);
        });

        it('should wrap checkout.sessions.create correctly', async () => {
            const mockSession = { id: 'cs_123', url: 'https://checkout.stripe.com/...' };
            mockStripe.checkout.sessions.create.mockResolvedValueOnce(mockSession);

            const result = await stripeWrapper.checkout.sessions.create({
                customer: 'cus_123',
                mode: 'subscription',
                line_items: [{ price: 'price_123', quantity: 1 }]
            });

            expect(result).toEqual(mockSession);
        });

        it('should wrap billingPortal.sessions.create correctly', async () => {
            const mockPortal = { id: 'bps_123', url: 'https://billing.stripe.com/...' };
            mockStripe.billingPortal.sessions.create.mockResolvedValueOnce(mockPortal);

            const result = await stripeWrapper.billingPortal.sessions.create({
                customer: 'cus_123',
                return_url: 'https://example.com/return'
            });

            expect(result).toEqual(mockPortal);
        });
    });

    describe('Webhook signature verification', () => {
        it('should verify webhook signature successfully', () => {
            const mockEvent = { type: 'customer.created', id: 'evt_123' };
            mockWebhooks.constructEvent.mockReturnValueOnce(mockEvent);

            const result = stripeWrapper.webhooks.constructEvent(
                'payload',
                'signature',
                'webhook_secret'
            );

            expect(mockWebhooks.constructEvent).toHaveBeenCalledWith(
                'payload',
                'signature', 
                'webhook_secret'
            );
            expect(result).toEqual(mockEvent);
            expect(logger.debug).toHaveBeenCalledWith(
                '✅ Webhook signature verified successfully',
                expect.objectContaining({
                    eventType: 'customer.created',
                    eventId: 'evt_123'
                })
            );
        });

        it('should handle webhook verification failure', () => {
            const webhookError = new Error('Invalid signature');
            mockWebhooks.constructEvent.mockImplementation(() => {
                throw webhookError;
            });

            expect(() => stripeWrapper.webhooks.constructEvent(
                'payload',
                'invalid_signature',
                'webhook_secret'
            )).toThrow('Invalid signature');

            expect(logger.error).toHaveBeenCalledWith(
                '❌ Webhook signature verification failed',
                expect.objectContaining({
                    error: 'Invalid signature',
                    hasPayload: true,
                    hasSignature: true,
                    hasSecret: true
                })
            );
        });
    });

    describe('Raw Stripe access', () => {
        it('should provide raw access with warning', () => {
            const raw = stripeWrapper.raw;

            expect(raw).toBe(mockStripe);
            expect(logger.warn).toHaveBeenCalledWith(
                '⚠️ Using raw Stripe instance - no retry protection',
                expect.objectContaining({
                    caller: expect.stringContaining('stripeWrapper.test.js')
                })
            );
        });
    });

    describe('Generic retry wrapper', () => {
        it('should wrap custom operations with retry logic', async () => {
            const customOperation = jest.fn().mockResolvedValueOnce({ success: true });

            const result = await stripeWrapper.retryRequest(
                customOperation,
                'custom_operation',
                { customContext: 'test' }
            );

            expect(result).toEqual({ success: true });
            expect(customOperation).toHaveBeenCalledTimes(1);
            expect(logger.debug).toHaveBeenCalledWith(
                '✅ Stripe custom_operation succeeded on first try',
                expect.objectContaining({ 
                    context: expect.objectContaining({ customContext: 'test' })
                })
            );
        });

        it('should retry custom operations on failure', async () => {
            const customOperation = jest.fn()
                .mockRejectedValueOnce({ statusCode: 500, message: 'Server error' })
                .mockResolvedValueOnce({ success: true });

            jest.spyOn(stripeWrapper, 'sleep').mockImplementation(() => Promise.resolve());

            const result = await stripeWrapper.retryRequest(
                customOperation,
                'custom_operation'
            );

            expect(result).toEqual({ success: true });
            expect(customOperation).toHaveBeenCalledTimes(2);
            expect(stripeWrapper.sleep).toHaveBeenCalledWith(500);
        });
    });
});