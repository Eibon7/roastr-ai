/**
 * Simple Smoke Test for PR #376
 * Tests basic functionality of Shield Action Executor components
 */

const ShieldActionExecutorService = require('../../src/services/shieldActionExecutor');

describe('Shield Action Executor Smoke Test', () => {
  let actionExecutor;

  beforeAll(async () => {
    // Set required environment variables
    process.env.ENABLE_MOCK_MODE = 'true';
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  });

  beforeEach(() => {
    actionExecutor = new ShieldActionExecutorService({
      maxRetries: 2,
      baseDelay: 100,
      maxDelay: 1000,
      failureThreshold: 3,
      recoveryTimeout: 5000
    });
  });

  afterEach(() => {
    // Clean up if needed - no destroy method required for this service
    actionExecutor = null;
  });

  test('should initialize service correctly', () => {
    expect(actionExecutor).toBeDefined();
    expect(typeof actionExecutor.executeAction).toBe('function');
    expect(typeof actionExecutor.getMetrics).toBe('function');
    expect(typeof actionExecutor.getCircuitBreakerStatus).toBe('function');
    expect(typeof actionExecutor.getAdapterCapabilities).toBe('function');
  });

  test('should return metrics', () => {
    const metrics = actionExecutor.getMetrics();
    expect(metrics).toBeDefined();
    expect(typeof metrics.totalActions).toBe('number');
    expect(typeof metrics.successfulActions).toBe('number');
    expect(typeof metrics.failedActions).toBe('number');
    expect(typeof metrics.fallbackActions).toBe('number');
    expect(typeof metrics.timestamp).toBe('string');
  });

  test('should return circuit breaker status', () => {
    const status = actionExecutor.getCircuitBreakerStatus();
    expect(status).toBeDefined();
    expect(typeof status).toBe('object');
  });

  test('should return adapter capabilities', () => {
    const capabilities = actionExecutor.getAdapterCapabilities();
    expect(capabilities).toBeDefined();
    expect(typeof capabilities).toBe('object');
  });

  test('should handle mock action execution', async () => {
    const mockAction = {
      organizationId: 'test-org-123',
      platform: 'twitter',
      accountRef: 'test-account',
      externalCommentId: 'comment-123',
      externalAuthorId: 'author-123',
      externalAuthorUsername: 'testuser',
      action: 'hideComment',
      reason: 'Test action',
      metadata: { test: true }
    };

    const result = await actionExecutor.executeAction(mockAction);
    
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    expect(result.platform).toBe('twitter');
    // Twitter doesn't support hideComment, so it should fallback to reportUser
    expect(result.action).toBe('reportUser');
    expect(result.fallback).toBe('reportUser');
  });
});