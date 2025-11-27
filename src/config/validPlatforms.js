/**
 * Valid Platforms Configuration
 * 
 * Centralized list of supported platforms to avoid duplication
 * Issue #1081: CodeRabbit - Centralize platform validation
 */

const VALID_PLATFORMS = [
  'twitter',
  'youtube',
  'instagram',
  'facebook',
  'discord',
  'twitch',
  'reddit',
  'tiktok',
  'bluesky'
];

/**
 * Check if a platform is valid
 * @param {string} platform - Platform name to validate
 * @returns {boolean} True if platform is valid
 */
function isValidPlatform(platform) {
  return VALID_PLATFORMS.includes(platform?.toLowerCase());
}

/**
 * Get all valid platforms
 * @returns {string[]} Array of valid platform names
 */
function getValidPlatforms() {
  return [...VALID_PLATFORMS];
}

module.exports = {
  VALID_PLATFORMS,
  isValidPlatform,
  getValidPlatforms
};

