import { useState, useEffect } from 'react';
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
  ENABLE_INSTAGRAM_UI: parseDevelopmentFlag(false, isProduction), // Disabled by default - under development
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
  ENABLE_INSTAGRAM_UI: parseDevelopmentFlag(false, isProduction), // Keep disabled even in mock mode - under development
};

/**
 * Hook para acceder a los feature flags del sistema
 * En modo mock, devuelve flags predeterminados para desarrollo
 * En modo real, obtiene los flags del backend
 */
export const useFeatureFlags = () => {
  const [flags, setFlags] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const fetchFlags = async () => {
      try {
        setLoading(true);

        // En modo mock, usar flags predeterminados
        if (isMockModeEnabled()) {
          if (!cancelled) setFlags(MOCK_FLAGS);
          if (!cancelled) setLoading(false);
          return;
        }

        // En modo real, obtener flags del backend
        const response = await fetch('/api/config/flags', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          const backendFlags = data.flags || {};
          
          // Apply production safety to development features from backend
          const safeBackendFlags = {
            ...backendFlags,
            ENABLE_RQC: parseDevelopmentFlag(backendFlags.ENABLE_RQC, isProduction),
            ENABLE_CUSTOM_PROMPT: parseDevelopmentFlag(backendFlags.ENABLE_CUSTOM_PROMPT, isProduction),
            ENABLE_FACEBOOK_UI: parseDevelopmentFlag(backendFlags.ENABLE_FACEBOOK_UI, isProduction),
            ENABLE_INSTAGRAM_UI: parseDevelopmentFlag(backendFlags.ENABLE_INSTAGRAM_UI, isProduction),
          };
          
          const merged = { ...FALLBACK_FLAGS, ...safeBackendFlags };
          if (!cancelled) setFlags(merged);
        } else {
          // Fallback a flags por defecto si falla la API
          if (!cancelled) setFlags(FALLBACK_FLAGS);
        }
      } catch (err) {
        console.error('Error fetching feature flags:', err);
        if (!cancelled) setError(err.message);
        // Fallback a flags por defecto
        if (!cancelled) setFlags(FALLBACK_FLAGS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFlags();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  return {
    flags,
    loading,
    error,
    isEnabled: (flagName) => flags[flagName] === true,
  };
};

export default useFeatureFlags;
