/**
 * Webhooks routes for social media platform events
 * Handles incoming webhooks from Twitter, YouTube, and other platforms
 */

const express = require('express');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

const router = express.Router();

/**
 * Verify Twitter webhook signature
 * @param {string} payload - Request body as string
 * @param {string} signature - X-Twitter-Webhooks-Signature header
 * @param {string} secret - Webhook secret
 * @returns {boolean} Signature validity
 */
function verifyTwitterSignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Error verifying Twitter webhook signature:', error);
    return false;
  }
}

/**
 * Verify YouTube webhook signature
 * @param {string} payload - Request body as string  
 * @param {string} signature - X-Hub-Signature-256 header
 * @param {string} secret - Webhook secret
 * @returns {boolean} Signature validity
 */
function verifyYouTubeSignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }

  try {
    // YouTube uses sha256=<signature> format
    const signatureHash = signature.replace('sha256=', '');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signatureHash),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Error verifying YouTube webhook signature:', error);
    return false;
  }
}

/**
 * Process Twitter webhook event
 * @param {Object} event - Twitter webhook event data
 * @param {string} userId - User ID from webhook payload
 * @returns {Promise<Object>} Processing result
 */
async function processTwitterWebhook(event, userId) {
  try {
    logger.info('Processing Twitter webhook event', {
      eventType: event.event_type || 'unknown',
      userId,
      hasData: !!event.data
    });

    // Handle different Twitter webhook events
    switch (event.event_type) {
      case 'tweet_create':
        return await handleTwitterTweetCreate(event.data, userId);
      case 'tweet_delete':
        return await handleTwitterTweetDelete(event.data, userId);
      case 'user_mention':
        return await handleTwitterMention(event.data, userId);
      case 'direct_message':
        return await handleTwitterDirectMessage(event.data, userId);
      default:
        logger.warn('Unknown Twitter webhook event type:', event.event_type);
        return { success: true, message: 'Event type ignored' };
    }

  } catch (error) {
    logger.error('Error processing Twitter webhook:', error);
    throw error;
  }
}

/**
 * Handle Twitter tweet creation event
 * @param {Object} tweetData - Tweet data from webhook
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Processing result
 */
async function handleTwitterTweetCreate(tweetData, userId) {
  logger.info('Handling Twitter tweet create', {
    tweetId: tweetData.id,
    userId,
    text: tweetData.text?.substring(0, 100) + '...'
  });

  // TODO: Implement tweet processing logic
  // - Check if tweet mentions our bot
  // - Analyze for toxicity
  // - Generate roast response if needed
  // - Queue response for posting

  return {
    success: true,
    action: 'tweet_processed',
    tweetId: tweetData.id
  };
}

/**
 * Handle Twitter tweet deletion event
 * @param {Object} tweetData - Tweet data from webhook
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Processing result
 */
async function handleTwitterTweetDelete(tweetData, userId) {
  logger.info('Handling Twitter tweet delete', {
    tweetId: tweetData.id,
    userId
  });

  // TODO: Implement tweet deletion logic
  // - Remove from our processing queue if pending
  // - Delete any generated responses
  // - Update analytics

  return {
    success: true,
    action: 'tweet_deletion_processed',
    tweetId: tweetData.id
  };
}

/**
 * Handle Twitter mention event
 * @param {Object} mentionData - Mention data from webhook
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Processing result
 */
async function handleTwitterMention(mentionData, userId) {
  logger.info('Handling Twitter mention', {
    tweetId: mentionData.id,
    userId,
    author: mentionData.author_id
  });

  // TODO: Implement mention handling logic
  // - Queue for toxicity analysis
  // - Generate roast response
  // - Post response with rate limiting

  return {
    success: true,
    action: 'mention_processed',
    tweetId: mentionData.id
  };
}

/**
 * Handle Twitter direct message event
 * @param {Object} dmData - DM data from webhook
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Processing result
 */
async function handleTwitterDirectMessage(dmData, userId) {
  logger.info('Handling Twitter direct message', {
    dmId: dmData.id,
    userId
  });

  // TODO: Implement DM handling logic
  // - Process direct message commands
  // - Handle configuration requests
  // - Send automated responses

  return {
    success: true,
    action: 'dm_processed',
    dmId: dmData.id
  };
}

/**
 * Process YouTube webhook event
 * @param {Object} event - YouTube webhook event data
 * @returns {Promise<Object>} Processing result
 */
async function processYouTubeWebhook(event) {
  try {
    logger.info('Processing YouTube webhook event', {
      videoId: event.video_id,
      channelId: event.channel_id,
      eventType: event.event_type || 'comment'
    });

    // Handle different YouTube webhook events
    if (event.comment_id) {
      return await handleYouTubeComment(event);
    } else if (event.video_id) {
      return await handleYouTubeVideo(event);
    } else {
      logger.warn('Unknown YouTube webhook event format');
      return { success: true, message: 'Event format not recognized' };
    }

  } catch (error) {
    logger.error('Error processing YouTube webhook:', error);
    throw error;
  }
}

/**
 * Handle YouTube comment event
 * @param {Object} commentData - Comment data from webhook
 * @returns {Promise<Object>} Processing result
 */
async function handleYouTubeComment(commentData) {
  logger.info('Handling YouTube comment', {
    commentId: commentData.comment_id,
    videoId: commentData.video_id,
    channelId: commentData.channel_id
  });

  // TODO: Implement comment handling logic
  // - Fetch full comment details via YouTube API
  // - Analyze for toxicity
  // - Generate roast response if appropriate
  // - Queue response for posting

  return {
    success: true,
    action: 'comment_processed',
    commentId: commentData.comment_id
  };
}

/**
 * Handle YouTube video event
 * @param {Object} videoData - Video data from webhook
 * @returns {Promise<Object>} Processing result
 */
async function handleYouTubeVideo(videoData) {
  logger.info('Handling YouTube video', {
    videoId: videoData.video_id,
    channelId: videoData.channel_id
  });

  // TODO: Implement video handling logic
  // - Monitor for new comments
  // - Set up comment tracking
  // - Initialize video analytics

  return {
    success: true,
    action: 'video_processed',
    videoId: videoData.video_id
  };
}

/**
 * POST /api/webhooks/twitter
 * Handle Twitter webhook events
 */
router.post('/twitter', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-twitter-webhooks-signature'];
    const payload = req.body.toString();
    const secret = process.env.TWITTER_WEBHOOK_SECRET;

    // Verify signature if not in mock mode
    if (!flags.shouldUseMockOAuth() && !verifyTwitterSignature(payload, signature, secret)) {
      logger.warn('Invalid Twitter webhook signature');
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE'
      });
    }

    // Parse webhook payload
    let webhookData;
    try {
      webhookData = JSON.parse(payload);
    } catch (parseError) {
      logger.error('Failed to parse Twitter webhook payload:', parseError);
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON payload',
        code: 'INVALID_PAYLOAD'
      });
    }

    // Handle Twitter's challenge response (CRC)
    if (webhookData.crc_token) {
      const responseToken = crypto
        .createHmac('sha256', secret)
        .update(webhookData.crc_token)
        .digest('base64');
      
      return res.json({
        response_token: `sha256=${responseToken}`
      });
    }

    // Extract user ID from webhook (varies by event type)
    const userId = webhookData.for_user_id || 
                  webhookData.user_id || 
                  webhookData.tweet_create_events?.[0]?.user?.id;

    if (!userId) {
      logger.warn('No user ID found in Twitter webhook');
      return res.status(400).json({
        success: false,
        error: 'No user ID in webhook payload',
        code: 'MISSING_USER_ID'
      });
    }

    // Process webhook events
    const results = [];
    
    // Handle multiple event types that might be in the same webhook
    for (const [eventType, events] of Object.entries(webhookData)) {
      if (Array.isArray(events) && eventType.endsWith('_events')) {
        for (const event of events) {
          const result = await processTwitterWebhook({
            event_type: eventType.replace('_events', ''),
            data: event
          }, userId);
          results.push(result);
        }
      }
    }

    logger.info('Twitter webhook processed successfully', {
      userId,
      eventsProcessed: results.length,
      results: results.map(r => r.action)
    });

    res.json({
      success: true,
      data: {
        eventsProcessed: results.length,
        results
      }
    });

  } catch (error) {
    logger.error('Error handling Twitter webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'WEBHOOK_PROCESSING_ERROR'
    });
  }
});

/**
 * POST /api/webhooks/youtube
 * Handle YouTube webhook events
 */
router.post('/youtube', express.raw({ type: 'application/xml' }), async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = req.body.toString();
    const secret = process.env.YOUTUBE_WEBHOOK_SECRET;

    // Verify signature if not in mock mode
    if (!flags.shouldUseMockOAuth() && !verifyYouTubeSignature(payload, signature, secret)) {
      logger.warn('Invalid YouTube webhook signature');
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE'
      });
    }

    // Handle YouTube's challenge response
    const challenge = req.query['hub.challenge'];
    if (challenge) {
      logger.info('YouTube webhook challenge received');
      return res.status(200).send(challenge);
    }

    // Parse YouTube's Atom XML feed format
    let webhookData;
    try {
      // This is a simplified parser - in production you'd want to use a proper XML parser
      const videoIdMatch = payload.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const channelIdMatch = payload.match(/<yt:channelId>(.*?)<\/yt:channelId>/);
      const publishedMatch = payload.match(/<published>(.*?)<\/published>/);
      const updatedMatch = payload.match(/<updated>(.*?)<\/updated>/);

      webhookData = {
        video_id: videoIdMatch ? videoIdMatch[1] : null,
        channel_id: channelIdMatch ? channelIdMatch[1] : null,
        published: publishedMatch ? publishedMatch[1] : null,
        updated: updatedMatch ? updatedMatch[1] : null,
        event_type: 'video_update'
      };
    } catch (parseError) {
      logger.error('Failed to parse YouTube webhook payload:', parseError);
      return res.status(400).json({
        success: false,
        error: 'Invalid XML payload',
        code: 'INVALID_PAYLOAD'
      });
    }

    if (!webhookData.video_id && !webhookData.channel_id) {
      logger.warn('No video or channel ID found in YouTube webhook');
      return res.status(400).json({
        success: false,
        error: 'No video or channel ID in webhook payload',
        code: 'MISSING_IDS'
      });
    }

    // Process YouTube webhook
    const result = await processYouTubeWebhook(webhookData);

    logger.info('YouTube webhook processed successfully', {
      videoId: webhookData.video_id,
      channelId: webhookData.channel_id,
      action: result.action
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error handling YouTube webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'WEBHOOK_PROCESSING_ERROR'
    });
  }
});

/**
 * GET /api/webhooks/status
 * Get webhook configuration status
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      twitter: {
        configured: !!process.env.TWITTER_WEBHOOK_SECRET,
        endpoint: '/api/webhooks/twitter',
        signatureVerification: !flags.shouldUseMockOAuth()
      },
      youtube: {
        configured: !!process.env.YOUTUBE_WEBHOOK_SECRET,
        endpoint: '/api/webhooks/youtube',
        signatureVerification: !flags.shouldUseMockOAuth()
      },
      mockMode: flags.shouldUseMockOAuth()
    };

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Error getting webhook status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'WEBHOOK_STATUS_ERROR'
    });
  }
});

module.exports = router;