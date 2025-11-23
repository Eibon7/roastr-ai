/**
 * Unit Tests for Shield Persistence Service - GDPR Retention Features
 *
 * Tests anonymization, purging, and retention logging functionality
 * for GDPR compliance in the Shield system.
 */

const ShieldPersistenceService = require('../../../src/services/shieldPersistenceService');
const crypto = require('crypto');

// Create a sophisticated Supabase mock with response queue system
const createQueryBuilderMock = () => {
  let responseQueue = [];

  const mock = {
    // Query builder methods (chainable)
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),

    // Response queue management
    __queueResponse: function (result) {
      responseQueue.push(result);
      return this;
    },
    __setResult: function (result) {
      this.__result = result;
      return this;
    },
    __clearQueue: function () {
      responseQueue = [];
      return this;
    },

    // Promise implementation for terminal operations
    then: jest.fn().mockImplementation(function (resolve, reject) {
      try {
        // Use queued response if available, otherwise fallback to __result
        const result =
          responseQueue.length > 0
            ? responseQueue.shift()
            : this.__result || { data: null, error: null, count: 0 };

        if (resolve) {
          return Promise.resolve(resolve(result));
        }
        return Promise.resolve(result);
      } catch (error) {
        if (reject) {
          return Promise.reject(reject(error));
        }
        return Promise.reject(error);
      }
    }),

    // Promise-like methods
    catch: jest.fn().mockImplementation(function (onRejected) {
      return this.then(null, onRejected);
    }),
    finally: jest.fn().mockImplementation(function (onFinally) {
      return this.then(
        (value) => {
          onFinally();
          return value;
        },
        (reason) => {
          onFinally();
          throw reason;
        }
      );
    })
  };

  return mock;
};

const mockSupabase = createQueryBuilderMock();

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

describe('ShieldPersistenceService - GDPR Retention', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock environment variables
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    process.env.SHIELD_ANONYMIZATION_SECRET = 'test-secret-for-hmac';

    // Reset the mockSupabase to fresh state
    Object.assign(mockSupabase, createQueryBuilderMock());

    service = new ShieldPersistenceService({
      supabase: mockSupabase,
      logger: mockLogger
    });
  });

  afterEach(() => {
    delete process.env.SHIELD_ANONYMIZATION_SECRET;
  });

  describe('generateTextHash', () => {
    test('should generate consistent HMAC hash for same input', () => {
      const originalText = 'This is a test comment';

      // Mock crypto.randomBytes to return consistent salt for testing
      const mockSalt = 'abcd1234567890ef';
      jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from(mockSalt, 'hex'));

      const result1 = service.generateTextHash(originalText);
      const result2 = service.generateTextHash(originalText);

      expect(result1.salt).toBe(mockSalt);
      expect(result2.salt).toBe(mockSalt);
      expect(result1.hash).toBe(result2.hash);
      expect(result1.hash).toHaveLength(64); // SHA-256 hex length

      crypto.randomBytes.mockRestore();
    });

    test('should return null hash for invalid input', () => {
      expect(service.generateTextHash(null)).toEqual({ hash: null, salt: null });
      expect(service.generateTextHash('')).toEqual({ hash: null, salt: null });
      expect(service.generateTextHash(123)).toEqual({ hash: null, salt: null });
    });

    test('should use default secret when environment variable is missing', () => {
      delete process.env.SHIELD_ANONYMIZATION_SECRET;

      const result = service.generateTextHash('test');
      expect(result.hash).toBeDefined();
      expect(result.salt).toBeDefined();
    });

    test('should generate different hashes for different inputs', () => {
      const result1 = service.generateTextHash('Comment 1');
      const result2 = service.generateTextHash('Comment 2');

      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.salt).not.toBe(result2.salt);
    });
  });

  describe('anonymizeShieldEvents', () => {
    test('should anonymize records older than 80 days', async () => {
      const mockRecords = [
        { id: 'event-1', original_text: 'Test comment 1' },
        { id: 'event-2', original_text: 'Test comment 2' }
      ];

      // Set up the mock to return the records when the query chain is executed
      mockSupabase.__setResult({
        data: mockRecords,
        error: null
      });

      mockSupabase.update.mockImplementation(() => ({
        eq: jest.fn().mockReturnValue({
          error: null
        })
      }));

      mockSupabase.insert.mockResolvedValue({ error: null });

      const result = await service.anonymizeShieldEvents(100);

      expect(result.processed).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockSupabase.select).toHaveBeenCalledWith('id, original_text');
      expect(mockSupabase.is).toHaveBeenCalledWith('anonymized_at', null);
      expect(mockSupabase.not).toHaveBeenCalledWith('original_text', 'is', null);
      expect(mockSupabase.lte).toHaveBeenCalled();
      expect(mockSupabase.limit).toHaveBeenCalledWith(100);
    });

    test('should handle no records to anonymize', async () => {
      // Set up the mock to return empty array when no records need anonymization
      mockSupabase.__setResult({
        data: [],
        error: null
      });

      const result = await service.anonymizeShieldEvents();

      expect(result.processed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith('No Shield events require anonymization');
    });

    test('should handle database errors gracefully', async () => {
      mockSupabase.__setResult({
        data: null,
        error: { message: 'Database connection failed' }
      });

      mockSupabase.insert.mockResolvedValue({ error: null });

      await expect(service.anonymizeShieldEvents()).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Shield events anonymization failed', {
        error: 'Database connection failed'
      });
    });

    test('should handle partial failures in batch processing', async () => {
      const mockRecords = [
        { id: 'event-1', original_text: 'Test comment 1' },
        { id: 'event-2', original_text: 'Test comment 2' }
      ];

      // Set up the mock to return records for partial failure test
      mockSupabase.__setResult({
        data: mockRecords,
        error: null
      });

      // First update succeeds, second fails
      mockSupabase.update
        .mockImplementationOnce(() => ({
          eq: jest.fn().mockReturnValue({ error: null })
        }))
        .mockImplementationOnce(() => ({
          eq: jest.fn().mockReturnValue({ error: { message: 'Update failed' } })
        }));

      mockSupabase.insert.mockResolvedValue({ error: null });

      const result = await service.anonymizeShieldEvents();

      expect(result.processed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        id: 'event-2',
        error: 'Update failed'
      });
    });

    test('should use correct cutoff date for 80-day retention', async () => {
      const mockDate = '2023-12-01T09:00:00.000Z';
      const originalDate = Date;

      jest.useFakeTimers();
      jest.setSystemTime(new Date(mockDate));

      // Set up the mock to return empty array for cutoff date test
      mockSupabase.__setResult({
        data: [],
        error: null
      });

      await service.anonymizeShieldEvents();

      // Calculate the expected cutoff date using real Date math
      const testDate = new originalDate(mockDate);
      testDate.setDate(testDate.getDate() - 80);
      const expectedCutoff = testDate.toISOString();

      expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', expectedCutoff);

      jest.useRealTimers();
    });
  });

  describe('purgeOldShieldEvents', () => {
    test('should purge records older than 90 days', async () => {
      // Set up delete to return this when chained with lte
      const deleteResult = { count: 5, error: null };
      mockSupabase.delete.mockImplementation(() => ({
        lte: jest.fn().mockResolvedValue(deleteResult)
      }));

      mockSupabase.insert.mockResolvedValue({ error: null });

      const result = await service.purgeOldShieldEvents();

      expect(result.purged).toBe(5);
      expect(mockSupabase.delete).toHaveBeenCalledWith({ count: 'exact' });
      expect(mockLogger.info).toHaveBeenCalledWith('Shield events purge completed', {
        purgedCount: 5
      });
    });

    test('should handle no records to purge', async () => {
      const deleteResult = { count: 0, error: null };
      mockSupabase.delete.mockImplementation(() => ({
        lte: jest.fn().mockResolvedValue(deleteResult)
      }));

      mockSupabase.insert.mockResolvedValue({ error: null });

      const result = await service.purgeOldShieldEvents();

      expect(result.purged).toBe(0);
    });

    test('should handle purge errors', async () => {
      const errorObj = { message: 'Purge operation failed' };
      const deleteResult = { count: null, error: errorObj };
      mockSupabase.delete.mockImplementation(() => ({
        lte: jest.fn().mockResolvedValue(deleteResult)
      }));

      mockSupabase.insert.mockResolvedValue({ error: null });

      await expect(service.purgeOldShieldEvents()).rejects.toMatchObject(errorObj);
      expect(mockLogger.error).toHaveBeenCalledWith('Shield events purge failed', {
        error: 'Purge operation failed'
      });
    });

    test('should use correct cutoff date for 90-day retention', async () => {
      const mockDate = '2023-12-01T09:00:00.000Z';
      const originalDate = Date;

      jest.useFakeTimers();
      jest.setSystemTime(new Date(mockDate));

      const lteMock = jest.fn().mockResolvedValue({ count: 0, error: null });
      mockSupabase.delete.mockImplementation(() => ({ lte: lteMock }));

      mockSupabase.insert.mockResolvedValue({ error: null });

      await service.purgeOldShieldEvents();

      // Calculate the expected cutoff date using real Date math
      const testDate = new originalDate(mockDate);
      testDate.setDate(testDate.getDate() - 90);
      const expectedCutoff = testDate.toISOString();

      expect(lteMock).toHaveBeenCalledWith('created_at', expectedCutoff);

      jest.useRealTimers();
    });
  });

  describe('logRetentionOperation', () => {
    test('should log successful retention operation', async () => {
      mockSupabase.insert.mockResolvedValue({ error: null });

      const metadata = {
        recordsProcessed: 10,
        recordsAnonymized: 8,
        recordsFailed: 2,
        cutoffDate: '2023-10-01T00:00:00.000Z'
      };

      await service.logRetentionOperation('anonymize', 'success', metadata);

      expect(mockSupabase.from).toHaveBeenCalledWith('shield_retention_log');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        operation_type: 'anonymize',
        operation_status: 'success',
        records_processed: 10,
        records_anonymized: 8,
        records_purged: 0,
        records_failed: 2,
        completed_at: expect.any(String),
        metadata: expect.objectContaining({
          recordsProcessed: 10,
          recordsAnonymized: 8,
          recordsFailed: 2,
          cutoffDate: '2023-10-01T00:00:00.000Z',
          timestamp: expect.any(String)
        })
      });
    });

    test('should handle logging errors gracefully', async () => {
      mockSupabase.insert.mockResolvedValue({
        error: { message: 'Logging failed' }
      });

      await service.logRetentionOperation('purge', 'failed', {});

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to log retention operation', {
        operationType: 'purge',
        status: 'failed',
        error: 'Logging failed'
      });
    });

    test('should handle exception in logging', async () => {
      mockSupabase.insert.mockRejectedValue(new Error('Network error'));

      await service.logRetentionOperation('cleanup', 'partial', {});

      expect(mockLogger.error).toHaveBeenCalledWith('Error logging retention operation', {
        operationType: 'cleanup',
        status: 'partial',
        error: 'Network error'
      });
    });

    test('should use default values for missing metadata', async () => {
      mockSupabase.insert.mockResolvedValue({ error: null });

      await service.logRetentionOperation('anonymize', 'success');

      expect(mockSupabase.insert).toHaveBeenCalledWith({
        operation_type: 'anonymize',
        operation_status: 'success',
        records_processed: 0,
        records_anonymized: 0,
        records_purged: 0,
        records_failed: 0,
        completed_at: expect.any(String),
        metadata: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });
  });

  describe('recordShieldEvent with HMAC', () => {
    test('should generate and store text hash when original text is provided', async () => {
      const mockEventData = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'comment-456',
        externalAuthorId: 'author-789',
        originalText: 'This is a toxic comment',
        toxicityScore: 0.85,
        actionTaken: 'hide_comment',
        actionReason: 'High toxicity detected'
      };

      // Mock the insert().select().single() chain
      const singleMock = jest.fn().mockResolvedValue({
        data: { id: 'event-123', ...mockEventData },
        error: null
      });
      const selectMock = jest.fn().mockReturnValue({ single: singleMock });
      mockSupabase.insert.mockReturnValue({ select: selectMock });

      const result = await service.recordShieldEvent(mockEventData);

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          original_text: 'This is a toxic comment',
          original_text_hash: expect.any(String),
          text_salt: expect.any(String)
        })
      );

      expect(result.id).toBe('event-123');
      expect(mockLogger.info).toHaveBeenCalledWith('Shield event recorded', {
        eventId: 'event-123',
        platform: 'twitter',
        actionTaken: 'hide_comment',
        externalAuthorId: 'author-789',
        hasOriginalText: true
      });
    });

    test('should not generate hash when no original text provided', async () => {
      const mockEventData = {
        organizationId: 'org-123',
        platform: 'discord',
        externalCommentId: 'message-456',
        externalAuthorId: 'user-789',
        originalText: null,
        toxicityScore: 0.65,
        actionTaken: 'warn_user',
        actionReason: 'Moderate toxicity detected'
      };

      // Mock the insert().select().single() chain
      const singleMock = jest.fn().mockResolvedValue({
        data: { id: 'event-456', ...mockEventData },
        error: null
      });
      const selectMock = jest.fn().mockReturnValue({ single: singleMock });
      mockSupabase.insert.mockReturnValue({ select: selectMock });

      await service.recordShieldEvent(mockEventData);

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          original_text: null,
          original_text_hash: null,
          text_salt: null
        })
      );
    });
  });

  describe('Environment validation', () => {
    test('should throw error when required environment variables are missing', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;

      expect(() => {
        new ShieldPersistenceService();
      }).toThrow('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
    });

    test('should pass validation when all required variables are present', () => {
      process.env.SUPABASE_URL = 'http://localhost:54321';
      process.env.SUPABASE_SERVICE_KEY = 'test-key';

      expect(() => {
        new ShieldPersistenceService({
          supabase: mockSupabase,
          logger: mockLogger
        });
      }).not.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    test('should handle full anonymization workflow', async () => {
      // Setup records for anonymization
      const mockRecords = [
        { id: 'event-1', original_text: 'Offensive comment 1' },
        { id: 'event-2', original_text: 'Offensive comment 2' }
      ];

      // Set up the mock to return records for integration test
      mockSupabase.__setResult({
        data: mockRecords,
        error: null
      });

      mockSupabase.update.mockImplementation(() => ({
        eq: jest.fn().mockReturnValue({ error: null })
      }));

      mockSupabase.insert.mockResolvedValue({ error: null });

      const anonymizeResult = await service.anonymizeShieldEvents();

      expect(anonymizeResult.processed).toBe(2);
      expect(anonymizeResult.errors).toHaveLength(0);

      // Verify logging was called twice - once for each anonymized record's update, plus the final operation log
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    test('should handle full purge workflow after anonymization', async () => {
      // First anonymize
      // Set up the mock to return empty array for purge workflow test
      mockSupabase.__setResult({
        data: [],
        error: null
      });

      await service.anonymizeShieldEvents();

      // Then purge - set up delete mock with proper chaining
      const deleteResult = { count: 3, error: null };
      mockSupabase.delete.mockImplementation(() => ({
        lte: jest.fn().mockResolvedValue(deleteResult)
      }));

      mockSupabase.insert.mockResolvedValue({ error: null });

      const purgeResult = await service.purgeOldShieldEvents();

      expect(purgeResult.purged).toBe(3);
    });
  });
});
