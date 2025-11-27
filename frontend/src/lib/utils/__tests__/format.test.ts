/**
 * Format utilities tests
 * Issue #1067: Implementar formateo de métricas y números en UI
 */

import {
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatDecimal,
  formatCompact
} from '../format';

describe('format utilities', () => {
  describe('formatNumber', () => {
    it('should format number with default options', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56');
      expect(formatNumber(1000)).toBe('1,000');
    });

    it('should format number without decimals', () => {
      expect(formatNumber(1234.56, { maximumFractionDigits: 0 })).toBe('1,235');
    });

    it('should format number without grouping', () => {
      expect(formatNumber(1234.56, { useGrouping: false })).toBe('1234.56');
    });

    it('should handle null and undefined', () => {
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber(undefined)).toBe('0');
    });

    it('should handle NaN', () => {
      expect(formatNumber(NaN)).toBe('0');
    });

    it('should respect minimum and maximum fraction digits', () => {
      expect(formatNumber(1234.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe(
        '1,234.50'
      );
      expect(formatNumber(1234.567, { minimumFractionDigits: 0, maximumFractionDigits: 1 })).toBe(
        '1,234.6'
      );
    });
  });

  describe('formatCurrency', () => {
    it('should format EUR currency by default', () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain('1,234.56');
      expect(result).toContain('€');
    });

    it('should format USD currency', () => {
      const result = formatCurrency(1234.56, 'USD');
      expect(result).toContain('1,234.56');
      expect(result).toContain('$');
    });

    it('should format without cents', () => {
      const result = formatCurrency(1234.56, 'EUR', false);
      expect(result).toContain('1,235');
      expect(result).not.toContain('.');
    });

    it('should handle null and undefined', () => {
      expect(formatCurrency(null)).toBe('€0');
      expect(formatCurrency(undefined)).toBe('€0');
    });

    it('should handle NaN', () => {
      expect(formatCurrency(NaN)).toBe('€0');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage from 0-100 range', () => {
      expect(formatPercentage(25.5)).toBe('26%');
      expect(formatPercentage(25.5, 1)).toBe('25.5%');
    });

    it('should format percentage from 0-1 range', () => {
      expect(formatPercentage(0.255, 1, true)).toBe('25.5%');
      expect(formatPercentage(0.5, 0, true)).toBe('50%');
    });

    it('should handle null and undefined', () => {
      expect(formatPercentage(null)).toBe('0%');
      expect(formatPercentage(undefined)).toBe('0%');
    });

    it('should handle NaN', () => {
      expect(formatPercentage(NaN)).toBe('0%');
    });

    it('should respect decimal places', () => {
      expect(formatPercentage(25.567, 2)).toBe('25.57%');
      expect(formatPercentage(25.567, 0)).toBe('26%');
    });
  });

  describe('formatDecimal', () => {
    it('should format decimal with default 2 decimals', () => {
      expect(formatDecimal(1234.5678)).toBe('1,234.57');
      expect(formatDecimal(1234.5)).toBe('1,234.50');
    });

    it('should format decimal with custom decimals', () => {
      expect(formatDecimal(1234.5678, 0)).toBe('1,235');
      expect(formatDecimal(1234.5, 3)).toBe('1,234.500');
    });

    it('should handle null and undefined', () => {
      expect(formatDecimal(null)).toBe('0.00');
      expect(formatDecimal(undefined)).toBe('0.00');
      expect(formatDecimal(null, 3)).toBe('0.000');
      expect(formatDecimal(null, 0)).toBe('0'); // Should not return "0."
    });

    it('should handle NaN', () => {
      expect(formatDecimal(NaN)).toBe('0.00');
    });
  });

  describe('formatCompact', () => {
    it('should format thousands with K suffix', () => {
      const result = formatCompact(1234);
      expect(result).toContain('K');
      expect(result).toMatch(/1\.\d+K/);
    });

    it('should format millions with M suffix', () => {
      const result = formatCompact(1234567);
      expect(result).toContain('M');
      expect(result).toMatch(/1\.\d+M/);
    });

    it('should format billions with B suffix', () => {
      const result = formatCompact(1234567890);
      expect(result).toContain('B');
      expect(result).toMatch(/1\.\d+B/);
    });

    it('should handle null and undefined', () => {
      expect(formatCompact(null)).toBe('0');
      expect(formatCompact(undefined)).toBe('0');
    });

    it('should handle NaN', () => {
      expect(formatCompact(NaN)).toBe('0');
    });

    it('should respect decimal places', () => {
      const result = formatCompact(1234, 2);
      expect(result).toMatch(/1\.\d{2}K/);
    });
  });
});
