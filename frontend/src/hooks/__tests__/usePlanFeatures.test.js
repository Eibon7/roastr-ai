/**
 * Tests for usePlanFeatures hook
 * Issue #1062: Implementar lógica de visibilidad por plan
 */

import { renderHook } from '@testing-library/react';
import { usePlanFeatures } from '../usePlanFeatures';
import { useAuth } from '../../contexts/AuthContext';

// Mock AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

describe('usePlanFeatures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Starter Trial plan', () => {
    it('should return correct features for starter_trial plan', () => {
      useAuth.mockReturnValue({
        userData: { plan: 'starter_trial' },
        loading: false
      });

      const { result } = renderHook(() => usePlanFeatures());

      expect(result.current.plan).toBe('starter_trial');
      expect(result.current.hasShield).toBe(true);
      expect(result.current.hasPersona).toBe(true);
      expect(result.current.hasToneOriginal).toBe(false);
      expect(result.current.hasSponsor).toBe(false);
      expect(result.current.hasRQC).toBe(false);
      expect(result.current.hasCustomPrompt).toBe(false);
      expect(result.current.maxPersonaFields).toBe(1);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Starter plan', () => {
    it('should return correct features for starter plan', () => {
      useAuth.mockReturnValue({
        userData: { plan: 'starter' },
        loading: false
      });

      const { result } = renderHook(() => usePlanFeatures());

      expect(result.current.plan).toBe('starter');
      expect(result.current.hasShield).toBe(true);
      expect(result.current.hasPersona).toBe(true);
      expect(result.current.hasToneOriginal).toBe(false);
      expect(result.current.hasSponsor).toBe(false);
      expect(result.current.hasRQC).toBe(false);
      expect(result.current.hasCustomPrompt).toBe(false);
      expect(result.current.maxPersonaFields).toBe(1);
    });
  });

  describe('Pro plan', () => {
    it('should return correct features for pro plan', () => {
      useAuth.mockReturnValue({
        userData: { plan: 'pro' },
        loading: false
      });

      const { result } = renderHook(() => usePlanFeatures());

      expect(result.current.plan).toBe('pro');
      expect(result.current.hasShield).toBe(true);
      expect(result.current.hasPersona).toBe(true);
      expect(result.current.hasToneOriginal).toBe(true);
      expect(result.current.hasSponsor).toBe(false);
      expect(result.current.hasRQC).toBe(true);
      expect(result.current.hasCustomPrompt).toBe(false);
      expect(result.current.maxPersonaFields).toBe(3);
    });
  });

  describe('Plus plan', () => {
    it('should return correct features for plus plan', () => {
      useAuth.mockReturnValue({
        userData: { plan: 'plus' },
        loading: false
      });

      const { result } = renderHook(() => usePlanFeatures());

      expect(result.current.plan).toBe('plus');
      expect(result.current.hasShield).toBe(true);
      expect(result.current.hasPersona).toBe(true);
      expect(result.current.hasToneOriginal).toBe(true);
      expect(result.current.hasSponsor).toBe(true);
      expect(result.current.hasRQC).toBe(true);
      expect(result.current.hasCustomPrompt).toBe(true);
      expect(result.current.maxPersonaFields).toBe(3);
    });
  });

  describe('Loading state', () => {
    it('should return defaults when loading', () => {
      useAuth.mockReturnValue({
        userData: null,
        loading: true
      });

      const { result } = renderHook(() => usePlanFeatures());

      expect(result.current.loading).toBe(true);
      expect(result.current.plan).toBe(null);
      expect(result.current.hasShield).toBe(false);
      expect(result.current.hasPersona).toBe(false);
    });
  });

  describe('No user data', () => {
    it('should return defaults when userData is null', () => {
      useAuth.mockReturnValue({
        userData: null,
        loading: false
      });

      const { result } = renderHook(() => usePlanFeatures());

      // When userData is null but loading is false, it should still return defaults
      expect(result.current.plan).toBe(null);
      expect(result.current.hasShield).toBe(false);
      expect(result.current.hasPersona).toBe(false);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Unknown plan', () => {
    it('should normalize unknown plan to starter_trial (default fallback)', () => {
      useAuth.mockReturnValue({
        userData: { plan: 'unknown_plan' },
        loading: false
      });

      const { result } = renderHook(() => usePlanFeatures());

      // normalizePlanId maps unknown plans to 'starter_trial' as default fallback
      expect(result.current.plan).toBe('starter_trial');
      expect(result.current.hasShield).toBe(true); // starter_trial has Shield
      expect(result.current.hasPersona).toBe(true); // starter_trial has Persona
      expect(result.current.hasToneOriginal).toBe(false);
      expect(result.current.hasSponsor).toBe(false);
      expect(result.current.hasRQC).toBe(false);
      expect(result.current.hasCustomPrompt).toBe(false);
      expect(result.current.maxPersonaFields).toBe(1); // starter_trial allows 1 field
    });
  });

  describe('Case insensitive plan names', () => {
    it('should handle uppercase plan names', () => {
      useAuth.mockReturnValue({
        userData: { plan: 'PRO' },
        loading: false
      });

      const { result } = renderHook(() => usePlanFeatures());

      expect(result.current.plan).toBe('pro');
      expect(result.current.hasRQC).toBe(true);
      expect(result.current.hasToneOriginal).toBe(true);
    });

    it('should handle mixed case plan names', () => {
      useAuth.mockReturnValue({
        userData: { plan: 'StArTeR' },
        loading: false
      });

      const { result } = renderHook(() => usePlanFeatures());

      expect(result.current.plan).toBe('starter');
      expect(result.current.hasRQC).toBe(false);
      expect(result.current.maxPersonaFields).toBe(1);
    });
  });
});
