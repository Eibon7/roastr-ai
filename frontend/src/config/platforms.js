/**
 * Platform configuration for frontend
 * Centralized platform definitions with icons and names
 */

// Platform icon mappings
export const platformIcons = {
  twitter: '𝕏',
  instagram: '📷',
  facebook: '👥',
  youtube: '📺',
  tiktok: '🎵',
  linkedin: '💼',
  bluesky: '🦋',
  discord: '💬',
  twitch: '🎮',
  reddit: '🤖'
};

// Platform display names
export const platformNames = {
  twitter: 'X (Twitter)',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  bluesky: 'Bluesky',
  discord: 'Discord',
  twitch: 'Twitch',
  reddit: 'Reddit'
};

// All supported platforms
export const allPlatforms = [
  'twitter',
  'instagram',
  'facebook',
  'youtube',
  'tiktok',
  'linkedin',
  'bluesky',
  'discord',
  'twitch',
  'reddit'
];

/**
 * Get platform icon
 * @param {string} platform - Platform key
 * @returns {string} Platform icon
 */
export function getPlatformIcon(platform) {
  return platformIcons[platform] || '🔗';
}

/**
 * Get platform display name
 * @param {string} platform - Platform key  
 * @returns {string} Platform display name
 */
export function getPlatformName(platform) {
  return platformNames[platform] || platform;
}

/**
 * Check if platform is supported
 * @param {string} platform - Platform key
 * @returns {boolean} True if supported
 */
export function isSupportedPlatform(platform) {
  return allPlatforms.includes(platform);
}