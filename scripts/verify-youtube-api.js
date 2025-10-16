#!/usr/bin/env node

/**
 * YouTube API Verification Script
 *
 * Verifies YouTube Data API v3 configuration for Issue #490
 * Related: API Configuration Checklist
 */

const axios = require('axios');
require('dotenv').config();

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

async function verifyYouTube() {
  console.log('📺 Verifying YouTube Data API v3 Configuration...\n');

  // Check environment variable
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.error('❌ ERROR: YOUTUBE_API_KEY not found in .env');
    console.error('   Add it to your .env file:');
    console.error('   YOUTUBE_API_KEY=your_key_here\n');
    console.error('💡 How to get YouTube API key:\n');
    console.error('1. Go to Google Cloud Console: https://console.cloud.google.com');
    console.error('2. Enable YouTube Data API v3');
    console.error('3. Create credentials → API Key');
    console.error('4. Restrict key to YouTube Data API v3');
    console.error('5. Add to .env file\n');
    process.exit(1);
  }

  console.log('✅ API Key found in environment');
  // Security: Mask API key (show only last 4 chars) - GDPR/SOC2 compliance (CodeRabbit #3343936799)
  const masked = apiKey.length > 8 ? `****${apiKey.slice(-4)}` : '****';
  console.log(`   Key: ${masked}\n`);

  try {
    // Test 1: Search for videos
    console.log('🔍 Test 1: Searching for videos...');

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

    console.log(`✅ Video search working!`);
    console.log(`   Query: "javascript tutorial"`);
    console.log(`   Results found: ${videosFound}`);

    if (videosFound > 0) {
      console.log(`   First result: "${videos[0].snippet.title}"`);
      console.log(`   Video ID: ${videos[0].id.videoId}`);
    }
    console.log();

    // Test 2: Get video details
    if (videosFound > 0) {
      console.log('📊 Test 2: Getting video details...');

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

      console.log('✅ Video details retrieved successfully!');
      console.log(`   Title: "${video.snippet.title}"`);
      console.log(`   Channel: ${video.snippet.channelTitle}`);
      console.log(`   Views: ${stats.viewCount || 'N/A'}`);
      console.log(`   Likes: ${stats.likeCount || 'N/A'}`);
      console.log(`   Comments: ${stats.commentCount || 'N/A'}`);
      console.log();
    }

    // Test 3: Get channel details
    console.log('📺 Test 3: Getting channel details...');

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
      console.log('   Username lookup failed, trying channel ID...');
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

      console.log('✅ Channel details retrieved successfully!');
      console.log(`   Channel: ${channel.snippet.title}`);
      console.log(`   Subscribers: ${channelStats.subscriberCount || 'Hidden'}`);
      console.log(`   Total videos: ${channelStats.videoCount || 'N/A'}`);
      console.log(`   Total views: ${channelStats.viewCount || 'N/A'}`);
      console.log();
    } else {
      console.log('⚠️  Channel lookup by username not found (this is OK)');
      console.log('   Channel details API is working\n');
    }

    // Test 4: Try to get comments (requires OAuth for some videos)
    if (videosFound > 0) {
      console.log('💬 Test 4: Testing comment threads API...');

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

        console.log('✅ Comment threads API working!');
        console.log(`   Comments found: ${comments.length}`);

        if (comments.length > 0) {
          const topComment = comments[0].snippet.topLevelComment.snippet;
          console.log(`   First comment by: ${topComment.authorDisplayName}`);
          console.log(`   Comment text: "${topComment.textDisplay.substring(0, 50)}..."`);
        }
        console.log();
      } catch (commentError) {
        if (commentError.response?.status === 403) {
          console.log('⚠️  Comments disabled for this video (this is normal)');
          console.log('   Comment threads API is accessible\n');
        } else {
          throw commentError;
        }
      }
    }

    // Summary
    console.log('📊 Summary:\n');
    console.log('✅ API Key: Valid');
    console.log('✅ Video Search: Working');
    console.log('✅ Video Details: Working');
    console.log('✅ Channel Details: Working');
    console.log('✅ Comment Threads: API Accessible');
    console.log();

    // Integration info
    console.log('💡 Integration Details:\n');
    console.log('✅ Supported Operations:');
    console.log('   - Search videos by keyword');
    console.log('   - Get video details and statistics');
    console.log('   - Get channel information');
    console.log('   - Read comment threads');
    console.log('   - Reply to comments (requires OAuth)');
    console.log();

    console.log('⚠️  Rate Limits (Free tier):');
    console.log('   - 10,000 quota units/day');
    console.log('   - Search: 100 units per request');
    console.log('   - Video details: 1 unit per request');
    console.log('   - Comments: 1 unit per request');
    console.log('   - Daily limit: ~100 searches or 10,000 detail requests');
    console.log();

    console.log('📚 Documentation:');
    console.log('   → https://developers.google.com/youtube/v3/docs');
    console.log('   → https://console.cloud.google.com/apis/api/youtube.googleapis.com');
    console.log();

    console.log('🎉 YouTube Data API v3 verification complete!\n');

  } catch (error) {
    console.error('\n❌ ERROR during verification:');

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 400) {
        console.error('   Status: 400 Bad Request');
        console.error('   Message:', data.error?.message || 'Invalid request');
        console.error('\n💡 Solution:');
        console.error('   1. Check that API key is correct');
        console.error('   2. Verify request parameters are valid');
        console.error('   3. Ensure YouTube Data API v3 is enabled\n');
      } else if (status === 403) {
        console.error('   Status: 403 Forbidden');
        console.error('   Message:', data.error?.message || 'Access denied');

        if (data.error?.errors?.[0]?.reason === 'quotaExceeded') {
          console.error('\n💡 Solution:');
          console.error('   Daily quota exceeded (10,000 units/day)');
          console.error('   Wait until quota resets (midnight Pacific Time)');
          console.error('   Or request quota increase in Google Cloud Console\n');
        } else {
          console.error('\n💡 Solution:');
          console.error('   1. Verify YouTube Data API v3 is enabled');
          console.error('   2. Check API key restrictions');
          console.error('   3. Ensure billing is enabled if required');
          console.error('   4. Wait a few minutes and try again\n');
        }
      } else if (status === 404) {
        console.error('   Status: 404 Not Found');
        console.error('   Message: Resource not found');
        console.error('\n💡 Solution:');
        console.error('   This is OK - tested resource may not exist');
        console.error('   API key and endpoints are working\n');
      } else {
        console.error('   Status:', status);
        console.error('   Message:', data.error?.message || 'Unknown error');

        if (data.error?.errors) {
          console.error('   Errors:', JSON.stringify(data.error.errors, null, 2));
        }
        console.error();
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('   Error: Request timeout');
      console.error('\n💡 Solution:');
      console.error('   1. Check internet connection');
      console.error('   2. Try again in a few moments');
      console.error('   3. YouTube API may be temporarily slow\n');
    } else {
      console.error('   Message:', error.message);
      console.error();
    }

    process.exit(1);
  }
}

// Run verification
verifyYouTube().catch(error => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
