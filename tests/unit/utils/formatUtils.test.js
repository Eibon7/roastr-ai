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
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1048576)).toBe('1.0 MB');
    });
  });

  describe('formatDuration', () => {
    it('should format durations correctly', () => {
      expect(formatDuration(0)).toBe('0s');
      expect(formatDuration(60)).toBe('1m 0s');
      expect(formatDuration(3661)).toBe('1h 1m 1s');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages correctly', () => {
      expect(formatPercentage(0.5)).toBe('50.0%');
      expect(formatPercentage(1)).toBe('100.0%');
      expect(formatPercentage(0.123)).toBe('12.3%');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers correctly', () => {
      expect(formatNumber(1234)).toBe('1,234');
      expect(formatNumber(1234567)).toBe('1,234,567');
    });
  });

  describe('truncateText', () => {
    it('should truncate text correctly', () => {
      expect(truncateText('Hello World', 5)).toBe('He...');
      expect(truncateText('Short', 10)).toBe('Short');
      expect(truncateText('', 5)).toBe('');
      expect(truncateText(null, 5)).toBe('');
    });
  });
});
