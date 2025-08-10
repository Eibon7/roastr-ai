/**
 * Integration Services Tests
 * 
 * Basic tests for all social media platform integrations
 */

const path = require('path');
const fs = require('fs');

describe('Platform Integrations', () => {
  const integrationsPath = path.join(__dirname, '../../../src/integrations');
  
  const expectedIntegrations = [
    'instagram/instagramService.js',
    'facebook/facebookService.js', 
    'discord/discordService.js',
    'twitch/twitchService.js',
    'reddit/redditService.js',
    'tiktok/tiktokService.js',
    'bluesky/blueskyService.js'
  ];
  
  describe('Integration Files', () => {
    test('should have all required integration files', () => {
      expectedIntegrations.forEach(integration => {
        const integrationPath = path.join(integrationsPath, integration);
        expect(fs.existsSync(integrationPath)).toBe(true);
      });
    });
    
    test('should have base integration classes', () => {
      const baseFiles = [
        'base/MultiTenantIntegration.js',
        'base/BaseIntegration.js'
      ];
      
      baseFiles.forEach(baseFile => {
        const basePath = path.join(integrationsPath, baseFile);
        expect(fs.existsSync(basePath)).toBe(true);
      });
    });
  });
  
  describe('Integration Class Structure', () => {
    test('should export valid integration classes', () => {
      // Test a few key integrations without actually instantiating them
      const testIntegrations = [
        '../../../src/integrations/instagram/instagramService',
        '../../../src/integrations/facebook/facebookService'
      ];
      
      testIntegrations.forEach(integrationPath => {
        expect(() => {
          const IntegrationClass = require(integrationPath);
          expect(typeof IntegrationClass).toBe('function');
        }).not.toThrow();
      });
    });
  });
  
  describe('Environment Configuration', () => {
    test('should have environment variables defined for all platforms', () => {
      // Skip in CI environment - these tests require specific environment setup
      if (process.env.SKIP_E2E === 'true' || process.env.CI === 'true') {
        console.log('⏭️ Skipping environment configuration test in CI mode');
        return;
      }
      
      const requiredEnvFlags = [
        'ENABLED_INSTAGRAM',
        'ENABLED_FACEBOOK', 
        'ENABLED_DISCORD',
        'ENABLED_TWITCH',
        'ENABLED_REDDIT',
        'ENABLED_TIKTOK',
        'ENABLED_BLUESKY'
      ];
      
      // Check that environment flags can be read (they may be undefined, which is ok)
      requiredEnvFlags.forEach(flag => {
        expect(typeof process.env[flag]).toBe('string');
      });
    });
    
    test('should have .env.example file with all required variables', () => {
      const envExamplePath = path.join(__dirname, '../../../.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);
      
      const envContent = fs.readFileSync(envExamplePath, 'utf8');
      
      const requiredVars = [
        'ENABLED_INSTAGRAM',
        'ENABLED_FACEBOOK',
        'ENABLED_DISCORD',
        'ENABLED_TWITCH',
        'ENABLED_REDDIT',
        'ENABLED_TIKTOK',
        'ENABLED_BLUESKY',
        'INSTAGRAM_ACCESS_TOKEN',
        'FACEBOOK_ACCESS_TOKEN', 
        'DISCORD_BOT_TOKEN',
        'TWITCH_CLIENT_ID',
        'REDDIT_CLIENT_ID',
        'TIKTOK_CLIENT_KEY',
        'BLUESKY_IDENTIFIER'
      ];
      
      requiredVars.forEach(envVar => {
        expect(envContent).toContain(envVar);
      });
    });
  });
  
  describe('Integration Features', () => {
    test('should have consistent platform naming', () => {
      const platformNames = [
        'instagram',
        'facebook', 
        'discord',
        'twitch',
        'reddit',
        'tiktok',
        'bluesky'
      ];
      
      platformNames.forEach(platform => {
        const servicePath = path.join(integrationsPath, platform, `${platform}Service.js`);
        expect(fs.existsSync(servicePath)).toBe(true);
      });
    });
    
    test('should have proper file sizes indicating implementation', () => {
      expectedIntegrations.forEach(integration => {
        const integrationPath = path.join(integrationsPath, integration);
        if (fs.existsSync(integrationPath)) {
          const stats = fs.statSync(integrationPath);
          // Each integration should have substantial implementation (>5KB)
          expect(stats.size).toBeGreaterThan(5000);
        }
      });
    });
  });
  
  describe('Package Dependencies', () => {
    test('should have required dependencies for integrations', () => {
      const packagePath = path.join(__dirname, '../../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const requiredDeps = [
        'axios',
        'discord.js',
        'snoowrap', // Reddit
        '@twurple/api', // Twitch
        '@twurple/auth' // Twitch
      ];
      
      requiredDeps.forEach(dep => {
        expect(packageJson.dependencies[dep]).toBeDefined();
      });
    });
    
    test('should have integration-specific scripts in package.json', () => {
      const packagePath = path.join(__dirname, '../../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const expectedScripts = [
        'integrations:health',
        'integrations:status',
        'integrations:test',
        'test:integrations'
      ];
      
      expectedScripts.forEach(script => {
        expect(packageJson.scripts[script]).toBeDefined();
      });
    });
  });
  
  describe('Integration Capabilities Summary', () => {
    test('should report implementation statistics', () => {
      const stats = {
        totalIntegrations: expectedIntegrations.length,
        implementedIntegrations: 0,
        totalFileSize: 0
      };
      
      expectedIntegrations.forEach(integration => {
        const integrationPath = path.join(integrationsPath, integration);
        if (fs.existsSync(integrationPath)) {
          stats.implementedIntegrations++;
          const fileStats = fs.statSync(integrationPath);
          stats.totalFileSize += fileStats.size;
        }
      });
      
      console.log('🔗 Integration Implementation Summary');
      console.log('═'.repeat(50));
      console.log(`📱 Total Platforms: ${stats.totalIntegrations}`);
      console.log(`✅ Implemented: ${stats.implementedIntegrations}`);
      console.log(`💾 Total Code Size: ${(stats.totalFileSize / 1024).toFixed(1)}KB`);
      console.log('');
      console.log('🎯 Platform Features:');
      console.log('   • Instagram: Comment fetching, Hide/Delete moderation');
      console.log('   • Facebook: Full posting + moderation capabilities');
      console.log('   • Discord: Bot integration with full moderation');
      console.log('   • Twitch: Chat monitoring + moderation tools');
      console.log('   • Reddit: Comment monitoring (no direct posting)');
      console.log('   • TikTok: Comment fetching (manual review)');
      console.log('   • Bluesky: AT Protocol integration');
      console.log('');
      console.log('🔧 Architecture:');
      console.log('   • Multi-tenant base integration class');
      console.log('   • Unified queue system integration');
      console.log('   • Cost control and usage tracking');
      console.log('   • Shield moderation system integration');
      console.log('   • Environment-based enable/disable flags');
      
      // Assertions
      expect(stats.implementedIntegrations).toBeGreaterThanOrEqual(6);
      expect(stats.totalFileSize).toBeGreaterThan(50000); // At least 50KB of code
    });
  });
});

// Mock integrations for testing without requiring actual API credentials
beforeAll(() => {
  // Set test environment variables
  process.env.ENABLED_INSTAGRAM = 'false';
  process.env.ENABLED_FACEBOOK = 'false';
  process.env.ENABLED_DISCORD = 'false';
  process.env.ENABLED_TWITCH = 'false';
  process.env.ENABLED_REDDIT = 'false';
  process.env.ENABLED_TIKTOK = 'false';
  process.env.ENABLED_BLUESKY = 'false';
});

afterAll(() => {
  // Clean up test environment
  delete process.env.ENABLED_INSTAGRAM;
  delete process.env.ENABLED_FACEBOOK;
  delete process.env.ENABLED_DISCORD;
  delete process.env.ENABLED_TWITCH;
  delete process.env.ENABLED_REDDIT;
  delete process.env.ENABLED_TIKTOK;
  delete process.env.ENABLED_BLUESKY;
});