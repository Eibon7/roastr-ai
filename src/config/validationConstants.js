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
    
    // Issue #868: Removed legacy VALID_TONES and VALID_HUMOR_TYPES
    // Use VALID_STYLES (flanders, balanceado, canalla) as único selector
    
    // Default values (Issue #868: Removed INTENSITY and HUMOR_TYPE)
    DEFAULTS: Object.freeze({
        STYLE: 'balanceado',
        LANGUAGE: 'es',
        PLATFORM: 'twitter'
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

/**
 * Normalize humor type to lowercase for validation
 * Issue #717 - Humor type validation
 * @param {string} humorType - Input humor type (any case, may have whitespace)
 * @returns {string|null} - Normalized humor type or null if invalid
 */
function normalizeHumorType(humorType) {
    if (!humorType || typeof humorType !== 'string') {
        return null;
    }

    const normalized = humorType.trim().toLowerCase();

    if (!normalized) {
        return null;
    }

    // Check if normalized value is in valid humor types
    return VALIDATION_CONSTANTS.VALID_HUMOR_TYPES.includes(normalized) ? normalized : null;
}

/**
 * Validate if a humor type is valid
 * Issue #717 - Humor type validation
 * @param {string} humorType - Humor type to validate
 * @returns {boolean}
 */
function isValidHumorType(humorType) {
    return normalizeHumorType(humorType) !== null;
}

/**
 * Get array of valid humor types
 * Issue #717 - Humor type validation
 * @returns {Array<string>} - Frozen array of valid humor types
 */
function getValidHumorTypes() {
    return VALIDATION_CONSTANTS.VALID_HUMOR_TYPES;
}

/**
 * Normalize intensity level to integer within valid range
 * Issue #717 - Intensity level validation
 * @param {number|string} intensity - Input intensity (1-5)
 * @returns {number|null} - Normalized intensity or null if invalid
 */
function normalizeIntensity(intensity) {
    if (intensity === null || intensity === undefined) {
        return null;
    }

    // Convert string to number
    let normalized;
    if (typeof intensity === 'string') {
        const trimmed = intensity.trim();
        if (!trimmed) {
            return null;
        }
        normalized = Number(trimmed);
    } else if (typeof intensity === 'number') {
        normalized = intensity;
    } else {
        return null;
    }

    // Check if valid number (not NaN, not Infinity)
    if (!Number.isFinite(normalized)) {
        return null;
    }

    // Check if integer (no decimals)
    if (!Number.isInteger(normalized)) {
        return null;
    }

    // Check if within valid range
    if (normalized < VALIDATION_CONSTANTS.MIN_INTENSITY || normalized > VALIDATION_CONSTANTS.MAX_INTENSITY) {
        return null;
    }

    return normalized;
}

/**
 * Validate if an intensity level is valid
 * Issue #717 - Intensity level validation
 * @param {number|string} intensity - Intensity to validate
 * @returns {boolean}
 */
function isValidIntensity(intensity) {
    return normalizeIntensity(intensity) !== null;
}

/**
 * Get description for intensity level
 * Issue #717 - Intensity level validation
 * Maps intensity to descriptive text for roast generation
 * @param {number|string} intensity - Intensity level (1-5)
 * @returns {string} - Description text or empty string
 */
function getIntensityDescription(intensity) {
    const normalized = normalizeIntensity(intensity);

    if (normalized === null) {
        return '';
    }

    // Low intensity (1-2): gentle
    if (normalized <= 2) {
        return 'suave y amigable';
    }

    // High intensity (4-5): aggressive
    if (normalized >= 4) {
        return 'directo y sin filtros';
    }

    // Medium intensity (3): no modifier
    return '';
}

/**
 * Get intensity range as frozen object
 * Issue #717 - Intensity level validation
 * @returns {Object} - Frozen object with min and max intensity
 */
function getIntensityRange() {
    return Object.freeze({
        min: VALIDATION_CONSTANTS.MIN_INTENSITY,
        max: VALIDATION_CONSTANTS.MAX_INTENSITY
    });
}

module.exports = {
    VALIDATION_CONSTANTS,
    normalizeStyle,
    normalizeLanguage,
    normalizePlatform,
    isValidStyle,
    isValidLanguage,
    isValidPlatform,
    getValidStylesForLanguage,
    normalizeHumorType,
    isValidHumorType,
    getValidHumorTypes,
    normalizeIntensity,
    isValidIntensity,
    getIntensityDescription,
    getIntensityRange
};