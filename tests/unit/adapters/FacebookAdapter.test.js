const FacebookAdapter = require('../../../src/adapters/FacebookAdapter');
const facebookService = require('../../../src/integrations/facebook/facebookService');
const logger = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/integrations/facebook/facebookService');
jest.mock('../../../src/utils/logger');

describe('FacebookAdapter', () => {
  let adapter;
  const mockConfig = { apiVersion: 'v18.0' };

  beforeEach(() => {
    adapter = new FacebookAdapter(mockConfig);
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct platform and capabilities', () => {
      expect(adapter.platform).toBe('facebook');
      expect(adapter.capabilities).toEqual([
        'hideComment',
        'reportUser',
        'blockUser',
        'unblockUser',
        'reportContent',
        'deleteComment'
      ]);
      expect(adapter.config).toEqual(mockConfig);
    });

    it('should log initialization', () => {
      expect(logger.info).toHaveBeenCalledWith('FacebookAdapter initialized', {
        platform: 'facebook',
        capabilities: ['hideComment', 'reportUser', 'blockUser', 'unblockUser', 'reportContent', 'deleteComment']
      });
    });
  });

  describe('getCapabilities', () => {
    it('should return array of capabilities', () => {
      const capabilities = adapter.getCapabilities();
      expect(capabilities).toEqual([
        'hideComment',
        'reportUser',
        'blockUser',
        'unblockUser',
        'reportContent',
        'deleteComment'
      ]);
      expect(capabilities).not.toBe(adapter.capabilities); // Should be a copy
    });
  });

  describe('hideComment', () => {
    const params = {
      commentId: 'comment_123',
      postId: 'post_456',
      organizationId: 'org_789'
    };

    it('should hide comment successfully', async () => {
      const mockResult = { id: 'comment_123', hidden: true };
      facebookService.hideComment.mockResolvedValue(mockResult);

      const result = await adapter.hideComment(params);

      expect(facebookService.hideComment).toHaveBeenCalledWith(params);
      expect(logger.info).toHaveBeenCalledWith('Hiding Facebook comment', {
        ...params,
        platform: 'facebook'
      });
      expect(logger.info).toHaveBeenCalledWith('Facebook comment hidden successfully', {
        commentId: params.commentId,
        result: mockResult
      });
      expect(result).toEqual({
        success: true,
        action: 'hideComment',
        platform: 'facebook',
        commentId: params.commentId,
        postId: params.postId,
        result: mockResult
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('API Error');
      facebookService.hideComment.mockRejectedValue(error);

      const result = await adapter.hideComment(params);

      expect(logger.error).toHaveBeenCalledWith('Failed to hide Facebook comment', {
        commentId: params.commentId,
        postId: params.postId,
        error: error.message,
        stack: error.stack
      });
      expect(result).toEqual({
        success: false,
        action: 'hideComment',
        platform: 'facebook',
        commentId: params.commentId,
        postId: params.postId,
        error: error.message
      });
    });
  });

  describe('deleteComment', () => {
    const params = {
      commentId: 'comment_123',
      postId: 'post_456',
      organizationId: 'org_789'
    };

    it('should delete comment successfully', async () => {
      const mockResult = { success: true };
      facebookService.deleteComment.mockResolvedValue(mockResult);

      const result = await adapter.deleteComment(params);

      expect(facebookService.deleteComment).toHaveBeenCalledWith(params);
      expect(logger.info).toHaveBeenCalledWith('Deleting Facebook comment', {
        ...params,
        platform: 'facebook'
      });
      expect(result).toEqual({
        success: true,
        action: 'deleteComment',
        platform: 'facebook',
        commentId: params.commentId,
        postId: params.postId,
        result: mockResult
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('API Error');
      facebookService.deleteComment.mockRejectedValue(error);

      const result = await adapter.deleteComment(params);

      expect(logger.error).toHaveBeenCalledWith('Failed to delete Facebook comment', {
        commentId: params.commentId,
        postId: params.postId,
        error: error.message,
        stack: error.stack
      });
      expect(result).toEqual({
        success: false,
        action: 'deleteComment',
        platform: 'facebook',
        commentId: params.commentId,
        postId: params.postId,
        error: error.message
      });
    });
  });

  describe('reportUser', () => {
    const params = {
      userId: 'user_123',
      reason: 'harassment',
      organizationId: 'org_789'
    };

    it('should report user successfully', async () => {
      const mockResult = { userId: 'user_123', reported: true };
      facebookService.reportUser.mockResolvedValue(mockResult);

      const result = await adapter.reportUser(params);

      expect(facebookService.reportUser).toHaveBeenCalledWith(params);
      expect(logger.info).toHaveBeenCalledWith('Reporting Facebook user', {
        ...params,
        platform: 'facebook'
      });
      expect(result).toEqual({
        success: true,
        action: 'reportUser',
        platform: 'facebook',
        userId: params.userId,
        reason: params.reason,
        result: mockResult
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('API Error');
      facebookService.reportUser.mockRejectedValue(error);

      const result = await adapter.reportUser(params);

      expect(logger.error).toHaveBeenCalledWith('Failed to report Facebook user', {
        userId: params.userId,
        reason: params.reason,
        error: error.message,
        stack: error.stack
      });
      expect(result).toEqual({
        success: false,
        action: 'reportUser',
        platform: 'facebook',
        userId: params.userId,
        reason: params.reason,
        error: error.message
      });
    });
  });

  describe('blockUser', () => {
    const params = {
      userId: 'user_123',
      organizationId: 'org_789'
    };

    it('should block user successfully', async () => {
      const mockResult = { userId: 'user_123', blocked: true };
      facebookService.blockUser.mockResolvedValue(mockResult);

      const result = await adapter.blockUser(params);

      expect(facebookService.blockUser).toHaveBeenCalledWith(params);
      expect(logger.info).toHaveBeenCalledWith('Blocking Facebook user', {
        ...params,
        platform: 'facebook'
      });
      expect(result).toEqual({
        success: true,
        action: 'blockUser',
        platform: 'facebook',
        userId: params.userId,
        result: mockResult
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('API Error');
      facebookService.blockUser.mockRejectedValue(error);

      const result = await adapter.blockUser(params);

      expect(logger.error).toHaveBeenCalledWith('Failed to block Facebook user', {
        userId: params.userId,
        error: error.message,
        stack: error.stack
      });
      expect(result).toEqual({
        success: false,
        action: 'blockUser',
        platform: 'facebook',
        userId: params.userId,
        error: error.message
      });
    });
  });

  describe('unblockUser', () => {
    const params = {
      userId: 'user_123',
      organizationId: 'org_789'
    };

    it('should unblock user successfully', async () => {
      const mockResult = { userId: 'user_123', unblocked: true };
      facebookService.unblockUser.mockResolvedValue(mockResult);

      const result = await adapter.unblockUser(params);

      expect(facebookService.unblockUser).toHaveBeenCalledWith(params);
      expect(logger.info).toHaveBeenCalledWith('Unblocking Facebook user', {
        ...params,
        platform: 'facebook'
      });
      expect(result).toEqual({
        success: true,
        action: 'unblockUser',
        platform: 'facebook',
        userId: params.userId,
        result: mockResult
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('API Error');
      facebookService.unblockUser.mockRejectedValue(error);

      const result = await adapter.unblockUser(params);

      expect(logger.error).toHaveBeenCalledWith('Failed to unblock Facebook user', {
        userId: params.userId,
        error: error.message,
        stack: error.stack
      });
      expect(result).toEqual({
        success: false,
        action: 'unblockUser',
        platform: 'facebook',
        userId: params.userId,
        error: error.message
      });
    });
  });

  describe('reportContent', () => {
    const params = {
      contentId: 'content_123',
      contentType: 'comment',
      reason: 'spam',
      organizationId: 'org_789'
    };

    it('should report content successfully', async () => {
      const mockResult = { contentId: 'content_123', reported: true };
      facebookService.reportContent.mockResolvedValue(mockResult);

      const result = await adapter.reportContent(params);

      expect(facebookService.reportContent).toHaveBeenCalledWith(params);
      expect(logger.info).toHaveBeenCalledWith('Reporting Facebook content', {
        ...params,
        platform: 'facebook'
      });
      expect(result).toEqual({
        success: true,
        action: 'reportContent',
        platform: 'facebook',
        contentId: params.contentId,
        contentType: params.contentType,
        reason: params.reason,
        result: mockResult
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('API Error');
      facebookService.reportContent.mockRejectedValue(error);

      const result = await adapter.reportContent(params);

      expect(logger.error).toHaveBeenCalledWith('Failed to report Facebook content', {
        contentId: params.contentId,
        contentType: params.contentType,
        reason: params.reason,
        error: error.message,
        stack: error.stack
      });
      expect(result).toEqual({
        success: false,
        action: 'reportContent',
        platform: 'facebook',
        contentId: params.contentId,
        contentType: params.contentType,
        reason: params.reason,
        error: error.message
      });
    });
  });

  describe('executeAction', () => {
    it('should execute supported actions', async () => {
      const params = { commentId: 'comment_123', postId: 'post_456', organizationId: 'org_789' };
      const mockResult = { success: true };
      facebookService.hideComment.mockResolvedValue(mockResult);

      const result = await adapter.executeAction('hideComment', params);

      expect(logger.info).toHaveBeenCalledWith('Executing Facebook Shield action', {
        action: 'hideComment',
        params,
        platform: 'facebook'
      });
      expect(result.success).toBe(true);
      expect(result.action).toBe('hideComment');
    });

    it('should execute all supported actions', async () => {
      const actions = [
        { action: 'deleteComment', params: { commentId: 'comment_123', postId: 'post_456', organizationId: 'org_789' } },
        { action: 'reportUser', params: { userId: 'user_123', reason: 'spam', organizationId: 'org_789' } },
        { action: 'blockUser', params: { userId: 'user_123', organizationId: 'org_789' } },
        { action: 'unblockUser', params: { userId: 'user_123', organizationId: 'org_789' } },
        { action: 'reportContent', params: { contentId: 'content_123', contentType: 'post', reason: 'spam', organizationId: 'org_789' } }
      ];

      // Mock all service methods
      facebookService.deleteComment.mockResolvedValue({ success: true });
      facebookService.reportUser.mockResolvedValue({ success: true });
      facebookService.blockUser.mockResolvedValue({ success: true });
      facebookService.unblockUser.mockResolvedValue({ success: true });
      facebookService.reportContent.mockResolvedValue({ success: true });

      for (const { action, params } of actions) {
        const result = await adapter.executeAction(action, params);
        expect(result.success).toBe(true);
        expect(result.action).toBe(action);
      }
    });

    it('should reject unsupported actions', async () => {
      const params = { userId: 'user_123' };
      
      const result = await adapter.executeAction('unsupportedAction', params);

      expect(result).toEqual({
        success: false,
        action: 'unsupportedAction',
        platform: 'facebook',
        error: "Action 'unsupportedAction' not supported by facebook adapter"
      });
    });

    it('should handle execution errors', async () => {
      const params = { commentId: 'comment_123', postId: 'post_456', organizationId: 'org_789' };
      const error = new Error('Execution failed');
      facebookService.hideComment.mockRejectedValue(error);

      const result = await adapter.executeAction('hideComment', params);

      expect(logger.error).toHaveBeenCalledWith('Failed to execute Facebook Shield action', {
        action: 'hideComment',
        params,
        error: error.message,
        stack: error.stack
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe(error.message);
    });
  });

  describe('supportsAction', () => {
    it('should return true for supported actions', () => {
      expect(adapter.supportsAction('hideComment')).toBe(true);
      expect(adapter.supportsAction('deleteComment')).toBe(true);
      expect(adapter.supportsAction('reportUser')).toBe(true);
      expect(adapter.supportsAction('blockUser')).toBe(true);
      expect(adapter.supportsAction('unblockUser')).toBe(true);
      expect(adapter.supportsAction('reportContent')).toBe(true);
    });

    it('should return false for unsupported actions', () => {
      expect(adapter.supportsAction('muteUser')).toBe(false);
      expect(adapter.supportsAction('invalidAction')).toBe(false);
    });
  });

  describe('getInfo', () => {
    it('should return adapter information', () => {
      const info = adapter.getInfo();
      
      expect(info).toEqual({
        platform: 'facebook',
        capabilities: ['hideComment', 'reportUser', 'blockUser', 'unblockUser', 'reportContent', 'deleteComment'],
        config: mockConfig
      });
    });
  });
});