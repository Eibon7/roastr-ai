/**
 * Webhook Security Middleware
 * 
 * Provides comprehensive security validation for webhook endpoints
 * with idempotency, signature verification, and replay attack protection
 * 
 * Security Features:
 * - Cryptographic signature verification
 * - Timestamp-based replay attack prevention
 * - Idempotency key tracking
 * - Request size and rate limiting
 * - Suspicious payload detection
 * - Comprehensive audit logging
 * 
 * @author Roastr.ai Team
 * @version 1.0.0
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit'); // Issue #618 - IPv6 support
const { logger } = require('../utils/logger');
const { SafeUtils } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');

// Constants for security validation
const WEBHOOK_CONSTANTS = {
    MAX_BODY_SIZE: 1024 * 1024, // 1MB max payload
    SIGNATURE_TOLERANCE: 300, // 5 minutes tolerance for timestamp validation
    IDEMPOTENCY_RETENTION: 24 * 60 * 60 * 1000, // 24 hours for idempotency tracking
    MAX_RETRIES: 5, // Maximum webhook retry attempts
    SUSPICIOUS_PATTERNS: [
        // Injection attempts in webhook data
        /<script|javascript:|vbscript:/gi,
        /(\b(eval|function|setTimeout|setInterval)\s*\()/gi,
        /(document\.|window\.|global\.)/gi
    ]
};

/**
 * Webhook-specific rate limiter with burst protection
 */
const webhookRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 100, // Max 100 webhooks per minute per IP
    keyGenerator: (req) => {
        // Rate limit by IP and webhook source with IPv6 support (Issue #618)
        const ip = ipKeyGenerator(req);
        const source = req.headers['stripe-signature'] ? 'stripe' :
                      req.headers['x-hub-signature-256'] ? 'github' : 'unknown';
        return `webhook:${ip}:${source}`;
    },
    handler: (req, res) => {
        logger.error('Webhook rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            endpoint: req.path,
            source: req.headers['stripe-signature'] ? 'stripe' : 'unknown'
        });
        
        res.status(429).json({
            success: false,
            error: 'Webhook rate limit exceeded',
            code: 'WEBHOOK_RATE_LIMIT'
        });
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Store and check idempotency keys to prevent duplicate processing
 * @param {string} idempotencyKey - Unique key for the webhook event
 * @param {Object} requestData - Request data to store
 * @returns {Promise<Object>} Idempotency check result
 */
async function checkIdempotency(idempotencyKey, requestData = {}) {
    try {
        // Try to insert the idempotency key
        const { data, error } = await supabaseServiceClient
            .from('webhook_idempotency')
            .insert({
                idempotency_key: idempotencyKey,
                request_data: requestData,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + WEBHOOK_CONSTANTS.IDEMPOTENCY_RETENTION).toISOString()
            })
            .select()
            .single();

        if (error) {
            // If insertion failed due to conflict, check existing record
            if (error.code === '23505') { // Unique constraint violation
                const { data: existing, error: fetchError } = await supabaseServiceClient
                    .from('webhook_idempotency')
                    .select('*')
                    .eq('idempotency_key', idempotencyKey)
                    .single();

                if (!fetchError && existing) {
                    return {
                        isNew: false,
                        existingRecord: existing,
                        shouldProcess: false
                    };
                }
            }
            
            // For other errors, log and allow processing (fail open)
            logger.warn('Idempotency check failed, allowing processing', {
                idempotencyKey: SafeUtils.safeString(idempotencyKey),
                error: error.message
            });
            
            return { isNew: true, shouldProcess: true };
        }

        return {
            isNew: true,
            record: data,
            shouldProcess: true
        };

    } catch (error) {
        logger.error('Critical idempotency check error', {
            idempotencyKey: SafeUtils.safeString(idempotencyKey),
            error: error.message
        });
        
        // Fail open to prevent webhook processing disruption
        return { isNew: true, shouldProcess: true };
    }
}

/**
 * Verify Stripe webhook signature
 * @param {Buffer} payload - Raw request body
 * @param {string} signature - Stripe signature header
 * @param {string} secret - Webhook secret
 * @param {number} tolerance - Timestamp tolerance in seconds
 * @returns {Object} Verification result
 */
function verifyStripeSignature(payload, signature, secret, tolerance = WEBHOOK_CONSTANTS.SIGNATURE_TOLERANCE) {
    if (!signature || !secret) {
        return { valid: false, error: 'Missing signature or secret' };
    }

    try {
        const elements = signature.split(',');
        let timestamp;
        const signatures = [];

        // Parse signature header
        for (const element of elements) {
            const [key, value] = element.split('=');
            if (key === 't') {
                timestamp = parseInt(value, 10);
            } else if (key.startsWith('v')) {
                signatures.push(value);
            }
        }

        if (!timestamp) {
            return { valid: false, error: 'No timestamp found in signature' };
        }

        // Check timestamp tolerance (replay attack protection)
        const currentTime = Math.floor(Date.now() / 1000);
        if (Math.abs(currentTime - timestamp) > tolerance) {
            return { 
                valid: false, 
                error: 'Timestamp outside tolerance window',
                timestampAge: currentTime - timestamp
            };
        }

        // Verify signature
        const signedPayload = timestamp + '.' + payload;
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(signedPayload, 'utf8')
            .digest('hex');

        const signatureValid = signatures.some(sig => {
            return crypto.timingSafeEqual(
                Buffer.from(expectedSignature, 'hex'),
                Buffer.from(sig, 'hex')
            );
        });

        return {
            valid: signatureValid,
            timestamp,
            timestampAge: currentTime - timestamp
        };

    } catch (error) {
        return {
            valid: false,
            error: error.message
        };
    }
}

/**
 * Detect suspicious patterns in webhook payload
 * @param {Object} payload - Webhook payload to analyze
 * @returns {Object} Detection result
 */
function detectSuspiciousWebhookPayload(payload) {
    try {
        const payloadString = JSON.stringify(payload);
        const detectedPatterns = [];

        for (const pattern of WEBHOOK_CONSTANTS.SUSPICIOUS_PATTERNS) {
            if (pattern.test(payloadString)) {
                detectedPatterns.push(pattern.source);
            }
        }

        // Check for unusually large nested objects (potential DoS)
        const depth = getObjectDepth(payload);
        const isTooDeep = depth > 20;

        // Check for excessive array lengths
        const hasLargeArrays = hasExcessiveArrays(payload, 1000);

        return {
            isSuspicious: detectedPatterns.length > 0 || isTooDeep || hasLargeArrays,
            patterns: detectedPatterns,
            objectDepth: depth,
            tooDeep: isTooDeep,
            hasLargeArrays
        };

    } catch (error) {
        logger.error('Error analyzing webhook payload', { error: error.message });
        return { isSuspicious: false, error: error.message };
    }
}

/**
 * Calculate object nesting depth
 * @param {*} obj - Object to analyze
 * @param {number} depth - Current depth
 * @returns {number} Maximum depth
 */
function getObjectDepth(obj, depth = 0) {
    if (obj === null || typeof obj !== 'object') {
        return depth;
    }
    
    if (depth > 50) return depth; // Prevent stack overflow
    
    let maxDepth = depth;
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const currentDepth = getObjectDepth(obj[key], depth + 1);
            maxDepth = Math.max(maxDepth, currentDepth);
        }
    }
    
    return maxDepth;
}

/**
 * Check for arrays that are excessively large
 * @param {*} obj - Object to analyze
 * @param {number} maxSize - Maximum allowed array size
 * @returns {boolean} Whether large arrays were found
 */
function hasExcessiveArrays(obj, maxSize = 1000) {
    if (Array.isArray(obj)) {
        return obj.length > maxSize;
    }
    
    if (obj === null || typeof obj !== 'object') {
        return false;
    }
    
    for (const key in obj) {
        if (obj.hasOwnProperty(key) && hasExcessiveArrays(obj[key], maxSize)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Comprehensive webhook security middleware for Stripe
 * @param {Object} options - Security options
 * @returns {Function} Express middleware
 */
function stripeWebhookSecurity(options = {}) {
    const {
        secret = process.env.STRIPE_WEBHOOK_SECRET,
        tolerance = WEBHOOK_CONSTANTS.SIGNATURE_TOLERANCE,
        enableIdempotency = true,
        enableSuspiciousPayloadDetection = true,
        logAllRequests = process.env.NODE_ENV !== 'production'
    } = options;

    return async (req, res, next) => {
        const startTime = Date.now();
        const signature = req.headers['stripe-signature'];
        const requestId = crypto.randomUUID();

        try {
            // Basic security checks
            if (!req.body) {
                logger.error('Stripe webhook: No request body', { requestId });
                return res.status(400).json({
                    success: false,
                    error: 'No request body',
                    code: 'MISSING_BODY'
                });
            }

            // Check body size
            const bodySize = Buffer.byteLength(req.body);
            if (bodySize > WEBHOOK_CONSTANTS.MAX_BODY_SIZE) {
                logger.error('Stripe webhook: Request body too large', {
                    requestId,
                    bodySize,
                    maxSize: WEBHOOK_CONSTANTS.MAX_BODY_SIZE
                });
                return res.status(413).json({
                    success: false,
                    error: 'Request body too large',
                    code: 'BODY_TOO_LARGE'
                });
            }

            // Verify signature
            const verification = verifyStripeSignature(req.body, signature, secret, tolerance);
            if (!verification.valid) {
                logger.error('Stripe webhook: Signature verification failed', {
                    requestId,
                    error: verification.error,
                    timestampAge: verification.timestampAge,
                    ip: req.ip,
                    userAgent: SafeUtils.safeString(req.get('User-Agent'))
                });
                
                return res.status(401).json({
                    success: false,
                    error: 'Invalid signature',
                    code: 'INVALID_SIGNATURE'
                });
            }

            // Parse and validate JSON
            let webhookEvent;
            try {
                webhookEvent = JSON.parse(req.body.toString());
            } catch (parseError) {
                logger.error('Stripe webhook: Invalid JSON payload', {
                    requestId,
                    error: parseError.message
                });
                return res.status(400).json({
                    success: false,
                    error: 'Invalid JSON payload',
                    code: 'INVALID_JSON'
                });
            }

            // Detect suspicious payloads
            if (enableSuspiciousPayloadDetection) {
                const suspiciousCheck = detectSuspiciousWebhookPayload(webhookEvent);
                if (suspiciousCheck.isSuspicious) {
                    logger.warn('Stripe webhook: Suspicious payload detected', {
                        requestId,
                        eventId: webhookEvent.id,
                        eventType: webhookEvent.type,
                        patterns: suspiciousCheck.patterns,
                        objectDepth: suspiciousCheck.objectDepth,
                        tooDeep: suspiciousCheck.tooDeep,
                        hasLargeArrays: suspiciousCheck.hasLargeArrays
                    });
                    
                    // Log but don't block - Stripe events can be complex
                }
            }

            // Idempotency check
            let idempotencyResult = { isNew: true, shouldProcess: true };
            if (enableIdempotency && webhookEvent.id) {
                idempotencyResult = await checkIdempotency(webhookEvent.id, {
                    eventType: webhookEvent.type,
                    created: webhookEvent.created,
                    requestId
                });

                if (!idempotencyResult.shouldProcess) {
                    logger.info('Stripe webhook: Duplicate event detected, skipping processing', {
                        requestId,
                        eventId: webhookEvent.id,
                        eventType: webhookEvent.type,
                        existingRecord: idempotencyResult.existingRecord?.created_at
                    });
                    
                    return res.json({
                        received: true,
                        processed: false,
                        idempotent: true,
                        message: 'Event already processed'
                    });
                }
            }

            // Add security metadata to request
            req.webhookSecurity = {
                requestId,
                verified: true,
                timestamp: verification.timestamp,
                timestampAge: verification.timestampAge,
                idempotency: idempotencyResult,
                bodySize,
                processingStartTime: startTime
            };

            // Log successful validation
            if (logAllRequests) {
                logger.info('Stripe webhook: Security validation passed', {
                    requestId,
                    eventId: webhookEvent.id,
                    eventType: webhookEvent.type,
                    timestampAge: verification.timestampAge,
                    isNewEvent: idempotencyResult.isNew,
                    bodySize,
                    validationTime: Date.now() - startTime
                });
            }

            next();

        } catch (error) {
            logger.error('Stripe webhook: Security middleware error', {
                requestId,
                error: error.message,
                stack: error.stack,
                ip: req.ip
            });
            
            return res.status(500).json({
                success: false,
                error: 'Webhook security validation failed',
                code: 'SECURITY_ERROR'
            });
        }
    };
}

/**
 * Generic webhook security middleware
 * @param {Object} options - Security options
 * @returns {Function} Express middleware
 */
function genericWebhookSecurity(options = {}) {
    const {
        verifySignature = true,
        signatureHeader = 'x-hub-signature-256',
        secret = null,
        algorithm = 'sha256',
        enableRateLimit = true
    } = options;

    const middleware = [];
    
    if (enableRateLimit) {
        middleware.push(webhookRateLimit);
    }
    
    middleware.push((req, res, next) => {
        if (!verifySignature || !secret) {
            return next();
        }
        
        const signature = req.headers[signatureHeader.toLowerCase()];
        if (!signature) {
            logger.warn('Generic webhook: Missing signature header', {
                expectedHeader: signatureHeader,
                ip: req.ip
            });
            return res.status(401).json({
                success: false,
                error: 'Missing signature',
                code: 'MISSING_SIGNATURE'
            });
        }
        
        // Verify signature based on algorithm
        const expectedSignature = crypto
            .createHmac(algorithm, secret)
            .update(req.body)
            .digest('hex');
            
        const receivedSignature = signature.replace(`${algorithm}=`, '');
        
        const isValid = crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'hex'),
            Buffer.from(receivedSignature, 'hex')
        );
        
        if (!isValid) {
            logger.error('Generic webhook: Signature verification failed', {
                signatureHeader,
                ip: req.ip,
                userAgent: SafeUtils.safeString(req.get('User-Agent'))
            });
            
            return res.status(401).json({
                success: false,
                error: 'Invalid signature',
                code: 'INVALID_SIGNATURE'
            });
        }
        
        next();
    });
    
    return middleware;
}

/**
 * Cleanup expired idempotency records
 * @returns {Promise<Object>} Cleanup result
 */
async function cleanupExpiredIdempotencyRecords() {
    try {
        const { data, error } = await supabaseServiceClient
            .from('webhook_idempotency')
            .delete()
            .lt('expires_at', new Date().toISOString());

        if (error) {
            throw error;
        }

        logger.info('Cleaned up expired idempotency records', {
            recordsDeleted: data?.length || 0
        });

        return { success: true, recordsDeleted: data?.length || 0 };

    } catch (error) {
        logger.error('Failed to cleanup expired idempotency records', {
            error: error.message
        });
        return { success: false, error: error.message };
    }
}

module.exports = {
    stripeWebhookSecurity,
    genericWebhookSecurity,
    webhookRateLimit,
    verifyStripeSignature,
    checkIdempotency,
    detectSuspiciousWebhookPayload,
    cleanupExpiredIdempotencyRecords
};