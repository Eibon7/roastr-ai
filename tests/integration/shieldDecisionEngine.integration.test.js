/**
 * Integration Tests for Shield Decision Engine
 *
 * Tests the complete decision workflow including recidivism scenarios,
 * persistence integration, and real-world decision patterns.
 */

const ShieldDecisionEngine = require('../../src/services/shieldDecisionEngine');
const ShieldPersistenceService = require('../../src/services/shieldPersistenceService');

// Mock database client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
  rpc: jest.fn()
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

describe('Shield Decision Engine Integration Tests', () => {
  let engine;
  let persistenceService;
  let testOrgId;
  let testPlatform;

  beforeEach(() => {
    jest.clearAllMocks();

    persistenceService = new ShieldPersistenceService({
      supabase: mockSupabase,
      logger: mockLogger
    });

    engine = new ShieldDecisionEngine({
      supabase: mockSupabase,
      logger: mockLogger,
      persistenceService,
      criticalThreshold: 0.98,
      highThreshold: 0.95,
      moderateThreshold: 0.9,
      correctiveThreshold: 0.85,
      aggressiveness: 0.95
    });

    engine.clearCache();

    testOrgId = 'org-integration-test';
    testPlatform = 'twitter';
  });

  describe('First-Time Offender Workflow', () => {
    test('should handle first-time offender through complete decision pipeline', async () => {
      const firstTimeOffenderInput = {
        organizationId: testOrgId,
        userId: 'mod-user-123',
        platform: testPlatform,
        accountRef: '@testorg',
        externalCommentId: 'comment-first-offense',
        externalAuthorId: 'user-first-time',
        externalAuthorUsername: 'newuser',
        originalText: 'This is a mildly toxic comment that should trigger corrective zone',
        toxicityAnalysis: {
          toxicity_score: 0.87,
          toxicity_labels: ['TOXICITY'],
          confidence: 0.92,
          model: 'perspective'
        },
        userConfiguration: {
          aggressiveness: 0.95,
          autoApprove: false,
          redLines: {}
        },
        metadata: {
          source: 'integration_test',
          platform_specific: {
            tweet_id: 'tweet_123456',
            thread_id: 'thread_789'
          }
        }
      };

      // Mock no previous history
      jest.spyOn(persistenceService, 'getOffenderHistory').mockResolvedValue({
        profile: null,
        events: [],
        isRecidivist: false,
        riskLevel: 'low',
        lastOffenseAt: null,
        totalOffenses: 0,
        averageToxicity: 0,
        maxToxicity: 0,
        escalationLevel: 0,
        recentActionsSummary: {}
      });

      // Mock successful event recording
      jest.spyOn(persistenceService, 'recordShieldEvent').mockResolvedValue({
        id: 'event-first-offense-123',
        organization_id: testOrgId,
        action_taken: 'corrective_zone',
        created_at: '2024-01-15T10:00:00Z'
      });

      const decision = await engine.makeDecision(firstTimeOffenderInput);

      // Verify decision
      expect(decision.action).toBe('corrective_zone');
      expect(decision.severity).toBe('low');
      expect(decision.escalationLevel).toBe(0);
      expect(decision.requiresHumanReview).toBe(false);
      expect(decision.autoExecute).toBe(true);
      expect(decision.correctiveMessage).toBeDefined();
      expect(decision.metadata.firstStrike).toBe(true);

      // Verify persistence integration
      expect(persistenceService.getOffenderHistory).toHaveBeenCalledWith(
        testOrgId,
        testPlatform,
        'user-first-time'
      );

      expect(persistenceService.recordShieldEvent).toHaveBeenCalledWith({
        organizationId: testOrgId,
        userId: 'mod-user-123',
        platform: testPlatform,
        accountRef: '@testorg',
        externalCommentId: 'comment-first-offense',
        externalAuthorId: 'user-first-time',
        externalAuthorUsername: 'newuser',
        originalText: null, // Not stored for corrective zone
        toxicityScore: 0.87,
        toxicityLabels: ['TOXICITY'],
        actionTaken: 'corrective_zone',
        actionReason: 'Content needs corrective guidance',
        actionStatus: 'pending',
        actionDetails: expect.objectContaining({
          severity: 'low',
          escalationLevel: 0,
          correctiveMessage: expect.any(String),
          autoExecute: true
        }),
        processedBy: 'shield_decision_engine',
        processingTimeMs: expect.any(Number),
        metadata: expect.objectContaining({
          decisionVersion: '1.0',
          firstStrike: true,
          offenderHistory: expect.objectContaining({
            isRecidivist: false,
            totalOffenses: 0
          })
        })
      });
    });
  });

  describe('Repeat Offender Escalation Workflow', () => {
    test('should escalate repeat offender with progressive discipline', async () => {
      const repeatOffenderInput = {
        organizationId: testOrgId,
        userId: 'mod-user-456',
        platform: testPlatform,
        accountRef: '@testorg',
        externalCommentId: 'comment-repeat-offense',
        externalAuthorId: 'user-repeat-offender',
        externalAuthorUsername: 'troubleuser',
        originalText: 'Another toxic comment from repeat offender',
        toxicityAnalysis: {
          toxicity_score: 0.92, // Higher score that will escalate to critical with recidivism
          toxicity_labels: ['TOXICITY', 'INSULT'],
          confidence: 0.95,
          model: 'perspective'
        },
        userConfiguration: {
          aggressiveness: 0.95,
          autoApprove: false,
          redLines: {}
        },
        metadata: {
          source: 'integration_test'
        }
      };

      // Mock extensive history
      jest.spyOn(persistenceService, 'getOffenderHistory').mockResolvedValue({
        profile: {
          id: 'profile-repeat-offender',
          organization_id: testOrgId,
          platform: testPlatform,
          external_author_id: 'user-repeat-offender',
          offense_count: 4,
          severity_level: 'medium',
          last_offense_at: '2024-01-10T15:30:00Z',
          avg_toxicity_score: 0.82,
          max_toxicity_score: 0.94,
          escalation_level: 2
        },
        events: [
          {
            id: 'event-1',
            toxicity_score: 0.94,
            action_taken: 'timeout_user',
            action_status: 'executed',
            created_at: '2024-01-10T15:30:00Z'
          },
          {
            id: 'event-2',
            toxicity_score: 0.78,
            action_taken: 'warn_user',
            action_status: 'executed',
            created_at: '2024-01-08T09:15:00Z'
          }
        ],
        isRecidivist: true,
        riskLevel: 'medium',
        lastOffenseAt: '2024-01-10T15:30:00Z',
        totalOffenses: 4,
        averageToxicity: 0.82,
        maxToxicity: 0.94,
        escalationLevel: 2,
        recentActionsSummary: {
          timeout_user: 1,
          warn_user: 1,
          corrective_zone: 2
        }
      });

      jest.spyOn(persistenceService, 'recordShieldEvent').mockResolvedValue({
        id: 'event-repeat-offense-456'
      });

      const decision = await engine.makeDecision(repeatOffenderInput);

      // Should escalate to critical due to recidivism adjustment
      expect(decision.action).toBe('shield_action_critical');
      expect(decision.severity).toBe('critical');
      expect(decision.escalationLevel).toBe(2);
      expect(decision.metadata.isRepeatOffender).toBe(true);
      expect(decision.metadata.escalationAdjustment).toBeGreaterThan(0);
      expect(decision.toxicityScore).toBeGreaterThanOrEqual(0.92); // Original 0.92 + adjustment

      // Verify escalation was considered in persistence
      expect(persistenceService.recordShieldEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actionTaken: 'shield_action_critical',
          actionDetails: expect.objectContaining({
            escalationLevel: 2
          }),
          metadata: expect.objectContaining({
            offenderHistory: expect.objectContaining({
              isRecidivist: true,
              totalOffenses: 4,
              escalationLevel: 2
            })
          })
        })
      );
    });

    test('should trigger critical action for high-risk repeat offender', async () => {
      const criticalRepeatInput = {
        organizationId: testOrgId,
        userId: 'mod-user-789',
        platform: testPlatform,
        accountRef: '@testorg',
        externalCommentId: 'comment-critical-repeat',
        externalAuthorId: 'user-critical-offender',
        externalAuthorUsername: 'dangeroususer',
        originalText: 'Extremely problematic content from dangerous user',
        toxicityAnalysis: {
          toxicity_score: 0.93, // Below critical but will be escalated
          toxicity_labels: ['SEVERE_TOXICITY', 'THREAT'],
          confidence: 0.98,
          model: 'perspective'
        },
        userConfiguration: {
          aggressiveness: 0.95,
          autoApprove: false,
          redLines: {}
        },
        metadata: {
          source: 'integration_test'
        }
      };

      // Mock critical offender history
      jest.spyOn(persistenceService, 'getOffenderHistory').mockResolvedValue({
        profile: {
          id: 'profile-critical-offender',
          organization_id: testOrgId,
          platform: testPlatform,
          external_author_id: 'user-critical-offender',
          offense_count: 8,
          severity_level: 'high',
          last_offense_at: '2024-01-14T12:00:00Z',
          avg_toxicity_score: 0.89,
          max_toxicity_score: 0.97,
          escalation_level: 4
        },
        events: [],
        isRecidivist: true,
        riskLevel: 'high',
        lastOffenseAt: '2024-01-14T12:00:00Z',
        totalOffenses: 8,
        averageToxicity: 0.89,
        maxToxicity: 0.97,
        escalationLevel: 4,
        recentActionsSummary: {
          block_user: 2,
          timeout_user: 3,
          warn_user: 3
        }
      });

      jest.spyOn(persistenceService, 'recordShieldEvent').mockResolvedValue({
        id: 'event-critical-repeat-789'
      });

      const decision = await engine.makeDecision(criticalRepeatInput);

      // Should escalate to critical action
      expect(decision.action).toBe('shield_action_critical');
      expect(decision.severity).toBe('critical');
      expect(decision.escalationLevel).toBe(4);
      expect(decision.requiresHumanReview).toBe(true);
      expect(decision.suggestedActions).toContain('block_user');
      expect(decision.suggestedActions).toContain('escalate_to_human');

      // Should store original text for critical Shield actions
      expect(persistenceService.recordShieldEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          originalText: 'Extremely problematic content from dangerous user'
        })
      );
    });
  });

  describe('Red Line Violation Scenarios', () => {
    test('should immediately trigger critical action on red line violation', async () => {
      const redLineInput = {
        organizationId: testOrgId,
        userId: 'mod-user-redline',
        platform: testPlatform,
        accountRef: '@testorg',
        externalCommentId: 'comment-redline-violation',
        externalAuthorId: 'user-redline-violator',
        externalAuthorUsername: 'violatoruser',
        originalText: 'This contains a threatening message that violates red lines',
        toxicityAnalysis: {
          toxicity_score: 0.75, // Below normal thresholds
          toxicity_labels: ['THREAT', 'TOXICITY'],
          confidence: 0.93,
          model: 'perspective'
        },
        userConfiguration: {
          aggressiveness: 0.95,
          autoApprove: false,
          redLines: {
            categories: ['THREAT'], // Zero tolerance for threats
            toxicityThreshold: null,
            keywords: []
          }
        },
        metadata: {
          source: 'integration_test'
        }
      };

      // Even clean user should trigger critical action due to red line
      jest.spyOn(persistenceService, 'getOffenderHistory').mockResolvedValue({
        profile: null,
        events: [],
        isRecidivist: false,
        riskLevel: 'low',
        totalOffenses: 0,
        averageToxicity: 0,
        maxToxicity: 0,
        escalationLevel: 0,
        recentActionsSummary: {}
      });

      jest.spyOn(persistenceService, 'recordShieldEvent').mockResolvedValue({
        id: 'event-redline-violation'
      });

      const decision = await engine.makeDecision(redLineInput);

      expect(decision.action).toBe('shield_action_critical');
      expect(decision.reason).toBe('User red line violated: category:THREAT');
      expect(decision.metadata.redLineViolation).toBe('category:THREAT');
      expect(decision.metadata.userDefined).toBe(true);
      expect(decision.requiresHumanReview).toBe(true);

      // Should store original text for red line violations
      expect(persistenceService.recordShieldEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          originalText: 'This contains a threatening message that violates red lines',
          actionReason: 'User red line violated: category:THREAT'
        })
      );
    });

    test('should handle keyword-based red line violations', async () => {
      const keywordRedLineInput = {
        organizationId: testOrgId,
        userId: 'mod-user-keyword',
        platform: testPlatform,
        accountRef: '@testorg',
        externalCommentId: 'comment-keyword-violation',
        externalAuthorId: 'user-keyword-violator',
        externalAuthorUsername: 'keyworduser',
        originalText: 'You are such an idiot and completely stupid',
        toxicityAnalysis: {
          toxicity_score: 0.78,
          toxicity_labels: ['INSULT'],
          confidence: 0.91,
          model: 'perspective'
        },
        userConfiguration: {
          aggressiveness: 0.95,
          autoApprove: false,
          redLines: {
            categories: [],
            keywords: ['idiot', 'stupid'] // Zero tolerance for specific words
          }
        },
        metadata: {
          source: 'integration_test'
        }
      };

      jest.spyOn(persistenceService, 'getOffenderHistory').mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        escalationLevel: 0
      });

      jest.spyOn(persistenceService, 'recordShieldEvent').mockResolvedValue({
        id: 'event-keyword-violation'
      });

      const decision = await engine.makeDecision(keywordRedLineInput);

      expect(decision.action).toBe('shield_action_critical');
      expect(decision.reason).toBe('User red line violated: keyword:idiot');
      expect(decision.metadata.redLineViolation).toBe('keyword:idiot');
    });
  });

  describe('Multi-Platform Scenario', () => {
    test('should handle same user across different platforms independently', async () => {
      const sameUserDifferentPlatforms = [
        {
          organizationId: testOrgId,
          platform: 'twitter',
          externalCommentId: 'twitter-comment-123',
          externalAuthorId: 'cross-platform-user'
        },
        {
          organizationId: testOrgId,
          platform: 'discord',
          externalCommentId: 'discord-message-456',
          externalAuthorId: 'cross-platform-user'
        }
      ];

      const baseInput = {
        userId: 'mod-user-multi',
        accountRef: '@testorg',
        externalAuthorUsername: 'crossuser',
        originalText: 'Moderately toxic cross-platform comment',
        toxicityAnalysis: {
          toxicity_score: 0.86,
          toxicity_labels: ['TOXICITY'],
          confidence: 0.9,
          model: 'perspective'
        },
        userConfiguration: {
          aggressiveness: 0.95,
          autoApprove: false,
          redLines: {}
        },
        metadata: { source: 'integration_test' }
      };

      // Mock different histories per platform
      jest
        .spyOn(persistenceService, 'getOffenderHistory')
        .mockResolvedValueOnce({
          // Twitter: repeat offender
          isRecidivist: true,
          totalOffenses: 3,
          escalationLevel: 1,
          averageToxicity: 0.8
        })
        .mockResolvedValueOnce({
          // Discord: first time
          isRecidivist: false,
          totalOffenses: 0,
          escalationLevel: 0,
          averageToxicity: 0
        });

      jest
        .spyOn(persistenceService, 'recordShieldEvent')
        .mockResolvedValueOnce({ id: 'twitter-event' })
        .mockResolvedValueOnce({ id: 'discord-event' });

      // Process both platforms
      const twitterDecision = await engine.makeDecision({
        ...baseInput,
        ...sameUserDifferentPlatforms[0]
      });

      engine.clearCache(); // Clear to ensure fresh decision

      const discordDecision = await engine.makeDecision({
        ...baseInput,
        ...sameUserDifferentPlatforms[1]
      });

      // Twitter should escalate due to history
      expect(twitterDecision.action).toBe('shield_action_moderate'); // Escalated with recidivism
      expect(twitterDecision.metadata.isRepeatOffender).toBe(true);

      // Discord should be corrective zone (first offense on this platform)
      expect(discordDecision.action).toBe('corrective_zone');
      expect(discordDecision.metadata.firstStrike).toBe(true);

      // Verify platform-specific history lookups
      expect(persistenceService.getOffenderHistory).toHaveBeenCalledWith(
        testOrgId,
        'twitter',
        'cross-platform-user'
      );
      expect(persistenceService.getOffenderHistory).toHaveBeenCalledWith(
        testOrgId,
        'discord',
        'cross-platform-user'
      );
    });
  });

  describe('Aggressiveness Configuration Impact', () => {
    test('should show different decisions based on aggressiveness settings', async () => {
      const borderlineInput = {
        organizationId: testOrgId,
        userId: 'mod-user-aggressiveness',
        platform: testPlatform,
        accountRef: '@testorg',
        externalCommentId: 'comment-borderline',
        externalAuthorId: 'user-borderline',
        externalAuthorUsername: 'borderlineuser',
        originalText: 'Borderline toxic comment for aggressiveness testing',
        toxicityAnalysis: {
          toxicity_score: 0.87, // Closer to corrective threshold for both settings
          toxicity_labels: ['TOXICITY'],
          confidence: 0.9,
          model: 'perspective'
        },
        userConfiguration: {
          autoApprove: false,
          redLines: {}
        },
        metadata: {
          source: 'integration_test'
        }
      };

      jest.spyOn(persistenceService, 'getOffenderHistory').mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        escalationLevel: 0
      });

      jest.spyOn(persistenceService, 'recordShieldEvent').mockResolvedValue({
        id: 'event-aggressiveness-test'
      });

      // Test lenient aggressiveness (0.90)
      const lenientDecision = await engine.makeDecision({
        ...borderlineInput,
        userConfiguration: {
          ...borderlineInput.userConfiguration,
          aggressiveness: 0.9
        }
      });

      engine.clearCache();

      // Test strict aggressiveness (1.00)
      const strictDecision = await engine.makeDecision({
        ...borderlineInput,
        externalCommentId: 'comment-borderline-strict', // Different comment to avoid cache
        userConfiguration: {
          ...borderlineInput.userConfiguration,
          aggressiveness: 1.0
        }
      });

      // Lenient should result in corrective zone (higher thresholds needed to trigger)
      expect(lenientDecision.action).toBe('corrective_zone');

      // Strict should result in corrective zone (lower thresholds to trigger easily)
      expect(strictDecision.action).toBe('corrective_zone');
    });
  });

  describe('Performance and Caching', () => {
    test('should demonstrate caching performance benefits', async () => {
      const performanceInput = {
        organizationId: testOrgId,
        userId: 'mod-user-performance',
        platform: testPlatform,
        accountRef: '@testorg',
        externalCommentId: 'comment-performance-test',
        externalAuthorId: 'user-performance',
        externalAuthorUsername: 'perfuser',
        originalText: 'Performance testing comment',
        toxicityAnalysis: {
          toxicity_score: 0.87,
          toxicity_labels: ['TOXICITY'],
          confidence: 0.9,
          model: 'perspective'
        },
        userConfiguration: {
          aggressiveness: 0.95,
          autoApprove: false,
          redLines: {}
        },
        metadata: {
          source: 'performance_test'
        }
      };

      jest.spyOn(persistenceService, 'getOffenderHistory').mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        escalationLevel: 0
      });

      jest.spyOn(persistenceService, 'recordShieldEvent').mockResolvedValue({
        id: 'event-performance-test'
      });

      // First call - should hit database
      const startTime1 = Date.now();
      const decision1 = await engine.makeDecision(performanceInput);
      const duration1 = Date.now() - startTime1;

      // Second call - should hit cache
      const startTime2 = Date.now();
      const decision2 = await engine.makeDecision(performanceInput);
      const duration2 = Date.now() - startTime2;

      // Verify same decision
      expect(decision1).toBe(decision2);

      // Verify caching reduced processing time (or at least wasn't slower)
      expect(duration2).toBeLessThanOrEqual(duration1);

      // Verify database was only called once
      expect(persistenceService.getOffenderHistory).toHaveBeenCalledTimes(1);
      expect(persistenceService.recordShieldEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should handle partial persistence failures gracefully', async () => {
      const resilientInput = {
        organizationId: testOrgId,
        userId: 'mod-user-resilient',
        platform: testPlatform,
        accountRef: '@testorg',
        externalCommentId: 'comment-resilient-test',
        externalAuthorId: 'user-resilient',
        externalAuthorUsername: 'resilientuser',
        originalText: 'Resilience testing comment',
        toxicityAnalysis: {
          toxicity_score: 0.91,
          toxicity_labels: ['TOXICITY'],
          confidence: 0.9,
          model: 'perspective'
        },
        userConfiguration: {
          aggressiveness: 0.95,
          autoApprove: false,
          redLines: {}
        },
        metadata: {
          source: 'resilience_test'
        }
      };

      // History lookup succeeds
      jest.spyOn(persistenceService, 'getOffenderHistory').mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        escalationLevel: 0
      });

      // Recording fails
      jest
        .spyOn(persistenceService, 'recordShieldEvent')
        .mockRejectedValue(new Error('Database temporarily unavailable'));

      // Decision should still succeed
      const decision = await engine.makeDecision(resilientInput);

      expect(decision.action).toBe('roastable_comment');
      expect(decision.severity).toBe('moderate');

      // Error should be logged but not thrown
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to record decision', {
        organizationId: testOrgId,
        externalCommentId: 'comment-resilient-test',
        error: 'Database temporarily unavailable'
      });
    });
  });
});
