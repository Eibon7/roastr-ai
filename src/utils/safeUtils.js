/**
 * Safe utility functions for secure operations
 */

/**
 * Safely parse JSON with fallback
 * @param {string} jsonString - JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} Parsed object or fallback
 */
function safeJsonParse(jsonString, fallback = null) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return fallback;
    }
}

/**
 * Safely stringify object with fallback
 * @param {*} obj - Object to stringify
 * @param {string} fallback - Fallback string if stringify fails
 * @returns {string} JSON string or fallback
 */
function safeJsonStringify(obj, fallback = '{}') {
    try {
        return JSON.stringify(obj);
    } catch (error) {
        return fallback;
    }
}

/**
 * Safely access nested object properties
 * @param {object} obj - Object to access
 * @param {string|Array} path - Dot notation path (e.g., 'user.profile.name') or array of keys
 * @param {*} fallback - Fallback value if path doesn't exist
 * @returns {*} Value at path or fallback
 */
function safeGet(obj, path, fallback = undefined) {
    if (!obj || typeof obj !== 'object') {
        return fallback;
    }

    // Validate and normalize path
    let keys;
    if (typeof path === 'string') {
        if (path === '') {
            return fallback;
        }
        keys = path.split('.');
    } else if (Array.isArray(path)) {
        keys = path;
    } else {
        // Path is neither string nor array
        return fallback;
    }

    let current = obj;

    for (const key of keys) {
        // Disallow traversing special prototype properties
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            return fallback;
        }
        // Check if current is an object and has the key as own property
        if (current === null || current === undefined ||
            typeof current !== 'object' ||
            !Object.prototype.hasOwnProperty.call(current, key)) {
            return fallback;
        }
        current = current[key];
    }

    return current;
}

/**
 * Safely convert value to string
 * @param {*} value - Value to convert
 * @param {string} fallback - Fallback string
 * @returns {string} String representation or fallback
 */
function safeString(value, fallback = '') {
    if (value === null || value === undefined) {
        return fallback;
    }
    
    try {
        return String(value);
    } catch (error) {
        return fallback;
    }
}

/**
 * Safely convert value to number
 * @param {*} value - Value to convert
 * @param {number} fallback - Fallback number
 * @returns {number} Number or fallback
 */
function safeNumber(value, fallback = 0) {
    if (value === null || value === undefined) {
        return fallback;
    }
    
    const num = Number(value);
    return isNaN(num) ? fallback : num;
}

/**
 * Safely convert value to boolean
 * @param {*} value - Value to convert
 * @param {boolean} fallback - Fallback boolean
 * @returns {boolean} Boolean or fallback
 */
function safeBoolean(value, fallback = false) {
    if (value === null || value === undefined) {
        return fallback;
    }
    
    if (typeof value === 'boolean') {
        return value;
    }
    
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') {
            return true;
        }
        if (lower === 'false' || lower === '0' || lower === 'no') {
            return false;
        }
    }
    
    if (typeof value === 'number') {
        return value !== 0;
    }
    
    return fallback;
}

module.exports = {
    safeJsonParse,
    safeJsonStringify,
    safeGet,
    safeString,
    safeNumber,
    safeBoolean
};
