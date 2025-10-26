/**
 * Shield Escalation Logic Integration Tests - Issue #408
 *
 * Tests for escalation matrix and behavior-based action progression:
 * - Time-based escalation thresholds
 * - Count-based escalation triggers
 * - Escalation matrix validation (warn → mute → block → report)
 * - Cross-platform escalation tracking
 * - Configuration-based escalation rules
 * - Emergency escalation for critical content
 *
 * PRODUCTION QUALITY APPROACH (Issue #482):
 * - Uses centralized mock factory with complete Supabase chains
 * - Validates BUSINESS LOGIC (user protection) not implementation details
 * - Realistic test data matching production schema
 * - Tests answer: "Does Shield protect users?" not "Was method called?"
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const ShieldService = require('../../src/services/shieldService');
const {
  createShieldSupabaseMock,
  createUserBehaviorData
} = require('../helpers/mockSupabaseFactory');

// Mock external dependencies
jest.mock('@supabase/supabase-js');

describe('Shield Escalation Logic Tests - Issue #408', () => {
  let shieldService;
  let mockSupabase;
  let mockCostControl;
  let mockQueueService;

  beforeEach(() => {
    jest.clearAllMocks();

    /**
     * Issue #482: Production-ready Supabase mock factory
     * - Complete operation chains (select, insert, update, upsert)
     * - Realistic test data matching production schema
     * - Business logic verification helpers
     *
     * Each test will configure its own user behavior data dynamically
     */
    mockSupabase = createShieldSupabaseMock({
      userBehavior: [],     // Populated dynamically by each test
      shieldActions: [],    // Tracks actions for verification
      jobQueue: [],         // For high-priority queueing
      appLogs: [],          // For audit trail
      enableLogging: false  // Set true for debugging
    });

    // Mock CostControl to allow Shield access
    mockCostControl = {
      canUseShield: jest.fn().mockResolvedValue({ allowed: true })
    };

    // Mock QueueService for high-priority jobs
    mockQueueService = {
      addJob: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
      shutdown: jest.fn().mockResolvedValue(true)
    };

    // Initialize Shield service with all mocks
    shieldService = new ShieldService({ enabled: true, autoActions: false });
    shieldService.supabase = mockSupabase;
    shieldService.costControl = mockCostControl;
    shieldService.queueService = mockQueueService;
  });

  afterEach(async () => {
    if (shieldService && shieldService.shutdown) {
      await shieldService.shutdown();
    }
  });

  describe('Escalation Matrix Validation', () => {
    it('should follow escalation path: warn → mute_temp → mute_permanent → block → report', async () => {
      /**
       * PRODUCTION QUALITY TEST (Issue #482):
       * Validates REAL escalation behavior - "After N violations, does Shield escalate correctly?"
       * NOT just "Was supabase.from() called?"
       *
       * Scenario: Same user commits 6 violations with increasing severity
       * Expected: Shield progressively escalates actions to protect community
       */
      const userId = 'user_escalation_path';
      const organizationId = 'org_123';

      const escalationSteps = [
        {
          step: 1,
          priorViolations: 0,
          severity: 'low',
          expectedAction: 'warn',
          expectedLevel: 'first'
        },
        {
          step: 2,
          priorViolations: 1,
          severity: 'low',
          expectedAction: 'warn',
          expectedLevel: 'repeat'
        },
        {
          step: 3,
          priorViolations: 2,
          severity: 'medium',
          expectedAction: 'mute_temp',
          expectedLevel: 'persistent'
        },
        {
          step: 4,
          priorViolations: 3,
          severity: 'medium',
          expectedAction: 'mute_permanent',
          expectedLevel: 'persistent'
        },
        {
          step: 5,
          priorViolations: 4,
          severity: 'high',
          expectedAction: 'block',
          expectedLevel: 'persistent'
        },
        {
          step: 6,
          priorViolations: 5,
          severity: 'critical',
          expectedAction: 'report',
          expectedLevel: 'dangerous'
        }
      ];

      for (const step of escalationSteps) {
        // Clear previous test data
        mockSupabase._mockData.userBehavior = [];

        // Configure realistic user behavior for this step
        if (step.priorViolations > 0) {
          const userBehavior = createUserBehaviorData({
            userId,
            organizationId,
            platform: 'twitter',
            username: 'escalationuser',
            violationCount: step.priorViolations,
            actionsTaken: Array.from({ length: step.priorViolations }, (_, i) => ({
              action: i === 0 ? 'warn' : 'mute_temp',
              date: new Date(Date.now() - (step.priorViolations - i) * 86400000).toISOString(),
              severity: i < 2 ? 'low' : 'medium'
            })),
            lastViolation: new Date(Date.now() - 86400000).toISOString(),
            lastSeen: new Date(Date.now() - 86400000).toISOString()
          });

          mockSupabase._mockData.userBehavior.push(userBehavior);
        }

        const comment = {
          id: `comment_escalation_step_${step.step}`,
          organization_id: organizationId,
          platform: 'twitter',
          platform_user_id: userId,
          platform_username: 'escalationuser',
          original_text: `Escalation step ${step.step} content`
        };

        const analysisResult = {
          severity_level: step.severity,
          toxicity_score: step.severity === 'critical' ? 0.95 :
                         step.severity === 'high' ? 0.8 :
                         step.severity === 'medium' ? 0.6 : 0.35
        };

        const result = await shieldService.analyzeForShield(
          organizationId,
          comment,
          analysisResult
        );

        // Validate BUSINESS BEHAVIOR not implementation details
        expect(result.shieldActive).toBe(true);
        expect(result.actions.primary).toBe(step.expectedAction);
        expect(result.actions.offenseLevel).toBe(step.expectedLevel);
        expect(result.priority).toBeDefined();
        expect(result.userBehavior).toBeDefined();

        // Validate audit trail was recorded (production requirement)
        // Note: We can add mockSupabase.verify.actionRecorded(step.expectedAction) here
        // if Shield implementation actually records actions
      }
    });

    it('should handle severity-based immediate escalation for critical content', async () => {
      const userId = 'user_critical_escalation';
      const organizationId = 'org_123';

      // Mock first-time user
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }
      });

      const comment = {
        id: 'comment_critical_immediate',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        platform_username: 'criticaluser',
        original_text: 'Immediate threat requiring escalation'
      };

      const analysisResult = {
        severity_level: 'critical',
        toxicity_score: 0.98,
        categories: ['SEVERE_TOXICITY', 'THREAT', 'IDENTITY_ATTACK']
      };

      const result = await shieldService.analyzeForShield(
        organizationId,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      expect(result.actions.primary).toBe('report'); // Skip to report for critical
      expect(result.actions.escalate).toBe(true);
      expect(result.actions.severity).toBe('critical');
      expect(result.priority).toBe(1); // Highest priority
      expect(result.shouldGenerateResponse).toBe(false);
    });

    it('should apply escalation based on violation frequency within time windows', async () => {
      const userId = 'user_frequency_escalation';
      const organizationId = 'org_123';

      // Mock user with recent frequent violations (within 24 hours)
      const recentDate = new Date(Date.now() - 2 * 3600000).toISOString(); // 2 hours ago
      const mockBehavior = {
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        total_violations: 3,
        actions_taken: [
          { action: 'warn', date: new Date(Date.now() - 23 * 3600000).toISOString() },
          { action: 'warn', date: new Date(Date.now() - 12 * 3600000).toISOString() },
          { action: 'mute_temp', date: recentDate }
        ],
        last_seen_at: recentDate
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockBehavior,
        error: null
      });

      const comment = {
        id: 'comment_frequency_test',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        original_text: 'Fourth violation within 24 hours'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.65
      };

      const result = await shieldService.analyzeForShield(
        organizationId,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      expect(result.userBehavior.total_violations).toBe(3);
      expect(result.actions.offenseLevel).toBe('persistent');
      // Should escalate faster due to frequency
      expect(['mute_permanent', 'block']).toContain(result.actions.primary);
      expect(result.shouldGenerateResponse).toBe(false);
    });
  });

  describe('Time-Based Escalation Logic', () => {
    it('should apply time decay for old violations in escalation calculations', async () => {
      const userId = 'user_time_decay_escalation';
      const organizationId = 'org_123';

      // Mock user with old violations (should have reduced escalation impact)
      const oldDate = new Date(Date.now() - (180 * 86400000)).toISOString(); // 180 days ago
      const mockBehavior = {
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        total_violations: 3,
        actions_taken: [
          { action: 'warn', severity: 'low', date: oldDate },
          { action: 'mute_temp', severity: 'medium', date: oldDate },
          { action: 'mute_permanent', severity: 'medium', date: oldDate }
        ],
        last_seen_at: oldDate
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockBehavior,
        error: null
      });

      const comment = {
        id: 'comment_time_decay_escalation',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        original_text: 'New violation after long clean period'
      };

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.35
      };

      const result = await shieldService.analyzeForShield(
        organizationId,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      // Old violations should have reduced impact - treated closer to first offense
      expect(result.actions.offenseLevel).toBe('first');
      expect(result.actions.primary).toBe('warn'); // Reset to warning due to time decay
      expect(result.shouldGenerateResponse).toBe(false);
    });

    it('should escalate faster for violations within cooling-off period', async () => {
      const userId = 'user_cooling_off_test';
      const organizationId = 'org_123';

      // Mock user with recent violation still in cooling-off period
      const recentDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const mockBehavior = {
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        total_violations: 1,
        actions_taken: [
          { action: 'mute_temp', severity: 'medium', date: recentDate, duration: '24h' }
        ],
        is_muted: true,
        mute_expires_at: new Date(Date.now() + 23 * 3600000).toISOString(), // 23 hours from now
        last_seen_at: recentDate
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockBehavior,
        error: null
      });

      const comment = {
        id: 'comment_cooling_off',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        original_text: 'Violation during active mute period'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.6
      };

      const result = await shieldService.analyzeForShield(
        organizationId,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      expect(result.userBehavior.is_muted).toBe(true);
      // Should escalate more aggressively due to violation during active punishment
      expect(['block', 'report']).toContain(result.actions.primary);
      expect(result.shouldGenerateResponse).toBe(false);
    });

    it('should handle escalation windows correctly across different time periods', async () => {
      const userId = 'user_time_windows';
      const organizationId = 'org_123';

      const timeWindows = [
        { hours: 1, expectedEscalation: 'aggressive' },   // Very recent
        { hours: 24, expectedEscalation: 'standard' },    // Within day
        { hours: 168, expectedEscalation: 'reduced' },    // Within week
        { hours: 720, expectedEscalation: 'minimal' }     // Within month
      ];

      for (const window of timeWindows) {
        const violationDate = new Date(Date.now() - (window.hours * 3600000)).toISOString();
        const mockBehavior = {
          organization_id: organizationId,
          platform: 'twitter',
          platform_user_id: userId,
          total_violations: 2,
          actions_taken: [
            { action: 'warn', date: violationDate },
            { action: 'mute_temp', date: violationDate }
          ],
          last_seen_at: violationDate
        };

        mockSupabase.from().select().eq().single.mockResolvedValueOnce({
          data: mockBehavior,
          error: null
        });

        const comment = {
          id: `comment_window_${window.hours}h`,
          organization_id: organizationId,
          platform: 'twitter',
          platform_user_id: userId,
          original_text: `Test escalation window ${window.hours} hours`
        };

        const analysisResult = {
          severity_level: 'medium',
          toxicity_score: 0.6
        };

        const result = await shieldService.analyzeForShield(
          organizationId,
          comment,
          analysisResult
        );

        expect(result.shieldActive).toBe(true);
        expect(result.shouldGenerateResponse).toBe(false);
        
        // Verify escalation follows expected pattern based on time window
        if (window.expectedEscalation === 'aggressive') {
          expect(['block', 'report']).toContain(result.actions.primary);
        } else if (window.expectedEscalation === 'minimal') {
          expect(['warn', 'mute_temp']).toContain(result.actions.primary);
        }
      }
    });
  });

  describe('Cross-Platform Escalation Tracking', () => {
    it('should aggregate violations across platforms for escalation decisions', async () => {
      const userId = 'user_cross_platform_escalation';
      const organizationId = 'org_123';

      // Mock user with violations across multiple platforms
      const mockBehavior = {
        organization_id: organizationId,
        platform: 'twitter', // Primary platform
        platform_user_id: userId,
        total_violations: 3,
        cross_platform_violations: {
          twitter: 2,
          discord: 1,
          youtube: 0
        },
        actions_taken: [
          { action: 'warn', platform: 'twitter', date: '2024-09-01', severity: 'low' },
          { action: 'mute_temp', platform: 'twitter', date: '2024-09-10', severity: 'medium' },
          { action: 'mute_temp', platform: 'discord', date: '2024-09-15', severity: 'medium' }
        ],
        last_seen_at: '2024-09-15T00:00:00Z'
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockBehavior,
        error: null
      });

      const comment = {
        id: 'comment_cross_platform_escalation',
        organization_id: organizationId,
        platform: 'youtube', // New platform for this user
        platform_user_id: userId,
        original_text: 'Cross-platform escalation test'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.65
      };

      const result = await shieldService.analyzeForShield(
        organizationId,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      expect(result.userBehavior.total_violations).toBe(3);
      expect(result.userBehavior.cross_platform_violations).toBeDefined();
      
      // Should escalate based on total cross-platform history
      expect(['mute_permanent', 'block']).toContain(result.actions.primary);
      expect(result.shouldGenerateResponse).toBe(false);
    });

    it('should handle platform-specific escalation policies', async () => {
      const userId = 'user_platform_policies';
      const organizationId = 'org_123';

      const platforms = [
        { name: 'twitter', escalationPolicy: 'standard' },
        { name: 'discord', escalationPolicy: 'aggressive' },  // Gaming community - stricter
        { name: 'youtube', escalationPolicy: 'lenient' }      // Creator platform - more forgiving
      ];

      for (const platform of platforms) {
        // Mock user with platform-specific violation history
        const mockBehavior = {
          organization_id: organizationId,
          platform: platform.name,
          platform_user_id: userId,
          total_violations: 1,
          platform_specific_config: {
            escalation_policy: platform.escalationPolicy
          },
          actions_taken: [
            { action: 'warn', platform: platform.name, date: '2024-09-01' }
          ]
        };

        mockSupabase.from().select().eq().single.mockResolvedValueOnce({
          data: mockBehavior,
          error: null
        });

        const comment = {
          id: `comment_${platform.name}_policy`,
          organization_id: organizationId,
          platform: platform.name,
          platform_user_id: userId,
          original_text: `Platform-specific escalation test for ${platform.name}`
        };

        const analysisResult = {
          severity_level: 'medium',
          toxicity_score: 0.6
        };

        const result = await shieldService.analyzeForShield(
          organizationId,
          comment,
          analysisResult
        );

        expect(result.shieldActive).toBe(true);
        expect(result.shouldGenerateResponse).toBe(false);
        
        // Verify platform-specific escalation behavior
        if (platform.escalationPolicy === 'aggressive') {
          expect(['mute_permanent', 'block']).toContain(result.actions.primary);
        } else if (platform.escalationPolicy === 'lenient') {
          expect(['warn', 'mute_temp']).toContain(result.actions.primary);
        }
      }
    });
  });

  describe('Configuration-Based Escalation Rules', () => {
    it('should respect organization-specific escalation configurations', async () => {
      const userId = 'user_org_config';
      const organizationId = 'org_custom_escalation';

      // Mock organization with custom escalation configuration
      const mockOrgConfig = {
        escalation_matrix: {
          low_severity_threshold: 3,      // 3 strikes before escalation
          medium_severity_threshold: 2,   // 2 strikes for medium
          high_severity_threshold: 1,     // Immediate escalation for high
          time_decay_enabled: true,
          cooling_off_period_hours: 48
        }
      };

      // Mock user with 2 previous violations
      const mockBehavior = {
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        total_violations: 2,
        actions_taken: [
          { action: 'warn', severity: 'low', date: '2024-09-01' },
          { action: 'warn', severity: 'low', date: '2024-09-10' }
        ],
        organization_config: mockOrgConfig
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockBehavior,
        error: null
      });

      const comment = {
        id: 'comment_org_config',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        original_text: 'Testing organization-specific escalation'
      };

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.4
      };

      const result = await shieldService.analyzeForShield(
        organizationId,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      // With custom config requiring 3 strikes for low severity, this should still be warning
      expect(result.actions.primary).toBe('warn');
      expect(result.shouldGenerateResponse).toBe(false);
    });

    it('should handle escalation rule exceptions for special user types', async () => {
      const userId = 'user_verified_creator';
      const organizationId = 'org_123';

      // Mock verified creator with special escalation rules
      const mockBehavior = {
        organization_id: organizationId,
        platform: 'youtube',
        platform_user_id: userId,
        total_violations: 1,
        user_type: 'verified_creator',
        special_escalation_rules: {
          lenient_mode: true,
          warning_threshold_multiplier: 2, // More warnings before escalation
          manual_review_required: true
        },
        actions_taken: [
          { action: 'warn', date: '2024-09-01' }
        ]
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockBehavior,
        error: null
      });

      const comment = {
        id: 'comment_special_user',
        organization_id: organizationId,
        platform: 'youtube',
        platform_user_id: userId,
        platform_username: 'verifiedcreator',
        original_text: 'Content from verified creator'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.65
      };

      const result = await shieldService.analyzeForShield(
        organizationId,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      expect(result.userBehavior.user_type).toBe('verified_creator');
      // Should apply lenient escalation due to special user type
      expect(['warn', 'mute_temp']).toContain(result.actions.primary);
      expect(result.actions.manual_review_required).toBe(true);
      expect(result.shouldGenerateResponse).toBe(false);
    });
  });

  describe('Emergency Escalation Procedures', () => {
    it('should trigger emergency escalation for imminent threats', async () => {
      const comment = {
        id: 'comment_emergency',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_emergency',
        platform_username: 'emergencyuser',
        original_text: 'Imminent threat content requiring immediate escalation'
      };

      const analysisResult = {
        severity_level: 'critical',
        toxicity_score: 0.99,
        categories: ['SEVERE_TOXICITY', 'THREAT', 'IDENTITY_ATTACK'],
        emergency_keywords: ['bomb', 'kill', 'threat'],
        immediate_threat: true
      };

      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      expect(result.actions.primary).toBe('report');
      expect(result.actions.escalate).toBe(true);
      expect(result.actions.emergency).toBe(true);
      expect(result.priority).toBe(1); // Highest priority
      expect(result.actions.notify_authorities).toBe(true);
      expect(result.shouldGenerateResponse).toBe(false);
    });

    it('should bypass normal escalation for legal compliance requirements', async () => {
      const comment = {
        id: 'comment_legal',
        organization_id: 'org_123',
        platform: 'discord',
        platform_user_id: 'user_legal',
        original_text: 'Content requiring legal compliance escalation'
      };

      const analysisResult = {
        severity_level: 'critical',
        toxicity_score: 0.95,
        categories: ['THREAT', 'IDENTITY_ATTACK'],
        legal_compliance_trigger: true,
        jurisdiction: 'EU',
        requires_reporting: true
      };

      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      expect(result.actions.primary).toBe('report');
      expect(result.actions.legal_compliance).toBe(true);
      expect(result.actions.jurisdiction).toBe('EU');
      expect(result.priority).toBe(1);
      expect(result.shouldGenerateResponse).toBe(false);
    });
  });

  describe('Escalation Performance and Edge Cases', () => {
    it('should handle concurrent escalation decisions without race conditions', async () => {
      const userId = 'user_concurrent_escalation';
      const organizationId = 'org_123';

      // Mock existing behavior for concurrent scenario
      const mockBehavior = {
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        total_violations: 2,
        actions_taken: [
          { action: 'warn', date: '2024-09-01' },
          { action: 'mute_temp', date: '2024-09-10' }
        ]
      };

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockBehavior,
        error: null
      });

      // Simulate concurrent escalation analyses
      const comment1 = {
        id: 'comment_concurrent_1',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        original_text: 'Concurrent escalation test 1'
      };

      const comment2 = {
        id: 'comment_concurrent_2',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        original_text: 'Concurrent escalation test 2'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.65
      };

      // Run concurrent analyses
      const [result1, result2] = await Promise.all([
        shieldService.analyzeForShield(organizationId, comment1, analysisResult),
        shieldService.analyzeForShield(organizationId, comment2, analysisResult)
      ]);

      expect(result1.shieldActive).toBe(true);
      expect(result2.shieldActive).toBe(true);
      expect(result1.shouldGenerateResponse).toBe(false);
      expect(result2.shouldGenerateResponse).toBe(false);
      
      // Both should have consistent escalation decisions based on same user history
      expect(result1.actions.primary).toBe(result2.actions.primary);
      expect(result1.userBehavior.total_violations).toBe(2);
      expect(result2.userBehavior.total_violations).toBe(2);
    });

    it('should handle escalation with missing or corrupted behavior data', async () => {
      const comment = {
        id: 'comment_corrupted_data',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_corrupted',
        original_text: 'Test with corrupted behavior data'
      };

      // Mock corrupted behavior data
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          // Corrupted/incomplete data
          total_violations: null,
          actions_taken: 'invalid_json_string',
          last_seen_at: 'invalid_date'
        },
        error: null
      });

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.6
      };

      // Should handle gracefully without crashing
      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      expect(result.shouldGenerateResponse).toBe(false);
      // Should default to first-time user behavior when data is corrupted
      expect(result.actions.offenseLevel).toBe('first');
      expect(result.actions.primary).toBe('warn');
    });

    it('should complete escalation analysis within performance thresholds', async () => {
      const comment = {
        id: 'comment_escalation_performance',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_performance',
        original_text: 'Performance test for escalation analysis'
      };

      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.85
      };

      const startTime = Date.now();
      
      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      const duration = Date.now() - startTime;

      expect(result.shieldActive).toBe(true);
      expect(duration).toBeLessThan(1500); // Should complete within 1.5 seconds
      expect(result.shouldGenerateResponse).toBe(false);
      expect(result.actions).toBeDefined();
    });
  });
});