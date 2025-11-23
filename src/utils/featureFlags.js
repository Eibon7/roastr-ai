/**
 * Feature Flags Utility
 * Centralized helper functions for feature flag checks
 * Issue #618 - Jest compatibility with defensive flag checking
 */

const { logger } = require('./logger');
const { flags } = require('../config/flags');

/**
 * Safely check if a feature flag is enabled
 * Defensive implementation to handle Jest test environment where flags may not be fully initialized
 *
 * @param {string} flagName - Name of the feature flag to check
 * @returns {boolean} True if flag is enabled, false otherwise (including errors)
 *
 * @example
 * const { isFlagEnabled } = require('./utils/featureFlags');
 *
 * if (isFlagEnabled('ENABLE_REAL_OPENAI')) {
 *     // Use real OpenAI API
 * } else {
 *     // Use mock generator
 * }
 */
function isFlagEnabled(flagName) {
  try {
    // Defensive checks for Jest test environment
    // flags object may not be properly initialized in tests
    if (!flags || typeof flags.isEnabled !== 'function') {
      return false;
    }

    return flags.isEnabled(flagName);
  } catch (error) {
    // Log warning but don't throw - fail safe to false
    logger.warn(`⚠️ Error checking flag ${flagName}:`, error.message);
    return false;
  }
}

module.exports = {
  isFlagEnabled
};
