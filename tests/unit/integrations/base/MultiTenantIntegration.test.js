/**
 * Multi-Tenant Integration Tests
 *
 * Tests for MultiTenantIntegration class covering multi-tenant operations,
 * comment processing, queue management, rate limiting, and statistics.
 *
 * Issue #933: Coverage improvement - Multi-Tenant Integration (13.8% → 70%+)
 */

const MultiTenantIntegration = require('../../../../src/integrations/base/MultiTenantIntegration');
const { createSupabaseMock } = require('../../../helpers/supabaseMockFactory');

// Mock logger - use factory function
jest.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const { logger } = require('../../../../src/utils/logger');

// Mock QueueService
const mockQueueService = {
  addJob: jest.fn().mockResolvedValue({ id: 'job-123' }),
  initialize: jest.fn().mockResolvedValue(true),
  shutdown: jest.fn().mockResolvedValue(true)
};

jest.mock('../../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => mockQueueService);
});

// Mock CostControlService
const mockCostControl = {
  canPerformOperation: jest.fn().mockResolvedValue({ allowed: true }),
  recordUsage: jest.fn().mockResolvedValue(true)
};

jest.mock('../../../../src/services/costControl', () => {
  return jest.fn().mockImplementation(() => mockCostControl);
});

// Mock Supabase client
const mockSupabase = createSupabaseMock(
  {
    comments: [],
    roasts: []
  },
  {}
);

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

// Create test class that extends MultiTenantIntegration
class TestMultiTenantIntegration extends MultiTenantIntegration {
  constructor(platformName = 'test', options = {}) {
    super(platformName, options);
  }

  async setupPlatformSpecific() {
    // Mock implementation
    return true;
  }

  async fetchComments(params = {}) {
    return {
      comments: [
        {
          id: 'comment-1',
          text: 'Test comment',
          author_id: 'user-1',
          author_name: 'testuser',
          created_at: new Date().toISOString()
        }
      ],
      hasMore: false
    };
  }

  async postResponse(commentId, responseText, options = {}) {
    return { success: true, responseId: 'response-123' };
  }

  async performModerationAction(action, targetId, options = {}) {
    return { success: true, action };
  }

  validateConfiguration() {
    return this.enabled;
  }
}

describe('MultiTenantIntegration', () => {
  let integration;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';
    process.env.ENABLED_TEST = 'true';
  });

  afterEach(async () => {
    if (integration) {
      try {
        await integration.shutdown();
      } catch (error) {
        // Ignore shutdown errors
      }
    }
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      integration = new TestMultiTenantIntegration('test');
      expect(integration.platformName).toBe('test');
      expect(integration.config.maxRetries).toBe(3);
      expect(integration.config.retryDelay).toBe(5000);
      expect(integration.config.rateLimit).toBe(100);
      expect(integration.config.supportDirectPosting).toBe(true);
      expect(integration.config.supportModeration).toBe(true);
    });

    it('should initialize with custom options', () => {
      const options = {
        maxRetries: 5,
        retryDelay: 10000,
        rateLimit: 200,
        supportDirectPosting: false,
        supportModeration: false
      };
      integration = new TestMultiTenantIntegration('test', options);
      expect(integration.config.maxRetries).toBe(5);
      expect(integration.config.retryDelay).toBe(10000);
      expect(integration.config.rateLimit).toBe(200);
      expect(integration.config.supportDirectPosting).toBe(false);
      expect(integration.config.supportModeration).toBe(false);
    });

    it('should initialize connections', () => {
      integration = new TestMultiTenantIntegration('test');
      expect(integration.supabase).toBeDefined();
      expect(integration.queueService).toBeDefined();
      expect(integration.costControl).toBeDefined();
    });

    it('should initialize rate limiting', () => {
      integration = new TestMultiTenantIntegration('test');
      expect(integration.rateLimitTokens).toBe(100);
      expect(integration.rateLimitReset).toBeGreaterThan(Date.now());
    });

    it('should initialize metrics', () => {
      integration = new TestMultiTenantIntegration('test');
      expect(integration.metrics.commentsProcessed).toBe(0);
      expect(integration.metrics.responsesGenerated).toBe(0);
      expect(integration.metrics.responsesPosted).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();

      expect(mockQueueService.initialize).toHaveBeenCalled();
      expect(integration.lastSuccessful).toBeDefined();
    });

    it('should skip initialization if disabled', async () => {
      process.env.ENABLED_TEST = 'false';
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('is disabled'));
    });

    it('should handle initialization errors', async () => {
      integration = new TestMultiTenantIntegration('test');
      integration.setupPlatformSpecific = jest.fn().mockRejectedValue(new Error('Setup failed'));

      await expect(integration.initialize()).rejects.toThrow('Setup failed');
      expect(integration.errorCount).toBeGreaterThan(0);
    });
  });

  describe('processCommentsForOrganization', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should process comments successfully', async () => {
      const result = await integration.processCommentsForOrganization('org-123');

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.queued).toBe(1);
      expect(mockCostControl.canPerformOperation).toHaveBeenCalled();
      expect(mockCostControl.recordUsage).toHaveBeenCalled();
      expect(mockQueueService.addJob).toHaveBeenCalled();
    });

    it('should check cost control before processing', async () => {
      mockCostControl.canPerformOperation.mockResolvedValueOnce({
        allowed: false,
        reason: 'Limit exceeded'
      });

      await expect(integration.processCommentsForOrganization('org-123')).rejects.toThrow(
        'Operation not allowed'
      );
    });

    it('should handle processing errors gracefully', async () => {
      integration.fetchComments = jest.fn().mockRejectedValue(new Error('Fetch failed'));

      await expect(integration.processCommentsForOrganization('org-123')).rejects.toThrow(
        'Fetch failed'
      );
    });

    it('should handle individual comment errors', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('DB error'))
          })
        }),
        insert: jest.fn().mockRejectedValue(new Error('Insert failed'))
      });

      const result = await integration.processCommentsForOrganization('org-123');

      expect(result.success).toBe(true);
      expect(integration.errorCount).toBeGreaterThan(0);
    });
  });

  describe('storeComment', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should store comment successfully', async () => {
      const comment = {
        id: 'comment-123',
        text: 'Test comment',
        author_id: 'user-123',
        author_name: 'testuser',
        created_at: new Date().toISOString()
      };

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'comment-123' },
              error: null
            })
          })
        })
      });

      const result = await integration.storeComment(comment, 'org-123');

      expect(result.stored).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should detect duplicate comments', async () => {
      const comment = {
        id: 'comment-123',
        text: 'Test comment'
      };

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'comment-123' },
                error: null
              })
            })
          })
        })
      });

      const result = await integration.storeComment(comment, 'org-123');

      expect(result.stored).toBe(false);
      expect(result.duplicate).toBe(true);
    });

    it('should handle database errors', async () => {
      const comment = {
        id: 'comment-123',
        text: 'Test comment'
      };

      // First call: select (check for existing comment) - returns no existing comment
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        })
      });

      // Second call: insert (store new comment) - returns error
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' }
            })
          })
        })
      });

      await expect(integration.storeComment(comment, 'org-123')).rejects.toThrow(
        'Failed to store comment'
      );
    });
  });

  describe('queueForAnalysis', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should queue comment for analysis', async () => {
      const comment = {
        id: 'comment-123',
        text: 'Test comment',
        author_id: 'user-123'
      };

      const result = await integration.queueForAnalysis(comment, 'org-123');

      expect(result).toBeDefined();
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'analyze_toxicity',
        expect.objectContaining({
          organization_id: 'org-123',
          comment_id: 'comment-123'
        }),
        3
      );
    });

    it('should handle queue service unavailable', async () => {
      integration.queueService = null;

      await expect(integration.queueForAnalysis({}, 'org-123')).rejects.toThrow(
        'Queue service not available'
      );
    });
  });

  describe('queueResponseGeneration', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should queue response generation', async () => {
      const comment = { id: 'comment-123', text: 'Test' };
      const toxicityData = {
        toxicity_score: 0.9,
        toxicity_categories: ['toxicity'],
        analysis_method: 'perspective'
      };

      const result = await integration.queueResponseGeneration(comment, 'org-123', toxicityData);

      expect(result).toBeDefined();
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'generate_reply',
        expect.objectContaining({
          organization_id: 'org-123',
          comment_id: 'comment-123',
          toxicity_score: 0.9
        }),
        4
      );
    });
  });

  describe('queueResponsePost', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should queue response post when supported', async () => {
      const result = await integration.queueResponsePost('roast-123', 'comment-123', 'org-123');

      expect(result).toBeDefined();
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'post_response',
        expect.objectContaining({
          organization_id: 'org-123',
          roast_id: 'roast-123'
        }),
        4
      );
    });

    it('should return manual review when posting not supported', async () => {
      integration.config.supportDirectPosting = false;

      const result = await integration.queueResponsePost('roast-123', 'comment-123', 'org-123');

      expect(result.success).toBe(true);
      expect(result.manual_review).toBe(true);
      expect(mockQueueService.addJob).not.toHaveBeenCalled();
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should allow request when tokens available', async () => {
      integration.rateLimitTokens = 10;
      await expect(integration.checkRateLimit()).resolves.not.toThrow();
      expect(integration.rateLimitTokens).toBe(9);
    });

    it('should throw error when rate limit exceeded', async () => {
      integration.rateLimitTokens = 0;
      integration.rateLimitReset = Date.now() + 3600000;

      await expect(integration.checkRateLimit()).rejects.toThrow('Rate limit exceeded');
    });

    it('should reset tokens after hour', async () => {
      integration.rateLimitTokens = 0;
      integration.rateLimitReset = Date.now() - 1000; // Past reset time

      await integration.checkRateLimit();

      expect(integration.rateLimitTokens).toBe(99); // 100 - 1
    });
  });

  describe('withRetry', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await integration.withRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('success');

      const result = await integration.withRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      // Mock sleep to avoid real delays
      jest.spyOn(integration, 'sleep').mockResolvedValue();
      const operation = jest.fn().mockRejectedValue(new Error('Failed'));

      await expect(integration.withRetry(operation)).rejects.toThrow('Failed');
      expect(operation).toHaveBeenCalledTimes(3); // maxRetries

      // Restore sleep
      integration.sleep.mockRestore();
    });

    it('should use exponential backoff', async () => {
      // Mock sleep to avoid real delays
      const sleepSpy = jest.spyOn(integration, 'sleep').mockResolvedValue();
      const operation = jest.fn().mockRejectedValue(new Error('Failed'));

      await expect(integration.withRetry(operation)).rejects.toThrow();

      expect(sleepSpy).toHaveBeenCalledWith(5000); // First retry delay (retryDelay * 2^0)
      expect(sleepSpy).toHaveBeenCalledWith(10000); // Second retry delay (retryDelay * 2^1)

      // Restore sleep
      sleepSpy.mockRestore();
    });
  });

  describe('normalizeComment', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should normalize comment with standard fields', () => {
      const rawComment = {
        id: 'comment-123',
        text: 'Test comment',
        author_id: 'user-123',
        author_name: 'testuser',
        created_at: '2024-01-01T00:00:00Z'
      };

      const normalized = integration.normalizeComment(rawComment);

      expect(normalized.id).toBe('comment-123');
      expect(normalized.text).toBe('Test comment');
      expect(normalized.author_id).toBe('user-123');
      expect(normalized.author_name).toBe('testuser');
    });

    it('should handle alternative field names', () => {
      const rawComment = {
        comment_id: 'comment-123',
        content: 'Test comment',
        user_id: 'user-123',
        username: 'testuser',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const normalized = integration.normalizeComment(rawComment);

      expect(normalized.id).toBe('comment-123');
      expect(normalized.text).toBe('Test comment');
      expect(normalized.author_id).toBe('user-123');
      expect(normalized.author_name).toBe('testuser');
    });

    it('should extract metrics from comment', () => {
      const rawComment = {
        id: 'comment-123',
        text: 'Test',
        likes: 10,
        replies: 5,
        shares: 2,
        views: 100
      };

      const normalized = integration.normalizeComment(rawComment);

      expect(normalized.metrics.likes).toBe(10);
      expect(normalized.metrics.replies).toBe(5);
      expect(normalized.metrics.shares).toBe(2);
      expect(normalized.metrics.views).toBe(100);
    });
  });

  describe('getStatistics', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should return statistics for organization', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'comment-1',
                    created_at: new Date().toISOString(),
                    toxicity_score: 0.8,
                    language: 'en'
                  }
                ],
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'roast-1',
                    created_at: new Date().toISOString(),
                    tokens_used: 100,
                    cost_cents: 10,
                    posted_at: new Date().toISOString()
                  }
                ],
                error: null
              })
            })
          })
        })
      });

      const stats = await integration.getStatistics('org-123', 30);

      expect(stats).toBeDefined();
      expect(stats.platform).toBe('test');
      expect(stats.organization_id).toBe('org-123');
      expect(stats.statistics.comments_processed).toBe(1);
      expect(stats.statistics.roasts_generated).toBe(1);
    });

    it('should return null when database unavailable', async () => {
      integration.supabase = null;

      const stats = await integration.getStatistics('org-123');

      expect(stats).toBeNull();
    });
  });

  describe('healthCheck', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should return healthy status', async () => {
      const health = await integration.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.platform).toBe('test');
      expect(health.enabled).toBe(true);
      expect(health.configured).toBe(true);
    });

    it('should return degraded status with high error count', async () => {
      integration.errorCount = 15;

      const health = await integration.healthCheck();

      expect(health.status).toBe('degraded');
    });

    it('should return misconfigured status', async () => {
      integration.enabled = false;

      const health = await integration.healthCheck();

      expect(health.status).toBe('misconfigured');
    });

    it('should return error status with recent errors', async () => {
      integration.lastError = { message: 'Test error', timestamp: Date.now() };
      integration.lastSuccessful = null;

      const health = await integration.healthCheck();

      expect(health.status).toBe('error');
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should shutdown gracefully', async () => {
      await integration.shutdown();

      expect(mockQueueService.shutdown).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('integration shut down complete')
      );
    });
  });

  describe('initialize - validation failure', () => {
    it('should throw error when validateConfiguration returns false', async () => {
      class InvalidIntegration extends MultiTenantIntegration {
        validateConfiguration() {
          return false;
        }
        async setupPlatformSpecific() {}
      }

      const invalidIntegration = new InvalidIntegration('invalid');
      invalidIntegration.enabled = true;

      await expect(invalidIntegration.initialize()).rejects.toThrow(
        'integration is not properly configured'
      );
    });
  });

  describe('abstract methods', () => {
    beforeEach(() => {
      integration = new MultiTenantIntegration('test');
      integration.enabled = true;
    });

    it('should throw error when setupPlatformSpecific is not implemented', async () => {
      await expect(integration.setupPlatformSpecific()).rejects.toThrow(
        'setupPlatformSpecific must be implemented'
      );
    });

    it('should throw error when fetchComments is not implemented', async () => {
      await expect(integration.fetchComments()).rejects.toThrow(
        'fetchComments must be implemented'
      );
    });

    it('should throw error when postResponse is called without supportDirectPosting', async () => {
      integration.config.supportDirectPosting = false;

      await expect(integration.postResponse('comment-id', 'response')).rejects.toThrow(
        'does not support direct posting'
      );
    });

    it('should throw error when postResponse is not implemented but supportDirectPosting is true', async () => {
      integration.config.supportDirectPosting = true;

      await expect(integration.postResponse('comment-id', 'response')).rejects.toThrow(
        'postResponse must be implemented'
      );
    });

    it('should throw error when performModerationAction is called without supportModeration', async () => {
      integration.config.supportModeration = false;

      await expect(integration.performModerationAction('block', 'user-id')).rejects.toThrow(
        'does not support moderation actions'
      );
    });

    it('should throw error when performModerationAction is not implemented but supportModeration is true', async () => {
      integration.config.supportModeration = true;

      await expect(integration.performModerationAction('block', 'user-id')).rejects.toThrow(
        'performModerationAction must be implemented'
      );
    });
  });

  describe('queueResponseGeneration - edge cases', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should handle queue service errors', async () => {
      mockQueueService.addJob.mockRejectedValueOnce(new Error('Queue error'));

      const comment = { id: 'comment-1', text: 'Test', author_id: 'user-1' };
      const toxicityData = {
        toxicity_score: 0.8,
        toxicity_categories: ['toxic'],
        analysis_method: 'ai'
      };

      await expect(
        integration.queueResponseGeneration(comment, 'org-1', toxicityData)
      ).rejects.toThrow('Queue error');
    });
  });

  describe('queueResponsePost - edge cases', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should handle queue service errors when posting', async () => {
      integration.config.supportDirectPosting = true;
      mockQueueService.addJob.mockRejectedValueOnce(new Error('Queue error'));

      await expect(integration.queueResponsePost('roast-1', 'comment-1', 'org-1')).rejects.toThrow(
        'Queue error'
      );
    });
  });

  describe('checkRateLimit - edge cases', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should handle rate limit reset correctly', async () => {
      integration.rateLimitTokens = 0;
      integration.rateLimitReset = Date.now() - 1000; // Reset time in the past

      await integration.checkRateLimit();

      expect(integration.rateLimitTokens).toBe(integration.config.rateLimit - 1);
    });
  });

  describe('withRetry - additional scenarios', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should use custom retries parameter', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('Success');

      jest.spyOn(integration, 'sleep').mockResolvedValue();

      const result = await integration.withRetry(operation, 3);

      expect(result).toBe('Success');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(integration.sleep).toHaveBeenCalledTimes(2);
    });

    it('should handle operation that succeeds after multiple retries', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('Success');

      jest.spyOn(integration, 'sleep').mockResolvedValue();

      const result = await integration.withRetry(operation);

      expect(result).toBe('Success');
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('getStatistics - error handling', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should handle database errors when fetching comments', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
              })
            })
          })
        })
      });

      const stats = await integration.getStatistics('org-1', 30);

      expect(stats).toBeNull();
      // The log method formats the message as JSON, so check for error level in the log calls
      const errorLogCalls = logger.info.mock.calls.filter(
        (call) =>
          call[0] &&
          typeof call[0] === 'string' &&
          call[0].includes('error') &&
          call[0].includes('Failed to get statistics')
      );
      expect(errorLogCalls.length).toBeGreaterThan(0);
    });

    it('should handle database errors when fetching roasts', async () => {
      // Mock successful comments query
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        })
        // Mock failed roasts query
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Roasts query error' }
                })
              })
            })
          })
        });

      const stats = await integration.getStatistics('org-1', 30);

      expect(stats).toBeNull();
    });
  });

  describe('storeComment - edge cases', () => {
    beforeEach(async () => {
      integration = new TestMultiTenantIntegration('test');
      await integration.initialize();
    });

    it('should handle database connection errors', async () => {
      integration.supabase = null;

      await expect(
        integration.storeComment({ id: 'comment-1', text: 'Test' }, 'org-1')
      ).rejects.toThrow('Database not available');
    });
  });
});
