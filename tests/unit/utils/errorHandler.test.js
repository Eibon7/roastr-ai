/**
 * Error Handler Tests
 *
 * Tests for the enhanced error handling system to ensure
 * robust error recovery and fallback mechanisms.
 */

const { WorkerErrorHandler, WorkerError } = require('../../../src/utils/errorHandler');
const { ValidationError } = require('../../../src/utils/jobValidator');

describe('WorkerErrorHandler', () => {
  let errorHandler;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    errorHandler = new WorkerErrorHandler(mockLogger);
  });

  describe('handleWithFallback', () => {
    test('should return operation result when successful', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const fallback = jest.fn().mockResolvedValue('fallback');

      const result = await errorHandler.handleWithFallback(operation, fallback);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
      expect(fallback).not.toHaveBeenCalled();
    });

    test('should use fallback when operation fails', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const fallback = jest.fn().mockResolvedValue('fallback result');

      const result = await errorHandler.handleWithFallback(operation, fallback);

      expect(result).toBe('fallback result');
      expect(operation).toHaveBeenCalled();
      expect(fallback).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Operation failed, using fallback',
        expect.objectContaining({
          error: 'Operation failed'
        })
      );
    });

    test('should throw error when both operation and fallback fail', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const fallback = jest.fn().mockRejectedValue(new Error('Fallback failed'));

      await expect(errorHandler.handleWithFallback(operation, fallback)).rejects.toThrow(
        WorkerError
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Fallback also failed',
        expect.objectContaining({
          originalError: 'Operation failed',
          fallbackError: 'Fallback failed'
        })
      );
    });

    test('should throw original error when no fallback provided', async () => {
      const originalError = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(originalError);

      await expect(errorHandler.handleWithFallback(operation, null)).rejects.toThrow(
        'Operation failed'
      );
    });
  });

  describe('handleWithRetry', () => {
    test('should return result on first success', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await errorHandler.handleWithRetry(operation, 3);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should retry on failure and eventually succeed', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const result = await errorHandler.handleWithRetry(operation, 3);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    test('should not retry ValidationError', async () => {
      const operation = jest.fn().mockRejectedValue(new ValidationError('Invalid input'));

      await expect(errorHandler.handleWithRetry(operation, 3)).rejects.toThrow(ValidationError);

      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should not retry non-retryable WorkerError', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new WorkerError('Non-retryable error', 'TEST_ERROR', false));

      await expect(errorHandler.handleWithRetry(operation, 3)).rejects.toThrow(WorkerError);

      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should exhaust retries and throw WorkerError', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(errorHandler.handleWithRetry(operation, 2)).rejects.toThrow(
        'Operation failed after 3 attempts'
      );

      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('handleWithTimeout', () => {
    test('should return result when operation completes within timeout', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await errorHandler.handleWithTimeout(operation, 1000);

      expect(result).toBe('success');
    });

    test('should throw timeout error when operation takes too long', async () => {
      const operation = jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve('late'), 2000))
        );

      await expect(errorHandler.handleWithTimeout(operation, 100)).rejects.toThrow(
        'Operation timed out after 100ms'
      );
    });
  });

  describe('handleRobust', () => {
    test('should handle complex scenario with retry, timeout, and fallback', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValue('success');

      const fallback = jest.fn().mockResolvedValue('fallback');

      const result = await errorHandler.handleRobust(operation, {
        maxRetries: 3,
        timeoutMs: 5000,
        fallback
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(fallback).not.toHaveBeenCalled();
    });

    test('should use fallback when all retries fail', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));
      const fallback = jest.fn().mockResolvedValue('fallback result');

      const result = await errorHandler.handleRobust(operation, {
        maxRetries: 2,
        fallback
      });

      expect(result).toBe('fallback result');
      expect(fallback).toHaveBeenCalled();
    });
  });

  describe('handleDatabaseOperation', () => {
    test('should return result when database operation succeeds', async () => {
      const operation = jest.fn().mockResolvedValue({ data: 'success', error: null });

      const result = await errorHandler.handleDatabaseOperation(operation);

      expect(result).toEqual({ data: 'success', error: null });
    });

    test('should throw WorkerError when database returns error', async () => {
      const operation = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'DB001' }
      });

      await expect(errorHandler.handleDatabaseOperation(operation)).rejects.toThrow(
        'Database error: Database error'
      );
    });

    test('should handle connection errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('connection failed'));

      await expect(errorHandler.handleDatabaseOperation(operation)).rejects.toThrow(
        'Database connection failed'
      );
    });

    test('should handle timeout errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('timeout occurred'));

      await expect(errorHandler.handleDatabaseOperation(operation)).rejects.toThrow(
        'Database operation timed out'
      );
    });
  });

  describe('handleAPIOperation', () => {
    test('should return result when API operation succeeds', async () => {
      const operation = jest.fn().mockResolvedValue('api result');

      const result = await errorHandler.handleAPIOperation(operation, 'TestAPI');

      expect(result).toBe('api result');
    });

    test('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;
      rateLimitError.headers = { 'retry-after': '60' };

      const operation = jest.fn().mockRejectedValue(rateLimitError);

      await expect(errorHandler.handleAPIOperation(operation, 'TestAPI')).rejects.toThrow(
        'TestAPI API rate limit exceeded'
      );
    });

    test('should handle authentication errors', async () => {
      const authError = new Error('Unauthorized');
      authError.status = 401;

      const operation = jest.fn().mockRejectedValue(authError);

      await expect(errorHandler.handleAPIOperation(operation, 'TestAPI')).rejects.toThrow(
        'TestAPI API authentication failed'
      );
    });

    test('should handle server errors', async () => {
      const serverError = new Error('Internal server error');
      serverError.status = 500;

      const operation = jest.fn().mockRejectedValue(serverError);

      await expect(errorHandler.handleAPIOperation(operation, 'TestAPI')).rejects.toThrow(
        'TestAPI API server error'
      );
    });
  });

  describe('createErrorResponse', () => {
    test('should create response for WorkerError', () => {
      const error = new WorkerError('Test error', 'TEST_ERROR', true, { context: 'test' });
      const response = errorHandler.createErrorResponse(error, 'job-123');

      expect(response).toEqual({
        success: false,
        error: 'Test error',
        timestamp: expect.any(String),
        jobId: 'job-123',
        type: 'TEST_ERROR',
        retryable: true,
        context: { context: 'test' }
      });
    });

    test('should create response for ValidationError', () => {
      const error = new ValidationError('Validation failed', 'test_field');
      const response = errorHandler.createErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: 'Validation failed',
        timestamp: expect.any(String),
        jobId: null,
        type: 'VALIDATION_ERROR',
        field: 'test_field',
        retryable: false
      });
    });

    test('should create response for generic error', () => {
      const error = new Error('Generic error');
      const response = errorHandler.createErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: 'Generic error',
        timestamp: expect.any(String),
        jobId: null,
        type: 'UNKNOWN_ERROR',
        retryable: false,
        context: {}
      });
    });
  });

  describe('logError', () => {
    test('should log retryable WorkerError as warning', () => {
      const error = new WorkerError('Retryable error', 'TEST_ERROR', true);

      errorHandler.logError(error, { context: 'test' });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Retryable worker error',
        expect.objectContaining({
          message: 'Retryable error',
          type: 'TEST_ERROR'
        })
      );
    });

    test('should log non-retryable WorkerError as error', () => {
      const error = new WorkerError('Non-retryable error', 'TEST_ERROR', false);

      errorHandler.logError(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Non-retryable worker error',
        expect.objectContaining({
          message: 'Non-retryable error',
          type: 'TEST_ERROR'
        })
      );
    });

    test('should log ValidationError as warning', () => {
      const error = new ValidationError('Validation failed');

      errorHandler.logError(error);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Validation error',
        expect.objectContaining({
          message: 'Validation failed'
        })
      );
    });

    test('should log unexpected error as error', () => {
      const error = new Error('Unexpected error');

      errorHandler.logError(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error',
        expect.objectContaining({
          message: 'Unexpected error'
        })
      );
    });
  });
});
