/**
 * Encryption Utilities for Persona Fields
 *
 * Implements AES-256-GCM encryption/decryption for sensitive persona data.
 *
 * Security Features:
 * - AES-256-GCM (Galois/Counter Mode) for authenticated encryption
 * - Unique IV (Initialization Vector) per encryption
 * - Authentication tag prevents tampering
 * - No hardcoded keys (environment variable required)
 *
 * Storage Format:
 * Base64( IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext (variable) )
 *
 * @see docs/nodes/persona.md (lines 160-180) for architecture
 * @see database/migrations/001_add_persona_fields.sql for schema
 */

const crypto = require('crypto');
const logger = require('./logger');

// Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const TAG_LENGTH = 16; // 128 bits authentication tag
const KEY_LENGTH = 32; // 256 bits for AES-256

/**
 * Get encryption key from environment
 * @private
 * @returns {Buffer} 32-byte encryption key
 * @throws {Error} If PERSONA_ENCRYPTION_KEY not configured
 */
function getEncryptionKey() {
  const keyHex = process.env.PERSONA_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      'PERSONA_ENCRYPTION_KEY not configured. ' +
        'Generate key with: node scripts/generate-persona-key.js'
    );
  }

  if (keyHex.length !== KEY_LENGTH * 2) {
    // Hex string is 2x byte length
    throw new Error(
      `PERSONA_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes). ` +
        `Found: ${keyHex.length} characters`
    );
  }

  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param {string} plaintext - Text to encrypt (max 300 chars recommended)
 * @returns {string|null} Base64-encoded ciphertext (IV + tag + encrypted data)
 *
 * @example
 * const encrypted = encryptField('Soy desarrollador sarcástico');
 * // Returns: "pX3k2... (base64 string)"
 *
 * @security
 * - Generates unique IV per encryption (prevents pattern detection)
 * - Authentication tag prevents tampering
 * - Returns null for null/empty input (preserves NULL in database)
 */
function encryptField(plaintext) {
  // Handle null/empty values
  if (!plaintext || plaintext.trim().length === 0) {
    return null;
  }

  try {
    const key = getEncryptionKey();

    // Generate unique IV for this encryption
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt plaintext
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    // Get authentication tag (GCM mode)
    const tag = cipher.getAuthTag();

    // Combine: IV + Tag + Ciphertext
    const combined = Buffer.concat([iv, tag, encrypted]);

    // Return Base64-encoded for database storage
    return combined.toString('base64');
  } catch (error) {
    logger.error('Encryption failed', {
      error: error.message,
      plaintextLength: plaintext.length
    });
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param {string} ciphertext - Base64-encoded ciphertext (from database)
 * @returns {string|null} Decrypted plaintext
 *
 * @example
 * const decrypted = decryptField('pX3k2...');
 * // Returns: "Soy desarrollador sarcástico"
 *
 * @throws {Error} If ciphertext is corrupted or tampered
 * @security
 * - Authentication tag verification prevents tampering
 * - Fails fast on invalid data
 * - Returns null for null input (preserves database NULL)
 */
function decryptField(ciphertext) {
  // Handle null/empty values
  if (!ciphertext) {
    return null;
  }

  try {
    const key = getEncryptionKey();

    // Decode from Base64
    const combined = Buffer.from(ciphertext, 'base64');

    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);

    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid IV length');
    }
    if (tag.length !== TAG_LENGTH) {
      throw new Error('Invalid auth tag length');
    }
    if (encrypted.length === 0) {
      throw new Error('No ciphertext found');
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    // Security: Don't log ciphertext (may contain sensitive data)
    logger.error('Decryption failed', {
      error: error.message,
      ciphertextLength: ciphertext.length
    });
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Validate encryption key on startup
 *
 * Call this during application initialization to fail fast
 * if encryption key is not configured or invalid.
 *
 * @throws {Error} If key is missing or invalid
 *
 * @example
 * // In src/index.js
 * const { validateEncryptionKey } = require('./utils/encryption');
 * validateEncryptionKey(); // Throws if key invalid
 */
function validateEncryptionKey() {
  try {
    const key = getEncryptionKey();

    // Validate key length
    if (key.length !== KEY_LENGTH) {
      throw new Error(`Encryption key must be ${KEY_LENGTH} bytes, found ${key.length} bytes`);
    }

    // Test encryption/decryption round-trip
    const testPlaintext = 'Encryption key validation test';
    const encrypted = encryptField(testPlaintext);
    const decrypted = decryptField(encrypted);

    if (decrypted !== testPlaintext) {
      throw new Error('Encryption round-trip validation failed');
    }

    logger.info('Encryption key validated successfully', {
      algorithm: ALGORITHM,
      keyLength: KEY_LENGTH,
      ivLength: IV_LENGTH
    });
  } catch (error) {
    logger.error('Encryption key validation failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  encryptField,
  decryptField,
  validateEncryptionKey
};
