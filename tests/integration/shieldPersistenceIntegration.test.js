/**
 * Integration Tests for Shield Persistence Service
 * 
 * Tests the complete Shield persistence workflow including
 * event recording, history tracking, and GDPR retention.
 */

const ShieldPersistenceService = require('../../src/services/shieldPersistenceService');
const ShieldDecisionEngine = require('../../src/services/shieldDecisionEngine');

// Mock Supabase for integration testing
const createMockSupabase = () => {
  const mockDatabase = {
    shield_events: [],
    offender_profiles: [],
    shield_retention_log: []
  };

  const mockSupabase = {
    from: jest.fn((table) => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn(),
        
        async mockExecution() {
          // Simulate database operations
          return { data: null, error: null };
        }
      };
      
      return mockQuery;
    })
  };

  return { mockSupabase, mockDatabase };
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

describe('Shield Persistence Integration', () => {
  let persistenceService;
  let decisionEngine;
  let mockSupabase;
  let mockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    process.env.SHIELD_ANONYMIZATION_SECRET = 'test-secret-integration';

    const mockSetup = createMockSupabase();
    mockSupabase = mockSetup.mockSupabase;
    mockDatabase = mockSetup.mockDatabase;

    persistenceService = new ShieldPersistenceService({
      supabase: mockSupabase,
      logger: mockLogger
    });

    decisionEngine = new ShieldDecisionEngine({
      supabase: mockSupabase,
      logger: mockLogger,
      persistenceService: persistenceService
    });
  });

  describe('Complete Shield Event Workflow', () => {
    test('should record Shield event and track offender history', async () => {
      const eventData = {
        organizationId: 'org-integration-test',
        userId: 'user-123',
        platform: 'twitter',
        accountRef: '@testorg',
        externalCommentId: 'tweet-456',
        externalAuthorId: 'author-789',
        externalAuthorUsername: 'toxicuser',
        originalText: 'This is a very offensive comment that violates our policies',
        toxicityScore: 0.92,
        toxicityLabels: ['TOXICITY', 'INSULT'],
        actionTaken: 'hide_comment',
        actionReason: 'High toxicity detected by Shield system',
        actionStatus: 'executed',
        processedBy: 'shield_integration_test',
        processingTimeMs: 150
      };

      // Mock successful event recording
      mockSupabase.from().single.mockResolvedValueOnce({
        data: { 
          id: 'event-integration-123',
          ...eventData,
          created_at: new Date().toISOString()
        },
        error: null
      });

      const recordedEvent = await persistenceService.recordShieldEvent(eventData);

      expect(recordedEvent.id).toBe('event-integration-123');
      expect(mockSupabase.from).toHaveBeenCalledWith('shield_events');
      expect(mockLogger.info).toHaveBeenCalledWith('Shield event recorded', 
        expect.objectContaining({
          eventId: 'event-integration-123',
          platform: 'twitter',
          actionTaken: 'hide_comment',
          externalAuthorId: 'author-789',
          hasOriginalText: true
        })
      );
    });

    test('should integrate with Decision Engine for complete workflow', async () => {
      const decisionInput = {
        organizationId: 'org-integration-test',
        userId: 'user-123',
        platform: 'discord',
        accountRef: 'TestServer#general',
        externalCommentId: 'message-789',
        externalAuthorId: 'discord-user-456',
        externalAuthorUsername: 'problematicuser',
        originalText: 'You are all idiots and this server sucks',
        toxicityAnalysis: {
          toxicity_score: 0.87,
          toxicity_labels: ['TOXICITY', 'INSULT'],
          confidence: 0.94,
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

      // Mock offender history (first-time offender)
      persistenceService.getOffenderHistory = jest.fn().mockResolvedValue({
        profile: null,
        events: [],
        isRecidivist: false,
        riskLevel: 'low',
        totalOffenses: 0,
        averageToxicity: 0,
        escalationLevel: 0
      });

      // Mock event recording
      persistenceService.recordShieldEvent = jest.fn().mockResolvedValue({
        id: 'event-decision-integration-456'
      });

      const decision = await decisionEngine.makeDecision(decisionInput);

      expect(decision.action).toBe('roastable_comment'); // Score 0.87 should be roastable
      expect(decision.severity).toBe('moderate');
      expect(decision.autoExecute).toBe(true);
      expect(persistenceService.recordShieldEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-integration-test',
          platform: 'discord',
          externalAuthorId: 'discord-user-456',
          actionTaken: 'roastable_comment'
        })
      );
    });
  });

  describe('GDPR Retention Integration', () => {
    test('should handle anonymization workflow with real data flow', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 85); // 85 days ago

      const mockOldEvents = [
        {
          id: 'old-event-1',
          original_text: 'This is sensitive content that needs anonymization',
          created_at: oldDate.toISOString()
        },
        {
          id: 'old-event-2', 
          original_text: 'Another comment with personal information',
          created_at: oldDate.toISOString()
        }
      ];

      // Mock finding records to anonymize
      mockSupabase.from().single.mockResolvedValueOnce({
        data: mockOldEvents,
        error: null
      });

      // Mock successful updates
      mockSupabase.from().update.mockImplementation(() => ({
        eq: jest.fn().mockResolvedValue({ error: null })
      }));

      // Mock logging
      mockSupabase.from().insert.mockResolvedValue({ error: null });

      const result = await persistenceService.anonymizeShieldEvents();

      expect(result.processed).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockSupabase.from).toHaveBeenCalledWith('shield_events');
      expect(mockLogger.info).toHaveBeenCalledWith('Shield events anonymization completed', result);
    });

    test('should handle purge workflow after anonymization period', async () => {
      const veryOldDate = new Date();
      veryOldDate.setDate(veryOldDate.getDate() - 95); // 95 days ago

      // Mock successful purge
      mockSupabase.from().delete.mockResolvedValue({
        count: 7,
        error: null
      });

      // Mock logging
      mockSupabase.from().insert.mockResolvedValue({ error: null });

      const result = await persistenceService.purgeOldShieldEvents();

      expect(result.purged).toBe(7);
      expect(mockSupabase.from).toHaveBeenCalledWith('shield_events');
      expect(mockLogger.info).toHaveBeenCalledWith('Shield events purge completed', { purgedCount: 7 });
    });

    test('should maintain audit trail through retention operations', async () => {
      const operations = ['anonymize', 'purge', 'cleanup'];
      
      for (const operation of operations) {
        mockSupabase.from().insert.mockResolvedValue({ error: null });

        await persistenceService.logRetentionOperation(operation, 'success', {
          recordsProcessed: 10,
          recordsAnonymized: operation === 'anonymize' ? 10 : 0,
          recordsPurged: operation === 'purge' ? 10 : 0
        });

        expect(mockSupabase.from).toHaveBeenCalledWith('shield_retention_log');
      }

      // Should have logged 3 operations
      expect(mockSupabase.from().insert).toHaveBeenCalledTimes(3);
    });
  });

  describe('Offender History Integration', () => {
    test('should track repeat offender progression through multiple events', async () => {
      const offenderData = {
        organizationId: 'org-repeat-test',
        platform: 'youtube',
        externalAuthorId: 'repeat-offender-123'
      };

      // Mock progression: first offense -> repeat offender -> high risk
      const offenseProgression = [
        { // First offense
          profile: null,
          events: [],
          isRecidivist: false,
          totalOffenses: 0,
          escalationLevel: 0
        },
        { // Second offense
          profile: { offense_count: 1, severity_level: 'low' },
          events: [{ action_taken: 'warn_user' }],
          isRecidivist: true,
          totalOffenses: 2,
          escalationLevel: 1
        },
        { // Third offense
          profile: { offense_count: 2, severity_level: 'medium' },
          events: [
            { action_taken: 'warn_user' },
            { action_taken: 'hide_comment' }
          ],
          isRecidivist: true,
          totalOffenses: 3,
          escalationLevel: 2
        }
      ];

      for (let i = 0; i < offenseProgression.length; i++) {
        mockSupabase.from().single.mockResolvedValueOnce({
          data: offenseProgression[i].profile,
          error: i === 0 ? { code: 'PGRST116' } : null // Not found for first
        });

        mockSupabase.from().single.mockResolvedValueOnce({
          data: offenseProgression[i].events,
          error: null
        });

        const history = await persistenceService.getOffenderHistory(
          offenderData.organizationId,
          offenderData.platform,
          offenderData.externalAuthorId
        );

        expect(history.isRecidivist).toBe(offenseProgression[i].isRecidivist);
        expect(history.totalOffenses).toBe(offenseProgression[i].totalOffenses);
        expect(history.escalationLevel).toBe(offenseProgression[i].escalationLevel);
      }
    });
  });

  describe('Search and Statistics Integration', () => {
    test('should provide comprehensive platform statistics', async () => {
      const statsData = {
        events: [
          { action_taken: 'hide_comment', action_status: 'executed', toxicity_score: 0.85 },
          { action_taken: 'warn_user', action_status: 'executed', toxicity_score: 0.72 },
          { action_taken: 'block_user', action_status: 'failed', toxicity_score: 0.93 }
        ],
        topOffenders: [
          { external_author_id: 'user1', offense_count: 5, severity_level: 'high' },
          { external_author_id: 'user2', offense_count: 3, severity_level: 'medium' }
        ]
      };

      mockSupabase.from().single.mockResolvedValueOnce({
        data: statsData.events,
        error: null
      });

      mockSupabase.from().single.mockResolvedValueOnce({
        data: statsData.topOffenders,
        error: null
      });

      const stats = await persistenceService.getPlatformOffenderStats(
        'org-stats-test',
        'twitter',
        30
      );

      expect(stats.platform).toBe('twitter');
      expect(stats.windowDays).toBe(30);
      expect(stats.totalEvents).toBe(3);
      expect(stats.actionsSummary.executed).toBe(2);
      expect(stats.actionsSummary.failed).toBe(1);
      expect(stats.topOffenders).toHaveLength(2);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle cascading failures gracefully', async () => {
      // Simulate database connection failure
      mockSupabase.from().single.mockRejectedValue(new Error('Connection timeout'));

      // Should handle the error without crashing
      await expect(persistenceService.getOffenderHistory('org', 'platform', 'user'))
        .rejects.toThrow('Connection timeout');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get offender history',
        expect.objectContaining({
          error: 'Connection timeout'
        })
      );
    });

    test('should maintain system stability during partial failures', async () => {
      const batchData = [
        { id: 'event-1', original_text: 'Comment 1' },
        { id: 'event-2', original_text: 'Comment 2' },
        { id: 'event-3', original_text: 'Comment 3' }
      ];

      mockSupabase.from().single.mockResolvedValueOnce({
        data: batchData,
        error: null
      });

      // Simulate partial failures in batch processing
      mockSupabase.from().update
        .mockImplementationOnce(() => ({
          eq: jest.fn().mockResolvedValue({ error: null })
        }))
        .mockImplementationOnce(() => ({
          eq: jest.fn().mockResolvedValue({ error: { message: 'Lock timeout' } })
        }))
        .mockImplementationOnce(() => ({
          eq: jest.fn().mockResolvedValue({ error: null })
        }));

      mockSupabase.from().insert.mockResolvedValue({ error: null });

      const result = await persistenceService.anonymizeShieldEvents();

      expect(result.processed).toBe(2); // 2 succeeded, 1 failed
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].id).toBe('event-2');
      expect(result.errors[0].error).toBe('Lock timeout');
    });
  });
});