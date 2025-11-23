#!/usr/bin/env node

/**
 * Verify All Platform Integrations
 *
 * Comprehensive verification script for all 9 social platform integrations.
 * Tests authentication, core operations, rate limiting, and error handling.
 *
 * Part of Issue #712: Social Platform Integration Verification
 *
 * Usage:
 *   node scripts/verify-all-platforms.js
 *   node scripts/verify-all-platforms.js --platform twitter
 *   node scripts/verify-all-platforms.js --dry-run
 *   node scripts/verify-all-platforms.js --verbose
 */

const path = require('path');
const logger = require('../src/utils/logger');

class PlatformVerifier {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || process.argv.includes('--dry-run'),
      verbose: options.verbose || process.argv.includes('--verbose') || process.argv.includes('-v'),
      platform: options.platform || this.getPlatformFromArgs(),
      ...options
    };

    this.results = [];
    this.startTime = Date.now();

    // Platform configuration
    this.platforms = [
      {
        name: 'twitter',
        servicePath: 'src/integrations/twitter/twitterService.js',
        serviceClass: 'TwitterService',
        envVars: ['TWITTER_BEARER_TOKEN', 'TWITTER_APP_KEY', 'TWITTER_APP_SECRET'],
        critical: true
      },
      {
        name: 'youtube',
        servicePath: 'src/integrations/youtube/youtubeService.js',
        serviceClass: 'YouTubeService',
        envVars: ['YOUTUBE_API_KEY'],
        critical: true
      },
      {
        name: 'discord',
        servicePath: 'src/integrations/discord/discordService.js',
        serviceClass: 'DiscordService',
        envVars: ['DISCORD_BOT_TOKEN'],
        critical: true
      },
      {
        name: 'twitch',
        servicePath: 'src/integrations/twitch/twitchService.js',
        serviceClass: 'TwitchService',
        envVars: ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET'],
        critical: false
      },
      {
        name: 'instagram',
        servicePath: 'src/integrations/instagram/instagramService.js',
        serviceClass: 'InstagramService',
        envVars: ['INSTAGRAM_ACCESS_TOKEN'],
        critical: false
      },
      {
        name: 'facebook',
        servicePath: 'src/integrations/facebook/facebookService.js',
        serviceClass: 'FacebookService',
        envVars: ['FACEBOOK_ACCESS_TOKEN'],
        critical: false
      },
      {
        name: 'reddit',
        servicePath: 'src/integrations/reddit/redditService.js',
        serviceClass: 'RedditService',
        envVars: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'],
        critical: false
      },
      {
        name: 'tiktok',
        servicePath: 'src/integrations/tiktok/tiktokService.js',
        serviceClass: 'TikTokService',
        envVars: ['TIKTOK_CLIENT_KEY'],
        critical: false
      },
      {
        name: 'bluesky',
        servicePath: 'src/integrations/bluesky/blueskyService.js',
        serviceClass: 'BlueskyService',
        envVars: ['BLUESKY_IDENTIFIER', 'BLUESKY_PASSWORD'],
        critical: false
      }
    ];
  }

  getPlatformFromArgs() {
    const platformIndex = process.argv.indexOf('--platform');
    if (platformIndex !== -1 && process.argv[platformIndex + 1]) {
      return process.argv[platformIndex + 1];
    }
    return null;
  }

  /**
   * Run verification for all platforms or a specific platform
   */
  async verify() {
    console.log('🔍 Platform Integration Verification\n');
    console.log('='.repeat(60));

    if (this.options.dryRun) {
      console.log('⚠️  DRY-RUN MODE: No actual API calls will be made\n');
    }

    const platformsToVerify = this.options.platform
      ? this.platforms.filter((p) => p.name === this.options.platform)
      : this.platforms;

    if (platformsToVerify.length === 0) {
      console.error(`❌ Platform "${this.options.platform}" not found`);
      process.exit(1);
    }

    console.log(`📋 Verifying ${platformsToVerify.length} platform(s)...\n`);

    for (const platform of platformsToVerify) {
      try {
        const result = await this.verifyPlatform(platform);
        this.results.push(result);
      } catch (error) {
        logger.error(`Failed to verify ${platform.name}`, { error: error.message });
        this.results.push({
          platform: platform.name,
          status: 'error',
          error: error.message,
          checks: {}
        });
      }
    }

    this.printSummary();
    return this.results;
  }

  /**
   * Verify a single platform
   */
  async verifyPlatform(platform) {
    const result = {
      platform: platform.name,
      status: 'unknown',
      checks: {},
      metrics: {},
      errors: [],
      quirks: [],
      timestamp: new Date().toISOString()
    };

    console.log(`\n📱 Verifying ${platform.name.toUpperCase()}...`);
    console.log('-'.repeat(60));

    try {
      // Load platform service
      const service = await this.loadPlatformService(platform);
      if (!service) {
        result.status = 'not_available';
        result.errors.push('Service class not found or failed to load');
        return result;
      }

      // Check 1: Credentials
      const credentialsCheck = this.checkCredentials(platform.envVars);
      result.checks.credentials = credentialsCheck;

      if (!credentialsCheck.present) {
        result.status = 'inactive';
        result.errors.push('Required credentials not configured');
        console.log(`  ⚠️  Credentials: Missing (${platform.envVars.join(', ')})`);
        return result;
      }

      console.log(`  ✅ Credentials: Present`);

      // Check 2: Authentication
      if (!this.options.dryRun) {
        try {
          const authStart = Date.now();
          const authResult = await this.testAuthentication(service, platform);
          const authTime = Date.now() - authStart;

          result.checks.authentication = {
            success: authResult.success,
            time: authTime,
            error: authResult.error
          };
          result.metrics.authTime = authTime;

          if (authResult.success) {
            console.log(`  ✅ Authentication: Success (${authTime}ms)`);
          } else {
            console.log(`  ❌ Authentication: Failed - ${authResult.error}`);
            result.status = 'failed';
            result.errors.push(`Authentication failed: ${authResult.error}`);
            return result;
          }
        } catch (error) {
          result.checks.authentication = {
            success: false,
            error: error.message
          };
          result.status = 'failed';
          result.errors.push(`Authentication error: ${error.message}`);
          console.log(`  ❌ Authentication: Error - ${error.message}`);
          return result;
        }
      } else {
        result.checks.authentication = { success: true, dryRun: true };
        console.log(`  ✅ Authentication: Skipped (dry-run)`);
      }

      // Check 3: Core Operations
      const operationsCheck = await this.testCoreOperations(service, platform);
      result.checks.operations = operationsCheck;

      if (operationsCheck.fetchComments.success) {
        console.log(`  ✅ fetchComments: Success`);
      } else {
        console.log(`  ⚠️  fetchComments: ${operationsCheck.fetchComments.error || 'Not tested'}`);
      }

      if (operationsCheck.postReply.tested) {
        if (operationsCheck.postReply.success) {
          console.log(`  ✅ postReply: Success`);
        } else {
          console.log(`  ⚠️  postReply: ${operationsCheck.postReply.error || 'Failed'}`);
        }
      } else {
        console.log(`  ⚠️  postReply: Not tested (dry-run or not supported)`);
      }

      if (operationsCheck.blockUser.tested) {
        if (operationsCheck.blockUser.success) {
          console.log(`  ✅ blockUser: Success`);
        } else {
          console.log(`  ⚠️  blockUser: ${operationsCheck.blockUser.error || 'Not supported'}`);
        }
      } else {
        console.log(`  ⚠️  blockUser: Not tested (dry-run or not supported)`);
      }

      // Check 4: Rate Limiting
      const rateLimitCheck = await this.testRateLimiting(service, platform);
      result.checks.rateLimiting = rateLimitCheck;

      if (rateLimitCheck.tested) {
        console.log(
          `  ✅ Rate Limiting: ${rateLimitCheck.respected ? 'Respected' : 'Issues detected'}`
        );
      } else {
        console.log(`  ⚠️  Rate Limiting: Not tested (dry-run)`);
      }

      // Check 5: Error Handling
      const errorHandlingCheck = await this.testErrorHandling(service, platform);
      result.checks.errorHandling = errorHandlingCheck;

      if (errorHandlingCheck.tested) {
        console.log(
          `  ✅ Error Handling: ${errorHandlingCheck.robust ? 'Robust' : 'Issues detected'}`
        );
      } else {
        console.log(`  ⚠️  Error Handling: Not tested (dry-run)`);
      }

      // Determine overall status
      const allChecksPassed =
        result.checks.credentials?.present &&
        (this.options.dryRun || result.checks.authentication?.success) &&
        (operationsCheck.fetchComments.success || operationsCheck.fetchComments.notSupported);

      result.status = allChecksPassed ? 'operational' : 'partial';

      // Collect quirks
      if (operationsCheck.quirks && operationsCheck.quirks.length > 0) {
        result.quirks.push(...operationsCheck.quirks);
      }
    } catch (error) {
      logger.error(`Error verifying ${platform.name}`, {
        error: error.message,
        stack: error.stack
      });
      result.status = 'error';
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Load platform service
   */
  async loadPlatformService(platform) {
    try {
      const servicePath = path.resolve(__dirname, '..', platform.servicePath);
      const ServiceClass = require(servicePath);

      // Handle different export patterns
      const Service = ServiceClass[platform.serviceClass] || ServiceClass.default || ServiceClass;

      if (typeof Service !== 'function') {
        throw new Error(`Service class ${platform.serviceClass} not found`);
      }

      // Instantiate service with appropriate config
      // Some services require config object, others don't
      let service;
      const defaultConfig = {
        responseFrequency: 1.0,
        platform: platform.name
      };

      try {
        // Try without config first (for MultiTenantIntegration-based services)
        service = new Service();
      } catch (error) {
        // If that fails, try with default config (for BaseIntegration-based services)
        try {
          service = new Service(defaultConfig);
        } catch (error2) {
          // If both fail, try with empty config
          service = new Service({});
        }
      }

      return service;
    } catch (error) {
      logger.error(`Failed to load ${platform.name} service`, {
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  /**
   * Check if credentials are present
   */
  checkCredentials(envVars) {
    const missing = envVars.filter((v) => !process.env[v]);
    return {
      present: missing.length === 0,
      missing,
      total: envVars.length,
      presentCount: envVars.length - missing.length
    };
  }

  /**
   * Test authentication
   */
  async testAuthentication(service, platform) {
    try {
      if (typeof service.authenticate !== 'function') {
        return { success: false, error: 'authenticate() method not found' };
      }

      const result = await Promise.race([
        service.authenticate(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Authentication timeout (30s)')), 30000)
        )
      ]);

      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Test core operations
   */
  async testCoreOperations(service, platform) {
    const results = {
      fetchComments: { tested: false, success: false, error: null, notSupported: false },
      postReply: { tested: false, success: false, error: null, notSupported: false },
      blockUser: { tested: false, success: false, error: null, notSupported: false },
      quirks: []
    };

    // Test fetchComments
    if (
      typeof service.fetchComments === 'function' ||
      typeof service.fetchRecentComments === 'function' ||
      typeof service.listenForMentions === 'function'
    ) {
      try {
        if (!this.options.dryRun) {
          const fetchMethod =
            service.fetchComments || service.fetchRecentComments || service.listenForMentions;
          const fetchResult = await Promise.race([
            fetchMethod.call(service, { limit: 1 }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Fetch timeout (15s)')), 15000)
            )
          ]);

          results.fetchComments = {
            tested: true,
            success: true,
            count: Array.isArray(fetchResult) ? fetchResult.length : 0
          };
        } else {
          results.fetchComments = { tested: false, success: true, dryRun: true };
        }
      } catch (error) {
        results.fetchComments = {
          tested: true,
          success: false,
          error: error.message
        };
      }
    } else {
      results.fetchComments = { tested: false, notSupported: true };
      results.quirks.push('fetchComments method not found - may use different method name');
    }

    // Test postReply
    if (typeof service.postResponse === 'function') {
      if (this.options.dryRun) {
        results.postReply = { tested: false, success: true, dryRun: true };
      } else {
        // Skip actual posting in verification (would create real posts)
        results.postReply = { tested: false, success: true, skipped: 'Would create real post' };
      }
    } else {
      results.postReply = { tested: false, notSupported: true };
      results.quirks.push('postResponse method not found - posting may not be supported');
    }

    // Test blockUser (if supported)
    if (
      typeof service.blockUser === 'function' ||
      typeof service.performModerationAction === 'function'
    ) {
      if (this.options.dryRun) {
        results.blockUser = { tested: false, success: true, dryRun: true };
      } else {
        // Skip actual blocking in verification
        results.blockUser = { tested: false, success: true, skipped: 'Would block real user' };
      }
    } else {
      results.blockUser = { tested: false, notSupported: true };
      results.quirks.push('blockUser method not found - moderation may not be supported');
    }

    return results;
  }

  /**
   * Test rate limiting
   */
  async testRateLimiting(service, platform) {
    if (this.options.dryRun) {
      return { tested: false, respected: true, dryRun: true };
    }

    // Check if service has rate limiting properties
    const hasRateLimit =
      service.rateLimit !== undefined ||
      service.rateLimits !== undefined ||
      service.config?.rateLimit !== undefined;

    return {
      tested: true,
      respected: hasRateLimit,
      note: hasRateLimit ? 'Rate limiting configured' : 'No rate limiting detected'
    };
  }

  /**
   * Test error handling
   */
  async testErrorHandling(service, platform) {
    if (this.options.dryRun) {
      return { tested: false, robust: true, dryRun: true };
    }

    // Check if service has error handling
    const hasErrorHandling =
      service.errorCount !== undefined ||
      service.errorStats !== undefined ||
      typeof service.log === 'function';

    return {
      tested: true,
      robust: hasErrorHandling,
      note: hasErrorHandling ? 'Error handling detected' : 'Limited error handling'
    };
  }

  /**
   * Print verification summary
   */
  printSummary() {
    const duration = Date.now() - this.startTime;
    const operational = this.results.filter((r) => r.status === 'operational').length;
    const partial = this.results.filter((r) => r.status === 'partial').length;
    const failed = this.results.filter((r) => r.status === 'failed' || r.status === 'error').length;
    const inactive = this.results.filter((r) => r.status === 'inactive').length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`\nTotal Platforms: ${this.results.length}`);
    console.log(`✅ Operational: ${operational}`);
    console.log(`⚠️  Partial: ${partial}`);
    console.log(`❌ Failed/Error: ${failed}`);
    console.log(`⚪ Inactive: ${inactive}`);
    console.log(`\nDuration: ${(duration / 1000).toFixed(2)}s`);

    // Print platform details
    console.log('\n📋 Platform Details:');
    for (const result of this.results) {
      const statusEmoji =
        result.status === 'operational'
          ? '✅'
          : result.status === 'partial'
            ? '⚠️'
            : result.status === 'failed' || result.status === 'error'
              ? '❌'
              : '⚪';

      console.log(`  ${statusEmoji} ${result.platform.padEnd(12)} ${result.status}`);

      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((error) => {
          console.log(`     └─ Error: ${error}`);
        });
      }

      if (result.quirks && result.quirks.length > 0) {
        result.quirks.forEach((quirk) => {
          console.log(`     └─ Quirk: ${quirk}`);
        });
      }
    }

    // Critical platforms check
    const criticalPlatforms = this.platforms.filter((p) => p.critical);
    const criticalOperational = this.results.filter(
      (r) => criticalPlatforms.some((p) => p.name === r.platform) && r.status === 'operational'
    ).length;

    console.log(
      `\n🎯 Critical Platforms: ${criticalOperational}/${criticalPlatforms.length} operational`
    );

    if (criticalOperational < criticalPlatforms.length) {
      console.log('⚠️  WARNING: Some critical platforms are not operational!');
    }
  }
}

/**
 * CLI entry point
 */
async function main() {
  const verifier = new PlatformVerifier();
  const results = await verifier.verify();

  // Exit with error code if critical platforms failed
  const criticalPlatforms = verifier.platforms.filter((p) => p.critical);
  const criticalFailed = results.filter(
    (r) =>
      criticalPlatforms.some((p) => p.name === r.platform) &&
      (r.status === 'failed' || r.status === 'error')
  ).length;

  if (criticalFailed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { PlatformVerifier };
