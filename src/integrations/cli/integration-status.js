#!/usr/bin/env node

/**
 * Integration Status CLI Tool
 * 
 * Shows detailed status and configuration for all platform integrations
 */

const path = require('path');
const fs = require('fs');

// Integration configurations
const integrations = [
  { 
    name: 'Instagram', 
    platform: 'instagram',
    enabledEnv: 'ENABLED_INSTAGRAM',
    requiredEnvs: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET'],
    capabilities: ['Comment Fetching', 'Hide/Delete Moderation'],
    directPosting: false
  },
  { 
    name: 'Facebook', 
    platform: 'facebook',
    enabledEnv: 'ENABLED_FACEBOOK',
    requiredEnvs: ['FACEBOOK_ACCESS_TOKEN', 'FACEBOOK_PAGE_ACCESS_TOKEN', 'FACEBOOK_APP_ID'],
    capabilities: ['Full Posting', 'Comment Moderation', 'Page Management'],
    directPosting: true
  },
  { 
    name: 'Discord', 
    platform: 'discord',
    enabledEnv: 'ENABLED_DISCORD',
    requiredEnvs: ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID'],
    capabilities: ['Bot Integration', 'Full Moderation', 'Slash Commands'],
    directPosting: true
  },
  { 
    name: 'Twitch', 
    platform: 'twitch',
    enabledEnv: 'ENABLED_TWITCH',
    requiredEnvs: ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'TWITCH_ACCESS_TOKEN'],
    capabilities: ['Chat Monitoring', 'Moderation Tools', 'OAuth Integration'],
    directPosting: true
  },
  { 
    name: 'Reddit', 
    platform: 'reddit',
    enabledEnv: 'ENABLED_REDDIT',
    requiredEnvs: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USERNAME'],
    capabilities: ['Comment Monitoring', 'Manual Review Workflow'],
    directPosting: false
  },
  { 
    name: 'TikTok', 
    platform: 'tiktok',
    enabledEnv: 'ENABLED_TIKTOK',
    requiredEnvs: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_ACCESS_TOKEN'],
    capabilities: ['Comment Fetching', 'Manual Review Workflow'],
    directPosting: false
  },
  { 
    name: 'Bluesky', 
    platform: 'bluesky',
    enabledEnv: 'ENABLED_BLUESKY',
    requiredEnvs: ['BLUESKY_IDENTIFIER', 'BLUESKY_PASSWORD'],
    capabilities: ['AT Protocol Integration', 'Direct Posting', 'Real-time Monitoring'],
    directPosting: true
  }
];

function getIntegrationStatus() {
  console.log('📊 Integration Status Report');
  console.log('=' .repeat(60));
  console.log('');

  const summary = {
    total: integrations.length,
    enabled: 0,
    disabled: 0,
    configuredProperly: 0,
    missingConfig: 0
  };

  integrations.forEach((integration, index) => {
    const isEnabled = process.env[integration.enabledEnv] === 'true';
    const configStatus = checkConfiguration(integration.requiredEnvs);
    
    // Update summary
    if (isEnabled) summary.enabled++;
    else summary.disabled++;
    
    if (configStatus.complete) summary.configuredProperly++;
    else summary.missingConfig++;

    // Display integration details
    console.log(`${index + 1}. ${integration.name}`);
    console.log('   ' + '-'.repeat(20));
    console.log(`   Status:      ${isEnabled ? '🟢 Enabled' : '🔴 Disabled'}`);
    console.log(`   Platform:    ${integration.platform}`);
    console.log(`   Direct Post: ${integration.directPosting ? '✅ Yes' : '📝 Manual Review'}`);
    
    // Configuration status
    if (isEnabled) {
      console.log(`   Config:      ${configStatus.complete ? '✅ Complete' : '⚠️  Incomplete'}`);
      
      if (!configStatus.complete) {
        console.log(`   Missing:     ${configStatus.missing.join(', ')}`);
      }
    } else {
      console.log('   Config:      ⏸️  Not checked (disabled)');
    }
    
    // Capabilities
    console.log(`   Features:    ${integration.capabilities.join(', ')}`);
    console.log('');
  });

  // Summary
  console.log('📈 Summary:');
  console.log(`   Total Integrations:    ${summary.total}`);
  console.log(`   🟢 Enabled:            ${summary.enabled}`);
  console.log(`   🔴 Disabled:           ${summary.disabled}`);
  console.log(`   ✅ Properly Configured: ${summary.configuredProperly}`);
  console.log(`   ⚠️  Missing Config:     ${summary.missingConfig}`);
  console.log('');

  // Architecture overview
  console.log('🏗️  Architecture:');
  console.log('   • Multi-tenant base integration class');
  console.log('   • Unified queue system integration');
  console.log('   • Cost control and usage tracking');
  console.log('   • Shield moderation system integration');
  console.log('   • Environment-based enable/disable flags');
  console.log('');

  // Quick start guide
  if (summary.disabled > 0 || summary.missingConfig > 0) {
    console.log('🚀 Quick Start:');
    console.log('   1. Copy .env.example to .env');
    console.log('   2. Configure API credentials for desired platforms');
    console.log('   3. Set ENABLED_[PLATFORM]=true for platforms to activate');
    console.log('   4. Run npm run integrations:health to verify setup');
    console.log('');
  }

  return summary;
}

function checkConfiguration(requiredEnvs) {
  const missing = [];
  
  for (const envVar of requiredEnvs) {
    if (!process.env[envVar] || process.env[envVar].trim() === '') {
      missing.push(envVar);
    }
  }
  
  return {
    complete: missing.length === 0,
    missing: missing
  };
}

function showPlatformDetails(platformName) {
  const integration = integrations.find(i => 
    i.name.toLowerCase() === platformName.toLowerCase() || 
    i.platform === platformName.toLowerCase()
  );
  
  if (!integration) {
    console.log(`❌ Platform '${platformName}' not found.`);
    console.log(`Available platforms: ${integrations.map(i => i.platform).join(', ')}`);
    return;
  }
  
  console.log(`📱 ${integration.name} Integration Details`);
  console.log('=' .repeat(40));
  console.log('');
  console.log(`Platform ID:     ${integration.platform}`);
  console.log(`Direct Posting:  ${integration.directPosting ? 'Yes' : 'Manual Review Required'}`);
  console.log('');
  console.log('Required Environment Variables:');
  integration.requiredEnvs.forEach(env => {
    const isSet = process.env[env] && process.env[env].trim() !== '';
    console.log(`   ${isSet ? '✅' : '❌'} ${env}`);
  });
  console.log('');
  console.log('Platform Capabilities:');
  integration.capabilities.forEach(capability => {
    console.log(`   • ${capability}`);
  });
  console.log('');
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    const command = args[0].toLowerCase();
    
    switch (command) {
      case 'platform':
      case 'detail':
        if (args[1]) {
          showPlatformDetails(args[1]);
        } else {
          console.log('Usage: npm run integrations:status platform <platform-name>');
          console.log(`Available platforms: ${integrations.map(i => i.platform).join(', ')}`);
        }
        break;
      
      case 'help':
        console.log('Integration Status Tool Usage:');
        console.log('');
        console.log('npm run integrations:status           - Show full status report');
        console.log('npm run integrations:status platform <name> - Show platform details');
        console.log('npm run integrations:status help     - Show this help');
        break;
      
      default:
        console.log(`Unknown command: ${command}`);
        console.log('Run: npm run integrations:status help');
    }
  } else {
    getIntegrationStatus();
  }
}

module.exports = { getIntegrationStatus, showPlatformDetails };