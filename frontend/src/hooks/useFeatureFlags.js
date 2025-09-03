import { useState, useEffect } from 'react';
import { isMockModeEnabled } from '../lib/mockMode';

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
    const fetchFlags = async () => {
      try {
        setLoading(true);
        
        // En modo mock, usar flags predeterminados
        if (isMockModeEnabled()) {
          const mockFlags = {
            ENABLE_SHOP: false, // Shop deshabilitado por defecto en mock
            ENABLE_STYLE_PROFILE: true,
            ENABLE_RQC: true,
            ENABLE_SHIELD: true,
            ENABLE_BILLING: true,
          };
          setFlags(mockFlags);
          setLoading(false);
          return;
        }

        // En modo real, obtener flags del backend
        const response = await fetch('/api/config/flags', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setFlags(data.flags || {});
        } else {
          // Fallback a flags por defecto si falla la API
          setFlags({
            ENABLE_SHOP: false,
            ENABLE_STYLE_PROFILE: true,
            ENABLE_RQC: false,
            ENABLE_SHIELD: false,
            ENABLE_BILLING: false,
          });
        }
      } catch (err) {
        console.error('Error fetching feature flags:', err);
        setError(err.message);
        // Fallback a flags por defecto
        setFlags({
          ENABLE_SHOP: false,
          ENABLE_STYLE_PROFILE: true,
          ENABLE_RQC: false,
          ENABLE_SHIELD: false,
          ENABLE_BILLING: false,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchFlags();
  }, []);

  return {
    flags,
    loading,
    error,
    isEnabled: (flagName) => flags[flagName] === true,
  };
};

export default useFeatureFlags;
