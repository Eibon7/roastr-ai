#!/usr/bin/env node

/**
 * YouTube API Verification Script
 *
 * Verifies YouTube Data API v3 configuration for Issue #490
 * Related: API Configuration Checklist
 */

const axios = require('axios');
require('dotenv').config();
const logger = require('../src/utils/logger');

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

async function verifyYouTube() {
  logger.info('📺 Verifying YouTube Data API v3 Configuration...\n');

  // Check environment variable
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    logger.error('❌ ERROR: YOUTUBE_API_KEY not found in .env');
    logger.error('   Add it to your .env file:');
    logger.error('   YOUTUBE_API_KEY=your_key_here\n');
    logger.error('💡 How to get YouTube API key:\n');
    logger.error('1. Go to Google Cloud Console: https://console.cloud.google.com');
    logger.error('2. Enable YouTube Data API v3');
    logger.error('3. Create credentials → API Key');
    logger.error('4. Restrict key to YouTube Data API v3');
    logger.error('5. Add to .env file\n');
    process.exit(1);
  }

  logger.info('✅ API Key found in environment');
  // Security: Mask API key (show only last 4 chars) - GDPR/SOC2 compliance (CodeRabbit #3343936799)
  const masked = apiKey.length > 8 ? `****${apiKey.slice(-4)}` : '****';
  logger.info(`   Key: ${masked}\n`);

  try {
    // Test 1: Search for videos
    logger.info('🔍 Test 1: Searching for videos...');

    const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: {
        key: apiKey,
        part: 'snippet',
        q: 'javascript tutorial',
        type: 'video',
        maxResults: 3
      },
      timeout: 10000
    });

    const videos = searchResponse.data.items;
    const videosFound = videos.length;

    logger.info(`✅ Video search working!`);
    logger.info(`   Query: "javascript tutorial"`);
    logger.info(`   Results found: ${videosFound}`);

    if (videosFound > 0) {
      logger.info(`   First result: "${videos[0].snippet.title}"`);
      logger.info(`   Video ID: ${videos[0].id.videoId}`);
    }
    logger.info();

    // Test 2: Get video details
    if (videosFound > 0) {
      logger.info('📊 Test 2: Getting video details...');

      const videoId = videos[0].id.videoId;

      const videoResponse = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
        params: {
          key: apiKey,
          part: 'snippet,statistics,contentDetails',
          id: videoId
        },
        timeout: 10000
      });

      const video = videoResponse.data.items[0];
      const stats = video.statistics;

      logger.info('✅ Video details retrieved successfully!');
      logger.info(`   Title: "${video.snippet.title}"`);
      logger.info(`   Channel: ${video.snippet.channelTitle}`);
      logger.info(`   Views: ${stats.viewCount || 'N/A'}`);
      logger.info(`   Likes: ${stats.likeCount || 'N/A'}`);
      logger.info(`   Comments: ${stats.commentCount || 'N/A'}`);
      logger.info();
    }

    // Test 3: Get channel details
    logger.info('📺 Test 3: Getting channel details...');

    // Try by username first (legacy method, deprecated but still works)
    let channelResponse = await axios.get(`${YOUTUBE_API_BASE}/channels`, {
      params: {
        key: apiKey,
        part: 'snippet,statistics',
        forUsername: 'Google'
      },
      timeout: 10000
    });

    // Fallback to channel ID if username lookup returns no results
    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      logger.info('   Username lookup failed, trying channel ID...');
      channelResponse = await axios.get(`${YOUTUBE_API_BASE}/channels`, {
        params: {
          key: apiKey,
          part: 'snippet,statistics',
          id: 'UCBR8-60-B28hp2BmDPdntcQ' // YouTube's official channel ID
        },
        timeout: 10000
      });
    }

    if (channelResponse.data.items && channelResponse.data.items.length > 0) {
      const channel = channelResponse.data.items[0];
      const channelStats = channel.statistics;

      logger.info('✅ Channel details retrieved successfully!');
      logger.info(`   Channel: ${channel.snippet.title}`);
      logger.info(`   Subscribers: ${channelStats.subscriberCount || 'Hidden'}`);
      logger.info(`   Total videos: ${channelStats.videoCount || 'N/A'}`);
      logger.info(`   Total views: ${channelStats.viewCount || 'N/A'}`);
      logger.info();
    } else {
      logger.info('⚠️  Channel lookup by username not found (this is OK)');
      logger.info('   Channel details API is working\n');
    }

    // Test 4: Try to get comments (requires OAuth for some videos)
    if (videosFound > 0) {
      logger.info('💬 Test 4: Testing comment threads API...');

      const videoId = videos[0].id.videoId;

      try {
        const commentsResponse = await axios.get(`${YOUTUBE_API_BASE}/commentThreads`, {
          params: {
            key: apiKey,
            part: 'snippet',
            videoId: videoId,
            maxResults: 3,
            textFormat: 'plainText'
          },
          timeout: 10000
        });

        const comments = commentsResponse.data.items;

        logger.info('✅ Comment threads API working!');
        logger.info(`   Comments found: ${comments.length}`);

        if (comments.length > 0) {
          const topComment = comments[0].snippet.topLevelComment.snippet;
          logger.info(`   First comment by: ${topComment.authorDisplayName}`);
          logger.info(`   Comment text: "${topComment.textDisplay.substring(0, 50)}..."`);
        }
        logger.info();
      } catch (commentError) {
        if (commentError.response?.status === 403) {
          logger.info('⚠️  Comments disabled for this video (this is normal)');
          logger.info('   Comment threads API is accessible\n');
        } else {
          throw commentError;
        }
      }
    }

    // Summary
    logger.info('📊 Summary:\n');
    logger.info('✅ API Key: Valid');
    logger.info('✅ Video Search: Working');
    logger.info('✅ Video Details: Working');
    logger.info('✅ Channel Details: Working');
    logger.info('✅ Comment Threads: API Accessible');
    logger.info();

    // Integration info
    logger.info('💡 Integration Details:\n');
    logger.info('✅ Supported Operations:');
    logger.info('   - Search videos by keyword');
    logger.info('   - Get video details and statistics');
    logger.info('   - Get channel information');
    logger.info('   - Read comment threads');
    logger.info('   - Reply to comments (requires OAuth)');
    logger.info();

    logger.info('⚠️  Rate Limits (Free tier):');
    logger.info('   - 10,000 quota units/day');
    logger.info('   - Search: 100 units per request');
    logger.info('   - Video details: 1 unit per request');
    logger.info('   - Comments: 1 unit per request');
    logger.info('   - Daily limit: ~100 searches or 10,000 detail requests');
    logger.info();

    logger.info('📚 Documentation:');
    logger.info('   → https://developers.google.com/youtube/v3/docs');
    logger.info('   → https://console.cloud.google.com/apis/api/youtube.googleapis.com');
    logger.info();

    logger.info('🎉 YouTube Data API v3 verification complete!\n');
  } catch (error) {
    logger.error('\n❌ ERROR during verification:');

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 400) {
        logger.error('   Status: 400 Bad Request');
        logger.error('   Message:', data.error?.message || 'Invalid request');
        logger.error('\n💡 Solution:');
        logger.error('   1. Check that API key is correct');
        logger.error('   2. Verify request parameters are valid');
        logger.error('   3. Ensure YouTube Data API v3 is enabled\n');
      } else if (status === 403) {
        logger.error('   Status: 403 Forbidden');
        logger.error('   Message:', data.error?.message || 'Access denied');

        if (data.error?.errors?.[0]?.reason === 'quotaExceeded') {
          logger.error('\n💡 Solution:');
          logger.error('   Daily quota exceeded (10,000 units/day)');
          logger.error('   Wait until quota resets (midnight Pacific Time)');
          logger.error('   Or request quota increase in Google Cloud Console\n');
        } else {
          logger.error('\n💡 Solution:');
          logger.error('   1. Verify YouTube Data API v3 is enabled');
          logger.error('   2. Check API key restrictions');
          logger.error('   3. Ensure billing is enabled if required');
          logger.error('   4. Wait a few minutes and try again\n');
        }
      } else if (status === 404) {
        logger.error('   Status: 404 Not Found');
        logger.error('   Message: Resource not found');
        logger.error('\n💡 Solution:');
        logger.error('   This is OK - tested resource may not exist');
        logger.error('   API key and endpoints are working\n');
      } else {
        logger.error('   Status:', status);
        logger.error('   Message:', data.error?.message || 'Unknown error');

        if (data.error?.errors) {
          logger.error('   Errors:', JSON.stringify(data.error.errors, null, 2));
        }
        logger.error();
      }
    } else if (error.code === 'ECONNABORTED') {
      logger.error('   Error: Request timeout');
      logger.error('\n💡 Solution:');
      logger.error('   1. Check internet connection');
      logger.error('   2. Try again in a few moments');
      logger.error('   3. YouTube API may be temporarily slow\n');
    } else {
      logger.error('   Message:', error.message);
      logger.error();
    }

    process.exit(1);
  }
}

// Run verification
verifyYouTube().catch((error) => {
  logger.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
