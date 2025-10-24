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
    
    shieldService = new ShieldService();
    mockSupabase = shieldService.supabase;
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
      const action_tags = ['warning', 'content_removal'];
      const metadata = {
        toxicity_score: 0.85,
        decision_level: 'medium'
      };

      // Mock Shield action recording
      mockSupabase.from = jest.fn().mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'action-123' },
              error: null
            })
          })
        })
      });

      // Mock user behavior update
      mockSupabase.from = jest.fn().mockReturnValueOnce({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'behavior-123' },
              error: null
            })
          })
        })
      });

      const result = await shieldService.executeActionsFromTags(organizationId, comment, action_tags, metadata);

      expect(result.success).toBe(true);
      expect(result.actions_executed).toHaveLength(2);
      expect(result.actions_executed.some(a => a.tag === 'warning')).toBe(true);
      expect(result.actions_executed.some(a => a.tag === 'content_removal')).toBe(true);
      expect(mockQueueService.addJob).toHaveBeenCalledTimes(2); // One job per action
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
      expect(mockSupabase.from).toHaveBeenCalledWith('user_behavior');
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

      // Mock Shield actions query
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lt: jest.fn().mockResolvedValue({
                  data: [
                    {
                      action_type: 'warning',
                      platform: 'twitter',
                      action_level: 'low',
                      created_at: new Date().toISOString()
                    },
                    {
                      action_type: 'temporary_mute',
                      platform: 'twitter',
                      action_level: 'high',
                      created_at: new Date().toISOString()
                    }
                  ],
                  error: null
                })
              })
            })
          })
        })
        // Mock user behavior query
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                { user_id: 'user-1', total_violations: 5, severe_violations: 2 },
                { user_id: 'user-2', total_violations: 1, severe_violations: 0 }
              ],
              error: null
            })
          })
        });

      const stats = await shieldService.getShieldStats(organizationId, 30);

      expect(stats.organizationId).toBe(organizationId);
      expect(stats.totalActions).toBe(2);
      expect(stats.actionsByType.warning).toBe(1);
      expect(stats.actionsByType.temporary_mute).toBe(1);
      expect(stats.actionsByPlatform.twitter).toBe(2);
      expect(stats.riskDistribution.high).toBe(1); // user-1 with severe violations
      expect(stats.riskDistribution.low).toBe(1); // user-2 with minimal violations
    });

    test('should handle organizations with no Shield activity', async () => {
      const organizationId = 'org-empty';

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lt: jest.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        });

      const stats = await shieldService.getShieldStats(organizationId, 30);

      expect(stats.totalActions).toBe(0);
      expect(stats.actionsByType).toEqual({});
      expect(stats.riskDistribution.low).toBe(0);
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
      const action_tags = ['warning'];
      const metadata = { toxicity_score: 0.7 };

      mockQueueService.addJob.mockRejectedValue(new Error('Queue error'));

      // Mock Supabase chain for this test
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: 'action-123' },
        error: null
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockUpsert = jest.fn().mockReturnValue({ select: mockSelect });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      mockSupabase.from = jest.fn().mockReturnValue({
        insert: mockInsert,
        upsert: mockUpsert
      });

      const result = await shieldService.executeActionsFromTags(organizationId, comment, action_tags, metadata);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Queue error');
    });
  });

  describe('shutdown', () => {
    test('should shutdown queue service gracefully', async () => {
      await shieldService.shutdown();
      
      expect(mockQueueService.shutdown).toHaveBeenCalled();
    });
  });
});