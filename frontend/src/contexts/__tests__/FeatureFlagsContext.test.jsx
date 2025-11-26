/**
 * Tests for FeatureFlagsContext
 * Issue #1061: Conectar feature flags a contexto global
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { FeatureFlagsProvider, useFeatureFlags, useFeatureFlag } from '../FeatureFlagsContext';
import { isMockModeEnabled } from '../../lib/mockMode';

// Mock the mockMode module
jest.mock('../../lib/mockMode');

// Mock fetch
global.fetch = jest.fn();

const wrapper = ({ children }) => <FeatureFlagsProvider>{children}</FeatureFlagsProvider>;

describe('FeatureFlagsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    // Reset environment
    process.env.NODE_ENV = 'test';
  });

  describe('useFeatureFlags hook', () => {
    it('should return mock flags when in mock mode', async () => {
      isMockModeEnabled.mockReturnValue(true);

      const { result } = renderHook(() => useFeatureFlags(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.flags).toHaveProperty('ENABLE_SHOP');
      expect(result.current.flags).toHaveProperty('ENABLE_SHIELD');
      expect(result.current.isEnabled).toBeDefined();
      expect(result.current.error).toBe(null);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fetch flags from API when not in mock mode', async () => {
      isMockModeEnabled.mockReturnValue(false);

      const mockFlags = {
        ENABLE_SHOP: true,
        ENABLE_STYLE_PROFILE: true,
        ENABLE_RQC: false,
        ENABLE_SHIELD: true,
        ENABLE_BILLING: false
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          flags: mockFlags,
          timestamp: new Date().toISOString()
        })
      });

      const { result } = renderHook(() => useFeatureFlags(), { wrapper });

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.flags.ENABLE_SHOP).toBe(true);
      expect(result.current.isEnabled('ENABLE_SHOP')).toBe(true);
      expect(result.current.isEnabled('ENABLE_RQC')).toBe(false);
      expect(result.current.error).toBe(null);
      expect(fetch).toHaveBeenCalledWith('/api/config/flags', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: expect.any(AbortSignal)
      });
    });

    it('should handle API error and return fallback flags', async () => {
      isMockModeEnabled.mockReturnValue(false);

      fetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useFeatureFlags(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should return fallback flags
      expect(result.current.flags).toHaveProperty('ENABLE_SHOP');
      expect(result.current.flags.ENABLE_SHOP).toBe(false);
      expect(result.current.error).toBe('Network error');
    });

    it('should handle API non-OK response and return fallback flags', async () => {
      isMockModeEnabled.mockReturnValue(false);

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({})
      });

      const { result } = renderHook(() => useFeatureFlags(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should return fallback flags
      expect(result.current.flags).toHaveProperty('ENABLE_SHOP');
      expect(result.current.flags.ENABLE_SHOP).toBe(false);
    });

    it('should provide refresh function', async () => {
      isMockModeEnabled.mockReturnValue(true);

      const { result } = renderHook(() => useFeatureFlags(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.refresh).toBe('function');
    });

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useFeatureFlags());
      }).toThrow('useFeatureFlags must be used within FeatureFlagsProvider');

      consoleError.mockRestore();
    });
  });

  describe('useFeatureFlag hook', () => {
    it('should return isEnabled status for a specific flag', async () => {
      isMockModeEnabled.mockReturnValue(true);

      const { result } = renderHook(() => useFeatureFlag('ENABLE_SHOP'), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isEnabled).toBeDefined();
      expect(typeof result.current.isEnabled).toBe('boolean');
      expect(result.current.loading).toBe(false);
    });

    it('should return correct flag status', async () => {
      isMockModeEnabled.mockReturnValue(false);

      const mockFlags = {
        ENABLE_SHOP: true,
        ENABLE_RQC: false
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          flags: mockFlags
        })
      });

      const { result } = renderHook(() => useFeatureFlag('ENABLE_SHOP'), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isEnabled).toBe(true);
    });
  });

  describe('Provider cleanup', () => {
    it('should cleanup on unmount', async () => {
      isMockModeEnabled.mockReturnValue(false);

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          flags: { ENABLE_SHOP: true }
        })
      });

      const { unmount } = renderHook(() => useFeatureFlags(), { wrapper });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Unmount should not cause errors
      expect(() => unmount()).not.toThrow();
    });
  });
});
