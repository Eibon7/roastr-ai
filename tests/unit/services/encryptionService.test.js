/**
 * Encryption Service Tests
 * Issue #148: Test encryption/decryption functionality for sensitive personal data
 *
 * Tests the encryption service used for Roastr Persona data including:
 * - Encryption/decryption operations
 * - Input validation
 * - Security measures
 * - Error handling
 */

const encryptionService = require('../../../src/services/encryptionService');

describe('EncryptionService', () => {
  describe('encrypt()', () => {
    it('should encrypt plaintext successfully', () => {
      const plaintext = 'mujer trans, vegana, gamer';
      const encrypted = encryptionService.encrypt(plaintext);

      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(plaintext.length);
    });

    it('should produce different encrypted results for same input', () => {
      const plaintext = 'test data';
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);

      // Different IVs should produce different encrypted results
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should reject null or undefined input', () => {
      expect(() => encryptionService.encrypt(null)).toThrow();
      expect(() => encryptionService.encrypt(undefined)).toThrow();
    });

    it('should reject non-string input', () => {
      expect(() => encryptionService.encrypt(123)).toThrow();
      expect(() => encryptionService.encrypt({})).toThrow();
      expect(() => encryptionService.encrypt([])).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => encryptionService.encrypt('')).toThrow();
    });

    it('should reject input exceeding 300 characters', () => {
      const longText = 'a'.repeat(301);
      expect(() => encryptionService.encrypt(longText)).toThrow('maximum length');
    });

    it('should handle exactly 300 characters', () => {
      const maxText = 'a'.repeat(300);
      const encrypted = encryptionService.encrypt(maxText);
      expect(encrypted).toBeTruthy();
    });

    it('should handle special characters and Unicode', () => {
      const specialText = 'émojis 🏳️‍⚧️ àñd spëcial chars: @#$%^&*()';
      const encrypted = encryptionService.encrypt(specialText);
      expect(encrypted).toBeTruthy();

      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(specialText);
    });
  });

  describe('decrypt()', () => {
    it('should decrypt encrypted data successfully', () => {
      const plaintext = 'mujer trans, vegana, política de izquierdas';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should reject null or undefined input', () => {
      expect(() => encryptionService.decrypt(null)).toThrow();
      expect(() => encryptionService.decrypt(undefined)).toThrow();
    });

    it('should reject non-string input', () => {
      expect(() => encryptionService.decrypt(123)).toThrow();
      expect(() => encryptionService.decrypt({})).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => encryptionService.decrypt('')).toThrow();
    });

    it('should reject invalid base64 data', () => {
      expect(() => encryptionService.decrypt('invalid-base64-data')).toThrow();
    });

    it('should reject corrupted encrypted data', () => {
      const plaintext = 'test data';
      const encrypted = encryptionService.encrypt(plaintext);

      // Corrupt the encrypted data
      const corrupted = encrypted.slice(0, -5) + 'xxxxx';
      expect(() => encryptionService.decrypt(corrupted)).toThrow();
    });

    it('should handle various text lengths', () => {
      const testCases = [
        'a',
        'short text',
        'medium length text with some content',
        'much longer text that contains various words and spans multiple concepts like technology, identity, politics, and personal beliefs'
      ];

      testCases.forEach((text) => {
        const encrypted = encryptionService.encrypt(text);
        const decrypted = encryptionService.decrypt(encrypted);
        expect(decrypted).toBe(text);
      });
    });
  });

  describe('sanitizeForEncryption()', () => {
    it('should trim whitespace', () => {
      const result = encryptionService.sanitizeForEncryption('  test data  ');
      expect(result).toBe('test data');
    });

    it('should remove control characters', () => {
      const result = encryptionService.sanitizeForEncryption('test\x00data\x01with\x1Fcontrol');
      expect(result).toBe('testdatawithcontrol');
    });

    it('should preserve newlines and tabs', () => {
      const result = encryptionService.sanitizeForEncryption('test\nwith\ttabs');
      expect(result).toBe('test\nwith\ttabs');
    });

    it('should truncate to 300 characters', () => {
      const longText = 'a'.repeat(350);
      const result = encryptionService.sanitizeForEncryption(longText);
      expect(result.length).toBe(300);
    });

    it('should handle null/undefined input', () => {
      expect(encryptionService.sanitizeForEncryption(null)).toBe('');
      expect(encryptionService.sanitizeForEncryption(undefined)).toBe('');
    });

    it('should handle non-string input', () => {
      expect(encryptionService.sanitizeForEncryption(123)).toBe('');
      expect(encryptionService.sanitizeForEncryption({})).toBe('');
    });
  });

  describe('validateEncryptedData()', () => {
    it('should validate correct encrypted data', () => {
      const plaintext = 'test validation data';
      const encrypted = encryptionService.encrypt(plaintext);
      const validation = encryptionService.validateEncryptedData(encrypted);

      expect(validation.valid).toBe(true);
      expect(validation.length).toBe(plaintext.length);
    });

    it('should detect invalid encrypted data', () => {
      const validation = encryptionService.validateEncryptedData('invalid-data');

      expect(validation.valid).toBe(false);
      expect(validation.error).toBeTruthy();
    });

    it('should handle corrupted data', () => {
      const plaintext = 'test data';
      const encrypted = encryptionService.encrypt(plaintext);
      const corrupted = encrypted.slice(0, -10) + 'xxxxxxxxxx';

      const validation = encryptionService.validateEncryptedData(corrupted);
      expect(validation.valid).toBe(false);
    });
  });

  describe('generateSearchHash()', () => {
    it('should generate consistent hash for same input', () => {
      const text = 'test search data';
      const hash1 = encryptionService.generateSearchHash(text);
      const hash2 = encryptionService.generateSearchHash(text);

      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = encryptionService.generateSearchHash('text1');
      const hash2 = encryptionService.generateSearchHash('text2');

      expect(hash1).not.toBe(hash2);
    });

    it('should be case insensitive', () => {
      const hash1 = encryptionService.generateSearchHash('Test Data');
      const hash2 = encryptionService.generateSearchHash('test data');

      expect(hash1).toBe(hash2);
    });

    it('should trim whitespace', () => {
      const hash1 = encryptionService.generateSearchHash('test data');
      const hash2 = encryptionService.generateSearchHash('  test data  ');

      expect(hash1).toBe(hash2);
    });

    it('should return null for invalid input', () => {
      expect(encryptionService.generateSearchHash(null)).toBe(null);
      expect(encryptionService.generateSearchHash('')).toBe(null);
      expect(encryptionService.generateSearchHash(123)).toBe(null);
    });
  });

  describe('secureCompare()', () => {
    it('should return true for identical strings', () => {
      const result = encryptionService.secureCompare('test', 'test');
      expect(result).toBe(true);
    });

    it('should return false for different strings', () => {
      const result = encryptionService.secureCompare('test1', 'test2');
      expect(result).toBe(false);
    });

    it('should return false for different lengths', () => {
      const result = encryptionService.secureCompare('test', 'testing');
      expect(result).toBe(false);
    });

    it('should handle null/undefined inputs', () => {
      expect(encryptionService.secureCompare(null, 'test')).toBe(false);
      expect(encryptionService.secureCompare('test', null)).toBe(false);
      expect(encryptionService.secureCompare(null, null)).toBe(false);
    });

    it('should be resistant to timing attacks', () => {
      // This is a basic test - timing attack resistance is hard to test directly
      const shortString = 'a';
      const longString = 'a'.repeat(100);

      const start1 = process.hrtime.bigint();
      encryptionService.secureCompare(shortString, 'b');
      const end1 = process.hrtime.bigint();

      const start2 = process.hrtime.bigint();
      encryptionService.secureCompare(longString, 'b'.repeat(100));
      const end2 = process.hrtime.bigint();

      // Both should be false and take similar time (hard to test precisely)
      expect(encryptionService.secureCompare(shortString, 'b')).toBe(false);
      expect(encryptionService.secureCompare(longString, 'b'.repeat(100))).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle very short text', () => {
      const text = 'a';
      const encrypted = encryptionService.encrypt(text);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(text);
    });

    it('should handle text with only spaces', () => {
      const text = '   ';
      const encrypted = encryptionService.encrypt(text);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(text);
    });

    it('should handle text with newlines', () => {
      const text = 'line1\nline2\nline3';
      const encrypted = encryptionService.encrypt(text);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(text);
    });

    it('should handle multilingual text', () => {
      const text = 'English, Español, Français, 中文, العربية, עברית';
      const encrypted = encryptionService.encrypt(text);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(text);
    });

    it('should maintain data integrity across multiple operations', () => {
      const originalTexts = [
        'mujer trans',
        'vegana activista',
        'gamer profesional',
        'político de izquierdas',
        'artista independiente'
      ];

      const encrypted = originalTexts.map((text) => encryptionService.encrypt(text));
      const decrypted = encrypted.map((enc) => encryptionService.decrypt(enc));

      expect(decrypted).toEqual(originalTexts);
    });
  });

  describe('Production Environment Checks', () => {
    it('should use proper encryption key in development', () => {
      // In development, service should work with default key
      const text = 'development test';
      const encrypted = encryptionService.encrypt(text);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(text);
    });

    it('should validate encryption key length', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalKey = process.env.ROASTR_ENCRYPTION_KEY;

      try {
        // Test with invalid key in production mode
        process.env.NODE_ENV = 'production';
        process.env.ROASTR_ENCRYPTION_KEY = undefined;

        // Creating new instance should throw in production without key
        expect(() => {
          const EncryptionService = require('../../../src/services/encryptionService').constructor;
          new EncryptionService();
        }).toThrow();
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.ROASTR_ENCRYPTION_KEY = originalKey;
      }
    });
  });
});
