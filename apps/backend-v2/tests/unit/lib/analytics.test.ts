/**
 * Tests for Amplitude Analytics Integration - Backend v2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as amplitudeModule from '@amplitude/analytics-node';

// Mock the amplitude module
vi.mock('@amplitude/analytics-node', () => ({
  init: vi.fn(),
  track: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
}));

describe('Amplitude Analytics - Backend v2', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset modules to clear initialization state
    vi.resetModules();
    // Mock environment variables
    process.env = {
      ...originalEnv,
      AMPLITUDE_API_KEY: 'test_amplitude_api_key',
      NODE_ENV: 'development',
      APP_VERSION: '2.0.0',
    };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('should initialize Amplitude with correct configuration', async () => {
    const { initializeAmplitude } = await import('../../../src/lib/analytics');

    const result = initializeAmplitude();

    expect(result).toBe(true);
    expect(amplitudeModule.init).toHaveBeenCalledWith('test_amplitude_api_key', {
      serverZone: 'EU',
    });
    expect(amplitudeModule.init).toHaveBeenCalledTimes(1);
  });

  it('should not initialize without API key', async () => {
    // Mock missing API key
    process.env.AMPLITUDE_API_KEY = '';

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { initializeAmplitude } = await import('../../../src/lib/analytics');

    const result = initializeAmplitude();

    expect(result).toBe(false);
    expect(amplitudeModule.init).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[Amplitude] Missing AMPLITUDE_API_KEY environment variable. Analytics will not be initialized.'
    );

    consoleWarnSpy.mockRestore();
  });

  it('should not initialize in test environment', async () => {
    process.env.NODE_ENV = 'test';

    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { initializeAmplitude } = await import('../../../src/lib/analytics');

    const result = initializeAmplitude();

    expect(result).toBe(false);
    expect(amplitudeModule.init).not.toHaveBeenCalled();
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[Amplitude] Test environment detected. Analytics disabled.'
    );

    consoleInfoSpy.mockRestore();
  });

  it('should prevent double initialization', async () => {
    const { initializeAmplitude } = await import('../../../src/lib/analytics');

    // First initialization
    const firstResult = initializeAmplitude();
    expect(firstResult).toBe(true);

    // Second initialization attempt
    const secondResult = initializeAmplitude();
    expect(secondResult).toBe(false);

    // Should only be called once
    expect(amplitudeModule.init).toHaveBeenCalledTimes(1);
  });

  it('should track events with standard properties', async () => {
    const { initializeAmplitude, trackEvent } = await import('../../../src/lib/analytics');

    initializeAmplitude();

    trackEvent({
      userId: 'user_123',
      event: 'roast_generated',
      properties: {
        tone: 'canalla',
        platform: 'twitter',
      },
      context: {
        flow: 'roasting',
        request_id: 'req_xyz',
      },
    });

    expect(amplitudeModule.track).toHaveBeenCalledWith(
      'roast_generated',
      {
        tone: 'canalla',
        platform: 'twitter',
        env: 'development',
        source: 'backend-v2',
        app_version: '2.0.0',
        flow: 'roasting',
        request_id: 'req_xyz',
      },
      {
        user_id: 'user_123',
        device_id: undefined,
      }
    );
  });

  it('should track events without userId (pre-auth)', async () => {
    const { initializeAmplitude, trackEvent } = await import('../../../src/lib/analytics');

    initializeAmplitude();

    trackEvent({
      deviceId: 'device_456',
      event: 'auth_login_attempt',
      properties: {
        method: 'email_password',
      },
      context: {
        flow: 'auth',
      },
    });

    expect(amplitudeModule.track).toHaveBeenCalledWith(
      'auth_login_attempt',
      {
        method: 'email_password',
        env: 'development',
        source: 'backend-v2',
        app_version: '2.0.0',
        flow: 'auth',
      },
      {
        user_id: undefined,
        device_id: 'device_456',
      }
    );
  });

  it('should not track if not initialized', async () => {
    process.env.AMPLITUDE_API_KEY = '';

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { initializeAmplitude, trackEvent } = await import('../../../src/lib/analytics');

    // Try to initialize (will fail)
    initializeAmplitude();

    // Try to track event
    trackEvent({
      userId: 'user_123',
      event: 'test_event',
    });

    expect(amplitudeModule.track).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[Amplitude] Not initialized. Skipping event:',
      'test_event'
    );

    consoleWarnSpy.mockRestore();
  });

  it('should return correct initialization status', async () => {
    const { initializeAmplitude, isAmplitudeInitialized } = await import(
      '../../../src/lib/analytics'
    );

    // Before initialization
    expect(isAmplitudeInitialized()).toBe(false);

    // After initialization
    initializeAmplitude();
    expect(isAmplitudeInitialized()).toBe(true);
  });

  it('should flush events successfully', async () => {
    const { initializeAmplitude, flushEvents } = await import('../../../src/lib/analytics');

    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    initializeAmplitude();
    await flushEvents();

    expect(amplitudeModule.flush).toHaveBeenCalled();
    expect(consoleInfoSpy).toHaveBeenCalledWith('[Amplitude] Events flushed successfully');

    consoleInfoSpy.mockRestore();
  });

  it('should handle flush errors gracefully', async () => {
    const { initializeAmplitude, flushEvents } = await import('../../../src/lib/analytics');

    // Mock flush to throw error
    vi.mocked(amplitudeModule.flush).mockRejectedValueOnce(new Error('Flush failed'));

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    initializeAmplitude();
    await flushEvents();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Amplitude] Failed to flush events:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should handle track errors gracefully', async () => {
    const { initializeAmplitude, trackEvent } = await import('../../../src/lib/analytics');

    // Mock track to throw error
    vi.mocked(amplitudeModule.track).mockImplementationOnce(() => {
      throw new Error('Track failed');
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    initializeAmplitude();
    trackEvent({
      userId: 'user_123',
      event: 'test_event',
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Amplitude] Failed to track event:',
      'test_event',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});

