const { describe, it, beforeEach, afterEach, expect } = require('@jest/globals');
const TriageService = require('../../src/services/triageService');
const TriageFixtures = require('../helpers/triageFixtures');

// Mock external dependencies
jest.mock('../../src/services/shieldDecisionEngine');
jest.mock('../../src/workers/AnalyzeToxicityWorker');
jest.mock('../../src/services/costControl');
jest.mock('../../src/services/planLimitsService', () => ({
  getPlanLimits: jest.fn(),
  getPlanConfig: jest.fn()
}));

const ShieldDecisionEngine = require('../../src/services/shieldDecisionEngine');
const AnalyzeToxicityWorker = require('../../src/workers/AnalyzeToxicityWorker');
const CostControlService = require('../../src/services/costControl');
const planLimitsService = require('../../src/services/planLimitsService');

describe('Triage System Integration Tests', () => {
  let triageService;
  let mockShieldEngine;
  let mockToxicityWorker;
  let mockCostControl;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock implementations
    mockShieldEngine = {
      makeDecision: jest.fn(),
      shouldBlock: jest.fn(),
      logDecision: jest.fn()
    };

    mockToxicityWorker = {
      analyzeToxicity: jest.fn()
    };

    mockCostControl = {
      canPerformOperation: jest.fn(),
      getUserPlan: jest.fn()
    };


    // Mock module implementations
    ShieldDecisionEngine.mockImplementation(() => mockShieldEngine);
    AnalyzeToxicityWorker.mockImplementation(() => mockToxicityWorker);
    CostControlService.mockImplementation(() => mockCostControl);

    // Create fresh service instance
    triageService = new (require('../../src/services/triageService').constructor)();
  });

  afterEach(() => {
    // Clear any cached data
    if (triageService && triageService.clearCache) {
      triageService.clearCache();
    }
  });

  describe('1. Deterministic Decisions (Critical)', () => {
    it('should produce identical results for identical inputs across multiple runs', async () => {
      const comment = {
        id: 'test-comment-001',
        content: 'Esta aplicación es bastante mediocre, esperaba mucho más.',
        platform: 'twitter'
      };
      const organization = {
        id: 'test-org-123',
        plan: 'pro'
      };
      const user = {
        id: 'test-user-456'
      };

      // Setup consistent mocks
      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });
      mockToxicityWorker.analyzeToxicity.mockResolvedValue({
        toxicity: 0.35,
        categories: ['TOXICITY'],
        confidence: 0.95
      });

      // Run the same decision multiple times
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await triageService.analyzeAndRoute(comment, organization, user);
        results.push(result);
      }

      // Verify all results are identical
      const firstResult = results[0];
      results.forEach((result, index) => {
        expect(result.action).toBe(firstResult.action);
        expect(result.confidence).toBe(firstResult.confidence);
        expect(result.toxicity_score).toBe(firstResult.toxicity_score);
        expect(result.reasoning).toBe(firstResult.reasoning);
      });

      // Verify expected decision
      expect(firstResult.action).toBe('roast');
    });

    it('should maintain consistency across service restarts', async () => {
      const comment = {
        id: 'boundary-test',
        content: 'This is moderately annoying content',
        platform: 'twitter'
      };
      const organization = {
        id: 'org-1',
        plan: 'pro'
      };
      const user = {
        id: 'user-1'
      };
      
      // Setup mocks
      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });
      mockToxicityWorker.analyzeToxicity.mockResolvedValue({
        toxicity: 0.25, // Exact threshold
        categories: ['TOXICITY']
      });

      // First service instance
      const result1 = await triageService.analyzeAndRoute(comment, organization, user);

      // Create new service instance (simulating restart)
      const newTriageService = new (require('../../src/services/triageService').constructor)();
      
      const result2 = await newTriageService.analyzeAndRoute(comment, organization, user);

      expect(result1.action).toBe(result2.action);
      expect(result1.action).toBe('roast');
    });
  });

  describe('2. Plan-Specific Thresholds (Critical)', () => {
    const comment = {
      id: 'threshold-test',
      content: 'This is moderately toxic content for threshold testing',
      platform: 'twitter'
    };
    const user = { id: 'test-user' };

    it('should apply Free/Starter plan threshold (0.30)', async () => {
      const organization = { id: 'test-org', plan: 'free' };
      
      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });
      mockToxicityWorker.analyzeToxicity.mockResolvedValue({
        toxicity: 0.35, // Above free threshold
        categories: ['TOXICITY']
      });

      const result = await triageService.analyzeAndRoute(comment, organization, user);
      
      expect(result.action).toBe('roast');
      expect(result.toxicity_score).toBe(0.35);
      expect(result.plan_threshold).toBe(0.30);
    });

    it('should apply Pro plan threshold (0.25)', async () => {
      const organization = { id: 'test-org', plan: 'pro' };
      
      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });
      mockToxicityWorker.analyzeToxicity.mockResolvedValue({
        toxicity: 0.28, // Above pro threshold, below free threshold
        categories: ['TOXICITY']
      });

      const result = await triageService.analyzeAndRoute(comment, organization, user);
      
      expect(result.action).toBe('roast');
      expect(result.toxicity_score).toBe(0.28);
      expect(result.plan_threshold).toBe(0.25);
    });

    it('should apply Plus/Creator plan threshold (0.20)', async () => {
      const organization = { id: 'test-org', plan: 'plus' };
      
      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });
      mockToxicityWorker.analyzeToxicity.mockResolvedValue({
        toxicity: 0.22, // Above plus threshold, below others
        categories: ['TOXICITY']
      });

      const result = await triageService.analyzeAndRoute(comment, organization, user);
      
      expect(result.action).toBe('roast');
      expect(result.toxicity_score).toBe(0.22);
      expect(result.plan_threshold).toBe(0.20);
    });

    it('should apply universal block threshold (0.85)', async () => {
      const plans = ['free', 'starter', 'pro', 'plus', 'creator_plus'];
      
      for (const plan of plans) {
        // Clear mocks between iterations - CodeRabbit recommendation
        jest.clearAllMocks();
        
        const organization = { id: 'test-org', plan };
        
        mockCostControl.canPerformOperation.mockResolvedValue({
          allowed: true
        });
        mockToxicityWorker.analyzeToxicity.mockResolvedValue({
          toxicity: 0.90, // Above block threshold
          categories: ['SEVERE_TOXICITY', 'THREAT']
        });
        mockShieldEngine.makeDecision.mockResolvedValue({
          action: 'block_and_report',
          severity: 'critical'
        });

        const result = await triageService.analyzeAndRoute(comment, organization, { id: `user-${plan}` });
        
        expect(result.action).toBe('block');
        expect(result.toxicity_score).toBe(0.90);
        
        // Enhanced assertions for Shield calls per plan - CodeRabbit recommendation
        if (['starter', 'pro', 'plus', 'creator_plus'].includes(plan)) {
          expect(mockShieldEngine.makeDecision).toHaveBeenCalledTimes(1);
          expect(mockShieldEngine.makeDecision).toHaveBeenCalledWith(
            expect.objectContaining({
              organizationId: 'test-org',
              toxicityAnalysis: expect.objectContaining({
                toxicity: 0.90,
                categories: ['SEVERE_TOXICITY', 'THREAT']
              })
            })
          );
        } else {
          // Shield should never be called for free plans
          expect(mockShieldEngine.makeDecision).not.toHaveBeenCalled();
        }
      }
    });
  });

  describe('3. Integration with Existing Services (Critical)', () => {
    it('should properly integrate with ShieldDecisionEngine for paid plans only', async () => {
      const comment = {
        id: 'shield-test',
        content: 'Eres un idiota completo, ojalá te mueras pronto.',
        platform: 'twitter',
        author: 'toxic_user',
        author_id: 'toxic_123'
      };
      const user = { id: 'test-user' };
      
      const testCases = [
        { plan: 'free', shouldCallShield: false },
        { plan: 'starter', shouldCallShield: true },
        { plan: 'pro', shouldCallShield: true },
        { plan: 'plus', shouldCallShield: true },
        { plan: 'creator_plus', shouldCallShield: true }
      ];

      for (const testCase of testCases) {
        // Clear mocks between iterations - CodeRabbit requirement
        jest.clearAllMocks();
        
        const organization = { id: 'test-org', plan: testCase.plan };
        
        mockCostControl.canPerformOperation.mockResolvedValue({
          allowed: true
        });
        mockToxicityWorker.analyzeToxicity.mockResolvedValue({
          toxicity: 0.88,
          categories: ['SEVERE_TOXICITY', 'THREAT']
        });
        mockShieldEngine.makeDecision.mockResolvedValue({
          action: 'block_and_report',
          severity: 'critical',
          priority: 1,
          escalationLevel: 5
        });

        const result = await triageService.analyzeAndRoute(comment, organization, user);

        expect(result.action).toBe('block');
        
        // Enhanced Shield integration assertions - CodeRabbit recommendation
        if (testCase.shouldCallShield) {
          expect(mockShieldEngine.makeDecision).toHaveBeenCalledTimes(1);
          expect(mockShieldEngine.makeDecision).toHaveBeenCalledWith(
            expect.objectContaining({
              organizationId: 'test-org',
              platform: 'twitter',
              originalText: comment.content,
              toxicityAnalysis: expect.objectContaining({
                toxicity: 0.88,
                categories: ['SEVERE_TOXICITY', 'THREAT']
              }),
              metadata: expect.objectContaining({
                triage_source: true
              })
            })
          );
        } else {
          // Shield should never be called for free plans
          expect(mockShieldEngine.makeDecision).not.toHaveBeenCalled();
        }
      }
    });

    it('should never call Shield for toxicity below block threshold', async () => {
      const comment = {
        id: 'shield-threshold-test',
        content: 'This content is moderately toxic but below block threshold',
        platform: 'twitter'
      };
      const user = { id: 'test-user' };
      
      const testCases = [
        { plan: 'free', toxicity: 0.50 },
        { plan: 'starter', toxicity: 0.60 },
        { plan: 'pro', toxicity: 0.70 },
        { plan: 'plus', toxicity: 0.80 },
        { plan: 'creator_plus', toxicity: 0.84 } // Just below 0.85 threshold
      ];

      for (const testCase of testCases) {
        // Clear mocks between iterations
        jest.clearAllMocks();
        
        const organization = { id: 'test-org', plan: testCase.plan };
        
        mockCostControl.canPerformOperation.mockResolvedValue({
          allowed: true
        });
        mockToxicityWorker.analyzeToxicity.mockResolvedValue({
          toxicity: testCase.toxicity,
          categories: ['TOXICITY']
        });

        const result = await triageService.analyzeAndRoute(comment, organization, user);

        // Should be roast action (not block)
        expect(result.action).toBe('roast');
        expect(result.toxicity_score).toBe(testCase.toxicity);
        
        // Shield should NEVER be called below block threshold regardless of plan
        expect(mockShieldEngine.makeDecision).not.toHaveBeenCalled();
      }
    });

    it('should properly integrate with AnalyzeToxicityWorker', async () => {
      const comment = {
        id: 'toxicity-test',
        content: 'Esta aplicación es bastante mediocre',
        platform: 'twitter'
      };
      const organization = { id: 'test-org', plan: 'pro' };
      const user = { id: 'test-user' };
      
      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });
      mockToxicityWorker.analyzeToxicity.mockResolvedValue({
        toxicity: 0.35,
        categories: ['TOXICITY'],
        confidence: 0.85,
        analysis_time_ms: 150
      });

      await triageService.analyzeAndRoute(comment, organization, user);

      expect(mockToxicityWorker.analyzeToxicity).toHaveBeenCalledWith(comment.content);
    });

    it('should properly integrate with CostControlService', async () => {
      const comment = {
        id: 'cost-test',
        content: 'Test content for cost control',
        platform: 'twitter'
      };
      const organization = { id: 'test-org', plan: 'pro' };
      const user = { id: 'test-user' };
      
      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true,
        remaining: 500,
        resetDate: new Date()
      });
      mockToxicityWorker.analyzeToxicity.mockResolvedValue({
        toxicity: 0.30,
        categories: ['TOXICITY']
      });

      await triageService.analyzeAndRoute(comment, organization, user);

      expect(mockCostControl.canPerformOperation).toHaveBeenCalledWith(
        'test-org',
        'triage_analysis',
        1,
        'internal'
      );
    });

    it('should handle cost control limits properly', async () => {
      const comment = {
        id: 'limit-test',
        content: 'Test content',
        platform: 'twitter'
      };
      const organization = { id: 'test-org', plan: 'free' };
      const user = { id: 'test-user' };
      
      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: false,
        reason: 'monthly_limit_exceeded'
      });

      const result = await triageService.analyzeAndRoute(comment, organization, user);
      
      expect(result.action).toBe('defer');
      expect(result.reasoning).toBe('plan_limit_exceeded');
    });
  });

  describe('4. Edge Cases & Security (Important)', () => {
    it('should validate empty content', async () => {
      const organization = { id: 'test-org', plan: 'pro' };
      const user = { id: 'test-user' };
      
      const emptyCases = [
        { content: '', expected: 'skip' },
        { content: '   ', expected: 'skip' },
        { content: '\n\t', expected: 'skip' }
      ];
      
      for (const testCase of emptyCases) {
        const comment = {
          id: 'empty-test',
          content: testCase.content,
          platform: 'twitter'
        };

        const result = await triageService.analyzeAndRoute(comment, organization, user);
        expect(result.action).toBe(testCase.expected);
        expect(result.reasoning).toBe('validation_failed');
      }
    });

    it('should detect and reject security patterns', async () => {
      const organization = { id: 'test-org', plan: 'pro' };
      const user = { id: 'test-user' };
      
      const securityPatterns = [
        'This app is {{malicious}} content',
        'Test ${injection} attempt',
        '<script>alert("xss")</script>',
        'javascript:void(0)',
        'data:text/html;base64,PHNjcmlwdD4='
      ];

      for (const content of securityPatterns) {
        const comment = {
          id: 'security-test',
          content,
          platform: 'twitter'
        };

        const result = await triageService.analyzeAndRoute(comment, organization, user);
        expect(result.action).toBe('skip');
        expect(result.reasoning).toBe('validation_failed');
        expect(result.validation_errors).toContain('security_pattern_detected');
      }
    });

    it('should enforce content length limits', async () => {
      const organization = { id: 'test-org', plan: 'pro' };
      const user = { id: 'test-user' };
      
      const longContent = 'x'.repeat(10001); // Over 10000 char limit
      const comment = {
        id: 'length-test',
        content: longContent,
        platform: 'twitter'
      };
      
      const result = await triageService.analyzeAndRoute(comment, organization, user);
      expect(result.action).toBe('skip');
      expect(result.reasoning).toBe('validation_failed');
      expect(result.validation_errors).toContain('content_too_long');
    });

    it('should handle special characters and non-English content', async () => {
      const organization = { id: 'test-org', plan: 'pro' };
      const user = { id: 'test-user' };
      
      const specialCases = [
        { content: '🔥💀👻 emoji content', expected: 'publish' },
        { content: 'Ceci est du contenu français', expected: 'publish' },
        { content: 'これは日本語のコンテンツです', expected: 'publish' },
        { content: 'Это русский контент', expected: 'publish' }
      ];

      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });
      mockToxicityWorker.analyzeToxicity.mockResolvedValue({
        toxicity: 0.15, // Low toxicity
        categories: []
      });

      for (const testCase of specialCases) {
        const comment = {
          id: 'special-test',
          content: testCase.content,
          platform: 'twitter'
        };

        const result = await triageService.analyzeAndRoute(comment, organization, user);

        expect(result.action).toBe(testCase.expected);
        expect(result.toxicity_score).toBe(0.15);
      }
    });
  });

  describe('5. Caching & Performance (Important)', () => {
    it('should cache results for identical content', async () => {
      const comment = {
        id: 'cache-test',
        content: 'This content should be cached',
        platform: 'twitter'
      };
      const organization = { id: 'test-org', plan: 'pro' };
      const user = { id: 'test-user' };

      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });
      mockToxicityWorker.analyzeToxicity.mockResolvedValue({
        toxicity: 0.30,
        categories: ['TOXICITY']
      });

      // First call
      const result1 = await triageService.analyzeAndRoute(comment, organization, user);
      
      // Second call should use cache
      const result2 = await triageService.analyzeAndRoute(comment, organization, user);

      expect(result1.action).toBe(result2.action);
      expect(result1.toxicity_score).toBe(result2.toxicity_score);
      expect(mockToxicityWorker.analyzeToxicity).toHaveBeenCalledTimes(1);
    });

    it('should complete decisions within performance thresholds', async () => {
      const comment = {
        id: 'perf-test',
        content: 'Performance test content',
        platform: 'twitter'
      };
      const organization = { id: 'test-org', plan: 'pro' };
      const user = { id: 'test-user' };

      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });
      mockToxicityWorker.analyzeToxicity.mockResolvedValue({
        toxicity: 0.25,
        categories: ['TOXICITY']
      });

      const startTime = Date.now();
      const result = await triageService.analyzeAndRoute(comment, organization, user);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(result.total_time_ms).toBeDefined();
      expect(result.total_time_ms).toBeGreaterThan(0);
    });
  });

  describe('6. Logging & Audit Trail (Important)', () => {
    it('should generate correlation IDs for tracking', async () => {
      const comment = {
        id: 'correlation-test',
        content: 'Correlation ID test',
        platform: 'twitter'
      };
      const organization = { id: 'test-org', plan: 'pro' };
      const user = { id: 'test-user' };

      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });
      mockToxicityWorker.analyzeToxicity.mockResolvedValue({
        toxicity: 0.20,
        categories: []
      });

      const result = await triageService.analyzeAndRoute(comment, organization, user);

      expect(result.correlation_id).toBeDefined();
      expect(result.correlation_id).toMatch(/^triage-\d+-[a-z0-9]+$/);
    });

    it('should include comprehensive metadata in decisions', async () => {
      const comment = {
        id: 'metadata-test',
        content: 'Metadata test content',
        platform: 'twitter'
      };
      const organization = { id: 'test-org', plan: 'pro' };
      const user = { 
        id: 'test-user',
        preferences: { tone: 'witty' }
      };

      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });
      mockToxicityWorker.analyzeToxicity.mockResolvedValue({
        toxicity: 0.30,
        categories: ['TOXICITY'],
        confidence: 0.85
      });

      const result = await triageService.analyzeAndRoute(comment, organization, user);

      // Verify comprehensive metadata
      expect(result.timestamp).toBeDefined();
      expect(result.plan).toBe('pro');
      expect(result.plan_threshold).toBe(0.25);
      expect(result.toxicity_score).toBe(0.30);
      expect(result.toxicity_categories).toContain('TOXICITY');
      expect(result.confidence).toBe(0.85);
      expect(result.user_id).toBe('test-user');
      expect(result.user_preferences).toEqual({ tone: 'witty' });
    });
  });

  describe('7. Boundary Testing', () => {
    it('should handle exact threshold boundaries correctly', async () => {
      const boundaryTests = [
        { plan: 'free', toxicity: 0.299, expected: 'publish' },
        { plan: 'free', toxicity: 0.301, expected: 'roast' },
        { plan: 'pro', toxicity: 0.249, expected: 'publish' },
        { plan: 'pro', toxicity: 0.251, expected: 'roast' },
        { plan: 'plus', toxicity: 0.199, expected: 'publish' },
        { plan: 'plus', toxicity: 0.201, expected: 'roast' },
        { plan: 'pro', toxicity: 0.849, expected: 'roast' },
        { plan: 'pro', toxicity: 0.851, expected: 'block' }
      ];
      
      for (const test of boundaryTests) {
        const comment = {
          id: `boundary-${test.plan}-${test.toxicity}`,
          content: `Boundary test content for ${test.plan} plan`,
          platform: 'twitter'
        };
        const organization = { id: 'test-org', plan: test.plan };
        const user = { id: 'test-user' };
        
        mockCostControl.canPerformOperation.mockResolvedValue({
          allowed: true
        });
        mockToxicityWorker.analyzeToxicity.mockResolvedValue({
          toxicity: test.toxicity,
          categories: test.toxicity > 0.5 ? ['TOXICITY'] : []
        });

        if (test.expected === 'block') {
          mockShieldEngine.makeDecision.mockResolvedValue({
            action: 'block',
            severity: 'high'
          });
        }

        const result = await triageService.analyzeAndRoute(comment, organization, user);

        expect(result.action).toBe(test.expected);
        expect(result.toxicity_score).toBe(test.toxicity);
      }
    });
  });

  describe('8. Fixture Validation', () => {
    it('should validate publish fixtures produce expected results', async () => {
      for (const fixture of TriageFixtures.publish) {
        const comment = {
          id: fixture.id,
          content: fixture.content,
          platform: fixture.platform
        };
        const organization = { id: 'test-org', plan: 'pro' };
        const user = { id: 'test-user' };

        mockCostControl.canPerformOperation.mockResolvedValue({
          allowed: true
        });
        mockToxicityWorker.analyzeToxicity.mockResolvedValue({
          toxicity: fixture.toxicity,
          categories: fixture.categories
        });

        const result = await triageService.analyzeAndRoute(comment, organization, user);

        expect(result.action).toBe('publish');
        expect(result.toxicity_score).toBe(fixture.toxicity);
      }
    });

    it('should validate roast fixtures produce expected results', async () => {
      for (const fixture of TriageFixtures.roast) {
        // Use appropriate plan based on fixture expectations
        let plan = 'free';
        if (typeof fixture.expected_action === 'object') {
          // Find a plan where this should roast
          plan = Object.keys(fixture.expected_action).find(p => 
            fixture.expected_action[p] === 'roast'
          ) || 'free';
        } else {
          plan = 'free'; // Default plan for simple roast cases
        }

        const comment = {
          id: fixture.id,
          content: fixture.content,
          platform: fixture.platform
        };
        const organization = { id: 'test-org', plan };
        const user = { id: 'test-user' };

        mockCostControl.canPerformOperation.mockResolvedValue({
          allowed: true
        });
        mockToxicityWorker.analyzeToxicity.mockResolvedValue({
          toxicity: fixture.toxicity,
          categories: fixture.categories
        });

        const result = await triageService.analyzeAndRoute(comment, organization, user);

        const expectedAction = typeof fixture.expected_action === 'object' 
          ? fixture.expected_action[plan] 
          : fixture.expected_action;

        expect(result.action).toBe(expectedAction);
        expect(result.toxicity_score).toBe(fixture.toxicity);
      }
    });

    it('should validate block fixtures produce expected results', async () => {
      for (const fixture of TriageFixtures.block) {
        const comment = {
          id: fixture.id,
          content: fixture.content,
          platform: fixture.platform
        };
        const organization = { id: 'test-org', plan: 'pro' };
        const user = { id: 'test-user' };

        mockCostControl.canPerformOperation.mockResolvedValue({
          allowed: true
        });
        mockToxicityWorker.analyzeToxicity.mockResolvedValue({
          toxicity: fixture.toxicity,
          categories: fixture.categories
        });
        mockShieldEngine.makeDecision.mockResolvedValue({
          action: 'block_and_report',
          severity: 'critical',
          priority: fixture.shield_priority || 2
        });

        const result = await triageService.analyzeAndRoute(comment, organization, user);

        expect(result.action).toBe('block');
        expect(result.toxicity_score).toBe(fixture.toxicity);
        
        if (fixture.shield_expected) {
          expect(mockShieldEngine.makeDecision).toHaveBeenCalled();
        }
      }
    });
  });

  describe('9. Error Handling & Fallbacks', () => {
    it('should handle toxicity analysis failures gracefully', async () => {
      const comment = {
        id: 'error-test',
        content: 'Error test content',
        platform: 'twitter'
      };
      const organization = { id: 'test-org', plan: 'pro' };
      const user = { id: 'test-user' };

      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });
      mockToxicityWorker.analyzeToxicity.mockRejectedValue(
        new Error('Toxicity analysis failed')
      );

      const result = await triageService.analyzeAndRoute(comment, organization, user);

      expect(result.action).toBe('publish'); // Conservative fallback
      expect(result.fallback_used).toBe(true);
      expect(result.toxicity_score).toBe(0.5); // Conservative middle ground
    });

    it('should handle Shield service failures gracefully for paid plans', async () => {
      const comment = {
        id: 'shield-error-test',
        content: 'High toxicity content',
        platform: 'twitter'
      };
      const user = { id: 'test-user' };

      const paidPlans = ['starter', 'pro', 'plus', 'creator_plus'];

      for (const plan of paidPlans) {
        // Clear mocks between iterations
        jest.clearAllMocks();
        
        const organization = { id: 'test-org', plan };

        mockCostControl.canPerformOperation.mockResolvedValue({
          allowed: true
        });
        mockToxicityWorker.analyzeToxicity.mockResolvedValue({
          toxicity: 0.90, // Should trigger block
          categories: ['SEVERE_TOXICITY']
        });
        mockShieldEngine.makeDecision.mockRejectedValue(
          new Error('Shield service unavailable')
        );

        const result = await triageService.analyzeAndRoute(comment, organization, user);

        expect(result.action).toBe('block'); // Still blocks high toxicity
        expect(result.shield_decision).toBeNull(); // But no Shield decision
        
        // Verify Shield was called but failed for paid plans
        expect(mockShieldEngine.makeDecision).toHaveBeenCalledTimes(1);
        expect(mockShieldEngine.makeDecision).toHaveBeenCalledWith(
          expect.objectContaining({
            organizationId: 'test-org',
            platform: 'twitter',
            toxicityAnalysis: expect.objectContaining({
              toxicity: 0.90,
              categories: ['SEVERE_TOXICITY']
            })
          })
        );
      }
    });
  });
});