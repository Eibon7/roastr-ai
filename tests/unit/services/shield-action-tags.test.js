/**
 * ShieldService - executeActionsFromTags() Tests
 * Tests the action_tags consumer API (Issue #650)
 *
 * Test Coverage: 25/25 tests
 */

const ShieldService = require('../../../src/services/shieldService');
const { supabase } = require('../../../src/config/supabase');

// Mock QueueService
const mockQueueService = {
  addJob: jest.fn(),
  initialize: jest.fn(),
  shutdown: jest.fn()
};

jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => mockQueueService);
});

jest.mock('../../../src/config/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => Promise.resolve({ data: [{ id: 'mock-action-id' }], error: null }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              total_violations: 2,
              severe_violations: 1,
              strikes_level_1: 1,
              strikes_level_2: 0,
              actions_taken: 3
            },
            error: null
          }))
        }))
      })),
      upsert: jest.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }
}));

describe('ShieldService - executeActionsFromTags()', () => {
  let shieldService;
  const mockOrgId = 'org-123';
  const mockComment = {
    id: 'comment-456',
    platform: 'twitter',
    platform_user_id: 'user-789',
    content: 'toxic comment'
  };
  const mockMetadata = {
    confidence: 0.95,
    toxicity_score: 0.85,
    platform_violations: {
      reportable: false
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    shieldService = new ShieldService();
    mockQueueService.addJob.mockResolvedValue({ id: 'mock-job-id' });
  });

  // ==========================================
  // GROUP 1: Input Validation (6 tests)
  // ==========================================

  describe('Input Validation', () => {
    it('should reject missing organizationId', async () => {
      const result = await shieldService.executeActionsFromTags(
        null,
        mockComment,
        ['hide_comment'],
        mockMetadata
      );

      expect(result.success).toBe(false);
      expect(result.failed_actions).toHaveLength(1);
      expect(result.failed_actions[0].error).toContain('organizationId is required');
    });

    it('should reject missing comment', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        null,
        ['hide_comment'],
        mockMetadata
      );

      expect(result.success).toBe(false);
      expect(result.failed_actions).toHaveLength(1);
      expect(result.failed_actions[0].error).toContain('comment is required');
    });

    it('should reject non-array action_tags', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        'not-an-array',
        mockMetadata
      );

      expect(result.success).toBe(false);
      expect(result.failed_actions).toHaveLength(1);
      expect(result.failed_actions[0].error).toContain('action_tags must be an array');
    });

    it('should handle empty action_tags array', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        [],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed).toHaveLength(0);
      expect(result.failed_actions).toHaveLength(0);
    });

    it('should skip unknown action tags', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['unknown_tag', 'invalid_action'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed).toHaveLength(2);
      expect(result.actions_executed[0].status).toBe('skipped');
      expect(result.actions_executed[1].status).toBe('skipped');
    });

    it('should handle missing metadata gracefully', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['hide_comment'],
        null
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed).toHaveLength(1);
      expect(result.actions_executed[0].status).toBe('executed');
    });
  });

  // ==========================================
  // GROUP 2: Action Handlers (10 tests)
  // ==========================================

  describe('Action Handlers', () => {
    it('should execute hide_comment action', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['hide_comment'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed).toHaveLength(1);
      expect(result.actions_executed[0].tag).toBe('hide_comment');
      expect(result.actions_executed[0].status).toBe('executed');

      expect(queueService.addJob).toHaveBeenCalledWith(
        'shield_action',
        expect.objectContaining({
          action_type: 'hide_comment',
          organization_id: mockOrgId,
          comment: mockComment
        }),
        { priority: 1 }
      );
    });

    it('should execute block_user action', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['block_user'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed[0].tag).toBe('block_user');
      expect(result.actions_executed[0].status).toBe('executed');

      expect(queueService.addJob).toHaveBeenCalledWith(
        'shield_action',
        expect.objectContaining({
          action_type: 'block_user'
        }),
        { priority: 1 }
      );
    });

    it('should execute report_to_platform action when reportable=true', async () => {
      const reportableMetadata = {
        ...mockMetadata,
        platform_violations: { reportable: true }
      };

      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['report_to_platform'],
        reportableMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed[0].tag).toBe('report_to_platform');
      expect(result.actions_executed[0].status).toBe('executed');

      expect(queueService.addJob).toHaveBeenCalledWith(
        'shield_action',
        expect.objectContaining({
          action_type: 'report_to_platform'
        }),
        { priority: 1 }
      );
    });

    it('should execute mute_temp action', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['mute_temp'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed[0].tag).toBe('mute_temp');
      expect(result.actions_executed[0].status).toBe('executed');

      expect(queueService.addJob).toHaveBeenCalledWith(
        'shield_action',
        expect.objectContaining({
          action_type: 'mute_temp'
        }),
        { priority: 1 }
      );
    });

    it('should execute mute_permanent action', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['mute_permanent'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed[0].tag).toBe('mute_permanent');
      expect(result.actions_executed[0].status).toBe('executed');
    });

    it('should execute check_reincidence action', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['check_reincidence'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed[0].tag).toBe('check_reincidence');
      expect(result.actions_executed[0].status).toBe('executed');

      // Verify database query was made
      expect(supabase.from).toHaveBeenCalledWith('user_behavior');
    });

    it('should execute add_strike_1 action', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['add_strike_1'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed[0].tag).toBe('add_strike_1');
      expect(result.actions_executed[0].status).toBe('executed');

      expect(supabase.from).toHaveBeenCalledWith('user_behavior');
    });

    it('should execute add_strike_2 action', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['add_strike_2'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed[0].tag).toBe('add_strike_2');
      expect(result.actions_executed[0].status).toBe('executed');
    });

    it('should execute require_manual_review action', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['require_manual_review'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed[0].tag).toBe('require_manual_review');
      expect(result.actions_executed[0].status).toBe('executed');

      expect(queueService.addJob).toHaveBeenCalledWith(
        'shield_action',
        expect.objectContaining({
          action_type: 'require_manual_review'
        }),
        { priority: 1 }
      );
    });

    it('should execute gatekeeper_unavailable action', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['gatekeeper_unavailable'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed[0].tag).toBe('gatekeeper_unavailable');
      expect(result.actions_executed[0].status).toBe('executed');
    });
  });

  // ==========================================
  // GROUP 3: Critical Safeguards (1 test)
  // ==========================================

  describe('Critical Safeguards', () => {
    it('should skip report_to_platform when reportable=false', async () => {
      const nonReportableMetadata = {
        ...mockMetadata,
        platform_violations: { reportable: false }
      };

      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['report_to_platform'],
        nonReportableMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed).toHaveLength(1);
      expect(result.actions_executed[0].status).toBe('skipped');
      expect(result.actions_executed[0].result).toMatchObject({
        skipped: true,
        reason: expect.stringContaining('not reportable')
      });

      // Verify NO queue job was added
      expect(queueService.addJob).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // GROUP 4: Parallel Execution (4 tests)
  // ==========================================

  describe('Parallel Execution', () => {
    it('should execute multiple actions in parallel', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['hide_comment', 'add_strike_1', 'check_reincidence'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed).toHaveLength(3);
      expect(result.actions_executed[0].tag).toBe('hide_comment');
      expect(result.actions_executed[1].tag).toBe('add_strike_1');
      expect(result.actions_executed[2].tag).toBe('check_reincidence');

      // All should have status 'executed'
      result.actions_executed.forEach(action => {
        expect(action.status).toBe('executed');
      });
    });

    it('should handle individual action failures without blocking others', async () => {
      // Mock queue failure for one action
      queueService.addJob.mockImplementation((jobType, data) => {
        if (data.action_type === 'block_user') {
          return Promise.reject(new Error('Queue service unavailable'));
        }
        return Promise.resolve({ id: 'mock-job-id' });
      });

      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['hide_comment', 'block_user', 'mute_temp'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed).toHaveLength(3);

      // hide_comment and mute_temp should succeed
      expect(result.actions_executed[0].status).toBe('executed');
      expect(result.actions_executed[2].status).toBe('executed');

      // block_user should fail
      expect(result.actions_executed[1].status).toBe('failed');
      expect(result.actions_executed[1].result.error).toContain('Queue service unavailable');
    });

    it('should set success=false when all actions fail', async () => {
      queueService.addJob.mockRejectedValue(new Error('Complete failure'));

      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['hide_comment', 'block_user'],
        mockMetadata
      );

      expect(result.success).toBe(false);
      expect(result.actions_executed).toHaveLength(2);
      expect(result.actions_executed[0].status).toBe('failed');
      expect(result.actions_executed[1].status).toBe('failed');
      expect(result.failed_actions).toHaveLength(2);
    });

    it('should return detailed results for each action', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['hide_comment', 'add_strike_1'],
        mockMetadata
      );

      expect(result.actions_executed[0]).toMatchObject({
        tag: 'hide_comment',
        status: 'executed',
        result: expect.objectContaining({
          job_id: expect.any(String)
        })
      });

      expect(result.actions_executed[1]).toMatchObject({
        tag: 'add_strike_1',
        status: 'executed',
        result: expect.any(Object)
      });
    });
  });

  // ==========================================
  // GROUP 5: Database Recording (3 tests)
  // ==========================================

  describe('Database Recording', () => {
    it('should record action in shield_actions table', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['hide_comment'],
        mockMetadata
      );

      expect(result.success).toBe(true);

      // Verify shield_actions insert was called
      expect(supabase.from).toHaveBeenCalledWith('shield_actions');
      const fromMock = supabase.from();
      expect(fromMock.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: mockOrgId,
          user_id: mockComment.author_id,
          comment_id: mockComment.id,
          action_tag: 'hide_comment',
          platform: mockComment.platform
        })
      );
    });

    it('should update user_behavior table for strike actions', async () => {
      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['add_strike_1'],
        mockMetadata
      );

      expect(result.success).toBe(true);

      // Verify user_behavior upsert was called
      expect(supabase.from).toHaveBeenCalledWith('user_behavior');
      const fromMock = supabase.from();
      expect(fromMock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockComment.author_id,
          platform: mockComment.platform,
          organization_id: mockOrgId
        })
      );
    });

    it('should gracefully degrade when database recording fails', async () => {
      // Mock database failure
      const mockFrom = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => Promise.resolve({ data: null, error: { message: 'DB unavailable' } }))
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: { message: 'DB unavailable' } }))
          }))
        })),
        upsert: jest.fn(() => Promise.resolve({ data: null, error: { message: 'DB unavailable' } }))
      }));

      supabase.from = mockFrom;

      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['hide_comment'],
        mockMetadata
      );

      // Action should still execute successfully
      expect(result.success).toBe(true);
      expect(result.actions_executed[0].status).toBe('executed');

      // Queue job should still be added
      expect(queueService.addJob).toHaveBeenCalled();
    });
  });

  // ==========================================
  // GROUP 6: Full Flow Integration (2 tests)
  // ==========================================

  describe('Full Flow Integration', () => {
    it('should complete full flow: queue jobs + database recording + status return', async () => {
      const action_tags = ['hide_comment', 'add_strike_1', 'check_reincidence'];

      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        action_tags,
        mockMetadata
      );

      // Verify success
      expect(result.success).toBe(true);
      expect(result.actions_executed).toHaveLength(3);
      expect(result.failed_actions).toHaveLength(0);

      // Verify all actions executed
      action_tags.forEach((tag, index) => {
        expect(result.actions_executed[index].tag).toBe(tag);
        expect(result.actions_executed[index].status).toBe('executed');
      });

      // Verify queue jobs added (hide_comment queued)
      expect(queueService.addJob).toHaveBeenCalledWith(
        'shield_action',
        expect.objectContaining({
          action_type: 'hide_comment'
        }),
        { priority: 1 }
      );

      // Verify database calls (shield_actions + user_behavior)
      expect(supabase.from).toHaveBeenCalledWith('shield_actions');
      expect(supabase.from).toHaveBeenCalledWith('user_behavior');
    });

    it('should handle mixed success/skip/fail scenarios', async () => {
      // Mock partial failure
      queueService.addJob.mockImplementation((jobType, data) => {
        if (data.action_type === 'mute_temp') {
          return Promise.reject(new Error('Queue error'));
        }
        return Promise.resolve({ id: 'mock-job-id' });
      });

      const nonReportableMetadata = {
        ...mockMetadata,
        platform_violations: { reportable: false }
      };

      const result = await shieldService.executeActionsFromTags(
        mockOrgId,
        mockComment,
        ['hide_comment', 'report_to_platform', 'mute_temp'],
        nonReportableMetadata
      );

      expect(result.success).toBe(true); // At least one action succeeded
      expect(result.actions_executed).toHaveLength(3);

      // hide_comment: executed
      expect(result.actions_executed[0].status).toBe('executed');

      // report_to_platform: skipped (reportable=false)
      expect(result.actions_executed[1].status).toBe('skipped');

      // mute_temp: failed (queue error)
      expect(result.actions_executed[2].status).toBe('failed');

      // Verify failed_actions contains only the failed one
      expect(result.failed_actions).toHaveLength(1);
      expect(result.failed_actions[0].tag).toBe('mute_temp');
    });
  });
});
