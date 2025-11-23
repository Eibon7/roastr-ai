const MultiTenantIntegration = require('../base/MultiTenantIntegration');

/**
 * Facebook Integration Service
 *
 * Handles comment fetching and response generation for Facebook posts.
 * Uses Facebook Graph API for managing page content and comments.
 */
class FacebookService extends MultiTenantIntegration {
  constructor(options = {}) {
    super('facebook', {
      rateLimit: 600, // Facebook allows 600 requests per hour for most endpoints
      supportDirectPosting: true, // Facebook supports automated comment posting
      supportModeration: true, // Full moderation capabilities
      ...options
    });

    // Facebook API configuration
    this.accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    this.pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    this.appId = process.env.FACEBOOK_APP_ID;
    this.appSecret = process.env.FACEBOOK_APP_SECRET;

    // Facebook-specific settings
    this.apiVersion = 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    this.pollingInterval = parseInt(process.env.FACEBOOK_POLLING_INTERVAL) || 900000; // 15 minutes
    this.triggerWords = (process.env.FACEBOOK_TRIGGER_WORDS || 'roast,burn,savage,comeback').split(
      ','
    );
  }

  /**
   * Authenticate with Facebook Graph API
   */
  async authenticate() {
    this.log('info', 'Authenticating with Facebook Graph API');

    if (!this.accessToken) {
      throw new Error('Facebook access token not configured');
    }

    try {
      // Verify token and get page info
      const response = await this.makeRequest(`/me`, {
        access_token: this.accessToken
      });

      this.log('info', 'Facebook authentication successful', {
        pageId: response.id,
        pageName: response.name
      });

      return {
        success: true,
        pageId: response.id,
        pageName: response.name
      };
    } catch (error) {
      this.log('error', 'Facebook authentication failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize Facebook service
   */
  async initialize() {
    this.log('info', 'Initializing Facebook service');

    if (!this.enabled) {
      this.log('warn', 'Facebook integration is disabled');
      return { success: false, reason: 'disabled' };
    }

    try {
      await this.authenticate();
      return { success: true };
    } catch (error) {
      this.log('error', 'Failed to initialize Facebook service', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Listen for comments (webhook-based or polling)
   */
  async listenForMentions(options = {}) {
    const { mode = 'polling' } = options;

    this.log('info', `Starting Facebook comment monitoring in ${mode} mode`);

    if (mode === 'webhook') {
      return await this.startWebhookListener();
    } else {
      return await this.startPolling();
    }
  }

  /**
   * Start webhook listener for real-time updates
   */
  async startWebhookListener() {
    this.log('info', 'Facebook webhook listener ready');

    // TODO: Implement webhook handler for real-time Facebook comments
    // This would be integrated with the main Express app

    return {
      success: true,
      message: 'Webhook listener configured (requires Express integration)',
      webhookUrl: '/webhooks/facebook',
      verifyToken: this.webhookVerifyToken
    };
  }

  /**
   * Start polling for new comments
   */
  async startPolling() {
    if (!this.accessToken || !this.pageId) {
      throw new Error('Facebook credentials not properly configured');
    }

    this.log('info', 'Starting Facebook polling mode', {
      interval: this.pollingInterval,
      pageId: this.pageId
    });

    // Get recent comments from page posts
    try {
      const comments = await this.fetchRecentComments();

      this.log('info', 'Facebook polling completed', {
        commentsFound: comments.length,
        triggerWords: this.triggerWords
      });

      // Process comments that match trigger words
      const relevantComments = comments.filter((comment) =>
        this.triggerWords.some((word) => comment.message.toLowerCase().includes(word.toLowerCase()))
      );

      if (relevantComments.length > 0) {
        this.log('info', 'Processing relevant Facebook comments', {
          count: relevantComments.length
        });

        // Process each relevant comment
        for (const comment of relevantComments) {
          await this.processComment(comment);
        }
      }

      return {
        success: true,
        processed: relevantComments.length,
        total: comments.length
      };
    } catch (error) {
      this.log('error', 'Facebook polling failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Fetch recent comments from page posts
   */
  async fetchRecentComments() {
    try {
      // Get recent posts from the page
      const postsResponse = await this.makeRequest(`/${this.pageId}/posts`, {
        access_token: this.accessToken,
        limit: 10,
        fields: 'id,message,created_time'
      });

      const comments = [];

      // Get comments for each post
      for (const post of postsResponse.data) {
        try {
          const commentsResponse = await this.makeRequest(`/${post.id}/comments`, {
            access_token: this.accessToken,
            limit: 20,
            fields: 'id,message,created_time,from,can_reply'
          });

          for (const comment of commentsResponse.data) {
            comments.push({
              platform: 'facebook',
              postId: post.id,
              commentId: comment.id,
              userId: comment.from.id,
              username: comment.from.name,
              message: comment.message,
              createdAt: comment.created_time,
              canReply: comment.can_reply
            });
          }
        } catch (commentError) {
          this.log('warn', 'Failed to fetch comments for post', {
            postId: post.id,
            error: commentError.message
          });
        }
      }

      return comments;
    } catch (error) {
      this.log('error', 'Failed to fetch Facebook comments', { error: error.message });
      throw error;
    }
  }

  /**
   * Process a comment for roast generation
   */
  async processComment(comment) {
    try {
      this.log('info', 'Processing Facebook comment', {
        commentId: comment.commentId,
        username: comment.username
      });

      // Check response frequency
      if (Math.random() > this.responseFrequency) {
        this.log('info', 'Skipping comment based on response frequency');
        return { skipped: true, reason: 'frequency' };
      }

      // Check rate limits
      if (!(await this.checkRateLimit())) {
        this.log('warn', 'Rate limit reached, skipping comment');
        return { skipped: true, reason: 'rate_limit' };
      }

      // Generate roast response
      const roastResponse = await this.generateRoast(comment.message);

      if (!roastResponse || !roastResponse.roast) {
        this.log('warn', 'Failed to generate roast response');
        return { error: 'Failed to generate response' };
      }

      // Post response (if auto-posting is enabled)
      if (this.autoPost !== false) {
        const postResult = await this.postResponse(comment.commentId, roastResponse.roast, comment);

        return {
          success: true,
          commentId: comment.commentId,
          response: roastResponse.roast,
          posted: postResult.success
        };
      }

      return {
        success: true,
        commentId: comment.commentId,
        response: roastResponse.roast,
        posted: false
      };
    } catch (error) {
      this.log('error', 'Error processing Facebook comment', {
        commentId: comment.commentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Post response to Facebook comment
   */
  async postResponse(commentId, responseText, originalComment) {
    this.log('info', 'Posting Facebook response', {
      commentId,
      responseLength: responseText.length
    });

    try {
      // Reply to the comment
      const response = await this.makeRequest(
        `/${commentId}/comments`,
        {
          access_token: this.accessToken,
          message: responseText
        },
        'POST'
      );

      this.log('info', 'Facebook response posted successfully', {
        responseId: response.id,
        originalCommentId: commentId
      });

      // Update rate limit tracking
      await this.updateRateLimit();

      return {
        success: true,
        responseId: response.id,
        platform: 'facebook'
      };
    } catch (error) {
      this.log('error', 'Failed to post Facebook response', {
        commentId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Make request to Facebook Graph API
   */
  async makeRequest(endpoint, params = {}, method = 'GET') {
    const axios = require('axios');

    const url = `${this.baseUrl}${endpoint}`;

    try {
      let response;

      if (method === 'GET') {
        response = await axios.get(url, { params });
      } else {
        response = await axios.post(url, params);
      }

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Facebook API error: ${error.response.data.error.message}`);
      } else {
        throw new Error(`Request failed: ${error.message}`);
      }
    }
  }

  /**
   * Run batch processing
   */
  async runBatch() {
    if (!this.enabled) {
      return { success: false, reason: 'Facebook integration disabled' };
    }

    try {
      const result = await this.listenForMentions({ mode: 'polling' });

      return {
        success: true,
        platform: 'facebook',
        processed: result.processed || 0,
        total: result.total || 0
      };
    } catch (error) {
      this.log('error', 'Facebook batch processing failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        platform: 'facebook'
      };
    }
  }

  /**
   * Webhook verification for Facebook
   */
  static verifyWebhook(req) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
      return challenge;
    }

    return null;
  }

  /**
   * Process webhook payload from Facebook
   */
  static async processWebhook(payload) {
    // TODO: Implement webhook payload processing
    console.log('[Facebook] Webhook payload received:', payload);

    // This would process real-time comment notifications from Facebook

    return { processed: true };
  }
}

module.exports = FacebookService;
