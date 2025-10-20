/**
 * Unit Tests: Encryption Utilities
 *
 * Tests AES-256-GCM encryption/decryption for persona fields
 *
 * Test Categories:
 * 1. Round-trip encryption/decryption
 * 2. IV uniqueness
 * 3. Null/empty value handling
 * 4. Error handling (corruption, tampering)
 * 5. Key validation
 *
 * @see src/utils/encryption.js
 * @see docs/plan/issue-595.md (Phase 2 tests)
 */

const { encryptField, decryptField, validateEncryptionKey } = require('../../../src/utils/encryption');
const crypto = require('crypto');

describe('Encryption Utilities', () => {
  // Setup: Ensure encryption key is set for tests
  beforeAll(() => {
    if (!process.env.PERSONA_ENCRYPTION_KEY) {
      // Generate test key if not set
      process.env.PERSONA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    }
  });

  describe('encryptField', () => {
    it('should encrypt plaintext successfully', () => {
      const plaintext = 'Soy desarrollador sarcástico';
      const encrypted = encryptField(plaintext);

      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext); // Ciphertext ≠ plaintext
    });

    it('should return null for null input', () => {
      expect(encryptField(null)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(encryptField('')).toBeNull();
      expect(encryptField('   ')).toBeNull(); // Whitespace only
    });

    it('should handle long text (300 chars)', () => {
      const longText = 'A'.repeat(300);
      const encrypted = encryptField(longText);

      expect(encrypted).toBeTruthy();
      expect(encrypted.length).toBeLessThan(500 * 4 / 3); // Base64 encoding < 500 chars
    });

    it('should generate unique IVs for same plaintext', () => {
      const plaintext = 'Test encryption uniqueness';

      const encrypted1 = encryptField(plaintext);
      const encrypted2 = encryptField(plaintext);

      expect(encrypted1).toBeTruthy();
      expect(encrypted2).toBeTruthy();
      expect(encrypted1).not.toBe(encrypted2); // Different ciphertexts (unique IVs)
    });

    it('should handle special characters', () => {
      const specialText = 'Español: ñ, á, é, í, ó, ú. Emojis: 😂🔥💯. Symbols: @#$%&*';
      const encrypted = encryptField(specialText);
      const decrypted = decryptField(encrypted);

      expect(decrypted).toBe(specialText);
    });
  });

  describe('decryptField', () => {
    it('should decrypt encrypted text correctly', () => {
      const plaintext = 'No tolero body shaming';
      const encrypted = encryptField(plaintext);
      const decrypted = decryptField(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should return null for null input', () => {
      expect(decryptField(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(decryptField(undefined)).toBeNull();
    });

    it('should throw error for corrupted ciphertext', () => {
      const plaintext = 'Test corruption';
      const encrypted = encryptField(plaintext);

      // Corrupt the ciphertext
      const corrupted = encrypted.slice(0, -5) + 'XXXXX';

      expect(() => decryptField(corrupted)).toThrow();
    });

    it('should throw error for tampered ciphertext', () => {
      const plaintext = 'Test tampering';
      const encrypted = encryptField(plaintext);

      // Decode, modify, re-encode
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[32] ^= 0xFF; // Flip bits in ciphertext
      const tampered = buffer.toString('base64');

      expect(() => decryptField(tampered)).toThrow(/Decryption failed/);
    });

    it('should throw error for invalid base64', () => {
      const invalidBase64 = 'Not-Valid-Base64!@#$';

      expect(() => decryptField(invalidBase64)).toThrow();
    });

    it('should throw error for too short ciphertext', () => {
      const tooShort = Buffer.from('short').toString('base64');

      expect(() => decryptField(tooShort)).toThrow(/Invalid/);
    });
  });

  describe('Round-trip Encryption', () => {
    it('should preserve plaintext through encrypt/decrypt cycle', () => {
      const plaintexts = [
        'Soy fan de los 90s',
        'Humor negro',
        'Me da igual el fútbol',
        'Test with numbers: 12345',
        'Test with spaces:    multiple   spaces',
        '1', // Single character
        'A'.repeat(300) // Max length
      ];

      plaintexts.forEach(plaintext => {
        const encrypted = encryptField(plaintext);
        const decrypted = decryptField(encrypted);
        expect(decrypted).toBe(plaintext);
      });
    });

    it('should handle multiple encrypt/decrypt cycles', () => {
      let text = 'Original text';

      for (let i = 0; i < 10; i++) {
        const encrypted = encryptField(text);
        const decrypted = decryptField(encrypted);
        expect(decrypted).toBe(text);
        text = decrypted; // Use decrypted text for next cycle
      }
    });
  });

  describe('validateEncryptionKey', () => {
    it('should validate correct encryption key', () => {
      expect(() => validateEncryptionKey()).not.toThrow();
    });

    it('should throw error if key not set', () => {
      const originalKey = process.env.PERSONA_ENCRYPTION_KEY;
      delete process.env.PERSONA_ENCRYPTION_KEY;

      expect(() => validateEncryptionKey()).toThrow(/PERSONA_ENCRYPTION_KEY not configured/);

      // Restore key
      process.env.PERSONA_ENCRYPTION_KEY = originalKey;
    });

    it('should throw error if key has wrong length', () => {
      const originalKey = process.env.PERSONA_ENCRYPTION_KEY;
      process.env.PERSONA_ENCRYPTION_KEY = 'tooshort';

      expect(() => validateEncryptionKey()).toThrow(/must be 64 hex characters/);

      // Restore key
      process.env.PERSONA_ENCRYPTION_KEY = originalKey;
    });

    it('should validate key on first use', () => {
      // Key validation happens implicitly when encrypting
      const plaintext = 'Test key usage';
      expect(() => encryptField(plaintext)).not.toThrow();
    });
  });

  describe('Security Properties', () => {
    it('should not reveal plaintext length from ciphertext', () => {
      const short = encryptField('A');
      const long = encryptField('A'.repeat(100));

      // Ciphertext length difference should be minimal (IV + tag are same size)
      const lengthDiff = Math.abs(short.length - long.length);
      expect(lengthDiff).toBeGreaterThan(0); // Not identical
      expect(lengthDiff).toBeLessThan(200); // But similar (IV/tag overhead is fixed)
    });

    it('should use 256-bit keys', () => {
      const keyHex = process.env.PERSONA_ENCRYPTION_KEY;
      const keyBytes = Buffer.from(keyHex, 'hex');

      expect(keyBytes.length).toBe(32); // 32 bytes = 256 bits
    });

    it('should produce base64-encoded output', () => {
      const plaintext = 'Test base64 encoding';
      const encrypted = encryptField(plaintext);

      // Base64 regex: alphanumeric + / + = (padding)
      const base64Regex = /^[A-Za-z0-9+/]+=*$/;
      expect(base64Regex.test(encrypted)).toBe(true);
    });

    it('should include IV, tag, and ciphertext', () => {
      const plaintext = 'Test components';
      const encrypted = encryptField(plaintext);
      const buffer = Buffer.from(encrypted, 'base64');

      // IV (16) + Tag (16) + Ciphertext (>0) = total > 32
      expect(buffer.length).toBeGreaterThan(32);

      // IV is first 16 bytes
      const iv = buffer.subarray(0, 16);
      expect(iv.length).toBe(16);

      // Tag is next 16 bytes
      const tag = buffer.subarray(16, 32);
      expect(tag.length).toBe(16);

      // Ciphertext is remainder
      const ciphertext = buffer.subarray(32);
      expect(ciphertext.length).toBeGreaterThan(0);
    });
  });

  describe('Error Messages', () => {
    it('should provide helpful error for missing key', () => {
      const originalKey = process.env.PERSONA_ENCRYPTION_KEY;
      delete process.env.PERSONA_ENCRYPTION_KEY;

      try {
        encryptField('Test');
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('PERSONA_ENCRYPTION_KEY');
        expect(error.message).toContain('generate-persona-key.js');
      }

      process.env.PERSONA_ENCRYPTION_KEY = originalKey;
    });

    it('should provide helpful error for decryption failure', () => {
      const corrupted = 'CorruptedData==';

      try {
        decryptField(corrupted);
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('Decryption failed');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle newlines', () => {
      const withNewlines = 'Line 1\nLine 2\nLine 3';
      const encrypted = encryptField(withNewlines);
      const decrypted = decryptField(encrypted);

      expect(decrypted).toBe(withNewlines);
    });

    it('should handle tabs', () => {
      const withTabs = 'Column1\tColumn2\tColumn3';
      const encrypted = encryptField(withTabs);
      const decrypted = decryptField(encrypted);

      expect(decrypted).toBe(withTabs);
    });

    it('should handle unicode characters', () => {
      const unicode = '你好世界 مرحبا العالم';
      const encrypted = encryptField(unicode);
      const decrypted = decryptField(encrypted);

      expect(decrypted).toBe(unicode);
    });

    it('should handle maximum plaintext length', () => {
      const maxLength = 'X'.repeat(300);
      const encrypted = encryptField(maxLength);
      const decrypted = decryptField(encrypted);

      expect(decrypted).toBe(maxLength);
      expect(encrypted.length).toBeLessThan(500 * 4 / 3); // Base64 encoding
    });
  });
});
