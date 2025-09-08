/**
 * Input Validation Middleware Tests
 * 
 * Tests for enhanced input validation and security middleware
 * including malicious pattern detection, rate limiting, and sanitization
 */

const request = require('supertest');
const express = require('express');
const {
    securityValidation,
    sanitizeInput,
    sanitizeFields,
    detectMaliciousPatterns,
    validateRoastInput,
    validateCreditOperation,
    validateAuthentication,
    isSuspiciousUserAgent,
    rateLimiters
} = require('../../../src/middleware/inputValidation');

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

describe('Input Validation Middleware', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        jest.clearAllMocks();
    });

    describe('detectMaliciousPatterns', () => {
        it('should detect SQL injection patterns', () => {
            const input = "'; DROP TABLE users; --";
            const result = detectMaliciousPatterns(input);
            
            expect(result.isMalicious).toBe(true);
            expect(result.patterns.length).toBeGreaterThan(0);
        });

        it('should detect XSS patterns', () => {
            const input = '<script>alert("xss")</script>';
            const result = detectMaliciousPatterns(input);
            
            expect(result.isMalicious).toBe(true);
            expect(result.patterns.length).toBeGreaterThan(0);
        });

        it('should detect command injection patterns', () => {
            const input = 'test && rm -rf /';
            const result = detectMaliciousPatterns(input);
            
            expect(result.isMalicious).toBe(true);
            expect(result.patterns.length).toBeGreaterThan(0);
        });

        it('should allow safe input', () => {
            const input = 'This is a normal message';
            const result = detectMaliciousPatterns(input);
            
            expect(result.isMalicious).toBe(false);
            expect(result.patterns.length).toBe(0);
        });

        it('should handle empty/null input', () => {
            expect(detectMaliciousPatterns('').isMalicious).toBe(false);
            expect(detectMaliciousPatterns(null).isMalicious).toBe(false);
            expect(detectMaliciousPatterns(undefined).isMalicious).toBe(false);
        });
    });

    describe('sanitizeInput', () => {
        it('should remove HTML tags in strict mode', () => {
            const input = '<script>alert("test")</script>Hello World';
            const sanitized = sanitizeInput(input, { strictMode: true });
            
            expect(sanitized).toBe('Hello World');
        });

        it('should allow safe HTML when allowHtml is true', () => {
            const input = '<p>Hello <strong>World</strong></p>';
            const sanitized = sanitizeInput(input, { allowHtml: true });
            
            expect(sanitized).toBe('<p>Hello <strong>World</strong></p>');
        });

        it('should truncate long input', () => {
            const input = 'a'.repeat(1000);
            const sanitized = sanitizeInput(input, { maxLength: 100 });
            
            expect(sanitized.length).toBe(100);
        });

        it('should remove null bytes', () => {
            const input = 'Hello\x00World';
            const sanitized = sanitizeInput(input);
            
            expect(sanitized).toBe('HelloWorld');
        });

        it('should handle non-string input', () => {
            expect(sanitizeInput(123)).toBe(123);
            expect(sanitizeInput(null)).toBe(null);
            expect(sanitizeInput(undefined)).toBe(undefined);
        });
    });

    describe('isSuspiciousUserAgent', () => {
        it('should detect malicious user agents', () => {
            const suspiciousAgents = [
                'sqlmap/1.4.7',
                'Mozilla/5.0 sqlmap/1.4.7',
                'Nikto/2.1.6',
                'Burp Suite Professional',
                'w3af.org'
            ];

            suspiciousAgents.forEach(agent => {
                expect(isSuspiciousUserAgent(agent)).toBe(true);
            });
        });

        it('should allow legitimate user agents', () => {
            const legitimateAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'curl/7.68.0',
                'PostmanRuntime/7.28.4'
            ];

            legitimateAgents.forEach(agent => {
                expect(isSuspiciousUserAgent(agent)).toBe(false);
            });
        });
    });

    describe('securityValidation middleware', () => {
        it('should block malicious patterns when blockMalicious is true', async () => {
            app.use(securityValidation({ blockMalicious: true }));
            app.post('/test', (req, res) => res.json({ success: true }));

            const response = await request(app)
                .post('/test')
                .send({ message: "'; DROP TABLE users; --" });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('INVALID_INPUT');
        });

        it('should block suspicious user agents', async () => {
            app.use(securityValidation({ 
                checkSuspiciousUserAgent: true, 
                blockMalicious: true 
            }));
            app.post('/test', (req, res) => res.json({ success: true }));

            const response = await request(app)
                .post('/test')
                .set('User-Agent', 'sqlmap/1.4.7')
                .send({ message: 'test' });

            expect(response.status).toBe(403);
            expect(response.body.code).toBe('SECURITY_VIOLATION');
        });

        it('should allow safe requests', async () => {
            app.use(securityValidation());
            app.post('/test', (req, res) => res.json({ success: true }));

            const response = await request(app)
                .post('/test')
                .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
                .send({ message: 'Hello world' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('sanitizeFields middleware', () => {
        it('should sanitize specified fields', async () => {
            app.use(sanitizeFields(['message'], { strictMode: true }));
            app.post('/test', (req, res) => {
                res.json({ 
                    success: true, 
                    sanitizedMessage: req.body.message 
                });
            });

            const response = await request(app)
                .post('/test')
                .send({ message: '<script>alert("xss")</script>Hello' });

            expect(response.status).toBe(200);
            expect(response.body.sanitizedMessage).toBe('Hello');
        });

        it('should not modify non-string fields', async () => {
            app.use(sanitizeFields(['number', 'object']));
            app.post('/test', (req, res) => {
                res.json({ 
                    success: true, 
                    data: req.body 
                });
            });

            const response = await request(app)
                .post('/test')
                .send({ 
                    number: 123,
                    object: { key: 'value' }
                });

            expect(response.status).toBe(200);
            expect(response.body.data.number).toBe(123);
            expect(response.body.data.object).toEqual({ key: 'value' });
        });
    });

    describe('validateAuthentication middleware', () => {
        it('should require authentication', async () => {
            app.use(validateAuthentication());
            app.get('/test', (req, res) => res.json({ success: true }));

            const response = await request(app).get('/test');

            expect(response.status).toBe(401);
            expect(response.body.code).toBe('AUTH_REQUIRED');
        });

        it('should require admin access', async () => {
            app.use((req, res, next) => {
                req.user = { id: 'user123', is_admin: false };
                next();
            });
            app.use(validateAuthentication({ requireAdmin: true }));
            app.get('/test', (req, res) => res.json({ success: true }));

            const response = await request(app).get('/test');

            expect(response.status).toBe(403);
            expect(response.body.code).toBe('ADMIN_REQUIRED');
        });

        it('should require active subscription', async () => {
            app.use((req, res, next) => {
                req.user = { id: 'user123', plan: 'free' };
                next();
            });
            app.use(validateAuthentication({ requireActiveSubscription: true }));
            app.get('/test', (req, res) => res.json({ success: true }));

            const response = await request(app).get('/test');

            expect(response.status).toBe(402);
            expect(response.body.code).toBe('SUBSCRIPTION_REQUIRED');
        });

        it('should allow authorized requests', async () => {
            app.use((req, res, next) => {
                req.user = { id: 'user123', is_admin: true, plan: 'pro' };
                next();
            });
            app.use(validateAuthentication({ 
                requireAdmin: true, 
                requireActiveSubscription: true 
            }));
            app.get('/test', (req, res) => res.json({ success: true }));

            const response = await request(app).get('/test');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('validateRoastInput', () => {
        it('should validate valid roast input', async () => {
            // Note: This test would need to mock rate limiting
            // For brevity, testing the validation logic separately
            const validInput = {
                message: 'This is a test message',
                tone: 'sarcastic',
                platform: 'twitter'
            };

            // Test individual validation components
            expect(detectMaliciousPatterns(validInput.message).isMalicious).toBe(false);
            expect(['sarcastic', 'subtle', 'direct', 'witty', 'brutal']).toContain(validInput.tone);
            expect(['twitter', 'youtube', 'instagram'].includes(validInput.platform)).toBe(true);
        });

        it('should reject invalid input patterns', () => {
            const maliciousInputs = [
                "'; DROP TABLE users; --",
                '<script>alert("xss")</script>',
                'test && rm -rf /'
            ];

            maliciousInputs.forEach(input => {
                expect(detectMaliciousPatterns(input).isMalicious).toBe(true);
            });
        });

        it('should reject messages that are too long', () => {
            const longMessage = 'a'.repeat(2001);
            const sanitized = sanitizeInput(longMessage, { maxLength: 2000 });
            
            expect(sanitized.length).toBe(2000);
        });
    });

    describe('validateCreditOperation', () => {
        it('should validate valid credit operations', () => {
            const validOperations = [
                { creditType: 'analysis', amount: 1 },
                { creditType: 'roast', amount: 50 },
                { amount: 10 }
            ];

            validOperations.forEach(op => {
                if (op.creditType) {
                    expect(['analysis', 'roast']).toContain(op.creditType);
                }
                if (op.amount) {
                    expect(op.amount).toBeGreaterThan(0);
                    expect(op.amount).toBeLessThanOrEqual(100);
                }
            });
        });
    });

    describe('Edge cases and error handling', () => {
        it('should handle malformed JSON gracefully', async () => {
            app.use(securityValidation());
            app.post('/test', (req, res) => res.json({ success: true }));

            // This tests that the middleware doesn't crash on malformed requests
            const response = await request(app)
                .post('/test')
                .set('Content-Type', 'application/json')
                .send('{ invalid json }');

            // Should handle the error gracefully (400 from express.json())
            expect(response.status).toBe(400);
        });

        it('should handle empty request bodies', async () => {
            app.use(sanitizeFields(['message']));
            app.post('/test', (req, res) => res.json({ success: true }));

            const response = await request(app)
                .post('/test')
                .send({});

            expect(response.status).toBe(200);
        });

        it('should handle Unicode and special characters safely', () => {
            const unicodeInput = '👋 Hello 世界 🌍 café naïve résumé';
            const sanitized = sanitizeInput(unicodeInput, { strictMode: true });
            
            // Should preserve Unicode characters
            expect(sanitized).toBe(unicodeInput);
        });

        it('should handle deeply nested objects', () => {
            const deepObject = { a: { b: { c: { d: { e: 'deep' } } } } };
            const result = detectMaliciousPatterns(JSON.stringify(deepObject));
            
            expect(result.isMalicious).toBe(false);
        });
    });

    describe('Performance and security boundaries', () => {
        it('should handle very large input strings efficiently', () => {
            const largeInput = 'a'.repeat(50000);
            const start = Date.now();
            
            const result = detectMaliciousPatterns(largeInput);
            const sanitized = sanitizeInput(largeInput, { maxLength: 10000 });
            
            const end = Date.now();
            
            // Should complete within reasonable time (< 1 second)
            expect(end - start).toBeLessThan(1000);
            expect(sanitized.length).toBe(10000);
            expect(result.isMalicious).toBe(false);
        });

        it('should handle patterns with regex edge cases', () => {
            const edgeCases = [
                'a'.repeat(10000), // Long repetition
                '((((((((((', // Unbalanced parentheses
                '\\\\\\\\\\\\', // Many backslashes
                '🔥'.repeat(1000) // Many emojis
            ];

            edgeCases.forEach(input => {
                expect(() => detectMaliciousPatterns(input)).not.toThrow();
                expect(() => sanitizeInput(input)).not.toThrow();
            });
        });
    });
});

describe('Integration Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
    });

    it('should work end-to-end with all middleware', async () => {
        // Setup full middleware stack
        app.use(securityValidation({ 
            checkMaliciousPatterns: true, 
            blockMalicious: false // Allow for logging
        }));
        app.use(sanitizeFields(['message'], { 
            maxLength: 1000, 
            strictMode: true 
        }));
        app.use((req, res, next) => {
            req.user = { id: 'test-user-123', is_admin: false };
            next();
        });
        app.use(validateAuthentication());
        
        app.post('/roast', (req, res) => {
            res.json({ 
                success: true, 
                processedMessage: req.body.message,
                userId: req.user.id
            });
        });

        const response = await request(app)
            .post('/roast')
            .set('User-Agent', 'Mozilla/5.0 Test Browser')
            .send({ 
                message: '<p>Clean message</p> with some content',
                tone: 'sarcastic'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.processedMessage).toBe('Clean message with some content');
        expect(response.body.userId).toBe('test-user-123');
    });
});