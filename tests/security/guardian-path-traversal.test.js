/**
 * Guardian API - Security Tests (Path Traversal)
 * CodeRabbit Review #3323742391
 *
 * Tests path traversal protection in Guardian case service
 * SECURITY: Validates that malicious caseId values are rejected
 */

const { validateCaseId, getCaseById } = require('../../src/services/guardianCaseService');

describe('Guardian Security - Path Traversal Protection', () => {
  describe('validateCaseId', () => {
    test('should reject path traversal with ../', () => {
      expect(() => {
        validateCaseId('../../../.env');
      }).toThrow('Invalid case ID: path traversal characters detected');
    });

    test('should reject path traversal with ../../', () => {
      expect(() => {
        validateCaseId('../../package.json');
      }).toThrow('Invalid case ID: path traversal characters detected');
    });

    test('should reject absolute path with /', () => {
      expect(() => {
        validateCaseId('/etc/passwd');
      }).toThrow('Invalid case ID: path traversal characters detected');
    });

    test('should reject Windows-style path traversal with \\', () => {
      expect(() => {
        validateCaseId('..\\..\\..\\secrets.json');
      }).toThrow('Invalid case ID: path traversal characters detected');
    });

    test('should reject null byte injection', () => {
      expect(() => {
        validateCaseId('valid\x00../../../.env');
      }).toThrow(); // Should throw any error (path traversal or format)
    });

    test('should reject special characters in path', () => {
      expect(() => {
        validateCaseId('CASE<script>alert(1)</script>');
      }).toThrow(); // Should throw any error (path traversal or format)
    });

    test('should reject empty string', () => {
      expect(() => {
        validateCaseId('');
      }).toThrow('Case ID must be a non-empty string');
    });

    test('should reject null', () => {
      expect(() => {
        validateCaseId(null);
      }).toThrow('Case ID must be a non-empty string');
    });

    test('should reject undefined', () => {
      expect(() => {
        validateCaseId(undefined);
      }).toThrow('Case ID must be a non-empty string');
    });

    test('should reject non-string types', () => {
      expect(() => {
        validateCaseId(12345);
      }).toThrow('Case ID must be a non-empty string');
    });

    test('should reject invalid format without timestamp pattern', () => {
      expect(() => {
        validateCaseId('INVALID-CASE-ID');
      }).toThrow('Invalid case ID format');
    });

    test('should accept valid case ID format', () => {
      const validCaseId = '2025-10-09-18-07-06-685';
      expect(validateCaseId(validCaseId)).toBe(validCaseId);
    });

    test('should accept valid case ID with leading zeros', () => {
      const validCaseId = '2025-01-01-00-00-00-001';
      expect(validateCaseId(validCaseId)).toBe(validCaseId);
    });
  });

  describe('getCaseById - Path Traversal Prevention', () => {
    test('should reject path traversal attempt in getCaseById', async () => {
      await expect(getCaseById('../../../.env'))
        .rejects.toThrow('Invalid case ID: path traversal characters detected');
    });

    test('should reject absolute path attempt in getCaseById', async () => {
      await expect(getCaseById('/etc/passwd'))
        .rejects.toThrow('Invalid case ID: path traversal characters detected');
    });

    test('should return null for non-existent valid case ID', async () => {
      const result = await getCaseById('2025-99-99-99-99-99-999');
      expect(result).toBeNull();
    });
  });
});
