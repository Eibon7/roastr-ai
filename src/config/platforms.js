/**
 * Platform-specific configuration for roast generation
 *
 * Centralizes platform constraints, style guides, and formatting rules
 * to improve maintainability and enable dynamic platform support.
 *
 * Issue #128: Extract hardcoded platform rules to dedicated config
 */

const { PLATFORM_LIMITS } = require('./constants');

const PLATFORMS = {
  twitter: {
    name: 'Twitter',
    maxLength: PLATFORM_LIMITS.twitter.maxLength,
    supports: {
      hashtags: true,
      mentions: true,
      emojis: true,
      threading: true
    },
    style: {
      tone: 'concise and punchy',
      preferredLength: 240, // Leave room for RTs
      emojiUsage: 'moderate',
      hashtagLimit: 2
    },
    formatting: {
      lineBreaks: false,
      bulletPoints: false,
      emphasis: 'CAPS for emphasis'
    }
  },

  instagram: {
    name: 'Instagram',
    maxLength: PLATFORM_LIMITS.instagram.maxLength,
    supports: {
      hashtags: true,
      mentions: true,
      emojis: true,
      multiline: true
    },
    style: {
      tone: 'visual and engaging',
      preferredLength: 150,
      emojiUsage: 'heavy',
      hashtagLimit: 30
    },
    formatting: {
      lineBreaks: true,
      bulletPoints: true,
      emphasis: 'emojis and spacing'
    }
  },

  facebook: {
    name: 'Facebook',
    maxLength: PLATFORM_LIMITS.facebook.maxLength,
    supports: {
      hashtags: true,
      mentions: true,
      emojis: true,
      multiline: true,
      links: true
    },
    style: {
      tone: 'conversational and detailed',
      preferredLength: 400,
      emojiUsage: 'light',
      hashtagLimit: 5
    },
    formatting: {
      lineBreaks: true,
      bulletPoints: true,
      emphasis: 'natural language'
    }
  },

  linkedin: {
    name: 'LinkedIn',
    maxLength: PLATFORM_LIMITS.linkedin.maxLength,
    supports: {
      hashtags: true,
      mentions: true,
      emojis: false,
      multiline: true,
      professional: true
    },
    style: {
      tone: 'professional but clever',
      preferredLength: 500,
      emojiUsage: 'minimal',
      hashtagLimit: 3
    },
    formatting: {
      lineBreaks: true,
      bulletPoints: true,
      emphasis: 'professional language'
    }
  },

  tiktok: {
    name: 'TikTok',
    maxLength: PLATFORM_LIMITS.tiktok.maxLength,
    supports: {
      hashtags: true,
      mentions: true,
      emojis: true,
      trending: true
    },
    style: {
      tone: 'trendy and energetic',
      preferredLength: 200,
      emojiUsage: 'heavy',
      hashtagLimit: 10
    },
    formatting: {
      lineBreaks: true,
      bulletPoints: false,
      emphasis: 'trendy language and emojis'
    }
  },

  youtube: {
    name: 'YouTube',
    maxLength: PLATFORM_LIMITS.youtube.maxLength,
    supports: {
      hashtags: true,
      mentions: false,
      emojis: true,
      multiline: true,
      timestamps: true
    },
    style: {
      tone: 'detailed and engaging',
      preferredLength: 800,
      emojiUsage: 'moderate',
      hashtagLimit: 15
    },
    formatting: {
      lineBreaks: true,
      bulletPoints: true,
      emphasis: 'structured content'
    }
  },

  discord: {
    name: 'Discord',
    maxLength: PLATFORM_LIMITS.discord.maxLength,
    supports: {
      mentions: true,
      emojis: true,
      customEmojis: true,
      markdown: true
    },
    style: {
      tone: 'casual and community-focused',
      preferredLength: 300,
      emojiUsage: 'heavy',
      customEmojiUsage: true
    },
    formatting: {
      lineBreaks: true,
      bulletPoints: true,
      emphasis: 'markdown formatting',
      codeBlocks: true
    }
  },

  reddit: {
    name: 'Reddit',
    maxLength: PLATFORM_LIMITS.reddit.maxLength,
    supports: {
      mentions: true,
      emojis: true,
      markdown: true,
      subredditContext: true
    },
    style: {
      tone: 'witty and reference-heavy',
      preferredLength: 600,
      emojiUsage: 'light',
      referencesEncouraged: true
    },
    formatting: {
      lineBreaks: true,
      bulletPoints: true,
      emphasis: 'markdown with references',
      quotes: true
    }
  },

  twitch: {
    name: 'Twitch',
    maxLength: PLATFORM_LIMITS.twitch.maxLength,
    supports: {
      mentions: true,
      emojis: true,
      emotes: true
    },
    style: {
      tone: 'fast-paced and energetic',
      preferredLength: 200,
      emojiUsage: 'heavy'
    },
    formatting: {
      lineBreaks: false,
      bulletPoints: false,
      emphasis: 'emotes and mentions'
    }
  },

  bluesky: {
    name: 'Bluesky',
    maxLength: PLATFORM_LIMITS.bluesky.maxLength,
    supports: {
      mentions: true,
      hashtags: true,
      emojis: true,
      threading: true
    },
    style: {
      tone: 'thoughtful and concise',
      preferredLength: 250,
      emojiUsage: 'light',
      hashtagLimit: 3
    },
    formatting: {
      lineBreaks: false,
      bulletPoints: false,
      emphasis: 'natural language'
    }
  }
};

/**
 * Get platform configuration by name
 * @param {string} platformName - Platform identifier
 * @returns {Object|null} Platform configuration or null if not found
 */
function getPlatformConfig(platformName) {
  if (!platformName || typeof platformName !== 'string') {
    return null;
  }
  
  const platform = platformName.toLowerCase();
  return PLATFORMS[platform] || null;
}

/**
 * Get character limit for specific platform
 * @param {string} platformName - Platform identifier
 * @returns {number} Character limit (default: 1000)
 */
function getPlatformLimit(platformName) {
  const config = getPlatformConfig(platformName);
  return config ? config.maxLength : PLATFORM_LIMITS.default.maxLength;
}

/**
 * Get preferred length for optimal engagement
 * @param {string} platformName - Platform identifier  
 * @returns {number} Preferred character length
 */
function getPreferredLength(platformName) {
  const config = getPlatformConfig(platformName);
  return config ? config.style.preferredLength : PLATFORM_LIMITS.twitter.maxLength;
}

/**
 * Check if platform supports specific feature
 * @param {string} platformName - Platform identifier
 * @param {string} feature - Feature to check (hashtags, emojis, etc.)
 * @returns {boolean} Whether feature is supported
 */
function platformSupports(platformName, feature) {
  const config = getPlatformConfig(platformName);
  if (!config || !config.supports) return false;
  return config.supports[feature] === true;
}

/**
 * Get platform-specific style guide for tone adaptation
 * @param {string} platformName - Platform identifier
 * @returns {Object} Style configuration
 */
function getPlatformStyle(platformName) {
  const config = getPlatformConfig(platformName);
  return config ? config.style : {
    tone: 'neutral',
    preferredLength: PLATFORM_LIMITS.twitter.maxLength,
    emojiUsage: 'moderate'
  };
}

/**
 * Validate roast length for specific platform
 * @param {string} roast - Generated roast text
 * @param {string} platformName - Target platform
 * @returns {Object} Validation result with isValid and adjustedText
 */
function validateRoastForPlatform(roast, platformName) {
  if (!roast || typeof roast !== 'string' || roast.length === 0) {
    return { isValid: false, error: 'Invalid roast text' };
  }

  const limit = getPlatformLimit(platformName);
  const isValid = roast.length <= limit;
  
  let adjustedText = roast;
  if (!isValid) {
    // Truncate while preserving word boundaries
    const maxLength = limit - 3; // Reserve space for "..."
    adjustedText = roast.substring(0, maxLength);
    const lastSpace = adjustedText.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) { // Only truncate at word boundary if reasonable
      adjustedText = adjustedText.substring(0, lastSpace);
    }
    adjustedText += '...';
  }

  return {
    isValid,
    adjustedText,
    originalLength: roast.length,
    limit,
    platformConfig: getPlatformConfig(platformName)
  };
}

/**
 * Get list of all supported platforms
 * @returns {Array<string>} Array of platform names
 */
function getSupportedPlatforms() {
  return Object.keys(PLATFORMS);
}

module.exports = {
  PLATFORMS,
  getPlatformConfig,
  getPlatformLimit,
  getPreferredLength,
  platformSupports,
  getPlatformStyle,
  validateRoastForPlatform,
  getSupportedPlatforms
};