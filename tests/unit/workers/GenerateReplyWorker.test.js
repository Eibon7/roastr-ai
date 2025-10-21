/**
 * Generate Reply Worker Tests
 * 
 * Tests for roast response generation using OpenAI
 */

const GenerateReplyWorker = require('../../../src/workers/GenerateReplyWorker');

// Mock BaseWorker
jest.mock('../../../src/workers/BaseWorker', () => {
  return class MockBaseWorker {
    constructor(workerType, options = {}) {
      this.workerType = workerType;
      this.workerName = `${workerType}-worker-test`;
      this.config = { maxRetries: 3, ...options };
      this.supabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn()
            }))
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn()
            }))
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn()
              }))
            }))
          }))
        }))
      };
      this.queueService = {
        addJob: jest.fn(),
        initialize: jest.fn(),
        shutdown: jest.fn()
      };
      this.redis = null;
      this.log = jest.fn();
      this.start = jest.fn();
      this.stop = jest.fn();
      this.initializeConnections = jest.fn();
      this.setupGracefulShutdown = jest.fn();
    }
  };
});

// Mock Cost Control service
const mockCostControlService = {
  canPerformOperation: jest.fn(),
  recordUsage: jest.fn(),
  initialize: jest.fn()
};

jest.mock('../../../src/services/costControl', () => {
  return jest.fn().mockImplementation(() => mockCostControlService);
});

// Mock OpenAI for use in tests
const mockOpenAIClient = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
};

// Mock mockMode
jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: true,
    generateMockOpenAI: jest.fn(() => mockOpenAIClient),
    generateMockSupabaseClient: jest.fn(() => ({  // Issue #618 - Add missing mock function
      from: jest.fn()
    }))
  }
}));

describe('GenerateReplyWorker', () => {
  let worker;
  let mockSupabase;
  let mockQueueService;

  beforeEach(() => {
    worker = new GenerateReplyWorker();
    mockSupabase = worker.supabase;
    mockQueueService = worker.queueService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Ensure worker is properly stopped to avoid open handles
    if (worker && typeof worker.stop === 'function') {
      await worker.stop();
    }
  });

  describe('constructor', () => {
    test('should initialize worker with correct type', () => {
      expect(worker.workerType).toBe('generate_reply');
      expect(worker.costControl).toBeDefined();
      expect(worker.openaiClient).toBe(mockOpenAIClient);
      expect(worker.templates).toBeDefined();
    });
  });

  describe('processJob', () => {
    beforeEach(() => {
      // Mock successful cost control check
      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      // Mock successful comment retrieval
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'comments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'comment-456',
                    text: 'Your content is trash',
                    integration_config_id: 'config-123'
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'integration_configs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: 'config-123',
                      organization_id: 'org-123',
                      platform: 'twitter',
                      tone: 'sarcastic',
                      humor_type: 'witty',
                      response_frequency: 0.8,
                      config: { auto_post: true }
                    },
                    error: null
                  })
                })
              })
            })
          };
        }
        if (table === 'responses') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'response-789',
                    response_text: 'Generated response'
                  },
                  error: null
                })
              })
            })
          };
        }
      });

      // Mock OpenAI response
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Wow, what an absolutely groundbreaking observation!'
          }
        }],
        usage: {
          total_tokens: 25
        }
      });
    });

    test('should generate roast reply for toxic comment', async () => {
      const job = {
        payload: {
          comment_id: 'comment-456',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Your content is trash',
          toxicity_score: 0.9,
          severity_level: 'high',
          categories: ['TOXICITY', 'INSULT']
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.responseText).toBe('Wow, what an absolutely groundbreaking observation!');
      expect(result.service).toBe('openai');
      expect(mockCostControlService.canPerformOperation).toHaveBeenCalledWith('org-123', 'generate_reply');
      expect(mockCostControlService.recordUsage).toHaveBeenCalled();
    });

    test('should handle cost limit exceeded', async () => {
      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: false,
        reason: 'monthly_limit_exceeded'
      });

      const job = {
        payload: {
          comment_id: 'comment-456',
          organization_id: 'org-limited',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Organization org-limited has reached limits: monthly_limit_exceeded');
    });

    test('should handle low toxicity comments', async () => {
      // Mock Math.random to force frequency check to pass
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.5);

      const job = {
        payload: {
          comment_id: 'comment-clean',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Nice post!',
          toxicity_score: 0.1,
          severity_level: 'low',
          categories: []
        }
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'comments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'comment-clean',
                    text: 'Nice post!',
                    integration_config_id: 'config-123'
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'integration_configs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: 'config-123',
                      organization_id: 'org-123',
                      platform: 'twitter',
                      tone: 'sarcastic',
                      humor_type: 'witty',
                      response_frequency: 0.8,
                      config: { auto_post: true }
                    },
                    error: null
                  })
                })
              })
            })
          };
        }
        if (table === 'responses') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'response-clean',
                    response_text: 'Generated response'
                  },
                  error: null
                })
              })
            })
          };
        }
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      Math.random = originalRandom;
    });

    test('should handle auto-posting for eligible platforms', async () => {
      const job = {
        payload: {
          comment_id: 'comment-456',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Your content is trash',
          toxicity_score: 0.9,
          severity_level: 'high',
          categories: ['TOXICITY']
        }
      };

      worker.queuePostingJob = jest.fn();

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(worker.queuePostingJob).toHaveBeenCalled();
    });
  });

  describe('generateResponse', () => {
    test('should generate response with OpenAI', async () => {
      const originalText = 'This is a terrible comment.';
      const config = {
        tone: 'sarcastic',
        humor_type: 'witty'
      };
      const context = {
        toxicity_score: 0.75,
        severity_level: 'high',
        categories: ['TOXICITY', 'INSULT'],
        platform: 'twitter'
      };

      const mockCompletion = {
        choices: [{
          message: {
            content: 'Wow, what an absolutely groundbreaking observation!'
          }
        }],
        usage: {
          total_tokens: 25
        }
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValue(mockCompletion);

      const result = await worker.generateResponse(originalText, config, context);

      expect(result.text).toBe('Wow, what an absolutely groundbreaking observation!');
      expect(result.service).toBe('openai');
      expect(result.tokensUsed).toBe(25);
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalled();
    });

    test('should fallback to template when OpenAI fails', async () => {
      const originalText = 'Test comment';
      const config = { tone: 'sarcastic', humor_type: 'witty' };
      const context = { platform: 'twitter' };

      mockOpenAIClient.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API error')
      );

      const result = await worker.generateResponse(originalText, config, context);

      expect(result.service).toBe('template');
      expect(result.text).toBeDefined();
      expect(result.templated).toBe(true);
    });
  });

  describe('storeResponse', () => {
    test('should store response in database', async () => {
      const commentId = 'comment-456';
      const organizationId = 'org-123';
      const response = {
        text: 'Generated response',
        tokensUsed: 25
      };
      const config = {
        tone: 'sarcastic',
        humor_type: 'witty'
      };
      const generationTime = 1500;

      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'response-123', response_text: 'Generated response' },
              error: null
            })
          })
        })
      });

      const result = await worker.storeResponse(commentId, organizationId, response, config, generationTime);

      expect(result.id).toBe('response-123');
      expect(mockSupabase.from).toHaveBeenCalledWith('responses');
    });

    test('should handle database storage errors', async () => {
      const commentId = 'comment-456';
      const organizationId = 'org-123';
      const response = { text: 'Test response' };
      const config = { tone: 'sarcastic', humor_type: 'witty' };
      const generationTime = 1000;

      const mockError = new Error('Insert failed');
      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: mockError
            })
          })
        })
      });

      await expect(
        worker.storeResponse(commentId, organizationId, response, config, generationTime)
      ).rejects.toThrow('Insert failed');
    });
  });

  describe('shouldRespondBasedOnFrequency', () => {
    test('should always respond for frequency 1.0', () => {
      expect(worker.shouldRespondBasedOnFrequency(1.0)).toBe(true);
    });

    test('should never respond for frequency 0.0', () => {
      expect(worker.shouldRespondBasedOnFrequency(0.0)).toBe(false);
    });

    test('should sometimes respond for frequency 0.5', () => {
      // Mock Math.random to control the outcome
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.3); // Less than 0.5
      expect(worker.shouldRespondBasedOnFrequency(0.5)).toBe(true);
      
      Math.random = jest.fn(() => 0.7); // Greater than 0.5
      expect(worker.shouldRespondBasedOnFrequency(0.5)).toBe(false);
      
      Math.random = originalRandom;
    });
  });

  describe('validateResponseLength', () => {
    test('should return short text unchanged for Twitter', () => {
      const shortResponse = 'Short response text';
      const result = worker.validateResponseLength(shortResponse, 'twitter');
      expect(result).toBe(shortResponse);
    });

    test('should truncate long text for Twitter', () => {
      const longResponse = 'X'.repeat(300); // Over 270 characters
      const result = worker.validateResponseLength(longResponse, 'twitter');
      expect(result.length).toBeLessThanOrEqual(270);
      expect(result).toMatch(/\.\.\.$|X+$/);
    });

    test('should return medium text unchanged for YouTube', () => {
      const mediumResponse = 'X'.repeat(500);
      const result = worker.validateResponseLength(mediumResponse, 'youtube');
      expect(result).toBe(mediumResponse);
    });

    test('should truncate very long text for YouTube', () => {
      const veryLongResponse = 'X'.repeat(1100); // Over 1000 characters
      const result = worker.validateResponseLength(veryLongResponse, 'youtube');
      expect(result.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getIntegrationConfig', () => {
    test('should fetch integration config successfully', async () => {
      const organizationId = 'org-123';
      const configId = 'config-456';
      
      const mockConfig = {
        id: 'config-456',
        organization_id: 'org-123',
        platform: 'twitter',
        tone: 'sarcastic',
        humor_type: 'witty',
        response_frequency: 0.8
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockConfig,
                error: null
              })
            })
          })
        })
      });

      const result = await worker.getIntegrationConfig(organizationId, configId);

      expect(result.data).toEqual(mockConfig);
      expect(mockSupabase.from).toHaveBeenCalledWith('integration_configs');
    });

    test('should return null when config not found', async () => {
      const organizationId = 'org-123';
      const configId = 'missing-config';

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
              })
            })
          })
        })
      });

      const result = await worker.getIntegrationConfig(organizationId, configId);

      expect(result.data).toBeNull();
    });
  });

  describe('error handling', () => {
    test('should handle malformed job data', async () => {
      const malformedJob = {
        id: 'bad-job'
        // Missing required fields
      };

      const result = await worker.processJob(malformedJob);

      expect(result.success).toBe(false);
      expect(result.type).toBe('VALIDATION_ERROR');
    });

    test('should handle comment not found', async () => {
      const job = {
        id: 'job-missing-comment',
        payload: {
          organization_id: 'org-123',
          comment_id: 'missing-comment',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Comment not found' }
            })
          })
        })
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Comment missing-comment not found');
    });

    test('should handle roast generation failures gracefully', async () => {
      const job = {
        payload: {
          comment_id: 'comment-456',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Test comment',
          toxicity_score: 0.8,
          severity_level: 'high',
          categories: ['TOXICITY']
        }
      };

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'comments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'comment-456',
                    text: 'Test comment',
                    integration_config_id: 'config-missing'
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'integration_configs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Config not found' }
                  })
                })
              })
            })
          };
        }
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Integration config not found for comment comment-456');
    });
  });
});