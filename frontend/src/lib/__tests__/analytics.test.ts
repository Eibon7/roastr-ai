/**
 * Tests for Amplitude Analytics Integration (V2-ready)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as amplitudeModule from '@amplitude/unified';

// Mock the amplitude module
vi.mock('@amplitude/unified', () => ({
  initAll: vi.fn(),
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
});
