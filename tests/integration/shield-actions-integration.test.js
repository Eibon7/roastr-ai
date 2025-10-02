/**
 * Shield Actions Integration Tests - Issue #408
 * 
 * Comprehensive integration tests for Shield system actions and execution:
 * - Verify hide/block/report/escalate actions are applied correctly
 * - Ensure actions are queued with proper priority
 * - Test platform-specific implementations
 * - Validate that NO responses are generated when Shield acts
 * - Test error handling and resilience
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const ShieldService = require('../../src/services/shieldService');
const ShieldActionWorker = require('../../src/workers/ShieldActionWorker');

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../../src/services/queueService');
jest.mock('../../src/services/costControl');

describe('Shield Actions Integration Tests - Issue #408', () => {
  let shieldService;
  let shieldActionWorker;
  let mockSupabase;
  let mockQueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Supabase client
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          }))
        })),
        insert: jest.fn().mockResolvedValue({ data: [{ id: 'mock_id' }], error: null }),
        upsert: jest.fn().mockResolvedValue({ data: [{ id: 'mock_id' }], error: null })
      }))
    };

    // Mock Queue Service
    mockQueueService = {
      addJob: jest.fn().mockResolvedValue({ id: 'job_123' }),
      shutdown: jest.fn().mockResolvedValue()
    };

    // Initialize services
    shieldService = new ShieldService();
    shieldService.supabase = mockSupabase;
    shieldService.queueService = mockQueueService;

    shieldActionWorker = new ShieldActionWorker();
    shieldActionWorker.supabase = mockSupabase;
  });

  afterEach(async () => {
    if (shieldService && shieldService.shutdown) {
      await shieldService.shutdown();
    }
  });

  describe('Shield Hide Actions', () => {
    it('should execute hide action for low toxicity content without generating response', async () => {
      const comment = {
        id: 'comment_123',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_456',
        platform_username: 'testuser',
        original_text: 'This app is not very good'
      };

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.35,
        categories: ['TOXICITY']
      };

      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      expect(result.actions.primary).toBe('warn');
      expect(result.shouldGenerateResponse).toBe(false); // Core requirement
      
      // Verify action was queued
      expect(mockSupabase.from).toHaveBeenCalledWith('job_queue');
    });

    it('should handle platform-specific hide actions correctly', async () => {
      const platforms = ['twitter', 'discord', 'youtube'];
      
      for (const platform of platforms) {
        const comment = {
          id: `comment_${platform}`,
          organization_id: 'org_123',
          platform,
          platform_user_id: 'user_456',
          original_text: 'Low toxicity content'
        };

        const analysisResult = {
          severity_level: 'low',
          toxicity_score: 0.3
        };

        const result = await shieldService.analyzeForShield(
          comment.organization_id,
          comment,
          analysisResult
        );

        expect(result.shieldActive).toBe(true);
        expect(result.actions.platformActions[platform]).toBeDefined();
        expect(result.shouldGenerateResponse).toBe(false);
      }
    });
  });

  describe('Shield Block Actions', () => {
    it('should execute block action for medium toxicity content', async () => {
      const comment = {
        id: 'comment_block_123',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_456',
        platform_username: 'testuser',
        original_text: 'You are such an idiot for using this'
      };

      // Mock user with previous violation
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          total_violations: 1,
          actions_taken: [{ action: 'warn', date: '2024-09-01' }]
        },
        error: null
      });

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.65,
        categories: ['TOXICITY', 'INSULT']
      };

      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      expect(result.actions.primary).toBe('mute_temp');
      expect(result.shouldGenerateResponse).toBe(false);
      
      // Verify user behavior was updated
      expect(mockSupabase.from).toHaveBeenCalledWith('user_behaviors');
    });

    it('should record offender information in database', async () => {
      const comment = {
        id: 'comment_record_123',
        organization_id: 'org_123',
        platform: 'discord',
        platform_user_id: 'user_789',
        platform_username: 'offender',
        original_text: 'Harassment content'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.7
      };

      await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      // Verify offender was recorded
      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: comment.organization_id,
          platform: comment.platform,
          platform_user_id: comment.platform_user_id,
          platform_username: comment.platform_username
        }),
        expect.any(Object)
      );
    });
  });

  describe('Shield Report Actions', () => {
    it('should execute report action for high toxicity content', async () => {
      const comment = {
        id: 'comment_report_123',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_toxic',
        platform_username: 'toxicuser',
        original_text: 'I hope you die you worthless piece of trash'
      };

      // Mock user with multiple violations
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          total_violations: 2,
          actions_taken: [
            { action: 'warn', date: '2024-09-01' },
            { action: 'mute_temp', date: '2024-09-15' }
          ]
        },
        error: null
      });

      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.85,
        categories: ['SEVERE_TOXICITY', 'THREAT']
      };

      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      expect(result.actions.primary).toBe('block');
      expect(result.shouldGenerateResponse).toBe(false);
      expect(result.priority).toBe(1); // High priority
    });

    it('should include detailed violation context in reports', async () => {
      const comment = {
        id: 'comment_context_123',
        organization_id: 'org_123',
        platform: 'youtube',
        platform_user_id: 'user_context',
        original_text: 'High toxicity with context'
      };

      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.9,
        categories: ['SEVERE_TOXICITY', 'THREAT', 'INSULT']
      };

      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      // Verify detailed logging
      expect(mockSupabase.from).toHaveBeenCalledWith('app_logs');
      expect(result.actions.severity).toBe('high');
      expect(result.userBehavior).toBeDefined();
    });
  });

  describe('Shield Escalate Actions', () => {
    it('should execute escalate action for critical content requiring human review', async () => {
      const comment = {
        id: 'comment_escalate_123',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_critical',
        platform_username: 'criticaluser',
        original_text: 'Imminent threat requiring immediate escalation'
      };

      const analysisResult = {
        severity_level: 'critical',
        toxicity_score: 0.98,
        categories: ['SEVERE_TOXICITY', 'THREAT', 'IDENTITY_ATTACK']
      };

      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      expect(result.actions.primary).toBe('report');
      expect(result.actions.escalate).toBe(true);
      expect(result.shouldGenerateResponse).toBe(false);
      expect(result.priority).toBe(1); // Critical priority
    });

    it('should handle auto-execution vs manual escalation paths', async () => {
      const comment = {
        id: 'comment_auto_123',
        organization_id: 'org_123',
        platform: 'discord',
        platform_user_id: 'user_auto',
        original_text: 'Critical content for auto-execution test'
      };

      const analysisResult = {
        severity_level: 'critical',
        toxicity_score: 0.96
      };

      // Test with auto-actions enabled
      shieldService.options.autoActions = true;

      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      expect(result.autoExecuted).toBe(true);
      expect(result.shouldGenerateResponse).toBe(false);
    });
  });

  describe('Action Priority and Queuing', () => {
    it('should queue actions with correct priority levels', async () => {
      const testCases = [
        { severity: 'low', expectedPriority: 5 },
        { severity: 'medium', expectedPriority: 3 },
        { severity: 'high', expectedPriority: 2 },
        { severity: 'critical', expectedPriority: 1 }
      ];

      for (const testCase of testCases) {
        const comment = {
          id: `comment_priority_${testCase.severity}`,
          organization_id: 'org_123',
          platform: 'twitter',
          platform_user_id: 'user_priority',
          original_text: `${testCase.severity} severity content`
        };

        const analysisResult = {
          severity_level: testCase.severity,
          toxicity_score: testCase.severity === 'critical' ? 0.95 : 0.5
        };

        const result = await shieldService.analyzeForShield(
          comment.organization_id,
          comment,
          analysisResult
        );

        expect(result.priority).toBe(testCase.expectedPriority);
        expect(result.shouldGenerateResponse).toBe(false);
      }
    });

    it('should handle queue failures gracefully without generating responses', async () => {
      // Mock queue failure
      mockSupabase.from().insert.mockRejectedValueOnce(new Error('Queue unavailable'));

      const comment = {
        id: 'comment_queue_fail',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_fail',
        original_text: 'Content for queue failure test'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.6
      };

      // Should not throw error
      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      expect(result.shouldGenerateResponse).toBe(false); // Even on failure
    });
  });

  describe('Platform Integration through Workers', () => {
    it('should process Shield actions through ShieldActionWorker', async () => {
      const job = {
        id: 'job_worker_123',
        payload: {
          comment_id: 'comment_123',
          organization_id: 'org_123',
          platform: 'twitter',
          platform_user_id: 'user_456',
          platform_username: 'testuser',
          action: 'hideComment',
          duration: null,
          shield_mode: true
        }
      };

      // Mock platform clients
      shieldActionWorker.platformClients = new Map();
      shieldActionWorker.platformClients.set('twitter', {
        v2: {
          hideReply: jest.fn().mockResolvedValue({ data: { hidden: true } })
        }
      });

      const result = await shieldActionWorker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.action).toBe('hideComment');
      expect(result.platform).toBe('twitter');
      // Verify no response was generated
      expect(result.responseGenerated).toBe(false);
    });

    it('should handle multiple platform actions in sequence', async () => {
      const platforms = ['twitter', 'discord', 'youtube'];
      
      for (const platform of platforms) {
        const job = {
          id: `job_${platform}`,
          payload: {
            comment_id: `comment_${platform}`,
            organization_id: 'org_123',
            platform,
            action: 'blockUser',
            shield_mode: true
          }
        };

        // Mock platform client
        const mockClient = {
          blockUser: jest.fn().mockResolvedValue({ success: true })
        };
        shieldActionWorker.platformClients = new Map();
        shieldActionWorker.platformClients.set(platform, mockClient);

        const result = await shieldActionWorker.processJob(job);

        expect(result.success).toBe(true);
        expect(result.platform).toBe(platform);
        expect(result.responseGenerated).toBe(false);
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle platform API failures without system crash', async () => {
      const job = {
        id: 'job_api_fail',
        payload: {
          comment_id: 'comment_fail',
          organization_id: 'org_123',
          platform: 'twitter',
          action: 'blockUser',
          shield_mode: true
        }
      };

      // Mock API failure
      const mockClient = {
        blockUser: jest.fn().mockRejectedValue(new Error('Twitter API unavailable'))
      };
      shieldActionWorker.platformClients = new Map();
      shieldActionWorker.platformClients.set('twitter', mockClient);

      const result = await shieldActionWorker.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.retryable).toBe(true);
      expect(result.responseGenerated).toBe(false);
    });

    it('should validate Shield action parameters before execution', async () => {
      const invalidJob = {
        id: 'job_invalid',
        payload: {
          // Missing required fields
          organization_id: 'org_123',
          platform: 'twitter'
          // Missing comment_id, action
        }
      };

      const result = await shieldActionWorker.processJob(invalidJob);

      expect(result.success).toBe(false);
      expect(result.validationError).toBeDefined();
      expect(result.responseGenerated).toBe(false);
    });

    it('should handle malicious input safely', async () => {
      const maliciousComment = {
        id: '<script>alert("xss")</script>',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: '1\' OR \'1\'=\'1',
        platform_username: 'hacker',
        original_text: '"; DROP TABLE users; --'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.6
      };

      // Should not crash or cause security issues
      const result = await shieldService.analyzeForShield(
        maliciousComment.organization_id,
        maliciousComment,
        analysisResult
      );

      expect(result).toBeDefined();
      expect(result.shouldGenerateResponse).toBe(false);
      // Input should be sanitized in database calls
      expect(mockSupabase.from().upsert).toHaveBeenCalled();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume Shield actions efficiently', async () => {
      const comments = Array.from({ length: 20 }, (_, i) => ({
        id: `comment_volume_${i}`,
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: `user_${i}`,
        original_text: `Test comment ${i}`
      }));

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.3
      };

      const startTime = Date.now();
      
      const promises = comments.map(comment =>
        shieldService.analyzeForShield(
          comment.organization_id,
          comment,
          analysisResult
        )
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(20);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify all results have the core requirement
      results.forEach(result => {
        expect(result.shouldGenerateResponse).toBe(false);
      });
    });

    it('should complete Shield analysis within performance thresholds', async () => {
      const comment = {
        id: 'comment_performance',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_perf',
        original_text: 'Performance test comment'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.5
      };

      const startTime = Date.now();
      
      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.shouldGenerateResponse).toBe(false);
    });
  });

  describe('Core Requirement Validation', () => {
    it('should NEVER generate responses when Shield is active', async () => {
      const testCases = [
        { severity: 'low', action: 'warn' },
        { severity: 'medium', action: 'mute_temp' },
        { severity: 'high', action: 'block' },
        { severity: 'critical', action: 'report' }
      ];

      for (const testCase of testCases) {
        const comment = {
          id: `comment_no_response_${testCase.severity}`,
          organization_id: 'org_123',
          platform: 'twitter',
          platform_user_id: 'user_no_response',
          original_text: `${testCase.severity} severity content`
        };

        const analysisResult = {
          severity_level: testCase.severity,
          toxicity_score: testCase.severity === 'critical' ? 0.95 : 0.5
        };

        const result = await shieldService.analyzeForShield(
          comment.organization_id,
          comment,
          analysisResult
        );

        // CORE REQUIREMENT: Shield actions must NEVER generate responses
        expect(result.shouldGenerateResponse).toBe(false);
        expect(result.shieldActive).toBe(true);
        expect(result.actions.primary).toBeDefined();
      }
    });

    it('should log complete audit trail for Shield actions', async () => {
      const comment = {
        id: 'comment_audit',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_audit',
        platform_username: 'audituser',
        original_text: 'Content for audit trail test'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.7
      };

      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      // Verify comprehensive logging
      expect(mockSupabase.from).toHaveBeenCalledWith('app_logs');
      expect(result.actions).toBeDefined();
      expect(result.userBehavior).toBeDefined();
      expect(result.priority).toBeDefined();
      expect(result.shouldGenerateResponse).toBe(false);
    });
  });
});