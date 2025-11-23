/**
 * Circuit Breaker Tests
 *
 * Tests for the circuit breaker pattern implementation to ensure
 * proper failure detection and recovery mechanisms.
 */

const {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitBreakerError
} = require('../../../src/utils/circuitBreaker');

describe('CircuitBreaker', () => {
  let circuitBreaker;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringPeriod: 5000,
      logger: mockLogger,
      name: 'TestBreaker'
    });
  });

  afterEach(() => {
    circuitBreaker.destroy();
  });

  describe('CLOSED state', () => {
    test('should execute operation successfully when closed', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(operation).toHaveBeenCalled();
    });

    test('should remain closed after single failure', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Single failure'));

      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Single failure');
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(1);
    });

    test('should open after reaching failure threshold', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Repeated failure'));

      // Trigger failures to reach threshold
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      }

      expect(circuitBreaker.state).toBe('OPEN');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('opened after 3 failures')
      );
    });
  });

  describe('OPEN state', () => {
    beforeEach(async () => {
      // Force circuit breaker to OPEN state
      const failingOperation = jest.fn().mockRejectedValue(new Error('Force open'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      }
      expect(circuitBreaker.state).toBe('OPEN');
    });

    test('should reject requests immediately when open', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      await expect(circuitBreaker.execute(operation)).rejects.toThrow(CircuitBreakerError);

      expect(operation).not.toHaveBeenCalled();
    });

    test('should use fallback when open', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const fallback = jest.fn().mockResolvedValue('fallback result');

      const result = await circuitBreaker.execute(operation, fallback);

      expect(result).toBe('fallback result');
      expect(operation).not.toHaveBeenCalled();
      expect(fallback).toHaveBeenCalled();
    });

    test('should transition to HALF_OPEN after recovery timeout', async () => {
      // Wait for recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const operation = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('transitioning to HALF_OPEN')
      );
    });
  });

  describe('HALF_OPEN state', () => {
    beforeEach(async () => {
      // Force to OPEN state first
      const failingOperation = jest.fn().mockRejectedValue(new Error('Force open'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      }

      // Wait for recovery timeout to enable HALF_OPEN transition
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    test('should close on successful operation', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
    });

    test('should open immediately on failure', async () => {
      const operation = jest
        .fn()
        .mockResolvedValueOnce('trigger half-open') // First call to transition to HALF_OPEN
        .mockRejectedValueOnce(new Error('Fail in half-open')); // Second call to test failure

      // First call transitions to HALF_OPEN and succeeds, closing the circuit
      await circuitBreaker.execute(operation);
      expect(circuitBreaker.state).toBe('CLOSED');

      // Force back to HALF_OPEN for testing
      circuitBreaker.state = 'HALF_OPEN';

      // This should open the circuit immediately
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      expect(circuitBreaker.state).toBe('OPEN');
    });
  });

  describe('Expected errors', () => {
    test('should not count expected errors as failures', async () => {
      const breakerWithExpectedErrors = new CircuitBreaker({
        failureThreshold: 2,
        expectedErrors: ['Expected error', /validation/i],
        logger: mockLogger
      });

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Expected error'))
        .mockRejectedValueOnce(new Error('Validation failed'))
        .mockRejectedValueOnce(new Error('Real error'));

      // First two should not count as failures
      await expect(breakerWithExpectedErrors.execute(operation)).rejects.toThrow('Expected error');
      await expect(breakerWithExpectedErrors.execute(operation)).rejects.toThrow(
        'Validation failed'
      );

      expect(breakerWithExpectedErrors.state).toBe('CLOSED');
      expect(breakerWithExpectedErrors.failureCount).toBe(0);

      // This should count as a failure
      await expect(breakerWithExpectedErrors.execute(operation)).rejects.toThrow('Real error');
      expect(breakerWithExpectedErrors.failureCount).toBe(1);

      breakerWithExpectedErrors.destroy();
    });

    test('should handle function-based expected error detection', async () => {
      const breakerWithCustomDetection = new CircuitBreaker({
        failureThreshold: 2,
        expectedErrors: [(error) => error.code === 'EXPECTED'],
        logger: mockLogger
      });

      const expectedError = new Error('Custom expected error');
      expectedError.code = 'EXPECTED';

      const operation = jest.fn().mockRejectedValue(expectedError);

      await expect(breakerWithCustomDetection.execute(operation)).rejects.toThrow();
      expect(breakerWithCustomDetection.failureCount).toBe(0);

      breakerWithCustomDetection.destroy();
    });
  });

  describe('Metrics', () => {
    test('should provide accurate metrics', async () => {
      const operation = jest
        .fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValueOnce('success');

      await circuitBreaker.execute(operation);
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      await circuitBreaker.execute(operation);

      const metrics = circuitBreaker.getMetrics();

      expect(metrics).toEqual({
        name: 'TestBreaker',
        state: 'CLOSED',
        failureCount: 1,
        successCount: 2,
        requestCount: 3,
        failureRate: 1 / 3,
        lastFailureTime: expect.any(Number),
        timeSinceLastFailure: expect.any(Number)
      });
    });
  });

  describe('Force state', () => {
    test('should allow forcing circuit breaker state', () => {
      circuitBreaker.forceState('OPEN');
      expect(circuitBreaker.state).toBe('OPEN');

      circuitBreaker.forceState('CLOSED');
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
    });
  });
});

describe('CircuitBreakerManager', () => {
  let manager;

  beforeEach(() => {
    manager = new CircuitBreakerManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Breaker management', () => {
    test('should create and retrieve circuit breakers', () => {
      const breaker1 = manager.getBreaker('service1');
      const breaker2 = manager.getBreaker('service1'); // Same service
      const breaker3 = manager.getBreaker('service2'); // Different service

      expect(breaker1).toBe(breaker2); // Should return same instance
      expect(breaker1).not.toBe(breaker3); // Should be different instances
    });

    test('should execute operations with service-specific breakers', async () => {
      const operation1 = jest.fn().mockResolvedValue('service1 result');
      const operation2 = jest.fn().mockResolvedValue('service2 result');

      const result1 = await manager.execute('service1', operation1);
      const result2 = await manager.execute('service2', operation2);

      expect(result1).toBe('service1 result');
      expect(result2).toBe('service2 result');
    });

    test('should use fallback when circuit is open', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Service down'));
      const fallback = jest.fn().mockResolvedValue('fallback result');

      // Force circuit to open
      const breaker = manager.getBreaker('unreliable-service', { failureThreshold: 1 });
      await expect(manager.execute('unreliable-service', failingOperation)).rejects.toThrow();

      // Now it should use fallback
      const result = await manager.execute('unreliable-service', failingOperation, fallback);
      expect(result).toBe('fallback result');
    });
  });

  describe('Metrics and health', () => {
    test('should provide metrics for all breakers', async () => {
      const operation1 = jest.fn().mockResolvedValue('success');
      const operation2 = jest.fn().mockRejectedValue(new Error('failure'));

      await manager.execute('service1', operation1);
      await expect(manager.execute('service2', operation2)).rejects.toThrow();

      const metrics = manager.getAllMetrics();

      expect(metrics).toHaveProperty('service1');
      expect(metrics).toHaveProperty('service2');
      expect(metrics.service1.successCount).toBe(1);
      expect(metrics.service2.failureCount).toBe(1);
    });

    test('should provide health status for all services', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failOperation = jest.fn().mockRejectedValue(new Error('failure'));

      await manager.execute('healthy-service', successOperation);

      // Force unhealthy service to open
      const breaker = manager.getBreaker('unhealthy-service', { failureThreshold: 1 });
      await expect(manager.execute('unhealthy-service', failOperation)).rejects.toThrow();

      const health = manager.getHealthStatus();

      expect(health['healthy-service'].healthy).toBe(true);
      expect(health['unhealthy-service'].healthy).toBe(false);
      expect(health['unhealthy-service'].state).toBe('OPEN');
    });

    test('should reset all circuit breakers', async () => {
      // Create some breakers with failures
      const failOperation = jest.fn().mockRejectedValue(new Error('failure'));

      await expect(manager.execute('service1', failOperation)).rejects.toThrow();
      await expect(manager.execute('service2', failOperation)).rejects.toThrow();

      // Reset all
      manager.resetAll();

      const health = manager.getHealthStatus();
      expect(health['service1'].healthy).toBe(true);
      expect(health['service2'].healthy).toBe(true);
    });
  });
});
