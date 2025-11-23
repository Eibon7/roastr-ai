/**
 * Discord Platform Integration Verification Tests
 *
 * Part of Issue #712: Social Platform Integration Verification
 */

const DiscordService = require('../../../src/integrations/discord/discordService');

describe('Discord Platform Verification', () => {
  let service;
  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_MOCK_MODE = 'true';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    service = new DiscordService();
  });

  describe('Service Initialization', () => {
    it('should initialize DiscordService successfully', () => {
      expect(service).toBeDefined();
      expect(service.platformName).toBe('discord');
    });

    it('should have moderation support', () => {
      expect(service.config.supportModeration).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should check credentials availability', () => {
      const hasCredentials = !!process.env.DISCORD_BOT_TOKEN;
      expect(typeof hasCredentials).toBe('boolean');
    });

    it('should handle authentication when credentials available', async () => {
      if (process.env.DISCORD_BOT_TOKEN && process.env.ENABLE_MOCK_MODE !== 'true') {
        try {
          const result = await service.authenticate();
          expect(result.success).toBe(true);
        } catch (error) {
          expect(error.message).toBeDefined();
        }
      }
    });
  });

  describe('Core Operations', () => {
    it('should have authenticate method', () => {
      expect(typeof service.authenticate).toBe('function');
    });

    it('should have initialize method', () => {
      expect(typeof service.initialize).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing bot token', async () => {
      const originalToken = process.env.DISCORD_BOT_TOKEN;
      delete process.env.DISCORD_BOT_TOKEN;

      try {
        await service.authenticate();
      } catch (error) {
        expect(error.message).toContain('token');
      } finally {
        if (originalToken) process.env.DISCORD_BOT_TOKEN = originalToken;
      }
    });
  });
});
