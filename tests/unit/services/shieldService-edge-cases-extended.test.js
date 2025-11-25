/**
 * Shield Service Edge Cases Tests (Extended)
 *
 * Tests for edge cases in main methods that are not fully covered
 * Focus: determineShieldActions, getCrossPlatformViolations, calculateTimeWindowEscalation
 */

// Setup test environment
process.env.NODE_ENV = 'test';
process.env.ENABLE_MOCK_MODE = 'true';

// Mock logger FIRST (before mockMode loads)
// mockMode.js does: const { logger } = require('./../utils/logger')
// logger.js exports: module.exports = Logger; module.exports.logger = Logger;
// So we need both the default export (Logger class) and logger property
const mockLoggerInstance = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

jest.mock('../../../src/utils/logger', () => {
  // Create a mock that matches the actual export structure
  const MockLogger = function () {};
  MockLogger.info = jest.fn();
  MockLogger.warn = jest.fn();
  MockLogger.error = jest.fn();
  MockLogger.debug = jest.fn();
  // Export as logger property for destructuring
  MockLogger.logger = mockLoggerInstance;
  MockLogger.SafeUtils = {};
  return MockLogger;
});

// Mock mockMode (before shieldService loads)
// Must mock before singleton is created to prevent constructor execution
// The singleton is created at module load time, so we need to mock it completely
jest.mock('../../../src/config/mockMode', () => {
  // Return a mock that prevents the real MockModeManager from being instantiated
  return {
    mockMode: {
      isMockMode: true,
      generateMockSupabaseClient: jest.fn(() => ({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn()
            }))
          })),
          insert: jest.fn(),
          update: jest.fn(),
          upsert: jest.fn()
        })),
        rpc: jest.fn()
      }))
    },
    MockModeManager: jest.fn(), // Mock the class so it's never instantiated
    timeoutPromise: jest.fn()
  };
});

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

describe('ShieldService - Edge Cases Extended', () => {
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

  describe('determineShieldActions - Corrupted Data Handling', () => {
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };

    it('should handle corrupted total_violations (null)', async () => {
      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.9
      };
      const userBehavior = {
        total_violations: null, // Corrupted
        actions_taken: [],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      expect(result.violationCount).toBe(0);
      expect(result.offenseLevel).toBe('first');
    });

    it('should handle corrupted total_violations (NaN)', async () => {
      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.9
      };
      const userBehavior = {
        total_violations: NaN, // Corrupted
        actions_taken: [],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      expect(result.violationCount).toBe(0);
      expect(result.offenseLevel).toBe('first');
    });

    it('should handle corrupted total_violations (string)', async () => {
      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.9
      };
      const userBehavior = {
        total_violations: 'invalid', // Corrupted
        actions_taken: [],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      expect(result.violationCount).toBe(0);
      expect(result.offenseLevel).toBe('first');
    });

    it('should handle corrupted actions_taken (not array)', async () => {
      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.9
      };
      const userBehavior = {
        total_violations: 2,
        actions_taken: 'invalid', // Corrupted - should be array
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      expect(Array.isArray(userBehavior.actions_taken)).toBe(true);
    });

    it('should handle corrupted last_seen_at (invalid date)', async () => {
      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.9
      };
      const userBehavior = {
        total_violations: 2,
        actions_taken: [],
        last_seen_at: 'invalid-date', // Corrupted
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      expect(userBehavior.last_seen_at).toBeNull();
    });
  });

  describe('determineShieldActions - Severity Override', () => {
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };

    it('should apply valid severity override', async () => {
      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.3,
        severity_override: 'critical' // Override
      };
      const userBehavior = {
        total_violations: 0,
        actions_taken: [],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      expect(result.severity).toBe('critical');
    });

    it('should apply override_severity alias', async () => {
      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.3,
        override_severity: 'high' // Alias
      };
      const userBehavior = {
        total_violations: 0,
        actions_taken: [],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      expect(result.severity).toBe('high');
    });

    it('should reject invalid severity override', async () => {
      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.6,
        severity_override: 'invalid' // Invalid
      };
      const userBehavior = {
        total_violations: 0,
        actions_taken: [],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      // Should use original severity, not override
      expect(result.severity).toBe('medium');
    });

    it('should handle case-insensitive severity override', async () => {
      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.3,
        severity_override: 'CRITICAL' // Uppercase
      };
      const userBehavior = {
        total_violations: 0,
        actions_taken: [],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      expect(result.severity).toBe('critical');
    });
  });

  describe('determineShieldActions - Time Window Escalation', () => {
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };

    it('should escalate aggressively for recent violations (< 1 hour)', async () => {
      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.7
      };
      const recentTimestamp = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 minutes ago
      const userBehavior = {
        total_violations: 2,
        actions_taken: [{ timestamp: recentTimestamp, action: 'warn' }],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      // Should escalate to persistent due to aggressive time window
      expect(result.offenseLevel).toBe('persistent');
    });

    it('should use reduced escalation for 24h-7d violations', async () => {
      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.7
      };
      const oldTimestamp = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ago
      const userBehavior = {
        total_violations: 3,
        actions_taken: [{ timestamp: oldTimestamp, action: 'mute_temp' }],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      // Should use standard escalation (not aggressive)
      expect(result.offenseLevel).toBe('persistent');
    });

    it('should use minimal escalation for > 7 days violations', async () => {
      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.7
      };
      const veryOldTimestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
      const userBehavior = {
        total_violations: 3,
        actions_taken: [{ timestamp: veryOldTimestamp, action: 'mute_temp' }],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      // Should downgrade from persistent to repeat due to time decay
      expect(result.offenseLevel).toBe('repeat');
    });

    it('should handle dangerous level with time decay', async () => {
      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.85
      };
      const veryOldTimestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
      const userBehavior = {
        total_violations: 6, // Dangerous level
        actions_taken: [{ timestamp: veryOldTimestamp, action: 'block' }],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      // Should downgrade from dangerous to persistent due to time decay
      expect(result.offenseLevel).toBe('persistent');
    });
  });

  describe('determineShieldActions - Cooling-Off Period', () => {
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };

    it('should escalate aggressively if violating during cooling-off period', async () => {
      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.7
      };
      const futureExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours from now
      const userBehavior = {
        total_violations: 1,
        actions_taken: [],
        is_muted: true,
        mute_expires_at: futureExpiry, // Still in cooling-off
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      // Should escalate to persistent even though only 1 violation
      expect(result.offenseLevel).toBe('persistent');
    });

    it('should not escalate if cooling-off period expired', async () => {
      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.7
      };
      const pastExpiry = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      const userBehavior = {
        total_violations: 1,
        actions_taken: [],
        is_muted: true,
        mute_expires_at: pastExpiry, // Cooling-off expired
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      // Should use normal escalation (repeat, not persistent)
      expect(result.offenseLevel).toBe('repeat');
    });
  });

  describe('determineShieldActions - Emergency Escalation', () => {
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };

    it('should trigger emergency escalation for immediate_threat', async () => {
      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.9,
        immediate_threat: true
      };
      const userBehavior = {
        total_violations: 0,
        actions_taken: [],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      expect(result.emergency).toBe(true);
      expect(result.primary).toBe('report');
      expect(result.autoExecute).toBe(true);
      expect(result.notify_authorities).toBe(true);
    });

    it('should trigger emergency escalation for emergency_keywords', async () => {
      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.9,
        emergency_keywords: ['bomb', 'kill']
      };
      const userBehavior = {
        total_violations: 0,
        actions_taken: [],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      expect(result.emergency).toBe(true);
      expect(result.primary).toBe('report');
      expect(result.autoExecute).toBe(true);
    });
  });

  describe('determineShieldActions - Legal Compliance', () => {
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };

    it('should trigger legal compliance escalation', async () => {
      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.9,
        legal_compliance_trigger: true,
        jurisdiction: 'EU',
        requires_reporting: true
      };
      const userBehavior = {
        total_violations: 0,
        actions_taken: [],
        user_type: 'standard'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      expect(result.legal_compliance).toBe(true);
      expect(result.primary).toBe('report');
      expect(result.jurisdiction).toBe('EU');
      expect(result.autoExecute).toBe(true);
    });
  });

  describe('determineShieldActions - Platform-Specific Escalation Policies', () => {
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };

    it('should apply aggressive escalation policy', async () => {
      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.7
      };
      const userBehavior = {
        total_violations: 2,
        actions_taken: [],
        user_type: 'standard',
        platform_specific_config: {
          escalation_policy: 'aggressive'
        }
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      // Should escalate action (e.g., mute_temp -> mute_permanent)
      expect(result.primary).toBeDefined();
    });

    it('should apply lenient escalation policy', async () => {
      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.7
      };
      const userBehavior = {
        total_violations: 2,
        actions_taken: [],
        user_type: 'standard',
        platform_specific_config: {
          escalation_policy: 'lenient'
        }
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      // Should downgrade action
      expect(result.primary).toBeDefined();
    });

    it('should not apply lenient policy for critical severity', async () => {
      const analysisResult = {
        severity_level: 'critical',
        toxicity_score: 0.98
      };
      const userBehavior = {
        total_violations: 2,
        actions_taken: [],
        user_type: 'standard',
        platform_specific_config: {
          escalation_policy: 'lenient'
        }
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      // Should not downgrade critical severity
      expect(result.severity).toBe('critical');
    });
  });

  describe('determineShieldActions - Special Users', () => {
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      content: 'Toxic comment'
    };

    it('should apply lenient escalation for verified_creator', async () => {
      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.85
      };
      const userBehavior = {
        total_violations: 2,
        actions_taken: [],
        user_type: 'verified_creator'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      expect(result.manual_review_required).toBe(true);
    });

    it('should not apply lenient escalation for critical severity on special users', async () => {
      const analysisResult = {
        severity_level: 'critical',
        toxicity_score: 0.98
      };
      const userBehavior = {
        total_violations: 2,
        actions_taken: [],
        user_type: 'verified_creator'
      };

      const result = await shieldService.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );

      // Should still require manual review but not downgrade critical
      expect(result.manual_review_required).toBe(true);
      expect(result.severity).toBe('critical');
    });
  });

  describe('getCrossPlatformViolations - Edge Cases', () => {
    const organizationId = 'org-123';
    const platformUserId = 'user-789';

    it('should aggregate violations across multiple platforms', async () => {
      const mockData = [
        { platform: 'twitter', total_violations: 3 },
        { platform: 'discord', total_violations: 2 },
        { platform: 'twitch', total_violations: 1 }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockData, error: null })
          })
        })
      });

      const result = await shieldService.getCrossPlatformViolations(organizationId, platformUserId);

      expect(result.total).toBe(6);
      expect(result.byPlatform.twitter).toBe(3);
      expect(result.byPlatform.discord).toBe(2);
      expect(result.byPlatform.twitch).toBe(1);
    });

    it('should return zero violations when no data found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      });

      const result = await shieldService.getCrossPlatformViolations(organizationId, platformUserId);

      expect(result.total).toBe(0);
      expect(result.byPlatform).toEqual({});
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      const result = await shieldService.getCrossPlatformViolations(organizationId, platformUserId);

      expect(result.total).toBe(0);
      expect(result.byPlatform).toEqual({});
    });

    it('should handle null total_violations in data', async () => {
      const mockData = [
        { platform: 'twitter', total_violations: null },
        { platform: 'discord', total_violations: 2 }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockData, error: null })
          })
        })
      });

      const result = await shieldService.getCrossPlatformViolations(organizationId, platformUserId);

      expect(result.total).toBe(2); // Should handle null as 0
      expect(result.byPlatform.discord).toBe(2);
    });
  });

  describe('calculateTimeWindowEscalation - Edge Cases', () => {
    it('should return standard for no previous actions', () => {
      const userBehavior = {
        actions_taken: []
      };

      const result = shieldService.calculateTimeWindowEscalation(userBehavior);

      expect(result).toBe('standard');
    });

    it('should return aggressive for violations < 1 hour', () => {
      const recentTimestamp = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 minutes ago
      const userBehavior = {
        actions_taken: [{ timestamp: recentTimestamp, action: 'warn' }]
      };

      const result = shieldService.calculateTimeWindowEscalation(userBehavior);

      expect(result).toBe('aggressive');
    });

    it('should return standard for violations 1-24 hours', () => {
      const recentTimestamp = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12 hours ago
      const userBehavior = {
        actions_taken: [{ timestamp: recentTimestamp, action: 'warn' }]
      };

      const result = shieldService.calculateTimeWindowEscalation(userBehavior);

      expect(result).toBe('standard');
    });

    it('should return reduced for violations 24h-7d', () => {
      const oldTimestamp = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ago
      const userBehavior = {
        actions_taken: [{ timestamp: oldTimestamp, action: 'mute_temp' }]
      };

      const result = shieldService.calculateTimeWindowEscalation(userBehavior);

      expect(result).toBe('reduced');
    });

    it('should return minimal for violations > 7 days', () => {
      const veryOldTimestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
      const userBehavior = {
        actions_taken: [{ timestamp: veryOldTimestamp, action: 'block' }]
      };

      const result = shieldService.calculateTimeWindowEscalation(userBehavior);

      expect(result).toBe('minimal');
    });

    it('should handle invalid timestamps gracefully', () => {
      const userBehavior = {
        actions_taken: [
          { timestamp: 'invalid-date', action: 'warn' },
          { created_at: 'also-invalid', action: 'mute_temp' }
        ]
      };

      const result = shieldService.calculateTimeWindowEscalation(userBehavior);

      expect(result).toBe('standard');
    });

    it('should handle different timestamp field names', () => {
      const recentTimestamp = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const userBehavior = {
        actions_taken: [
          { created_at: recentTimestamp, action: 'warn' }, // created_at instead of timestamp
          { date: recentTimestamp, action: 'mute_temp' } // date instead of timestamp
        ]
      };

      const result = shieldService.calculateTimeWindowEscalation(userBehavior);

      expect(result).toBe('aggressive');
    });

    it('should handle errors gracefully', () => {
      const userBehavior = {
        actions_taken: null // Will cause error
      };

      const result = shieldService.calculateTimeWindowEscalation(userBehavior);

      expect(result).toBe('standard');
    });
  });

  describe('queueHighPriorityAnalysis - Edge Cases', () => {
    const organizationId = 'org-123';
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      original_text: 'Toxic comment'
    };
    const priority = 1;

    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });
    });

    it('should queue analysis job with correct priority', async () => {
      await shieldService.queueHighPriorityAnalysis(organizationId, comment, priority);

      expect(mockSupabase.from).toHaveBeenCalledWith('job_queue');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            organization_id: organizationId,
            job_type: 'analyze_toxicity',
            priority: priority,
            payload: expect.objectContaining({
              shield_mode: true,
              shield_priority: priority
            })
          })
        ])
      );
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      });

      // Should not throw
      await expect(
        shieldService.queueHighPriorityAnalysis(organizationId, comment, priority)
      ).resolves.not.toThrow();
    });
  });

  describe('queuePlatformAction - Edge Cases', () => {
    const organizationId = 'org-123';
    const comment = {
      id: 'comment-456',
      platform: 'twitter',
      platform_user_id: 'user-789',
      platform_username: '@toxicuser'
    };
    const platformAction = {
      action: 'block_user',
      available: true
    };

    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });
    });

    it('should queue platform action with correct payload', async () => {
      await shieldService.queuePlatformAction(organizationId, comment, platformAction);

      expect(mockSupabase.from).toHaveBeenCalledWith('job_queue');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            organization_id: organizationId,
            job_type: 'shield_action',
            priority: 2, // high priority
            payload: expect.objectContaining({
              action: 'block_user',
              shield_mode: true
            })
          })
        ])
      );
    });

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      });

      await expect(
        shieldService.queuePlatformAction(organizationId, comment, platformAction)
      ).rejects.toThrow();
    });
  });
});
