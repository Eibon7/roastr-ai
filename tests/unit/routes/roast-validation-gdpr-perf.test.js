/**
 * Tests for Roast Validation Endpoint - GDPR & Performance Tests
 * POST /api/roast/:id/validate
 *
 * Issue #754: These tests are separated from roast-validation-issue364.test.js
 * to avoid Jest module cache issues. These tests modify mock state in ways that
 * cause failures when run in the same suite as other tests, but pass individually.
 *
 * Solution: Separate file ensures isolated module loading context.
 *
 * CodeRabbit Review: Refactored to use shared test helpers (M1, M2)
 * See: tests/helpers/roastValidationMocks.js, tests/helpers/setupRoastRouteMocks.js
 */

const request = require('supertest');
const express = require('express');

// Import shared mock factories - CodeRabbit Review M1: DRY refactoring
const {
  createMockValidatorInstance,
  createMockAuthenticateToken,
  createMockRoastRateLimit,
  createValidationConstantsMock,
  createLoggerMock
} = require('../../helpers/roastValidationMocks');

// Create mock instances using shared factories
// Jest requires variables used in jest.mock() to have "mock" prefix
const mockValidatorInstance = createMockValidatorInstance();
const mockAuthenticateToken = createMockAuthenticateToken();
const mockRoastRateLimit = createMockRoastRateLimit();
const mockValidationConstants = createValidationConstantsMock();
const mockLogger = createLoggerMock();

// Jest mocks (must be at module level)
jest.mock('../../../src/services/styleValidator', () => {
  return jest.fn().mockImplementation(() => mockValidatorInstance);
});
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/services/planService', () => ({
  getPlanFeatures: jest.fn()
}));
jest.mock('../../../src/utils/logger', () => mockLogger);
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken,
  optionalAuth: jest.fn((req, res, next) => next())
}));
jest.mock('../../../src/middleware/roastRateLimiter', () => ({
  createRoastRateLimiter: () => mockRoastRateLimit
}));
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req, res, next) => next());
});
jest.mock('../../../src/config/validationConstants', () => mockValidationConstants);

const StyleValidator = require('../../../src/services/styleValidator');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const { getPlanFeatures } = require('../../../src/services/planService');
const { logger } = require('../../../src/utils/logger');

// Import shared setup helper - CodeRabbit Review M2: DRY refactoring
const { setupRoastTestApp } = require('../../helpers/setupRoastRouteMocks');

describe('POST /api/roast/:id/validate - GDPR & Performance Tests', () => {
  let app;
  let mockValidator;
  let mockRpc;

  beforeEach(() => {
    // Mock StyleValidator instance
    mockValidator = mockValidatorInstance;

    // Mock Supabase RPC function
    mockRpc = jest.fn();

    // CodeRabbit Review M2: Use shared setup helper instead of duplicated logic
    app = setupRoastTestApp(mockValidator, mockRpc);
  });

  describe('GDPR Compliance', () => {
    beforeEach(() => {
      // Clear mock call history for assertions
      logger.info.mockClear();
      logger.error.mockClear();
      logger.warn.mockClear();
      supabaseServiceClient.insert.mockClear();

      // Configure mocks for these specific tests
      mockRpc.mockResolvedValue({
        data: { success: true, hasCredits: true, remaining: 999 },
        error: null
      });

      mockValidator.validate.mockReturnValue({
        valid: false,
        errors: [{ rule: 'NO_SPAM', message: 'Spam detected' }],
        warnings: [],
        metadata: { textLength: 10, validationTime: 25 }
      });
    });

    it('should log only metadata, not sensitive content', async () => {
      await request(app)
        .post('/api/roast/test-roast-id/validate')
        .send({ text: 'Sensitive roast content', platform: 'twitter' });

      // Check that logger.info was called with metadata only
      expect(logger.info).toHaveBeenCalledWith(
        'Style validation completed',
        expect.objectContaining({
          userId: 'test-user-id',
          roastId: 'test-roast-id',
          platform: 'twitter',
          textLength: 23,
          valid: false,
          errorsCount: 1,
          warningsCount: 0,
          processingTimeMs: expect.any(Number),
          creditsConsumed: 1,
          creditsRemaining: 999
        })
      );

      // Ensure no actual text content was logged
      const logCalls = logger.info.mock.calls;
      logCalls.forEach((call) => {
        expect(JSON.stringify(call)).not.toContain('Sensitive roast content');
      });
    });

    it('should not include text content in usage recording', async () => {
      await request(app)
        .post('/api/roast/test-roast-id/validate')
        .send({ text: 'Private user content', platform: 'twitter' });

      // Issue #618 - Add defensive check for mock.calls array
      // Issue #628 - CodeRabbit: Use idiomatic Jest matcher
      expect(supabaseServiceClient.insert).toHaveBeenCalled();
      const insertCall = supabaseServiceClient.insert.mock.calls[0][0];
      expect(JSON.stringify(insertCall)).not.toContain('Private user content');
      expect(insertCall.metadata.textLength).toBe(20); // Only length, not content
    });
  });

  describe('Performance', () => {
    beforeEach(() => {
      // Clear mock call history for assertions
      logger.info.mockClear();
      logger.error.mockClear();
      logger.warn.mockClear();
    });

    it('should respond within reasonable time', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, hasCredits: true, remaining: 999 },
        error: null
      });

      mockValidator.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        metadata: { textLength: 10, validationTime: 25 }
      });

      const start = Date.now();
      const response = await request(app)
        .post('/api/roast/test-roast-id/validate')
        .send({ text: 'Quick test', platform: 'twitter' });
      const end = Date.now();

      expect(response.status).toBe(200);
      expect(end - start).toBeLessThan(1000); // Less than 1 second
    });

    it('should include processing time in response', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, hasCredits: true, remaining: 999 },
        error: null
      });

      mockValidator.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        metadata: { textLength: 10, validationTime: 25 }
      });

      const response = await request(app)
        .post('/api/roast/test-roast-id/validate')
        .send({ text: 'Timing test', platform: 'twitter' });

      // Issue #754: Check that processingTimeMs exists and is a valid number
      // In fast test environments with instant mocks, this can be 0ms
      expect(response.body.data.validation.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof response.body.data.validation.metadata.processingTimeMs).toBe('number');
    });
  });
});
