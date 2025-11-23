const logger = require('../utils/logger');
const instagramService = require('../integrations/instagram/instagramService');
const { sanitizeForLogging } = require('../utils/parameterSanitizer');

/**
 * Instagram Shield Adapter
 * Implements moderation capabilities for Instagram platform
 */
class InstagramAdapter {
  constructor(config = {}) {
    this.platform = 'instagram';
    this.config = config;
    this.capabilities = ['hideComment', 'reportUser', 'reportContent'];

    logger.info('InstagramAdapter initialized', {
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
   * Hide a comment on Instagram
   * @param {Object} params - Action parameters
   * @param {string} params.commentId - The comment ID to hide
   * @param {string} params.mediaId - The media ID containing the comment
   * @param {string} params.organizationId - Organization ID for multi-tenant support
   * @returns {Promise<Object>} Result of the action
   */
  async hideComment({ commentId, mediaId, organizationId }) {
    try {
      logger.info(
        'Hiding Instagram comment',
        sanitizeForLogging({
          commentId,
          mediaId,
          organizationId,
          platform: this.platform
        })
      );

      // Instagram Basic Display API doesn't support hiding comments
      // This would require Instagram Business API with proper permissions
      const result = await instagramService.hideComment({
        commentId,
        mediaId,
        organizationId
      });

      // Validate service response
      if (!result || result.error) {
        throw new Error(result?.error || 'Instagram service returned invalid response');
      }

      logger.info('Instagram comment hidden successfully', {
        commentId,
        result
      });

      return {
        success: true,
        action: 'hideComment',
        platform: this.platform,
        commentId,
        mediaId,
        result
      };
    } catch (error) {
      logger.error('Failed to hide Instagram comment', {
        commentId,
        mediaId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        action: 'hideComment',
        platform: this.platform,
        commentId,
        mediaId,
        error: error.message
      };
    }
  }

  /**
   * Report a user on Instagram
   * @param {Object} params - Action parameters
   * @param {string} params.userId - The user ID to report
   * @param {string} params.reason - Reason for reporting
   * @param {string} params.organizationId - Organization ID for multi-tenant support
   * @returns {Promise<Object>} Result of the action
   */
  async reportUser({ userId, reason, organizationId }) {
    try {
      logger.info(
        'Reporting Instagram user',
        sanitizeForLogging({
          userId,
          reason,
          organizationId,
          platform: this.platform
        })
      );

      // Instagram API doesn't provide programmatic user reporting
      // This would typically redirect to Instagram's reporting interface
      const result = await instagramService.reportUser({
        userId,
        reason,
        organizationId
      });

      // Validate service response
      if (!result || result.error) {
        throw new Error(result?.error || 'Instagram service returned invalid response');
      }

      logger.info('Instagram user reported successfully', {
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
      logger.error('Failed to report Instagram user', {
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
   * Report content on Instagram
   * @param {Object} params - Action parameters
   * @param {string} params.contentId - The content ID to report (comment or media)
   * @param {string} params.contentType - Type of content ('comment' or 'media')
   * @param {string} params.reason - Reason for reporting
   * @param {string} params.organizationId - Organization ID for multi-tenant support
   * @returns {Promise<Object>} Result of the action
   */
  async reportContent({ contentId, contentType, reason, organizationId }) {
    try {
      logger.info(
        'Reporting Instagram content',
        sanitizeForLogging({
          contentId,
          contentType,
          reason,
          organizationId,
          platform: this.platform
        })
      );

      // Instagram API doesn't provide programmatic content reporting
      // This would typically redirect to Instagram's reporting interface
      const result = await instagramService.reportContent({
        contentId,
        contentType,
        reason,
        organizationId
      });

      // Validate service response
      if (!result || result.error) {
        throw new Error(result?.error || 'Instagram service returned invalid response');
      }

      logger.info('Instagram content reported successfully', {
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
      logger.error('Failed to report Instagram content', {
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
      logger.info(
        'Executing Instagram Shield action',
        sanitizeForLogging({
          action,
          params,
          platform: this.platform
        })
      );

      if (!this.capabilities.includes(action)) {
        throw new Error(`Action '${action}' not supported by ${this.platform} adapter`);
      }

      switch (action) {
        case 'hideComment':
          return await this.hideComment(params);
        case 'reportUser':
          return await this.reportUser(params);
        case 'reportContent':
          return await this.reportContent(params);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      logger.error(
        'Failed to execute Instagram Shield action',
        sanitizeForLogging({
          action,
          params,
          error: error.message,
          stack: error.stack
        })
      );

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

module.exports = InstagramAdapter;
