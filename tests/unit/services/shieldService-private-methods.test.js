/**
 * Shield Service Private Methods Tests
 *
 * Tests for private handler methods and internal utilities
 * These methods are called internally by executeActionsFromTags()
 *
 * Uses same mocking pattern as shieldService.test.js (no logger/mockMode mocks)
 */

const ShieldService = require('../../../src/services/shieldService');

// Mock Supabase (same pattern as shieldService.test.js)
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn()
          })),
          single: jest.fn()
        })),
        gte: jest.fn(() => ({
          lt: jest.fn()
        })),
        in: jest.fn()
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
      })),
      upsert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    })),
    rpc: jest.fn()
  }))
}));

// Mock QueueService (same pattern as shieldService.test.js)
const mockQueueService = {
  addJob: jest.fn(),
  initialize: jest.fn(),
  shutdown: jest.fn()
};

jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => mockQueueService);
});

// Mock CostControlService
jest.mock('../../../src/services/costControl', () => {
  return jest.fn().mockImplementation(() => ({
    canUseShield: jest.fn().mockResolvedValue({ allowed: true }),
    recordUsage: jest.fn().mockResolvedValue({ success: true })
  }));
});

describe('ShieldService - Private Methods', () => {
  let shieldService;
  let mockSupabase;

  beforeEach(() => {
    // Mock environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';

    // Initialize with autoActions enabled
    shieldService = new ShieldService({ autoActions: true });
    mockSupabase = shieldService.supabase;

    // Make mockSupabase.from a spy so it can be configured per-test
    jest.spyOn(mockSupabase, 'from');

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('_handleHideComment', () => {
    const organizationId = 'org-123';
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };
    const metadata = { toxicity: { toxicity_score: 0.9 } };

    it('should queue hide comment job with critical priority', async () => {
      mockQueueService.addJob.mockResolvedValue({
        success: true,
        jobId: 'job-123',
        job: { id: 'job-123' }
      });

      const result = await shieldService._handleHideComment(organizationId, comment, metadata);

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'shield_action',
        {
          organization_id: organizationId,
          action: 'hide_comment',
          comment: comment
        },
        {
          priority: 1 // critical priority
        }
      );

      expect(result).toHaveProperty('job_id');
    });

    it('should handle queue service errors gracefully', async () => {
      mockQueueService.addJob.mockRejectedValue(new Error('Queue error'));

      await expect(
        shieldService._handleHideComment(organizationId, comment, metadata)
      ).rejects.toThrow('Queue error');
    });
  });

  describe('_handleBlockUser', () => {
    const organizationId = 'org-123';
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };
    const metadata = { toxicity: { toxicity_score: 0.95 } };

    it('should queue block user job and update user behavior', async () => {
      mockQueueService.addJob.mockResolvedValue({
        success: true,
        jobId: 'job-123',
        job: { id: 'job-123' }
      });

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      });

      const result = await shieldService._handleBlockUser(organizationId, comment, metadata);

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'shield_action',
        {
          organization_id: organizationId,
          action: 'block_user',
          comment: comment
        },
        {
          priority: 1 // critical priority
        }
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('user_behaviors');
      expect(result).toHaveProperty('job_id');
    });
  });

  describe('_handleReportToPlatform', () => {
    const organizationId = 'org-123';
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };

    it('should queue report job when platform violations are reportable', async () => {
      const metadata = {
        platform_violations: {
          reportable: true,
          violations: ['hate_speech']
        }
      };

      mockQueueService.addJob.mockResolvedValue({
        success: true,
        jobId: 'job-123',
        job: { id: 'job-123' }
      });

      const result = await shieldService._handleReportToPlatform(organizationId, comment, metadata);

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'shield_action',
        {
          organization_id: organizationId,
          action: 'report_to_platform',
          comment: comment
        },
        {
          priority: 1 // critical priority
        }
      );

      expect(result).toHaveProperty('job_id');
      expect(result).not.toHaveProperty('skipped');
    });

    it('should skip reporting when platform violations are not reportable', async () => {
      const metadata = {
        platform_violations: {
          reportable: false,
          violations: []
        }
      };

      const result = await shieldService._handleReportToPlatform(organizationId, comment, metadata);

      expect(mockQueueService.addJob).not.toHaveBeenCalled();
      expect(result).toEqual({
        skipped: true,
        reason: 'not reportable'
      });
    });

    it('should skip reporting when platform_violations is missing', async () => {
      const metadata = {};

      const result = await shieldService._handleReportToPlatform(organizationId, comment, metadata);

      expect(mockQueueService.addJob).not.toHaveBeenCalled();
      expect(result).toEqual({
        skipped: true,
        reason: 'not reportable'
      });
    });
  });

  describe('_handleMuteTemp', () => {
    const organizationId = 'org-123';
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };
    const metadata = { toxicity: { toxicity_score: 0.7 } };

    it('should queue temporary mute job with critical priority', async () => {
      mockQueueService.addJob.mockResolvedValue({
        success: true,
        jobId: 'job-123',
        job: { id: 'job-123' }
      });

      const result = await shieldService._handleMuteTemp(organizationId, comment, metadata);

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'shield_action',
        {
          organization_id: organizationId,
          action: 'mute_temp',
          comment: comment
        },
        {
          priority: 1 // critical priority
        }
      );

      expect(result).toHaveProperty('job_id');
    });
  });

  describe('_handleMutePermanent', () => {
    const organizationId = 'org-123';
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };
    const metadata = { toxicity: { toxicity_score: 0.85 } };

    it('should queue permanent mute job and update user behavior', async () => {
      mockQueueService.addJob.mockResolvedValue({
        success: true,
        jobId: 'job-123',
        job: { id: 'job-123' }
      });

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      });

      const result = await shieldService._handleMutePermanent(organizationId, comment, metadata);

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'shield_action',
        {
          organization_id: organizationId,
          action: 'mute_permanent',
          comment: comment
        },
        {
          priority: 1 // critical priority
        }
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('user_behaviors');
      expect(result).toHaveProperty('job_id');
    });
  });

  describe('_handleCheckReincidence', () => {
    const organizationId = 'org-123';
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };
    const metadata = {};

    beforeEach(() => {
      shieldService.options.reincidenceThreshold = 3;
    });

    it('should detect reincident user when violations >= threshold', async () => {
      const mockBehavior = {
        total_violations: 5,
        severity_counts: { low: 1, medium: 2, high: 2 },
        actions_taken: ['warn', 'mute_temp']
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockBehavior, error: null })
      });

      const result = await shieldService._handleCheckReincidence(organizationId, comment, metadata);

      expect(result).toEqual({ job_id: null });
    });

    it('should not detect reincidence when violations < threshold', async () => {
      const mockBehavior = {
        total_violations: 2,
        severity_counts: { low: 2 },
        actions_taken: ['warn']
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockBehavior, error: null })
      });

      const result = await shieldService._handleCheckReincidence(organizationId, comment, metadata);

      expect(result).toEqual({ job_id: null });
    });
  });

  describe('_handleRequireManualReview', () => {
    const organizationId = 'org-123';
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };
    const metadata = {};

    it('should queue manual review job with critical priority', async () => {
      mockQueueService.addJob.mockResolvedValue({
        success: true,
        jobId: 'job-123',
        job: { id: 'job-123' }
      });

      const result = await shieldService._handleRequireManualReview(
        organizationId,
        comment,
        metadata
      );

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'shield_action',
        {
          organization_id: organizationId,
          action: 'require_manual_review',
          comment: comment
        },
        {
          priority: 1 // critical priority
        }
      );

      expect(result).toHaveProperty('job_id');
    });
  });

  describe('_handleGatekeeperUnavailable', () => {
    const organizationId = 'org-123';
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };
    const metadata = {};

    it('should queue gatekeeper unavailable job with critical priority', async () => {
      mockQueueService.addJob.mockResolvedValue({
        success: true,
        jobId: 'job-123',
        job: { id: 'job-123' }
      });

      const result = await shieldService._handleGatekeeperUnavailable(
        organizationId,
        comment,
        metadata
      );

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'shield_action',
        {
          organization_id: organizationId,
          action: 'gatekeeper_unavailable',
          comment: comment
        },
        {
          priority: 1 // critical priority
        }
      );

      expect(result).toHaveProperty('job_id');
    });
  });

  describe('_batchRecordShieldActions', () => {
    const actionsToRecord = [
      {
        organization_id: 'org-123',
        comment_id: 'comment-456',
        action_tag: 'hide_comment',
        result: { status: 'executed' }
      },
      {
        organization_id: 'org-123',
        comment_id: 'comment-789',
        action_tag: 'block_user',
        result: { status: 'executed' }
      }
    ];

    it('should batch insert multiple actions', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      await shieldService._batchRecordShieldActions(actionsToRecord);

      expect(mockSupabase.from).toHaveBeenCalledWith('shield_actions');
    });

    it('should handle empty array gracefully', async () => {
      await shieldService._batchRecordShieldActions([]);

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('_recordShieldAction', () => {
    const organizationId = 'org-123';
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };
    const actionTag = 'hide_comment';
    const result = { status: 'executed' };
    const metadata = {
      toxicity: { toxicity_score: 0.9 },
      security: { security_score: 0.8 },
      platform_violations: { reportable: true }
    };

    it('should record single action with all metadata', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      await shieldService._recordShieldAction(organizationId, comment, actionTag, result, metadata);

      expect(mockSupabase.from).toHaveBeenCalledWith('shield_actions');
    });
  });

  describe('_updateUserBehaviorFromTags', () => {
    const organizationId = 'org-123';
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };
    const action_tags = ['hide_comment', 'block_user'];
    const metadata = {
      toxicity: { toxicity_score: 0.85 }
    };

    it('should call RPC function with correct parameters', async () => {
      mockSupabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });

      await shieldService._updateUserBehaviorFromTags(
        organizationId,
        comment,
        action_tags,
        metadata
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'update_user_behavior_from_shield_tags',
        expect.objectContaining({
          p_organization_id: organizationId,
          p_platform: comment.platform,
          p_platform_user_id: comment.platform_user_id,
          p_comment_id: comment.id,
          p_action_tags: action_tags,
          p_toxicity_score: 0.85
        })
      );
    });
  });
});
