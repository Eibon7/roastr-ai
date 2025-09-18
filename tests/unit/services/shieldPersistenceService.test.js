/**
 * Unit Tests for Shield Persistence Service
 * 
 * Tests shield event recording, offender tracking, and recidivism analysis
 * with proper GDPR compliance and data retention handling.
 */

const ShieldPersistenceService = require('../../../src/services/shieldPersistenceService');

// Mock Supabase
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

// Helper to reset the mock chain
const resetSupabaseChain = () => {
  Object.keys(mockSupabase).forEach(key => {
    if (typeof mockSupabase[key] === 'function' && key !== 'single' && key !== 'rpc') {
      mockSupabase[key].mockReturnThis();
    }
  });
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

describe('ShieldPersistenceService', () => {
  let service;
  let mockEventData;
  let mockOrganizationId;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    resetSupabaseChain();
    
    // Create service with mocked dependencies
    service = new ShieldPersistenceService({
      supabase: mockSupabase,
      logger: mockLogger
    });

    // Mock data
    mockOrganizationId = 'org-123-456';
    mockEventData = {
      organizationId: mockOrganizationId,
      userId: 'user-789',
      platform: 'twitter',
      accountRef: '@testuser',
      externalCommentId: 'tweet_123456789',
      externalAuthorId: 'twitter_user_456',
      externalAuthorUsername: 'toxicuser',
      originalText: 'This is a toxic comment that needs moderation',
      toxicityScore: 0.85,
      toxicityLabels: ['TOXICITY', 'INSULT'],
      actionTaken: 'hide_comment',
      actionReason: 'High toxicity detected by Shield system',
      actionStatus: 'executed',
      processedBy: 'shield_worker',
      processingTimeMs: 250
    };
  });

  describe('recordShieldEvent', () => {
    test('should record a shield event successfully', async () => {
      // Mock what Supabase actually returns (snake_case format)
      const mockInsertedEvent = {
        id: 'event-123',
        organization_id: mockEventData.organizationId,
        user_id: mockEventData.userId,
        platform: mockEventData.platform,
        account_ref: mockEventData.accountRef,
        external_comment_id: mockEventData.externalCommentId,
        external_author_id: mockEventData.externalAuthorId,
        external_author_username: mockEventData.externalAuthorUsername,
        original_text: mockEventData.originalText,
        toxicity_score: mockEventData.toxicityScore,
        toxicity_labels: mockEventData.toxicityLabels,
        action_taken: mockEventData.actionTaken,
        action_reason: mockEventData.actionReason,
        action_status: mockEventData.actionStatus,
        processed_by: mockEventData.processedBy,
        processing_time_ms: mockEventData.processingTimeMs,
        created_at: '2024-01-15T10:00:00Z'
      };

      mockSupabase.single.mockResolvedValue({
        data: mockInsertedEvent,
        error: null
      });

      const result = await service.recordShieldEvent(mockEventData);

      expect(mockSupabase.from).toHaveBeenCalledWith('shield_events');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: mockEventData.organizationId,
          platform: mockEventData.platform,
          external_author_id: mockEventData.externalAuthorId,
          original_text: mockEventData.originalText,
          toxicity_score: mockEventData.toxicityScore,
          action_taken: mockEventData.actionTaken
        })
      );
      expect(result).toEqual(mockInsertedEvent);
      expect(mockLogger.info).toHaveBeenCalledWith('Shield event recorded', {
        eventId: 'event-123',
        platform: 'twitter',
        actionTaken: 'hide_comment',
        externalAuthorId: 'twitter_user_456'
      });
    });

    test('should handle database errors when recording events', async () => {
      const dbError = new Error('Database connection failed');
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: dbError
      });

      await expect(service.recordShieldEvent(mockEventData)).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to record Shield event', {
        organizationId: mockEventData.organizationId,
        platform: mockEventData.platform,
        externalAuthorId: mockEventData.externalAuthorId,
        error: 'Database connection failed'
      });
    });

    test('should record event without original text for non-Shield actions', async () => {
      const eventWithoutText = {
        ...mockEventData,
        originalText: null // No text for non-Shield moderated content
      };

      // Mock what Supabase actually returns (snake_case format)
      const mockInsertedEvent = {
        id: 'event-124',
        organization_id: eventWithoutText.organizationId,
        user_id: eventWithoutText.userId,
        platform: eventWithoutText.platform,
        account_ref: eventWithoutText.accountRef,
        external_comment_id: eventWithoutText.externalCommentId,
        external_author_id: eventWithoutText.externalAuthorId,
        external_author_username: eventWithoutText.externalAuthorUsername,
        original_text: null,
        toxicity_score: eventWithoutText.toxicityScore,
        toxicity_labels: eventWithoutText.toxicityLabels,
        action_taken: eventWithoutText.actionTaken,
        action_reason: eventWithoutText.actionReason,
        action_status: eventWithoutText.actionStatus,
        processed_by: eventWithoutText.processedBy,
        processing_time_ms: eventWithoutText.processingTimeMs,
        created_at: '2024-01-15T10:00:00Z'
      };

      mockSupabase.single.mockResolvedValue({
        data: mockInsertedEvent,
        error: null
      });

      const result = await service.recordShieldEvent(eventWithoutText);

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          original_text: null
        })
      );
      expect(result.original_text).toBeNull();
    });
  });

  describe('updateShieldEventStatus', () => {
    test('should update event status successfully', async () => {
      const eventId = 'event-123';
      const newStatus = 'executed';
      const executedAt = '2024-01-15T10:05:00Z';

      const mockUpdatedEvent = {
        id: eventId,
        action_status: newStatus,
        executed_at: executedAt,
        updated_at: '2024-01-15T10:05:00Z'
      };

      mockSupabase.single.mockResolvedValue({
        data: mockUpdatedEvent,
        error: null
      });

      const result = await service.updateShieldEventStatus(eventId, newStatus, executedAt);

      expect(mockSupabase.from).toHaveBeenCalledWith('shield_events');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          action_status: newStatus,
          executed_at: executedAt
        })
      );
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', eventId);
      expect(result).toEqual(mockUpdatedEvent);
    });

    test('should handle update errors', async () => {
      const eventId = 'event-123';
      const updateError = new Error('Event not found');
      
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: updateError
      });

      await expect(service.updateShieldEventStatus(eventId, 'failed')).rejects.toThrow('Event not found');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to update Shield event status', {
        eventId,
        status: 'failed',
        error: 'Event not found'
      });
    });
  });

  describe('getOffenderHistory', () => {
    test('should retrieve complete offender history', async () => {
      const mockProfile = {
        id: 'profile-123',
        organization_id: mockOrganizationId,
        platform: 'twitter',
        external_author_id: 'twitter_user_456',
        offense_count: 3,
        severity_level: 'high',
        last_offense_at: '2024-01-15T10:00:00Z',
        avg_toxicity_score: 0.78,
        max_toxicity_score: 0.92,
        escalation_level: 2
      };

      const mockEvents = [
        {
          id: 'event-1',
          external_comment_id: 'comment-1',
          toxicity_score: 0.85,
          action_taken: 'hide_comment',
          action_status: 'executed',
          created_at: '2024-01-15T09:00:00Z'
        },
        {
          id: 'event-2',
          external_comment_id: 'comment-2',
          toxicity_score: 0.92,
          action_taken: 'timeout_user',
          action_status: 'executed',
          created_at: '2024-01-14T15:30:00Z'
        }
      ];

      // Mock profile query
      mockSupabase.single.mockResolvedValueOnce({
        data: mockProfile,
        error: null
      });

      // Mock events query
      mockSupabase.limit.mockResolvedValueOnce({
        data: mockEvents,
        error: null
      });

      const history = await service.getOffenderHistory(
        mockOrganizationId,
        'twitter',
        'twitter_user_456'
      );

      expect(history.profile).toEqual(mockProfile);
      expect(history.events).toEqual(mockEvents);
      expect(history.isRecidivist).toBe(true);
      expect(history.riskLevel).toBe('high');
      expect(history.totalOffenses).toBe(3);
      expect(history.escalationLevel).toBe(2);
      expect(typeof history.recentActionsSummary).toBe('object');
    });

    test('should handle new offender with no history', async () => {
      // Mock profile not found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' } // Not found
      });

      // Mock no events
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const history = await service.getOffenderHistory(
        mockOrganizationId,
        'twitter',
        'new_user_123'
      );

      expect(history.profile).toBeNull();
      expect(history.events).toEqual([]);
      expect(history.isRecidivist).toBe(false);
      expect(history.riskLevel).toBe('low');
      expect(history.totalOffenses).toBe(0);
      expect(history.escalationLevel).toBe(0);
    });

    test('should respect custom window days', async () => {
      const customWindowDays = 30;
      
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }
      });

      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      await service.getOffenderHistory(
        mockOrganizationId,
        'twitter',
        'user_123',
        customWindowDays
      );

      // Verify that the cutoff date was calculated with custom window
      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - customWindowDays);
      
      expect(mockSupabase.gte).toHaveBeenCalledWith(
        'last_offense_at',
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      );
    });
  });

  describe('isRepeatOffender', () => {
    test('should identify repeat offender correctly', async () => {
      // Override the chain for this specific test
      // biome-ignore lint/suspicious/noThenProperty: Mock object for testing
      mockSupabase.select.mockReturnValueOnce({
        count: 3,
        error: null
      });

      const result = await service.isRepeatOffender(
        mockOrganizationId,
        'twitter',
        'twitter_user_456',
        30
      );

      expect(result.isRepeat).toBe(true);
      expect(result.offenseCount).toBe(3);
      expect(result.thresholdDays).toBe(30);
      expect(mockSupabase.eq).toHaveBeenCalledWith('action_status', 'executed');
    });

    test('should identify non-repeat offender', async () => {
      mockSupabase.select.mockResolvedValue({
        count: 1,
        error: null
      });

      const result = await service.isRepeatOffender(
        mockOrganizationId,
        'twitter',
        'new_user_123'
      );

      expect(result.isRepeat).toBe(false);
      expect(result.offenseCount).toBe(1);
    });

    test('should handle database errors in repeat offender check', async () => {
      const dbError = new Error('Query failed');
      mockSupabase.select.mockResolvedValue({
        count: null,
        error: dbError
      });

      const result = await service.isRepeatOffender(
        mockOrganizationId,
        'twitter',
        'user_123'
      );

      expect(result.isRepeat).toBe(false);
      expect(result.offenseCount).toBe(0);
      expect(result.error).toBe('Query failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getPlatformOffenderStats', () => {
    test('should return comprehensive platform statistics', async () => {
      const mockEvents = [
        {
          action_taken: 'hide_comment',
          action_status: 'executed',
          toxicity_score: 0.8,
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          action_taken: 'timeout_user',
          action_status: 'executed',
          toxicity_score: 0.9,
          created_at: '2024-01-15T09:00:00Z'
        },
        {
          action_taken: 'hide_comment',
          action_status: 'failed',
          toxicity_score: 0.7,
          created_at: '2024-01-14T15:00:00Z'
        }
      ];

      const mockTopOffenders = [
        {
          external_author_id: 'user1',
          external_author_username: 'toxicuser1',
          offense_count: 5,
          severity_level: 'high',
          last_offense_at: '2024-01-15T10:00:00Z'
        },
        {
          external_author_id: 'user2',
          external_author_username: 'toxicuser2',
          offense_count: 3,
          severity_level: 'medium',
          last_offense_at: '2024-01-14T14:00:00Z'
        }
      ];

      // Mock events query
      mockSupabase.select.mockResolvedValueOnce({
        data: mockEvents,
        error: null
      });

      // Mock top offenders query
      mockSupabase.select.mockResolvedValueOnce({
        data: mockTopOffenders,
        error: null
      });

      const stats = await service.getPlatformOffenderStats(mockOrganizationId, 'twitter', 30);

      expect(stats.platform).toBe('twitter');
      expect(stats.windowDays).toBe(30);
      expect(stats.totalEvents).toBe(3);
      expect(stats.topOffenders).toEqual(mockTopOffenders);
      expect(stats.actionsSummary.executed).toBe(2);
      expect(stats.actionsSummary.failed).toBe(1);
      expect(stats.averageToxicity).toBeCloseTo(0.8, 2);
      expect(stats.severityDistribution.high).toBe(1);
      expect(stats.severityDistribution.medium).toBe(1);
    });
  });

  describe('searchShieldEvents', () => {
    test('should search events with all filters', async () => {
      const mockSearchResults = [
        {
          id: 'event-1',
          platform: 'twitter',
          external_comment_id: 'comment-1',
          toxicity_score: 0.85,
          action_taken: 'hide_comment',
          created_at: '2024-01-15T10:00:00Z'
        }
      ];

      mockSupabase.range.mockResolvedValue({
        data: mockSearchResults,
        error: null,
        count: 1
      });

      const searchParams = {
        organizationId: mockOrganizationId,
        platform: 'twitter',
        externalAuthorId: 'user_123',
        actionTaken: 'hide_comment',
        actionStatus: 'executed',
        minToxicityScore: 0.7,
        dateFrom: '2024-01-01T00:00:00Z',
        dateTo: '2024-01-31T23:59:59Z',
        limit: 50,
        offset: 0
      };

      const result = await service.searchShieldEvents(searchParams);

      expect(result.events).toEqual(mockSearchResults);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
      
      // Verify all filters were applied
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', mockOrganizationId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('platform', 'twitter');
      expect(mockSupabase.eq).toHaveBeenCalledWith('external_author_id', 'user_123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('action_taken', 'hide_comment');
      expect(mockSupabase.eq).toHaveBeenCalledWith('action_status', 'executed');
      expect(mockSupabase.gte).toHaveBeenCalledWith('toxicity_score', 0.7);
      expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', '2024-01-01T00:00:00Z');
      expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', '2024-01-31T23:59:59Z');
    });

    test('should search with minimal filters', async () => {
      const mockSearchResults = [];

      mockSupabase.range.mockResolvedValue({
        data: mockSearchResults,
        error: null,
        count: 0
      });

      const result = await service.searchShieldEvents({
        organizationId: mockOrganizationId
      });

      expect(result.events).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', mockOrganizationId);
      // Other filters should not be applied
      expect(mockSupabase.eq).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRetentionStats', () => {
    test('should return comprehensive retention statistics', async () => {
      const now = new Date();
      const mockRetentionData = [
        {
          created_at: new Date(now.getTime() - 85 * 24 * 60 * 60 * 1000).toISOString(), // 85 days old
          anonymized_at: null,
          original_text: 'old text',
          original_text_hash: null
        },
        {
          created_at: new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000).toISOString(), // 75 days old
          anonymized_at: new Date().toISOString(),
          original_text: null,
          original_text_hash: 'hash123'
        },
        {
          created_at: new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000).toISOString(), // 95 days old
          anonymized_at: null,
          original_text: 'very old text',
          original_text_hash: null
        }
      ];

      const mockRecentLogs = [
        {
          id: 'log-1',
          operation_type: 'anonymize',
          operation_status: 'success',
          records_processed: 100,
          started_at: '2024-01-15T02:00:00Z'
        }
      ];

      // Mock retention data query
      mockSupabase.select.mockResolvedValueOnce({
        data: mockRetentionData,
        error: null
      });

      // Mock retention logs query
      mockSupabase.select.mockResolvedValueOnce({
        data: mockRecentLogs,
        error: null
      });

      const stats = await service.getRetentionStats();

      expect(stats.total).toBe(3);
      expect(stats.needingAnonymization).toBe(1); // 85 days old, not anonymized
      expect(stats.anonymized).toBe(1); // 75 days old, already anonymized
      expect(stats.needingPurge).toBe(1); // 95 days old
      expect(stats.withinRetention).toBe(0);
      expect(stats.recentOperations).toEqual(mockRecentLogs);
    });
  });

  describe('helper methods', () => {
    test('summarizeRecentActions should count executed actions', () => {
      const events = [
        { action_taken: 'hide_comment', action_status: 'executed' },
        { action_taken: 'hide_comment', action_status: 'executed' },
        { action_taken: 'timeout_user', action_status: 'executed' },
        { action_taken: 'block_user', action_status: 'failed' } // Should not be counted
      ];

      const summary = service.summarizeRecentActions(events);

      expect(summary.hide_comment).toBe(2);
      expect(summary.timeout_user).toBe(1);
      expect(summary.block_user).toBeUndefined();
    });

    test('calculateAverageToxicity should handle null values', () => {
      const events = [
        { toxicity_score: 0.8 },
        { toxicity_score: 0.6 },
        { toxicity_score: null },
        { toxicity_score: 0.9 }
      ];

      const average = service.calculateAverageToxicity(events);

      expect(average).toBeCloseTo(0.767, 2); // (0.8 + 0.6 + 0.9) / 3
    });

    test('calculateSeverityDistribution should count severity levels', () => {
      const offenders = [
        { severity_level: 'high' },
        { severity_level: 'medium' },
        { severity_level: 'high' },
        { severity_level: 'low' },
        { severity_level: 'critical' }
      ];

      const distribution = service.calculateSeverityDistribution(offenders);

      expect(distribution.high).toBe(2);
      expect(distribution.medium).toBe(1);
      expect(distribution.low).toBe(1);
      expect(distribution.critical).toBe(1);
    });
  });
});