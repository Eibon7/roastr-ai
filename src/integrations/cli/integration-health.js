#!/usr/bin/env node

/**
 * Integration Health Check CLI Tool
 *
 * Checks the health status of all platform integrations
 */

const path = require('path');
const fs = require('fs');

// Define integration services
const integrations = [
  { name: 'Instagram', file: '../instagram/instagramService.js', env: 'ENABLED_INSTAGRAM' },
  { name: 'Facebook', file: '../facebook/facebookService.js', env: 'ENABLED_FACEBOOK' },
  { name: 'Discord', file: '../discord/discordService.js', env: 'ENABLED_DISCORD' },
  { name: 'Twitch', file: '../twitch/twitchService.js', env: 'ENABLED_TWITCH' },
  { name: 'Reddit', file: '../reddit/redditService.js', env: 'ENABLED_REDDIT' },
  { name: 'TikTok', file: '../tiktok/tiktokService.js', env: 'ENABLED_TIKTOK' },
  { name: 'Bluesky', file: '../bluesky/blueskyService.js', env: 'ENABLED_BLUESKY' }
];

async function checkIntegrationHealth() {
  console.log('🏥 Integration Health Check');
  console.log('='.repeat(50));
  console.log('');

  const results = {
    healthy: 0,
    unhealthy: 0,
    disabled: 0,
    total: integrations.length
  };

  for (const integration of integrations) {
    try {
      const isEnabled = process.env[integration.env] === 'true';
      const servicePath = path.join(__dirname, integration.file);
      const serviceExists = fs.existsSync(servicePath);

      let status = '❓';
      let statusText = 'Unknown';

      if (!serviceExists) {
        status = '❌';
        statusText = 'Service file not found';
        results.unhealthy++;
      } else if (!isEnabled) {
        status = '⏸️';
        statusText = 'Disabled';
        results.disabled++;
      } else {
        status = '✅';
        statusText = 'Enabled & Ready';
        results.healthy++;
      }

      console.log(`${status} ${integration.name.padEnd(12)} | ${statusText}`);
    } catch (error) {
      console.log(`❌ ${integration.name.padEnd(12)} | Error: ${error.message}`);
      results.unhealthy++;
    }
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`   ✅ Healthy:    ${results.healthy}/${results.total}`);
  console.log(`   ❌ Unhealthy:  ${results.unhealthy}/${results.total}`);
  console.log(`   ⏸️  Disabled:   ${results.disabled}/${results.total}`);
  console.log('');

  // Environment check
  console.log('🔧 Environment Configuration:');
  const envFile = path.join(__dirname, '../../../.env.example');
  const envExists = fs.existsSync(envFile);
  console.log(`   📄 .env.example: ${envExists ? '✅ Found' : '❌ Missing'}`);

  const currentDir = process.cwd();
  const userEnvFile = path.join(currentDir, '.env');
  const userEnvExists = fs.existsSync(userEnvFile);
  console.log(
    `   📄 .env:         ${userEnvExists ? '✅ Found' : '⚠️  Not found (copy from .env.example)'}`
  );

  console.log('');

  if (results.unhealthy > 0) {
    console.log('⚠️  Some integrations have issues. Check the status above.');
    process.exit(1);
  } else {
    console.log('🎉 All integrations are healthy or properly disabled!');
    process.exit(0);
  }
}

// Run the health check
if (require.main === module) {
  checkIntegrationHealth().catch((error) => {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  });
}

module.exports = { checkIntegrationHealth };
