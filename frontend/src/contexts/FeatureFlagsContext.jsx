/**
 * Feature Flags Context
 * Issue #1061: Conectar feature flags a contexto global
 *
 * Provides global context for feature flags that can be accessed from any component
 * without redundant API calls. Caches flags in memory and syncs with backend.
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { isMockModeEnabled } from '../lib/mockMode';

/**
 * Parse development feature flag with production safety
 * Development features are automatically disabled in production environment
 */
const parseDevelopmentFlag = (value, isProduction = false) => {
  // Always return false for development features in production
  if (isProduction) {
    return false;
  }
  // In non-production environments, return the actual value
  return value;
};

// Check if we're in production environment
const isProduction = process.env.NODE_ENV === 'production';

// Shared fallback flags constant used across all fallback scenarios
const FALLBACK_FLAGS = {
  ENABLE_SHOP: false,
  shop_enabled: false, // Alternative name used in spec requirements
  ENABLE_STYLE_PROFILE: true,
  ENABLE_RQC: parseDevelopmentFlag(false, isProduction), // Disabled by default - under development
  ENABLE_SHIELD: false,
  ENABLE_BILLING: false,
  ENABLE_CUSTOM_PROMPT: parseDevelopmentFlag(false, isProduction), // Disabled by default - under development
  ENABLE_FACEBOOK_UI: parseDevelopmentFlag(false, isProduction), // Disabled by default - under development
  ENABLE_INSTAGRAM_UI: parseDevelopmentFlag(false, isProduction) // Disabled by default - under development
};

// Mock flags for development mode (extends fallback with mock-specific overrides)
const MOCK_FLAGS = {
  ...FALLBACK_FLAGS,
  ENABLE_RQC: parseDevelopmentFlag(false, isProduction), // Keep disabled even in mock mode - under development
  ENABLE_SHIELD: true,
  ENABLE_BILLING: true,
  shop_enabled: true, // Enable shop in mock mode for testing
  ENABLE_CUSTOM_PROMPT: parseDevelopmentFlag(false, isProduction), // Keep disabled even in mock mode - under development
  ENABLE_FACEBOOK_UI: parseDevelopmentFlag(false, isProduction), // Keep disabled even in mock mode - under development
  ENABLE_INSTAGRAM_UI: parseDevelopmentFlag(false, isProduction) // Keep disabled even in mock mode - under development
};

const FeatureFlagsContext = createContext(null);

/**
 * Hook to access feature flags context
 * @throws {Error} If used outside FeatureFlagsProvider
 */
export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  }
  return context;
};

/**
 * Simplified hook to check if a single feature flag is enabled
 * @param {string} flagName - Name of the feature flag to check
 * @returns {boolean} True if flag is enabled, false otherwise
 */
export const useFeatureFlag = (flagName) => {
  const { flags, loading } = useFeatureFlags();
  return {
    isEnabled: flags[flagName] === true,
    loading
  };
};

/**
 * FeatureFlagsProvider Component
 *
 * Provides feature flags context to all child components.
 * - Fetches flags from backend on mount
 * - Caches flags in memory
 * - Supports mock mode for development
 * - Automatic fallback to default flags on error
 */
export const FeatureFlagsProvider = ({ children }) => {
  const [flags, setFlags] = useState(FALLBACK_FLAGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshIntervalRef = useRef(null);
  const mountedRef = useRef(true);

  /**
   * Fetch feature flags from backend
   */
  const fetchFlags = async () => {
    const controller = new AbortController();
    let cancelled = false;

    try {
      setLoading(true);
      setError(null);

      // En modo mock, usar flags predeterminados
      if (isMockModeEnabled()) {
        if (!cancelled && mountedRef.current) {
          setFlags(MOCK_FLAGS);
          setLoading(false);
        }
        return;
      }

      // En modo real, obtener flags del backend
      const response = await fetch('/api/config/flags', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });

      if (response && response.ok) {
        const data = await response.json();
        const backendFlags = data.flags || {};

        // Apply production safety to development features from backend
        const safeBackendFlags = {
          ...backendFlags,
          ENABLE_RQC: parseDevelopmentFlag(backendFlags.ENABLE_RQC, isProduction),
          ENABLE_CUSTOM_PROMPT: parseDevelopmentFlag(
            backendFlags.ENABLE_CUSTOM_PROMPT,
            isProduction
          ),
          ENABLE_FACEBOOK_UI: parseDevelopmentFlag(backendFlags.ENABLE_FACEBOOK_UI, isProduction),
          ENABLE_INSTAGRAM_UI: parseDevelopmentFlag(backendFlags.ENABLE_INSTAGRAM_UI, isProduction)
        };

        const merged = { ...FALLBACK_FLAGS, ...safeBackendFlags };
        if (!cancelled && mountedRef.current) {
          setFlags(merged);
        }
      } else {
        // Fallback a flags por defecto si falla la API
        if (!cancelled && mountedRef.current) {
          setFlags(FALLBACK_FLAGS);
        }
      }
    } catch (err) {
      // Issue #1061: Gate debug logs behind dev env
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error fetching feature flags:', err);
      }
      if (!cancelled && mountedRef.current) {
        setError(err.message);
        // Fallback a flags por defecto
        setFlags(FALLBACK_FLAGS);
      }
    } finally {
      if (!cancelled && mountedRef.current) {
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  };

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    mountedRef.current = true;
    fetchFlags();

    return () => {
      mountedRef.current = false;
      // Clear refresh interval if exists
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []);

  /**
   * Optional: Periodic refresh (commented out by default)
   * Uncomment and configure interval if needed
   */
  // useEffect(() => {
  //   if (!isMockModeEnabled()) {
  //     // Refresh flags every 5 minutes
  //     refreshIntervalRef.current = setInterval(() => {
  //       fetchFlags();
  //     }, 5 * 60 * 1000);
  //   }

  //   return () => {
  //     if (refreshIntervalRef.current) {
  //       clearInterval(refreshIntervalRef.current);
  //       refreshIntervalRef.current = null;
  //     }
  //   };
  // }, []);

  /**
   * Check if a feature flag is enabled
   * @param {string} flagName - Name of the feature flag
   * @returns {boolean} True if flag is enabled
   */
  const isEnabled = (flagName) => {
    return flags[flagName] === true;
  };

  /**
   * Manual refresh function (can be called from components if needed)
   */
  const refresh = () => {
    fetchFlags();
  };

  const value = {
    flags,
    loading,
    error,
    isEnabled,
    refresh
  };

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
};

export default FeatureFlagsContext;
