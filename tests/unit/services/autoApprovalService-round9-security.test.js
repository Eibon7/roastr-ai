/**
 * AutoApprovalService Round 9 Security Enhancements Test Suite
 * Tests for ultra-critical security patterns from CodeRabbit Review #3277389459
 */

const AutoApprovalService = require('../../../src/services/autoApprovalService');
const { logger } = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    select: jest.fn(),
    from: jest.fn(),
    single: jest.fn()
  }
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../../src/services/shieldService', () => {
  return jest.fn().mockImplementation(() => ({
    analyzeContent: jest.fn()
  }));
});

jest.mock('../../../src/services/transparencyService', () => ({
  isTransparencyRequired: jest.fn(),
  applyTransparency: jest.fn()
}));

jest.mock('../../../src/services/planLimitsService', () => ({}));

describe('AutoApprovalService - Round 9 Security Enhancements', () => {
  let service;

  beforeEach(() => {
    service = new AutoApprovalService();
    jest.clearAllMocks();
  });

  describe('generateContentChecksum() - SHA-256 Content Integrity', () => {
    test('should generate SHA-256 checksum for valid text', () => {
      const text = 'Test content for checksum generation';
      const checksum = service.generateContentChecksum(text);
      
      expect(checksum).toBeTruthy();
      expect(typeof checksum).toBe('string');
      expect(checksum).toHaveLength(64); // SHA-256 hex digest length
      
      // Verify deterministic behavior
      const checksum2 = service.generateContentChecksum(text);
      expect(checksum).toBe(checksum2);
    });

    test('should handle invalid input types with warning log', () => {
      const invalidInputs = [null, undefined, 123, [], {}, true];
      
      invalidInputs.forEach(input => {
        const checksum = service.generateContentChecksum(input);
        expect(checksum).toBeNull();
      });
      
      expect(logger.warn).toHaveBeenCalledTimes(invalidInputs.length);
      expect(logger.warn).toHaveBeenCalledWith(
        'Content checksum generation failed: Invalid text type',
        expect.any(Object)
      );
    });

    test('should handle empty string correctly', () => {
      const checksum = service.generateContentChecksum('');
      expect(checksum).toBeTruthy();
      expect(typeof checksum).toBe('string');
      expect(checksum).toHaveLength(64);
    });

    test('should generate different checksums for different content', () => {
      const text1 = 'Content A';
      const text2 = 'Content B';
      
      const checksum1 = service.generateContentChecksum(text1);
      const checksum2 = service.generateContentChecksum(text2);
      
      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('validateContentIntegrityUltra() - Critical Security Validation', () => {
    test('should validate matching content with exact match and checksum verification', () => {
      const approvedText = 'Esta es una respuesta aprobada';
      const storedText = 'Esta es una respuesta aprobada';
      const organizationId = 'test-org-123';
      
      const result = service.validateContentIntegrityUltra(approvedText, storedText, organizationId);
      
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('content_integrity_verified');
      expect(result.validationId).toBeTruthy();
      expect(result.checksum).toBeTruthy();
      expect(result.critical).toBeUndefined();
      
      expect(logger.info).toHaveBeenCalledWith(
        'Content integrity validation passed',
        expect.objectContaining({
          organizationId,
          validationId: expect.any(String),
          checksum: expect.any(String),
          contentLength: approvedText.length
        })
      );
    });

    test('should detect content mismatch with detailed security logging', () => {
      const approvedText = 'Texto aprobado original';
      const storedText = 'Texto modificado maliciosamente';
      const organizationId = 'test-org-123';
      
      const result = service.validateContentIntegrityUltra(approvedText, storedText, organizationId);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('content_integrity_mismatch');
      expect(result.critical).toBe(true);
      expect(result.details).toEqual({
        exactMatch: false,
        checksumMatch: false,
        approvedLength: approvedText.length,
        storedLength: storedText.length
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        'CRITICAL: Content integrity mismatch detected - auto-publication blocked',
        expect.objectContaining({
          organizationId,
          exactMatch: false,
          checksumMatch: false,
          securityThreat: 'high'
        })
      );
    });

    test('should fail closed on checksum generation errors', () => {
      const organizationId = 'test-org-123';
      
      // Test with invalid text types that would cause checksum generation to fail
      const result = service.validateContentIntegrityUltra(null, 'valid text', organizationId);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('checksum_generation_failed');
      expect(result.critical).toBe(true);
      
      expect(logger.error).toHaveBeenCalledWith(
        'CRITICAL: Content integrity validation failed - checksum generation error',
        expect.objectContaining({
          organizationId,
          reason: 'checksum_generation_failed'
        })
      );
    });

    test('should handle system errors with fail-closed pattern', () => {
      const organizationId = 'test-org-123';
      
      // Mock crypto.createHash to throw an error
      const originalCrypto = require('crypto');
      jest.spyOn(originalCrypto, 'createHash').mockImplementation(() => {
        throw new Error('Crypto system failure');
      });
      
      const result = service.validateContentIntegrityUltra('text1', 'text2', organizationId);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('validation_system_error');
      expect(result.critical).toBe(true);
      expect(result.error).toBe('Crypto system failure');
      
      expect(logger.error).toHaveBeenCalledWith(
        'CRITICAL: Content integrity validation system error - failing closed',
        expect.objectContaining({
          organizationId,
          error: 'Crypto system failure',
          reason: 'validation_system_error'
        })
      );
      
      // Restore original implementation
      originalCrypto.createHash.mockRestore();
    });
  });

  describe('timeoutPromise() - Promise.race Timeout Protection', () => {
    test('should resolve successful promise within timeout', async () => {
      const successPromise = Promise.resolve('success result');
      const timeoutMs = 1000;
      const operation = 'test_operation';
      const organizationId = 'test-org-123';
      
      const result = await service.timeoutPromise(successPromise, timeoutMs, operation, organizationId);
      
      expect(result).toBe('success result');
    });

    test('should reject with timeout error when promise exceeds timeout', async () => {
      const slowPromise = new Promise(resolve => setTimeout(() => resolve('too slow'), 2000));
      const timeoutMs = 100;
      const operation = 'slow_operation';
      const organizationId = 'test-org-123';
      
      await expect(
        service.timeoutPromise(slowPromise, timeoutMs, operation, organizationId)
      ).rejects.toThrow('slow_operation timeout after 100ms');
      
      // Verify timeout error properties
      try {
        await service.timeoutPromise(slowPromise, timeoutMs, operation, organizationId);
      } catch (error) {
        expect(error.isTimeout).toBe(true);
        expect(error.operation).toBe(operation);
        expect(error.organizationId).toBe(organizationId);
      }
    });

    test('should handle promise rejection before timeout', async () => {
      const rejectedPromise = Promise.reject(new Error('Promise rejection'));
      const timeoutMs = 1000;
      const operation = 'rejected_operation';
      
      await expect(
        service.timeoutPromise(rejectedPromise, timeoutMs, operation)
      ).rejects.toThrow('Promise rejection');
    });

    test('should handle default organizationId parameter', async () => {
      const successPromise = Promise.resolve('success');
      
      const result = await service.timeoutPromise(successPromise, 1000, 'test_op');
      expect(result).toBe('success');
    });
  });

  describe('safeParseNumber() - Conservative Number Validation', () => {
    test('should parse valid numbers correctly', () => {
      const testCases = [
        { input: 42, expected: 42 },
        { input: 0, expected: 0 },
        { input: -1, expected: -1 },
        { input: 3.14159, expected: 3.14159 },
        { input: '123', expected: 123 },
        { input: '0.75', expected: 0.75 },
        { input: '  456  ', expected: 456 } // With whitespace
      ];
      
      testCases.forEach(({ input, expected }, index) => {
        const result = service.safeParseNumber(input, 999, `test_case_${index}`);
        expect(result).toBe(expected);
      });
    });

    test('should return fallback for null/undefined values with debug logging', () => {
      const fallback = 42;
      const context = 'null_undefined_test';
      
      const nullResult = service.safeParseNumber(null, fallback, context);
      const undefinedResult = service.safeParseNumber(undefined, fallback, context);
      
      expect(nullResult).toBe(fallback);
      expect(undefinedResult).toBe(fallback);
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Safe number parse: null/undefined value',
        expect.objectContaining({ fallback, context })
      );
    });

    test('should handle invalid numbers with warning logging', () => {
      const fallback = 100;
      const context = 'invalid_number_test';
      
      const invalidCases = [
        NaN,
        Infinity,
        -Infinity,
        'not a number',
        '',
        'abc123',
        true,
        false,
        [],
        {},
        () => {}
      ];
      
      invalidCases.forEach(invalidInput => {
        const result = service.safeParseNumber(invalidInput, fallback, context);
        expect(result).toBe(fallback);
      });
      
      expect(logger.warn).toHaveBeenCalledTimes(invalidCases.length);
    });

    test('should use default fallback and context when not provided', () => {
      const result = service.safeParseNumber('invalid');
      expect(result).toBe(0); // Default fallback
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Safe number parse: non-numeric string',
        expect.objectContaining({
          context: 'unknown' // Default context
        })
      );
    });

    test('should detect infinite and NaN values correctly', () => {
      const fallback = 50;
      const context = 'special_values_test';
      
      const specialCases = [
        { input: Number.POSITIVE_INFINITY, name: 'positive infinity' },
        { input: Number.NEGATIVE_INFINITY, name: 'negative infinity' },
        { input: Number.NaN, name: 'NaN' },
        { input: 0/0, name: 'division by zero NaN' }
      ];
      
      specialCases.forEach(({ input, name }) => {
        const result = service.safeParseNumber(input, fallback, context);
        expect(result).toBe(fallback);
      });
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Safe number parse: invalid number',
        expect.any(Object)
      );
    });
  });

  describe('validateToxicityScore() - Enhanced Round 9 Validation', () => {
    test('should validate toxicity scores with comprehensive logging', () => {
      const result = service.validateToxicityScore(0.3, 0.2); // Valid case
      
      expect(result).toBe(true);
      
      expect(logger.info).toHaveBeenCalledWith(
        'Toxicity validation passed',
        expect.objectContaining({
          validationId: expect.any(String),
          normalizedVariant: 0.3,
          normalizedOriginal: 0.2,
          reason: 'toxicity_validation_passed'
        })
      );
    });

    test('should fail validation for null/undefined scores with detailed logging', () => {
      const invalidCases = [
        { variant: null, original: 0.5, name: 'null variant' },
        { variant: 0.5, original: undefined, name: 'undefined original' },
        { variant: '', original: 0.5, name: 'empty string variant' },
        { variant: 0.5, original: '', name: 'empty string original' }
      ];
      
      invalidCases.forEach(({ variant, original, name }) => {
        const result = service.validateToxicityScore(variant, original);
        expect(result).toBe(false);
      });
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Toxicity validation failed: null/undefined/empty scores',
        expect.objectContaining({
          reason: 'null_undefined_empty_scores'
        })
      );
    });

    test('should handle parsing failures with safe number parsing', () => {
      const result = service.validateToxicityScore('invalid', 'also_invalid');
      
      expect(result).toBe(false);
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Toxicity validation failed: score parsing failed',
        expect.objectContaining({
          reason: 'score_parsing_failed',
          parsedVariant: -1,
          parsedOriginal: -1
        })
      );
    });

    test('should normalize 0-100 scale scores correctly', () => {
      // Test 0-100 scale normalization
      const result = service.validateToxicityScore(30, 20); // 30% and 20%
      
      expect(result).toBe(true);
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Normalized variant score from 0-100 scale',
        expect.objectContaining({
          original: 30,
          normalized: 0.3
        })
      );
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Normalized original score from 0-100 scale',
        expect.objectContaining({
          original: 20,
          normalized: 0.2
        })
      );
    });

    test('should apply dynamic threshold validation with enhanced logging', () => {
      // Test case that should fail due to exceeding dynamic maximum
      const result = service.validateToxicityScore(0.9, 0.6); // High original, variant too high
      
      expect(result).toBe(false);
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Toxicity validation failed: variant exceeds dynamic maximum',
        expect.objectContaining({
          normalizedVariant: 0.9,
          normalizedOriginal: 0.6,
          dynamicMaxScore: 0.8,
          allowedIncrease: 0.2,
          reason: 'exceeds_dynamic_maximum'
        })
      );
    });

    test('should validate increase limits with tolerance for floating point precision', () => {
      // Test case that should fail due to exceeding allowed increase
      const result = service.validateToxicityScore(0.7, 0.2); // Increase of 0.5, but only 0.4 allowed
      
      expect(result).toBe(false);
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Toxicity validation failed: increase exceeds allowed range',
        expect.objectContaining({
          increase: 0.5,
          allowedIncrease: 0.4,
          tolerance: 0.0001,
          reason: 'exceeds_allowed_increase'
        })
      );
    });

    test('should handle edge cases at boundaries correctly', () => {
      // Test boundary cases for different toxicity ranges
      const boundaryCases = [
        { variant: 0.6, original: 0.2, expected: true, description: 'low toxicity boundary' },
        { variant: 0.8, original: 0.5, expected: true, description: 'medium toxicity boundary' },
        { variant: 0.8, original: 0.6, expected: true, description: 'high toxicity boundary' }
      ];
      
      boundaryCases.forEach(({ variant, original, expected, description }) => {
        const result = service.validateToxicityScore(variant, original);
        expect(result).toBe(expected);
      });
    });

    test('should fail for negative scores with validation logging', () => {
      const result = service.validateToxicityScore(-0.1, 0.2);
      
      expect(result).toBe(false);
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Toxicity validation failed: negative scores detected',
        expect.objectContaining({
          reason: 'negative_scores'
        })
      );
    });

    test('should fail for scores outside valid range after normalization', () => {
      // Test with scores that would be outside 0-1 range even after normalization
      const result = service.validateToxicityScore(150, 200); // 150% and 200%
      
      expect(result).toBe(false);
      
      expect(logger.error).toHaveBeenCalledWith(
        'CRITICAL: Toxicity scores outside valid range after normalization',
        expect.objectContaining({
          normalizedVariant: 1.5,
          normalizedOriginal: 2,
          reason: 'scores_outside_valid_range'
        })
      );
    });
  });

  describe('Integration Tests - Round 9 Security System', () => {
    test('should integrate all Round 9 security enhancements in validation flow', () => {
      const approvedText = 'Respuesta validada con seguridad';
      const storedText = 'Respuesta validada con seguridad';
      const organizationId = 'test-org-secure';
      
      // Test content integrity validation
      const integrityResult = service.validateContentIntegrityUltra(approvedText, storedText, organizationId);
      expect(integrityResult.valid).toBe(true);
      
      // Test toxicity validation with safe parsing
      const toxicityResult = service.validateToxicityScore(0.3, 0.2);
      expect(toxicityResult).toBe(true);
      
      // Test safe number parsing in various contexts
      const parseResult = service.safeParseNumber('0.45', -1, 'integration_test');
      expect(parseResult).toBe(0.45);
      
      // Test checksum generation
      const checksum = service.generateContentChecksum(approvedText);
      expect(checksum).toBeTruthy();
      expect(checksum).toHaveLength(64);
      
      // Verify all security logs were generated
      expect(logger.info).toHaveBeenCalledWith(
        'Content integrity validation passed',
        expect.any(Object)
      );
      
      expect(logger.info).toHaveBeenCalledWith(
        'Toxicity validation passed',
        expect.any(Object)
      );
    });

    test('should demonstrate fail-closed behavior across all Round 9 enhancements', () => {
      // Test system-wide fail-closed behavior
      const organizationId = 'test-org-fail-closed';
      
      // Content integrity should fail closed on invalid input
      const integrityResult = service.validateContentIntegrityUltra(null, 'valid', organizationId);
      expect(integrityResult.valid).toBe(false);
      expect(integrityResult.critical).toBe(true);
      
      // Toxicity validation should fail closed on parsing errors
      const toxicityResult = service.validateToxicityScore('invalid', 'also_invalid');
      expect(toxicityResult).toBe(false);
      
      // Safe number parsing should return fallback for invalid input
      const parseResult = service.safeParseNumber({}, 999, 'fail_closed_test');
      expect(parseResult).toBe(999);
      
      // Checksum generation should return null for invalid input
      const checksum = service.generateContentChecksum(123);
      expect(checksum).toBeNull();
      
      // Verify critical security warnings were logged
      expect(logger.error).toHaveBeenCalledWith(
        'CRITICAL: Content integrity validation failed - checksum generation error',
        expect.any(Object)
      );
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Toxicity validation failed: score parsing failed',
        expect.any(Object)
      );
    });
  });

  describe('Performance and Security Edge Cases', () => {
    test('should handle large content efficiently with security validation', () => {
      const largeContent = 'A'.repeat(10000); // 10KB content
      const startTime = Date.now();
      
      const checksum = service.generateContentChecksum(largeContent);
      const endTime = Date.now();
      
      expect(checksum).toBeTruthy();
      expect(checksum).toHaveLength(64);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    test('should validate unique checksums prevent collision attacks', () => {
      const content1 = 'Similar content A';
      const content2 = 'Similar content B';
      
      const checksum1 = service.generateContentChecksum(content1);
      const checksum2 = service.generateContentChecksum(content2);
      
      expect(checksum1).not.toBe(checksum2);
      expect(checksum1).toHaveLength(64);
      expect(checksum2).toHaveLength(64);
    });

    test('should prevent timing attacks through consistent validation time', async () => {
      const validInputs = ['Valid content', 'Another valid content'];
      const invalidInputs = [null, undefined, 123, {}];
      
      const validTimes = [];
      const invalidTimes = [];
      
      // Measure validation times for valid inputs
      for (const input of validInputs) {
        const start = Date.now();
        service.generateContentChecksum(input);
        validTimes.push(Date.now() - start);
      }
      
      // Measure validation times for invalid inputs
      for (const input of invalidInputs) {
        const start = Date.now();
        service.generateContentChecksum(input);
        invalidTimes.push(Date.now() - start);
      }
      
      // Timing should be relatively consistent (within 50ms variance)
      const validAvg = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
      const invalidAvg = invalidTimes.reduce((a, b) => a + b, 0) / invalidTimes.length;
      
      expect(Math.abs(validAvg - invalidAvg)).toBeLessThan(50);
    });
  });
});