/**
 * Shield Action Worker Tests
 * 
 * Tests for executing automated Shield moderation actions
 */

const ShieldActionWorker = require('../../../src/workers/ShieldActionWorker');

// Mock BaseWorker
jest.mock('../../../src/workers/BaseWorker', () => {
  return jest.fn().mockImplementation((workerType, options) => {
    const mockBaseWorker = {
      workerType,
      workerName: `${workerType}-worker-test`,
      config: { maxRetries: 3, ...options },
      supabase: {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn()
            }))
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn()
            }))
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn()
              }))
            }))
          }))
        }))
      },
      queueService: {
        addJob: jest.fn(),
        initialize: jest.fn(),
        shutdown: jest.fn()
      },
      log: jest.fn(),
      processJob: null, // Will be overridden by actual implementation
      start: jest.fn(),
      stop: jest.fn(),
      initializeConnections: jest.fn(),
      setupGracefulShutdown: jest.fn()
    };
    return mockBaseWorker;
  });
});

// Mock platform integrations
const mockTwitterService = {
  muteUser: jest.fn(),
  blockUser: jest.fn(),
  reportUser: jest.fn(),
  removeContent: jest.fn(),
  sendDM: jest.fn(),
  initialize: jest.fn()
};

const mockYouTubeService = {
  muteUser: jest.fn(),
  blockUser: jest.fn(),
  reportUser: jest.fn(),
  removeContent: jest.fn(),
  initialize: jest.fn()
};

jest.mock('../../../src/integrations/twitter/twitterService', () => mockTwitterService);
jest.mock('../../../src/integrations/youtube/youtubeService', () => mockYouTubeService);

describe('ShieldActionWorker', () => {
  let worker;
  let mockSupabase;

  beforeEach(() => {
    worker = new ShieldActionWorker();
    mockSupabase = worker.supabase;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize worker with correct type', () => {
      expect(worker.workerType).toBe('shield_action');
      expect(worker.integrations).toBeDefined();
      expect(worker.integrations.twitter).toBe(mockTwitterService);
      expect(worker.integrations.youtube).toBe(mockYouTubeService);
    });
  });

  describe('processJob', () => {
    test('should execute warning action', async () => {
      const job = {
        id: 'job-123',
        organization_id: 'org-123',
        platform: 'twitter',
        action_type: 'warning',
        user_id: 'user-456',
        comment_id: 'comment-789',
        payload: {
          warning_message: 'Please keep comments respectful',
          toxicity_score: 0.75,
          categories: ['TOXICITY']
        }
      };

      mockTwitterService.sendDM.mockResolvedValue({
        success: true,
        message_id: 'dm-123'
      });

      // Mock action update
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.action_type).toBe('warning');
      expect(result.platform).toBe('twitter');
      expect(result.details.message_id).toBe('dm-123');

      expect(mockTwitterService.sendDM).toHaveBeenCalledWith(
        'user-456',
        'Please keep comments respectful'
      );
    });

    test('should execute temporary mute action', async () => {
      const job = {
        id: 'job-456',
        organization_id: 'org-123',
        platform: 'twitter',
        action_type: 'temporary_mute',
        user_id: 'user-789',
        comment_id: 'comment-123',
        payload: {
          duration_hours: 24,
          reason: 'Toxic behavior'
        }
      };

      mockTwitterService.muteUser.mockResolvedValue({
        success: true,
        mute_id: 'mute-456',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.action_type).toBe('temporary_mute');
      expect(result.details.mute_id).toBe('mute-456');
      expect(result.details.expires_at).toBeDefined();

      expect(mockTwitterService.muteUser).toHaveBeenCalledWith('user-789', {
        duration_hours: 24,
        reason: 'Toxic behavior'
      });
    });

    test('should execute content removal action', async () => {
      const job = {
        id: 'job-789',
        organization_id: 'org-123',
        platform: 'youtube',
        action_type: 'content_removal',
        user_id: 'user-123',
        comment_id: 'comment-456',
        payload: {
          removal_reason: 'Violates community guidelines'
        }
      };

      mockYouTubeService.removeContent.mockResolvedValue({
        success: true,
        removal_id: 'removal-789'
      });

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.action_type).toBe('content_removal');
      expect(result.details.removal_id).toBe('removal-789');

      expect(mockYouTubeService.removeContent).toHaveBeenCalledWith('comment-456', {
        reason: 'Violates community guidelines'
      });
    });

    test('should execute permanent ban action', async () => {
      const job = {
        id: 'job-ban',
        organization_id: 'org-123',
        platform: 'twitter',
        action_type: 'permanent_ban',
        user_id: 'user-toxic',
        payload: {
          ban_reason: 'Repeated severe violations',
          evidence_urls: ['https://evidence1.com', 'https://evidence2.com']
        }
      };

      mockTwitterService.blockUser.mockResolvedValue({
        success: true,
        block_id: 'block-permanent'
      });

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.action_type).toBe('permanent_ban');
      expect(result.details.block_id).toBe('block-permanent');

      expect(mockTwitterService.blockUser).toHaveBeenCalledWith('user-toxic', {
        reason: 'Repeated severe violations',
        evidence_urls: ['https://evidence1.com', 'https://evidence2.com']
      });
    });

    test('should execute escalate to human action', async () => {
      const job = {
        id: 'job-escalate',
        organization_id: 'org-123',
        platform: 'twitter',
        action_type: 'escalate_to_human',
        user_id: 'user-complex',
        comment_id: 'comment-complex',
        payload: {
          escalation_reason: 'Complex case requiring human review',
          severity: 'high',
          evidence: {
            toxicity_score: 0.95,
            categories: ['THREAT', 'HARASSMENT']
          }
        }
      };

      // Mock escalation notification (could be Slack, email, etc.)
      const mockEscalationResult = {
        success: true,
        ticket_id: 'escalation-456',
        assigned_to: 'moderator@company.com'
      };

      // Mock the escalation process
      jest.spyOn(worker, 'createModerationTicket')
        .mockResolvedValue(mockEscalationResult);

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.action_type).toBe('escalate_to_human');
      expect(result.details.ticket_id).toBe('escalation-456');
    });

    test('should handle platform-specific action failures', async () => {
      const job = {
        id: 'job-fail',
        organization_id: 'org-123',
        platform: 'twitter',
        action_type: 'temporary_mute',
        user_id: 'user-protected',
        payload: { duration_hours: 24 }
      };

      mockTwitterService.muteUser.mockRejectedValue(
        new Error('User not found or protected')
      );

      const result = await worker.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('User not found or protected');
      expect(result.action_type).toBe('temporary_mute');
    });

    test('should handle unsupported platform', async () => {
      const job = {
        id: 'job-unsupported',
        organization_id: 'org-123',
        platform: 'unsupported_platform',
        action_type: 'warning',
        user_id: 'user-123'
      };

      await expect(worker.processJob(job)).rejects.toThrow(
        'Unsupported platform: unsupported_platform'
      );
    });

    test('should handle unsupported action type', async () => {
      const job = {
        id: 'job-bad-action',
        organization_id: 'org-123',
        platform: 'twitter',
        action_type: 'unsupported_action',
        user_id: 'user-123'
      };

      await expect(worker.processJob(job)).rejects.toThrow(
        'Unsupported action type: unsupported_action'
      );
    });
  });

  describe('executeWarning', () => {
    test('should send warning DM', async () => {
      const job = {
        platform: 'twitter',
        user_id: 'user-123'
      };

      const payload = {
        warning_message: 'Please follow community guidelines'
      };

      mockTwitterService.sendDM.mockResolvedValue({
        success: true,
        message_id: 'dm-warning'
      });

      const result = await worker.executeWarning(job, payload);

      expect(result.success).toBe(true);
      expect(result.message_id).toBe('dm-warning');
    });

    test('should handle warning failure', async () => {
      const job = { platform: 'twitter', user_id: 'user-invalid' };
      const payload = { warning_message: 'Warning' };

      mockTwitterService.sendDM.mockRejectedValue(
        new Error('DM sending failed')
      );

      await expect(worker.executeWarning(job, payload)).rejects.toThrow(
        'DM sending failed'
      );
    });
  });

  describe('executeMute', () => {
    test('should mute user temporarily', async () => {
      const job = { platform: 'youtube', user_id: 'user-456' };
      const payload = { duration_hours: 48, reason: 'Harassment' };

      mockYouTubeService.muteUser.mockResolvedValue({
        success: true,
        mute_id: 'mute-youtube',
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      });

      const result = await worker.executeMute(job, payload);

      expect(result.success).toBe(true);
      expect(result.mute_id).toBe('mute-youtube');
      expect(result.expires_at).toBeDefined();
    });
  });

  describe('executeContentRemoval', () => {
    test('should remove toxic content', async () => {
      const job = {
        platform: 'twitter',
        comment_id: 'comment-toxic'
      };

      const payload = {
        removal_reason: 'Hate speech'
      };

      mockTwitterService.removeContent.mockResolvedValue({
        success: true,
        removal_id: 'removal-123'
      });

      const result = await worker.executeContentRemoval(job, payload);

      expect(result.success).toBe(true);
      expect(result.removal_id).toBe('removal-123');
    });
  });

  describe('executeBlock', () => {
    test('should block user permanently', async () => {
      const job = { platform: 'twitter', user_id: 'user-toxic' };
      const payload = { ban_reason: 'Repeated violations' };

      mockTwitterService.blockUser.mockResolvedValue({
        success: true,
        block_id: 'block-permanent'
      });

      const result = await worker.executeBlock(job, payload);

      expect(result.success).toBe(true);
      expect(result.block_id).toBe('block-permanent');
    });
  });

  describe('executeReport', () => {
    test('should report user to platform', async () => {
      const job = { platform: 'youtube', user_id: 'user-violator' };
      const payload = {
        report_reason: 'Harassment',
        evidence_urls: ['https://evidence.com']
      };

      mockYouTubeService.reportUser.mockResolvedValue({
        success: true,
        report_id: 'report-789'
      });

      const result = await worker.executeReport(job, payload);

      expect(result.success).toBe(true);
      expect(result.report_id).toBe('report-789');
    });
  });

  describe('createModerationTicket', () => {
    test('should create escalation ticket for human review', async () => {
      const job = {
        organization_id: 'org-123',
        platform: 'twitter',
        user_id: 'user-complex',
        comment_id: 'comment-complex'
      };

      const payload = {
        escalation_reason: 'Edge case requiring human judgment',
        severity: 'medium',
        evidence: { toxicity_score: 0.65 }
      };

      // Mock ticket creation (this would integrate with ticketing system)
      const result = await worker.createModerationTicket(job, payload);

      expect(result.success).toBe(true);
      expect(result.ticket_id).toBeDefined();
      expect(result.priority).toBe('medium');
    });
  });

  describe('updateActionStatus', () => {
    test('should update action status in database', async () => {
      const jobId = 'job-123';
      const status = 'completed';
      const details = { action_result: 'success' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      await worker.updateActionStatus(jobId, status, details);

      expect(mockSupabase.from).toHaveBeenCalledWith('shield_actions');
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        status: 'completed',
        executed_at: expect.any(String),
        result_details: { action_result: 'success' }
      });
    });

    test('should handle database update errors', async () => {
      const jobId = 'job-error';
      const status = 'failed';
      const details = {};

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'Update failed' }
          })
        })
      });

      await expect(
        worker.updateActionStatus(jobId, status, details)
      ).rejects.toThrow('Update failed');
    });
  });

  describe('error handling', () => {
    test('should handle malformed job data', async () => {
      const malformedJob = {
        id: 'bad-job'
        // Missing required fields
      };

      await expect(worker.processJob(malformedJob)).rejects.toThrow();
    });

    test('should handle platform API rate limits', async () => {
      const job = {
        id: 'job-rate-limit',
        organization_id: 'org-123',
        platform: 'twitter',
        action_type: 'temporary_mute',
        user_id: 'user-123',
        payload: { duration_hours: 24 }
      };

      mockTwitterService.muteUser.mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      const result = await worker.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
      expect(result.retry_recommended).toBe(true);
    });

    test('should handle authentication errors', async () => {
      const job = {
        id: 'job-auth-error',
        organization_id: 'org-123',
        platform: 'twitter',
        action_type: 'warning',
        user_id: 'user-123',
        payload: { warning_message: 'Test' }
      };

      mockTwitterService.sendDM.mockRejectedValue(
        new Error('Authentication failed')
      );

      const result = await worker.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
      expect(result.requires_attention).toBe(true);
    });
  });

  describe('platform integration', () => {
    test('should initialize all platform services', async () => {
      await worker.initializePlatformServices();

      expect(mockTwitterService.initialize).toHaveBeenCalled();
      expect(mockYouTubeService.initialize).toHaveBeenCalled();
    });

    test('should handle platform initialization failures', async () => {
      mockTwitterService.initialize.mockRejectedValue(
        new Error('Twitter credentials invalid')
      );

      await expect(worker.initializePlatformServices()).rejects.toThrow(
        'Twitter credentials invalid'
      );
    });
  });
});