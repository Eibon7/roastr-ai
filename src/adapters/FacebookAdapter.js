const logger = require('../utils/logger');
const facebookService = require('../integrations/facebook/facebookService');
const { sanitizeForLogging } = require('../utils/parameterSanitizer');

/**
 * Facebook Shield Adapter
 * Implements moderation capabilities for Facebook platform
 */
class FacebookAdapter {
  constructor(config = {}) {
    this.platform = 'facebook';
    this.config = config;
    this.capabilities = [
      'hideComment',
      'reportUser',
      'blockUser',
      'unblockUser',
      'reportContent',
      'deleteComment'
    ];
    
    logger.info('FacebookAdapter initialized', { 
      platform: this.platform,
      capabilities: this.capabilities 
    });
  }

  /**
   * Get adapter capabilities
   * @returns {string[]} Array of supported capabilities
   */
  getCapabilities() {
    return [...this.capabilities];
  }

  /**
   * Hide a comment on Facebook
   * @param {Object} params - Action parameters
   * @param {string} params.commentId - The comment ID to hide
   * @param {string} params.postId - The post ID containing the comment
   * @param {string} params.organizationId - Organization ID for multi-tenant support
   * @returns {Promise<Object>} Result of the action
   */
  async hideComment({ commentId, postId, organizationId }) {
    try {
      logger.info('Hiding Facebook comment', sanitizeForLogging({ 
        commentId, 
        postId, 
        organizationId,
        platform: this.platform 
      }));

      const result = await facebookService.hideComment({
        commentId,
        postId,
        organizationId
      });

      // Validate service response
      if (!result || result.error) {
        throw new Error(result?.error || 'Facebook service returned invalid response');
      }

      logger.info('Facebook comment hidden successfully', { 
        commentId, 
        result 
      });

      return {
        success: true,
        action: 'hideComment',
        platform: this.platform,
        commentId,
        postId,
        result
      };

    } catch (error) {
      logger.error('Failed to hide Facebook comment', { 
        commentId, 
        postId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        action: 'hideComment',
        platform: this.platform,
        commentId,
        postId,
        error: error.message
      };
    }
  }

  /**
   * Delete a comment on Facebook
   * @param {Object} params - Action parameters
   * @param {string} params.commentId - The comment ID to delete
   * @param {string} params.postId - The post ID containing the comment
   * @param {string} params.organizationId - Organization ID for multi-tenant support
   * @returns {Promise<Object>} Result of the action
   */
  async deleteComment({ commentId, postId, organizationId }) {
    try {
      logger.info('Deleting Facebook comment', sanitizeForLogging({ 
        commentId, 
        postId, 
        organizationId,
        platform: this.platform 
      }));

      const result = await facebookService.deleteComment({
        commentId,
        postId,
        organizationId
      });

      // Validate service response
      if (!result || result.error) {
        throw new Error(result?.error || 'Facebook service returned invalid response');
      }

      logger.info('Facebook comment deleted successfully', { 
        commentId, 
        result 
      });

      return {
        success: true,
        action: 'deleteComment',
        platform: this.platform,
        commentId,
        postId,
        result
      };

    } catch (error) {
      logger.error('Failed to delete Facebook comment', { 
        commentId, 
        postId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        action: 'deleteComment',
        platform: this.platform,
        commentId,
        postId,
        error: error.message
      };
    }
  }

  /**
   * Report a user on Facebook
   * @param {Object} params - Action parameters
   * @param {string} params.userId - The user ID to report
   * @param {string} params.reason - Reason for reporting
   * @param {string} params.organizationId - Organization ID for multi-tenant support
   * @returns {Promise<Object>} Result of the action
   */
  async reportUser({ userId, reason, organizationId }) {
    try {
      logger.info('Reporting Facebook user', sanitizeForLogging({ 
        userId, 
        reason, 
        organizationId,
        platform: this.platform 
      }));

      const result = await facebookService.reportUser({
        userId,
        reason,
        organizationId
      });

      // Validate service response
      if (!result || result.error) {
        throw new Error(result?.error || 'Facebook service returned invalid response');
      }

      logger.info('Facebook user reported successfully', { 
        userId, 
        reason,
        result 
      });

      return {
        success: true,
        action: 'reportUser',
        platform: this.platform,
        userId,
        reason,
        result
      };

    } catch (error) {
      logger.error('Failed to report Facebook user', { 
        userId, 
        reason,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        action: 'reportUser',
        platform: this.platform,
        userId,
        reason,
        error: error.message
      };
    }
  }

  /**
   * Block a user on Facebook
   * @param {Object} params - Action parameters
   * @param {string} params.userId - The user ID to block
   * @param {string} params.organizationId - Organization ID for multi-tenant support
   * @returns {Promise<Object>} Result of the action
   */
  async blockUser({ userId, organizationId }) {
    try {
      logger.info('Blocking Facebook user', sanitizeForLogging({ 
        userId, 
        organizationId,
        platform: this.platform 
      }));

      const result = await facebookService.blockUser({
        userId,
        organizationId
      });

      // Validate service response
      if (!result || result.error) {
        throw new Error(result?.error || 'Facebook service returned invalid response');
      }

      logger.info('Facebook user blocked successfully', { 
        userId, 
        result 
      });

      return {
        success: true,
        action: 'blockUser',
        platform: this.platform,
        userId,
        result
      };

    } catch (error) {
      logger.error('Failed to block Facebook user', { 
        userId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        action: 'blockUser',
        platform: this.platform,
        userId,
        error: error.message
      };
    }
  }

  /**
   * Unblock a user on Facebook
   * @param {Object} params - Action parameters
   * @param {string} params.userId - The user ID to unblock
   * @param {string} params.organizationId - Organization ID for multi-tenant support
   * @returns {Promise<Object>} Result of the action
   */
  async unblockUser({ userId, organizationId }) {
    try {
      logger.info('Unblocking Facebook user', sanitizeForLogging({ 
        userId, 
        organizationId,
        platform: this.platform 
      }));

      const result = await facebookService.unblockUser({
        userId,
        organizationId
      });

      // Validate service response
      if (!result || result.error) {
        throw new Error(result?.error || 'Facebook service returned invalid response');
      }

      logger.info('Facebook user unblocked successfully', { 
        userId, 
        result 
      });

      return {
        success: true,
        action: 'unblockUser',
        platform: this.platform,
        userId,
        result
      };

    } catch (error) {
      logger.error('Failed to unblock Facebook user', { 
        userId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        action: 'unblockUser',
        platform: this.platform,
        userId,
        error: error.message
      };
    }
  }

  /**
   * Report content on Facebook
   * @param {Object} params - Action parameters
   * @param {string} params.contentId - The content ID to report (comment or post)
   * @param {string} params.contentType - Type of content ('comment' or 'post')
   * @param {string} params.reason - Reason for reporting
   * @param {string} params.organizationId - Organization ID for multi-tenant support
   * @returns {Promise<Object>} Result of the action
   */
  async reportContent({ contentId, contentType, reason, organizationId }) {
    try {
      logger.info('Reporting Facebook content', sanitizeForLogging({ 
        contentId, 
        contentType,
        reason, 
        organizationId,
        platform: this.platform 
      }));

      const result = await facebookService.reportContent({
        contentId,
        contentType,
        reason,
        organizationId
      });

      // Validate service response
      if (!result || result.error) {
        throw new Error(result?.error || 'Facebook service returned invalid response');
      }

      logger.info('Facebook content reported successfully', { 
        contentId, 
        contentType,
        reason,
        result 
      });

      return {
        success: true,
        action: 'reportContent',
        platform: this.platform,
        contentId,
        contentType,
        reason,
        result
      };

    } catch (error) {
      logger.error('Failed to report Facebook content', { 
        contentId, 
        contentType,
        reason,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        action: 'reportContent',
        platform: this.platform,
        contentId,
        contentType,
        reason,
        error: error.message
      };
    }
  }

  /**
   * Execute a Shield action
   * @param {string} action - The action to execute
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} Result of the action
   */
  async executeAction(action, params) {
    try {
      logger.info('Executing Facebook Shield action', sanitizeForLogging({ 
        action, 
        params,
        platform: this.platform 
      }));

      if (!this.capabilities.includes(action)) {
        throw new Error(`Action '${action}' not supported by ${this.platform} adapter`);
      }

      switch (action) {
        case 'hideComment':
          return await this.hideComment(params);
        case 'deleteComment':
          return await this.deleteComment(params);
        case 'reportUser':
          return await this.reportUser(params);
        case 'blockUser':
          return await this.blockUser(params);
        case 'unblockUser':
          return await this.unblockUser(params);
        case 'reportContent':
          return await this.reportContent(params);
        default:
          throw new Error(`Unknown action: ${action}`);
      }

    } catch (error) {
      logger.error('Failed to execute Facebook Shield action', sanitizeForLogging({ 
        action, 
        params,
        error: error.message,
        stack: error.stack
      }));

      return {
        success: false,
        action,
        platform: this.platform,
        error: error.message
      };
    }
  }

  /**
   * Check if adapter supports a specific action
   * @param {string} action - The action to check
   * @returns {boolean} Whether the action is supported
   */
  supportsAction(action) {
    return this.capabilities.includes(action);
  }

  /**
   * Get adapter information
   * @returns {Object} Adapter metadata
   */
  getInfo() {
    return {
      platform: this.platform,
      capabilities: this.capabilities,
      config: this.config
    };
  }
}

module.exports = FacebookAdapter;