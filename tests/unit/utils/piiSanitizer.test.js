/**
 * Tests for PII Sanitization Utilities
 *
 * Ensures GDPR-compliant logging by verifying that email addresses
 * are properly hashed, masked, and sanitized before being logged.
 *
 * Related: CodeRabbit Review #3424304067 (C1, C2, C3 - CRITICAL)
 */

const {
  hashEmail,
  maskEmail,
  sanitizePII,
  looksLikeEmail
} = require('../../../src/utils/piiSanitizer');

describe('PII Sanitizer', () => {
  describe('hashEmail', () => {
    it('should generate consistent hash for same email', () => {
      const email = 'test@example.com';
      const hash1 = hashEmail(email);
      const hash2 = hashEmail(email);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
    });

    it('should generate different hashes for different emails', () => {
      const hash1 = hashEmail('user1@example.com');
      const hash2 = hashEmail('user2@example.com');

      expect(hash1).not.toBe(hash2);
    });

    it('should be case-insensitive', () => {
      const hash1 = hashEmail('Test@Example.COM');
      const hash2 = hashEmail('test@example.com');

      expect(hash1).toBe(hash2);
    });

    it('should trim whitespace', () => {
      const hash1 = hashEmail('  test@example.com  ');
      const hash2 = hashEmail('test@example.com');

      expect(hash1).toBe(hash2);
    });

    it('should handle null input', () => {
      expect(hashEmail(null)).toBe('invalid_email');
    });

    it('should handle undefined input', () => {
      expect(hashEmail(undefined)).toBe('invalid_email');
    });

    it('should handle empty string', () => {
      expect(hashEmail('')).toBe('invalid_email');
    });

    it('should handle non-string input', () => {
      expect(hashEmail(123)).toBe('invalid_email');
      expect(hashEmail({})).toBe('invalid_email');
      expect(hashEmail([])).toBe('invalid_email');
    });
  });

  describe('maskEmail', () => {
    it('should mask local part while keeping domain visible', () => {
      const masked = maskEmail('test@example.com');

      expect(masked).toMatch(/^t\*+@example\.com$/);
      expect(masked).toContain('@example.com');
    });

    it('should show first character of local part', () => {
      const masked = maskEmail('user@domain.org');

      expect(masked[0]).toBe('u');
      expect(masked).toContain('@domain.org');
    });

    it('should handle single-character local part', () => {
      const masked = maskEmail('a@example.com');

      expect(masked).toMatch(/^a\*+@example\.com$/);
    });

    it('should handle long local parts', () => {
      const masked = maskEmail('verylongemailaddress@example.com');

      expect(masked[0]).toBe('v');
      expect(masked).toContain('*');
      expect(masked).toContain('@example.com');
    });

    it('should handle null input', () => {
      expect(maskEmail(null)).toBe('[invalid]');
    });

    it('should handle undefined input', () => {
      expect(maskEmail(undefined)).toBe('[invalid]');
    });

    it('should handle empty string', () => {
      expect(maskEmail('')).toBe('[invalid]');
    });

    it('should handle malformed email (no @)', () => {
      expect(maskEmail('notanemail')).toBe('[malformed]');
    });

    it('should handle malformed email (multiple @)', () => {
      expect(maskEmail('bad@@example.com')).toBe('[malformed]');
    });

    it('should handle email with empty local part', () => {
      const masked = maskEmail('@example.com');

      expect(masked).toBe('[empty]@example.com');
    });

    it('should handle non-string input', () => {
      expect(maskEmail(123)).toBe('[invalid]');
      expect(maskEmail({})).toBe('[invalid]');
    });
  });

  describe('sanitizePII', () => {
    it('should sanitize customer_email field', () => {
      const input = {
        customer_email: 'user@example.com',
        order_id: '12345'
      };

      const result = sanitizePII(input);

      expect(result.customer_email).toMatch(/^u\*+@example\.com$/);
      expect(result.customer_email_hash).toBeDefined();
      expect(result.customer_email_hash).toHaveLength(16);
      expect(result.order_id).toBe('12345'); // Non-PII field unchanged
    });

    it('should sanitize email field', () => {
      const input = {
        email: 'test@example.com',
        metadata: 'some data'
      };

      const result = sanitizePII(input);

      expect(result.email).toMatch(/^t\*+@example\.com$/);
      expect(result.email_hash).toBeDefined();
      expect(result.metadata).toBe('some data');
    });

    it('should sanitize user_email field', () => {
      const input = {
        user_email: 'admin@example.com'
      };

      const result = sanitizePII(input);

      expect(result.user_email).toMatch(/^a\*+@example\.com$/);
      expect(result.user_email_hash).toBeDefined();
    });

    it('should sanitize multiple email fields', () => {
      const input = {
        email: 'user@example.com',
        customer_email: 'customer@example.com'
      };

      const result = sanitizePII(input);

      expect(result.email).toMatch(/^u\*+@example\.com$/);
      expect(result.email_hash).toBeDefined();
      expect(result.customer_email).toMatch(/^c\*+@example\.com$/);
      expect(result.customer_email_hash).toBeDefined();
    });

    it('should not mutate original object', () => {
      const input = {
        customer_email: 'user@example.com',
        order_id: '12345'
      };

      const originalEmail = input.customer_email;
      const result = sanitizePII(input);

      expect(input.customer_email).toBe(originalEmail); // Original unchanged
      expect(result.customer_email).not.toBe(originalEmail); // Result is different
    });

    it('should handle camelCase email fields', () => {
      const input = {
        userEmail: 'user@example.com',
        customerEmail: 'customer@example.com'
      };

      const result = sanitizePII(input);

      expect(result.userEmail).toMatch(/^u\*+@example\.com$/);
      expect(result.userEmail_hash).toBeDefined();
      expect(result.customerEmail).toMatch(/^c\*+@example\.com$/);
      expect(result.customerEmail_hash).toBeDefined();
    });

    it('should handle null input', () => {
      expect(sanitizePII(null)).toBeNull();
    });

    it('should handle undefined input', () => {
      expect(sanitizePII(undefined)).toBeUndefined();
    });

    it('should handle non-object input', () => {
      expect(sanitizePII('string')).toBe('string');
      expect(sanitizePII(123)).toBe(123);
    });

    it('should handle object with no email fields', () => {
      const input = {
        order_id: '12345',
        amount: 100
      };

      const result = sanitizePII(input);

      expect(result).toEqual(input);
    });

    it('should handle empty object', () => {
      const result = sanitizePII({});

      expect(result).toEqual({});
    });

    it('should preserve all non-PII fields', () => {
      const input = {
        customer_email: 'user@example.com',
        order_id: '12345',
        amount: 100,
        currency: 'EUR',
        metadata: { key: 'value' }
      };

      const result = sanitizePII(input);

      expect(result.order_id).toBe('12345');
      expect(result.amount).toBe(100);
      expect(result.currency).toBe('EUR');
      expect(result.metadata).toEqual({ key: 'value' });
    });
  });

  describe('looksLikeEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(looksLikeEmail('test@example.com')).toBe(true);
      expect(looksLikeEmail('user+tag@domain.org')).toBe(true);
      expect(looksLikeEmail('admin@sub.domain.com')).toBe(true);
    });

    it('should return false for invalid formats', () => {
      expect(looksLikeEmail('notanemail')).toBe(false);
      expect(looksLikeEmail('missing@domain')).toBe(false); // No TLD
      expect(looksLikeEmail('@example.com')).toBe(false); // No local part
      expect(looksLikeEmail('test@')).toBe(false); // No domain
    });

    it('should return false for non-string input', () => {
      expect(looksLikeEmail(null)).toBe(false);
      expect(looksLikeEmail(undefined)).toBe(false);
      expect(looksLikeEmail(123)).toBe(false);
      expect(looksLikeEmail({})).toBe(false);
      expect(looksLikeEmail([])).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(looksLikeEmail('')).toBe(false);
    });

    it('should return false for strings with spaces', () => {
      expect(looksLikeEmail('test test@example.com')).toBe(false);
      expect(looksLikeEmail('test@example .com')).toBe(false);
    });
  });

  describe('Integration: Real-world use cases', () => {
    it('should safely log checkout data', () => {
      const checkoutData = {
        customer_email: 'john.doe@example.com',
        price_id: 'price_123',
        amount: 1200,
        currency: 'EUR'
      };

      const safeData = sanitizePII(checkoutData);

      // Email is masked
      expect(safeData.customer_email).toMatch(/^j\*+@example\.com$/);
      expect(safeData.customer_email).not.toContain('john.doe');

      // Hash is available for correlation
      expect(safeData.customer_email_hash).toBeDefined();
      expect(safeData.customer_email_hash).toHaveLength(16);

      // Other data unchanged
      expect(safeData.price_id).toBe('price_123');
      expect(safeData.amount).toBe(1200);
      expect(safeData.currency).toBe('EUR');
    });

    it('should safely log webhook error', () => {
      const errorData = {
        error: 'User not found',
        customer_email: 'unknown@example.com',
        order_id: 'ord_456'
      };

      const safeData = sanitizePII(errorData);

      // Email is masked
      expect(safeData.customer_email).toMatch(/^u\*+@example\.com$/);

      // Hash allows correlation across logs
      const hash1 = safeData.customer_email_hash;
      const hash2 = hashEmail('unknown@example.com');
      expect(hash1).toBe(hash2);

      // Error details preserved
      expect(safeData.error).toBe('User not found');
      expect(safeData.order_id).toBe('ord_456');
    });

    it('should allow correlation across multiple logs', () => {
      const email = 'user@example.com';

      const log1 = sanitizePII({ customer_email: email, action: 'checkout' });
      const log2 = sanitizePII({ customer_email: email, action: 'payment_confirmed' });

      // Hashes are identical, allowing correlation
      expect(log1.customer_email_hash).toBe(log2.customer_email_hash);

      // But raw email is never logged
      expect(log1.customer_email).not.toBe(email);
      expect(log2.customer_email).not.toBe(email);
    });
  });
});
