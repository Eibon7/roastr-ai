/**
 * Tests for formatUtils.js
 * Validates currency formatting and other utility functions
 */

const { formatCurrency, formatFileSize, formatDuration, formatPercentage, formatNumber, truncateText } = require('../../../src/utils/formatUtils');

describe('formatUtils', () => {
  describe('formatCurrency', () => {
    it('should format USD currency correctly', () => {
      expect(formatCurrency(1234, 'USD')).toBe('$12.34');
      expect(formatCurrency(0, 'USD')).toBe('$0.00');
      expect(formatCurrency(100, 'USD')).toBe('$1.00');
    });

    it('should format EUR currency correctly', () => {
      expect(formatCurrency(1234, 'EUR')).toBe('€12.34');
      expect(formatCurrency(0, 'EUR')).toBe('€0.00');
    });

    it('should handle different locales', () => {
      expect(formatCurrency(1234, 'USD', 'en-US')).toBe('$12.34');
      const eurDE = formatCurrency(1234, 'EUR', 'de-DE');
      expect(eurDE.replace(/\u00A0/g, ' ')).toBe('12,34 €');
    });

    it('should handle invalid inputs gracefully', () => {
      expect(formatCurrency(null, 'USD')).toBe('$0.00');
      expect(formatCurrency(undefined, 'USD')).toBe('$0.00');
      expect(formatCurrency('invalid', 'USD')).toBe('$0.00');
      expect(formatCurrency(NaN, 'USD')).toBe('$0.00');
    });

    it('should use default currency when not provided', () => {
      expect(formatCurrency(1234)).toBe('$12.34');
      expect(formatCurrency(1234, null)).toBe('$12.34');
      expect(formatCurrency(1234, '')).toBe('$12.34');
    });

    it('should handle case insensitive currency codes', () => {
      expect(formatCurrency(1234, 'usd')).toBe('$12.34');
      expect(formatCurrency(1234, 'eur')).toBe('€12.34');
    });
  });

  describe('formatFileSize', () => {
    it('should format file sizes correctly', () => {
      expect(formatFileSize(0)).toBe('0B');
      expect(formatFileSize(1024)).toBe('1.00KB');
      expect(formatFileSize(1048576)).toBe('1.00MB');
    });

    it('should handle negative file sizes', () => {
      expect(formatFileSize(-1024)).toBe('-1.00KB');
      expect(formatFileSize(-1048576)).toBe('-1.00MB');
    });

    it('should handle very large file sizes (TB+)', () => {
      expect(formatFileSize(1099511627776)).toBe('1.00TB'); // 1 TB
      expect(formatFileSize(5497558138880)).toBe('5.00TB'); // 5 TB
    });

    it('should handle very small non-zero sizes', () => {
      expect(formatFileSize(1)).toBe('1B');
      expect(formatFileSize(512)).toBe('512B');
      expect(formatFileSize(1023)).toBe('1023B');
    });

    it('should handle invalid inputs', () => {
      expect(formatFileSize(null)).toBe('0B');
      expect(formatFileSize(undefined)).toBe('0B');
      expect(formatFileSize('invalid')).toBe('0B');
      expect(formatFileSize(NaN)).toBe('0B');
    });
  });

  describe('formatDuration', () => {
    it('should format durations correctly', () => {
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(1000)).toBe('1s');
      expect(formatDuration(60000)).toBe('1m');
      expect(formatDuration(3661000)).toBe('1h 1m');
    });

    it('should handle very short durations (<1s)', () => {
      expect(formatDuration(1)).toBe('1ms');
      expect(formatDuration(100)).toBe('100ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should handle very long durations (days)', () => {
      expect(formatDuration(86400000)).toBe('1d'); // 1 day (only shows top unit)
      expect(formatDuration(172800000)).toBe('2d'); // 2 days
      expect(formatDuration(90000000)).toBe('1d 1h'); // 1 day 1 hour
    });

    it('should handle negative and invalid inputs', () => {
      expect(formatDuration(-100)).toBe('0ms');
      expect(formatDuration(null)).toBe('0ms');
      expect(formatDuration(undefined)).toBe('0ms');
      expect(formatDuration(NaN)).toBe('0ms');
      expect(formatDuration('invalid')).toBe('0ms');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages correctly', () => {
      expect(formatPercentage(50)).toBe('50.0%');
      expect(formatPercentage(100)).toBe('100.0%');
      expect(formatPercentage(12.3)).toBe('12.3%');
    });

    it('should handle negative percentages', () => {
      expect(formatPercentage(-50)).toBe('-50.0%');
      expect(formatPercentage(-10)).toBe('-10.0%');
    });

    it('should handle percentages over 100%', () => {
      expect(formatPercentage(150)).toBe('150.0%');
      expect(formatPercentage(250)).toBe('250.0%');
    });

    it('should handle custom decimal places', () => {
      expect(formatPercentage(12.345, 0)).toBe('12%');
      expect(formatPercentage(12.345, 2)).toBe('12.35%');
      expect(formatPercentage(12.345, 3)).toBe('12.345%');
    });

    it('should handle invalid inputs', () => {
      expect(formatPercentage(null)).toBe('0.0%');
      expect(formatPercentage(undefined)).toBe('0.0%');
      expect(formatPercentage(NaN)).toBe('0.0%');
      expect(formatPercentage('invalid')).toBe('0.0%');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers correctly', () => {
      const result = formatNumber(1234);
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(formatNumber(1234567).length).toBeGreaterThan(7);
    });

    it('should handle negative numbers', () => {
      const result = formatNumber(-1234);
      expect(result).toContain('-');
      expect(result).toContain('1234');
    });

    it('should handle zero and small numbers', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(1)).toBe('1');
      expect(formatNumber(999)).toBe('999');
    });

    it('should handle very large numbers', () => {
      const billion = formatNumber(1000000000);
      expect(billion.length).toBeGreaterThan(10); // Has separators
      expect(billion).toContain('1');

      const trillion = formatNumber(1234567890123);
      expect(trillion.length).toBeGreaterThan(13);
    });

    it('should handle invalid inputs', () => {
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber(undefined)).toBe('0');
      expect(formatNumber(NaN)).toBe('0');
      expect(formatNumber('invalid')).toBe('0');
    });
  });

  describe('truncateText', () => {
    it('should truncate text correctly', () => {
      expect(truncateText('Hello World', 5)).toBe('He...');
      expect(truncateText('Short', 10)).toBe('Short');
      expect(truncateText('', 5)).toBe('');
      expect(truncateText(null, 5)).toBe('');
    });

    it('should handle custom suffix', () => {
      expect(truncateText('Hello World', 8, '...')).toBe('Hello...');
      expect(truncateText('Hello World', 8, '…')).toBe('Hello W…');
      expect(truncateText('Hello World', 8, '')).toBe('Hello Wo');
    });

    it('should handle edge case lengths', () => {
      expect(truncateText('Hello', 0, '...')).toBe('...');
      expect(truncateText('Hello', 1, '...')).toBe('...');
      expect(truncateText('Hello', 5)).toBe('Hello'); // Exact length
    });

    it('should handle very long text', () => {
      const longText = 'a'.repeat(10000);
      const truncated = truncateText(longText, 50);
      expect(truncated.length).toBe(50);
      expect(truncated).toBe('a'.repeat(47) + '...');
    });

    it('should handle invalid inputs', () => {
      expect(truncateText(undefined, 10)).toBe('');
      expect(truncateText(123, 10)).toBe('');
      expect(truncateText({}, 10)).toBe('');
    });
  });

  describe('formatCurrency - Edge Cases', () => {
    it('should handle exotic locales', () => {
      // Japanese Yen (no decimal places, 1234 cents = ¥12)
      const jpyJP = formatCurrency(1234, 'JPY', 'ja-JP');
      expect(jpyJP).toContain('12');
      // Accept both full-width (￥) and half-width (¥) Yen symbols
      expect(jpyJP.includes('¥') || jpyJP.includes('￥')).toBe(true);

      // Chinese Yuan
      const cnyZH = formatCurrency(1234, 'CNY', 'zh-CN');
      expect(cnyZH).toContain('12');

      // Arabic locale (uses Arabic numerals, so just verify it returns a string)
      const sarAR = formatCurrency(1234, 'SAR', 'ar-SA');
      expect(sarAR.length).toBeGreaterThan(5);
      expect(typeof sarAR).toBe('string');
    });

    it('should handle negative amounts', () => {
      expect(formatCurrency(-1234, 'USD')).toContain('-');
      expect(formatCurrency(-1234, 'USD')).toContain('12.34');
    });

    it('should handle very large amounts', () => {
      const billion = formatCurrency(100000000000, 'USD'); // $1 billion
      expect(billion).toContain('1,000,000,000');

      const trillion = formatCurrency(100000000000000, 'USD'); // $1 trillion
      expect(trillion).toContain('1,000,000,000,000');
    });

    it('should handle very small amounts', () => {
      expect(formatCurrency(1, 'USD')).toBe('$0.01');
      expect(formatCurrency(5, 'USD')).toBe('$0.05');
      expect(formatCurrency(99, 'USD')).toBe('$0.99');
    });

    it('should handle zero-decimal currencies', () => {
      // JPY, KRW don't use decimal places (1234 cents = ¥12 or ₩12)
      const jpy = formatCurrency(1234, 'JPY');
      expect(jpy).toContain('12');
      expect(jpy.includes('¥') || jpy.includes('￥')).toBe(true);

      const krw = formatCurrency(1234, 'KRW');
      expect(krw).toContain('12');
      expect(krw).toContain('₩');
    });
  });
});
