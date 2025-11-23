/**
 * Tests for shop-specific formatting utilities
 */

import {
  formatAddonName,
  formatCurrency,
  formatDate,
  formatStatus
} from '../../../frontend/src/utils/shopFormatters';

describe('shopFormatters', () => {
  describe('formatAddonName', () => {
    it('should use purchase.addon_name when available', () => {
      const purchase = { addon_name: 'Custom Addon Name' };
      const shopData = { addons: {} };

      expect(formatAddonName(purchase, shopData)).toBe('Custom Addon Name');
    });

    it('should lookup from shop data when addon_name is not available', () => {
      const purchase = { addon_key: 'test_addon' };
      const shopData = {
        addons: {
          category1: [{ key: 'test_addon', name: 'Test Addon from Shop' }]
        }
      };

      expect(formatAddonName(purchase, shopData)).toBe('Test Addon from Shop');
    });

    it('should use hardcoded mapping for common addons', () => {
      const purchase = { addon_key: 'roasts_100' };
      const shopData = { addons: {} };

      expect(formatAddonName(purchase, shopData)).toBe('Roasts Pack 100');
    });

    it('should convert addon_key to title case as fallback', () => {
      const purchase = { addon_key: 'custom_addon_key' };
      const shopData = { addons: {} };

      expect(formatAddonName(purchase, shopData)).toBe('Custom Addon Key');
    });
  });

  describe('formatCurrency', () => {
    // Mock navigator.language for consistent testing
    const originalNavigator = global.navigator;

    beforeEach(() => {
      global.navigator = { language: 'es-ES' };
    });

    afterEach(() => {
      global.navigator = originalNavigator;
    });

    it('should use provided locale', () => {
      const result = formatCurrency(1000, 'USD', 'en-US');
      expect(result).toMatch(/\$10\.00/);
    });

    it('should use navigator.language when no locale provided', () => {
      const result = formatCurrency(1000, 'EUR');
      // Should use Spanish locale formatting
      expect(result).toMatch(/10,00/);
    });

    it('should fallback to es-ES when navigator.language is not available', () => {
      global.navigator = {};
      const result = formatCurrency(1000, 'EUR');
      expect(result).toMatch(/10,00/);
    });

    it('should handle different currencies', () => {
      const result = formatCurrency(1000, 'USD', 'en-US');
      expect(result).toMatch(/\$10\.00/);
    });
  });

  describe('formatDate', () => {
    const originalNavigator = global.navigator;

    beforeEach(() => {
      global.navigator = { language: 'es-ES' };
    });

    afterEach(() => {
      global.navigator = originalNavigator;
    });

    it('should format date with provided locale', () => {
      const result = formatDate('2023-12-25', 'en-US');
      expect(result).toMatch(/Dec/);
    });

    it('should use navigator.language when no locale provided', () => {
      const result = formatDate('2023-12-25');
      // Should use Spanish locale formatting
      expect(result).toMatch(/dic/);
    });
  });

  describe('formatStatus', () => {
    it('should capitalize first letter and lowercase the rest', () => {
      expect(formatStatus('completed')).toBe('Completed');
      expect(formatStatus('PENDING')).toBe('Pending');
      expect(formatStatus('fAiLeD')).toBe('Failed');
    });

    it('should handle empty string', () => {
      expect(formatStatus('')).toBe('');
    });
  });
});
