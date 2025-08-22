/**
 * Encryption Service for Sensitive Personal Data
 * Issue #148: Secure encryption/decryption for Roastr Persona fields
 * 
 * This service provides AES-256-CBC encryption with HMAC authentication 
 * for sensitive user data like the "lo que me define" field in Roastr Persona feature.
 * 
 * Security Features:
 * - AES-256-CBC encryption with HMAC-SHA256 authentication
 * - Unique IV per encryption operation
 * - HMAC verification for data integrity and authenticity
 * - Environment-based encryption key management
 * - Constant-time comparison to prevent timing attacks
 * 
 * Note: While GCM mode would provide authenticated encryption in a single operation,
 * CBC + HMAC provides equivalent security when implemented correctly.
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');

class EncryptionService {
    constructor() {
        // Get encryption key from environment or generate a default one for development
        this.encryptionKey = this.getEncryptionKey();
        this.algorithm = 'aes-256-cbc';
        this.ivLength = 16; // 128-bit IV for CBC
    }

    /**
     * Get encryption key from environment variables
     * In production, this should be a secure 32-byte key
     */
    getEncryptionKey() {
        const envKey = process.env.ROASTR_ENCRYPTION_KEY;
        
        if (envKey) {
            // Convert hex string to buffer
            if (envKey.length === 64) { // 32 bytes in hex
                return Buffer.from(envKey, 'hex');
            } else {
                logger.warn('ROASTR_ENCRYPTION_KEY should be 64 hex characters (32 bytes)');
            }
        }

        // For development/testing, generate a deterministic key
        // In production, this should be set via environment variable
        const defaultKey = crypto.scryptSync('roastr-persona-key', 'salt', 32);
        
        if (process.env.NODE_ENV === 'production') {
            logger.error('ROASTR_ENCRYPTION_KEY not set in production environment');
            throw new Error('Encryption key not configured for production');
        }

        logger.warn('Using default encryption key for development/testing');
        return defaultKey;
    }

    /**
     * Encrypt sensitive text data
     * @param {string} plaintext - The text to encrypt (max 300 chars for Roastr Persona)
     * @returns {string} Base64 encoded encrypted data with IV and auth tag
     */
    encrypt(plaintext) {
        try {
            if (!plaintext || typeof plaintext !== 'string') {
                throw new Error('Plaintext must be a non-empty string');
            }

            // Validate length (300 chars max for Roastr Persona)
            if (plaintext.length > 300) {
                throw new Error('Plaintext exceeds maximum length of 300 characters');
            }

            // Generate random IV
            const iv = crypto.randomBytes(this.ivLength);
            
            // Create cipher using CBC mode
            const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
            
            // Encrypt the data
            let encrypted = cipher.update(plaintext, 'utf8');
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            
            // Create HMAC for authentication (encrypt-then-MAC approach)
            // This provides authenticity and integrity similar to GCM mode
            const hmac = crypto.createHmac('sha256', this.encryptionKey);
            hmac.update(Buffer.concat([iv, encrypted]));
            const tag = hmac.digest();
            
            // Combine IV + encrypted data + HMAC tag
            const combined = Buffer.concat([iv, encrypted, tag]);
            
            // Return base64 encoded result
            return combined.toString('base64');
            
        } catch (error) {
            logger.error('Encryption failed:', {
                error: error.message,
                plaintextLength: plaintext?.length
            });
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt encrypted data
     * @param {string} encryptedData - Base64 encoded encrypted data
     * @returns {string} Decrypted plaintext
     */
    decrypt(encryptedData) {
        try {
            if (!encryptedData || typeof encryptedData !== 'string') {
                throw new Error('Encrypted data must be a non-empty string');
            }

            // Decode from base64
            const combined = Buffer.from(encryptedData, 'base64');
            
            // Validate minimum buffer length before slicing
            const tagLength = 32; // SHA256 HMAC is 32 bytes
            const minLength = this.ivLength + tagLength + 1; // IV + tag + at least 1 byte of encrypted data
            
            if (combined.length < minLength) {
                throw new Error('Invalid encrypted data format - insufficient length');
            }
            
            // Extract IV, encrypted data, and HMAC tag (32 bytes for SHA256)
            const iv = combined.slice(0, this.ivLength);
            const tag = combined.slice(-tagLength);
            const encrypted = combined.slice(this.ivLength, -tagLength);
            
            // Verify HMAC tag first
            const hmac = crypto.createHmac('sha256', this.encryptionKey);
            hmac.update(Buffer.concat([iv, encrypted]));
            const expectedTag = hmac.digest();
            
            if (!crypto.timingSafeEqual(tag, expectedTag)) {
                throw new Error('Authentication failed - data may have been tampered with');
            }
            
            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
            
            // Decrypt the data
            let decrypted = decipher.update(encrypted, null, 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
            
        } catch (error) {
            logger.error('Decryption failed:', {
                error: error.message,
                encryptedDataLength: encryptedData?.length
            });
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Securely compare two values using constant-time comparison
     * Prevents timing attacks on encrypted data comparison
     */
    secureCompare(a, b) {
        if (!a || !b || a.length !== b.length) {
            return false;
        }
        
        return crypto.timingSafeEqual(
            Buffer.from(a, 'utf8'),
            Buffer.from(b, 'utf8')
        );
    }

    /**
     * Generate a secure hash for indexing encrypted data
     * This allows searching without decrypting, but doesn't reveal content
     */
    generateSearchHash(plaintext) {
        if (!plaintext || typeof plaintext !== 'string') {
            return null;
        }
        
        const hash = crypto.createHmac('sha256', this.encryptionKey);
        hash.update(plaintext.toLowerCase().trim());
        return hash.digest('hex');
    }

    /**
     * Validate that encrypted data can be successfully decrypted
     * Used for data integrity verification
     */
    validateEncryptedData(encryptedData) {
        try {
            const decrypted = this.decrypt(encryptedData);
            return {
                valid: true,
                length: decrypted.length
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Sanitize and prepare text for encryption
     * Removes potential security risks and normalizes content
     */
    sanitizeForEncryption(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        // Trim whitespace and normalize
        let sanitized = text.trim();
        
        // Remove null bytes and control characters (except newlines/tabs)
        sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        // Limit length
        if (sanitized.length > 300) {
            sanitized = sanitized.substring(0, 300);
        }
        
        return sanitized;
    }
}

// Export singleton instance
module.exports = new EncryptionService();