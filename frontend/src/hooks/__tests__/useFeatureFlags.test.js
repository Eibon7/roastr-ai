import { renderHook, waitFor } from '@testing-library/react';
import { useFeatureFlags } from '../useFeatureFlags';
import { isMockModeEnabled } from '../../lib/mockMode';

// Mock the mockMode module
jest.mock('../../lib/mockMode');

// Mock fetch
global.fetch = jest.fn();

describe('useFeatureFlags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  it('should return mock flags when in mock mode', async () => {
    isMockModeEnabled.mockReturnValue(true);

    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.flags).toEqual({
      ENABLE_SHOP: false,
      ENABLE_STYLE_PROFILE: true,
      ENABLE_RQC: true,
      ENABLE_SHIELD: true,
      ENABLE_BILLING: true
    });

    expect(result.current.isEnabled('ENABLE_SHOP')).toBe(false);
    expect(result.current.isEnabled('ENABLE_STYLE_PROFILE')).toBe(true);
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
      json: async () => ({ flags: mockFlags })
    });

    const { result } = renderHook(() => useFeatureFlags());

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.flags).toEqual(mockFlags);
    expect(result.current.isEnabled('ENABLE_SHOP')).toBe(true);
    expect(result.current.isEnabled('ENABLE_RQC')).toBe(false);
    expect(result.current.error).toBe(null);
    expect(fetch).toHaveBeenCalledWith('/api/config/flags', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  });

  it('should handle API error and return fallback flags', async () => {
    isMockModeEnabled.mockReturnValue(false);

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should return fallback flags
    expect(result.current.flags).toEqual({
      ENABLE_SHOP: false,
      ENABLE_STYLE_PROFILE: true,
      ENABLE_RQC: false,
      ENABLE_SHIELD: false,
      ENABLE_BILLING: false
    });

    expect(result.current.error).toBe(null);
  });

  it('should handle network error and return fallback flags', async () => {
    isMockModeEnabled.mockReturnValue(false);

    fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should return fallback flags
    expect(result.current.flags).toEqual({
      ENABLE_SHOP: false,
      ENABLE_STYLE_PROFILE: true,
      ENABLE_RQC: false,
      ENABLE_SHIELD: false,
      ENABLE_BILLING: false
    });

    expect(result.current.error).toBe('Network error');
  });

  it('should handle missing flags in API response', async () => {
    isMockModeEnabled.mockReturnValue(false);

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}) // No flags property
    });

    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.flags).toEqual({});
    expect(result.current.isEnabled('ENABLE_SHOP')).toBe(false);
  });

  it('should correctly evaluate isEnabled function', async () => {
    isMockModeEnabled.mockReturnValue(false);

    const mockFlags = {
      ENABLE_SHOP: true,
      ENABLE_STYLE_PROFILE: false,
      ENABLE_RQC: 'true', // String value
      ENABLE_SHIELD: 1, // Number value
      ENABLE_BILLING: null // Null value
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ flags: mockFlags })
    });

    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isEnabled('ENABLE_SHOP')).toBe(true);
    expect(result.current.isEnabled('ENABLE_STYLE_PROFILE')).toBe(false);
    expect(result.current.isEnabled('ENABLE_RQC')).toBe(false); // String 'true' is not boolean true
    expect(result.current.isEnabled('ENABLE_SHIELD')).toBe(false); // Number 1 is not boolean true
    expect(result.current.isEnabled('ENABLE_BILLING')).toBe(false); // Null is not boolean true
    expect(result.current.isEnabled('NON_EXISTENT_FLAG')).toBe(false);
  });
});
