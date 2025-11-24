const { z } = require('zod');

/**
 * OAuth Authorization Code Schema
 * Validates authorization code from OAuth providers
 *
 * @example
 * const result = OAuthCodeSchema.parse({
 *   code: 'abc123xyz',
 *   state: 'csrf_token_12345',
 *   redirect_uri: 'https://roastr.ai/callback'
 * });
 */
const OAuthCodeSchema = z.object({
  code: z
    .string()
    .min(1, 'OAuth code is required')
    .max(500, 'OAuth code too long'),
  state: z
    .string()
    .min(1, 'State token is required')
    .max(200, 'State token too long'),
  redirect_uri: z.string().url('Invalid redirect URI').optional()
});

/**
 * OAuth Connection Request Schema
 * Validates full OAuth connection payload for social platforms
 *
 * @example
 * const result = OAuthConnectionSchema.parse({
 *   platform: 'twitter',
 *   code: 'abc123xyz',
 *   state: 'csrf_token_12345'
 * });
 */
const OAuthConnectionSchema = z.object({
  platform: z
    .enum([
      'twitter',
      'youtube',
      'instagram',
      'facebook',
      'discord',
      'twitch',
      'reddit',
      'tiktok',
      'bluesky'
    ])
    .describe('Social media platform'),
  code: z.string().min(1, 'OAuth code is required'),
  state: z.string().min(1, 'State token is required'),
  redirect_uri: z.string().url().optional(),
  organization_id: z.string().uuid().optional() // For multi-tenant scenarios
});

/**
 * Twitter OAuth 1.0a Connection Schema
 * Extends base schema with Twitter-specific OAuth 1.0a fields
 *
 * @example
 * const result = TwitterConnectSchema.parse({
 *   platform: 'twitter',
 *   code: 'abc123',
 *   state: 'csrf_token',
 *   oauth_token: 'twitter_token_123',
 *   oauth_verifier: 'verifier_abc'
 * });
 */
const TwitterConnectSchema = OAuthConnectionSchema.extend({
  platform: z.literal('twitter'),
  oauth_token: z.string().optional(), // OAuth 1.0a specific
  oauth_verifier: z.string().optional()
});

/**
 * YouTube Connection Schema
 * Validates YouTube-specific OAuth 2.0 flow with scopes
 *
 * @example
 * const result = YouTubeConnectSchema.parse({
 *   platform: 'youtube',
 *   code: 'abc123',
 *   state: 'csrf_token',
 *   scope: 'https://www.googleapis.com/auth/youtube.force-ssl'
 * });
 */
const YouTubeConnectSchema = OAuthConnectionSchema.extend({
  platform: z.literal('youtube'),
  scope: z.string().optional() // Validate OAuth scopes
});

/**
 * Discord Connection Schema
 * Validates Discord-specific OAuth 2.0 flow
 *
 * @example
 * const result = DiscordConnectSchema.parse({
 *   platform: 'discord',
 *   code: 'abc123',
 *   state: 'csrf_token',
 *   guild_id: '123456789'
 * });
 */
const DiscordConnectSchema = OAuthConnectionSchema.extend({
  platform: z.literal('discord'),
  guild_id: z.string().optional() // Discord server ID
});

/**
 * Instagram Connection Schema
 * Validates Instagram Basic Display API OAuth flow
 */
const InstagramConnectSchema = OAuthConnectionSchema.extend({
  platform: z.literal('instagram')
});

/**
 * Facebook Connection Schema
 * Validates Facebook Graph API OAuth flow
 */
const FacebookConnectSchema = OAuthConnectionSchema.extend({
  platform: z.literal('facebook'),
  scope: z.string().optional() // Facebook permissions
});

/**
 * Twitch Connection Schema
 * Validates Twitch OAuth 2.0 flow
 */
const TwitchConnectSchema = OAuthConnectionSchema.extend({
  platform: z.literal('twitch'),
  scope: z.string().optional() // Twitch scopes
});

/**
 * Reddit Connection Schema
 * Validates Reddit OAuth 2.0 application flow
 */
const RedditConnectSchema = OAuthConnectionSchema.extend({
  platform: z.literal('reddit'),
  scope: z.string().optional() // Reddit scopes
});

/**
 * TikTok Connection Schema
 * Validates TikTok Business API OAuth flow
 */
const TikTokConnectSchema = OAuthConnectionSchema.extend({
  platform: z.literal('tiktok')
});

/**
 * Bluesky Connection Schema
 * Validates Bluesky AT Protocol authentication
 */
const BlueskyConnectSchema = OAuthConnectionSchema.extend({
  platform: z.literal('bluesky'),
  handle: z.string().optional(), // Bluesky handle
  app_password: z.string().optional() // Bluesky app password
});

module.exports = {
  OAuthCodeSchema,
  OAuthConnectionSchema,
  TwitterConnectSchema,
  YouTubeConnectSchema,
  DiscordConnectSchema,
  InstagramConnectSchema,
  FacebookConnectSchema,
  TwitchConnectSchema,
  RedditConnectSchema,
  TikTokConnectSchema,
  BlueskyConnectSchema
};

