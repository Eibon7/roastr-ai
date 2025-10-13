/**
 * Text Normalization Utilities
 *
 * Provides functions for normalizing text input including:
 * - Unicode normalization (NFD, NFC, NFKD, NFKC)
 * - URL sanitization and validation
 * - Quote normalization (smart quotes to straight quotes)
 * - Whitespace normalization
 *
 * @module utils/textNormalizer
 */

/**
 * Normalize Unicode characters
 * @param {string} text - Text to normalize
 * @param {string} form - Normalization form: 'NFC', 'NFD', 'NFKC', 'NFKD'
 * @returns {string} Normalized text
 */
function normalizeUnicode(text, form = 'NFC') {
  if (typeof text !== 'string') {
    return text;
  }

  const validForms = ['NFC', 'NFD', 'NFKC', 'NFKD'];
  if (!validForms.includes(form)) {
    throw new Error(`Invalid normalization form: ${form}. Must be one of: ${validForms.join(', ')}`);
  }

  return text.normalize(form);
}

/**
 * Sanitize and validate URL
 * @param {string} url - URL to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string|null} Sanitized URL or null if invalid
 */
function sanitizeUrl(url, options = {}) {
  const {
    allowedProtocols = ['http:', 'https:'],
    removeQueryParams = false,
    removeFragment = false
  } = options;

  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  if (trimmed === '') {
    return null;
  }

  // Detect and reject XSS attempts
  const xssPatterns = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /file:/i,
    /about:/i
  ];

  if (xssPatterns.some(pattern => pattern.test(trimmed))) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    // Validate protocol
    if (!allowedProtocols.includes(parsed.protocol)) {
      return null;
    }

    // Remove query params if requested
    if (removeQueryParams) {
      parsed.search = '';
    }

    // Remove fragment if requested
    if (removeFragment) {
      parsed.hash = '';
    }

    return parsed.toString();
  } catch (error) {
    // Invalid URL
    return null;
  }
}

/**
 * Normalize quotes to straight quotes
 * @param {string} text - Text with quotes
 * @param {Object} options - Normalization options
 * @returns {string} Text with normalized quotes
 */
function normalizeQuotes(text, options = {}) {
  if (typeof text !== 'string') {
    return text;
  }

  const { style = 'straight' } = options;

  if (style === 'straight') {
    // Convert all smart quotes to straight quotes
    return text
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")  // Single quotes
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"'); // Double quotes
  } else if (style === 'smart') {
    // Convert straight quotes to smart quotes (basic heuristic)
    let result = text;

    // Replace straight double quotes with smart quotes
    result = result.replace(/"([^"]*)"/g, '\u201C$1\u201D');

    // Replace straight single quotes with smart quotes
    result = result.replace(/'([^']*)'/g, '\u2018$1\u2019');

    return result;
  }

  return text;
}

/**
 * Normalize whitespace
 * @param {string} text - Text with whitespace
 * @param {Object} options - Normalization options
 * @returns {string} Text with normalized whitespace
 */
function normalizeSpaces(text, options = {}) {
  if (typeof text !== 'string') {
    return text;
  }

  const {
    trim = true,
    collapseMultiple = true,
    normalizeLineBreaks = false,
    removeNonBreaking = false
  } = options;

  let result = text;

  // Replace non-breaking spaces with regular spaces
  if (removeNonBreaking) {
    result = result.replace(/\u00A0/g, ' ');
    result = result.replace(/\u202F/g, ' '); // Narrow no-break space
    result = result.replace(/\u2007/g, ' '); // Figure space
  }

  // Normalize line breaks (CRLF, CR → LF)
  if (normalizeLineBreaks) {
    result = result.replace(/\r\n/g, '\n');  // CRLF → LF
    result = result.replace(/\r/g, '\n');     // CR → LF
  }

  // Trim leading/trailing whitespace (do this first)
  if (trim) {
    result = result.trim();
  }

  // Collapse multiple spaces into one
  if (collapseMultiple) {
    result = result.replace(/[ \t]+/g, ' ');
  }

  return result;
}

/**
 * Comprehensive text normalization
 * @param {string} text - Text to normalize
 * @param {Object} options - Normalization options
 * @returns {string} Fully normalized text
 */
function normalizeText(text, options = {}) {
  if (typeof text !== 'string') {
    return text;
  }

  const {
    unicode = true,
    unicodeForm = 'NFC',
    quotes = true,
    quotesStyle = 'straight',
    spaces = true,
    trimSpaces = true,
    collapseSpaces = true,
    normalizeLineBreaks = false,
    removeNonBreakingSpaces = false
  } = options;

  let result = text;

  // Apply unicode normalization
  if (unicode) {
    result = normalizeUnicode(result, unicodeForm);
  }

  // Apply quote normalization
  if (quotes) {
    result = normalizeQuotes(result, { style: quotesStyle });
  }

  // Apply space normalization
  if (spaces) {
    result = normalizeSpaces(result, {
      trim: trimSpaces,
      collapseMultiple: collapseSpaces,
      normalizeLineBreaks,
      removeNonBreaking: removeNonBreakingSpaces
    });
  }

  return result;
}

module.exports = {
  normalizeUnicode,
  sanitizeUrl,
  normalizeQuotes,
  normalizeSpaces,
  normalizeText
};
