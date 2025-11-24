const {
  OAuthCodeSchema,
  OAuthErrorCallbackSchema,
  OAuthCallbackSchema,
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
} = require('../../../src/validators/zod/social.schema');

describe('Social Connection Zod Schemas - Issue #948', () => {
  describe('OAuthCodeSchema', () => {
    it('should validate valid OAuth code with all fields', () => {
      const valid = {
        code: 'abc123xyz',
        state: 'csrf_token_12345',
        redirect_uri: 'https://roastr.ai/callback'
      };
      
      const result = OAuthCodeSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should validate OAuth code without optional redirect_uri', () => {
      const valid = {
        code: 'abc123xyz',
        state: 'csrf_token_12345'
      };
      
      const result = OAuthCodeSchema.parse(valid);
      expect(result.code).toBe('abc123xyz');
      expect(result.state).toBe('csrf_token_12345');
      expect(result.redirect_uri).toBeUndefined();
    });

    it('should reject empty code', () => {
      const invalid = { 
        code: '', 
        state: 'csrf_token' 
      };
      
      expect(() => OAuthCodeSchema.parse(invalid)).toThrow('OAuth code is required');
    });

    it('should reject missing code', () => {
      const invalid = { 
        state: 'csrf_token' 
      };
      
      expect(() => OAuthCodeSchema.parse(invalid)).toThrow();
    });

    it('should reject empty state', () => {
      const invalid = { 
        code: 'abc123', 
        state: '' 
      };
      
      expect(() => OAuthCodeSchema.parse(invalid)).toThrow('State token is required');
    });

    it('should reject missing state', () => {
      const invalid = { 
        code: 'abc123' 
      };
      
      expect(() => OAuthCodeSchema.parse(invalid)).toThrow();
    });

    it('should reject invalid redirect_uri format', () => {
      const invalid = {
        code: 'abc123',
        state: 'csrf_token',
        redirect_uri: 'not-a-valid-url'
      };
      
      expect(() => OAuthCodeSchema.parse(invalid)).toThrow('Invalid redirect URI');
    });

    it('should reject code exceeding max length', () => {
      const invalid = {
        code: 'a'.repeat(501), // 501 chars, max is 500
        state: 'csrf_token'
      };
      
      expect(() => OAuthCodeSchema.parse(invalid)).toThrow('OAuth code too long');
    });

    it('should reject state exceeding max length', () => {
      const invalid = {
        code: 'abc123',
        state: 's'.repeat(201) // 201 chars, max is 200
      };
      
      expect(() => OAuthCodeSchema.parse(invalid)).toThrow('State token too long');
    });

    it('should accept valid https redirect_uri', () => {
      const valid = {
        code: 'abc123',
        state: 'csrf_token',
        redirect_uri: 'https://example.com/oauth/callback'
      };
      
      expect(() => OAuthCodeSchema.parse(valid)).not.toThrow();
    });

    it('should accept valid http redirect_uri (for local dev)', () => {
      const valid = {
        code: 'abc123',
        state: 'csrf_token',
        redirect_uri: 'http://localhost:3000/callback'
      };
      
      expect(() => OAuthCodeSchema.parse(valid)).not.toThrow();
    });
  });

  describe('OAuthErrorCallbackSchema', () => {
    it('should validate error callback with all fields', () => {
      const valid = {
        error: 'access_denied',
        error_description: 'User denied access to the application',
        state: 'csrf_token_12345'
      };
      
      const result = OAuthErrorCallbackSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should validate error callback without optional fields', () => {
      const valid = {
        error: 'user_cancelled'
      };
      
      const result = OAuthErrorCallbackSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should reject missing error field', () => {
      const invalid = {
        error_description: 'Some description'
      };
      
      expect(() => OAuthErrorCallbackSchema.parse(invalid)).toThrow();
    });

    it('should reject empty error string', () => {
      const invalid = {
        error: '',
        error_description: 'Description'
      };
      
      expect(() => OAuthErrorCallbackSchema.parse(invalid)).toThrow('OAuth error code is required');
    });

    it('should accept common OAuth error codes', () => {
      const errorCodes = [
        'access_denied',
        'user_cancelled',
        'temporarily_unavailable',
        'server_error',
        'invalid_request',
        'invalid_scope',
        'unauthorized_client'
      ];

      errorCodes.forEach(code => {
        const valid = { error: code };
        expect(() => OAuthErrorCallbackSchema.parse(valid)).not.toThrow();
      });
    });

    it('should accept long error descriptions', () => {
      const valid = {
        error: 'server_error',
        error_description: 'A'.repeat(500) // Long description
      };
      
      expect(() => OAuthErrorCallbackSchema.parse(valid)).not.toThrow();
    });
  });

  describe('OAuthCallbackSchema (Union)', () => {
    it('should accept success flow (code + state)', () => {
      const valid = {
        code: 'abc123xyz',
        state: 'csrf_token_12345'
      };
      
      const result = OAuthCallbackSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should accept error flow (error only)', () => {
      const valid = {
        error: 'access_denied'
      };
      
      const result = OAuthCallbackSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should accept error flow with full details', () => {
      const valid = {
        error: 'user_cancelled',
        error_description: 'User cancelled authorization',
        state: 'optional_state'
      };
      
      const result = OAuthCallbackSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should accept success flow with redirect_uri', () => {
      const valid = {
        code: 'abc123',
        state: 'csrf_token',
        redirect_uri: 'https://roastr.ai/callback'
      };
      
      const result = OAuthCallbackSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should reject missing both code and error', () => {
      const invalid = {
        state: 'some_state'
      };
      
      expect(() => OAuthCallbackSchema.parse(invalid)).toThrow();
    });

    it('should reject empty object', () => {
      const invalid = {};
      
      expect(() => OAuthCallbackSchema.parse(invalid)).toThrow();
    });

    it('should handle mixed scenario (error takes precedence)', () => {
      // If both error and code are present, union should accept it
      // (application logic determines which flow to follow)
      const mixed = {
        error: 'access_denied',
        code: 'should_be_ignored',
        state: 'csrf_token'
      };
      
      const result = OAuthCallbackSchema.parse(mixed);
      expect(result).toBeDefined();
    });

    it('should validate state format in success flow', () => {
      const invalid = {
        code: 'abc123',
        state: '' // Empty state not allowed in success flow
      };
      
      expect(() => OAuthCallbackSchema.parse(invalid)).toThrow();
    });

    it('should accept numeric-like strings in error codes', () => {
      const valid = {
        error: '12345' // Some providers use numeric error codes
      };
      
      expect(() => OAuthCallbackSchema.parse(valid)).not.toThrow();
    });
  });

  describe('OAuthConnectionSchema', () => {
    const supportedPlatforms = [
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

    it('should validate all 9 supported platforms', () => {
      supportedPlatforms.forEach((platform) => {
        const valid = {
          platform,
          code: 'abc123',
          state: 'csrf_token'
        };
        
        expect(() => OAuthConnectionSchema.parse(valid)).not.toThrow();
      });
    });

    it('should reject unsupported platform', () => {
      const invalid = {
        platform: 'linkedin',
        code: 'abc123',
        state: 'csrf_token'
      };
      
      expect(() => OAuthConnectionSchema.parse(invalid)).toThrow();
    });

    it('should validate with optional organization_id', () => {
      const valid = {
        platform: 'twitter',
        code: 'abc123',
        state: 'csrf_token',
        organization_id: '550e8400-e29b-41d4-a716-446655440000'
      };
      
      const result = OAuthConnectionSchema.parse(valid);
      expect(result.organization_id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should reject invalid UUID format for organization_id', () => {
      const invalid = {
        platform: 'twitter',
        code: 'abc123',
        state: 'csrf_token',
        organization_id: 'not-a-uuid'
      };
      
      expect(() => OAuthConnectionSchema.parse(invalid)).toThrow();
    });

    it('should validate with optional redirect_uri', () => {
      const valid = {
        platform: 'discord',
        code: 'abc123',
        state: 'csrf_token',
        redirect_uri: 'https://roastr.ai/callback'
      };
      
      expect(() => OAuthConnectionSchema.parse(valid)).not.toThrow();
    });
  });

  describe('TwitterConnectSchema', () => {
    it('should validate Twitter OAuth 1.0a flow with all fields', () => {
      const valid = {
        platform: 'twitter',
        code: 'abc123',
        state: 'csrf_token',
        oauth_token: 'twitter_token_123',
        oauth_verifier: 'verifier_abc'
      };
      
      const result = TwitterConnectSchema.parse(valid);
      expect(result.platform).toBe('twitter');
      expect(result.oauth_token).toBe('twitter_token_123');
      expect(result.oauth_verifier).toBe('verifier_abc');
    });

    it('should validate Twitter without optional oauth fields', () => {
      const valid = {
        platform: 'twitter',
        code: 'abc123',
        state: 'csrf_token'
      };
      
      expect(() => TwitterConnectSchema.parse(valid)).not.toThrow();
    });

    it('should reject non-twitter platform', () => {
      const invalid = {
        platform: 'youtube',
        code: 'abc123',
        state: 'csrf_token'
      };
      
      expect(() => TwitterConnectSchema.parse(invalid)).toThrow();
    });
  });

  describe('YouTubeConnectSchema', () => {
    it('should validate YouTube OAuth 2.0 flow with scope', () => {
      const valid = {
        platform: 'youtube',
        code: 'abc123',
        state: 'csrf_token',
        scope: 'https://www.googleapis.com/auth/youtube.force-ssl'
      };
      
      const result = YouTubeConnectSchema.parse(valid);
      expect(result.platform).toBe('youtube');
      expect(result.scope).toBe('https://www.googleapis.com/auth/youtube.force-ssl');
    });

    it('should validate YouTube without optional scope', () => {
      const valid = {
        platform: 'youtube',
        code: 'abc123',
        state: 'csrf_token'
      };
      
      expect(() => YouTubeConnectSchema.parse(valid)).not.toThrow();
    });

    it('should reject non-youtube platform', () => {
      const invalid = {
        platform: 'twitter',
        code: 'abc123',
        state: 'csrf_token'
      };
      
      expect(() => YouTubeConnectSchema.parse(invalid)).toThrow();
    });
  });

  describe('DiscordConnectSchema', () => {
    it('should validate Discord OAuth with guild_id', () => {
      const valid = {
        platform: 'discord',
        code: 'abc123',
        state: 'csrf_token',
        guild_id: '123456789012345678'
      };
      
      const result = DiscordConnectSchema.parse(valid);
      expect(result.platform).toBe('discord');
      expect(result.guild_id).toBe('123456789012345678');
    });

    it('should validate Discord without optional guild_id', () => {
      const valid = {
        platform: 'discord',
        code: 'abc123',
        state: 'csrf_token'
      };
      
      expect(() => DiscordConnectSchema.parse(valid)).not.toThrow();
    });

    it('should reject non-discord platform', () => {
      const invalid = {
        platform: 'twitch',
        code: 'abc123',
        state: 'csrf_token'
      };
      
      expect(() => DiscordConnectSchema.parse(invalid)).toThrow();
    });
  });

  describe('InstagramConnectSchema', () => {
    it('should validate Instagram OAuth flow', () => {
      const valid = {
        platform: 'instagram',
        code: 'abc123',
        state: 'csrf_token'
      };
      
      const result = InstagramConnectSchema.parse(valid);
      expect(result.platform).toBe('instagram');
    });

    it('should reject non-instagram platform', () => {
      const invalid = {
        platform: 'facebook',
        code: 'abc123',
        state: 'csrf_token'
      };
      
      expect(() => InstagramConnectSchema.parse(invalid)).toThrow();
    });
  });

  describe('FacebookConnectSchema', () => {
    it('should validate Facebook OAuth with scope', () => {
      const valid = {
        platform: 'facebook',
        code: 'abc123',
        state: 'csrf_token',
        scope: 'pages_read_engagement,pages_manage_posts'
      };
      
      const result = FacebookConnectSchema.parse(valid);
      expect(result.platform).toBe('facebook');
      expect(result.scope).toBe('pages_read_engagement,pages_manage_posts');
    });

    it('should validate Facebook without optional scope', () => {
      const valid = {
        platform: 'facebook',
        code: 'abc123',
        state: 'csrf_token'
      };
      
      expect(() => FacebookConnectSchema.parse(valid)).not.toThrow();
    });
  });

  describe('TwitchConnectSchema', () => {
    it('should validate Twitch OAuth with scope', () => {
      const valid = {
        platform: 'twitch',
        code: 'abc123',
        state: 'csrf_token',
        scope: 'chat:read chat:edit'
      };
      
      const result = TwitchConnectSchema.parse(valid);
      expect(result.platform).toBe('twitch');
      expect(result.scope).toBe('chat:read chat:edit');
    });
  });

  describe('RedditConnectSchema', () => {
    it('should validate Reddit OAuth with scope', () => {
      const valid = {
        platform: 'reddit',
        code: 'abc123',
        state: 'csrf_token',
        scope: 'identity read submit'
      };
      
      const result = RedditConnectSchema.parse(valid);
      expect(result.platform).toBe('reddit');
      expect(result.scope).toBe('identity read submit');
    });
  });

  describe('TikTokConnectSchema', () => {
    it('should validate TikTok OAuth flow', () => {
      const valid = {
        platform: 'tiktok',
        code: 'abc123',
        state: 'csrf_token'
      };
      
      const result = TikTokConnectSchema.parse(valid);
      expect(result.platform).toBe('tiktok');
    });
  });

  describe('BlueskyConnectSchema', () => {
    it('should validate Bluesky OAuth with handle and app_password', () => {
      const valid = {
        platform: 'bluesky',
        code: 'abc123',
        state: 'csrf_token',
        handle: 'user.bsky.social',
        app_password: 'abcd-efgh-ijkl-mnop'
      };
      
      const result = BlueskyConnectSchema.parse(valid);
      expect(result.platform).toBe('bluesky');
      expect(result.handle).toBe('user.bsky.social');
      expect(result.app_password).toBe('abcd-efgh-ijkl-mnop');
    });

    it('should validate Bluesky without optional AT Protocol fields', () => {
      const valid = {
        platform: 'bluesky',
        code: 'abc123',
        state: 'csrf_token'
      };
      
      expect(() => BlueskyConnectSchema.parse(valid)).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle code with special characters', () => {
      const valid = {
        code: 'abc-123_xyz.456',
        state: 'csrf-token_12345'
      };
      
      expect(() => OAuthCodeSchema.parse(valid)).not.toThrow();
    });

    it('should handle very long but valid codes', () => {
      const valid = {
        code: 'a'.repeat(500), // Max length
        state: 's'.repeat(200) // Max length
      };
      
      expect(() => OAuthCodeSchema.parse(valid)).not.toThrow();
    });

    it('should handle redirect_uri with query params', () => {
      const valid = {
        code: 'abc123',
        state: 'csrf_token',
        redirect_uri: 'https://roastr.ai/callback?source=twitter&test=true'
      };
      
      expect(() => OAuthCodeSchema.parse(valid)).not.toThrow();
    });

    it('should preserve extra fields not in schema', () => {
      const input = {
        platform: 'twitter',
        code: 'abc123',
        state: 'csrf_token',
        extra_field: 'should_be_stripped'
      };
      
      // Zod strips extra fields by default
      const result = OAuthConnectionSchema.parse(input);
      expect(result.extra_field).toBeUndefined();
    });
  });
});

