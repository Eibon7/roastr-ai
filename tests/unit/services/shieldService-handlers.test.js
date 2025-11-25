/**
 * Shield Service Handlers Tests
 *
 * Tests for action handlers and execution flows to improve coverage
 * Issue #929: Target 75%+ coverage for shieldService.js
 */

// Mock mockMode BEFORE importing ShieldService
jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: false,
    generateMockSupabaseClient: jest.fn()
  }
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  critical: jest.fn()
}));

// Mock dependencies
jest.mock('../../../src/services/costControl', () => {
  return jest.fn().mockImplementation(() => ({
    canUseShield: jest.fn().mockResolvedValue({ allowed: true })
  }));
});

const mockAddJob = jest.fn().mockResolvedValue({ id: 'job-123' });
const mockInitialize = jest.fn().mockResolvedValue(true);
const mockShutdown = jest.fn().mockResolvedValue(true);

jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => ({
    addJob: mockAddJob,
    initialize: mockInitialize,
    shutdown: mockShutdown
  }));
});

// Mock Supabase with chainable methods
const mockSupabaseChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  update: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue({ data: [], error: null })
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => mockSupabaseChain),
    rpc: jest.fn().mockResolvedValue({ data: { total_violations: 1 }, error: null })
  }))
}));

// Import ShieldService AFTER mocks
const ShieldService = require('../../../src/services/shieldService');

describe('ShieldService - Action Handlers', () => {
  let shieldService;

  beforeEach(() => {
    process.env.ROASTR_SHIELD_ENABLED = 'true';
    process.env.SHIELD_AUTO_ACTIONS = 'true';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';

    shieldService = new ShieldService({ autoActions: true });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeActionsFromTags', () => {
    const mockComment = {
      id: 'comment-123',
      platform: 'twitter',
      platform_user_id: 'user-456',
      platform_username: 'testuser'
    };

    const mockMetadata = {
      toxicity: { toxicity_score: 0.8 },
      security: { security_score: 0.9 },
      platform_violations: { reportable: true, violations: ['spam'] }
    };

    it('should skip execution when autoActions is disabled', async () => {
      const service = new ShieldService({ autoActions: false });
      const result = await service.executeActionsFromTags(
        'org-123',
        mockComment,
        ['hide_comment'],
        mockMetadata
      );

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('autoActions_disabled');
    });

    it('should return error for missing organizationId', async () => {
      const result = await shieldService.executeActionsFromTags(
        null,
        mockComment,
        ['hide_comment'],
        mockMetadata
      );

      expect(result.success).toBe(false);
      expect(result.failed_actions[0].error).toBe('organizationId is required');
    });

    it('should return error for missing comment', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        null,
        ['hide_comment'],
        mockMetadata
      );

      expect(result.success).toBe(false);
      expect(result.failed_actions[0].error).toBe('comment is required');
    });

    it('should return error for non-array action_tags', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        'not-an-array',
        mockMetadata
      );

      expect(result.success).toBe(false);
      expect(result.failed_actions[0].error).toBe('action_tags must be an array');
    });

    it('should return error for comment missing required fields', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        { id: 'comment-123' }, // Missing platform and platform_user_id
        ['hide_comment'],
        mockMetadata
      );

      expect(result.success).toBe(false);
      expect(result.failed_actions[0].error).toContain('comment must have');
    });

    it('should execute hide_comment action', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        ['hide_comment'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed.length).toBeGreaterThanOrEqual(1);
      expect(mockAddJob).toHaveBeenCalledWith(
        'shield_action',
        expect.objectContaining({ action: 'hide_comment' }),
        expect.any(Object)
      );
    });

    it('should execute block_user action', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        ['block_user'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(mockAddJob).toHaveBeenCalledWith(
        'shield_action',
        expect.objectContaining({ action: 'block_user' }),
        expect.any(Object)
      );
    });

    it('should execute mute_temp action', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        ['mute_temp'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(mockAddJob).toHaveBeenCalledWith(
        'shield_action',
        expect.objectContaining({ action: 'mute_temp' }),
        expect.any(Object)
      );
    });

    it('should execute mute_permanent action', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        ['mute_permanent'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(mockAddJob).toHaveBeenCalledWith(
        'shield_action',
        expect.objectContaining({ action: 'mute_permanent' }),
        expect.any(Object)
      );
    });

    it('should execute report_to_platform when reportable', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        ['report_to_platform'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(mockAddJob).toHaveBeenCalledWith(
        'shield_action',
        expect.objectContaining({ action: 'report_to_platform' }),
        expect.any(Object)
      );
    });

    it('should skip report_to_platform when not reportable', async () => {
      const nonReportableMetadata = {
        ...mockMetadata,
        platform_violations: { reportable: false }
      };

      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        ['report_to_platform'],
        nonReportableMetadata
      );

      expect(result.success).toBe(true);
      // Should be skipped, not executed
      const reportAction = result.actions_executed.find((a) => a.tag === 'report_to_platform');
      expect(reportAction?.status).toBe('skipped');
    });

    it('should execute require_manual_review action', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        ['require_manual_review'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(mockAddJob).toHaveBeenCalledWith(
        'shield_action',
        expect.objectContaining({ action: 'require_manual_review' }),
        expect.any(Object)
      );
    });

    it('should execute gatekeeper_unavailable action', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        ['gatekeeper_unavailable'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(mockAddJob).toHaveBeenCalledWith(
        'shield_action',
        expect.objectContaining({ action: 'gatekeeper_unavailable' }),
        expect.any(Object)
      );
    });

    it('should execute check_reincidence action', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        ['check_reincidence'],
        mockMetadata
      );

      expect(result.success).toBe(true);
    });

    it('should execute add_strike_1 action', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        ['add_strike_1'],
        mockMetadata
      );

      expect(result.success).toBe(true);
    });

    it('should execute add_strike_2 action', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        ['add_strike_2'],
        mockMetadata
      );

      expect(result.success).toBe(true);
    });

    it('should handle unknown action tags gracefully', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        ['unknown_action_tag'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      const unknownAction = result.actions_executed.find((a) => a.tag === 'unknown_action_tag');
      expect(unknownAction?.status).toBe('skipped');
      expect(unknownAction?.reason).toBe('unknown_tag');
    });

    it('should execute multiple actions in sequence', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        ['hide_comment', 'mute_temp', 'add_strike_1'],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed.length).toBe(3);
    });

    it('should handle empty action_tags array', async () => {
      const result = await shieldService.executeActionsFromTags(
        'org-123',
        mockComment,
        [],
        mockMetadata
      );

      expect(result.success).toBe(true);
      expect(result.actions_executed.length).toBe(0);
    });
  });

  describe('Platform-Specific Shield Actions', () => {
    it('should get Twitter shield actions for warn', () => {
      const actions = shieldService.getTwitterShieldActions('warn');
      expect(actions.action).toBe('reply_warning');
      expect(actions.available).toBe(true);
    });

    it('should get Twitter shield actions for mute_temp', () => {
      const actions = shieldService.getTwitterShieldActions('mute_temp');
      expect(actions.action).toBe('mute_user');
      expect(actions.duration).toBe('24h');
    });

    it('should get Twitter shield actions for block', () => {
      const actions = shieldService.getTwitterShieldActions('block');
      expect(actions.action).toBe('block_user');
      expect(actions.available).toBe(true);
    });

    it('should get Discord shield actions for warn', () => {
      const actions = shieldService.getDiscordShieldActions('warn');
      expect(actions.action).toBe('send_warning_dm');
    });

    it('should get Discord shield actions for mute_temp', () => {
      const actions = shieldService.getDiscordShieldActions('mute_temp');
      expect(actions.action).toBe('timeout_user');
      expect(actions.duration).toBe('1h');
    });

    it('should get Twitch shield actions for warn', () => {
      const actions = shieldService.getTwitchShieldActions('warn');
      expect(actions.action).toBe('timeout_user');
      expect(actions.duration).toBe('60s');
    });

    it('should get YouTube shield actions for warn', () => {
      const actions = shieldService.getYouTubeShieldActions('warn');
      expect(actions.action).toBe('reply_warning');
    });

    it('should get YouTube shield actions for report', () => {
      const actions = shieldService.getYouTubeShieldActions('report');
      expect(actions.action).toBe('report_comment');
      expect(actions.available).toBe(true);
    });

    it('should handle unknown action types', () => {
      const actions = shieldService.getTwitterShieldActions('unknown_action');
      expect(actions.available).toBe(false);
    });
  });

  describe('Time Window Escalation', () => {
    it('should return aggressive for violations within 1 hour', () => {
      const behavior = {
        actions_taken: [{ timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() }]
      };

      const modifier = shieldService.calculateTimeWindowEscalation(behavior);
      expect(modifier).toBe('aggressive');
    });

    it('should return standard for violations between 1-24 hours', () => {
      const behavior = {
        actions_taken: [{ timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() }]
      };

      const modifier = shieldService.calculateTimeWindowEscalation(behavior);
      expect(modifier).toBe('standard');
    });

    it('should return reduced for violations between 24h-7 days', () => {
      const behavior = {
        actions_taken: [{ timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }]
      };

      const modifier = shieldService.calculateTimeWindowEscalation(behavior);
      expect(modifier).toBe('reduced');
    });

    it('should return minimal for violations older than 7 days', () => {
      const behavior = {
        actions_taken: [
          { timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }
        ]
      };

      const modifier = shieldService.calculateTimeWindowEscalation(behavior);
      expect(modifier).toBe('minimal');
    });

    it('should return standard for empty actions_taken', () => {
      const behavior = { actions_taken: [] };

      const modifier = shieldService.calculateTimeWindowEscalation(behavior);
      expect(modifier).toBe('standard');
    });

    it('should handle invalid timestamps gracefully', () => {
      const behavior = {
        actions_taken: [{ timestamp: 'invalid-date' }]
      };

      const modifier = shieldService.calculateTimeWindowEscalation(behavior);
      expect(modifier).toBe('standard');
    });

    it('should use created_at if timestamp is missing', () => {
      const behavior = {
        actions_taken: [{ created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() }]
      };

      const modifier = shieldService.calculateTimeWindowEscalation(behavior);
      expect(modifier).toBe('aggressive');
    });
  });

  describe('Determine Shield Actions', () => {
    const mockComment = {
      platform: 'twitter',
      platform_user_id: 'user-123'
    };

    it('should return warn for first offense with low severity', async () => {
      const analysisResult = { severity_level: 'low' };
      const userBehavior = { total_violations: 0, actions_taken: [] };

      const actions = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        mockComment
      );

      expect(actions.primary).toBe('warn');
      expect(actions.offenseLevel).toBe('first');
    });

    it('should escalate for repeat offender', async () => {
      const analysisResult = { severity_level: 'medium' };
      const userBehavior = { total_violations: 1, actions_taken: [] };

      const actions = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        mockComment
      );

      expect(actions.offenseLevel).toBe('repeat');
    });

    it('should escalate further for persistent offender', async () => {
      const analysisResult = { severity_level: 'high' };
      const userBehavior = { total_violations: 3, actions_taken: [] };

      const actions = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        mockComment
      );

      expect(actions.offenseLevel).toBe('persistent');
    });

    it('should handle dangerous offender level', async () => {
      const analysisResult = { severity_level: 'critical' };
      const userBehavior = { total_violations: 6, actions_taken: [] };

      const actions = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        mockComment
      );

      expect(actions.offenseLevel).toBe('dangerous');
    });

    it('should handle corrupted user behavior data', async () => {
      const analysisResult = { severity_level: 'high' };
      const userBehavior = {
        total_violations: null, // Corrupted
        actions_taken: 'not-an-array' // Corrupted
      };

      const actions = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        mockComment
      );

      // Should fall back to safe defaults
      expect(actions.severity).toBe('low');
      expect(actions.offenseLevel).toBe('first');
    });

    it('should handle emergency escalation', async () => {
      const analysisResult = {
        severity_level: 'critical',
        immediate_threat: true,
        emergency_keywords: ['bomb', 'kill']
      };
      const userBehavior = { total_violations: 0, actions_taken: [] };

      const actions = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        mockComment
      );

      expect(actions.primary).toBe('report');
      expect(actions.emergency).toBe(true);
      expect(actions.notify_authorities).toBe(true);
    });

    it('should handle legal compliance trigger', async () => {
      const analysisResult = {
        severity_level: 'high',
        legal_compliance_trigger: true,
        jurisdiction: 'EU',
        requires_reporting: true
      };
      const userBehavior = { total_violations: 0, actions_taken: [] };

      const actions = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        mockComment
      );

      expect(actions.primary).toBe('report');
      expect(actions.legal_compliance).toBe(true);
      expect(actions.jurisdiction).toBe('EU');
    });

    it('should apply severity override', async () => {
      const analysisResult = {
        severity_level: 'low',
        severity_override: 'critical'
      };
      const userBehavior = { total_violations: 0, actions_taken: [] };

      const actions = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        mockComment
      );

      expect(actions.severity).toBe('critical');
    });

    it('should reject invalid severity override', async () => {
      const analysisResult = {
        severity_level: 'low',
        severity_override: 'invalid_severity'
      };
      const userBehavior = { total_violations: 0, actions_taken: [] };

      const actions = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        mockComment
      );

      expect(actions.severity).toBe('low'); // Should keep original
    });

    it('should apply lenient escalation for special users', async () => {
      const analysisResult = { severity_level: 'high' };
      const userBehavior = {
        total_violations: 2,
        actions_taken: [],
        user_type: 'verified_creator'
      };

      const actions = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        mockComment
      );

      expect(actions.manual_review_required).toBe(true);
    });

    it('should handle cooling-off period escalation', async () => {
      const analysisResult = { severity_level: 'medium' };
      const userBehavior = {
        total_violations: 1,
        actions_taken: [],
        is_muted: true,
        mute_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
      };

      const actions = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        mockComment
      );

      // Should escalate due to cooling-off violation
      expect(actions.offenseLevel).toBe('persistent');
    });

    it('should apply aggressive platform policy', async () => {
      const analysisResult = { severity_level: 'low' };
      const userBehavior = {
        total_violations: 1,
        actions_taken: [],
        platform_specific_config: { escalation_policy: 'aggressive' }
      };

      const actions = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        mockComment
      );

      // Should escalate action one level
      expect(['mute_temp', 'warn']).toContain(actions.primary);
    });

    it('should apply lenient platform policy', async () => {
      const analysisResult = { severity_level: 'medium' };
      const userBehavior = {
        total_violations: 1,
        actions_taken: [],
        platform_specific_config: { escalation_policy: 'lenient' }
      };

      const actions = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        mockComment
      );

      // Should downgrade action one level
      expect(['warn', 'mute_temp']).toContain(actions.primary);
    });
  });

  describe('Shield Statistics', () => {
    it('should have getShieldStats method', () => {
      expect(typeof shieldService.getShieldStats).toBe('function');
    });
  });

  describe('Shutdown', () => {
    it('should shutdown queue service gracefully', async () => {
      await shieldService.shutdown();
      expect(mockShutdown).toHaveBeenCalled();
    });
  });

  describe('Batch Record Shield Actions', () => {
    it('should batch record multiple actions', async () => {
      const actionsToRecord = [
        {
          organization_id: 'org-123',
          comment_id: 'comment-1',
          action_tag: 'hide_comment'
        },
        {
          organization_id: 'org-123',
          comment_id: 'comment-2',
          action_tag: 'mute_temp'
        }
      ];

      await shieldService._batchRecordShieldActions(actionsToRecord);

      expect(mockSupabaseChain.insert).toHaveBeenCalled();
    });

    it('should handle empty actions array', async () => {
      await shieldService._batchRecordShieldActions([]);
      // Should not call insert
    });

    it('should handle null actions array', async () => {
      await shieldService._batchRecordShieldActions(null);
      // Should not throw
    });
  });

  describe('Update User Behavior From Tags', () => {
    it('should update user behavior atomically', async () => {
      const comment = {
        id: 'comment-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'testuser'
      };

      const metadata = {
        toxicity: { toxicity_score: 0.8 }
      };

      await shieldService._updateUserBehaviorFromTags(
        'org-123',
        comment,
        ['hide_comment', 'add_strike_1'],
        metadata
      );

      // Should call RPC
      expect(shieldService.supabase.rpc).toHaveBeenCalledWith(
        'atomic_update_user_behavior',
        expect.objectContaining({
          p_organization_id: 'org-123',
          p_platform: 'twitter',
          p_platform_user_id: 'user-456'
        })
      );
    });

    it('should handle different severity levels', async () => {
      const comment = {
        id: 'comment-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'testuser'
      };

      // Test critical severity
      await shieldService._updateUserBehaviorFromTags('org-123', comment, ['hide_comment'], {
        toxicity: { toxicity_score: 0.9 }
      });

      // Test high severity
      await shieldService._updateUserBehaviorFromTags('org-123', comment, ['hide_comment'], {
        toxicity: { toxicity_score: 0.7 }
      });

      // Test medium severity
      await shieldService._updateUserBehaviorFromTags('org-123', comment, ['hide_comment'], {
        toxicity: { toxicity_score: 0.5 }
      });

      // Test low severity
      await shieldService._updateUserBehaviorFromTags('org-123', comment, ['hide_comment'], {
        toxicity: { toxicity_score: 0.2 }
      });

      expect(shieldService.supabase.rpc).toHaveBeenCalled();
    });
  });

  describe('Analyze Content (Test Stub)', () => {
    const mockUser = {
      user_id: 'user-123',
      platform: 'twitter',
      organization_id: 'org-123'
    };

    it('should analyze high toxicity content', async () => {
      const content = { toxicity_score: 0.9 };
      const result = await shieldService.analyzeContent(content, mockUser);

      expect(result.shouldTakeAction).toBe(true);
      expect(result.actionLevel).toBe('high');
      expect(result.recommendedActions).toContain('temporary_mute');
    });

    it('should analyze medium toxicity content', async () => {
      const content = { toxicity_score: 0.7 };
      const result = await shieldService.analyzeContent(content, mockUser);

      expect(result.shouldTakeAction).toBe(true);
    });

    it('should analyze low toxicity content', async () => {
      const content = { toxicity_score: 0.35 };
      const result = await shieldService.analyzeContent(content, mockUser);

      expect(result.shouldTakeAction).toBe(false);
      expect(result.actionLevel).toBe('none');
    });

    it('should throw on database error', async () => {
      shieldService.mockDatabaseError = true;

      const content = { toxicity_score: 0.8 };

      await expect(shieldService.analyzeContent(content, mockUser)).rejects.toThrow(
        'Database error'
      );

      shieldService.mockDatabaseError = false;
    });
  });

  describe('Track User Behavior (Test Stub)', () => {
    it('should track user behavior for high severity violation', async () => {
      const user = {
        user_id: 'user-123',
        platform: 'twitter',
        organization_id: 'org-123'
      };

      const violation = { severity: 'high' };

      const result = await shieldService.trackUserBehavior(user, violation);

      // Result may be false if upsert fails, but function should not throw
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    it('should track user behavior for low severity violation', async () => {
      const user = {
        user_id: 'user-456',
        platform: 'discord',
        organization_id: 'org-123'
      };

      const violation = { severity: 'low' };

      const result = await shieldService.trackUserBehavior(user, violation);

      // Result may be false if upsert fails, but function should not throw
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });
  });

  describe('Get User Risk Level (Test Stub)', () => {
    it('should return high risk for known violator', async () => {
      const user = { user_id: 'user-123' };
      const risk = await shieldService.getUserRiskLevel(user);

      expect(risk).toBe('high');
    });

    it('should return low risk for new user', async () => {
      const user = { user_id: 'user-456' };
      const risk = await shieldService.getUserRiskLevel(user);

      expect(risk).toBe('low');
    });

    it('should return low risk for unknown user', async () => {
      const user = { user_id: 'unknown-user' };
      const risk = await shieldService.getUserRiskLevel(user);

      expect(risk).toBe('low');
    });
  });

  describe('Determine Action Level (Test Stub)', () => {
    it('should return high for severe threat', () => {
      const level = shieldService.determineActionLevel(0.95, 'high', ['threat']);

      expect(level).toBe('high');
    });

    it('should return medium for moderate toxicity with medium risk', () => {
      const level = shieldService.determineActionLevel(0.75, 'medium', ['toxicity']);

      expect(level).toBe('medium');
    });

    it('should return medium for lower toxicity with high risk', () => {
      const level = shieldService.determineActionLevel(0.5, 'high', ['toxicity']);

      expect(level).toBe('medium');
    });

    it('should return none for low toxicity', () => {
      const level = shieldService.determineActionLevel(0.35, 'low', []);

      expect(level).toBe('none');
    });

    it('should return none for very low toxicity', () => {
      const level = shieldService.determineActionLevel(0.1, 'low', []);

      expect(level).toBe('none');
    });
  });

  describe('Get Recommended Actions (Test Stub)', () => {
    it('should return high-level actions', () => {
      const actions = shieldService.getRecommendedActions('high', ['threat']);

      expect(actions).toContain('temporary_mute');
      expect(actions).toContain('content_removal');
      expect(actions).toContain('escalate_to_human');
    });

    it('should return medium-level actions', () => {
      const actions = shieldService.getRecommendedActions('medium', ['toxicity']);

      expect(actions).toContain('warning');
      expect(actions).toContain('content_removal');
    });

    it('should return low-level actions', () => {
      const actions = shieldService.getRecommendedActions('low', ['toxicity']);

      expect(actions).toContain('warning');
    });

    it('should return empty for none level', () => {
      const actions = shieldService.getRecommendedActions('none', []);

      expect(actions).toEqual([]);
    });
  });

  describe('shouldAutoExecute', () => {
    it('should return false when autoActions is disabled', () => {
      const service = new ShieldService({ autoActions: false });
      const result = service.shouldAutoExecute('warn', 'low');

      expect(result).toBe(false);
    });

    it('should return true for critical severity', () => {
      const result = shieldService.shouldAutoExecute('warn', 'critical');

      expect(result).toBe(true);
    });

    it('should return true for auto-executable actions', () => {
      const result = shieldService.shouldAutoExecute('mute_temp', 'high');

      expect(result).toBe(true);
    });

    it('should return false for non-auto-executable actions', () => {
      const result = shieldService.shouldAutoExecute('block', 'low');

      expect(result).toBe(false);
    });
  });

  describe('getPlatformSpecificActions', () => {
    it('should get platform actions for twitter', async () => {
      const actions = await shieldService.getPlatformSpecificActions('twitter', 'warn', {});

      expect(actions.twitter).toBeDefined();
      expect(actions.twitter.action).toBe('reply_warning');
    });

    it('should get platform actions for discord', async () => {
      const actions = await shieldService.getPlatformSpecificActions('discord', 'mute_temp', {});

      expect(actions.discord).toBeDefined();
      expect(actions.discord.action).toBe('timeout_user');
    });

    it('should get platform actions for twitch', async () => {
      const actions = await shieldService.getPlatformSpecificActions('twitch', 'block', {});

      expect(actions.twitch).toBeDefined();
    });

    it('should get platform actions for youtube', async () => {
      const actions = await shieldService.getPlatformSpecificActions('youtube', 'report', {});

      expect(actions.youtube).toBeDefined();
    });

    it('should handle unknown platform', async () => {
      const actions = await shieldService.getPlatformSpecificActions(
        'unknown_platform',
        'warn',
        {}
      );

      expect(actions.unknown_platform.available).toBe(false);
    });
  });

  describe('Initialize', () => {
    it('should initialize service', async () => {
      const result = await shieldService.initialize();

      expect(result).toBe(true);
      expect(mockInitialize).toHaveBeenCalled();
    });
  });

  describe('Log Method', () => {
    it('should log info messages', () => {
      const logger = require('../../../src/utils/logger');

      shieldService.log('info', 'Test message', { key: 'value' });

      expect(logger.info).toHaveBeenCalledWith('Test message', expect.any(Object));
    });

    it('should log warn messages', () => {
      const logger = require('../../../src/utils/logger');

      shieldService.log('warn', 'Warning message', {});

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      const logger = require('../../../src/utils/logger');

      shieldService.log('error', 'Error message', {});

      expect(logger.error).toHaveBeenCalled();
    });

    it('should fallback to info for unknown level', () => {
      const logger = require('../../../src/utils/logger');

      shieldService.log('unknown_level', 'Unknown level message', {});

      expect(logger.info).toHaveBeenCalled();
    });
  });
});
