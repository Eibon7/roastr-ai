/**
 * Validation Constants for Roast Engine
 * Centralized validation rules for better maintainability
 * Enhanced with BCP-47 locale support and immutability (CodeRabbit Round 4)
 */

// BCP-47 locale mapping for international language codes
const BCP47_LOCALE_MAP = Object.freeze({
    'en-us': 'en',
    'en-gb': 'en',
    'en-ca': 'en',
    'en-au': 'en',
    'es-mx': 'es',
    'es-es': 'es',
    'es-ar': 'es',
    'es-co': 'es',
    'es-pe': 'es',
    'es-419': 'es' // Latin America Spanish
});

// Platform alias mapping for brand consistency
const PLATFORM_ALIAS_MAP = Object.freeze({
    'x': 'twitter',
    'x.com': 'twitter',
    'twitter.com': 'twitter'
});

const VALIDATION_CONSTANTS = Object.freeze({
    // Text limits
    MAX_COMMENT_LENGTH: 2000,
    MIN_COMMENT_LENGTH: 1,
    
    // Roast styles by language
    VALID_STYLES: Object.freeze({
        es: Object.freeze(['flanders', 'balanceado', 'canalla']),
        en: Object.freeze(['light', 'balanced', 'savage'])
    }),
    
    // Supported languages
    VALID_LANGUAGES: Object.freeze(['es', 'en']),
    
    // Supported platforms
    VALID_PLATFORMS: Object.freeze([
        'twitter', 
        'facebook', 
        'instagram', 
        'youtube', 
        'tiktok', 
        'reddit', 
        'discord', 
        'twitch', 
        'bluesky'
    ]),
    
    // Legacy roast validation (for backward compatibility)
    VALID_TONES: Object.freeze(['sarcastic', 'witty', 'clever', 'playful', 'savage']),
    VALID_HUMOR_TYPES: Object.freeze(['witty', 'clever', 'sarcastic', 'playful', 'observational']),
    
    // Intensity range
    MIN_INTENSITY: 1,
    MAX_INTENSITY: 5,
    
    // Default values
    DEFAULTS: Object.freeze({
        STYLE: 'balanceado',
        LANGUAGE: 'es',
        PLATFORM: 'twitter',
        TONE: 'sarcastic',
        INTENSITY: 3,
        HUMOR_TYPE: 'witty'
    })
});

/**
 * Normalize input style to lowercase for validation
 */
function normalizeStyle(style) {
    if (!style) return null;
    if (typeof style !== 'string') return String(style).toLowerCase().trim();
    const normalized = style.toLowerCase().trim();
    return normalized || null;
}

/**
 * Normalize input language with BCP-47 locale support
 * Converts locale codes like 'en-US' to base language 'en'
 */
function normalizeLanguage(language) {
    if (!language) return VALIDATION_CONSTANTS.DEFAULTS.LANGUAGE;
    if (typeof language !== 'string') language = String(language);
    
    const normalized = language.toLowerCase().trim();
    
    // Handle BCP-47 locale codes via mapping table
    if (BCP47_LOCALE_MAP[normalized]) {
        return BCP47_LOCALE_MAP[normalized];
    }
    
    // Extract base language from complex locale codes (e.g., 'en-US-POSIX' → 'en')
    const baseLang = normalized.split('-')[0];
    return baseLang;
}

/**
 * Normalize input platform with alias support
 * Handles platform rebranding (e.g., 'X' → 'twitter')
 */
function normalizePlatform(platform) {
    if (!platform) return VALIDATION_CONSTANTS.DEFAULTS.PLATFORM;
    if (typeof platform !== 'string') platform = String(platform);
    
    const normalized = platform.toLowerCase().trim();
    
    // Handle platform aliases
    return PLATFORM_ALIAS_MAP[normalized] || normalized;
}

/**
 * Validate style for given language
 */
function isValidStyle(style, language = 'es') {
    const normalizedStyle = normalizeStyle(style);
    const normalizedLanguage = normalizeLanguage(language);
    
    const validStyles = VALIDATION_CONSTANTS.VALID_STYLES[normalizedLanguage];
    return validStyles && validStyles.includes(normalizedStyle);
}

/**
 * Validate language
 */
function isValidLanguage(language) {
    const normalizedLanguage = normalizeLanguage(language);
    return VALIDATION_CONSTANTS.VALID_LANGUAGES.includes(normalizedLanguage);
}

/**
 * Validate platform
 */
function isValidPlatform(platform) {
    const normalizedPlatform = normalizePlatform(platform);
    return VALIDATION_CONSTANTS.VALID_PLATFORMS.includes(normalizedPlatform);
}

/**
 * Get valid styles for a language
 */
function getValidStylesForLanguage(language = 'es') {
    const normalizedLanguage = normalizeLanguage(language);
    return VALIDATION_CONSTANTS.VALID_STYLES[normalizedLanguage] || VALIDATION_CONSTANTS.VALID_STYLES.es;
}

module.exports = {
    VALIDATION_CONSTANTS,
    normalizeStyle,
    normalizeLanguage,
    normalizePlatform,
    isValidStyle,
    isValidLanguage,
    isValidPlatform,
    getValidStylesForLanguage
};