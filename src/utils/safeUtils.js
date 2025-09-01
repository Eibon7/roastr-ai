/**
 * Safe utilities for handling sensitive data in logs and responses
 */

class SafeUtils {
  /**
   * Safely prefix user ID for logging (shows only first few characters)
   * @param {string} userId - The user ID to safely prefix
   * @returns {string} - Safe prefix of user ID
   */
  static safeUserIdPrefix(userId) {
    if (!userId || typeof userId !== 'string') {
      return 'unknown-user';
    }

    // Show first 4 characters maximum followed by asterisks
    return userId.slice(0, Math.min(4, userId.length)) + '****';
  }

  /**
   * Mask email address for safe logging
   * @param {string} email - The email to mask
   * @returns {string} - Masked email
   */
  static maskEmail(email) {
    if (!email || typeof email !== 'string') {
      return 'unknown-email';
    }

    const atIndex = email.indexOf('@');
    if (atIndex === -1) {
      // Invalid email format (no '@', missing local or domain)
      return '****@****';
    }

    const localPart = email.substring(0, atIndex);
    const domain = email.substring(atIndex + 1);

    // Check for missing local part or domain
    if (localPart.length === 0 || domain.length === 0) {
      return '****@****';
    }

    // For valid emails: reveal characters based on local part length
    if (localPart.length <= 3) {
      // Reveal first character + mask rest + '@' + domain
      return localPart.charAt(0) + '****@' + domain;
    } else {
      // Reveal first two characters + mask rest + '@' + domain
      return localPart.substring(0, 2) + '****@' + domain;
    }
  }

  /**
   * Safely truncate sensitive strings for logging
   * @param {string} str - String to truncate
   * @param {number} maxLength - Maximum length (default: 50)
   * @returns {string} - Safely truncated string
   */
  static safeTruncate(str, maxLength = 50) {
    if (!str || typeof str !== 'string') {
      return 'unknown-string';
    }

    if (str.length <= maxLength) {
      return str;
    }

    return str.substring(0, maxLength) + '...';
  }

  /**
   * Remove sensitive patterns from strings
   * @param {string} str - String to sanitize
   * @returns {string} - Sanitized string
   */
  static removeSensitivePatterns(str) {
    if (!str || typeof str !== 'string') {
      return str;
    }

    // Remove common sensitive patterns
    return str
      .replace(/password[=:]\s*\S+/gi, 'password=***')
      .replace(/token[=:]\s*\S+/gi, 'token=***')
      .replace(/key[=:]\s*\S+/gi, 'key=***')
      .replace(/secret[=:]\s*\S+/gi, 'secret=***');
  }
}

module.exports = SafeUtils;
