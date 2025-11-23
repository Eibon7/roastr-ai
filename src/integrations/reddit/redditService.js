const MultiTenantIntegration = require('../base/MultiTenantIntegration');

/**
 * Reddit Integration Service
 *
 * Handles Reddit platform integration for:
 * - Subreddit comment monitoring
 * - Post reply generation
 * - Mention tracking
 * - Karma-based filtering
 */
class RedditService extends MultiTenantIntegration {
  constructor(options = {}) {
    super('reddit', {
      rateLimit: 60, // Reddit API is stricter
      supportDirectPosting: false, // Store responses for manual review
      supportModeration: true,
      ...options
    });

    this.clientId = process.env.REDDIT_CLIENT_ID;
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET;
    this.username = process.env.REDDIT_USERNAME;
    this.password = process.env.REDDIT_PASSWORD;
    this.userAgent = process.env.REDDIT_USER_AGENT || 'RoastrBot/1.0 by u/YourUsername';

    // Reddit-specific settings
    this.monitoredSubreddits = (process.env.REDDIT_MONITORED_SUBREDDITS || '')
      .split(',')
      .filter(Boolean);
    this.triggerWords = (
      process.env.REDDIT_TRIGGER_WORDS || 'roast,burn,insult,comeback,cringe'
    ).split(',');
    this.minKarmaThreshold = parseInt(process.env.REDDIT_MIN_KARMA_THRESHOLD) || 100;
    this.accountAgeThreshold = parseInt(process.env.REDDIT_ACCOUNT_AGE_DAYS) || 30;
    this.pollingInterval = parseInt(process.env.REDDIT_POLLING_INTERVAL) || 600000; // 10 minutes
    this.maxPostsPerCheck = parseInt(process.env.REDDIT_MAX_POSTS_PER_CHECK) || 25;

    this.reddit = null;
  }

  /**
   * Authenticate with Reddit API
   */
  async authenticate() {
    this.log('info', 'Authenticating with Reddit API');

    if (!this.clientId || !this.clientSecret || !this.username || !this.password) {
      throw new Error('Reddit credentials not configured');
    }

    try {
      const snoowrap = require('snoowrap');

      this.reddit = new snoowrap({
        userAgent: this.userAgent,
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        username: this.username,
        password: this.password
      });

      // Test authentication by getting user info
      const me = await this.reddit.getMe();

      this.log('info', 'Reddit authentication successful', {
        username: me.name,
        karma: me.total_karma,
        created: new Date(me.created_utc * 1000).toISOString()
      });

      return {
        success: true,
        username: me.name,
        karma: me.total_karma
      };
    } catch (error) {
      this.log('error', 'Reddit authentication failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize Reddit service
   */
  async initialize() {
    this.log('info', 'Initializing Reddit service');

    if (!this.enabled) {
      this.log('warn', 'Reddit integration is disabled');
      return { success: false, reason: 'disabled' };
    }

    try {
      await this.authenticate();
      return { success: true };
    } catch (error) {
      this.log('error', 'Failed to initialize Reddit service', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Listen for Reddit mentions and comments
   */
  async listenForMentions(options = {}) {
    const { mode = 'polling' } = options;

    this.log('info', `Starting Reddit monitoring in ${mode} mode`);

    // Reddit doesn't support real-time webhooks, so we always use polling
    return await this.startPolling();
  }

  /**
   * Start polling for new mentions and relevant posts
   */
  async startPolling() {
    if (!this.reddit) {
      throw new Error('Reddit client not initialized');
    }

    this.log('info', 'Starting Reddit polling mode', {
      interval: this.pollingInterval,
      subreddits: this.monitoredSubreddits.length || 'all',
      triggerWords: this.triggerWords
    });

    try {
      const results = {
        mentions: await this.checkMentions(),
        comments: await this.checkRelevantComments(),
        posts: await this.checkRelevantPosts()
      };

      const totalProcessed =
        (results.mentions?.processed || 0) +
        (results.comments?.processed || 0) +
        (results.posts?.processed || 0);

      this.log('info', 'Reddit polling completed', {
        mentions: results.mentions?.total || 0,
        comments: results.comments?.total || 0,
        posts: results.posts?.total || 0,
        processed: totalProcessed
      });

      return {
        success: true,
        processed: totalProcessed,
        breakdown: results
      };
    } catch (error) {
      this.log('error', 'Reddit polling failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Check for username mentions
   */
  async checkMentions() {
    try {
      const mentions = await this.reddit.getInbox({ filter: 'mentions', limit: 10 });

      let processed = 0;
      const total = mentions.length;

      for (const mention of mentions) {
        if (mention.new && !mention.was_comment) {
          // Only process unread post mentions
          const shouldProcess = await this.shouldProcessMention(mention);

          if (shouldProcess) {
            await this.processMention(mention);
            processed++;
          }

          // Mark as read
          await mention.markAsRead();
        }
      }

      return { processed, total };
    } catch (error) {
      this.log('error', 'Failed to check Reddit mentions', { error: error.message });
      return { processed: 0, total: 0 };
    }
  }

  /**
   * Check for relevant comments in monitored subreddits
   */
  async checkRelevantComments() {
    try {
      let processed = 0;
      let total = 0;

      const subreddits = this.monitoredSubreddits.length > 0 ? this.monitoredSubreddits : ['all'];

      for (const subredditName of subreddits) {
        try {
          const subreddit = await this.reddit.getSubreddit(subredditName);
          const comments = await subreddit.getNewComments({ limit: this.maxPostsPerCheck });

          total += comments.length;

          for (const comment of comments) {
            if (await this.shouldProcessComment(comment)) {
              await this.processComment(comment);
              processed++;
            }
          }
        } catch (subredditError) {
          this.log('warn', 'Failed to check subreddit', {
            subreddit: subredditName,
            error: subredditError.message
          });
        }
      }

      return { processed, total };
    } catch (error) {
      this.log('error', 'Failed to check Reddit comments', { error: error.message });
      return { processed: 0, total: 0 };
    }
  }

  /**
   * Check for relevant posts in monitored subreddits
   */
  async checkRelevantPosts() {
    try {
      let processed = 0;
      let total = 0;

      const subreddits =
        this.monitoredSubreddits.length > 0
          ? this.monitoredSubreddits
          : ['roastme', 'unpopularopinion'];

      for (const subredditName of subreddits) {
        try {
          const subreddit = await this.reddit.getSubreddit(subredditName);
          const posts = await subreddit.getNew({ limit: this.maxPostsPerCheck });

          total += posts.length;

          for (const post of posts) {
            if (await this.shouldProcessPost(post)) {
              await this.processPost(post);
              processed++;
            }
          }
        } catch (subredditError) {
          this.log('warn', 'Failed to check subreddit posts', {
            subreddit: subredditName,
            error: subredditError.message
          });
        }
      }

      return { processed, total };
    } catch (error) {
      this.log('error', 'Failed to check Reddit posts', { error: error.message });
      return { processed: 0, total: 0 };
    }
  }

  /**
   * Determine if mention should be processed
   */
  async shouldProcessMention(mention) {
    // Always process direct mentions
    return true;
  }

  /**
   * Determine if comment should be processed
   */
  async shouldProcessComment(comment) {
    // Skip own comments
    if (comment.author.name === this.username) {
      return false;
    }

    // Check if comment contains trigger words
    const containsTrigger = this.triggerWords.some((word) =>
      comment.body.toLowerCase().includes(word.toLowerCase())
    );

    if (!containsTrigger) {
      return false;
    }

    // Check user karma and account age
    try {
      const author = await comment.author.fetch();

      if (author.total_karma < this.minKarmaThreshold) {
        return false;
      }

      const accountAge = (Date.now() - author.created_utc * 1000) / (1000 * 60 * 60 * 24);
      if (accountAge < this.accountAgeThreshold) {
        return false;
      }
    } catch (authorError) {
      this.log('warn', 'Could not fetch comment author details', {
        commentId: comment.id
      });
      return false;
    }

    return true;
  }

  /**
   * Determine if post should be processed
   */
  async shouldProcessPost(post) {
    // Skip own posts
    if (post.author.name === this.username) {
      return false;
    }

    // Check if post is in r/RoastMe or similar
    if (post.subreddit.display_name.toLowerCase() === 'roastme') {
      return true;
    }

    // Check if post contains trigger words
    const containsTrigger = this.triggerWords.some((word) =>
      (post.title + ' ' + post.selftext).toLowerCase().includes(word.toLowerCase())
    );

    return containsTrigger;
  }

  /**
   * Process a Reddit mention
   */
  async processMention(mention) {
    try {
      this.log('info', 'Processing Reddit mention', {
        mentionId: mention.id,
        author: mention.author.name,
        subreddit: mention.subreddit.display_name
      });

      await this.processRedditItem(mention, mention.body);
    } catch (error) {
      this.log('error', 'Error processing Reddit mention', {
        mentionId: mention.id,
        error: error.message
      });
    }
  }

  /**
   * Process a Reddit comment
   */
  async processComment(comment) {
    try {
      this.log('info', 'Processing Reddit comment', {
        commentId: comment.id,
        author: comment.author.name,
        subreddit: comment.subreddit.display_name
      });

      await this.processRedditItem(comment, comment.body);
    } catch (error) {
      this.log('error', 'Error processing Reddit comment', {
        commentId: comment.id,
        error: error.message
      });
    }
  }

  /**
   * Process a Reddit post
   */
  async processPost(post) {
    try {
      this.log('info', 'Processing Reddit post', {
        postId: post.id,
        author: post.author.name,
        subreddit: post.subreddit.display_name,
        title: post.title.substring(0, 50)
      });

      const content = post.selftext || post.title;
      await this.processRedditItem(post, content);
    } catch (error) {
      this.log('error', 'Error processing Reddit post', {
        postId: post.id,
        error: error.message
      });
    }
  }

  /**
   * Process any Reddit item (comment, post, mention)
   */
  async processRedditItem(item, content) {
    try {
      // Check response frequency
      if (Math.random() > this.responseFrequency) {
        this.log('info', 'Skipping Reddit item based on response frequency');
        return { skipped: true, reason: 'frequency' };
      }

      // Check rate limits
      if (!(await this.checkRateLimit())) {
        this.log('warn', 'Rate limit reached, skipping Reddit item');
        return { skipped: true, reason: 'rate_limit' };
      }

      // Generate roast response
      const roastResponse = await this.generateRoast(content);

      if (!roastResponse || !roastResponse.roast) {
        this.log('warn', 'Failed to generate roast response');
        return { error: 'Failed to generate response' };
      }

      // Post response
      const postResult = await this.postResponse(item, roastResponse.roast);

      return {
        success: true,
        itemId: item.id,
        response: roastResponse.roast,
        posted: postResult.success
      };
    } catch (error) {
      this.log('error', 'Error processing Reddit item', {
        itemId: item.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Post response to Reddit
   */
  async postResponse(originalItem, responseText) {
    this.log('info', 'Posting Reddit response', {
      itemId: originalItem.id,
      responseLength: responseText.length,
      subreddit: originalItem.subreddit?.display_name
    });

    try {
      // Reply to the original item
      const reply = await originalItem.reply(responseText);

      this.log('info', 'Reddit response posted successfully', {
        responseId: reply.id,
        originalItemId: originalItem.id
      });

      // Update rate limit tracking
      await this.updateRateLimit();

      return {
        success: true,
        responseId: reply.id,
        platform: 'reddit'
      };
    } catch (error) {
      this.log('error', 'Failed to post Reddit response', {
        itemId: originalItem.id,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Run batch processing
   */
  async runBatch() {
    if (!this.enabled) {
      return { success: false, reason: 'Reddit integration disabled' };
    }

    try {
      const result = await this.listenForMentions({ mode: 'polling' });

      return {
        success: true,
        platform: 'reddit',
        processed: result.processed || 0,
        breakdown: result.breakdown
      };
    } catch (error) {
      this.log('error', 'Reddit batch processing failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        platform: 'reddit'
      };
    }
  }
}

module.exports = RedditService;
