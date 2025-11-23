/**
 * Frontend formatting utilities
 */

/**
 * Format currency amount with proper internationalization
 * @param {number} amountCents - Amount in cents
 * @param {string} currency - Currency code (default: 'USD')
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted currency (e.g., "$12.34", "€10.50")
 */
export function formatCurrency(amountCents, currency = 'USD', locale = 'en-US') {
  // Safely normalize currency to a valid string
  const safeCurrency = typeof currency === 'string' && currency ? currency.toUpperCase() : 'USD';

  if (typeof amountCents !== 'number' || isNaN(amountCents)) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: safeCurrency
    }).format(0);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: safeCurrency
  }).format(amountCents / 100);
}

/**
 * Format file size in human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size with units (B, KB, MB, GB, TB)
 */
export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes)) {
    return '0 B';
  }

  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = Math.abs(bytes);
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  // Use appropriate decimal places based on size
  const decimals = unitIndex === 0 ? 0 : size >= 100 ? 1 : 2;
  const formattedSize = size.toFixed(decimals);

  return `${bytes < 0 ? '-' : ''}${formattedSize} ${units[unitIndex]}`;
}

/**
 * Format number with thousand separators
 * @param {number} value - Number to format
 * @returns {string} Formatted number (e.g., "1,234,567")
 */
export function formatNumber(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }

  return value.toLocaleString();
}

/**
 * Format percentage with appropriate decimal places
 * @param {number} value - Percentage value (0-100)
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage (e.g., "85.5%")
 */
export function formatPercentage(value, decimals = 1) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0.0%';
  }

  return `${value.toFixed(decimals)}%`;
}

/**
 * Truncate text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (default: 100)
 * @param {string} suffix - Suffix to add when truncated (default: '...')
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100, suffix = '...') {
  if (typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - suffix.length) + suffix;
}
