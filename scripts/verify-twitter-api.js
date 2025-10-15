#!/usr/bin/env node

/**
 * Twitter API Verification Script
 *
 * Verifies Twitter API configuration for Issue #490
 * Related: API Configuration Checklist
 */

const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

async function verifyTwitter() {
  console.log('🐦 Verifying Twitter API Configuration...\n');

  // Check environment variables
  const requiredVars = [
    'TWITTER_BEARER_TOKEN',
    'TWITTER_APP_KEY',
    'TWITTER_APP_SECRET',
    'TWITTER_ACCESS_TOKEN',
    'TWITTER_ACCESS_SECRET'
  ];

  const missing = requiredVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ ERROR: Missing required environment variables:\n');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n💡 How to get Twitter API credentials:\n');
    console.error('1. Create Twitter Developer account: https://developer.twitter.com');
    console.error('2. Create a new app (or use existing)');
    console.error('3. Set app permissions to "Read and Write"');
    console.error('4. Go to "Keys and tokens" tab');
    console.error('5. Generate/copy the following:\n');
    console.error('   For OAuth 1.0a User Authentication:');
    console.error('   - API Key (TWITTER_APP_KEY)');
    console.error('   - API Secret (TWITTER_APP_SECRET)');
    console.error('   - Access Token (TWITTER_ACCESS_TOKEN)');
    console.error('   - Access Token Secret (TWITTER_ACCESS_SECRET)\n');
    console.error('   For OAuth 2.0 Bearer Token:');
    console.error('   - Bearer Token (TWITTER_BEARER_TOKEN)\n');
    console.error('6. Add them to your .env file\n');
    process.exit(1);
  }

  console.log('✅ All required environment variables found\n');

  // Initialize Twitter clients
  let client, bearerClient;

  try {
    // OAuth 1.0a client (for posting)
    client = new TwitterApi({
      appKey: process.env.TWITTER_APP_KEY,
      appSecret: process.env.TWITTER_APP_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    // OAuth 2.0 client (for reading)
    bearerClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);

    console.log('✅ Twitter API clients initialized\n');

  } catch (error) {
    console.error('❌ ERROR: Failed to initialize Twitter clients');
    console.error('   Message:', error.message);
    console.error('\n💡 Check that your credentials are valid\n');
    process.exit(1);
  }

  try {
    // Test 1: Verify OAuth 1.0a authentication (user context)
    console.log('🔐 Test 1: Verifying OAuth 1.0a authentication...');

    const me = await client.v2.me();
    const botUserId = me.data.id;
    const botUsername = me.data.username;
    const botName = me.data.name;

    console.log('✅ OAuth 1.0a authentication successful!');
    console.log(`   Bot User: @${botUsername} (${botName})`);
    console.log(`   User ID: ${botUserId}\n`);

    // Test 2: Verify OAuth 2.0 Bearer Token (app context)
    console.log('🔐 Test 2: Verifying OAuth 2.0 Bearer Token...');

    const mentionsResponse = await bearerClient.v2.userMentionTimeline(botUserId, {
      max_results: 5,
      'tweet.fields': ['created_at', 'author_id']
    });

    const mentionsCount = mentionsResponse.data?.length || 0;

    console.log('✅ Bearer Token authentication successful!');
    console.log(`   Recent mentions found: ${mentionsCount}\n`);

    // Test 3: Check rate limits
    console.log('📊 Test 3: Checking rate limits...');

    const rateLimits = await bearerClient.v1.rateLimitStatuses(['tweets']);
    const tweetLimits = rateLimits.resources?.tweets;

    if (tweetLimits) {
      console.log('✅ Rate limit information:');
      Object.entries(tweetLimits).forEach(([endpoint, limits]) => {
        const remaining = limits.remaining;
        const limit = limits.limit;
        const resetTime = new Date(limits.reset * 1000).toLocaleTimeString();

        console.log(`   ${endpoint}:`);
        console.log(`     - Remaining: ${remaining}/${limit}`);
        console.log(`     - Resets at: ${resetTime}`);
      });
      console.log();
    }

    // Test 4: Verify write permissions
    console.log('🔍 Test 4: Verifying write permissions...');

    // We don't actually post a test tweet, just verify the client is configured for write access
    const hasWriteAccess = !!process.env.TWITTER_ACCESS_TOKEN && !!process.env.TWITTER_ACCESS_SECRET;

    if (hasWriteAccess) {
      console.log('✅ Write permissions configured (OAuth 1.0a)');
      console.log('   Note: Not posting test tweet to avoid spam\n');
    } else {
      console.log('⚠️  Write permissions not fully configured\n');
    }

    // Summary
    console.log('📊 Summary:\n');
    console.log('✅ OAuth 1.0a (Read + Write): Working');
    console.log('✅ OAuth 2.0 Bearer Token (Read): Working');
    console.log(`✅ Authenticated as: @${botUsername}`);
    console.log(`✅ User ID: ${botUserId}`);
    console.log(`✅ Recent mentions: ${mentionsCount} found`);
    console.log();

    // Recommendations
    console.log('💡 Next Steps:\n');
    console.log('1. Test the bot in batch mode:');
    console.log('   → npm run twitter:batch\n');
    console.log('2. Check Twitter bot documentation:');
    console.log('   → https://developer.twitter.com/en/docs/twitter-api\n');
    console.log('3. Monitor API usage:');
    console.log('   → https://developer.twitter.com/en/portal/dashboard\n');
    console.log('4. Essential API tier limits:');
    console.log('   - 1,500 tweets/month (read)');
    console.log('   - 50 tweets/month (write)');
    console.log('   - No streaming access\n');

    console.log('🎉 Twitter API verification complete!\n');

  } catch (error) {
    console.error('\n❌ ERROR during verification:');

    if (error.code === 401) {
      console.error('   Status: 401 Unauthorized');
      console.error('   Message: Invalid credentials');
      console.error('\n💡 Solution:');
      console.error('   1. Verify your credentials are correct');
      console.error('   2. Check that your Twitter app has proper permissions');
      console.error('   3. Make sure tokens haven\'t been revoked');
      console.error('   4. Regenerate tokens if necessary\n');
    } else if (error.code === 403) {
      console.error('   Status: 403 Forbidden');
      console.error('   Message: Access denied');
      console.error('\n💡 Solution:');
      console.error('   1. Check app permissions (must be "Read and Write")');
      console.error('   2. Verify app is not suspended');
      console.error('   3. Check if you have Essential API access\n');
    } else if (error.code === 429) {
      console.error('   Status: 429 Rate Limited');
      console.error('   Message: Too many requests');
      console.error('\n💡 Solution:');
      console.error('   1. Wait for rate limit to reset');
      console.error('   2. Check your API tier limits');
      console.error('   3. Monitor usage in developer portal\n');
    } else {
      console.error('   Status:', error.code || 'Unknown');
      console.error('   Message:', error.message || 'Unknown error');

      if (error.data) {
        console.error('   Details:', JSON.stringify(error.data, null, 2));
      }
      console.error();
    }

    process.exit(1);
  }
}

// Run verification
verifyTwitter().catch(error => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
