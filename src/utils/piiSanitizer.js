/**
 * PII Sanitization Utilities
 *
 * Provides functions to sanitize Personally Identifiable Information (PII)
 * before logging to ensure GDPR compliance and prevent data leaks.
 *
 * Related: CodeRabbit Review #3424304067 (C1, C2, C3 - CRITICAL)
 */

const crypto = require('crypto');

/**
 * Generate SHA-256 hash of email for correlation without exposing PII
 *
 * This allows you to track the same user across logs without storing their actual email.
 * The hash is deterministic (same email = same hash) but irreversible.
 *
 * @param {string} email - Email address to hash
 * @returns {string} First 16 characters of SHA-256 hash (sufficient for correlation)
 *
 * @example
 * hashEmail('user@example.com')
 * // Returns: '5e884898da2804...' (16 chars)
 */
function hashEmail(email) {
  if (!email || typeof email !== 'string') {
    return 'invalid_email';
  }

  try {
    return crypto
      .createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest('hex')
      .substring(0, 16);
  } catch (error) {
    return 'hash_error';
  }
}

/**
 * Mask email address for safe logging
 *
 * Shows first character of local part and full domain.
 * Provides just enough context for debugging without exposing full email.
 *
 * @param {string} email - Email address to mask
 * @returns {string} Masked email (e.g., 't*****@example.com')
 *
 * @example
 * maskEmail('test@example.com')
 * // Returns: 't****@example.com'
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') {
    return '[invalid]';
  }

  try {
    const parts = email.split('@');
    if (parts.length !== 2) {
      return '[malformed]';
    }

    const [local, domain] = parts;
    if (local.length === 0) {
      return `[empty]@${domain}`;
    }

    // Show first char + asterisks + domain
    const maskedLocal = local[0] + '*'.repeat(Math.max(local.length - 1, 4));
    return `${maskedLocal}@${domain}`;
  } catch (error) {
    return '[mask_error]';
  }
}

/**
 * Sanitize object containing PII before logging
 *
 * Replaces raw email fields with masked versions and adds hash for correlation.
 * Works on common PII field names: email, customer_email, user_email
 *
 * @param {Object} data - Object potentially containing PII
 * @returns {Object} New object with PII fields sanitized
 *
 * @example
 * sanitizePII({ customer_email: 'user@example.com', order_id: '123' })
 * // Returns: {
 * //   customer_email: 't****@example.com',
 * //   customer_email_hash: '5e884898da2804',
 * //   order_id: '123'
 * // }
 */
function sanitizePII(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Create shallow copy to avoid mutating original
  const sanitized = { ...data };

  // List of common PII field names to sanitize
  const emailFields = ['email', 'customer_email', 'user_email', 'userEmail', 'customerEmail'];

  emailFields.forEach((field) => {
    if (sanitized[field]) {
      const originalEmail = sanitized[field];

      // Replace with masked version
      sanitized[field] = maskEmail(originalEmail);

      // Add hash for correlation (use original field name + _hash)
      sanitized[`${field}_hash`] = hashEmail(originalEmail);
    }
  });

  return sanitized;
}

/**
 * Check if value appears to be an email address
 *
 * Simple heuristic to detect if a string looks like an email.
 * Used to prevent accidental logging of emails in generic fields.
 *
 * @param {any} value - Value to check
 * @returns {boolean} True if value looks like an email
 */
function looksLikeEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }

  // Simple regex: contains @ and a dot after it
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

module.exports = {
  hashEmail,
  maskEmail,
  sanitizePII,
  looksLikeEmail
};
