/**
 * Shield Service Tests
 * 
 * Tests for automated content moderation and user behavior tracking
 */

const ShieldService = require('../../../src/services/shieldService');

// Mock Supabase
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
    }))
  }))
}));

// Mock QueueService
const mockQueueService = {
  addJob: jest.fn(),
  initialize: jest.fn(),
  shutdown: jest.fn()
};

jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => mockQueueService);
});

describe('ShieldService', () => {
  let shieldService;
  let mockSupabase;

  beforeEach(() => {
    // Mock environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';

    // Initialize with autoActions enabled for tests that need it
    shieldService = new ShieldService({ autoActions: true });
    mockSupabase = shieldService.supabase;

    // Make mockSupabase.from a spy so it can be configured per-test
    // This allows tests to use mockReturnValueOnce for different query patterns
    jest.spyOn(mockSupabase, 'from');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    test('should initialize service and queue connections', async () => {
      await shieldService.initialize();
      
      expect(mockQueueService.initialize).toHaveBeenCalled();
    });
  });

  describe('analyzeContent', () => {
    test('should analyze content and determine action level', async () => {
      const content = {
        text: 'This is highly toxic content with threats',
        toxicity_score: 0.95,
        categories: ['toxicity', 'threat']
      };

      const user = {
        user_id: 'user-123',
        platform: 'twitter',
        organization_id: 'org-123'
      };

      // Mock user behavior lookup
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    total_violations: 2,
                    severe_violations: 1,
                    last_violation: new Date(Date.now() - 86400000).toISOString() // 1 day ago
                  },
                  error: null
                })
              })
            })
          })
        })
      });

      const analysis = await shieldService.analyzeContent(content, user);

      expect(analysis.shouldTakeAction).toBe(true);
      expect(analysis.actionLevel).toBe('high'); // High toxicity + previous violations
      expect(analysis.recommendedActions).toContain('temporary_mute');
      expect(analysis.userRisk).toBe('high');
    });

    test('should handle first-time offender with medium toxicity', async () => {
      const content = {
        text: 'Mildly inappropriate comment',
        toxicity_score: 0.7,
        categories: ['toxicity']
      };

      const user = {
        user_id: 'user-456',
        platform: 'twitter',
        organization_id: 'org-123'
      };

      // Mock no previous violations
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              })
            })
          })
        })
      });

      const analysis = await shieldService.analyzeContent(content, user);

      expect(analysis.shouldTakeAction).toBe(true);
      expect(analysis.actionLevel).toBe('low');
      expect(analysis.recommendedActions).toContain('warning');
      expect(analysis.userRisk).toBe('low');
    });

    test('should not take action for low toxicity content', async () => {
      const content = {
        text: 'This is perfectly fine content',
        toxicity_score: 0.2,
        categories: []
      };

      const user = {
        user_id: 'user-789',
        platform: 'twitter',
        organization_id: 'org-123'
      };

      const analysis = await shieldService.analyzeContent(content, user);

      expect(analysis.shouldTakeAction).toBe(false);
      expect(analysis.actionLevel).toBe('none');
      expect(analysis.recommendedActions).toHaveLength(0);
    });
  });

  describe('executeActionsFromTags', () => {
    test('should execute Shield actions and record them', async () => {
      const organizationId = 'org-123';
      const comment = {
        id: 'comment-456',
        platform: 'twitter',
        platform_user_id: 'user-123',
        platform_username: 'testuser',
        text: 'Inappropriate content'
      };
      // Use valid action tags that exist in the actionHandlers map
      const action_tags = ['hide_comment', 'block_user'];
      const metadata = {
        toxicity_score: 0.85,
        decision_level: 'medium'
      };

      // Spy on handler methods to return success
      jest.spyOn(shieldService, '_handleHideComment').mockResolvedValue({ job_id: 'job-123' });
      jest.spyOn(shieldService, '_handleBlockUser').mockResolvedValue({ job_id: 'job-456' });

      // Mock batch recording method
      jest.spyOn(shieldService, '_batchRecordShieldActions').mockResolvedValue({ success: true });

      // Mock user behavior update method
      jest.spyOn(shieldService, '_updateUserBehaviorFromTags').mockResolvedValue({ success: true });

      const result = await shieldService.executeActionsFromTags(organizationId, comment, action_tags, metadata);

      expect(result.success).toBe(true);
      expect(result.actions_executed).toHaveLength(2);
      expect(result.actions_executed.some(a => a.tag === 'hide_comment')).toBe(true);
      expect(result.actions_executed.some(a => a.tag === 'block_user')).toBe(true);

      // Verify handler methods were called
      expect(shieldService._handleHideComment).toHaveBeenCalledWith(organizationId, comment, metadata);
      expect(shieldService._handleBlockUser).toHaveBeenCalledWith(organizationId, comment, metadata);

      // Verify batch recording was called
      expect(shieldService._batchRecordShieldActions).toHaveBeenCalled();

      // Verify user behavior update was called
      expect(shieldService._updateUserBehaviorFromTags).toHaveBeenCalledWith(organizationId, comment, action_tags, metadata);
    });

    test('should skip execution when no actions in tags', async () => {
      const organizationId = 'org-123';
      const comment = {
        id: 'comment-456',
        platform: 'twitter',
        platform_user_id: 'user-123',
        platform_username: 'testuser'
      };
      const action_tags = [];
      const metadata = { toxicity_score: 0.2 };

      const result = await shieldService.executeActionsFromTags(organizationId, comment, action_tags, metadata);

      expect(result.success).toBe(true);
      expect(result.actions_executed).toHaveLength(0);
      expect(mockQueueService.addJob).not.toHaveBeenCalled();
    });
  });

  describe('trackUserBehavior', () => {
    test('should update user behavior statistics', async () => {
      const user = {
        user_id: 'user-123',
        platform: 'twitter',
        organization_id: 'org-123'
      };

      const violation = {
        severity: 'high',
        categories: ['toxicity', 'threat'],
        toxicity_score: 0.9
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                user_id: 'user-123',
                total_violations: 3,
                severe_violations: 2,
                last_violation: new Date().toISOString()
              },
              error: null
            })
          })
        })
      });

      const result = await shieldService.trackUserBehavior(user, violation);

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_behaviors');
    });
  });

  describe('getUserRiskLevel', () => {
    test('should calculate high risk for repeat offender', async () => {
      const user = {
        user_id: 'user-123',
        platform: 'twitter',
        organization_id: 'org-123'
      };

      // Mock user with multiple violations
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    total_violations: 8,
                    severe_violations: 3,
                    last_violation: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                    avg_toxicity_score: 0.85,
                    warning_count: 2,
                    mute_count: 1
                  },
                  error: null
                })
              })
            })
          })
        })
      });

      const riskLevel = await shieldService.getUserRiskLevel(user);

      expect(riskLevel).toBe('high');
    });

    test('should calculate low risk for new user', async () => {
      const user = {
        user_id: 'user-456',
        platform: 'twitter',
        organization_id: 'org-123'
      };

      // Mock no behavior record
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              })
            })
          })
        })
      });

      const riskLevel = await shieldService.getUserRiskLevel(user);

      expect(riskLevel).toBe('low');
    });
  });

  describe('getShieldStats', () => {
    test('should return comprehensive Shield statistics', async () => {
      const organizationId = 'org-123';

      // Mock app_logs query: from('app_logs').select('*').eq().eq().gte()
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockResolvedValue({
                  data: [
                    {
                      metadata: {
                        actions: { primary: 'warning' },
                        toxicityScore: 0.5,
                        platform: 'twitter'
                      },
                      created_at: new Date().toISOString()
                    },
                    {
                      metadata: {
                        actions: { primary: 'temporary_mute' },
                        toxicityScore: 0.85,
                        platform: 'twitter'
                      },
                      created_at: new Date().toISOString()
                    }
                  ],
                  error: null
                })
              })
            })
          })
        })
        // Mock user_behaviors query: from('user_behaviors').select('*').eq()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                { user_id: 'user-1', total_violations: 5, severe_violations: 2, is_blocked: false },
                { user_id: 'user-2', total_violations: 1, severe_violations: 0, is_blocked: false }
              ],
              error: null
            })
          })
        });

      const stats = await shieldService.getShieldStats(organizationId, 30);

      expect(stats.totalShieldActivations).toBe(2);
      expect(stats.actionBreakdown.warning).toBe(1);
      expect(stats.actionBreakdown.temporary_mute).toBe(1);
      expect(stats.totalTrackedUsers).toBe(2);
    });

    test('should handle organizations with no Shield activity', async () => {
      const organizationId = 'org-empty';

      // Mock app_logs query: from('app_logs').select('*').eq().eq().gte()
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        })
        // Mock user_behaviors query: from('user_behaviors').select('*').eq()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        });

      const stats = await shieldService.getShieldStats(organizationId, 30);

      expect(stats.totalShieldActivations).toBe(0);
      expect(stats.actionBreakdown).toEqual({});
      expect(stats.totalTrackedUsers).toBe(0);
    });
  });

  describe('action level determination', () => {
    test('should determine correct action level based on toxicity and history', () => {
      // High toxicity, no history
      expect(
        shieldService.determineActionLevel(0.95, 'low', ['toxicity', 'threat'])
      ).toBe('high');

      // Medium toxicity, medium risk user
      expect(
        shieldService.determineActionLevel(0.7, 'medium', ['toxicity'])
      ).toBe('medium');

      // Low toxicity, high risk user
      expect(
        shieldService.determineActionLevel(0.4, 'high', ['toxicity'])
      ).toBe('medium');

      // Low toxicity, low risk user
      expect(
        shieldService.determineActionLevel(0.3, 'low', [])
      ).toBe('none');
    });
  });

  describe('recommended actions', () => {
    test('should recommend appropriate actions for high severity', () => {
      const actions = shieldService.getRecommendedActions('high', ['threat', 'toxicity']);
      
      expect(actions).toContain('temporary_mute');
      expect(actions).toContain('content_removal');
      expect(actions).toContain('escalate_to_human');
    });

    test('should recommend appropriate actions for medium severity', () => {
      const actions = shieldService.getRecommendedActions('medium', ['toxicity']);
      
      expect(actions).toContain('warning');
      expect(actions).toContain('content_removal');
      expect(actions).not.toContain('permanent_ban');
    });

    test('should recommend appropriate actions for low severity', () => {
      const actions = shieldService.getRecommendedActions('low', ['toxicity']);
      
      expect(actions).toContain('warning');
      expect(actions).not.toContain('temporary_mute');
      expect(actions).not.toContain('permanent_ban');
    });

    test('should return empty actions for no severity', () => {
      const actions = shieldService.getRecommendedActions('none', []);
      
      expect(actions).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    test('should handle database errors in content analysis', async () => {
      const content = { text: 'test', toxicity_score: 0.8 };
      const user = { user_id: 'user-123', platform: 'twitter' };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' }
                })
              })
            })
          })
        })
      });

      await expect(
        shieldService.analyzeContent(content, user)
      ).rejects.toThrow('Database error');
    });

    test('should handle queue service errors gracefully', async () => {
      const organizationId = 'org-123';
      const comment = {
        id: 'comment-456',
        platform: 'twitter',
        platform_user_id: 'user-123',
        platform_username: 'testuser'
      };
      // Use valid action tag that has a handler
      const action_tags = ['hide_comment'];
      const metadata = { toxicity_score: 0.7 };

      // Mock queue service to throw error when handler tries to add job
      mockQueueService.addJob.mockRejectedValue(new Error('Queue error'));

      const result = await shieldService.executeActionsFromTags(organizationId, comment, action_tags, metadata);

      // Expect the error to be in failed_actions array
      expect(result.success).toBe(false);
      expect(result.failed_actions).toHaveLength(1);
      expect(result.failed_actions[0].tag).toBe('hide_comment');
      expect(result.failed_actions[0].status).toBe('failed');
      expect(result.failed_actions[0].error).toContain('Queue error');
    });
  });

  describe('shutdown', () => {
    test('should shutdown queue service gracefully', async () => {
      await shieldService.shutdown();
      
      expect(mockQueueService.shutdown).toHaveBeenCalled();
    });
  });
});