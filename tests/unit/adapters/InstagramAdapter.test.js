const InstagramAdapter = require('../../../src/adapters/InstagramAdapter');
const instagramService = require('../../../src/integrations/instagram/instagramService');
const logger = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/integrations/instagram/instagramService');
jest.mock('../../../src/utils/logger');

describe('InstagramAdapter', () => {
  let adapter;
  const mockConfig = { apiVersion: 'v1.0' };

  beforeEach(() => {
    adapter = new InstagramAdapter(mockConfig);
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct platform and capabilities', () => {
      expect(adapter.platform).toBe('instagram');
      expect(adapter.capabilities).toEqual([
        'hideComment',
        'reportUser',
        'reportContent'
      ]);
      expect(adapter.config).toEqual(mockConfig);
    });

    it('should log initialization', () => {
      expect(logger.info).toHaveBeenCalledWith('InstagramAdapter initialized', {
        platform: 'instagram',
        capabilities: ['hideComment', 'reportUser', 'reportContent']
      });
    });
  });

  describe('getCapabilities', () => {
    it('should return array of capabilities', () => {
      const capabilities = adapter.getCapabilities();
      expect(capabilities).toEqual([
        'hideComment',
        'reportUser',
        'reportContent'
      ]);
      expect(capabilities).not.toBe(adapter.capabilities); // Should be a copy
    });
  });

  describe('hideComment', () => {
    const params = {
      commentId: 'comment_123',
      mediaId: 'media_456',
      organizationId: 'org_789'
    };

    it('should hide comment successfully', async () => {
      const mockResult = { id: 'comment_123', hidden: true };
      instagramService.hideComment.mockResolvedValue(mockResult);

      const result = await adapter.hideComment(params);

      expect(instagramService.hideComment).toHaveBeenCalledWith(params);
      expect(logger.info).toHaveBeenCalledWith('Hiding Instagram comment', {
        ...params,
        platform: 'instagram'
      });
      expect(logger.info).toHaveBeenCalledWith('Instagram comment hidden successfully', {
        commentId: params.commentId,
        result: mockResult
      });
      expect(result).toEqual({
        success: true,
        action: 'hideComment',
        platform: 'instagram',
        commentId: params.commentId,
        mediaId: params.mediaId,
        result: mockResult
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('API Error');
      instagramService.hideComment.mockRejectedValue(error);

      const result = await adapter.hideComment(params);

      expect(logger.error).toHaveBeenCalledWith('Failed to hide Instagram comment', {
        commentId: params.commentId,
        mediaId: params.mediaId,
        error: error.message,
        stack: error.stack
      });
      expect(result).toEqual({
        success: false,
        action: 'hideComment',
        platform: 'instagram',
        commentId: params.commentId,
        mediaId: params.mediaId,
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
      instagramService.reportUser.mockResolvedValue(mockResult);

      const result = await adapter.reportUser(params);

      expect(instagramService.reportUser).toHaveBeenCalledWith(params);
      expect(logger.info).toHaveBeenCalledWith('Reporting Instagram user', {
        ...params,
        platform: 'instagram'
      });
      expect(result).toEqual({
        success: true,
        action: 'reportUser',
        platform: 'instagram',
        userId: params.userId,
        reason: params.reason,
        result: mockResult
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('API Error');
      instagramService.reportUser.mockRejectedValue(error);

      const result = await adapter.reportUser(params);

      expect(logger.error).toHaveBeenCalledWith('Failed to report Instagram user', {
        userId: params.userId,
        reason: params.reason,
        error: error.message,
        stack: error.stack
      });
      expect(result).toEqual({
        success: false,
        action: 'reportUser',
        platform: 'instagram',
        userId: params.userId,
        reason: params.reason,
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
      instagramService.reportContent.mockResolvedValue(mockResult);

      const result = await adapter.reportContent(params);

      expect(instagramService.reportContent).toHaveBeenCalledWith(params);
      expect(logger.info).toHaveBeenCalledWith('Reporting Instagram content', {
        ...params,
        platform: 'instagram'
      });
      expect(result).toEqual({
        success: true,
        action: 'reportContent',
        platform: 'instagram',
        contentId: params.contentId,
        contentType: params.contentType,
        reason: params.reason,
        result: mockResult
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('API Error');
      instagramService.reportContent.mockRejectedValue(error);

      const result = await adapter.reportContent(params);

      expect(logger.error).toHaveBeenCalledWith('Failed to report Instagram content', {
        contentId: params.contentId,
        contentType: params.contentType,
        reason: params.reason,
        error: error.message,
        stack: error.stack
      });
      expect(result).toEqual({
        success: false,
        action: 'reportContent',
        platform: 'instagram',
        contentId: params.contentId,
        contentType: params.contentType,
        reason: params.reason,
        error: error.message
      });
    });
  });

  describe('executeAction', () => {
    it('should execute supported actions', async () => {
      const params = { commentId: 'comment_123', mediaId: 'media_456', organizationId: 'org_789' };
      const mockResult = { success: true };
      instagramService.hideComment.mockResolvedValue(mockResult);

      const result = await adapter.executeAction('hideComment', params);

      expect(logger.info).toHaveBeenCalledWith('Executing Instagram Shield action', {
        action: 'hideComment',
        params,
        platform: 'instagram'
      });
      expect(result.success).toBe(true);
      expect(result.action).toBe('hideComment');
    });

    it('should reject unsupported actions', async () => {
      const params = { userId: 'user_123' };
      
      const result = await adapter.executeAction('unsupportedAction', params);

      expect(result).toEqual({
        success: false,
        action: 'unsupportedAction',
        platform: 'instagram',
        error: "Action 'unsupportedAction' not supported by instagram adapter"
      });
    });

    it('should handle unknown supported actions', async () => {
      const params = { userId: 'user_123' };
      
      const result = await adapter.executeAction('unknownAction', params);

      expect(result).toEqual({
        success: false,
        action: 'unknownAction',
        platform: 'instagram',
        error: "Action 'unknownAction' not supported by instagram adapter"
      });
    });

    it('should handle execution errors', async () => {
      const params = { commentId: 'comment_123', mediaId: 'media_456', organizationId: 'org_789' };
      const error = new Error('Execution failed');
      instagramService.hideComment.mockRejectedValue(error);

      const result = await adapter.executeAction('hideComment', params);

      expect(logger.error).toHaveBeenCalledWith('Failed to execute Instagram Shield action', {
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
      expect(adapter.supportsAction('reportUser')).toBe(true);
      expect(adapter.supportsAction('reportContent')).toBe(true);
    });

    it('should return false for unsupported actions', () => {
      expect(adapter.supportsAction('deleteComment')).toBe(false);
      expect(adapter.supportsAction('blockUser')).toBe(false);
      expect(adapter.supportsAction('invalidAction')).toBe(false);
    });
  });

  describe('getInfo', () => {
    it('should return adapter information', () => {
      const info = adapter.getInfo();
      
      expect(info).toEqual({
        platform: 'instagram',
        capabilities: ['hideComment', 'reportUser', 'reportContent'],
        config: mockConfig
      });
    });
  });
});