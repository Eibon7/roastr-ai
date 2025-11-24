/**
 * Platform Constraints Validation Tests
 *
 * Comprehensive test suite for platform-specific constraints including:
 * - Character limits per platform (9 platforms)
 * - Formatting rules (hashtags, mentions, emojis, etc.)
 * - Edge cases (emoji handling, special characters, boundary conditions)
 *
 * Issue #718: Platform Constraints Validation
 * Coverage Target: ≥80%
 */

const {
  validateRoastForPlatform,
  getPlatformLimit,
  getPlatformConfig,
  getPlatformStyle,
  platformSupports,
  getPreferredLength,
  getSupportedPlatforms
} = require('../../../src/config/platforms');

describe('Platform Constraints Validation', () => {
  // All supported platforms (9 core platforms + LinkedIn)
  const PLATFORMS = [
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

  // Expected character limits per platform
  const EXPECTED_LIMITS = {
    twitter: 280,
    youtube: 10000,
    instagram: 2200,
    facebook: 63206,
    discord: 2000,
    twitch: 500,
    reddit: 40000,
    tiktok: 2200,
    bluesky: 300
  };

  // Expected preferred lengths per platform
  const EXPECTED_PREFERRED_LENGTHS = {
    twitter: 240,
    youtube: 800,
    instagram: 150,
    facebook: 400,
    discord: 300,
    twitch: 200,
    reddit: 600,
    tiktok: 200,
    bluesky: 250
  };

  describe('validateRoastForPlatform', () => {
    describe('Character Limits - All Platforms', () => {
      PLATFORMS.forEach((platform) => {
        const limit = EXPECTED_LIMITS[platform];

        test(`should validate ${platform} with exact limit (${limit} chars)`, () => {
          const roast = 'A'.repeat(limit);
          const result = validateRoastForPlatform(roast, platform);

          expect(result.isValid).toBe(true);
          expect(result.adjustedText).toBe(roast);
          expect(result.originalLength).toBe(limit);
          expect(result.limit).toBe(limit);
          expect(result.platformConfig).toBeDefined();
        });

        test(`should validate ${platform} below limit`, () => {
          const roast = 'A'.repeat(limit - 10);
          const result = validateRoastForPlatform(roast, platform);

          expect(result.isValid).toBe(true);
          expect(result.adjustedText).toBe(roast);
          expect(result.originalLength).toBe(limit - 10);
        });

        test(`should reject ${platform} exceeding limit`, () => {
          const roast = 'A'.repeat(limit + 10);
          const result = validateRoastForPlatform(roast, platform);

          expect(result.isValid).toBe(false);
          expect(result.adjustedText.length).toBeLessThanOrEqual(limit);
          expect(result.adjustedText).toContain('...');
          expect(result.originalLength).toBe(limit + 10);
        });

        test(`should truncate ${platform} roast preserving word boundaries`, () => {
          const words = 'This is a test roast that exceeds the limit for this platform';
          // Create text that definitely exceeds the limit
          const longRoast = words.repeat(Math.ceil(limit / words.length) + 10);
          const result = validateRoastForPlatform(longRoast, platform);

          expect(result.isValid).toBe(false);
          expect(result.adjustedText.length).toBeLessThanOrEqual(limit);
          expect(result.adjustedText).toContain('...');
          // Should end at word boundary if possible
          if (result.adjustedText.length > limit * 0.8) {
            expect(result.adjustedText.trim()).not.toMatch(/\s+$/);
          }
        });
      });
    });

    describe('Truncation Logic', () => {
      test('should truncate at word boundary when reasonable', () => {
        // Create text that definitely exceeds Twitter's 280 limit
        const roast =
          'This is a very long roast that needs to be truncated at a word boundary for better readability '.repeat(
            5
          );
        const result = validateRoastForPlatform(roast, 'twitter'); // 280 limit

        expect(result.isValid).toBe(false);
        expect(result.adjustedText).toContain('...');
        expect(result.adjustedText.length).toBeLessThanOrEqual(280);
      });

      test('should handle truncation when no word boundary found', () => {
        const roast = 'A'.repeat(500); // No spaces
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result.isValid).toBe(false);
        expect(result.adjustedText.length).toBeLessThanOrEqual(280);
        expect(result.adjustedText).toContain('...');
      });

      test('should reserve space for ellipsis', () => {
        const roast = 'A'.repeat(300);
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result.isValid).toBe(false);
        // Adjusted text should be limit - 3 (for "...")
        expect(result.adjustedText.length).toBeLessThanOrEqual(280);
        expect(result.adjustedText.endsWith('...')).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      test('should handle empty string', () => {
        const result = validateRoastForPlatform('', 'twitter');

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid roast text');
      });

      test('should handle null roast', () => {
        const result = validateRoastForPlatform(null, 'twitter');

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid roast text');
      });

      test('should handle undefined roast', () => {
        const result = validateRoastForPlatform(undefined, 'twitter');

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid roast text');
      });

      test('should handle non-string roast', () => {
        const result = validateRoastForPlatform(123, 'twitter');

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid roast text');
      });

      test('should handle invalid platform', () => {
        const roast = 'This is a valid roast';
        const result = validateRoastForPlatform(roast, 'invalid-platform');

        // Should use default limit (1000)
        expect(result.limit).toBe(1000);
        expect(result.isValid).toBe(true); // Roast is under default limit
      });

      test('should handle null platform', () => {
        const roast = 'This is a valid roast';
        const result = validateRoastForPlatform(roast, null);

        expect(result.limit).toBe(1000); // Default
        expect(result.isValid).toBe(true);
      });

      test('should handle undefined platform', () => {
        const roast = 'This is a valid roast';
        const result = validateRoastForPlatform(roast, undefined);

        expect(result.limit).toBe(1000); // Default
        expect(result.isValid).toBe(true);
      });
    });

    describe('Emoji Handling', () => {
      test('should handle emojis at start of roast', () => {
        const roast = '🔥🔥🔥 This is a roast with emojis at the start';
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result).toBeDefined();
        expect(result.isValid).toBe(roast.length <= 280);
      });

      test('should handle emojis in middle of roast', () => {
        const roast = 'This is a roast with 🔥 emojis in the middle 🔥';
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result).toBeDefined();
        expect(result.isValid).toBe(roast.length <= 280);
      });

      test('should handle emojis at end of roast', () => {
        const roast = 'This is a roast with emojis at the end 🔥🔥🔥';
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result).toBeDefined();
        expect(result.isValid).toBe(roast.length <= 280);
      });

      test('should handle multi-byte emojis (UTF-8)', () => {
        const roast = 'This roast has complex emojis: 🎉🎊🎈🎁🎂';
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result).toBeDefined();
        expect(result.isValid).toBe(roast.length <= 280);
      });

      test('should truncate roast with emojis correctly', () => {
        const emojis = '🔥'.repeat(100);
        const text = ' This is a very long roast that exceeds the limit '.repeat(10);
        const roast = `${emojis}${text}`;
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result.isValid).toBe(false);
        expect(result.adjustedText.length).toBeLessThanOrEqual(280);
        expect(result.adjustedText).toContain('...');
      });
    });

    describe('Special Characters', () => {
      test('should handle hashtags', () => {
        const roast = 'This is a roast with #hashtag #roast #burn';
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result).toBeDefined();
        expect(result.isValid).toBe(roast.length <= 280);
      });

      test('should handle mentions', () => {
        const roast = 'This is a roast mentioning @username and @another';
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result).toBeDefined();
        expect(result.isValid).toBe(roast.length <= 280);
      });

      test('should handle URLs', () => {
        const roast = 'Check this out: https://example.com/very/long/url/path';
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result).toBeDefined();
        expect(result.isValid).toBe(roast.length <= 280);
      });

      test('should handle markdown formatting', () => {
        const roast = 'This is **bold** and *italic* and `code` formatting';
        const result = validateRoastForPlatform(roast, 'discord');

        expect(result).toBeDefined();
        expect(result.isValid).toBe(roast.length <= 2000);
      });

      test('should handle mixed special characters', () => {
        const roast = '🔥 @username Check #hashtag https://example.com **bold**';
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result).toBeDefined();
        expect(result.isValid).toBe(roast.length <= 280);
      });
    });

    describe('Boundary Conditions', () => {
      test('should handle text exactly at limit', () => {
        const roast = 'A'.repeat(280);
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result.isValid).toBe(true);
        expect(result.adjustedText.length).toBe(280);
      });

      test('should handle text 1 character over limit', () => {
        const roast = 'A'.repeat(281);
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result.isValid).toBe(false);
        expect(result.adjustedText.length).toBeLessThanOrEqual(280);
      });

      test('should handle text well below limit', () => {
        const roast = 'Short roast';
        const result = validateRoastForPlatform(roast, 'twitter');

        expect(result.isValid).toBe(true);
        expect(result.adjustedText).toBe(roast);
      });

      test('should handle very long text exceeding all limits', () => {
        const roast = 'A'.repeat(100000);
        const result = validateRoastForPlatform(roast, 'facebook'); // Highest limit: 63206

        expect(result.isValid).toBe(false);
        expect(result.adjustedText.length).toBeLessThanOrEqual(63206);
      });
    });
  });

  describe('getPlatformLimit', () => {
    PLATFORMS.forEach((platform) => {
      test(`should return correct limit for ${platform}`, () => {
        const limit = getPlatformLimit(platform);
        expect(limit).toBe(EXPECTED_LIMITS[platform]);
      });
    });

    test('should return default limit for invalid platform', () => {
      const limit = getPlatformLimit('invalid-platform');
      expect(limit).toBe(1000); // Default from constants
    });

    test('should return default limit for null platform', () => {
      const limit = getPlatformLimit(null);
      expect(limit).toBe(1000);
    });

    test('should return default limit for undefined platform', () => {
      const limit = getPlatformLimit(undefined);
      expect(limit).toBe(1000);
    });

    test('should handle case-insensitive platform names', () => {
      const limit1 = getPlatformLimit('TWITTER');
      const limit2 = getPlatformLimit('twitter');
      expect(limit1).toBe(limit2);
      expect(limit1).toBe(280);
    });
  });

  describe('getPreferredLength', () => {
    PLATFORMS.forEach((platform) => {
      test(`should return correct preferred length for ${platform}`, () => {
        const preferred = getPreferredLength(platform);
        expect(preferred).toBe(EXPECTED_PREFERRED_LENGTHS[platform]);
      });
    });

    test('should return default preferred length for invalid platform', () => {
      const preferred = getPreferredLength('invalid-platform');
      expect(preferred).toBe(280); // Twitter default
    });
  });

  describe('getPlatformStyle', () => {
    PLATFORMS.forEach((platform) => {
      test(`should return style config for ${platform}`, () => {
        const style = getPlatformStyle(platform);

        expect(style).toBeDefined();
        expect(style).toHaveProperty('tone');
        expect(style).toHaveProperty('preferredLength');
        expect(style).toHaveProperty('emojiUsage');
        expect(typeof style.tone).toBe('string');
        expect(typeof style.preferredLength).toBe('number');
        expect(['moderate', 'heavy', 'light', 'minimal']).toContain(style.emojiUsage);
      });
    });

    test('should return default style for invalid platform', () => {
      const style = getPlatformStyle('invalid-platform');

      expect(style).toBeDefined();
      expect(style.tone).toBe('neutral');
      expect(style.preferredLength).toBe(280);
      expect(style.emojiUsage).toBe('moderate');
    });

    test('should return correct tone for each platform', () => {
      const tones = {
        twitter: 'concise and punchy',
        youtube: 'detailed and engaging',
        instagram: 'visual and engaging',
        facebook: 'conversational and detailed',
        discord: 'casual and community-focused',
        twitch: 'fast-paced and energetic',
        reddit: 'witty and reference-heavy',
        tiktok: 'trendy and energetic',
        bluesky: 'thoughtful and concise'
      };

      PLATFORMS.forEach((platform) => {
        const style = getPlatformStyle(platform);
        expect(style.tone).toBe(tones[platform]);
      });
    });
  });

  describe('platformSupports', () => {
    describe('Hashtags Support', () => {
      const platformsWithHashtags = [
        'twitter',
        'instagram',
        'facebook',
        'youtube',
        'tiktok',
        'bluesky'
      ];
      const platformsWithoutHashtags = ['discord', 'twitch', 'reddit'];

      platformsWithHashtags.forEach((platform) => {
        test(`${platform} should support hashtags`, () => {
          expect(platformSupports(platform, 'hashtags')).toBe(true);
        });
      });

      platformsWithoutHashtags.forEach((platform) => {
        test(`${platform} should not support hashtags`, () => {
          expect(platformSupports(platform, 'hashtags')).toBe(false);
        });
      });
    });

    describe('Mentions Support', () => {
      const platformsWithMentions = [
        'twitter',
        'instagram',
        'facebook',
        'discord',
        'twitch',
        'reddit',
        'tiktok',
        'bluesky'
      ];
      const platformsWithoutMentions = ['youtube'];

      platformsWithMentions.forEach((platform) => {
        test(`${platform} should support mentions`, () => {
          expect(platformSupports(platform, 'mentions')).toBe(true);
        });
      });

      platformsWithoutMentions.forEach((platform) => {
        test(`${platform} should not support mentions`, () => {
          expect(platformSupports(platform, 'mentions')).toBe(false);
        });
      });
    });

    describe('Emojis Support', () => {
      const platformsWithEmojis = [
        'twitter',
        'instagram',
        'facebook',
        'youtube',
        'discord',
        'twitch',
        'reddit',
        'tiktok',
        'bluesky'
      ];

      platformsWithEmojis.forEach((platform) => {
        test(`${platform} should support emojis`, () => {
          expect(platformSupports(platform, 'emojis')).toBe(true);
        });
      });
    });

    describe('Markdown Support', () => {
      const platformsWithMarkdown = ['discord', 'reddit'];
      const platformsWithoutMarkdown = [
        'twitter',
        'youtube',
        'instagram',
        'facebook',
        'twitch',
        'tiktok',
        'bluesky'
      ];

      platformsWithMarkdown.forEach((platform) => {
        test(`${platform} should support markdown`, () => {
          expect(platformSupports(platform, 'markdown')).toBe(true);
        });
      });

      platformsWithoutMarkdown.forEach((platform) => {
        test(`${platform} should not support markdown`, () => {
          expect(platformSupports(platform, 'markdown')).toBe(false);
        });
      });
    });

    describe('Threading Support', () => {
      const platformsWithThreading = ['twitter', 'bluesky'];
      const platformsWithoutThreading = [
        'youtube',
        'instagram',
        'facebook',
        'discord',
        'twitch',
        'reddit',
        'tiktok'
      ];

      platformsWithThreading.forEach((platform) => {
        test(`${platform} should support threading`, () => {
          expect(platformSupports(platform, 'threading')).toBe(true);
        });
      });

      platformsWithoutThreading.forEach((platform) => {
        test(`${platform} should not support threading`, () => {
          expect(platformSupports(platform, 'threading')).toBe(false);
        });
      });
    });

    describe('Multiline Support', () => {
      // Note: multiline support is based on formatting.lineBreaks, not supports.multiline
      // Discord and Reddit have lineBreaks: true but no supports.multiline property
      const platformsWithMultiline = ['instagram', 'facebook', 'youtube'];
      const platformsWithoutMultiline = [
        'twitter',
        'discord',
        'twitch',
        'reddit',
        'tiktok',
        'bluesky'
      ];

      platformsWithMultiline.forEach((platform) => {
        test(`${platform} should support multiline`, () => {
          expect(platformSupports(platform, 'multiline')).toBe(true);
        });
      });

      platformsWithoutMultiline.forEach((platform) => {
        test(`${platform} should not support multiline`, () => {
          expect(platformSupports(platform, 'multiline')).toBe(false);
        });
      });
    });

    test('should return false for invalid platform', () => {
      expect(platformSupports('invalid-platform', 'hashtags')).toBe(false);
    });

    test('should return false for invalid feature', () => {
      expect(platformSupports('twitter', 'invalid-feature')).toBe(false);
    });

    test('should return false for null platform', () => {
      expect(platformSupports(null, 'hashtags')).toBe(false);
    });
  });

  describe('getPlatformConfig', () => {
    PLATFORMS.forEach((platform) => {
      test(`should return complete config for ${platform}`, () => {
        const config = getPlatformConfig(platform);

        expect(config).toBeDefined();
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('maxLength');
        expect(config).toHaveProperty('supports');
        expect(config).toHaveProperty('style');
        expect(config).toHaveProperty('formatting');
        expect(config.maxLength).toBe(EXPECTED_LIMITS[platform]);
      });
    });

    test('should return null for invalid platform', () => {
      const config = getPlatformConfig('invalid-platform');
      expect(config).toBeNull();
    });

    test('should return null for null platform', () => {
      const config = getPlatformConfig(null);
      expect(config).toBeNull();
    });

    test('should handle case-insensitive platform names', () => {
      const config1 = getPlatformConfig('TWITTER');
      const config2 = getPlatformConfig('twitter');
      expect(config1).toEqual(config2);
    });
  });

  describe('getSupportedPlatforms', () => {
    test('should return array of all supported platforms', () => {
      const platforms = getSupportedPlatforms();

      expect(Array.isArray(platforms)).toBe(true);
      expect(platforms.length).toBeGreaterThanOrEqual(9);
      // Verify all 9 core platforms are included
      PLATFORMS.forEach((platform) => {
        expect(platforms).toContain(platform);
      });
    });

    test('should return consistent results', () => {
      const platforms1 = getSupportedPlatforms();
      const platforms2 = getSupportedPlatforms();
      expect(platforms1).toEqual(platforms2);
    });
  });
});
