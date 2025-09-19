/**
 * Validation Constants for Roast Engine
 * Centralized validation rules for better maintainability
 */

const VALIDATION_CONSTANTS = {
    // Text limits
    MAX_COMMENT_LENGTH: 2000,
    MIN_COMMENT_LENGTH: 1,
    
    // Roast styles by language
    VALID_STYLES: {
        es: ['flanders', 'balanceado', 'canalla'],
        en: ['light', 'balanced', 'savage']
    },
    
    // Supported languages
    VALID_LANGUAGES: ['es', 'en'],
    
    // Supported platforms
    VALID_PLATFORMS: [
        'twitter', 
        'facebook', 
        'instagram', 
        'youtube', 
        'tiktok', 
        'reddit', 
        'discord', 
        'twitch', 
        'bluesky'
    ],
    
    // Legacy roast validation (for backward compatibility)
    VALID_TONES: ['sarcastic', 'witty', 'clever', 'playful', 'savage'],
    VALID_HUMOR_TYPES: ['witty', 'clever', 'sarcastic', 'playful', 'observational'],
    
    // Intensity range
    MIN_INTENSITY: 1,
    MAX_INTENSITY: 5,
    
    // Default values
    DEFAULTS: {
        STYLE: 'balanceado',
        LANGUAGE: 'es',
        PLATFORM: 'twitter',
        TONE: 'sarcastic',
        INTENSITY: 3,
        HUMOR_TYPE: 'witty'
    }
};

/**
 * Normalize input style to lowercase for validation
 */
function normalizeStyle(style) {
    return style ? style.toLowerCase().trim() : null;
}

/**
 * Normalize input language to lowercase for validation
 */
function normalizeLanguage(language) {
    return language ? language.toLowerCase().trim() : VALIDATION_CONSTANTS.DEFAULTS.LANGUAGE;
}

/**
 * Normalize input platform to lowercase for validation
 */
function normalizePlatform(platform) {
    return platform ? platform.toLowerCase().trim() : VALIDATION_CONSTANTS.DEFAULTS.PLATFORM;
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