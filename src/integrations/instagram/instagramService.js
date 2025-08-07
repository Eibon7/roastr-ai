const MultiTenantIntegration = require('../base/MultiTenantIntegration');

/**
 * Instagram Integration Service
 * 
 * Handles comment fetching and response generation for Instagram posts.
 * Uses Instagram Basic Display API and Instagram Graph API for business accounts.
 */
class InstagramService extends MultiTenantIntegration {
  constructor(options = {}) {
    super('instagram', {
      rateLimit: 200, // Instagram allows 200 requests per hour
      supportDirectPosting: false, // Instagram doesn't allow automated comments via API
      supportModeration: true, // Limited moderation capabilities (hide/delete)
      ...options
    });
    
    // Instagram API configuration
    this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    this.clientId = process.env.INSTAGRAM_CLIENT_ID;
    this.clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    this.graphApiVersion = 'v18.0';
    this.baseUrl = `https://graph.instagram.com/${this.graphApiVersion}`;
  }
  
  /**
   * Platform-specific setup
   */
  async setupPlatformSpecific() {
    this.log('info', 'Setting up Instagram integration');
    
    if (!this.accessToken) {
      throw new Error('Instagram access token not configured');
    }
    
    // Test API connection
    await this.testConnection();
  }
  
  /**
   * Test Instagram API connection
   */
  async testConnection() {
    try {
      const response = await this.makeApiRequest(`/me`, {
        fields: 'id,username'
      });
      
      this.log('info', 'Instagram API connection successful', {
        userId: response.id,
        username: response.username
      });
      
      return response;
    } catch (error) {
      throw new Error(`Instagram API connection failed: ${error.message}`);
    }
  }
  
  /**
   * Validate Instagram configuration
   */
  validateConfiguration() {
    if (!this.enabled) {
      return false;
    }
    
    if (!this.accessToken) {
      this.log('error', 'Instagram access token not configured');
      return false;
    }
    
    return true;
  }
  
  /**
   * Fetch comments from Instagram media
   */
  async fetchComments(params = {}) {
    await this.checkRateLimit();
    
    const {
      mediaId,
      userId = 'me',
      maxResults = 25,
      since = null,
      before = null
    } = params;
    
    try {
      let mediaList = [];
      
      if (mediaId) {
        // Fetch comments for specific media
        mediaList = [{ id: mediaId }];
      } else {
        // Fetch recent media first
        mediaList = await this.getRecentMedia(userId, maxResults);
      }
      
      const allComments = [];
      
      for (const media of mediaList) {
        try {
          const comments = await this.getMediaComments(media.id, {
            maxResults,
            since,
            before
          });
          
          allComments.push(...comments);
          
        } catch (error) {
          this.log('warn', 'Failed to fetch comments for media', {
            mediaId: media.id,
            error: error.message
          });
        }
      }
      
      return {
        comments: allComments,
        hasMore: allComments.length >= maxResults,
        nextToken: allComments.length > 0 ? allComments[allComments.length - 1].id : null
      };
      
    } catch (error) {
      this.log('error', 'Failed to fetch Instagram comments', {
        error: error.message,
        params
      });
      throw error;
    }
  }
  
  /**
   * Get recent media posts
   */
  async getRecentMedia(userId = 'me', limit = 10) {
    const response = await this.makeApiRequest(`/${userId}/media`, {
      fields: 'id,media_type,media_url,permalink,timestamp,caption',
      limit
    });
    
    return response.data || [];
  }
  
  /**
   * Get comments for specific media
   */
  async getMediaComments(mediaId, options = {}) {
    const { maxResults = 25, since, before } = options;
    
    const params = {
      fields: 'id,text,timestamp,username,like_count,replies,parent_id',
      limit: maxResults
    };
    
    if (since) {
      params.since = since;
    }
    
    if (before) {
      params.until = before;
    }
    
    const response = await this.makeApiRequest(`/${mediaId}/comments`, params);
    
    const comments = (response.data || []).map(comment => this.normalizeInstagramComment(comment, mediaId));
    
    return comments;
  }
  
  /**
   * Normalize Instagram comment to standard format
   */
  normalizeInstagramComment(comment, mediaId) {
    return {
      id: comment.id,
      text: comment.text || '',
      author_id: comment.from?.id || comment.username,
      author_name: comment.from?.username || comment.username,
      created_at: comment.timestamp || new Date().toISOString(),
      platform_data: {
        ...comment,
        media_id: mediaId,
        platform: 'instagram'
      },
      metrics: {
        likes: comment.like_count || 0,
        replies: comment.replies?.data?.length || 0
      },
      parent_comment_id: comment.parent_id,
      thread_id: mediaId,
      language: 'unknown' // Instagram API doesn't provide language detection
    };
  }
  
  /**
   * Instagram doesn't support automated comment posting via API
   */
  async postResponse(commentId, responseText, options = {}) {
    throw new Error('Instagram does not support automated comment posting via API. Response will be stored for manual review.');
  }
  
  /**
   * Instagram has limited moderation capabilities via API
   */
  async performModerationAction(action, targetId, options = {}) {
    switch (action) {
      case 'hide_comment':
        return await this.hideComment(targetId);
      
      case 'delete_comment':
        return await this.deleteComment(targetId);
        
      default:
        throw new Error(`Instagram moderation action '${action}' not supported`);
    }
  }
  
  /**
   * Hide a comment (Instagram Business accounts only)
   */
  async hideComment(commentId) {
    try {
      await this.checkRateLimit();
      
      const response = await this.makeApiRequest(`/${commentId}`, {
        hide: true
      }, 'POST');
      
      this.log('info', 'Comment hidden successfully', { commentId });
      
      return {
        success: true,
        action: 'hide_comment',
        commentId,
        result: response
      };
      
    } catch (error) {
      this.log('error', 'Failed to hide comment', {
        commentId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Delete a comment (only if posted by authenticated user)
   */
  async deleteComment(commentId) {
    try {
      await this.checkRateLimit();
      
      await this.makeApiRequest(`/${commentId}`, {}, 'DELETE');
      
      this.log('info', 'Comment deleted successfully', { commentId });
      
      return {
        success: true,
        action: 'delete_comment',
        commentId
      };
      
    } catch (error) {
      this.log('error', 'Failed to delete comment', {
        commentId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Make Instagram API request
   */
  async makeApiRequest(endpoint, params = {}, method = 'GET') {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add access token to all requests
    params.access_token = this.accessToken;
    
    // Add parameters to URL for GET requests
    if (method === 'GET') {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.append(key, params[key]);
        }
      });
    }
    
    const options = {
      method,
      headers: {
        'User-Agent': 'Roastr-AI/1.0',
        'Content-Type': 'application/json'
      }
    };
    
    // Add body for POST/PUT requests
    if (method !== 'GET' && method !== 'DELETE') {
      options.body = JSON.stringify(params);
    }
    
    this.log('debug', 'Making Instagram API request', {
      method,
      endpoint,
      url: url.toString().replace(this.accessToken || '', 'HIDDEN')
    });
    
    const response = await fetch(url.toString(), options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Instagram API error: ${data.error?.message || response.statusText}`);
    }
    
    return data;
  }
}

module.exports = InstagramService;