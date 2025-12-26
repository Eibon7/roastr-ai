/**
 * Tests for Amplitude Analytics Integration (V2-ready)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as amplitudeModule from '@amplitude/unified';

// Mock the amplitude module
vi.mock('@amplitude/unified', () => ({
  initAll: vi.fn(),
  track: vi.fn(),
  setUserId: vi.fn(),
}));

describe('Amplitude Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should initialize Amplitude with correct configuration', async () => {
    const { initializeAmplitude } = await import('../analytics');

    const result = initializeAmplitude();

    expect(result).toBe(true);
    expect(amplitudeModule.initAll).toHaveBeenCalledWith('test_amplitude_api_key', {
      serverZone: 'EU',
      analytics: {
        autocapture: true,
      },
    });
    expect(amplitudeModule.initAll).toHaveBeenCalledTimes(1);
  });

  it('should prevent double initialization', async () => {
    const { initializeAmplitude } = await import('../analytics');

    // First initialization
    const firstResult = initializeAmplitude();
    expect(firstResult).toBe(true);

    // Second initialization attempt
    const secondResult = initializeAmplitude();
    expect(secondResult).toBe(false);

    // Should only be called once
    expect(amplitudeModule.initAll).toHaveBeenCalledTimes(1);
  });

  it('should return correct initialization status', async () => {
    const { initializeAmplitude, isAmplitudeInitialized } = await import('../analytics');

    // Before initialization
    expect(isAmplitudeInitialized()).toBe(false);

    // After initialization
    initializeAmplitude();
    expect(isAmplitudeInitialized()).toBe(true);
  });

  it('should handle initialization errors gracefully', async () => {
    // Mock initAll to throw an error
    vi.mocked(amplitudeModule.initAll).mockImplementationOnce(() => {
      throw new Error('Initialization failed');
    });

    // Spy on console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { initializeAmplitude } = await import('../analytics');

    const result = initializeAmplitude();

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Amplitude] Failed to initialize analytics:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should track events with standard properties using trackEvent helper', async () => {
    const { initializeAmplitude, trackEvent } = await import('../analytics');

    initializeAmplitude();
    trackEvent('auth_login_success', { method: 'email_password' }, { flow: 'auth', userId: 'user-123' });

    expect(amplitudeModule.setUserId).toHaveBeenCalledWith('user-123');
    expect(amplitudeModule.track).toHaveBeenCalledWith('auth_login_success', {
      method: 'email_password',
      flow: 'auth',
      source: 'frontend',
      env: 'test',
      app_version: '2.0.0',
    });
  });

  it('should track events without userId using trackEvent helper', async () => {
    const { initializeAmplitude, trackEvent } = await import('../analytics');

    initializeAmplitude();
    trackEvent('page_view', { path: '/public' }, { flow: 'public' });

    expect(amplitudeModule.track).toHaveBeenCalledWith('page_view', {
      path: '/public',
      flow: 'public',
      source: 'frontend',
      env: 'test',
      app_version: '2.0.0',
    });
  });

  it('should not track with trackEvent if not initialized', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { trackEvent } = await import('../analytics');

    // Do not call initializeAmplitude()
    trackEvent('some_event', { prop: 'value' });

    expect(amplitudeModule.track).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith('[Amplitude] Not initialized. Skipping event: some_event');

    consoleWarnSpy.mockRestore();
  });

  it('should handle trackEvent errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(amplitudeModule.track).mockImplementationOnce(() => {
      throw new Error('Track failed');
    });

    const { initializeAmplitude, trackEvent } = await import('../analytics');

    initializeAmplitude();
    trackEvent('failing_event', { prop: 'value' });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[Amplitude] Failed to track event "failing_event":', expect.any(Error));

    consoleErrorSpy.mockRestore();
  });
});
