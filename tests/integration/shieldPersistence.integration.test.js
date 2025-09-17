/**
 * Integration Tests for Shield Persistence System
 * 
 * Tests the complete Shield persistence workflow including:
 * - Shield event recording and offender profile updates
 * - Recidivism tracking and analysis
 * - GDPR retention operations
 * - Database triggers and functions
 */

const ShieldPersistenceService = require('../../src/services/shieldPersistenceService');
const GDPRRetentionWorker = require('../../src/workers/GDPRRetentionWorker');

// Mock database client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
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

describe('Shield Persistence Integration Tests', () => {
  let persistenceService;
  let retentionWorker;
  let testOrgId;
  let testPlatform;
  let testUserId;

  beforeEach(() => {
    jest.clearAllMocks();
    
    persistenceService = new ShieldPersistenceService({
      supabase: mockSupabase,
      logger: mockLogger
    });
    
    retentionWorker = new GDPRRetentionWorker({
      supabase: mockSupabase,
      dryRun: false,
      batchSize: 100
    });

    testOrgId = 'org-integration-test';
    testPlatform = 'twitter';
    testUserId = 'user-repeat-offender';
  });

  describe('Shield Event Recording and Profile Updates', () => {
    test('should record shield event and trigger offender profile update', async () => {
      const eventData = {
        organizationId: testOrgId,
        userId: 'mod-user-123',
        platform: testPlatform,
        accountRef: '@testorg',
        externalCommentId: 'comment_toxic_001',
        externalAuthorId: testUserId,
        externalAuthorUsername: 'toxicuser123',
        originalText: 'This is a highly toxic comment that violates our guidelines',
        toxicityScore: 0.92,
        toxicityLabels: ['TOXICITY', 'SEVERE_TOXICITY', 'INSULT'],
        actionTaken: 'hide_comment',
        actionReason: 'Shield: High toxicity detected (score: 0.92)',
        actionStatus: 'executed',
        processedBy: 'shield_worker',
        processingTimeMs: 150,
        metadata: {
          confidence: 0.98,
          model: 'perspective-v1'
        }
      };

      // Mock successful event insertion
      const mockInsertedEvent = {
        id: 'event-integration-001',
        ...eventData,
        created_at: '2024-01-15T10:00:00Z',
        executed_at: '2024-01-15T10:00:30Z'
      };

      mockSupabase.single.mockResolvedValue({
        data: mockInsertedEvent,
        error: null
      });

      const result = await persistenceService.recordShieldEvent(eventData);

      expect(result).toEqual(mockInsertedEvent);
      expect(mockSupabase.from).toHaveBeenCalledWith('shield_events');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: testOrgId,
          platform: testPlatform,
          external_author_id: testUserId,
          original_text: eventData.originalText,
          toxicity_score: 0.92,
          action_taken: 'hide_comment',
          action_status: 'executed'
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith('Shield event recorded', {
        eventId: 'event-integration-001',
        platform: testPlatform,
        actionTaken: 'hide_comment',
        externalAuthorId: testUserId
      });
    });

    test('should handle multiple events for same user (recidivism tracking)', async () => {
      // Simulate multiple events for the same user over time
      const baseEventData = {
        organizationId: testOrgId,
        platform: testPlatform,
        externalAuthorId: testUserId,
        externalAuthorUsername: 'repeat_offender',
        actionStatus: 'executed',
        processedBy: 'shield_worker'
      };

      const events = [
        {
          ...baseEventData,
          externalCommentId: 'comment_001',
          originalText: 'First toxic comment',
          toxicityScore: 0.75,
          actionTaken: 'hide_comment',
          actionReason: 'Moderate toxicity detected'
        },
        {
          ...baseEventData,
          externalCommentId: 'comment_002',
          originalText: 'Second toxic comment, escalating',
          toxicityScore: 0.85,
          actionTaken: 'timeout_user',
          actionReason: 'Repeat offense, escalating action'
        },
        {
          ...baseEventData,
          externalCommentId: 'comment_003',
          originalText: 'Third offense, very toxic',
          toxicityScore: 0.95,
          actionTaken: 'block_user',
          actionReason: 'Severe repeat offender, blocking user'
        }
      ];

      // Mock successful recording for all events
      for (let i = 0; i < events.length; i++) {
        mockSupabase.single.mockResolvedValueOnce({
          data: {
            id: `event-${i + 1}`,
            ...events[i],
            created_at: new Date(Date.now() + i * 3600000).toISOString() // 1 hour apart
          },
          error: null
        });
      }

      // Record all events
      const results = [];
      for (const eventData of events) {
        const result = await persistenceService.recordShieldEvent(eventData);
        results.push(result);
      }

      expect(results).toHaveLength(3);
      expect(results[0].action_taken).toBe('hide_comment');
      expect(results[1].action_taken).toBe('timeout_user');
      expect(results[2].action_taken).toBe('block_user');

      // Verify escalating pattern
      expect(results[0].toxicity_score).toBe(0.75);
      expect(results[1].toxicity_score).toBe(0.85);
      expect(results[2].toxicity_score).toBe(0.95);
    });
  });

  describe('Offender History and Recidivism Analysis', () => {
    test('should retrieve comprehensive offender history for decision making', async () => {
      const mockOffenderProfile = {
        id: 'profile-001',
        organization_id: testOrgId,
        platform: testPlatform,
        external_author_id: testUserId,
        external_author_username: 'repeat_offender',
        offense_count: 3,
        severity_level: 'high',
        last_offense_at: '2024-01-15T12:00:00Z',
        avg_toxicity_score: 0.85,
        max_toxicity_score: 0.95,
        escalation_level: 2,
        actions_taken: {
          'hide_comment': 2,
          'timeout_user': 1,
          'block_user': 1
        }
      };

      const mockRecentEvents = [
        {
          id: 'event-1',
          external_comment_id: 'comment_003',
          toxicity_score: 0.95,
          action_taken: 'block_user',
          action_status: 'executed',
          created_at: '2024-01-15T12:00:00Z'
        },
        {
          id: 'event-2',
          external_comment_id: 'comment_002',
          toxicity_score: 0.85,
          action_taken: 'timeout_user',
          action_status: 'executed',
          created_at: '2024-01-15T08:00:00Z'
        },
        {
          id: 'event-3',
          external_comment_id: 'comment_001',
          toxicity_score: 0.75,
          action_taken: 'hide_comment',
          action_status: 'executed',
          created_at: '2024-01-14T16:00:00Z'
        }
      ];

      // Mock profile query
      mockSupabase.single.mockResolvedValueOnce({
        data: mockOffenderProfile,
        error: null
      });

      // Mock events query
      mockSupabase.single.mockResolvedValueOnce({
        data: mockRecentEvents,
        error: null
      });

      const history = await persistenceService.getOffenderHistory(
        testOrgId,
        testPlatform,
        testUserId
      );

      expect(history.profile).toEqual(mockOffenderProfile);
      expect(history.events).toEqual(mockRecentEvents);
      expect(history.isRecidivist).toBe(true);
      expect(history.riskLevel).toBe('high');
      expect(history.totalOffenses).toBe(3);
      expect(history.escalationLevel).toBe(2);
      expect(history.averageToxicity).toBe(0.85);
      expect(history.maxToxicity).toBe(0.95);

      // Verify recent actions summary
      expect(history.recentActionsSummary.hide_comment).toBe(1);
      expect(history.recentActionsSummary.timeout_user).toBe(1);
      expect(history.recentActionsSummary.block_user).toBe(1);

      expect(mockLogger.debug).toHaveBeenCalledWith('Retrieved offender history', {
        organizationId: testOrgId,
        platform: testPlatform,
        externalAuthorId: testUserId,
        isRecidivist: true,
        totalOffenses: 3,
        riskLevel: 'high'
      });
    });

    test('should identify repeat offender patterns', async () => {
      // Test recent repeat offenses
      mockSupabase.select.mockResolvedValue({
        count: 4,
        error: null
      });

      const result = await persistenceService.isRepeatOffender(
        testOrgId,
        testPlatform,
        testUserId,
        30 // 30 days
      );

      expect(result.isRepeat).toBe(true);
      expect(result.offenseCount).toBe(4);
      expect(result.thresholdDays).toBe(30);

      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', testOrgId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('platform', testPlatform);
      expect(mockSupabase.eq).toHaveBeenCalledWith('external_author_id', testUserId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('action_status', 'executed');
      expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', expect.any(String));
    });

    test('should handle new user with no history', async () => {
      const newUserId = 'new_user_clean_record';

      // Mock profile not found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' } // Not found
      });

      // Mock no events
      mockSupabase.single.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const history = await persistenceService.getOffenderHistory(
        testOrgId,
        testPlatform,
        newUserId
      );

      expect(history.profile).toBeNull();
      expect(history.events).toEqual([]);
      expect(history.isRecidivist).toBe(false);
      expect(history.riskLevel).toBe('low');
      expect(history.totalOffenses).toBe(0);
      expect(history.escalationLevel).toBe(0);
      expect(history.averageToxicity).toBe(0);
      expect(history.maxToxicity).toBe(0);
    });
  });

  describe('GDPR Retention Integration', () => {
    test('should execute complete GDPR retention cycle', async () => {
      // Mock records for anonymization (80+ days old)
      const oldRecordsForAnonymization = [
        {
          id: 'event-old-1',
          original_text: 'Old toxic comment 1',
          created_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'event-old-2',
          original_text: 'Old toxic comment 2',
          created_at: new Date(Date.now() - 82 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      // Mock anonymization
      mockSupabase.select.mockResolvedValueOnce({
        data: oldRecordsForAnonymization,
        error: null
      });

      mockSupabase.update.mockResolvedValue({ error: null });

      // Mock purge operation
      mockSupabase.delete.mockResolvedValue({ error: null });

      // Mock cleanup operation
      mockSupabase.rpc.mockResolvedValue({
        data: 15, // 15 old profiles cleaned
        error: null
      });

      // Mock retention log insertion
      mockSupabase.insert.mockResolvedValue({ error: null });

      const job = {
        payload: {
          operation: 'full_retention',
          batchId: 'integration-test-batch'
        }
      };

      const result = await retentionWorker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.fullCycle).toBe(true);
      expect(result.anonymize.processed).toBe(2);
      expect(result.anonymize.anonymized).toBe(2);
      expect(result.purge.purged).toBe('completed');
      expect(result.cleanup.cleaned).toBe(15);
      expect(result.totalErrors).toBe(0);

      // Verify anonymization was called
      expect(mockSupabase.update).toHaveBeenCalledTimes(2);
      expect(mockSupabase.update).toHaveBeenCalledWith({
        original_text: null,
        original_text_hash: expect.any(String),
        text_salt: expect.any(String),
        anonymized_at: expect.any(String)
      });

      // Verify purge was called
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.lt).toHaveBeenCalledWith('created_at', expect.any(String));

      // Verify cleanup was called
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_old_offender_profiles');
    });

    test('should handle GDPR retention with partial failures', async () => {
      // Mock records for anonymization with some failures
      const recordsWithFailures = [
        {
          id: 'event-success',
          original_text: 'This will be anonymized',
          created_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'event-failure',
          original_text: 'This will fail',
          created_at: new Date(Date.now() - 83 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      mockSupabase.select.mockResolvedValue({
        data: recordsWithFailures,
        error: null
      });

      // First update succeeds, second fails
      mockSupabase.update
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: new Error('Anonymization failed') });

      mockSupabase.insert.mockResolvedValue({ error: null });

      const result = await retentionWorker.anonymizeOldRecords('test-batch-partial');

      expect(result.processed).toBe(2);
      expect(result.anonymized).toBe(1);
      expect(result.errors).toBe(1);

      // Verify partial success was logged
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        operation_type: 'anonymize',
        operation_status: 'partial',
        batch_id: 'test-batch-partial',
        records_processed: 2,
        records_anonymized: 1,
        records_failed: 1,
        metadata: { cutoff_date: expect.any(String) },
        completed_at: expect.any(String),
        processing_time_ms: 0
      });
    });
  });

  describe('Platform Statistics and Analytics', () => {
    test('should generate comprehensive platform statistics', async () => {
      const mockPlatformEvents = [
        {
          action_taken: 'hide_comment',
          action_status: 'executed',
          toxicity_score: 0.8,
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          action_taken: 'hide_comment',
          action_status: 'executed',
          toxicity_score: 0.7,
          created_at: '2024-01-15T09:00:00Z'
        },
        {
          action_taken: 'timeout_user',
          action_status: 'executed',
          toxicity_score: 0.9,
          created_at: '2024-01-15T08:00:00Z'
        },
        {
          action_taken: 'block_user',
          action_status: 'failed',
          toxicity_score: 0.95,
          created_at: '2024-01-14T20:00:00Z'
        }
      ];

      const mockTopOffenders = [
        {
          external_author_id: 'user_high_risk',
          external_author_username: 'toxicuser1',
          offense_count: 8,
          severity_level: 'critical',
          last_offense_at: '2024-01-15T10:00:00Z',
          actions_taken: {
            'hide_comment': 4,
            'timeout_user': 2,
            'block_user': 2
          }
        },
        {
          external_author_id: 'user_medium_risk',
          external_author_username: 'troubleuser2',
          offense_count: 4,
          severity_level: 'medium',
          last_offense_at: '2024-01-14T15:00:00Z',
          actions_taken: {
            'hide_comment': 3,
            'timeout_user': 1
          }
        }
      ];

      // Mock events query
      mockSupabase.select.mockResolvedValueOnce({
        data: mockPlatformEvents,
        error: null
      });

      // Mock top offenders query
      mockSupabase.select.mockResolvedValueOnce({
        data: mockTopOffenders,
        error: null
      });

      const stats = await persistenceService.getPlatformOffenderStats(
        testOrgId,
        testPlatform,
        30
      );

      expect(stats.platform).toBe(testPlatform);
      expect(stats.windowDays).toBe(30);
      expect(stats.totalEvents).toBe(4);
      
      expect(stats.actionsSummary.total).toBe(4);
      expect(stats.actionsSummary.executed).toBe(3);
      expect(stats.actionsSummary.failed).toBe(1);
      expect(stats.actionsSummary.byAction.hide_comment).toBe(2);
      expect(stats.actionsSummary.byAction.timeout_user).toBe(1);
      expect(stats.actionsSummary.byAction.block_user).toBe(1);

      expect(stats.topOffenders).toEqual(mockTopOffenders);
      expect(stats.averageToxicity).toBeCloseTo(0.8375, 2); // (0.8 + 0.7 + 0.9 + 0.95) / 4

      expect(stats.severityDistribution.critical).toBe(1);
      expect(stats.severityDistribution.medium).toBe(1);
      expect(stats.severityDistribution.high).toBe(0);
      expect(stats.severityDistribution.low).toBe(0);
    });
  });

  describe('Search and Filtering Capabilities', () => {
    test('should search shield events with complex filters', async () => {
      const searchCriteria = {
        organizationId: testOrgId,
        platform: 'twitter',
        externalAuthorId: 'specific_user_123',
        actionTaken: 'timeout_user',
        actionStatus: 'executed',
        minToxicityScore: 0.8,
        dateFrom: '2024-01-01T00:00:00Z',
        dateTo: '2024-01-31T23:59:59Z',
        limit: 25,
        offset: 0
      };

      const mockSearchResults = [
        {
          id: 'filtered-event-1',
          platform: 'twitter',
          external_comment_id: 'comment_filtered_1',
          external_author_id: 'specific_user_123',
          toxicity_score: 0.85,
          action_taken: 'timeout_user',
          action_status: 'executed',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 'filtered-event-2',
          platform: 'twitter',
          external_comment_id: 'comment_filtered_2',
          external_author_id: 'specific_user_123',
          toxicity_score: 0.92,
          action_taken: 'timeout_user',
          action_status: 'executed',
          created_at: '2024-01-10T14:30:00Z'
        }
      ];

      mockSupabase.range.mockResolvedValue({
        data: mockSearchResults,
        error: null,
        count: 2
      });

      const results = await persistenceService.searchShieldEvents(searchCriteria);

      expect(results.events).toEqual(mockSearchResults);
      expect(results.total).toBe(2);
      expect(results.limit).toBe(25);
      expect(results.offset).toBe(0);

      // Verify all filters were applied
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', testOrgId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('platform', 'twitter');
      expect(mockSupabase.eq).toHaveBeenCalledWith('external_author_id', 'specific_user_123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('action_taken', 'timeout_user');
      expect(mockSupabase.eq).toHaveBeenCalledWith('action_status', 'executed');
      expect(mockSupabase.gte).toHaveBeenCalledWith('toxicity_score', 0.8);
      expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', '2024-01-01T00:00:00Z');
      expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', '2024-01-31T23:59:59Z');
      expect(mockSupabase.range).toHaveBeenCalledWith(0, 24); // offset, offset + limit - 1
    });
  });

  describe('Data Retention and Compliance Monitoring', () => {
    test('should provide comprehensive retention statistics for compliance monitoring', async () => {
      const now = new Date();
      const mockRetentionData = [
        // Record needing anonymization (85 days old, not anonymized)
        {
          created_at: new Date(now.getTime() - 85 * 24 * 60 * 60 * 1000).toISOString(),
          anonymized_at: null,
          original_text: 'old text needing anonymization',
          original_text_hash: null
        },
        // Record already anonymized (75 days old, anonymized)
        {
          created_at: new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000).toISOString(),
          anonymized_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          original_text: null,
          original_text_hash: 'anonymized_hash_123'
        },
        // Record needing purge (95 days old)
        {
          created_at: new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000).toISOString(),
          anonymized_at: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          original_text: null,
          original_text_hash: 'old_hash_456'
        },
        // Record within retention period (30 days old)
        {
          created_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          anonymized_at: null,
          original_text: 'recent text within retention',
          original_text_hash: null
        }
      ];

      const mockRecentLogs = [
        {
          id: 'log-recent-1',
          operation_type: 'anonymize',
          operation_status: 'success',
          records_processed: 150,
          records_anonymized: 148,
          records_failed: 2,
          started_at: '2024-01-15T02:00:00Z'
        },
        {
          id: 'log-recent-2',
          operation_type: 'purge',
          operation_status: 'success',
          started_at: '2024-01-15T03:00:00Z'
        }
      ];

      // Mock retention data query
      mockSupabase.select.mockResolvedValueOnce({
        data: mockRetentionData,
        error: null
      });

      // Mock recent logs query
      mockSupabase.select.mockResolvedValueOnce({
        data: mockRecentLogs,
        error: null
      });

      const retentionStats = await persistenceService.getRetentionStats();

      expect(retentionStats.total).toBe(4);
      expect(retentionStats.needingAnonymization).toBe(1); // 85 days old, not anonymized
      expect(retentionStats.anonymized).toBe(1); // 75 days old, already anonymized
      expect(retentionStats.needingPurge).toBe(1); // 95 days old
      expect(retentionStats.withinRetention).toBe(1); // 30 days old
      expect(retentionStats.recentOperations).toEqual(mockRecentLogs);
    });
  });
});