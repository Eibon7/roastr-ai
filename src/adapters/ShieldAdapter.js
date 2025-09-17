/**
 * Base Shield Adapter Interface
 * 
 * Unified interface for executing Shield moderation actions across platforms.
 * All platform adapters must implement this contract.
 */

/**
 * Moderation Input data structure
 */
class ModerationInput {
  constructor({
    platform,
    commentId,
    userId,
    username,
    reason,
    orgId,
    metadata = {}
  }) {
    this.platform = platform;
    this.commentId = commentId;
    this.userId = userId;
    this.username = username;
    this.reason = reason;
    this.orgId = orgId;
    this.metadata = metadata;
  }
}

/**
 * Base Shield Adapter class
 */
class ShieldAdapter {
  constructor(config = {}) {
    this.config = config;
    this.platform = null;
    this.ready = false;
  }

  /**
   * Initialize the adapter
   */
  async initialize() {
    throw new Error('initialize() must be implemented by platform adapter');
  }

  /**
   * Check if adapter is ready
   */
  isReady() {
    return this.ready;
  }

  /**
   * Get platform name
   */
  getPlatform() {
    return this.platform;
  }

  /**
   * Get platform capabilities
   */
  capabilities() {
    throw new Error('capabilities() must be implemented by platform adapter');
  }

  /**
   * Hide/delete a comment
   */
  async hideComment(moderationInput) {
    throw new Error('hideComment() must be implemented by platform adapter');
  }

  /**
   * Report a user to platform moderation
   */
  async reportUser(moderationInput) {
    throw new Error('reportUser() must be implemented by platform adapter');
  }

  /**
   * Block a user
   */
  async blockUser(moderationInput) {
    throw new Error('blockUser() must be implemented by platform adapter');
  }

  /**
   * Unblock a user
   */
  async unblockUser(moderationInput) {
    throw new Error('unblockUser() must be implemented by platform adapter');
  }
}

module.exports = {
  ShieldAdapter,
  ModerationInput
};