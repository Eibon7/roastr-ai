/**
 * usePlanFeatures Hook
 * Issue #1062: Implementar lógica de visibilidad por plan
 *
 * Hook que devuelve features disponibles según plan del usuario.
 * Utiliza AuthContext para obtener el plan del usuario y devuelve
 * un objeto con flags booleanos indicando qué features están disponibles.
 */

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Plan features mapping based on subscription tier
 * Reference: docs/nodes/plan-features.md
 */
const PLAN_FEATURES = {
  starter_trial: {
    hasShield: true, // Basic
    hasPersona: true, // 1 field
    hasToneOriginal: false,
    hasSponsor: false,
    hasRQC: false,
    hasCustomPrompt: false,
    maxPersonaFields: 1
  },
  starter: {
    hasShield: true, // Basic
    hasPersona: true, // 1 field
    hasToneOriginal: false,
    hasSponsor: false,
    hasRQC: false,
    hasCustomPrompt: false,
    maxPersonaFields: 1
  },
  pro: {
    hasShield: true, // Full
    hasPersona: true, // 3 fields
    hasToneOriginal: true,
    hasSponsor: false,
    hasRQC: true,
    hasCustomPrompt: false,
    maxPersonaFields: 3
  },
  plus: {
    hasShield: true, // Advanced
    hasPersona: true, // 3 fields
    hasToneOriginal: true,
    hasSponsor: true,
    hasRQC: true, // Advanced
    hasCustomPrompt: true,
    maxPersonaFields: 3
  }
};

/**
 * Default features for unknown/invalid plans (free tier equivalent)
 */
const DEFAULT_FEATURES = {
  hasShield: false,
  hasPersona: false,
  hasToneOriginal: false,
  hasSponsor: false,
  hasRQC: false,
  hasCustomPrompt: false,
  maxPersonaFields: 0
};

/**
 * Hook to get plan-based features for current user
 *
 * @returns {Object} Features object with boolean flags:
 *   - hasShield: Shield moderation available
 *   - hasPersona: Persona configuration available
 *   - hasToneOriginal: Original tone customization available
 *   - hasSponsor: Sponsor/brand safety features available
 *   - hasRQC: Roast Quality Control available
 *   - hasCustomPrompt: Custom prompt editing available
 *   - maxPersonaFields: Maximum persona fields allowed
 *   - plan: Current plan ID
 *   - loading: Whether auth data is still loading
 */
export const usePlanFeatures = () => {
  const { userData, loading } = useAuth();

  const features = useMemo(() => {
    // If auth is loading, return defaults with loading: true
    if (loading) {
      return {
        ...DEFAULT_FEATURES,
        plan: null,
        loading: true
      };
    }

    // If no userData but not loading, return defaults with loading: false
    if (!userData) {
      return {
        ...DEFAULT_FEATURES,
        plan: null,
        loading: false
      };
    }

    // Get plan from userData (normalize to lowercase)
    const planId = userData.plan ? userData.plan.toLowerCase() : null;

    // If plan is not recognized, use defaults
    const planFeatures = PLAN_FEATURES[planId] || DEFAULT_FEATURES;

    return {
      ...planFeatures,
      plan: planId,
      loading: false
    };
  }, [userData, loading]);

  return features;
};

export default usePlanFeatures;
