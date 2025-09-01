// Simple logger utility

/**
 * Safe utilities for handling potentially undefined values
 * Issue #154: Optional chaining and safe string operations
 */
const SafeUtils = {
  /**
   * Safely extract a user ID prefix for logging without exposing full IDs
   * @param {string} userId - The user ID (may be undefined)
   * @param {number} length - Length of prefix (default: 8)
   * @returns {string} Safe user ID prefix or placeholder
   */
  safeUserIdPrefix(userId, length = 8) {
    if (!userId || typeof userId !== 'string') {
      return 'unknown-user';
    }
    return userId.length >= length ? userId.substr(0, length) + '...' : userId + '...';
  },

  /**
   * Safely mask an email address for logging without exposing PII
   * @param {string} email - The email address to mask
   * @returns {string|null} Masked email address or null when domain is missing/malformed
   */
  maskEmail(email) {
    if (!email || typeof email !== 'string') {
      return 'unknown-email';
    }

    const atIndex = email.indexOf('@');
    if (atIndex === -1) {
      return 'invalid-email';
    }

    // If there's no local part, treat as invalid input and return safe placeholder
    if (atIndex === 0) {
      return '[invalid email]'; // e.g., "@domain.com"
    }

    const localPart = email.substring(0, atIndex);
    const domain = email.substring(atIndex + 1);

    // If domain is missing or malformed, treat as invalid
    if (!domain || !domain.includes('.')) {
      return null; // e.g., "test@"
    }

    // Mask local part: keep first character, mask the rest
    // For single-character local parts, preserve the character instead of replacing with '*'
    const maskedLocal = localPart.length > 1
      ? localPart.charAt(0) + '*'.repeat(Math.min(localPart.length - 1, 6))
      : localPart.charAt(0);

    // Mask domain: keep first character and TLD, mask the middle
    const domainParts = domain.split('.');
    const domainName = domainParts[0];
    const tld = domainParts[domainParts.length - 1];
    const maskedDomain = domainName.length > 1
      ? domainName.charAt(0) + '*'.repeat(Math.min(domainName.length - 1, 4)) + '.' + tld
      : '***.' + tld;

    return maskedLocal + '@' + maskedDomain;
  },

  /**
   * Safely get a string value with optional fallback
   * @param {any} value - The value to safely convert to string
   * @param {string} fallback - Fallback value if undefined/null
   * @returns {string} Safe string value
   */
  safeString(value, fallback = '') {
    if (value === null || value === undefined) {
      return fallback;
    }
    return String(value);
  },

  /**
   * Safely perform string operations with optional chaining
   * @param {string} str - String to operate on
   * @param {string} operation - Operation name (substr, substring, slice, etc.)
   * @param {...any} args - Operation arguments
   * @returns {string} Result or empty string if unsafe
   */
  safeStringOperation(str, operation, ...args) {
    if (!str || typeof str !== 'string' || !str[operation]) {
      return '';
    }
    try {
      return str[operation](...args);
    } catch (error) {
      return '';
    }
  }
};

class Logger {
  static info(message, ...args) {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...args);
  }

  static error(message, ...args) {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...args);
  }

  static warn(message, ...args) {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...args);
  }

  static debug(message, ...args) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`, ...args);
    }
  }
}

// Export both ways for compatibility
module.exports = Logger;
module.exports.logger = Logger;
module.exports.SafeUtils = SafeUtils;