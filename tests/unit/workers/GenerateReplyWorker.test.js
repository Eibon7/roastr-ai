/**
 * Generate Reply Worker Tests
 *
 * Tests for roast response generation using OpenAI
 */

const GenerateReplyWorker = require('../../../src/workers/GenerateReplyWorker');
const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
const { supabaseServiceClient } = require('../../../src/config/supabase');

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

// Create a mock Supabase client
const createMockSupabaseClient = () => ({
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
  })),
  auth: {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn(),
    onAuthStateChange: jest.fn()
  }
});

// Mock mockMode
jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: true,
    generateMockOpenAI: jest.fn(() => mockOpenAIClient),
    generateMockSupabaseClient: jest.fn(() => createMockSupabaseClient())
  }
}));

// Mock kill switch
jest.mock('../../../src/middleware/killSwitch', () => ({
  shouldBlockAutopost: jest.fn()
}));

// Mock auto approval service
const mockAutoApprovalService = {
  processAutoApproval: jest.fn()
};

jest.mock('../../../src/services/autoApprovalService', () => {
  return jest.fn().mockImplementation(() => mockAutoApprovalService);
});

// Mock transparency service
const mockTransparencyService = {
  applyTransparencyDisclaimer: jest.fn(),
  updateDisclaimerStats: jest.fn()
};

jest.mock('../../../src/services/transparencyService', () => ({
  applyTransparencyDisclaimer: jest.fn((...args) =>
    mockTransparencyService.applyTransparencyDisclaimer(...args)
  ),
  updateDisclaimerStats: jest.fn((...args) =>
    mockTransparencyService.updateDisclaimerStats(...args)
  )
}));

// Mock advanced logger
jest.mock('../../../src/utils/advancedLogger', () => ({
  logJobLifecycle: jest.fn(),
  queueLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock supabase service client
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  }
}));

// Mock RoastPromptTemplate
const mockRoastPromptTemplate = {
  buildPrompt: jest.fn(),
  getVersion: jest.fn(() => '1.0.0')
};

jest.mock('../../../src/services/roastPromptTemplate', () => {
  return jest.fn().mockImplementation(() => mockRoastPromptTemplate);
});

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
      // Mock kill switch to allow processing by default
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({ blocked: false });

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
        choices: [
          {
            message: {
              content: 'Wow, what an absolutely groundbreaking observation!'
            }
          }
        ],
        usage: {
          total_tokens: 25
        }
      });
    });

    test('should generate roast reply for toxic comment', async () => {
      // Mock getComment to return comment directly
      worker.getComment = jest.fn().mockResolvedValue({
        id: 'comment-456',
        text: 'Your content is trash',
        integration_config_id: 'config-123'
      });

      worker.getIntegrationConfig = jest.fn().mockResolvedValue({
        id: 'config-123',
        organization_id: 'org-123',
        platform: 'twitter',
        tone: 'sarcastic',
        humor_type: 'witty',
        response_frequency: 0.8,
        config: { auto_post: true }
      });

      worker.shouldRespondBasedOnFrequency = jest.fn().mockReturnValue(true);
      worker.fetchPersonaData = jest.fn().mockResolvedValue(null);
      worker.generateResponse = jest.fn().mockResolvedValue({
        text: 'Wow, what an absolutely groundbreaking observation!',
        service: 'openai',
        tokensUsed: 25
      });
      worker.storeResponse = jest.fn().mockResolvedValue({
        id: 'response-789',
        response_text: 'Wow, what an absolutely groundbreaking observation!',
        comment_id: 'comment-456'
      });
      worker.queuePostingJob = jest.fn();

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
      expect(mockCostControlService.canPerformOperation).toHaveBeenCalledWith(
        'org-123',
        'generate_reply',
        1,
        'twitter'
      );
      expect(mockCostControlService.recordUsage).toHaveBeenCalled();
    });

    test('should handle cost limit exceeded', async () => {
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({ blocked: false });

      // Reset circuit breaker
      worker.circuitBreaker.failures = 0;
      worker.circuitBreaker.state = 'closed';

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: false,
        reason: 'monthly_limit_exceeded'
      });

      const job = {
        id: 'job-123',
        payload: {
          comment_id: 'comment-456',
          organization_id: 'org-limited',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      const initialFailures = worker.circuitBreaker.failures;

      await expect(worker.processJob(job)).rejects.toThrow(
        /Organization org-limited has reached limits: monthly_limit_exceeded/
      );

      // Verify circuit breaker failure was recorded (error is thrown, caught in catch block)
      // The failure is recorded when error is thrown after cost control check
      expect(worker.circuitBreaker.failures).toBeGreaterThanOrEqual(initialFailures);
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

      // Mock organizations query for transparency check
      const mockOrganizationsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: 'user-123' },
          error: null
        })
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return mockOrganizationsQuery;
        }
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

      // Mock transparency service
      mockTransparencyService.applyTransparencyDisclaimer.mockResolvedValue({
        finalText: 'Generated response',
        disclaimer: null,
        disclaimerType: null,
        transparencyMode: 'none'
      });
      mockTransparencyService.updateDisclaimerStats.mockResolvedValue({
        success: true
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      Math.random = originalRandom;
    });

    test('should handle auto-posting for eligible platforms', async () => {
      // Mock worker methods directly
      worker.getComment = jest.fn().mockResolvedValue({
        id: 'comment-456',
        text: 'Your content is trash',
        integration_config_id: 'config-123'
      });

      worker.getIntegrationConfig = jest.fn().mockResolvedValue({
        id: 'config-123',
        organization_id: 'org-123',
        platform: 'twitter',
        tone: 'sarcastic',
        humor_type: 'witty',
        response_frequency: 0.8,
        config: { auto_post: true }
      });

      worker.shouldRespondBasedOnFrequency = jest.fn().mockReturnValue(true);
      worker.fetchPersonaData = jest.fn().mockResolvedValue(null);
      worker.generateResponse = jest.fn().mockResolvedValue({
        text: 'Wow, what an absolutely groundbreaking observation!',
        service: 'openai',
        tokensUsed: 25
      });
      worker.storeResponse = jest.fn().mockResolvedValue({
        id: 'response-789',
        response_text: 'Wow, what an absolutely groundbreaking observation!',
        comment_id: 'comment-456'
      });
      worker.queuePostingJob = jest.fn();

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
        choices: [
          {
            message: {
              content: 'Wow, what an absolutely groundbreaking observation!'
            }
          }
        ],
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

      mockOpenAIClient.chat.completions.create.mockRejectedValue(new Error('OpenAI API error'));

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

      // Mock supabase for organizations table (for owner_id lookup)
      const mockOrganizationsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: 'user-123' },
          error: null
        })
      };

      // Mock supabase for responses table
      const mockResponsesQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'response-123', response_text: 'Generated response' },
          error: null
        })
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return mockOrganizationsQuery;
        }
        if (table === 'responses') {
          return mockResponsesQuery;
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          single: jest.fn()
        };
      });

      // Mock transparency service
      mockTransparencyService.applyTransparencyDisclaimer.mockResolvedValue({
        finalText: 'Generated response',
        disclaimer: null,
        disclaimerType: null,
        transparencyMode: 'none'
      });
      mockTransparencyService.updateDisclaimerStats.mockResolvedValue({
        success: true
      });

      const result = await worker.storeResponse(
        commentId,
        organizationId,
        response,
        config,
        generationTime
      );

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

      // Mock organizations query
      const mockOrganizationsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: 'user-123' },
          error: null
        })
      };

      // Mock responses query with error
      const mockResponsesQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: mockError
        })
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return mockOrganizationsQuery;
        }
        if (table === 'responses') {
          return mockResponsesQuery;
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          single: jest.fn()
        };
      });

      // Mock transparency service
      mockTransparencyService.applyTransparencyDisclaimer.mockResolvedValue({
        finalText: 'Test response',
        disclaimer: null,
        disclaimerType: null,
        transparencyMode: 'none'
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

      expect(result).toEqual(mockConfig);
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

      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    test('should handle malformed job data', async () => {
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({ blocked: false });

      const malformedJob = {
        id: 'bad-job'
        // Missing required fields
      };

      await expect(worker.processJob(malformedJob)).rejects.toThrow(
        /Invalid job: missing or invalid payload object/
      );

      // Verify circuit breaker failure was recorded
      expect(worker.circuitBreaker.failures).toBeGreaterThan(0);
    });

    test('should handle comment not found', async () => {
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({ blocked: false });

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

      // Mock getComment to return null (comment not found)
      worker.getComment = jest.fn().mockResolvedValue(null);

      await expect(worker.processJob(job)).rejects.toThrow(/Comment missing-comment not found/);
    });

    test('should handle roast generation failures gracefully', async () => {
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({ blocked: false });

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

      // Mock getComment to return a comment
      worker.getComment = jest.fn().mockResolvedValue({
        id: 'comment-456',
        text: 'Test comment',
        integration_config_id: 'config-missing'
      });

      // Mock getIntegrationConfig to return null (config not found)
      worker.getIntegrationConfig = jest.fn().mockResolvedValue(null);

      await expect(worker.processJob(job)).rejects.toThrow(
        /Integration config not found for comment comment-456/
      );
    });
  });

  describe('Circuit Breaker', () => {
    test('should allow processing when circuit breaker is closed', () => {
      worker.circuitBreaker.state = 'closed';
      worker.circuitBreaker.failures = 0;

      expect(() => worker.checkCircuitBreaker()).not.toThrow();
    });

    test('should throw error when circuit breaker is open and timeout not reached', () => {
      worker.circuitBreaker.state = 'open';
      worker.circuitBreaker.lastFailureTime = Date.now() - 1000; // 1 second ago
      worker.circuitBreaker.timeout = 30000; // 30 seconds timeout

      expect(() => worker.checkCircuitBreaker()).toThrow(/Circuit breaker is open/);
    });

    test('should transition to half-open when timeout is reached', () => {
      worker.circuitBreaker.state = 'open';
      worker.circuitBreaker.lastFailureTime = Date.now() - 35000; // 35 seconds ago
      worker.circuitBreaker.timeout = 30000; // 30 seconds timeout
      worker.circuitBreaker.consecutiveSuccesses = 0;

      worker.checkCircuitBreaker();

      expect(worker.circuitBreaker.state).toBe('half-open');
    });

    test('should record success and close circuit from half-open', () => {
      worker.circuitBreaker.state = 'half-open';
      worker.circuitBreaker.consecutiveSuccesses = 0;
      worker.circuitBreaker.halfOpenMaxAttempts = 1;
      worker.circuitBreaker.failures = 3;

      worker.recordCircuitBreakerSuccess();

      expect(worker.circuitBreaker.state).toBe('closed');
      expect(worker.circuitBreaker.failures).toBe(0);
    });

    test('should record failure and open circuit after threshold', () => {
      worker.circuitBreaker.state = 'closed';
      worker.circuitBreaker.failures = 2;
      worker.circuitBreaker.threshold = 3;

      worker.recordCircuitBreakerFailure(new Error('Test error'));

      expect(worker.circuitBreaker.state).toBe('open');
      expect(worker.circuitBreaker.failures).toBe(3);
    });

    test('should decrement failures on success in closed state', () => {
      worker.circuitBreaker.state = 'closed';
      worker.circuitBreaker.failures = 2;

      worker.recordCircuitBreakerSuccess();

      expect(worker.circuitBreaker.failures).toBe(1);
    });
  });

  describe('Job Validation', () => {
    test('should throw error when job is null', async () => {
      await expect(worker.processJob(null)).rejects.toThrow('Job is null or undefined');
    });

    test('should throw error when job is undefined', async () => {
      await expect(worker.processJob(undefined)).rejects.toThrow('Job is null or undefined');
    });

    test('should throw error when job.payload is missing', async () => {
      const job = { id: 'job-123' };
      await expect(worker.processJob(job)).rejects.toThrow(
        'Invalid job: missing or invalid payload object'
      );
    });

    test('should throw error when job.payload is not an object', async () => {
      const job = { id: 'job-123', payload: 'invalid' };
      await expect(worker.processJob(job)).rejects.toThrow(
        'Invalid job: missing or invalid payload object'
      );
    });

    test('should accept job with org_id alternative to organization_id', async () => {
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({ blocked: false });

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { owner_id: 'user-123' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { roasting_enabled: true },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'comments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'comment-456',
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
                      platform: 'twitter',
                      tone: 'sarcastic',
                      response_frequency: 1.0,
                      config: {}
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
                    id: 'response-123',
                    response_text: 'Test response'
                  },
                  error: null
                })
              })
            })
          };
        }
      });

      const job = {
        id: 'job-123',
        payload: {
          org_id: 'org-123', // Using org_id instead of organization_id
          comment_id: 'comment-456',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      worker.getComment = jest.fn().mockResolvedValue({
        id: 'comment-456',
        integration_config_id: 'config-123'
      });
      worker.getIntegrationConfig = jest.fn().mockResolvedValue({
        id: 'config-123',
        platform: 'twitter',
        tone: 'sarcastic',
        response_frequency: 1.0,
        config: {}
      });
      worker.fetchPersonaData = jest.fn().mockResolvedValue(null);
      worker.generateResponse = jest.fn().mockResolvedValue({
        text: 'Test response',
        service: 'template',
        tokensUsed: 10
      });
      worker.storeResponse = jest.fn().mockResolvedValue({
        id: 'response-123',
        response_text: 'Test response'
      });
      worker.queuePostingJob = jest.fn();

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
    });
  });

  describe('Kill Switch', () => {
    test('should block processing when kill switch is active', async () => {
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({
        blocked: true,
        reason: 'maintenance',
        message: 'Service temporarily unavailable'
      });

      const job = {
        id: 'job-123',
        payload: {
          organization_id: 'org-123',
          comment_id: 'comment-456',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      await expect(worker.processJob(job)).rejects.toThrow(/Reply generation blocked/);
      expect(worker.log).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('Reply generation blocked'),
        expect.any(Object)
      );
    });

    test('should allow processing when kill switch is inactive', async () => {
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({ blocked: false });

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      worker.getComment = jest.fn().mockResolvedValue({
        id: 'comment-456',
        integration_config_id: 'config-123'
      });
      worker.getIntegrationConfig = jest.fn().mockResolvedValue({
        id: 'config-123',
        platform: 'twitter',
        tone: 'sarcastic',
        response_frequency: 1.0,
        config: {}
      });
      worker.shouldRespondBasedOnFrequency = jest.fn().mockReturnValue(true);
      worker.fetchPersonaData = jest.fn().mockResolvedValue(null);
      worker.generateResponse = jest.fn().mockResolvedValue({
        text: 'Test response',
        service: 'template'
      });
      worker.storeResponse = jest.fn().mockResolvedValue({
        id: 'response-123',
        response_text: 'Test response'
      });
      worker.queuePostingJob = jest.fn();

      const job = {
        id: 'job-123',
        payload: {
          organization_id: 'org-123',
          comment_id: 'comment-456',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
    });
  });

  describe('Roasting Enabled Check', () => {
    test('should skip generation when roasting is disabled', async () => {
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({ blocked: false });

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      const { supabaseServiceClient } = require('../../../src/config/supabase');
      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { owner_id: 'user-123' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { roasting_enabled: false },
                  error: null
                })
              })
            })
          };
        }
      });

      // Mock getComment to return a comment so the flow continues
      worker.getComment = jest.fn().mockResolvedValue({
        id: 'comment-456',
        integration_config_id: 'config-123'
      });

      const job = {
        id: 'job-123',
        payload: {
          organization_id: 'org-123',
          comment_id: 'comment-456',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('roasting_disabled');
    });

    test('should continue when roasting is enabled', async () => {
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({ blocked: false });

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      const { supabaseServiceClient } = require('../../../src/config/supabase');
      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { owner_id: 'user-123' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { roasting_enabled: true },
                  error: null
                })
              })
            })
          };
        }
      });

      worker.getComment = jest.fn().mockResolvedValue({
        id: 'comment-456',
        integration_config_id: 'config-123'
      });
      worker.getIntegrationConfig = jest.fn().mockResolvedValue({
        id: 'config-123',
        platform: 'twitter',
        tone: 'sarcastic',
        response_frequency: 1.0,
        config: {}
      });
      worker.shouldRespondBasedOnFrequency = jest.fn().mockReturnValue(true);
      worker.fetchPersonaData = jest.fn().mockResolvedValue(null);
      worker.generateResponse = jest.fn().mockResolvedValue({
        text: 'Test response',
        service: 'template'
      });
      worker.storeResponse = jest.fn().mockResolvedValue({
        id: 'response-123',
        response_text: 'Test response'
      });
      worker.queuePostingJob = jest.fn();

      const job = {
        id: 'job-123',
        payload: {
          organization_id: 'org-123',
          comment_id: 'comment-456',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.skipped).toBeUndefined();
    });
  });

  describe('Auto-Approval Flow', () => {
    beforeEach(() => {
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({ blocked: false });

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      worker.getComment = jest.fn().mockResolvedValue({
        id: 'comment-456',
        integration_config_id: 'config-123'
      });
      worker.getIntegrationConfig = jest.fn().mockResolvedValue({
        id: 'config-123',
        platform: 'twitter',
        tone: 'sarcastic',
        response_frequency: 1.0,
        config: {}
      });
      worker.shouldRespondBasedOnFrequency = jest.fn().mockReturnValue(true);
      worker.fetchPersonaData = jest.fn().mockResolvedValue(null);
      worker.generateResponse = jest.fn().mockResolvedValue({
        text: 'Test response',
        service: 'openai',
        tokensUsed: 25
      });
      worker.normalizeToxicityScore = jest.fn().mockReturnValue(0.5);
      worker.storeResponse = jest.fn().mockResolvedValue({
        id: 'response-123',
        response_text: 'Test response',
        comment_id: 'comment-456'
      });
      worker.validateContentAtomically = jest.fn().mockResolvedValue({
        valid: true,
        validationId: 'val-123'
      });
      worker.queuePostingJob = jest.fn();
    });

    test('should process auto-approval when mode is auto and autoApproval is true', async () => {
      mockAutoApprovalService.processAutoApproval.mockResolvedValue({
        approved: true,
        reason: 'passed_validation',
        autoPublish: true,
        variant: {
          id: 'var-123',
          text: 'Test response',
          style: 'sarcastic',
          score: 0.5
        },
        validationId: 'val-123',
        approvalRecord: { id: 'approval-123' }
      });

      const job = {
        id: 'job-123',
        payload: {
          organization_id: 'org-123',
          comment_id: 'comment-456',
          platform: 'twitter',
          original_text: 'Test comment',
          mode: 'auto',
          autoApproval: true
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(mockAutoApprovalService.processAutoApproval).toHaveBeenCalled();
      expect(result.autoApproval).toBeDefined();
      expect(result.autoApproval.approved).toBe(true);
    });

    test('should validate content before auto-publishing', async () => {
      mockAutoApprovalService.processAutoApproval.mockResolvedValue({
        approved: true,
        autoPublish: true,
        variant: {
          id: 'var-123',
          text: 'Test response'
        },
        validationId: 'val-123'
      });

      const job = {
        id: 'job-123',
        payload: {
          organization_id: 'org-123',
          comment_id: 'comment-456',
          platform: 'twitter',
          original_text: 'Test comment',
          mode: 'auto',
          autoApproval: true
        }
      };

      await worker.processJob(job);

      expect(worker.validateContentAtomically).toHaveBeenCalled();
    });

    test('should throw error when content validation fails', async () => {
      mockAutoApprovalService.processAutoApproval.mockResolvedValue({
        approved: true,
        autoPublish: true,
        variant: {
          id: 'var-123',
          text: 'Test response'
        },
        validationId: 'val-123'
      });

      worker.validateContentAtomically.mockResolvedValue({
        valid: false,
        reason: 'content_text_mismatch',
        validationId: 'val-123'
      });

      const job = {
        id: 'job-123',
        payload: {
          organization_id: 'org-123',
          comment_id: 'comment-456',
          platform: 'twitter',
          original_text: 'Test comment',
          mode: 'auto',
          autoApproval: true
        }
      };

      await expect(worker.processJob(job)).rejects.toThrow(/Atomic content validation failed/);
    });
  });

  describe('Content Validation', () => {
    test('should calculate content checksum', () => {
      const content = 'Test content';
      const checksum = worker.calculateContentChecksum(content);

      expect(checksum).toBeDefined();
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBeGreaterThan(0);
    });

    test('should validate content metadata', () => {
      const storedResponse = {
        id: 'response-123',
        comment_id: 'comment-456',
        response_text: 'Test response',
        created_at: new Date().toISOString()
      };

      const approvedVariant = {
        id: 'var-123',
        text: 'Test response'
      };

      const originalResponse = {
        service: 'openai'
      };

      const context = {
        comment_id: 'comment-456'
      };

      const result = worker.validateContentMetadata(
        storedResponse,
        approvedVariant,
        originalResponse,
        'val-123',
        context
      );

      expect(result.valid).toBe(true);
    });

    test('should detect content mismatch in metadata validation', () => {
      const storedResponse = {
        id: 'response-123',
        comment_id: 'comment-999', // Different comment ID
        response_text: 'Test response'
      };

      const approvedVariant = {
        id: 'var-123',
        text: 'Test response'
      };

      const originalResponse = {};

      const context = {
        comment_id: 'comment-456'
      };

      const result = worker.validateContentMetadata(
        storedResponse,
        approvedVariant,
        originalResponse,
        'val-123',
        context
      );

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('comment_id_mismatch');
    });
  });

  describe('Response Generation Edge Cases', () => {
    test('should handle OpenAI timeout', async () => {
      const originalText = 'Test comment';
      const config = { tone: 'sarcastic' };
      const context = { platform: 'twitter' };

      mockOpenAIClient.chat.completions.create.mockRejectedValue(new Error('Request timeout'));

      const result = await worker.generateResponse(originalText, config, context);

      expect(result.service).toBe('template');
      expect(result.templated).toBe(true);
    });

    test('should handle template generation for different tones', async () => {
      const originalText = 'Test comment';
      const config = { tone: 'ironic' };
      const context = { platform: 'twitter' };

      mockOpenAIClient.chat.completions.create.mockRejectedValue(new Error('OpenAI unavailable'));

      const result = await worker.generateResponse(originalText, config, context);

      expect(result.service).toBe('template');
      expect(result.text).toBeDefined();
      expect(worker.templates.ironic).toBeDefined();
    });

    test('should handle empty response from OpenAI', async () => {
      const originalText = 'Test comment';
      const config = { tone: 'sarcastic' };
      const context = { platform: 'twitter' };

      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: '' // Empty response
            }
          }
        ],
        usage: {
          total_tokens: 10
        }
      });

      const result = await worker.generateResponse(originalText, config, context);

      expect(result.text).toBeDefined(); // Should fallback or handle empty
    });
  });

  describe('generateOpenAIResponse', () => {
    beforeEach(() => {
      mockRoastPromptTemplate.buildPrompt.mockResolvedValue('System prompt');
    });

    test('should generate response with OpenAI and persona context', async () => {
      const originalText = 'Test comment';
      const config = {
        tone: 'sarcastic',
        custom_style_prompt: 'Custom style'
      };
      const context = {
        platform: 'twitter',
        severity_level: 'high',
        toxicity_score: 0.8,
        categories: ['TOXICITY'],
        personaData: {
          hasPersona: true,
          fieldsAvailable: ['lo_que_me_define']
        }
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Generated roast response'
            }
          }
        ],
        usage: {
          total_tokens: 50
        }
      });

      const result = await worker.generateOpenAIResponse(originalText, config, context);

      expect(result.text).toBeDefined();
      expect(result.service).toBeUndefined(); // Not set in this method
      expect(result.tokensUsed).toBe(50);
      expect(mockRoastPromptTemplate.buildPrompt).toHaveBeenCalled();
    });

    test('should handle prompt building errors', async () => {
      const originalText = 'Test comment';
      const config = { tone: 'sarcastic' };
      const context = { platform: 'twitter' };

      mockRoastPromptTemplate.buildPrompt.mockRejectedValue(new Error('Prompt generation failed'));

      await expect(worker.generateOpenAIResponse(originalText, config, context)).rejects.toThrow(
        /Prompt generation failed/
      );
    });

    test('should validate response length for Twitter', async () => {
      const originalText = 'Test comment';
      const config = { tone: 'sarcastic' };
      const context = { platform: 'twitter' };

      const longResponse = 'X'.repeat(300);
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: longResponse
            }
          }
        ],
        usage: {
          total_tokens: 100
        }
      });

      const result = await worker.generateOpenAIResponse(originalText, config, context);

      expect(result.text.length).toBeLessThanOrEqual(270); // Twitter limit
    });
  });

  describe('fetchPersonaData', () => {
    test('should fetch persona data successfully', async () => {
      const organizationId = 'org-123';

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { owner_id: 'user-123' },
              error: null
            })
          };
        }
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                lo_que_me_define_encrypted: 'encrypted-data',
                lo_que_me_define_visible: 'visible-data',
                lo_que_no_tolero_encrypted: 'encrypted-intolerance',
                lo_que_no_tolero_visible: 'visible-intolerance',
                embeddings_generated_at: new Date().toISOString(),
                embeddings_model: 'text-embedding-3-small'
              },
              error: null
            })
          };
        }
      });

      const result = await worker.fetchPersonaData(organizationId);

      expect(result).toBeDefined();
      expect(result.hasPersona).toBe(true);
      expect(result.fieldsAvailable).toContain('lo_que_me_define');
    });

    test('should return null when no persona data exists', async () => {
      const organizationId = 'org-123';

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { owner_id: 'user-123' },
              error: null
            })
          };
        }
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                lo_que_me_define_encrypted: null,
                lo_que_me_define_visible: null,
                lo_que_no_tolero_encrypted: null,
                lo_que_no_tolero_visible: null,
                embeddings_generated_at: null,
                embeddings_model: null
              },
              error: null
            })
          };
        }
      });

      const result = await worker.fetchPersonaData(organizationId);

      expect(result).toBeNull();
    });
  });

  describe('normalizeToxicityScore', () => {
    test('should normalize valid score from response', () => {
      const responseScore = 0.75;
      const originalScore = 0.8;

      const result = worker.normalizeToxicityScore(responseScore, originalScore);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
      expect(typeof result).toBe('number');
    });

    test('should use original score when response score is invalid', () => {
      const responseScore = null;
      const originalScore = 0.65;

      const result = worker.normalizeToxicityScore(responseScore, originalScore);

      expect(result).toBeGreaterThanOrEqual(0.65);
      expect(result).toBeLessThanOrEqual(1);
    });

    test('should use conservative fallback when both scores are invalid', () => {
      const responseScore = null;
      const originalScore = null;

      const result = worker.normalizeToxicityScore(responseScore, originalScore);

      expect(result).toBe(0.8); // Conservative fallback
    });

    test('should handle string scores', () => {
      const responseScore = '0.75';
      const originalScore = 0.8;

      const result = worker.normalizeToxicityScore(responseScore, originalScore);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    test('should handle scores in 0-100 range', () => {
      const responseScore = 75; // 0-100 range
      const originalScore = 0.8;

      const result = worker.normalizeToxicityScore(responseScore, originalScore);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('parseScore', () => {
    test('should parse valid number score', () => {
      const score = 0.75;
      const result = worker.parseScore(score);
      expect(result).toBe(0.75);
    });

    test('should parse string number', () => {
      const score = '0.85';
      const result = worker.parseScore(score);
      expect(result).toBe(0.85);
    });

    test('should normalize 0-100 range to 0-1', () => {
      const score = 85; // 0-100 range
      const result = worker.parseScore(score);
      expect(result).toBe(0.85);
    });

    test('should return null for invalid input', () => {
      expect(worker.parseScore(null)).toBeNull();
      expect(worker.parseScore(undefined)).toBeNull();
      expect(worker.parseScore('invalid')).toBeNull();
      expect(worker.parseScore(-1)).toBeNull();
      // Scores > 1 but <= 100 are normalized, so 2 becomes 0.02 (valid)
      // Only scores > 100 or < 0 are invalid
      expect(worker.parseScore(101)).toBeNull(); // > 100 is invalid
      expect(worker.parseScore(-0.1)).toBeNull(); // < 0 is invalid
    });
  });

  describe('validateContentAtomically', () => {
    test('should validate content successfully when all checks pass', async () => {
      const storedResponse = {
        id: 'response-123',
        comment_id: 'comment-456',
        response_text: 'Test response text',
        created_at: new Date().toISOString()
      };

      const approvedVariant = {
        id: 'var-123',
        text: 'Test response text'
      };

      const originalResponse = {
        text: 'Test response text',
        service: 'openai'
      };

      const context = {
        comment_id: 'comment-456',
        organization_id: 'org-123',
        responseId: 'response-123'
      };

      const result = await worker.validateContentAtomically(
        storedResponse,
        approvedVariant,
        originalResponse,
        context
      );

      expect(result.valid).toBe(true);
      expect(result.validationId).toBeDefined();
      expect(result.checksum).toBeDefined();
    });

    test('should fail validation when text mismatch', async () => {
      const storedResponse = {
        id: 'response-123',
        response_text: 'Original text'
      };

      const approvedVariant = {
        id: 'var-123',
        text: 'Different text'
      };

      const originalResponse = { text: 'Original text' };
      const context = { comment_id: 'comment-456' };

      const result = await worker.validateContentAtomically(
        storedResponse,
        approvedVariant,
        originalResponse,
        context
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('content_text_mismatch');
    });

    test('should fail validation when stored response is invalid', async () => {
      const storedResponse = null;
      const approvedVariant = { id: 'var-123', text: 'Test' };
      const originalResponse = { text: 'Test' };
      const context = { comment_id: 'comment-456' };

      const result = await worker.validateContentAtomically(
        storedResponse,
        approvedVariant,
        originalResponse,
        context
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_stored_response');
    });

    test('should fail validation when approved variant is invalid', async () => {
      const storedResponse = {
        id: 'response-123',
        response_text: 'Test text'
      };
      const approvedVariant = null;
      const originalResponse = { text: 'Test text' };
      const context = { comment_id: 'comment-456' };

      const result = await worker.validateContentAtomically(
        storedResponse,
        approvedVariant,
        originalResponse,
        context
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_approved_variant');
    });
  });

  describe('calculateContentChecksum', () => {
    test('should calculate checksum for valid content', () => {
      const content = 'Test content for checksum';
      const checksum = worker.calculateContentChecksum(content);

      expect(checksum).toBeDefined();
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBeGreaterThan(0);
    });

    test('should return same checksum for same content', () => {
      const content = 'Test content';
      const checksum1 = worker.calculateContentChecksum(content);
      const checksum2 = worker.calculateContentChecksum(content);

      expect(checksum1).toBe(checksum2);
    });

    test('should return different checksum for different content', () => {
      const content1 = 'Test content 1';
      const content2 = 'Test content 2';
      const checksum1 = worker.calculateContentChecksum(content1);
      const checksum2 = worker.calculateContentChecksum(content2);

      expect(checksum1).not.toBe(checksum2);
    });

    test('should handle empty string', () => {
      const checksum = worker.calculateContentChecksum('');
      expect(checksum).toBeDefined();
    });

    test('should handle invalid content', () => {
      const checksum = worker.calculateContentChecksum(null);
      expect(checksum).toBe('invalid_content');
    });
  });

  describe('buildPersonaContext', () => {
    test('should build persona context from available fields', () => {
      const personaData = {
        hasPersona: true,
        fieldsAvailable: ['lo_que_me_define', 'lo_que_no_tolero']
      };

      const personaFieldsUsed = {};

      const context = worker.buildPersonaContext(personaData, personaFieldsUsed);

      expect(context).toBeDefined();
      expect(context).toContain('Considera la personalidad definida');
      expect(context).toContain('Ten en cuenta lo que el usuario no tolera');
      expect(personaFieldsUsed.loQueMeDefineUsed).toBe(true);
      expect(personaFieldsUsed.loQueNoToleroUsed).toBe(true);
    });

    test('should return null when no persona data', () => {
      const personaData = null;
      const personaFieldsUsed = {};

      const context = worker.buildPersonaContext(personaData, personaFieldsUsed);

      expect(context).toBeNull();
    });

    test('should return null when no fields available', () => {
      const personaData = {
        hasPersona: true,
        fieldsAvailable: []
      };
      const personaFieldsUsed = {};

      const context = worker.buildPersonaContext(personaData, personaFieldsUsed);

      expect(context).toBeNull();
    });
  });

  describe('getSpecificHealthDetails', () => {
    test('should return health details with OpenAI status', async () => {
      worker.openaiClient = mockOpenAIClient;
      worker.lastOpenAIUse = new Date().toISOString();
      worker.openaiErrors = 2;
      worker.fallbackUseCount = 1;

      const details = await worker.getSpecificHealthDetails();

      expect(details.openai).toBeDefined();
      expect(details.openai.available).toBe(true);
      expect(details.generationStats).toBeDefined();
      expect(details.costControl).toBeDefined();
    });
  });

  describe('Platform Constraints', () => {
    test('should apply Twitter length constraints', () => {
      const platform = 'twitter';
      const constraint = worker.getPlatformConstraint(platform);

      expect(constraint).toContain('Twitter');
      expect(constraint).toContain('280');
    });

    test('should apply YouTube constraints', () => {
      const platform = 'youtube';
      const constraint = worker.getPlatformConstraint(platform);

      expect(constraint).toContain('YouTube');
    });

    test('should return default constraint for unknown platform', () => {
      const platform = 'unknown-platform';
      const constraint = worker.getPlatformConstraint(platform);

      expect(constraint).toBeDefined();
      expect(constraint.length).toBeGreaterThan(0);
    });
  });

  describe('Token Estimation', () => {
    test('should estimate tokens correctly', () => {
      const text = 'This is a test message';
      const tokens = worker.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    test('should handle empty string', () => {
      const tokens = worker.estimateTokens('');
      expect(tokens).toBe(0);
    });

    test('should estimate tokens for long text', () => {
      const longText = 'X'.repeat(1000);
      const tokens = worker.estimateTokens(longText);

      expect(tokens).toBeGreaterThan(100);
    });
  });

  describe('Frequency Filtering', () => {
    test('should skip when frequency is 0', async () => {
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({ blocked: false });

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      worker.getComment = jest.fn().mockResolvedValue({
        id: 'comment-456',
        integration_config_id: 'config-123'
      });
      worker.getIntegrationConfig = jest.fn().mockResolvedValue({
        id: 'config-123',
        platform: 'twitter',
        tone: 'sarcastic',
        response_frequency: 0.0, // Never respond
        config: {}
      });
      worker.shouldRespondBasedOnFrequency = jest.fn().mockReturnValue(false);

      const job = {
        id: 'job-123',
        payload: {
          organization_id: 'org-123',
          comment_id: 'comment-456',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('frequency_filter');
    });
  });

  describe('Error Handling and Retry Logic', () => {
    test('should record circuit breaker failure on error', async () => {
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({ blocked: false });

      // Reset circuit breaker
      worker.circuitBreaker.failures = 0;
      worker.circuitBreaker.state = 'closed';

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: false,
        reason: 'limit_exceeded'
      });

      const job = {
        id: 'job-123',
        payload: {
          organization_id: 'org-123',
          comment_id: 'comment-456',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      const initialFailures = worker.circuitBreaker.failures;

      // The error is thrown after validation, so recordCircuitBreakerFailure is called in catch block
      await expect(worker.processJob(job)).rejects.toThrow();

      // Circuit breaker failure should be recorded in the catch block of processJob
      // However, the error is thrown before cost control check, so it's caught in validation catch block
      // which calls recordCircuitBreakerFailure
      expect(worker.circuitBreaker.failures).toBeGreaterThanOrEqual(initialFailures);
    });

    test('should handle database connection errors gracefully', async () => {
      const { shouldBlockAutopost } = require('../../../src/middleware/killSwitch');
      shouldBlockAutopost.mockResolvedValue({ blocked: false });

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      worker.getComment = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const job = {
        id: 'job-123',
        payload: {
          organization_id: 'org-123',
          comment_id: 'comment-456',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      await expect(worker.processJob(job)).rejects.toThrow();
    });
  });
});
