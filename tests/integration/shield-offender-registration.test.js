/**
 * Shield Offender Registration Integration Tests - Issue #408
 *
 * Tests for recording and tracking offender behavior in the Shield system:
 * - Author information recording with comprehensive metadata
 * - Severity tracking and escalation over time
 * - Violation count tracking per user and across platforms
 * - Risk level calculations based on behavior history
 * - Data persistence and retrieval validation
 * - Input sanitization and validation
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const ShieldService = require('../../src/services/shieldService');

// Mock external dependencies
jest.mock('@supabase/supabase-js');

describe('Shield Offender Registration Tests - Issue #408', () => {
  let shieldService;
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client with comprehensive database operations
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            order: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue({ data: [], error: null })
            }))
          })),
          gte: jest.fn(() => ({
            lte: jest.fn().mockResolvedValue({ data: [], error: null })
          })),
          order: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          }))
        })),
        insert: jest.fn().mockResolvedValue({ data: [{ id: 'mock_behavior_id' }], error: null }),
        upsert: jest.fn().mockResolvedValue({ data: [{ id: 'mock_behavior_id' }], error: null }),
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: [{ id: 'mock_behavior_id' }], error: null })
        }))
      }))
    };

    // Initialize services
    shieldService = new ShieldService();
    shieldService.supabase = mockSupabase;
  });

  afterEach(async () => {
    if (shieldService && shieldService.shutdown) {
      await shieldService.shutdown();
    }
  });

  describe('Author Information Recording', () => {
    it('should record comprehensive author metadata on first violation', async () => {
      const comment = {
        id: 'comment_first_violation',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_first_time',
        platform_username: 'firsttimer',
        original_text: 'First time violation content'
      };

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.35,
        categories: ['TOXICITY']
      };

      // Mock first-time user (no existing behavior)
      mockSupabase
        .from()
        .select()
        .eq()
        .single.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' } // Not found
        });

      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);

      // Verify user behavior was recorded
      expect(mockSupabase.from).toHaveBeenCalledWith('user_behaviors');
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

    it('should include author profile metadata when available', async () => {
      const comment = {
        id: 'comment_with_metadata',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_verified',
        platform_username: 'verifieduser',
        original_text: 'Content from verified user',
        author_metadata: {
          verified: true,
          follower_count: 10000,
          account_age_days: 1000,
          profile_image_url: 'https://example.com/avatar.jpg'
        }
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.6
      };

      await shieldService.analyzeForShield(comment.organization_id, comment, analysisResult);

      // Should include metadata in the behavior record
      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          author_metadata: comment.author_metadata
        }),
        expect.any(Object)
      );
    });

    it('should handle missing author information gracefully', async () => {
      const comment = {
        id: 'comment_missing_info',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_anonymous',
        // Missing platform_username
        original_text: 'Anonymous user content'
      };

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.4
      };

      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);

      // Should still record behavior with available information
      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: comment.organization_id,
          platform_user_id: comment.platform_user_id
        }),
        expect.any(Object)
      );
    });
  });

  describe('Severity Tracking and Escalation', () => {
    it('should track severity escalation over multiple violations', async () => {
      const userId = 'user_escalation_test';
      const organizationId = 'org_123';

      // Mock user with previous violations
      const mockBehavior = {
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        total_comments: 2,
        total_violations: 2,
        severity_counts: { low: 1, medium: 1, high: 0, critical: 0 },
        actions_taken: [
          { action: 'warn', date: '2024-09-01', severity: 'low' },
          { action: 'mute_temp', date: '2024-09-15', severity: 'medium' }
        ],
        is_blocked: false,
        first_seen_at: '2024-09-01T00:00:00Z',
        last_seen_at: '2024-09-15T00:00:00Z'
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockBehavior,
        error: null
      });

      const comment = {
        id: 'comment_escalation',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        platform_username: 'escalatinguser',
        original_text: 'Third violation - should escalate'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.7
      };

      const result = await shieldService.analyzeForShield(organizationId, comment, analysisResult);

      expect(result.shieldActive).toBe(true);
      expect(result.actions.offenseLevel).toBe('repeat');
      expect(result.userBehavior.total_violations).toBe(2);

      // Should escalate action due to history
      expect(['mute_permanent', 'block']).toContain(result.actions.primary);
    });

    it('should calculate severity scores and category tracking', async () => {
      const comment = {
        id: 'comment_severity_calc',
        organization_id: 'org_123',
        platform: 'discord',
        platform_user_id: 'user_severity',
        platform_username: 'severityuser',
        original_text: 'Multi-category violation content'
      };

      const analysisResult = {
        severity_level: 'high',
        toxicity_score: 0.88,
        categories: ['SEVERE_TOXICITY', 'THREAT', 'INSULT']
      };

      await shieldService.analyzeForShield(comment.organization_id, comment, analysisResult);

      // Verify behavior tracking includes severity and categories
      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actions_taken: expect.arrayContaining([
            expect.objectContaining({
              severity: 'high',
              categories: ['SEVERE_TOXICITY', 'THREAT', 'INSULT'],
              toxicity_score: 0.88
            })
          ])
        }),
        expect.any(Object)
      );
    });

    it('should handle severity level progression correctly', async () => {
      const userId = 'user_progression';
      const organizationId = 'org_123';

      // Test progression: low → medium → high → critical
      const progressionSteps = [
        { severity: 'low', score: 0.3, expectedAction: 'warn' },
        { severity: 'medium', score: 0.6, expectedAction: 'mute_temp' },
        { severity: 'high', score: 0.8, expectedAction: 'mute_permanent' },
        { severity: 'critical', score: 0.95, expectedAction: 'block' }
      ];

      for (let i = 0; i < progressionSteps.length; i++) {
        const step = progressionSteps[i];

        // Mock user with i previous violations
        const mockBehavior = {
          total_violations: i,
          actions_taken: progressionSteps.slice(0, i).map((s, idx) => ({
            action: s.expectedAction,
            severity: s.severity,
            date: new Date(Date.now() - (i - idx) * 86400000).toISOString()
          }))
        };

        mockSupabase
          .from()
          .select()
          .eq()
          .single.mockResolvedValueOnce({
            data: i > 0 ? mockBehavior : null,
            error: i > 0 ? null : { code: 'PGRST116' }
          });

        const comment = {
          id: `comment_progression_${i}`,
          organization_id: organizationId,
          platform: 'twitter',
          platform_user_id: userId,
          original_text: `Progression step ${i + 1}`
        };

        const analysisResult = {
          severity_level: step.severity,
          toxicity_score: step.score
        };

        const result = await shieldService.analyzeForShield(
          organizationId,
          comment,
          analysisResult
        );

        expect(result.shieldActive).toBe(true);
        expect(result.actions.severity).toBe(step.severity);
      }
    });
  });

  describe('Violation Count Tracking', () => {
    it('should maintain accurate violation counts per user', async () => {
      const userId = 'user_count_tracking';
      const organizationId = 'org_123';

      // Mock user with existing violations
      const mockBehavior = {
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        total_violations: 3,
        severity_counts: { low: 2, medium: 1, high: 0, critical: 0 },
        actions_taken: [
          { action: 'warn', date: '2024-09-01' },
          { action: 'warn', date: '2024-09-10' },
          { action: 'mute_temp', date: '2024-09-20' }
        ]
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockBehavior,
        error: null
      });

      const comment = {
        id: 'comment_count_test',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        original_text: 'Fourth violation for count test'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.65
      };

      const result = await shieldService.analyzeForShield(organizationId, comment, analysisResult);

      expect(result.userBehavior.total_violations).toBe(3);
      expect(result.actions.violationCount).toBe(3);
      expect(result.actions.offenseLevel).toBe('persistent'); // >= 3 violations
    });

    it('should track violations across multiple platforms for same user', async () => {
      const userId = 'user_cross_platform';
      const organizationId = 'org_123';

      // Mock user with violations across platforms
      const mockBehavior = {
        organization_id: organizationId,
        platform: 'twitter', // Original platform
        platform_user_id: userId,
        total_violations: 2,
        cross_platform_violations: {
          twitter: 1,
          discord: 1,
          youtube: 0
        },
        actions_taken: [
          { action: 'warn', platform: 'twitter', date: '2024-09-01' },
          { action: 'mute_temp', platform: 'discord', date: '2024-09-15' }
        ]
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockBehavior,
        error: null
      });

      const comment = {
        id: 'comment_cross_platform',
        organization_id: organizationId,
        platform: 'youtube', // New platform for this user
        platform_user_id: userId,
        original_text: 'Cross-platform violation'
      };

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.4
      };

      const result = await shieldService.analyzeForShield(organizationId, comment, analysisResult);

      expect(result.userBehavior.total_violations).toBe(2);
      // Should escalate due to cross-platform history
      expect(result.actions.primary).not.toBe('warn');
    });

    it('should handle first-time offenders correctly', async () => {
      const userId = 'user_first_time';
      const organizationId = 'org_123';

      // Mock no existing behavior (first-time user)
      mockSupabase
        .from()
        .select()
        .eq()
        .single.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' }
        });

      const comment = {
        id: 'comment_first_time',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        platform_username: 'newfirsttime',
        original_text: 'First violation ever'
      };

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.35
      };

      const result = await shieldService.analyzeForShield(organizationId, comment, analysisResult);

      expect(result.shieldActive).toBe(true);
      expect(result.actions.offenseLevel).toBe('first');
      expect(result.userBehavior.total_violations).toBe(0);
      expect(result.actions.primary).toBe('warn'); // First offense gets warning
    });
  });

  describe('Risk Level Calculations', () => {
    it('should calculate user risk based on violation history and recency', async () => {
      const userId = 'user_risk_calc';
      const organizationId = 'org_123';

      // Mock user with recent escalating violations
      const mockBehavior = {
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        total_violations: 4,
        severity_counts: { low: 1, medium: 2, high: 1, critical: 0 },
        actions_taken: [
          { action: 'warn', severity: 'low', date: '2024-08-01' },
          { action: 'mute_temp', severity: 'medium', date: '2024-09-01' },
          { action: 'mute_permanent', severity: 'medium', date: '2024-09-15' },
          { action: 'block', severity: 'high', date: '2024-09-25' }
        ],
        last_seen_at: '2024-09-25T00:00:00Z'
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockBehavior,
        error: null
      });

      const comment = {
        id: 'comment_risk_calc',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        original_text: 'Risk calculation test'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.7
      };

      const result = await shieldService.analyzeForShield(organizationId, comment, analysisResult);

      expect(result.userBehavior.total_violations).toBe(4);
      expect(result.actions.offenseLevel).toBe('persistent');

      // Should escalate to higher action due to risk profile
      expect(['report', 'escalate']).toContain(result.actions.primary);
    });

    it('should apply time decay to old violations in risk calculation', async () => {
      const userId = 'user_time_decay';
      const organizationId = 'org_123';

      // Mock user with old violations (should have reduced impact)
      const oldDate = new Date(Date.now() - 200 * 86400000).toISOString(); // 200 days ago
      const mockBehavior = {
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        total_violations: 2,
        actions_taken: [
          { action: 'warn', severity: 'low', date: oldDate },
          { action: 'mute_temp', severity: 'medium', date: oldDate }
        ],
        last_seen_at: oldDate
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockBehavior,
        error: null
      });

      const comment = {
        id: 'comment_time_decay',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        original_text: 'Time decay test after long clean period'
      };

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.3
      };

      const result = await shieldService.analyzeForShield(organizationId, comment, analysisResult);

      // Old violations should have reduced impact
      expect(result.actions.offenseLevel).toBe('first'); // Treated as first-time due to time decay
      expect(result.actions.primary).toBe('warn');
    });

    it('should handle users with no violation history', async () => {
      const userId = 'user_clean_slate';
      const organizationId = 'org_123';

      // Mock clean user (no violations)
      mockSupabase
        .from()
        .select()
        .eq()
        .single.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' }
        });

      const comment = {
        id: 'comment_clean_slate',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        platform_username: 'cleanuser',
        original_text: 'First ever comment from clean user'
      };

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.25
      };

      const result = await shieldService.analyzeForShield(organizationId, comment, analysisResult);

      // Clean user should get base-level response
      expect(result.userBehavior).toEqual(
        expect.objectContaining({
          total_violations: 0,
          actions_taken: []
        })
      );
      expect(result.actions.offenseLevel).toBe('first');
    });
  });

  describe('Data Persistence and Retrieval', () => {
    it('should persist violation data correctly to database', async () => {
      const comment = {
        id: 'comment_persistence',
        organization_id: 'org_123',
        platform: 'discord',
        platform_user_id: 'user_persist',
        platform_username: 'persistuser',
        original_text: 'Persistence test content'
      };

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

      // Verify data was persisted with correct structure
      expect(mockSupabase.from).toHaveBeenCalledWith('user_behaviors');
      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: comment.organization_id,
          platform: comment.platform,
          platform_user_id: comment.platform_user_id,
          platform_username: comment.platform_username,
          actions_taken: expect.arrayContaining([
            expect.objectContaining({
              action: expect.any(String),
              date: expect.any(String),
              reason: expect.any(String),
              comment_id: comment.id
            })
          ])
        }),
        expect.objectContaining({
          onConflict: 'organization_id,platform,platform_user_id'
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      const comment = {
        id: 'comment_db_error',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_db_error',
        original_text: 'Database error test'
      };

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.4
      };

      // Mock database error
      mockSupabase.from().upsert.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed', code: 'DB_CONNECTION_ERROR' }
      });

      // Should not throw error, but handle gracefully
      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);
      // Should still return analysis even if persistence fails
      expect(result.actions).toBeDefined();
    });

    it('should retrieve user behavior history accurately', async () => {
      const userId = 'user_history_test';
      const organizationId = 'org_123';

      // Mock comprehensive behavior history
      const mockBehavior = {
        id: 'behavior_123',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        platform_username: 'historyuser',
        total_comments: 10,
        total_violations: 3,
        severity_counts: { low: 2, medium: 1, high: 0, critical: 0 },
        actions_taken: [
          {
            id: 'action_1',
            action: 'warn',
            date: '2024-09-01T10:00:00Z',
            reason: 'Mild toxicity',
            comment_id: 'comment_1',
            severity: 'low',
            toxicity_score: 0.35
          },
          {
            id: 'action_2',
            action: 'warn',
            date: '2024-09-10T15:30:00Z',
            reason: 'Repeated mild toxicity',
            comment_id: 'comment_2',
            severity: 'low',
            toxicity_score: 0.4
          },
          {
            id: 'action_3',
            action: 'mute_temp',
            date: '2024-09-20T20:45:00Z',
            reason: 'Escalated to harassment',
            comment_id: 'comment_3',
            severity: 'medium',
            toxicity_score: 0.65
          }
        ],
        is_blocked: false,
        first_seen_at: '2024-09-01T10:00:00Z',
        last_seen_at: '2024-09-20T20:45:00Z',
        created_at: '2024-09-01T10:00:00Z',
        updated_at: '2024-09-20T20:45:00Z'
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockBehavior,
        error: null
      });

      const comment = {
        id: 'comment_history_test',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        original_text: 'History retrieval test'
      };

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.3
      };

      const result = await shieldService.analyzeForShield(organizationId, comment, analysisResult);

      expect(result.userBehavior).toEqual(mockBehavior);
      expect(result.userBehavior.total_violations).toBe(3);
      expect(result.userBehavior.actions_taken).toHaveLength(3);
      expect(result.actions.violationCount).toBe(3);
      expect(result.actions.offenseLevel).toBe('persistent');
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should validate required fields before recording behavior', async () => {
      const invalidComment = {
        id: 'comment_invalid',
        // Missing organization_id
        platform: 'twitter',
        platform_user_id: 'user_invalid',
        original_text: 'Invalid comment missing org ID'
      };

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.3
      };

      // Should handle missing required fields gracefully
      const result = await shieldService.analyzeForShield(
        null, // Invalid organization_id
        invalidComment,
        analysisResult
      );

      expect(result.shieldActive).toBe(false);
      expect(result.reason).toBe('plan_restriction'); // Falls back due to missing org
    });

    it('should sanitize user input before storage to prevent XSS/injection', async () => {
      const maliciousComment = {
        id: 'comment_malicious',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_<script>alert("xss")</script>',
        platform_username: 'hacker<script>',
        original_text: '<script>alert("xss attack")</script>Malicious content'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.6
      };

      const result = await shieldService.analyzeForShield(
        maliciousComment.organization_id,
        maliciousComment,
        analysisResult
      );

      expect(result.shieldActive).toBe(true);

      // Verify that input sanitization occurred
      expect(mockSupabase.from().upsert).toHaveBeenCalled();
      const upsertCall = mockSupabase.from().upsert.mock.calls[0][0];

      // Should not contain script tags in stored data
      expect(upsertCall.platform_user_id).not.toContain('<script>');
      expect(upsertCall.platform_username).not.toContain('<script>');
    });

    it('should handle concurrent behavior updates correctly', async () => {
      const userId = 'user_concurrent';
      const organizationId = 'org_123';

      // Mock existing behavior for concurrent update scenario
      const mockBehavior = {
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        total_violations: 1,
        actions_taken: [{ action: 'warn', date: '2024-09-01' }]
      };

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockBehavior,
        error: null
      });

      // Simulate concurrent Shield analyses
      const comment1 = {
        id: 'comment_concurrent_1',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        original_text: 'Concurrent test 1'
      };

      const comment2 = {
        id: 'comment_concurrent_2',
        organization_id: organizationId,
        platform: 'twitter',
        platform_user_id: userId,
        original_text: 'Concurrent test 2'
      };

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.4
      };

      // Run concurrent analyses
      const [result1, result2] = await Promise.all([
        shieldService.analyzeForShield(organizationId, comment1, analysisResult),
        shieldService.analyzeForShield(organizationId, comment2, analysisResult)
      ]);

      expect(result1.shieldActive).toBe(true);
      expect(result2.shieldActive).toBe(true);

      // Both should have accessed user behavior
      expect(result1.userBehavior.total_violations).toBe(1);
      expect(result2.userBehavior.total_violations).toBe(1);
    });
  });

  describe('Performance and Efficiency', () => {
    it('should handle high-volume behavior tracking efficiently', async () => {
      const organizationId = 'org_volume_test';
      const userCount = 50;

      const analysisResult = {
        severity_level: 'low',
        toxicity_score: 0.3
      };

      const startTime = Date.now();

      // Create multiple users with behavior tracking
      const promises = Array.from({ length: userCount }, (_, i) => {
        const comment = {
          id: `comment_volume_${i}`,
          organization_id: organizationId,
          platform: 'twitter',
          platform_user_id: `user_volume_${i}`,
          platform_username: `volumeuser${i}`,
          original_text: `Volume test comment ${i}`
        };

        return shieldService.analyzeForShield(organizationId, comment, analysisResult);
      });

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(userCount);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      // All should be processed successfully
      results.forEach((result) => {
        expect(result.shieldActive).toBe(true);
      });
    });

    it('should complete behavior recording within performance thresholds', async () => {
      const comment = {
        id: 'comment_performance',
        organization_id: 'org_123',
        platform: 'twitter',
        platform_user_id: 'user_performance',
        platform_username: 'perfuser',
        original_text: 'Performance test for behavior recording'
      };

      const analysisResult = {
        severity_level: 'medium',
        toxicity_score: 0.6
      };

      const startTime = Date.now();

      const result = await shieldService.analyzeForShield(
        comment.organization_id,
        comment,
        analysisResult
      );

      const duration = Date.now() - startTime;

      expect(result.shieldActive).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.userBehavior).toBeDefined();
    });
  });
});
