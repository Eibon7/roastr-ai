/**
 * Sensitive data detection utilities
 * Used to identify potentially sensitive information before clipboard operations
 */

/**
 * Luhn algorithm implementation for credit card validation
 * @param {string} number - The number to validate
 * @returns {boolean} Whether the number passes Luhn checksum
 */
function luhnCheck(number) {
  const digits = number.replace(/\D/g, '').split('').map(Number);
  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Validate credit card number with proper checks
 * @param {string} candidate - Potential credit card number
 * @returns {boolean} Whether it's a valid credit card
 */
function isValidCreditCard(candidate) {
  const cleaned = candidate.replace(/[\s-]/g, '');

  // Check length (13-19 digits for most cards)
  if (!/^\d{13,19}$/.test(cleaned)) {
    return false;
  }

  // Check known IIN ranges (first few digits)
  const firstDigit = cleaned[0];
  const firstTwoDigits = cleaned.substring(0, 2);
  const firstFourDigits = cleaned.substring(0, 4);

  // Major card networks
  const isVisa = firstDigit === '4';
  const isMastercard = (firstTwoDigits >= '51' && firstTwoDigits <= '55') ||
                       (firstFourDigits >= '2221' && firstFourDigits <= '2720');
  const isAmex = firstTwoDigits === '34' || firstTwoDigits === '37';
  const isDiscover = firstFourDigits === '6011' || firstTwoDigits === '65' ||
                     (firstFourDigits >= '6221' && firstFourDigits <= '6229') ||
                     (firstFourDigits >= '6440' && firstFourDigits <= '6449') ||
                     (firstFourDigits >= '6500' && firstFourDigits <= '6599');
  const isDiners = firstTwoDigits === '30' || firstTwoDigits === '36' || firstTwoDigits === '38';
  const isJCB = (firstFourDigits >= '3528' && firstFourDigits <= '3589');

  const isKnownNetwork = isVisa || isMastercard || isAmex || isDiscover || isDiners || isJCB;

  // If it doesn't match known networks, it's likely not a credit card
  if (!isKnownNetwork) {
    return false;
  }

  // Validate with Luhn algorithm
  return luhnCheck(cleaned);
}

/**
 * Validate SSN with proper rules and context
 * @param {string} candidate - Potential SSN
 * @param {string} context - Surrounding text for context
 * @returns {boolean} Whether it's a valid SSN format
 */
function isValidSSN(candidate, context = '') {
  const cleaned = candidate.replace(/\D/g, '');

  // Must be exactly 9 digits
  if (cleaned.length !== 9) {
    return false;
  }

  // Check if it's in proper SSN format (XXX-XX-XXXX)
  const hasProperFormat = /^\d{3}-\d{2}-\d{4}$/.test(candidate);

  // If it's not in proper format, check for contextual clues
  if (!hasProperFormat) {
    const contextLower = context.toLowerCase();
    const ssnKeywords = ['ssn', 'social security', 'social', 'security number', 'tax id', 'taxpayer id'];
    const hasSSNContext = ssnKeywords.some(keyword => contextLower.includes(keyword));

    // Without proper format and context, don't flag as SSN
    if (!hasSSNContext) {
      return false;
    }
  }

  const area = cleaned.substring(0, 3);
  const group = cleaned.substring(3, 5);
  const serial = cleaned.substring(5, 9);

  // Invalid area numbers
  if (area === '000' || area === '666' || (area >= '900' && area <= '999')) {
    return false;
  }

  // Invalid group numbers
  if (group === '00') {
    return false;
  }

  // Invalid serial numbers
  if (serial === '0000') {
    return false;
  }

  return true;
}

/**
 * Validate bank account with contextual checks
 * @param {string} candidate - Potential bank account number
 * @param {string} context - Surrounding text for context
 * @returns {boolean} Whether it's likely a bank account
 */
function isValidBankAccount(candidate, context = '') {
  // Check if it's an IBAN format
  const ibanPattern = /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/;
  if (ibanPattern.test(candidate)) {
    return true; // IBAN is always considered a bank account
  }

  const cleaned = candidate.replace(/\D/g, '');

  // Basic length check (8-17 digits is too broad, narrow it down)
  if (cleaned.length < 8 || cleaned.length > 17) {
    return false;
  }

  // Check for contextual keywords nearby
  const contextLower = context.toLowerCase();
  const bankKeywords = [
    'account', 'acct', 'bank', 'routing', 'aba', 'swift',
    'cuenta', 'banco', 'iban', 'bic', 'sort code'
  ];

  const hasContext = bankKeywords.some(keyword =>
    contextLower.includes(keyword)
  );

  // Require context for bank account detection
  if (!hasContext) {
    return false;
  }

  // Additional checks for common false positives
  // Don't flag if it's likely a phone number, ID, or other common number
  if (cleaned.length === 10) {
    // Could be phone number
    return false;
  }

  // For 9-digit numbers, check if it's specifically routing-related
  if (cleaned.length === 9) {
    const routingKeywords = ['routing', 'aba', 'transit'];
    const hasRoutingContext = routingKeywords.some(keyword =>
      contextLower.includes(keyword)
    );
    if (!hasRoutingContext) {
      return false;
    }
  }

  if (cleaned.length === 16) {
    // Could be credit card
    return false;
  }

  return true;
}

/**
 * Patterns for detecting sensitive information
 */
const SENSITIVE_PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Phone numbers (various formats)
  phone: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,

  // Credit card numbers (safer initial pattern for candidates)
  creditCard: /\b\d{4}[\s-]*\d{4}[\s-]*\d{4}[\s-]*\d{1,4}(?:[\s-]*\d{1,4})?\b/g,

  // National ID patterns (stricter SSN format)
  nationalId: /\b\d{3}-\d{2}-\d{4}\b/g,

  // Passwords, tokens, keys
  credentials: /\b(password|token|key|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*\S+/gi,

  // URLs with potential sensitive info
  sensitiveUrls: /https?:\/\/[^\s]*(?:token|key|password|secret|auth)[^\s]*/gi,

  // Bank account numbers (contextual pattern - will be validated with context)
  bankAccount: /\b(?:\d{8,17}|[A-Z]{2}\d{2}[A-Z0-9]{4,30})\b/g,

  // IP addresses (might be sensitive in some contexts)
  ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g
};

/**
 * Keywords that might indicate sensitive persona data
 */
const SENSITIVE_KEYWORDS = [
  'dirección', 'address', 'domicilio',
  'teléfono', 'phone', 'celular', 'móvil',
  'email', 'correo', 'e-mail',
  'dni', 'cedula', 'pasaporte', 'passport',
  'tarjeta', 'card', 'cuenta', 'account',
  'banco', 'bank', 'routing',
  'contraseña', 'password', 'clave',
  'token', 'api', 'secret', 'key'
];

/**
 * Detect potentially sensitive information in text
 * @param {string} text - Text to analyze
 * @param {Object} options - Detection options
 * @param {boolean} options.checkPersonaFlag - Whether to check for persona sensitive flag
 * @param {boolean} options.strictMode - Whether to use strict detection
 * @returns {Object} Detection result
 */
export function detectSensitiveData(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return {
      isSensitive: false,
      detectedTypes: [],
      confidence: 0,
      suggestions: []
    };
  }

  const detectedTypes = [];
  const suggestions = [];
  let confidence = 0;

  // Check against patterns with validation
  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      let validMatches = [];

      // Apply additional validation for specific types
      switch (type) {
        case 'creditCard':
          validMatches = matches.filter(match => isValidCreditCard(match));
          break;
        case 'nationalId':
          validMatches = matches.filter(match => isValidSSN(match, text));
          break;
        case 'bankAccount':
          // For bank accounts, we already use contextual patterns, but double-check
          validMatches = matches.filter(match => {
            // Extract just the number part for validation
            const numberPart = match.replace(/\b(?:account|acct|bank|routing|iban|swift|bic)[\s:]*/gi, '');
            return isValidBankAccount(numberPart, text);
          });
          break;
        default:
          validMatches = matches;
      }

      if (validMatches.length > 0) {
        detectedTypes.push(type);
        confidence += 0.8; // High confidence for validated pattern matches

        switch (type) {
          case 'email':
            suggestions.push('Se detectaron direcciones de email');
            break;
          case 'phone':
            suggestions.push('Se detectaron números de teléfono');
            break;
          case 'creditCard':
            suggestions.push('Se detectaron números de tarjeta válidos');
            break;
          case 'nationalId':
            suggestions.push('Se detectaron números de identificación válidos');
            break;
          case 'bankAccount':
            suggestions.push('Se detectaron números de cuenta bancaria');
            break;
          case 'credentials':
            suggestions.push('Se detectaron credenciales o tokens');
            break;
          default:
            suggestions.push(`Se detectó información potencialmente sensible: ${type}`);
        }
      }
    }
  }

  // Check for sensitive keywords
  const lowerText = text.toLowerCase();
  const foundKeywords = SENSITIVE_KEYWORDS.filter(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );

  if (foundKeywords.length > 0) {
    detectedTypes.push('keywords');
    confidence += foundKeywords.length * 0.2; // Lower confidence for keywords
    suggestions.push('Se detectaron palabras clave que podrían indicar información sensible');
  }

  // Check persona flag if provided
  if (options.checkPersonaFlag && options.isPersonaSensitive) {
    detectedTypes.push('persona');
    confidence += 0.5;
    suggestions.push('Este contenido está marcado como información personal sensible');
  }

  // Normalize confidence to 0-1 range
  confidence = Math.min(confidence, 1);

  const isSensitive = confidence > 0.3 || (!!options.strictMode && confidence > 0.1);

  return {
    isSensitive,
    detectedTypes,
    confidence,
    suggestions,
    foundKeywords: foundKeywords.slice(0, 3) // Limit to first 3 keywords
  };
}

/**
 * Generate a user-friendly warning message based on detection results
 * @param {Object} detection - Result from detectSensitiveData
 * @returns {string} Warning message
 */
export function generateWarningMessage(detection) {
  if (!detection.isSensitive) {
    return '';
  }

  const messages = [
    '⚠️ Se ha detectado información potencialmente sensible en el texto copiado.'
  ];

  if (detection.suggestions.length > 0) {
    messages.push(...detection.suggestions.slice(0, 2)); // Limit to 2 suggestions
  }

  messages.push('Asegúrate de no compartir esta información en lugares públicos.');

  return messages.join(' ');
}

/**
 * Check if clipboard clearing is supported
 * @returns {boolean} Whether clipboard clearing is supported
 */
export function isClipboardClearingSupported() {
  return !!(navigator.clipboard && navigator.clipboard.writeText);
}

/**
 * Clear clipboard content (if supported)
 * @returns {Promise<boolean>} Whether clearing was successful
 */
export async function clearClipboard() {
  if (!isClipboardClearingSupported()) {
    return false;
  }

  try {
    await navigator.clipboard.writeText('');
    return true;
  } catch (error) {
    console.warn('Failed to clear clipboard:', error);
    return false;
  }
}
