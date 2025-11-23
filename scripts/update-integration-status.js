#!/usr/bin/env node

/**
 * Update Integration Status
 *
 * Checks platform adapters and credentials to update integration-status.json
 *
 * Part of GDD 2.0 Phase 15: Cross-Validation & Extended Health Metrics
 *
 * Usage:
 *   node scripts/update-integration-status.js
 *   node scripts/update-integration-status.js --verbose
 */

const fs = require('fs').promises;
const path = require('path');

class IntegrationStatusUpdater {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = path.resolve(__dirname, '..');
    this.statusFilePath = path.join(this.rootDir, 'integration-status.json');

    // Platform configuration
    this.platforms = [
      {
        name: 'twitter',
        adapter: 'src/integrations/twitter/twitterService.js',
        envVars: ['TWITTER_BEARER_TOKEN', 'TWITTER_APP_KEY', 'TWITTER_APP_SECRET'],
        relatedNodes: ['social-platforms', 'roast', 'shield']
      },
      {
        name: 'discord',
        adapter: 'src/integrations/discord/discordService.js',
        envVars: ['DISCORD_BOT_TOKEN'],
        relatedNodes: ['social-platforms', 'shield']
      },
      {
        name: 'twitch',
        adapter: 'src/integrations/twitch/twitchService.js',
        envVars: ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET'],
        relatedNodes: ['social-platforms', 'shield']
      },
      {
        name: 'youtube',
        adapter: 'src/integrations/youtube/youtubeService.js',
        envVars: ['YOUTUBE_API_KEY'],
        relatedNodes: ['social-platforms']
      },
      {
        name: 'instagram',
        adapter: 'src/integrations/instagram/instagramService.js',
        envVars: ['INSTAGRAM_ACCESS_TOKEN'],
        relatedNodes: ['social-platforms']
      },
      {
        name: 'facebook',
        adapter: 'src/integrations/facebook/facebookService.js',
        envVars: ['FACEBOOK_ACCESS_TOKEN'],
        relatedNodes: ['social-platforms']
      },
      {
        name: 'reddit',
        adapter: 'src/integrations/reddit/redditService.js',
        envVars: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'],
        relatedNodes: ['social-platforms']
      },
      {
        name: 'tiktok',
        adapter: 'src/integrations/tiktok/tiktokService.js',
        envVars: ['TIKTOK_CLIENT_KEY'],
        relatedNodes: ['social-platforms']
      },
      {
        name: 'bluesky',
        adapter: 'src/integrations/bluesky/blueskyService.js',
        envVars: ['BLUESKY_IDENTIFIER', 'BLUESKY_PASSWORD'],
        relatedNodes: ['social-platforms']
      }
    ];
  }

  /**
   * Update all integrations
   */
  async update() {
    try {
      if (this.options.verbose) {
        console.log('Checking integration status...\n');
      }

      const integrations = [];

      for (const platform of this.platforms) {
        const status = await this.checkPlatform(platform);
        integrations.push(status);

        if (this.options.verbose) {
          const statusEmoji =
            status.status === 'active' ? '✅' : status.status === 'inactive' ? '⚠️' : '❌';
          console.log(
            `${statusEmoji} ${platform.name}: ${status.status} (health: ${status.health_score})`
          );
        }
      }

      // Calculate summary
      const summary = {
        total: integrations.length,
        active: integrations.filter((i) => i.status === 'active').length,
        inactive: integrations.filter((i) => i.status === 'inactive').length,
        not_connected: integrations.filter((i) => i.status === 'not_connected').length,
        overall_health: this.calculateOverallHealth(integrations)
      };

      // Save to file
      const data = {
        last_updated: new Date().toISOString(),
        version: '1.0',
        integrations,
        summary
      };

      await fs.writeFile(this.statusFilePath, JSON.stringify(data, null, 2), 'utf-8');

      if (this.options.verbose) {
        console.log(`\n✅ Integration status updated: integration-status.json`);
        console.log(`Overall health: ${summary.overall_health.toFixed(1)}%`);
      }

      return data;
    } catch (error) {
      console.error(`❌ Failed to update integration status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check a single platform
   */
  async checkPlatform(platform) {
    const adapterExists = await this.checkAdapterExists(platform.adapter);
    const credentialsPresent = this.checkCredentials(platform.envVars);

    let status;
    let healthScore;

    if (adapterExists && credentialsPresent) {
      status = 'active';
      healthScore = this.calculatePlatformHealth(platform, true, true);
    } else if (adapterExists && !credentialsPresent) {
      status = 'inactive';
      healthScore = this.calculatePlatformHealth(platform, true, false);
    } else {
      status = 'not_connected';
      healthScore = 0;
    }

    return {
      name: platform.name,
      status,
      last_checked: new Date().toISOString().split('T')[0],
      related_nodes: platform.relatedNodes,
      health_score: healthScore,
      credentials_present: credentialsPresent,
      adapter_exists: adapterExists
    };
  }

  /**
   * Check if adapter file exists
   */
  async checkAdapterExists(adapterPath) {
    try {
      const fullPath = path.join(this.rootDir, adapterPath);
      await fs.access(fullPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if credentials are present
   */
  checkCredentials(envVars) {
    for (const envVar of envVars) {
      if (!process.env[envVar]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate platform health score
   */
  calculatePlatformHealth(platform, adapterExists, credentialsPresent) {
    let score = 0;

    if (adapterExists) {
      score += 40; // Base score for having adapter
    }

    if (credentialsPresent) {
      score += 60; // Credentials add significant value
    }

    // Bonus for critical platforms
    const criticalPlatforms = ['twitter', 'discord', 'youtube'];
    if (criticalPlatforms.includes(platform.name) && credentialsPresent) {
      score += 10; // Now reaches 100 for critical platforms with full setup
    }

    return Math.min(100, score);
  }

  /**
   * Calculate overall health
   */
  calculateOverallHealth(integrations) {
    if (integrations.length === 0) return 0;

    const totalHealth = integrations.reduce((sum, i) => sum + i.health_score, 0);
    return parseFloat((totalHealth / integrations.length).toFixed(1));
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v')
  };

  const updater = new IntegrationStatusUpdater(options);
  await updater.update();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { IntegrationStatusUpdater };
