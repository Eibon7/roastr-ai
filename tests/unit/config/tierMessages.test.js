/**
 * Unit Tests for Tier Messages Config
 * Issue #926 - Fase 1.3: Tests para Config Files
 *
 * Tests tier messages structure, helper functions, and message formatting
 */

const {
  tierMessages,
  getTierLimitMessage,
  getFeatureMessage,
  getUpgradeCta,
  getPlanChangeMessage,
  formatUsageWarning
} = require('../../../src/config/tierMessages');

describe('Tier Messages Config', () => {
  describe('Module Exports', () => {
    test('should export tierMessages object', () => {
      expect(tierMessages).toBeDefined();
      expect(typeof tierMessages).toBe('object');
      expect(tierMessages).not.toBeNull();
    });

    test('should export all helper functions', () => {
      expect(typeof getTierLimitMessage).toBe('function');
      expect(typeof getFeatureMessage).toBe('function');
      expect(typeof getUpgradeCta).toBe('function');
      expect(typeof getPlanChangeMessage).toBe('function');
      expect(typeof formatUsageWarning).toBe('function');
    });
  });

  describe('tierMessages Structure', () => {
    test('should have analysis section', () => {
      expect(tierMessages.analysis).toBeDefined();
      expect(typeof tierMessages.analysis).toBe('object');
      expect(tierMessages.analysis).toHaveProperty('free');
      expect(tierMessages.analysis).toHaveProperty('starter');
      expect(tierMessages.analysis).toHaveProperty('pro');
      expect(tierMessages.analysis).toHaveProperty('plus');
    });

    test('should have roast section', () => {
      expect(tierMessages.roast).toBeDefined();
      expect(typeof tierMessages.roast).toBe('object');
      expect(tierMessages.roast).toHaveProperty('free');
      expect(tierMessages.roast).toHaveProperty('starter');
      expect(tierMessages.roast).toHaveProperty('pro');
      expect(tierMessages.roast).toHaveProperty('plus');
    });

    test('should have platform section', () => {
      expect(tierMessages.platform).toBeDefined();
      expect(typeof tierMessages.platform).toBe('object');
      expect(tierMessages.platform).toHaveProperty('free');
      expect(tierMessages.platform).toHaveProperty('starter');
      expect(tierMessages.platform).toHaveProperty('pro');
      expect(tierMessages.platform).toHaveProperty('plus');
    });

    test('should have features section', () => {
      expect(tierMessages.features).toBeDefined();
      expect(typeof tierMessages.features).toBe('object');
      expect(tierMessages.features).toHaveProperty('shield');
      expect(tierMessages.features).toHaveProperty('ENABLE_ORIGINAL_TONE');
      expect(tierMessages.features).toHaveProperty('embedded_judge');
    });

    test('should have planChange section', () => {
      expect(tierMessages.planChange).toBeDefined();
      expect(typeof tierMessages.planChange).toBe('object');
      expect(tierMessages.planChange).toHaveProperty('upgrade');
      expect(tierMessages.planChange).toHaveProperty('downgrade');
    });

    test('should have upgradeCtas section', () => {
      expect(tierMessages.upgradeCtas).toBeDefined();
      expect(typeof tierMessages.upgradeCtas).toBe('object');
      expect(tierMessages.upgradeCtas).toHaveProperty('free_to_starter');
      expect(tierMessages.upgradeCtas).toHaveProperty('starter_to_pro');
      expect(tierMessages.upgradeCtas).toHaveProperty('pro_to_plus');
      expect(tierMessages.upgradeCtas).toHaveProperty('to_enterprise');
    });

    test('should have correct message types for each tier', () => {
      ['free', 'starter', 'pro', 'plus'].forEach((tier) => {
        expect(tierMessages.analysis[tier]).toHaveProperty('limit_exceeded');
        expect(tierMessages.analysis[tier]).toHaveProperty('near_limit');
        expect(tierMessages.analysis[tier]).toHaveProperty('upgrade_cta');
        expect(tierMessages.roast[tier]).toHaveProperty('limit_exceeded');
        expect(tierMessages.roast[tier]).toHaveProperty('near_limit');
        expect(tierMessages.roast[tier]).toHaveProperty('upgrade_cta');
      });
    });
  });

  describe('getTierLimitMessage()', () => {
    test('should return correct message for valid tier and limit type', () => {
      const message = getTierLimitMessage('analysis', 'free', 'limit_exceeded');
      expect(typeof message).toBe('string');
      expect(message).toContain('límite mensual');
      expect(message).toContain('100 análisis');
    });

    test('should return different message for different message types', () => {
      const limitExceeded = getTierLimitMessage('analysis', 'free', 'limit_exceeded');
      const nearLimit = getTierLimitMessage('analysis', 'free', 'near_limit');
      const upgradeCta = getTierLimitMessage('analysis', 'free', 'upgrade_cta');

      expect(limitExceeded).not.toBe(nearLimit);
      expect(nearLimit).not.toBe(upgradeCta);
      expect(upgradeCta).not.toBe(limitExceeded);
    });

    test('should return default message for invalid tier', () => {
      const message = getTierLimitMessage('analysis', 'invalid_tier', 'limit_exceeded');
      expect(typeof message).toBe('string');
      expect(message).toContain('Límite de analysis alcanzado');
    });

    test('should return default message for invalid limit type', () => {
      const message = getTierLimitMessage('invalid_limit', 'free', 'limit_exceeded');
      expect(typeof message).toBe('string');
      expect(message).toContain('Límite de invalid_limit alcanzado');
    });

    test('should return limit_exceeded as default when messageType does not exist', () => {
      const message = getTierLimitMessage('analysis', 'free', 'invalid_message_type');
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    test('should work for all tiers', () => {
      ['free', 'starter', 'pro', 'plus'].forEach((tier) => {
        const message = getTierLimitMessage('analysis', tier, 'limit_exceeded');
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      });
    });

    test('should work for all limit types', () => {
      ['analysis', 'roast', 'platform'].forEach((limitType) => {
        const message = getTierLimitMessage(limitType, 'free', 'limit_exceeded');
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getFeatureMessage()', () => {
    test('should return correct message for valid feature', () => {
      const message = getFeatureMessage('shield', 'not_available');
      expect(typeof message).toBe('string');
      expect(message).toContain('Shield');
      expect(message).toContain('Starter');
    });

    test('should return different message for different message types', () => {
      const notAvailable = getFeatureMessage('shield', 'not_available');
      const upgradeCta = getFeatureMessage('shield', 'upgrade_cta');

      expect(notAvailable).not.toBe(upgradeCta);
      expect(typeof notAvailable).toBe('string');
      expect(typeof upgradeCta).toBe('string');
    });

    test('should return default message for invalid feature', () => {
      const message = getFeatureMessage('invalid_feature', 'not_available');
      expect(typeof message).toBe('string');
      expect(message).toContain('no está disponible');
    });

    test('should return not_available as default when messageType does not exist', () => {
      const message = getFeatureMessage('shield', 'invalid_message_type');
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    test('should work for all features', () => {
      ['shield', 'ENABLE_ORIGINAL_TONE', 'embedded_judge'].forEach((feature) => {
        const message = getFeatureMessage(feature, 'not_available');
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      });
    });

    test('should handle embedded_judge coming_soon message', () => {
      const message = getFeatureMessage('embedded_judge', 'coming_soon');
      expect(typeof message).toBe('string');
      expect(message).toContain('próximamente');
    });
  });

  describe('getUpgradeCta()', () => {
    test('should return CTA for specific upgrade path', () => {
      const cta = getUpgradeCta('free', 'starter');
      expect(cta).toBeDefined();
      expect(typeof cta).toBe('object');
      expect(cta).toHaveProperty('title');
      expect(cta).toHaveProperty('price');
      expect(cta).toHaveProperty('benefits');
      expect(cta).toHaveProperty('cta');
      expect(Array.isArray(cta.benefits)).toBe(true);
    });

    test('should return correct CTA for free_to_starter', () => {
      const cta = getUpgradeCta('free', 'starter');
      expect(cta.title).toBe('Mejora a Starter');
      expect(cta.price).toBe('€5/mes');
    });

    test('should return correct CTA for starter_to_pro', () => {
      const cta = getUpgradeCta('starter', 'pro');
      expect(cta.title).toBe('Mejora a Pro');
      expect(cta.price).toBe('€15/mes');
    });

    test('should return correct CTA for pro_to_plus', () => {
      const cta = getUpgradeCta('pro', 'plus');
      expect(cta.title).toBe('Mejora a Plus');
      expect(cta.price).toBe('€50/mes');
    });

    test('should return default next tier upgrade when targetTier is null', () => {
      const starterCta = getUpgradeCta('starter_trial');
      expect(starterCta).toBeDefined();
      expect(starterCta.title).toBe('Mejora a Starter');

      const starterCta2 = getUpgradeCta('starter');
      expect(starterCta2).toBeDefined();
      expect(starterCta2.title).toBe('Mejora a Pro');

      const proCta = getUpgradeCta('pro');
      expect(proCta).toBeDefined();
      expect(proCta.title).toBe('Mejora a Plus');

      const plusCta = getUpgradeCta('plus');
      expect(plusCta).toBeDefined();
      expect(plusCta.title).toBe('Contacta con ventas');
    });

    test('should return enterprise CTA for invalid tier', () => {
      const cta = getUpgradeCta('invalid_tier');
      expect(cta).toBeDefined();
      expect(cta.title).toBe('Contacta con ventas');
    });

    test('should return enterprise CTA for invalid upgrade path', () => {
      const cta = getUpgradeCta('free', 'invalid_target');
      expect(cta).toBeDefined();
      expect(cta.title).toBe('Contacta con ventas');
    });
  });

  describe('getPlanChangeMessage()', () => {
    test('should return correct message for upgrade success', () => {
      const message = getPlanChangeMessage('upgrade', 'success');
      expect(typeof message).toBe('string');
      expect(message).toContain('Upgrade completado');
    });

    test('should return correct message for upgrade processing', () => {
      const message = getPlanChangeMessage('upgrade', 'processing');
      expect(typeof message).toBe('string');
      expect(message).toContain('Procesando');
    });

    test('should return correct message for upgrade failed', () => {
      const message = getPlanChangeMessage('upgrade', 'failed');
      expect(typeof message).toBe('string');
      expect(message).toContain('Error procesando');
    });

    test('should return correct message for downgrade scheduled', () => {
      const message = getPlanChangeMessage('downgrade', 'scheduled');
      expect(typeof message).toBe('string');
      expect(message).toContain('programado');
    });

    test('should return correct message for downgrade usage_exceeds', () => {
      const message = getPlanChangeMessage('downgrade', 'usage_exceeds');
      expect(typeof message).toBe('string');
      expect(message).toContain('excede los límites');
    });

    test('should return correct message for downgrade cancelled', () => {
      const message = getPlanChangeMessage('downgrade', 'cancelled');
      expect(typeof message).toBe('string');
      expect(message).toContain('cancelado');
    });

    test('should return default message for invalid change type', () => {
      const message = getPlanChangeMessage('invalid_change', 'success');
      expect(typeof message).toBe('string');
      expect(message).toContain('desconocido');
    });

    test('should return default message for invalid status', () => {
      const message = getPlanChangeMessage('upgrade', 'invalid_status');
      expect(typeof message).toBe('string');
      expect(message).toContain('desconocido');
    });
  });

  describe('formatUsageWarning()', () => {
    test('should return error level warning when percentage >= 100', () => {
      const warning = formatUsageWarning('analysis', 100, 100, 100);
      expect(warning).toBeDefined();
      expect(warning.level).toBe('error');
      expect(warning.message).toContain('alcanzado');
      expect(warning.action).toBe('upgrade_required');
    });

    test('should return error level warning when percentage > 100', () => {
      const warning = formatUsageWarning('roast', 150, 100, 150);
      expect(warning).toBeDefined();
      expect(warning.level).toBe('error');
      expect(warning.action).toBe('upgrade_required');
    });

    test('should return warning level when percentage >= 80 and < 100', () => {
      const warning = formatUsageWarning('analysis', 80, 100, 80);
      expect(warning).toBeDefined();
      expect(warning.level).toBe('warning');
      expect(warning.message).toContain('Te queda poco');
      expect(warning.action).toBe('consider_upgrade');
    });

    test('should return warning level when percentage = 90', () => {
      const warning = formatUsageWarning('roast', 90, 100, 90);
      expect(warning).toBeDefined();
      expect(warning.level).toBe('warning');
    });

    test('should return info level when percentage >= 60 and < 80', () => {
      const warning = formatUsageWarning('analysis', 60, 100, 60);
      expect(warning).toBeDefined();
      expect(warning.level).toBe('info');
      expect(warning.message).toContain('Has usado');
      expect(warning.action).toBe('monitor');
    });

    test('should return info level when percentage = 70', () => {
      const warning = formatUsageWarning('roast', 70, 100, 70);
      expect(warning).toBeDefined();
      expect(warning.level).toBe('info');
    });

    test('should return null when percentage < 60', () => {
      const warning = formatUsageWarning('analysis', 50, 100, 50);
      expect(warning).toBeNull();
    });

    test('should return null when percentage = 0', () => {
      const warning = formatUsageWarning('roast', 0, 100, 0);
      expect(warning).toBeNull();
    });

    test('should format message correctly with current and limit values', () => {
      const warning = formatUsageWarning('analysis', 100, 100, 100);
      expect(warning.message).toContain('100/100');
    });

    test('should work for all limit types', () => {
      ['analysis', 'roast', 'platform'].forEach((limitType) => {
        const warning = formatUsageWarning(limitType, 100, 100, 100);
        expect(warning).toBeDefined();
        expect(warning.message).toContain(limitType);
      });
    });
  });
});
