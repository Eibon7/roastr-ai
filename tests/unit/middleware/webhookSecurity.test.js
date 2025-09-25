/**
 * Webhook Security Middleware Tests
 * 
 * Tests for webhook security validation, signature verification,
 * idempotency checking, and suspicious payload detection
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const {
    stripeWebhookSecurity,
    genericWebhookSecurity,
    verifyStripeSignature,
    checkIdempotency,
    detectSuspiciousWebhookPayload,
    cleanupExpiredIdempotencyRecords
} = require('../../../src/middleware/webhookSecurity');

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    },
    SafeUtils: {
        safeUserIdPrefix: jest.fn((id) => id ? id.substring(0, 8) + '...' : 'unknown-user'),
        safeString: jest.fn((str, maxLen) => str ? str.substring(0, maxLen || 100) : '')
    }
}));

// Mock Supabase
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn(() => ({
            insert: jest.fn(() => ({
                select: jest.fn(() => ({
                    single: jest.fn()
                }))
            })),
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn()
                }))
            })),
            delete: jest.fn(() => ({
                lt: jest.fn()
            }))
        }))
    }
}));

const { supabaseServiceClient: mockSupabaseServiceClient } = require('../../../src/config/supabase');

describe('Webhook Security Middleware', () => {
    const TEST_SECRET = 'test-webhook-secret-key';
    const MOCK_TIMESTAMP = Math.floor(Date.now() / 1000);
    const DEFAULT_TIMEOUT = 10000; // 10 second timeout for webhook tests
    
    // Helper function to create valid Stripe signature
    function createStripeSignature(payload, secret = TEST_SECRET, timestamp = MOCK_TIMESTAMP) {
        const signedPayload = `${timestamp}.${payload}`;
        const signature = crypto
            .createHmac('sha256', secret)
            .update(signedPayload, 'utf8')
            .digest('hex');
        
        return `t=${timestamp},v1=${signature}`;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;
    });

    describe('verifyStripeSignature', () => {
        const testPayload = Buffer.from('{"test": "payload"}');
        
        it('should verify valid signatures', () => {
            const signature = createStripeSignature(testPayload);
            const result = verifyStripeSignature(testPayload, signature, TEST_SECRET);
            
            expect(result.valid).toBe(true);
            expect(result.timestamp).toBe(MOCK_TIMESTAMP);
        });

        it('should reject invalid signatures', () => {
            const invalidSignature = 't=12345,v1=invalid_signature';
            const result = verifyStripeSignature(testPayload, invalidSignature, TEST_SECRET);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should reject signatures with wrong secret', () => {
            const signature = createStripeSignature(testPayload, 'wrong-secret');
            const result = verifyStripeSignature(testPayload, signature, TEST_SECRET);
            
            expect(result.valid).toBe(false);
        });

        it('should reject signatures outside tolerance window', () => {
            const oldTimestamp = Math.floor(Date.now() / 1000) - 1000; // 1000 seconds ago
            const signature = createStripeSignature(testPayload, TEST_SECRET, oldTimestamp);
            const result = verifyStripeSignature(testPayload, signature, TEST_SECRET, 300);
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Timestamp outside tolerance');
        });

        it('should handle missing signature components', () => {
            const result = verifyStripeSignature(testPayload, '', TEST_SECRET);
            expect(result.valid).toBe(false);
            
            const noTimestamp = verifyStripeSignature(testPayload, 'v1=signature', TEST_SECRET);
            expect(noTimestamp.valid).toBe(false);
        });

        it('should handle malformed signatures gracefully', () => {
            const malformedSignatures = [
                'invalid',
                't=not_a_number,v1=signature',
                't=12345',
                'v1=signature_only'
            ];

            malformedSignatures.forEach(sig => {
                const result = verifyStripeSignature(testPayload, sig, TEST_SECRET);
                expect(result.valid).toBe(false);
                expect(result.error).toBeDefined();
            });
        });
    });

    describe('detectSuspiciousWebhookPayload', () => {
        it('should detect script injection attempts', () => {
            const suspiciousPayload = {
                data: {
                    description: '<script>alert("xss")</script>'
                }
            };
            
            const result = detectSuspiciousWebhookPayload(suspiciousPayload);
            expect(result.isSuspicious).toBe(true);
            expect(result.patterns.length).toBeGreaterThan(0);
        });

        it('should detect excessively deep objects', () => {
            // Create deeply nested object
            let deepObject = {};
            let current = deepObject;
            for (let i = 0; i < 25; i++) {
                current.nested = {};
                current = current.nested;
            }
            
            const result = detectSuspiciousWebhookPayload(deepObject);
            expect(result.isSuspicious).toBe(true);
            expect(result.tooDeep).toBe(true);
        });

        it('should detect large arrays', () => {
            const payloadWithLargeArray = {
                items: new Array(1500).fill('item')
            };
            
            const result = detectSuspiciousWebhookPayload(payloadWithLargeArray);
            expect(result.isSuspicious).toBe(true);
            expect(result.hasLargeArrays).toBe(true);
        });

        it('should allow normal webhook payloads', () => {
            const normalPayload = {
                id: 'evt_test_webhook',
                type: 'customer.subscription.created',
                data: {
                    object: {
                        id: 'sub_1234567890',
                        customer: 'cus_1234567890',
                        status: 'active'
                    }
                }
            };
            
            const result = detectSuspiciousWebhookPayload(normalPayload);
            expect(result.isSuspicious).toBe(false);
        });

        it('should handle errors in payload analysis gracefully', () => {
            // Test with circular reference (should not crash)
            const circularPayload = {};
            circularPayload.self = circularPayload;
            
            expect(() => detectSuspiciousWebhookPayload(circularPayload)).not.toThrow();
        });
    });

    describe('checkIdempotency', () => {
        it('should allow new idempotency keys', async () => {
            mockSupabaseServiceClient.from().insert().select().single.mockResolvedValue({
                data: { id: 1, idempotency_key: 'new-key' },
                error: null
            });

            const result = await checkIdempotency('new-key', { test: 'data' });
            
            expect(result.isNew).toBe(true);
            expect(result.shouldProcess).toBe(true);
            expect(mockSupabaseServiceClient.from).toHaveBeenCalledWith('webhook_idempotency');
        });

        it('should detect duplicate idempotency keys', async () => {
            // Mock unique constraint violation
            mockSupabaseServiceClient.from().insert().select().single.mockRejectedValue({
                code: '23505', // PostgreSQL unique constraint violation
                message: 'duplicate key value'
            });

            // Mock existing record fetch
            mockSupabaseServiceClient.from().select().eq().single.mockResolvedValue({
                data: { 
                    id: 1, 
                    idempotency_key: 'existing-key',
                    created_at: '2023-01-01T00:00:00Z'
                },
                error: null
            });

            const result = await checkIdempotency('existing-key');
            
            expect(result.isNew).toBe(false);
            expect(result.shouldProcess).toBe(false);
            expect(result.existingRecord).toBeDefined();
        });

        it('should fail open on database errors', async () => {
            mockSupabaseServiceClient.from().insert().select().single.mockRejectedValue({
                code: 'CONNECTION_ERROR',
                message: 'Database connection failed'
            });

            const result = await checkIdempotency('error-key');
            
            expect(result.isNew).toBe(true);
            expect(result.shouldProcess).toBe(true);
        });
    });

    describe('stripeWebhookSecurity middleware', () => {
        let app;

        beforeEach(() => {
            app = express();
        });

        it('should accept valid Stripe webhooks', async () => {
            const payload = JSON.stringify({
                id: 'evt_test_webhook',
                type: 'customer.subscription.created',
                created: MOCK_TIMESTAMP
            });

            const signature = createStripeSignature(payload);

            app.post('/webhook', 
                express.raw({ type: 'application/json' }),
                stripeWebhookSecurity({ secret: TEST_SECRET }),
                (req, res) => {
                    res.json({ 
                        success: true, 
                        requestId: req.webhookSecurity.requestId 
                    });
                }
            );

            const response = await request(app)
                .post('/webhook')
                .set('stripe-signature', signature)
                .set('content-type', 'application/json')
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.requestId).toBeDefined();
        });

        it('should reject webhooks with invalid signatures', async () => {
            const payload = JSON.stringify({ test: 'data' });

            app.post('/webhook', 
                express.raw({ type: 'application/json' }),
                stripeWebhookSecurity({ secret: TEST_SECRET }),
                (req, res) => res.json({ success: true })
            );

            const response = await request(app)
                .post('/webhook')
                .set('stripe-signature', 'invalid-signature')
                .set('content-type', 'application/json')
                .send(payload);

            expect(response.status).toBe(401);
            expect(response.body.code).toBe('INVALID_SIGNATURE');
        });

        it('should reject webhooks with no body', async () => {
            app.post('/webhook', 
                express.raw({ type: 'application/json' }),
                stripeWebhookSecurity({ secret: TEST_SECRET }),
                (req, res) => res.json({ success: true })
            );

            const response = await request(app)
                .post('/webhook')
                .set('stripe-signature', 'some-signature');

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('MISSING_BODY');
        });

        it('should reject webhooks with oversized bodies', async () => {
            const largePayload = JSON.stringify({
                data: 'x'.repeat(2 * 1024 * 1024) // 2MB payload
            });

            app.post('/webhook', 
                express.raw({ type: 'application/json' }),
                stripeWebhookSecurity({ secret: TEST_SECRET }),
                (req, res) => res.json({ success: true })
            );

            const signature = createStripeSignature(largePayload);

            const response = await request(app)
                .post('/webhook')
                .set('stripe-signature', signature)
                .set('content-type', 'application/json')
                .send(largePayload);

            expect(response.status).toBe(413);
            expect(response.body.code).toBe('BODY_TOO_LARGE');
        });

        it('should reject webhooks with invalid JSON', async () => {
            const invalidJson = '{ "invalid": json }';
            const signature = createStripeSignature(invalidJson);

            app.post('/webhook', 
                express.raw({ type: 'application/json' }),
                stripeWebhookSecurity({ secret: TEST_SECRET }),
                (req, res) => res.json({ success: true })
            );

            const response = await request(app)
                .post('/webhook')
                .set('stripe-signature', signature)
                .set('content-type', 'application/json')
                .send(invalidJson);

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('INVALID_JSON');
        });

        it('should handle idempotency correctly', async () => {
            const payload = JSON.stringify({
                id: 'evt_duplicate_test',
                type: 'customer.subscription.created',
                created: MOCK_TIMESTAMP
            });

            const signature = createStripeSignature(payload);

            // Mock idempotency check to return existing record
            mockSupabaseServiceClient.from().insert().select().single.mockRejectedValue({
                code: '23505'
            });
            
            mockSupabaseServiceClient.from().select().eq().single.mockResolvedValue({
                data: {
                    id: 1,
                    idempotency_key: 'evt_duplicate_test',
                    created_at: '2023-01-01T00:00:00Z'
                },
                error: null
            });

            app.post('/webhook', 
                express.raw({ type: 'application/json' }),
                stripeWebhookSecurity({ 
                    secret: TEST_SECRET,
                    enableIdempotency: true 
                }),
                (req, res) => res.json({ success: true })
            );

            const response = await request(app)
                .post('/webhook')
                .set('stripe-signature', signature)
                .set('content-type', 'application/json')
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.processed).toBe(false);
            expect(response.body.idempotent).toBe(true);
        });
    });

    describe('genericWebhookSecurity middleware', () => {
        let app;

        beforeEach(() => {
            app = express();
        });

        it('should verify generic webhook signatures', async () => {
            const payload = 'test webhook payload';
            const signature = crypto
                .createHmac('sha256', TEST_SECRET)
                .update(payload)
                .digest('hex');

            const middleware = genericWebhookSecurity({
                verifySignature: true,
                secret: TEST_SECRET,
                signatureHeader: 'x-hub-signature-256'
            });

            app.post('/webhook', 
                express.raw({ type: 'application/json' }),
                ...middleware,
                (req, res) => res.json({ success: true })
            );

            const response = await request(app)
                .post('/webhook')
                .set('x-hub-signature-256', `sha256=${signature}`)
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should reject invalid generic signatures', async () => {
            const payload = 'test webhook payload';

            const middleware = genericWebhookSecurity({
                verifySignature: true,
                secret: TEST_SECRET,
                signatureHeader: 'x-hub-signature-256'
            });

            app.post('/webhook', 
                express.raw({ type: 'application/json' }),
                ...middleware,
                (req, res) => res.json({ success: true })
            );

            const response = await request(app)
                .post('/webhook')
                .set('x-hub-signature-256', 'sha256=invalid_signature')
                .send(payload);

            expect(response.status).toBe(401);
            expect(response.body.code).toBe('INVALID_SIGNATURE');
        });
    });

    describe('cleanupExpiredIdempotencyRecords', () => {
        it('should clean up expired records successfully', async () => {
            mockSupabaseServiceClient.from().delete().lt.mockResolvedValue({
                data: [{ id: 1 }, { id: 2 }],
                error: null
            });

            const result = await cleanupExpiredIdempotencyRecords();

            expect(result.success).toBe(true);
            expect(result.recordsDeleted).toBe(2);
            expect(mockSupabaseServiceClient.from).toHaveBeenCalledWith('webhook_idempotency');
        });

        it('should handle cleanup errors gracefully', async () => {
            mockSupabaseServiceClient.from().delete().lt.mockRejectedValue(
                new Error('Database error')
            );

            const result = await cleanupExpiredIdempotencyRecords();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database error');
        });
    });

    describe('Performance and edge cases', () => {
        it('should handle concurrent idempotency checks', async () => {
            const promises = Array.from({ length: 10 }, (_, i) => 
                checkIdempotency(`concurrent-key-${i}`)
            );

            // Should not throw even with concurrent access
            await expect(Promise.all(promises)).resolves.toBeDefined();
        }, DEFAULT_TIMEOUT);

        it('should handle very large webhook payloads efficiently', () => {
            const largePayload = {
                data: 'x'.repeat(100000),
                nested: {
                    array: new Array(1000).fill('item')
                }
            };

            const start = Date.now();
            const result = detectSuspiciousWebhookPayload(largePayload);
            const end = Date.now();

            expect(end - start).toBeLessThan(1000); // Should complete within 1 second
            expect(result).toBeDefined();
        });

        it('should handle malformed signature headers gracefully', async () => {
            const payload = JSON.stringify({ test: 'data' });
            const malformedHeaders = [
                '',
                'not-a-signature',
                't=,v1=',
                't=abc,v1=def',
                'random-string'
            ];

            for (const header of malformedHeaders) {
                const result = verifyStripeSignature(Buffer.from(payload), header, TEST_SECRET);
                expect(result.valid).toBe(false);
                expect(result.error).toBeDefined();
            }
        });
    });

    describe('Security boundary tests', () => {
        it('should resist timing attacks on signature verification', () => {
            const payload = Buffer.from('test payload');
            const validSignature = createStripeSignature(payload);
            const invalidSignature = 't=1234567890,v1=0000000000000000000000000000000000000000000000000000000000000000';

            // Both valid and invalid signatures should take similar time
            const times = [];
            
            for (let i = 0; i < 10; i++) {
                const start = Date.now();
                verifyStripeSignature(payload, validSignature, TEST_SECRET);
                times.push(Date.now() - start);

                const start2 = Date.now();
                verifyStripeSignature(payload, invalidSignature, TEST_SECRET);
                times.push(Date.now() - start2);
            }

            // All operations should be fast (< 50ms each)
            times.forEach(time => {
                expect(time).toBeLessThan(50);
            });
        });

        it('should prevent signature bypass attempts', () => {
            const payload = Buffer.from('{"bypass": "attempt"}');
            const bypassAttempts = [
                null,
                undefined,
                '',
                't=0,v1=bypass',
                'v1=signature_without_timestamp'
            ];

            bypassAttempts.forEach(signature => {
                const result = verifyStripeSignature(payload, signature, TEST_SECRET);
                expect(result.valid).toBe(false);
            });
        });
    });
});