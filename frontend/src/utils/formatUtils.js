/**
 * Utility functions for formatting data
 */

/**
 * Format a number as currency (from cents)
 * @param {number} amountCents - The amount in cents to format
 * @param {string} currency - The currency code (default: 'USD')
 * @param {string} locale - The locale for formatting (default: 'en-US')
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amountCents, currency = 'USD', locale = 'en-US') {
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
 * Format a number with commas as thousands separators
 * @param {number} num - The number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0';
  }

  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - The number of bytes
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted bytes string
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format a percentage
 * @param {number} value - The value to format as percentage
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(value, decimals = 1) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }

  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a date to a readable string
 * @param {Date|string} date - The date to format
 * @param {string} locale - The locale to use (default: 'en-US')
 * @returns {string} Formatted date string
 */
export function formatDate(date, locale = 'en-US') {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj);
}

/**
 * Format a date and time to a readable string
 * @param {Date|string} date - The date to format
 * @param {string} locale - The locale to use (default: 'en-US')
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date, locale = 'en-US') {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}

/**
 * Format a relative time (e.g., "2 hours ago")
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted relative time string
 */
export function formatRelativeTime(date) {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now - dateObj) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'} ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears === 1 ? '' : 's'} ago`;
}

/**
 * Truncate text to a specified length
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length (default: 100)
 * @param {string} suffix - Suffix to add when truncated (default: '...')
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100, suffix = '...') {
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - suffix.length) + suffix;
}
