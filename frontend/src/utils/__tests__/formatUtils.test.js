import { formatCurrency } from '../formatUtils';

describe('formatCurrency', () => {
  test('should handle valid currency strings', () => {
    expect(formatCurrency(1234, 'USD')).toBe('$12.34');
    expect(formatCurrency(1000, 'EUR')).toBe('€10.00');
  });

  test('should handle null currency safely', () => {
    expect(() => formatCurrency(1234, null)).not.toThrow();
    expect(formatCurrency(1234, null)).toBe('$12.34'); // Should default to USD
  });

  test('should handle undefined currency safely', () => {
    expect(() => formatCurrency(1234, undefined)).not.toThrow();
    expect(formatCurrency(1234, undefined)).toBe('$12.34'); // Should default to USD
  });

  test('should handle non-string currency safely', () => {
    expect(() => formatCurrency(1234, 123)).not.toThrow();
    expect(formatCurrency(1234, 123)).toBe('$12.34'); // Should default to USD for non-string values
  });

  test('should handle invalid amount', () => {
    expect(formatCurrency(null, 'USD')).toBe('$0.00');
    expect(formatCurrency(undefined, 'USD')).toBe('$0.00');
    expect(formatCurrency('invalid', 'USD')).toBe('$0.00');
  });
});
