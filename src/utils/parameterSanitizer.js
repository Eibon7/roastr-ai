/**
 * Parameter Sanitization Utility
 *
 * Provides functions to sanitize sensitive parameters before logging
 * to prevent exposure of tokens, organization IDs, and other sensitive data.
 */

const SENSITIVE_FIELD_PATTERNS = [
  /token/i,
  /accesstoken/i,
  /organizationid/i,
  /secret/i,
  /key/i,
  /password/i,
  /auth/i,
  /bearer/i,
  /credential/i
];

const DEFAULT_OPTIONS = {
  prefixLength: 3,
  maskChar: '*',
  maskLength: 3
};

/**
 * Check if a field name matches sensitive patterns
 * @param {string} fieldName - The field name to check
 * @returns {boolean} True if field is considered sensitive
 */
function isSensitiveField(fieldName) {
  if (typeof fieldName !== 'string') return false;

  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(fieldName));
}

/**
 * Mask a sensitive value by showing only prefix + mask characters
 * @param {*} value - The value to mask
 * @param {Object} options - Masking options
 * @returns {*} The masked value or original if not maskable
 */
function maskSensitiveValue(value, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'string') {
    return opts.maskChar.repeat(opts.maskLength);
  }

  if (value.length <= opts.prefixLength) {
    return value;
  }

  const prefix = value.substring(0, opts.prefixLength);
  const mask = opts.maskChar.repeat(opts.maskLength);

  return prefix + mask;
}

/**
 * Recursively sanitize an object by masking sensitive fields
 * @param {*} obj - The object to sanitize
 * @param {Object} options - Sanitization options
 * @param {Set} visited - Set to track circular references
 * @returns {*} The sanitized object
 */
function sanitizeParameters(obj, options = {}, visited = new Set()) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Handle null, undefined, and primitives
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  // Handle circular references
  if (visited.has(obj)) {
    return '[Circular]';
  }
  visited.add(obj);

  try {
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) => sanitizeParameters(item, opts, visited));
    }

    // Handle functions
    if (typeof obj === 'function') {
      return obj;
    }

    // Handle regular objects
    const sanitized = {};

    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveField(key)) {
        sanitized[key] = maskSensitiveValue(value, opts);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeParameters(value, opts, visited);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  } finally {
    visited.delete(obj);
  }
}

/**
 * Sanitize parameters for logging purposes
 * This is a convenience function with logging-optimized defaults
 * @param {*} obj - The object to sanitize
 * @param {Object} options - Optional overrides for sanitization
 * @returns {*} The sanitized object
 */
function sanitizeForLogging(obj, options = {}) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  return sanitizeParameters(obj, options);
}

module.exports = {
  sanitizeParameters,
  sanitizeForLogging,
  maskSensitiveValue,
  isSensitiveField,
  SENSITIVE_FIELD_PATTERNS
};
