/**
 * Formatting utilities for metrics and numbers
 * Issue #1067: Implementar formateo de métricas y números en UI
 */

export interface FormatNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
}

/**
 * Format a number with thousand separators
 * @param value - Number to format
 * @param options - Formatting options
 * @returns Formatted number string
 *
 * @example
 * formatNumber(1234.56) // "1,234.56"
 * formatNumber(1234.56, { maximumFractionDigits: 0 }) // "1,235"
 */
export function formatNumber(
  value: number | null | undefined,
  options: FormatNumberOptions = {}
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  const { minimumFractionDigits = 0, maximumFractionDigits = 2, useGrouping = true } = options;

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping
  }).format(value);
}

/**
 * Format a number as currency
 * @param value - Amount in cents or base currency unit
 * @param currency - Currency code (default: 'EUR')
 * @param showCents - Whether to show cents (default: true)
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1234.56, 'EUR') // "€1,234.56"
 * formatCurrency(1234.56, 'USD') // "$1,234.56"
 * formatCurrency(1234, 'EUR', false) // "€1,234"
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'EUR',
  showCents: boolean = true
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(0);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0
  }).format(value);
}

/**
 * Format a number as percentage
 * @param value - Percentage value (0-100 or 0-1)
 * @param decimals - Number of decimal places (default: 0)
 * @param asDecimal - If true, treats value as 0-1 range; if false, treats as 0-100 (default: false)
 * @returns Formatted percentage string
 *
 * @example
 * formatPercentage(25.5) // "26%"
 * formatPercentage(25.5, 1) // "25.5%"
 * formatPercentage(0.255, 1, true) // "25.5%"
 */
export function formatPercentage(
  value: number | null | undefined,
  decimals: number = 0,
  asDecimal: boolean = false
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }

  // Convert from decimal (0-1) to percentage (0-100) if needed
  const percentageValue = asDecimal ? value * 100 : value;

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(percentageValue / 100);
}

/**
 * Format a number as decimal with specified precision
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted decimal string
 *
 * @example
 * formatDecimal(1234.5678) // "1,234.57"
 * formatDecimal(1234.5678, 0) // "1,235"
 * formatDecimal(1234.5, 3) // "1,234.500"
 */
export function formatDecimal(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(0);
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

/**
 * Format a large number with K, M, B suffixes
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted number string with suffix
 *
 * @example
 * formatCompact(1234) // "1.2K"
 * formatCompact(1234567) // "1.2M"
 * formatCompact(1234567890) // "1.2B"
 */
export function formatCompact(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: decimals
  }).format(value);
}
