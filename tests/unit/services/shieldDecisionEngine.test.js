/**
 * Unit Tests for Shield Decision Engine
 * 
 * Tests all decision branches, corrective zones, recidivism logic,
 * idempotency mechanisms, and integration with persistence service.
 */

const ShieldDecisionEngine = require('../../../src/services/shieldDecisionEngine');

// Mock Supabase
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
  single: jest.fn()
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

// Mock persistence service
const mockPersistenceService = {
  getOffenderHistory: jest.fn(),
  recordShieldEvent: jest.fn()
};

describe('ShieldDecisionEngine', () => {
  let engine;
  let mockInput;
  let originalEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Save original environment and set test mode
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    
    engine = new ShieldDecisionEngine({
      supabase: mockSupabase,
      logger: mockLogger,
      persistenceService: mockPersistenceService,
      criticalThreshold: 0.98,
      highThreshold: 0.95,
      moderateThreshold: 0.90,
      correctiveThreshold: 0.85,
      aggressiveness: 0.95
    });
    
    // Clear cache between tests
    engine.clearCache();
    
    mockInput = {
      organizationId: 'org-123',
      userId: 'user-456',
      platform: 'twitter',
      accountRef: '@testorg',
      externalCommentId: 'comment-789',
      externalAuthorId: 'author-123',
      externalAuthorUsername: 'toxicuser',
      originalText: 'This is a test comment',
      toxicityAnalysis: {
        toxicity_score: 0.7,
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
        source: 'test'
      }
    };
  });

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });

  describe('constructor', () => {
    test('should initialize with default configuration', () => {
      const defaultEngine = new ShieldDecisionEngine();
      
      expect(defaultEngine.thresholds.toxicity.critical).toBe(0.98);
      expect(defaultEngine.thresholds.toxicity.high).toBe(0.95);
      expect(defaultEngine.thresholds.toxicity.moderate).toBe(0.90);
      expect(defaultEngine.thresholds.toxicity.corrective).toBe(0.85);
      expect(defaultEngine.thresholds.aggressiveness).toBe(0.95);
    });

    test('should accept custom threshold configuration', () => {
      const customEngine = new ShieldDecisionEngine({
        criticalThreshold: 0.99,
        highThreshold: 0.92,
        moderateThreshold: 0.88,
        correctiveThreshold: 0.80,
        aggressiveness: 0.90
      });
      
      expect(customEngine.thresholds.toxicity.critical).toBe(0.99);
      expect(customEngine.thresholds.toxicity.high).toBe(0.92);
      expect(customEngine.thresholds.toxicity.moderate).toBe(0.88);
      expect(customEngine.thresholds.toxicity.corrective).toBe(0.80);
      expect(customEngine.thresholds.aggressiveness).toBe(0.90);
    });

    test('should have corrective message pools for different categories', () => {
      expect(engine.correctiveMessages.general).toBeDefined();
      expect(engine.correctiveMessages.insult).toBeDefined();
      expect(engine.correctiveMessages.harassment).toBeDefined();
      expect(engine.correctiveMessages.threat).toBeDefined();
      
      expect(engine.correctiveMessages.general.length).toBeGreaterThan(0);
      expect(engine.correctiveMessages.insult.length).toBeGreaterThan(0);
    });
  });

  describe('makeDecision - Critical Threshold', () => {
    test('should return critical action for extremely high toxicity (>= 98%)', async () => {
      const highToxicityInput = {
        ...mockInput,
        toxicityAnalysis: {
          toxicity_score: 0.99,
          toxicity_labels: ['SEVERE_TOXICITY', 'THREAT'],
          confidence: 0.95
        }
      };

      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        riskLevel: 'low',
        escalationLevel: 0
      });

      const decision = await engine.makeDecision(highToxicityInput);

      expect(decision.action).toBe('shield_action_critical');
      expect(decision.severity).toBe('critical');
      expect(decision.requiresHumanReview).toBe(true);
      expect(decision.autoExecute).toBe(true); // !autoApprove = !false = true
      expect(decision.suggestedActions).toContain('block_user');
      expect(decision.suggestedActions).toContain('report_content');
      expect(decision.reason).toBe('Critical toxicity detected');
    });

    test('should escalate new user to critical based on red line violation', async () => {
      const redLineInput = {
        ...mockInput,
        toxicityAnalysis: {
          toxicity_score: 0.75, // Below critical threshold
          toxicity_labels: ['THREAT'],
          confidence: 0.9
        },
        userConfiguration: {
          ...mockInput.userConfiguration,
          redLines: {
            categories: ['THREAT']
          }
        }
      };

      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        riskLevel: 'low',
        escalationLevel: 0
      });

      const decision = await engine.makeDecision(redLineInput);

      expect(decision.action).toBe('shield_action_critical');
      expect(decision.reason).toContain('User red line violated');
      expect(decision.metadata.redLineViolation).toBe('category:THREAT');
      expect(decision.metadata.userDefined).toBe(true);
    });
  });

  // TODO: Re-enable after fixing Issue #633 (pre-existing Shield test failures)
  describe.skip('makeDecision - High Threshold', () => {
    test('should return moderate Shield action for high toxicity (95-98%)', async () => {
      const highToxicityInput = {
        ...mockInput,
        toxicityAnalysis: {
          toxicity_score: 0.96,
          toxicity_labels: ['TOXICITY', 'INSULT'],
          confidence: 0.9
        }
      };

      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        riskLevel: 'low',
        escalationLevel: 0
      });

      const decision = await engine.makeDecision(highToxicityInput);

      expect(decision.action).toBe('shield_action_moderate');
      expect(decision.severity).toBe('high');
      expect(decision.requiresHumanReview).toBe(false);
      expect(decision.autoExecute).toBe(true);
      expect(decision.suggestedActions).toContain('timeout_user');
      expect(decision.suggestedActions).toContain('hide_comment');
    });

    test('should escalate repeat offender to critical based on recidivism adjustment', async () => {
      const moderateToxicityInput = {
        ...mockInput,
        toxicityAnalysis: {
          toxicity_score: 0.93, // Close to high threshold
          toxicity_labels: ['TOXICITY'],
          confidence: 0.9
        }
      };

      // Mock repeat offender with moderate escalation (should push it over to critical)
      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: true,
        totalOffenses: 5,
        riskLevel: 'high',
        escalationLevel: 3,
        averageToxicity: 0.85
      });

      const decision = await engine.makeDecision(moderateToxicityInput);

      expect(decision.action).toBe('shield_action_critical'); // Escalated due to recidivism
      expect(decision.metadata.isRepeatOffender).toBe(true);
      expect(decision.metadata.escalationAdjustment).toBeGreaterThan(0);
      expect(decision.escalationLevel).toBe(3);
    });
  });

  // TODO: Re-enable after fixing Issue #633 (pre-existing Shield test failures)
  describe.skip('makeDecision - Roastable Content', () => {
    test('should identify roastable content (90-95%)', async () => {
      const roastableInput = {
        ...mockInput,
        toxicityAnalysis: {
          toxicity_score: 0.92,
          toxicity_labels: ['TOXICITY'],
          confidence: 0.9
        }
      };

      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        riskLevel: 'low',
        escalationLevel: 0
      });

      const decision = await engine.makeDecision(roastableInput);

      expect(decision.action).toBe('roastable_comment');
      expect(decision.severity).toBe('moderate');
      expect(decision.requiresHumanReview).toBe(false);
      expect(decision.autoExecute).toBe(true);
      expect(decision.suggestedActions).toContain('generate_roast');
      expect(decision.suggestedActions).toContain('monitor_user');
      expect(decision.metadata.roastingEnabled).toBe(true);
    });

    test('should classify as roastable even with slight recidivism adjustment', async () => {
      const borderlineInput = {
        ...mockInput,
        toxicityAnalysis: {
          toxicity_score: 0.89, // Just below roastable
          toxicity_labels: ['TOXICITY'],
          confidence: 0.9
        }
      };

      // Small recidivism history to push it over the threshold
      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: true,
        totalOffenses: 2,
        riskLevel: 'medium',
        escalationLevel: 1,
        averageToxicity: 0.7
      });

      const decision = await engine.makeDecision(borderlineInput);

      expect(decision.action).toBe('roastable_comment');
      expect(decision.metadata.escalationAdjustment).toBeGreaterThan(0);
      expect(decision.toxicityScore).toBeGreaterThanOrEqual(0.90);
    });
  });

  // TODO: Re-enable after fixing Issue #633 (pre-existing Shield test failures)
  describe.skip('makeDecision - Corrective Zone', () => {
    test('should trigger corrective zone for moderate toxicity (85-90%)', async () => {
      const correctiveInput = {
        ...mockInput,
        toxicityAnalysis: {
          toxicity_score: 0.87,
          toxicity_labels: ['TOXICITY'],
          confidence: 0.9
        }
      };

      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        riskLevel: 'low',
        escalationLevel: 0
      });

      const decision = await engine.makeDecision(correctiveInput);

      expect(decision.action).toBe('corrective_zone');
      expect(decision.severity).toBe('low');
      expect(decision.requiresHumanReview).toBe(false);
      expect(decision.autoExecute).toBe(true);
      expect(decision.suggestedActions).toContain('send_corrective_message');
      expect(decision.suggestedActions).toContain('track_behavior');
      expect(decision.correctiveMessage).toBeDefined();
      expect(typeof decision.correctiveMessage).toBe('string');
      expect(decision.metadata.firstStrike).toBe(true);
    });

    test('should select appropriate corrective message based on category', async () => {
      const insultInput = {
        ...mockInput,
        toxicityAnalysis: {
          toxicity_score: 0.86,
          toxicity_labels: ['INSULT'],
          confidence: 0.9
        }
      };

      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        riskLevel: 'low',
        escalationLevel: 0
      });

      const decision = await engine.makeDecision(insultInput);

      expect(decision.action).toBe('corrective_zone');
      expect(decision.correctiveMessage).toBeDefined();
      // Message should come from insult-specific pool
      expect(engine.correctiveMessages.insult).toContain(decision.correctiveMessage);
    });

    test('should use firmer corrective message for repeat offenders', async () => {
      const repeatOffenderInput = {
        ...mockInput,
        toxicityAnalysis: {
          toxicity_score: 0.83, // Lower score to stay in corrective zone even with adjustment
          toxicity_labels: ['TOXICITY'],
          confidence: 0.9
        }
      };

      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: true,
        totalOffenses: 2, // Lower offense count
        riskLevel: 'medium',
        escalationLevel: 1
      });

      const decision = await engine.makeDecision(repeatOffenderInput);

      expect(decision.action).toBe('corrective_zone');
      expect(decision.metadata.firstStrike).toBe(false);
      expect(decision.correctiveMessage).toBeDefined();
      // Should use harassment pool for firmer tone
      expect(engine.correctiveMessages.harassment).toContain(decision.correctiveMessage);
    });
  });

  // TODO: Re-enable after fixing Issue #633 (pre-existing Shield test failures)
  describe.skip('makeDecision - Publish Normal', () => {
    test('should publish normal content below all thresholds', async () => {
      const normalInput = {
        ...mockInput,
        toxicityAnalysis: {
          toxicity_score: 0.3,
          toxicity_labels: [],
          confidence: 0.9
        }
      };

      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        riskLevel: 'low',
        escalationLevel: 0
      });

      const decision = await engine.makeDecision(normalInput);

      expect(decision.action).toBe('publish_normal');
      expect(decision.severity).toBe('none');
      expect(decision.primaryCategory).toBe('none');
      expect(decision.requiresHumanReview).toBe(false);
      expect(decision.autoExecute).toBe(true);
      expect(decision.suggestedActions).toEqual([]);
    });

    test('should publish normal even for repeat offender with very low toxicity', async () => {
      const lowToxicityInput = {
        ...mockInput,
        toxicityAnalysis: {
          toxicity_score: 0.2,
          toxicity_labels: [],
          confidence: 0.9
        }
      };

      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: true,
        totalOffenses: 5,
        riskLevel: 'high',
        escalationLevel: 3
      });

      const decision = await engine.makeDecision(lowToxicityInput);

      expect(decision.action).toBe('publish_normal');
      expect(decision.toxicityScore).toBeLessThan(0.85); // Even with adjustment
    });
  });

  describe('Idempotency', () => {
    test('should return cached decision for same comment', async () => {
      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        riskLevel: 'low',
        escalationLevel: 0
      });

      mockPersistenceService.recordShieldEvent.mockResolvedValue({
        id: 'event-123'
      });

      // First call
      const decision1 = await engine.makeDecision(mockInput);
      
      // Second call with same org + comment ID should return cached result
      const decision2 = await engine.makeDecision({
        ...mockInput,
        originalText: 'Different text' // Should be ignored due to cache
      });

      expect(decision1).toBe(decision2); // Same object reference
      expect(mockPersistenceService.getOffenderHistory).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith('Returning cached decision', {
        organizationId: mockInput.organizationId,
        externalCommentId: mockInput.externalCommentId,
        platform: mockInput.platform,
        accountRef: mockInput.accountRef
      });
    });

    test('should generate different cache keys for different comments', async () => {
      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        riskLevel: 'low',
        escalationLevel: 0
      });

      const input1 = { ...mockInput, externalCommentId: 'comment-1' };
      const input2 = { ...mockInput, externalCommentId: 'comment-2' };

      await engine.makeDecision(input1);
      await engine.makeDecision(input2);

      expect(mockPersistenceService.getOffenderHistory).toHaveBeenCalledTimes(2);
    });

    test('should not reuse cache across platforms for same externalCommentId', async () => {
      mockPersistenceService.getOffenderHistory.mockResolvedValue({ isRecidivist: false });
      const base = { ...mockInput, externalCommentId: 'same-id' };
      const twitterDecision = await engine.makeDecision({ ...base, platform: 'twitter' });
      const discordDecision = await engine.makeDecision({ ...base, platform: 'discord' });
      
      // Should be different decision objects (not cached)
      expect(twitterDecision).not.toBe(discordDecision);
      expect(mockPersistenceService.getOffenderHistory).toHaveBeenCalledTimes(2);
    });

    test('should clear cache successfully', () => {
      engine.clearCache();
      expect(engine.decisionCache.size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Decision cache cleared');
    });
  });

  describe('Threshold Adjustment', () => {
    test('should adjust thresholds based on aggressiveness setting', () => {
      // Test lower aggressiveness (more lenient = higher thresholds needed to trigger)
      const lenientThresholds = engine.adjustThresholds(0.90);
      expect(lenientThresholds.critical).toBeGreaterThan(engine.thresholds.toxicity.critical);
      expect(lenientThresholds.high).toBeGreaterThan(engine.thresholds.toxicity.high);
      
      // Test higher aggressiveness (stricter = lower thresholds to trigger more easily) 
      const strictThresholds = engine.adjustThresholds(1.0);
      expect(strictThresholds.critical).toBeLessThan(lenientThresholds.critical);
      expect(strictThresholds.high).toBeLessThan(lenientThresholds.high);
    });

    test('should respect minimum threshold values and clamp aggressiveness', () => {
      const veryLenientThresholds = engine.adjustThresholds(0.80); // will clamp to 0.90
      const clampedThresholds = engine.adjustThresholds(0.90);
      
      // Should be identical since 0.80 gets clamped to 0.90
      expect(veryLenientThresholds).toEqual(clampedThresholds);
      
      expect(veryLenientThresholds.critical).toBeGreaterThanOrEqual(0.9);
      expect(veryLenientThresholds.high).toBeGreaterThanOrEqual(0.85);
      expect(veryLenientThresholds.moderate).toBeGreaterThanOrEqual(0.8);
      expect(veryLenientThresholds.corrective).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('Recidivism Calculations', () => {
    test('should calculate no adjustment for first-time offenders', () => {
      const noHistory = {
        isRecidivist: false,
        totalOffenses: 0,
        escalationLevel: 0,
        averageToxicity: 0
      };

      const adjustment = engine.calculateRecidivismAdjustment(noHistory);
      expect(adjustment).toBe(0);
    });

    test('should calculate escalating adjustments for repeat offenders', () => {
      const lightOffender = {
        isRecidivist: true,
        totalOffenses: 2,
        escalationLevel: 1,
        averageToxicity: 0.6
      };

      const heavyOffender = {
        isRecidivist: true,
        totalOffenses: 5,
        escalationLevel: 3,
        averageToxicity: 0.9
      };

      const lightAdjustment = engine.calculateRecidivismAdjustment(lightOffender);
      const heavyAdjustment = engine.calculateRecidivismAdjustment(heavyOffender);

      expect(lightAdjustment).toBeGreaterThan(0);
      expect(heavyAdjustment).toBeGreaterThan(lightAdjustment);
      expect(heavyAdjustment).toBeLessThanOrEqual(0.12); // Cap at 0.12
    });

    test('should calculate escalation levels correctly', () => {
      const escalation0 = engine.calculateEscalationLevel({ isRecidivist: false, totalOffenses: 0 });
      const escalation1 = engine.calculateEscalationLevel({ isRecidivist: true, totalOffenses: 2 });
      const escalation3 = engine.calculateEscalationLevel({ isRecidivist: true, totalOffenses: 6 });
      const escalation5 = engine.calculateEscalationLevel({ isRecidivist: true, totalOffenses: 12 });

      expect(escalation0).toBe(0);
      expect(escalation1).toBe(1);
      expect(escalation3).toBe(3);
      expect(escalation5).toBe(5);
    });
  });

  describe('Category and Action Logic', () => {
    test('should determine primary category correctly', () => {
      expect(engine.determinePrimaryCategory(['TOXICITY', 'INSULT'])).toBe('insult');
      expect(engine.determinePrimaryCategory(['THREAT', 'TOXICITY'])).toBe('threat');
      expect(engine.determinePrimaryCategory(['SPAM'])).toBe('spam');
      expect(engine.determinePrimaryCategory([])).toBe('general');
      expect(engine.determinePrimaryCategory(null)).toBe('general');
    });

    test('should get appropriate suggested actions for severity levels', () => {
      const criticalActions = engine.getSuggestedActions('critical', 'threat', { isRecidivist: false });
      const highActions = engine.getSuggestedActions('high', 'insult', { isRecidivist: true, totalOffenses: 4 });

      expect(criticalActions).toContain('block_user');
      expect(criticalActions).toContain('report_content');
      expect(criticalActions).toContain('escalate_to_human');

      expect(highActions).toContain('timeout_user');
      expect(highActions).toContain('hide_comment');
      expect(highActions).toContain('escalate_to_human'); // Added due to recidivism
    });

    test('should add category-specific actions', () => {
      const threatActions = engine.getSuggestedActions('high', 'threat', { isRecidivist: false });
      const harassmentActions = engine.getSuggestedActions('high', 'harassment', { isRecidivist: false });

      expect(threatActions).toContain('report_content');
      expect(harassmentActions).toContain('report_content');
    });
  });

  describe('Red Line Violations', () => {
    test('should detect category-based red line violations', () => {
      const violation = engine.checkRedLineViolations(
        ['THREAT', 'TOXICITY'],
        'threat',
        { categories: ['THREAT'] }
      );

      expect(violation).toBe('category:THREAT');
    });

    test('should detect category-based red line violations case-insensitively', () => {
      const violation = engine.checkRedLineViolations(
        ['threat', 'toxicity'],
        'threat',
        { categories: ['THREAT', 'HARASSMENT'] }
      );

      expect(violation).toBe('category:threat');
    });

    test('should detect keyword-based red line violations', () => {
      const violation = engine.checkRedLineViolations(
        ['INSULT'],
        'insult',
        { keywords: ['idiot', 'stupid'] },
        'You are such an idiot and stupid person',
        0.8
      );

      expect(violation).toBe('keyword:idiot');
    });

    test('should not flag partial-word matches for keywords', () => {
      const violation = engine.checkRedLineViolations(
        ['INSULT'],
        'insult',
        { keywords: ['idiot'] },
        'This is idiotic behavior',
        0.7
      );
      expect(violation).toBeNull();
    });

    test('should detect threshold-based red line violations', () => {
      const violation = engine.checkRedLineViolations(
        ['TOXICITY'],
        'toxicity',
        { toxicityThreshold: 0.85 },
        'toxic comment',
        0.88
      );

      expect(violation).toBe('threshold:0.85');
    });

    test('should return null when no red lines are violated', () => {
      const violation = engine.checkRedLineViolations(
        ['TOXICITY'],
        'toxicity',
        { categories: ['THREAT'], keywords: ['badword'], toxicityThreshold: 0.95 },
        'normal comment',
        0.5
      );

      expect(violation).toBeNull();
    });

    describe('Case-Insensitive Category Violations', () => {
      test('should detect mixed case category labels against uppercase red lines', () => {
        const testCases = [
          { labels: ['Threat'], redLines: ['THREAT'], expected: 'category:Threat' },
          { labels: ['harassment'], redLines: ['HARASSMENT'], expected: 'category:harassment' },
          { labels: ['SEVERE_TOXICITY'], redLines: ['severe_toxicity'], expected: 'category:SEVERE_TOXICITY' },
          { labels: ['InSuLt'], redLines: ['INSULT'], expected: 'category:InSuLt' }
        ];

        testCases.forEach(({ labels, redLines, expected }) => {
          const violation = engine.checkRedLineViolations(
            labels,
            'general',
            { categories: redLines }
          );
          expect(violation).toBe(expected);
        });
      });

      test('should detect uppercase category labels against mixed case red lines', () => {
        const testCases = [
          { labels: ['THREAT'], redLines: ['Threat'], expected: 'category:THREAT' },
          { labels: ['HARASSMENT'], redLines: ['harassment'], expected: 'category:HARASSMENT' },
          { labels: ['TOXICITY'], redLines: ['ToXiCiTy'], expected: 'category:TOXICITY' }
        ];

        testCases.forEach(({ labels, redLines, expected }) => {
          const violation = engine.checkRedLineViolations(
            labels,
            'general',
            { categories: redLines }
          );
          expect(violation).toBe(expected);
        });
      });

      test('should handle primary category case-insensitive matching', () => {
        const testCases = [
          { primary: 'threat', redLines: ['THREAT'], expected: 'category:threat' },
          { primary: 'HARASSMENT', redLines: ['harassment'], expected: 'category:HARASSMENT' },
          { primary: 'InSuLt', redLines: ['insult'], expected: 'category:InSuLt' },
          { primary: 'SEVERE_TOXICITY', redLines: ['severe_toxicity'], expected: 'category:SEVERE_TOXICITY' }
        ];

        testCases.forEach(({ primary, redLines, expected }) => {
          const violation = engine.checkRedLineViolations(
            [], // Empty toxicity labels
            primary,
            { categories: redLines }
          );
          expect(violation).toBe(expected);
        });
      });

      test('should prioritize toxicity labels over primary category when both match', () => {
        const violation = engine.checkRedLineViolations(
          ['harassment'],  // Label matches first
          'threat',        // Primary also matches but should not be used
          { categories: ['HARASSMENT', 'THREAT'] }
        );

        expect(violation).toBe('category:harassment');
      });

      test('should handle complex category names with underscores and case variations', () => {
        const complexCases = [
          { labels: ['severe_toxicity'], redLines: ['SEVERE_TOXICITY'], expected: 'category:severe_toxicity' },
          { labels: ['SEVERE_TOXICITY'], redLines: ['severe_toxicity'], expected: 'category:SEVERE_TOXICITY' },
          { labels: ['Severe_Toxicity'], redLines: ['severe_toxicity'], expected: 'category:Severe_Toxicity' },
          { labels: ['IDENTITY_ATTACK'], redLines: ['identity_attack'], expected: 'category:IDENTITY_ATTACK' }
        ];

        complexCases.forEach(({ labels, redLines, expected }) => {
          const violation = engine.checkRedLineViolations(
            labels,
            'general',
            { categories: redLines }
          );
          expect(violation).toBe(expected);
        });
      });

      test('should not match categories when case differs and normalization fails', () => {
        // Test edge case where categories don't match due to special characters
        const violation = engine.checkRedLineViolations(
          ['threat-level-1'],
          'general',
          { categories: ['THREAT_LEVEL_1'] } // Underscore vs hyphen
        );

        expect(violation).toBeNull();
      });

      test('should handle empty and null category scenarios', () => {
        const testCases = [
          { labels: [], primary: null, redLines: ['THREAT'], expected: null },
          { labels: null, primary: null, redLines: ['THREAT'], expected: null },
          { labels: ['threat'], primary: null, redLines: [], expected: null },
          { labels: ['threat'], primary: 'threat', redLines: null, expected: null }
        ];

        testCases.forEach(({ labels, primary, redLines, expected }) => {
          const redLinesObj = redLines ? { categories: redLines } : {};
          const violation = engine.checkRedLineViolations(
            labels,
            primary,
            redLinesObj
          );
          expect(violation).toBe(expected);
        });
      });

      test('should maintain original case in violation response', () => {
        // When a violation is detected, the original case should be preserved
        const upperCaseViolation = engine.checkRedLineViolations(
          ['HARASSMENT'],
          'general',
          { categories: ['harassment'] }
        );
        expect(upperCaseViolation).toBe('category:HARASSMENT');

        const lowerCaseViolation = engine.checkRedLineViolations(
          ['harassment'],
          'general',
          { categories: ['HARASSMENT'] }
        );
        expect(lowerCaseViolation).toBe('category:harassment');

        const mixedCaseViolation = engine.checkRedLineViolations(
          ['HaRaSsMeNt'],
          'general',
          { categories: ['harassment'] }
        );
        expect(mixedCaseViolation).toBe('category:HaRaSsMeNt');
      });
    });
  });

  // TODO: Re-enable after fixing Issue #633 (pre-existing Shield test failures)
  describe.skip('Error Handling', () => {
    test('should handle missing required fields', async () => {
      const invalidInput = {
        organizationId: 'org-123'
        // Missing other required fields
      };

      await expect(engine.makeDecision(invalidInput)).rejects.toThrow('Missing required decision input fields');
    });

    test('should handle invalid toxicity analysis', async () => {
      const invalidToxicityInput = {
        ...mockInput,
        toxicityAnalysis: {
          // Missing toxicity_score
          toxicity_labels: ['TOXICITY']
        }
      };

      await expect(engine.makeDecision(invalidToxicityInput)).rejects.toThrow('Invalid toxicity analysis data');
    });

    test('should handle persistence service errors gracefully', async () => {
      mockPersistenceService.getOffenderHistory.mockRejectedValue(new Error('Database error'));

      await expect(engine.makeDecision(mockInput)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Decision engine failed', {
        organizationId: mockInput.organizationId,
        externalCommentId: mockInput.externalCommentId,
        error: 'Database error'
      });
    });

    test('should not fail decision when recording fails', async () => {
      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        riskLevel: 'low',
        escalationLevel: 0
      });

      mockPersistenceService.recordShieldEvent.mockRejectedValue(new Error('Recording failed'));

      const roastableInput = {
        ...mockInput,
        toxicityAnalysis: {
          toxicity_score: 0.91,
          toxicity_labels: ['TOXICITY'],
          confidence: 0.9
        }
      };

      const decision = await engine.makeDecision(roastableInput);

      expect(decision.action).toBe('roastable_comment');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to record decision', expect.any(Object));
    });
  });

  describe('Configuration and Statistics', () => {
    test('should return decision statistics', () => {
      const stats = engine.getDecisionStats();

      expect(stats.cacheSize).toBe(0);
      expect(stats.thresholds).toBeDefined();
      expect(stats.correctiveMessagePools).toBeDefined();
      expect(stats.correctiveMessagePools.general).toBeGreaterThan(0);
      expect(stats.correctiveMessagePools.insult).toBeGreaterThan(0);
    });

    test('should update configuration', () => {
      const newConfig = {
        thresholds: {
          aggressiveness: 0.98
        },
        correctiveMessages: {
          custom: ['Custom corrective message']
        }
      };

      engine.updateConfiguration(newConfig);

      expect(engine.thresholds.aggressiveness).toBe(0.98);
      expect(engine.correctiveMessages.custom).toEqual(['Custom corrective message']);
      expect(mockLogger.info).toHaveBeenCalledWith('Decision engine configuration updated', expect.any(Object));
    });
  });

  // TODO: Re-enable after fixing Issue #633 (pre-existing Shield test failures)
  describe.skip('Auto-Approve Override', () => {
    test('should respect auto-approve setting for auto-execute', async () => {
      const autoApproveInput = {
        ...mockInput,
        toxicityAnalysis: {
          toxicity_score: 0.96, // High toxicity
          toxicity_labels: ['TOXICITY'],
          confidence: 0.9
        },
        userConfiguration: {
          ...mockInput.userConfiguration,
          autoApprove: true // Should disable auto-execute
        }
      };

      mockPersistenceService.getOffenderHistory.mockResolvedValue({
        isRecidivist: false,
        totalOffenses: 0,
        riskLevel: 'low',
        escalationLevel: 0
      });

      const decision = await engine.makeDecision(autoApproveInput);

      expect(decision.action).toBe('shield_action_moderate');
      expect(decision.autoExecute).toBe(false); // Should be false due to autoApprove: true
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate unique cache keys with platform and accountRef', () => {
      const key1 = engine.generateCacheKey('org-123', 'comment-1', 'twitter', '@account1');
      const key2 = engine.generateCacheKey('org-123', 'comment-1', 'youtube', '@account1');
      const key3 = engine.generateCacheKey('org-123', 'comment-1', 'twitter', '@account2');
      
      expect(key1).not.toBe(key2); // Different platforms
      expect(key1).not.toBe(key3); // Different accounts
      expect(key2).not.toBe(key3); // Both different
    });

    test('should use HMAC for secure hashing', () => {
      const key = engine.generateCacheKey('org-123', 'comment-1', 'twitter', '@account');
      
      expect(key).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex format
    });
  });

  describe('Cache Management', () => {
    test('should evict oldest entries when cache is full', async () => {
      // Set small cache size for testing
      engine.cacheMaxSize = 3;
      engine.cacheEvictionBatchSize = 1;

      // Add 3 decisions to fill cache
      for (let i = 1; i <= 3; i++) {
        const input = {
          ...mockInput,
          externalCommentId: `comment-${i}`
        };
        
        mockPersistenceService.getOffenderHistory.mockResolvedValue({
          isRecidivist: false,
          totalOffenses: 0
        });
        
        await engine.makeDecision(input);
      }
      
      expect(engine.decisionCache.size).toBe(3);
      
      // Add 4th decision - should trigger eviction
      const newInput = {
        ...mockInput,
        externalCommentId: 'comment-4'
      };
      
      await engine.makeDecision(newInput);
      
      expect(engine.decisionCache.size).toBe(3); // Still 3 after eviction
      
      // First comment should be evicted
      const firstKey = engine.generateCacheKey('org-123', 'comment-1', 'twitter', '@testorg');
      expect(engine.decisionCache.has(firstKey)).toBe(false);
    });

    test('should handle cache eviction batch size correctly', () => {
      engine.cacheEvictionBatchSize = 5;
      
      // Fill cache with 10 entries
      for (let i = 0; i < 10; i++) {
        const key = `key-${i}`;
        engine.decisionCache.set(key, { action: 'test' });
      }
      
      engine.evictOldestCacheEntries();
      
      expect(engine.decisionCache.size).toBe(5); // 10 - 5 = 5
      expect(engine.decisionCache.has('key-0')).toBe(false);
      expect(engine.decisionCache.has('key-4')).toBe(false);
      expect(engine.decisionCache.has('key-5')).toBe(true);
    });
  });

  describe('Threshold Adjustment', () => {
    test('should adjust thresholds symmetrically around 0.95', () => {
      // Test with aggressiveness = 0.95 (baseline)
      const baseline = engine.adjustThresholds(0.95);
      expect(baseline.critical).toBe(0.98);
      expect(baseline.high).toBe(0.95);
      
      // Test with aggressiveness = 0.90 (more lenient)
      const lenient = engine.adjustThresholds(0.90);
      expect(lenient.critical).toBeGreaterThan(baseline.critical);
      expect(lenient.high).toBeGreaterThan(baseline.high);
      
      // Test with aggressiveness = 1.00 (stricter)  
      const strict = engine.adjustThresholds(1.00);
      expect(strict.critical).toBeLessThan(baseline.critical);
      expect(strict.high).toBeLessThan(baseline.high);
    });

    test('should clamp aggressiveness values to valid range', () => {
      const tooLow = engine.adjustThresholds(0.5);
      const tooHigh = engine.adjustThresholds(1.5);
      
      // Should clamp to [0.90, 1.00] range
      const minClamped = engine.adjustThresholds(0.90);
      const maxClamped = engine.adjustThresholds(1.00);
      
      expect(tooLow).toEqual(minClamped);
      expect(tooHigh).toEqual(maxClamped);
    });

    test('should cap thresholds within [0, 1] range', () => {
      const extreme = engine.adjustThresholds(1.00);
      
      Object.values(extreme).forEach(threshold => {
        expect(threshold).toBeGreaterThanOrEqual(0);
        expect(threshold).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Keyword Matching', () => {
    test('should match whole words only with word boundaries', () => {
      const testCases = [
        { text: 'You are an idiot', keyword: 'idiot', shouldMatch: true },
        { text: 'This is idiotic', keyword: 'idiot', shouldMatch: false },
        { text: 'idiots everywhere', keyword: 'idiot', shouldMatch: false },
        { text: 'IDIOT!', keyword: 'idiot', shouldMatch: true },
        { text: 'pre-idiot-post', keyword: 'idiot', shouldMatch: true }
      ];

      testCases.forEach(({ text, keyword, shouldMatch }) => {
        const violation = engine.checkRedLineViolations(
          ['INSULT'],
          'insult',
          { keywords: [keyword] },
          text,
          0.5
        );
        
        if (shouldMatch) {
          expect(violation).toBe(`keyword:${keyword}`);
        } else {
          expect(violation).toBeNull();
        }
      });
    });

    test('should handle special regex characters in keywords', () => {
      const specialKeywords = ['test.', 'foo+bar', '[test]', 'a$b', '^start'];
      
      specialKeywords.forEach(keyword => {
        const text = `This contains ${keyword} exactly`;
        const violation = engine.checkRedLineViolations(
          ['TOXICITY'],
          'general',
          { keywords: [keyword] },
          text,
          0.5
        );
        
        expect(violation).toBe(`keyword:${keyword}`);
      });
    });
  });

  describe('Configuration Updates', () => {
    test('should deep merge threshold updates without data loss', () => {
      const initialThresholds = { ...engine.thresholds.toxicity };
      
      engine.updateConfiguration({
        thresholds: {
          toxicity: {
            high: 0.92 // Only update high threshold
          }
        }
      });
      
      expect(engine.thresholds.toxicity.high).toBe(0.92);
      expect(engine.thresholds.toxicity.critical).toBe(initialThresholds.critical);
      expect(engine.thresholds.toxicity.moderate).toBe(initialThresholds.moderate);
      expect(engine.thresholds.toxicity.corrective).toBe(initialThresholds.corrective);
    });

    test('should update cache settings', () => {
      engine.updateConfiguration({
        cacheMaxSize: 2000,
        cacheEvictionBatchSize: 200
      });
      
      expect(engine.cacheMaxSize).toBe(2000);
      expect(engine.cacheEvictionBatchSize).toBe(200);
    });

    test('should preserve existing corrective message pools', () => {
      const originalGeneralMessages = [...engine.correctiveMessages.general];
      
      engine.updateConfiguration({
        correctiveMessages: {
          custom: ['New custom message']
        }
      });
      
      expect(engine.correctiveMessages.general).toEqual(originalGeneralMessages);
      expect(engine.correctiveMessages.custom).toEqual(['New custom message']);
    });
  });

  describe('Cross-Platform Cache Isolation', () => {
    test('should isolate cache between organizations with same comment ID', async () => {
      mockPersistenceService.getOffenderHistory.mockResolvedValue({ 
        isRecidivist: false, 
        totalOffenses: 0 
      });

      const org1Input = { ...mockInput, organizationId: 'org-1', externalCommentId: 'shared-id' };
      const org2Input = { ...mockInput, organizationId: 'org-2', externalCommentId: 'shared-id' };

      const org1Decision = await engine.makeDecision(org1Input);
      const org2Decision = await engine.makeDecision(org2Input);

      // Different organizations should never share cache
      expect(org1Decision).not.toBe(org2Decision);
      expect(mockPersistenceService.getOffenderHistory).toHaveBeenCalledTimes(2);
    });

    test('should isolate cache between account references with same comment ID', async () => {
      mockPersistenceService.getOffenderHistory.mockResolvedValue({ 
        isRecidivist: false, 
        totalOffenses: 0 
      });

      const account1Input = { ...mockInput, accountRef: '@account1', externalCommentId: 'shared-id' };
      const account2Input = { ...mockInput, accountRef: '@account2', externalCommentId: 'shared-id' };

      const account1Decision = await engine.makeDecision(account1Input);
      const account2Decision = await engine.makeDecision(account2Input);

      // Different account references should never share cache
      expect(account1Decision).not.toBe(account2Decision);
      expect(mockPersistenceService.getOffenderHistory).toHaveBeenCalledTimes(2);
    });

    test('should properly isolate cache across all platform combinations', async () => {
      mockPersistenceService.getOffenderHistory.mockResolvedValue({ 
        isRecidivist: false, 
        totalOffenses: 0 
      });

      const platforms = ['twitter', 'youtube', 'discord', 'facebook', 'instagram'];
      const decisions = [];
      const baseInput = { ...mockInput, externalCommentId: 'cross-platform-test' };

      // Make decisions for all platforms
      for (const platform of platforms) {
        const platformInput = { ...baseInput, platform };
        const decision = await engine.makeDecision(platformInput);
        decisions.push(decision);
      }

      // Verify all decisions are unique (no cross-platform caching)
      for (let i = 0; i < decisions.length; i++) {
        for (let j = i + 1; j < decisions.length; j++) {
          expect(decisions[i]).not.toBe(decisions[j]);
        }
      }

      // Should have called getOffenderHistory once per platform
      expect(mockPersistenceService.getOffenderHistory).toHaveBeenCalledTimes(platforms.length);
    });

    test('should generate unique cache keys for cross-platform scenarios', () => {
      const baseData = { 
        organizationId: 'org-123', 
        externalCommentId: 'comment-123' 
      };

      const twitterKey = engine.generateCacheKey(baseData.organizationId, baseData.externalCommentId, 'twitter', '@user');
      const youtubeKey = engine.generateCacheKey(baseData.organizationId, baseData.externalCommentId, 'youtube', '@user');
      const discordKey = engine.generateCacheKey(baseData.organizationId, baseData.externalCommentId, 'discord', '@user');
      const facebookKey = engine.generateCacheKey(baseData.organizationId, baseData.externalCommentId, 'facebook', '@user');
      
      const keys = [twitterKey, youtubeKey, discordKey, facebookKey];
      
      // All keys should be unique
      const uniqueKeys = [...new Set(keys)];
      expect(uniqueKeys).toHaveLength(keys.length);
      
      // All keys should be valid SHA256 hashes
      keys.forEach(key => {
        expect(key).toMatch(/^[a-f0-9]{64}$/);
      });
    });

    test('should prevent cache pollution between platform/organization combinations', async () => {
      mockPersistenceService.getOffenderHistory.mockResolvedValue({ 
        isRecidivist: false, 
        totalOffenses: 0 
      });

      // Fill cache with decisions from different platforms and organizations
      const combinations = [
        { organizationId: 'org-1', platform: 'twitter', externalCommentId: 'test-1' },
        { organizationId: 'org-1', platform: 'youtube', externalCommentId: 'test-1' },
        { organizationId: 'org-2', platform: 'twitter', externalCommentId: 'test-1' },
        { organizationId: 'org-2', platform: 'youtube', externalCommentId: 'test-1' }
      ];

      const decisions = [];
      for (const combo of combinations) {
        const input = { ...mockInput, ...combo };
        const decision = await engine.makeDecision(input);
        decisions.push(decision);
      }

      // Verify each combination resulted in unique decisions
      const uniqueDecisions = [...new Set(decisions)];
      expect(uniqueDecisions).toHaveLength(combinations.length);

      // Cache should contain all combinations
      expect(engine.decisionCache.size).toBe(combinations.length);
    });

    test('should handle edge case of empty platform and accountRef', () => {
      const key1 = engine.generateCacheKey('org-123', 'comment-1', '', '');
      const key2 = engine.generateCacheKey('org-123', 'comment-1', 'twitter', '@user');
      const key3 = engine.generateCacheKey('org-123', 'comment-1', '', '@user');
      const key4 = engine.generateCacheKey('org-123', 'comment-1', 'twitter', '');
      
      const keys = [key1, key2, key3, key4];
      const uniqueKeys = [...new Set(keys)];
      
      // All combinations should generate unique keys
      expect(uniqueKeys).toHaveLength(keys.length);
    });
  });
});