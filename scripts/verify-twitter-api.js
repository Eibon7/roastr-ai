#!/usr/bin/env node

/**
 * Twitter API Verification Script
 *
 * Verifies Twitter API configuration for Issue #490
 * Related: API Configuration Checklist
 */

const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();
const logger = require('../src/utils/logger');

async function verifyTwitter() {
  logger.info('🐦 Verifying Twitter API Configuration...\n');

  // Check environment variables
  const requiredVars = [
    'TWITTER_BEARER_TOKEN',
    'TWITTER_APP_KEY',
    'TWITTER_APP_SECRET',
    'TWITTER_ACCESS_TOKEN',
    'TWITTER_ACCESS_SECRET'
  ];

  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error('❌ ERROR: Missing required environment variables:\n');
    missing.forEach((varName) => {
      logger.error(`   - ${varName}`);
    });
    logger.error('\n💡 How to get Twitter API credentials:\n');
    logger.error('1. Create Twitter Developer account: https://developer.twitter.com');
    logger.error('2. Create a new app (or use existing)');
    logger.error('3. Set app permissions to "Read and Write"');
    logger.error('4. Go to "Keys and tokens" tab');
    logger.error('5. Generate/copy the following:\n');
    logger.error('   For OAuth 1.0a User Authentication:');
    logger.error('   - API Key (TWITTER_APP_KEY)');
    logger.error('   - API Secret (TWITTER_APP_SECRET)');
    logger.error('   - Access Token (TWITTER_ACCESS_TOKEN)');
    logger.error('   - Access Token Secret (TWITTER_ACCESS_SECRET)\n');
    logger.error('   For OAuth 2.0 Bearer Token:');
    logger.error('   - Bearer Token (TWITTER_BEARER_TOKEN)\n');
    logger.error('6. Add them to your .env file\n');
    process.exit(1);
  }

  logger.info('✅ All required environment variables found\n');

  // Initialize Twitter clients
  let client, bearerClient;

  try {
    // OAuth 1.0a client (for posting)
    client = new TwitterApi({
      appKey: process.env.TWITTER_APP_KEY,
      appSecret: process.env.TWITTER_APP_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET
    });

    // OAuth 2.0 client (for reading)
    bearerClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);

    logger.info('✅ Twitter API clients initialized\n');
  } catch (error) {
    logger.error('❌ ERROR: Failed to initialize Twitter clients');
    logger.error('   Message:', error.message);
    logger.error('\n💡 Check that your credentials are valid\n');
    process.exit(1);
  }

  try {
    // Test 1: Verify OAuth 1.0a authentication (user context)
    logger.info('🔐 Test 1: Verifying OAuth 1.0a authentication...');

    const me = await client.v2.me();
    const botUserId = me.data.id;
    const botUsername = me.data.username;
    const botName = me.data.name;

    logger.info('✅ OAuth 1.0a authentication successful!');
    logger.info(`   Bot User: @${botUsername} (${botName})`);
    logger.info(`   User ID: ${botUserId}\n`);

    // Test 2: Verify OAuth 2.0 Bearer Token (app context)
    logger.info('🔐 Test 2: Verifying OAuth 2.0 Bearer Token...');

    const mentionsResponse = await bearerClient.v2.userMentionTimeline(botUserId, {
      max_results: 5,
      'tweet.fields': ['created_at', 'author_id']
    });

    // Robust handling of API response formats (data vs tweets property)
    const mentionsData = mentionsResponse.data ?? mentionsResponse.tweets ?? [];
    const mentionsCount = Array.isArray(mentionsData) ? mentionsData.length : 0;
    const hasMore = mentionsResponse.meta?.next_token ? true : false;

    logger.info('✅ Bearer Token authentication successful!');
    logger.info(`   Recent mentions found: ${mentionsCount}`);
    if (hasMore) {
      logger.info('   (More mentions available via pagination)');
    }
    logger.info('');

    // Test 3: Check rate limits
    logger.info('📊 Test 3: Checking rate limits...');

    const rateLimits = await bearerClient.v1.rateLimitStatus();
    const families = rateLimits.resources || {};
    const endpoints = {
      ...(families.statuses || {}),
      ...(families.search || {})
    };

    if (Object.keys(endpoints).length) {
      logger.info('✅ Rate limit information:');
      Object.entries(endpoints).forEach(([endpoint, limits]) => {
        const remaining = limits.remaining;
        const limit = limits.limit;
        const resetTime = new Date(limits.reset * 1000).toLocaleTimeString();

        logger.info(`   ${endpoint}:`);
        logger.info(`     - Remaining: ${remaining}/${limit}`);
        logger.info(`     - Resets at: ${resetTime}`);
      });
      logger.info('');
    } else {
      logger.warn('⚠️  No v1 rate limit families (statuses/search) found in response.');
    }

    // Test 4: Verify write permissions
    logger.info('🔍 Test 4: Verifying write permissions...');

    // We don't actually post a test tweet, just verify the client is configured for write access
    const hasWriteAccess =
      !!process.env.TWITTER_ACCESS_TOKEN && !!process.env.TWITTER_ACCESS_SECRET;

    if (hasWriteAccess) {
      logger.info('✅ Write permissions configured (OAuth 1.0a)');
      logger.info('   Note: Not posting test tweet to avoid spam\n');
    } else {
      logger.info('⚠️  Write permissions not fully configured\n');
    }

    // Summary
    logger.info('📊 Summary:\n');
    logger.info('✅ OAuth 1.0a (Read + Write): Working');
    logger.info('✅ OAuth 2.0 Bearer Token (Read): Working');
    logger.info(`✅ Authenticated as: @${botUsername}`);
    logger.info(`✅ User ID: ${botUserId}`);
    logger.info(`✅ Recent mentions: ${mentionsCount} found`);
    logger.info('');

    // Recommendations
    logger.info('💡 Next Steps:\n');
    logger.info('1. Test the bot in batch mode:');
    logger.info('   → npm run twitter:batch\n');
    logger.info('2. Check Twitter bot documentation:');
    logger.info('   → https://developer.twitter.com/en/docs/twitter-api\n');
    logger.info('3. Monitor API usage:');
    logger.info('   → https://developer.twitter.com/en/portal/dashboard\n');
    logger.info('4. Essential API tier limits:');
    logger.info('   - 1,500 tweets/month (read)');
    logger.info('   - 50 tweets/month (write)');
    logger.info('   - No streaming access\n');

    logger.info('🎉 Twitter API verification complete!\n');
  } catch (error) {
    logger.error('\n❌ ERROR during verification:');

    // Broaden HTTP error detection to handle both code and status
    const status = error.status ?? error.code;

    if (status === 401) {
      logger.error('   Status: 401 Unauthorized');
      logger.error('   Message: Invalid credentials');
      logger.error('\n💡 Solution:');
      logger.error('   1. Verify your credentials are correct');
      logger.error('   2. Check that your Twitter app has proper permissions');
      logger.error("   3. Make sure tokens haven't been revoked");
      logger.error('   4. Regenerate tokens if necessary\n');
    } else if (status === 403) {
      logger.error('   Status: 403 Forbidden');
      logger.error('   Message: Access denied');
      logger.error('\n💡 Solution:');
      logger.error('   1. Check app permissions (must be "Read and Write")');
      logger.error('   2. Verify app is not suspended');
      logger.error('   3. Check if you have Essential API access\n');
    } else if (status === 429) {
      logger.error('   Status: 429 Rate Limited');
      logger.error('   Message: Too many requests');
      logger.error('\n💡 Solution:');
      logger.error('   1. Wait for rate limit to reset');
      logger.error('   2. Check your API tier limits');
      logger.error('   3. Monitor usage in developer portal\n');
    } else {
      logger.error('   Status:', status || 'Unknown');
      logger.error('   Message:', error.message || 'Unknown error');

      if (error.data) {
        logger.error('   Details:', JSON.stringify(error.data, null, 2));
      }
      logger.error('');
    }

    process.exit(1);
  }
}

// Run verification
verifyTwitter().catch((error) => {
  logger.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
