/**
 * Shop-specific formatting utilities for ShopSettings component
 */

/**
 * Format addon name with fallback logic
 * @param {Object} purchase - Purchase object
 * @param {Object} shopData - Shop data for addon lookup
 * @returns {string} Formatted addon name
 */
export function formatAddonName(purchase, shopData) {
  // First priority: use purchase.addon_name if available
  if (purchase.addon_name) {
    return purchase.addon_name;
  }

  // Second priority: lookup from shop data
  if (shopData.addons) {
    for (const category of Object.values(shopData.addons)) {
      const addon = category.find(a => a.key === purchase.addon_key);
      if (addon) return addon.name;
    }
  }

  // Third priority: hardcoded mapping for common addons
  const addonNameMap = {
    'roasts_100': 'Roasts Pack 100',
    'roasts_500': 'Roasts Pack 500',
    'roasts_1000': 'Roasts Pack 1000',
    'analysis_10k': 'Análisis Pack 10K',
    'analysis_50k': 'Análisis Pack 50K',
    'analysis_100k': 'Análisis Pack 100K',
    'rqc_monthly': 'RQC (Roastr Quality Check)'
  };

  if (addonNameMap[purchase.addon_key]) {
    return addonNameMap[purchase.addon_key];
  }

  // Final fallback: convert addon_key to title case
  return purchase.addon_key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format currency amount with locale support
 * @param {number} amountCents - Amount in cents
 * @param {string} currency - Currency code (default: 'USD')
 * @param {string} locale - Locale for formatting (defaults to navigator.language or 'es-ES')
 * @returns {string} Formatted currency
 */
export function formatCurrency(amountCents, currency = 'USD', locale = null) {
  const currencyLocale = locale || navigator.language || 'es-ES';
  
  return new Intl.NumberFormat(currencyLocale, {
    style: 'currency',
    currency: (currency || 'USD').toUpperCase()
  }).format(amountCents / 100);
}

/**
 * Format date for display
 * @param {string} dateString - Date string to format
 * @param {string} locale - Locale for formatting (defaults to navigator.language or 'es-ES')
 * @returns {string} Formatted date
 */
export function formatDate(dateString, locale = null) {
  const dateLocale = locale || navigator.language || 'es-ES';
  
  return new Date(dateString).toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format status string
 * @param {string} status - Status string to format
 * @returns {string} Formatted status
 */
export function formatStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}
