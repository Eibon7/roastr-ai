/**
 * Sensitive data detection utilities
 * Used to identify potentially sensitive information before clipboard operations
 */

/**
 * Patterns for detecting sensitive information
 */
const SENSITIVE_PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Phone numbers (various formats)
  phone: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  
  // Credit card numbers (basic pattern)
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  
  // National ID patterns (basic - can be expanded for specific countries)
  nationalId: /\b\d{3}-?\d{2}-?\d{4}\b/g, // SSN format
  
  // Passwords, tokens, keys
  credentials: /\b(password|token|key|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*\S+/gi,
  
  // URLs with potential sensitive info
  sensitiveUrls: /https?:\/\/[^\s]*(?:token|key|password|secret|auth)[^\s]*/gi,
  
  // Bank account numbers (basic pattern)
  bankAccount: /\b\d{8,17}\b/g,
  
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

  // Check against patterns
  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      detectedTypes.push(type);
      confidence += 0.8; // High confidence for pattern matches
      
      switch (type) {
        case 'email':
          suggestions.push('Se detectaron direcciones de email');
          break;
        case 'phone':
          suggestions.push('Se detectaron números de teléfono');
          break;
        case 'creditCard':
          suggestions.push('Se detectaron posibles números de tarjeta');
          break;
        case 'nationalId':
          suggestions.push('Se detectaron posibles números de identificación');
          break;
        case 'credentials':
          suggestions.push('Se detectaron credenciales o tokens');
          break;
        default:
          suggestions.push(`Se detectó información potencialmente sensible: ${type}`);
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

  const isSensitive = confidence > 0.3 || (options.strictMode && confidence > 0.1);

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
