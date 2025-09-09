import { useState, useEffect } from 'react';
import { isMockModeEnabled } from '../lib/mockMode';

// Shared fallback flags constant used across all fallback scenarios
const FALLBACK_FLAGS = {
  ENABLE_SHOP: false,
  ENABLE_STYLE_PROFILE: true,
  ENABLE_RQC: false, // Disabled by default - under development
  ENABLE_SHIELD: false,
  ENABLE_BILLING: false,
  ENABLE_CUSTOM_PROMPT: false, // Disabled by default - under development
  ENABLE_FACEBOOK_UI: false, // Disabled by default - under development
  ENABLE_INSTAGRAM_UI: false, // Disabled by default - under development
};

// Mock flags for development mode (extends fallback with mock-specific overrides)
const MOCK_FLAGS = {
  ...FALLBACK_FLAGS,
  ENABLE_RQC: false, // Keep disabled even in mock mode - under development
  ENABLE_SHIELD: true,
  ENABLE_BILLING: true,
  ENABLE_CUSTOM_PROMPT: false, // Keep disabled even in mock mode - under development
  ENABLE_FACEBOOK_UI: false, // Keep disabled even in mock mode - under development
  ENABLE_INSTAGRAM_UI: false, // Keep disabled even in mock mode - under development
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
          const merged = { ...FALLBACK_FLAGS, ...(data.flags || {}) };
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
