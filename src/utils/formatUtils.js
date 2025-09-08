/**
 * Common formatting utilities
 */

/**
 * Format file size in human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size with units (B, KB, MB, GB, TB)
 */
function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes)) {
    return '0B';
  }
  
  if (bytes === 0) {
    return '0B';
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
  
  return `${bytes < 0 ? '-' : ''}${formattedSize}${units[unitIndex]}`;
}

/**
 * Format duration in milliseconds to human readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "2h 30m 15s", "45s", "1.2s")
 */
function formatDuration(ms) {
  if (typeof ms !== 'number' || isNaN(ms) || ms < 0) {
    return '0ms';
  }
  
  const units = [
    { name: 'd', value: 24 * 60 * 60 * 1000 },
    { name: 'h', value: 60 * 60 * 1000 },
    { name: 'm', value: 60 * 1000 },
    { name: 's', value: 1000 },
    { name: 'ms', value: 1 }
  ];
  
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  
  const parts = [];
  let remaining = ms;
  
  for (const unit of units) {
    if (remaining >= unit.value) {
      const count = Math.floor(remaining / unit.value);
      parts.push(`${count}${unit.name}`);
      remaining = remaining % unit.value;
      
      // Stop after 2 significant units for readability
      if (parts.length >= 2) {
        break;
      }
    }
  }
  
  return parts.join(' ') || '0ms';
}

/**
 * Format percentage with appropriate decimal places
 * @param {number} value - Percentage value (0-100)
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage (e.g., "85.5%")
 */
function formatPercentage(value, decimals = 1) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0.0%';
  }
  
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format number with thousand separators
 * @param {number} value - Number to format
 * @returns {string} Formatted number (e.g., "1,234,567")
 */
function formatNumber(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }
  
  return value.toLocaleString();
}

/**
 * Format currency amount with proper internationalization
 * @param {number} amountCents - Amount in cents
 * @param {string} currency - Currency code (default: 'USD')
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted currency (e.g., "$12.34", "€10.50")
 */
function formatCurrency(amountCents, currency = 'USD', locale = 'en-US') {
  if (typeof amountCents !== 'number' || isNaN(amountCents)) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase()
    }).format(0);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: (currency || 'USD').toUpperCase()
  }).format(amountCents / 100);
}

/**
 * Truncate text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (default: 100)
 * @param {string} suffix - Suffix to add when truncated (default: '...')
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 100, suffix = '...') {
  if (typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - suffix.length) + suffix;
}

module.exports = {
  formatFileSize,
  formatDuration,
  formatPercentage,
  formatNumber,
  formatCurrency,
  truncateText
};