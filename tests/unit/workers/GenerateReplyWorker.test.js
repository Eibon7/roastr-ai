/**
 * Generate Reply Worker Tests
 * 
 * Tests for roast response generation using OpenAI
 */

const GenerateReplyWorker = require('../../../src/workers/GenerateReplyWorker');

// Mock BaseWorker
jest.mock('../../../src/workers/BaseWorker', () => {
  return jest.fn().mockImplementation((workerType, options) => {
    const mockBaseWorker = {
      workerType,
      workerName: `${workerType}-worker-test`,
      config: { maxRetries: 3, ...options },
      supabase: {
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
      },
      queueService: {
        addJob: jest.fn(),
        initialize: jest.fn(),
        shutdown: jest.fn()
      },
      log: jest.fn(),
      processJob: null, // Will be overridden by actual implementation
      start: jest.fn(),
      stop: jest.fn(),
      initializeConnections: jest.fn(),
      setupGracefulShutdown: jest.fn()
    };
    return mockBaseWorker;
  });
});

// Mock OpenAI service
const mockOpenAIService = {
  generateRoast: jest.fn(),
  initialize: jest.fn()
};

jest.mock('../../../src/services/openai', () => mockOpenAIService);

// Mock Cost Control service
const mockCostControlService = {
  canPerformOperation: jest.fn(),
  recordUsage: jest.fn(),
  initialize: jest.fn()
};

jest.mock('../../../src/services/costControl', () => {
  return jest.fn().mockImplementation(() => mockCostControlService);
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

  describe('constructor', () => {
    test('should initialize worker with correct type', () => {
      expect(worker.workerType).toBe('generate_reply');
      expect(worker.openaiService).toBe(mockOpenAIService);
    });
  });

  describe('processJob', () => {
    test('should generate roast reply for toxic comment', async () => {
      const job = {
        id: 'job-123',
        organization_id: 'org-123',
        platform: 'twitter',
        comment_id: 'comment-456',
        text: 'This is a stupid post',
        author_id: 'user-789',
        toxicity_score: 0.85,
        toxicity_categories: ['TOXICITY', 'INSULT']
      };

      // Mock cost control allows operation
      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true,
        currentUsage: 50,
        limit: 100
      });

      // Mock comment lookup
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'comment-456',
                text: 'This is a stupid post',
                toxicity_score: 0.85,
                toxicity_categories: ['TOXICITY', 'INSULT'],
                author_id: 'user-789'
              },
              error: null
            })
          })
        })
      });

      // Mock organization settings lookup
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                roast_tone: 'sarcastic',
                roast_humor_type: 'witty',
                language: 'es',
                auto_post: false
              },
              error: null
            })
          })
        })
      });

      // Mock OpenAI roast generation
      const mockRoast = {
        text: 'Innovador: has reinventado el arte de escribir comentarios tontos.',
        tone: 'sarcastic',
        humor_type: 'witty',
        language: 'es',
        tokens_used: 25,
        cost_cents: 5
      };

      mockOpenAIService.generateRoast.mockResolvedValue(mockRoast);

      // Mock roast storage
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'roast-123' },
              error: null
            })
          })
        })
      });

      // Mock usage recording
      mockCostControlService.recordUsage.mockResolvedValue({
        recorded: true,
        cost: 5
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.roast_text).toBe(mockRoast.text);
      expect(result.tokens_used).toBe(25);
      expect(result.cost_cents).toBe(5);
      expect(result.language).toBe('es');
      expect(result.auto_posted).toBe(false);

      expect(mockOpenAIService.generateRoast).toHaveBeenCalledWith(
        'This is a stupid post',
        {
          tone: 'sarcastic',
          humor_type: 'witty',
          language: 'es',
          platform: 'twitter',
          toxicity_categories: ['TOXICITY', 'INSULT'],
          toxicity_score: 0.85
        }
      );
    });

    test('should handle cost limit exceeded', async () => {
      const job = {
        id: 'job-limited',
        organization_id: 'org-limited',
        platform: 'twitter',
        comment_id: 'comment-456'
      };

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: false,
        reason: 'monthly_limit_exceeded',
        currentUsage: 100,
        limit: 100
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cost limit exceeded: monthly_limit_exceeded');
      expect(result.skipped).toBe(true);
      expect(mockOpenAIService.generateRoast).not.toHaveBeenCalled();
    });

    test('should handle low toxicity comments', async () => {
      const job = {
        id: 'job-clean',
        organization_id: 'org-123',
        platform: 'twitter',
        comment_id: 'comment-clean'
      };

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      // Mock comment with low toxicity
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'comment-clean',
                text: 'This is a nice comment',
                toxicity_score: 0.15,
                toxicity_categories: []
              },
              error: null
            })
          })
        })
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Comment toxicity too low for roast generation');
      expect(result.skipped).toBe(true);
      expect(mockOpenAIService.generateRoast).not.toHaveBeenCalled();
    });

    test('should handle auto-posting for eligible platforms', async () => {
      const job = {
        id: 'job-auto-post',
        organization_id: 'org-123',
        platform: 'twitter',
        comment_id: 'comment-456'
      };

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      // Mock comment and organization with auto-post enabled
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'comment-456',
                  text: 'Toxic comment',
                  toxicity_score: 0.8,
                  toxicity_categories: ['TOXICITY']
                },
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  auto_post: true,
                  roast_tone: 'sarcastic',
                  language: 'es'
                },
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'roast-123' },
                error: null
              })
            })
          })
        });

      mockOpenAIService.generateRoast.mockResolvedValue({
        text: 'Generated roast',
        tokens_used: 20,
        cost_cents: 4
      });

      mockCostControlService.recordUsage.mockResolvedValue({
        recorded: true,
        cost: 4
      });

      // Mock posting job queue
      mockQueueService.addJob.mockResolvedValue({
        success: true,
        jobId: 'post-job-123'
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.auto_posted).toBe(true);
      expect(result.post_job_id).toBe('post-job-123');
      
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'post_response',
        {
          organization_id: 'org-123',
          platform: 'twitter',
          roast_id: 'roast-123',
          reply_to_comment_id: 'comment-456',
          roast_text: 'Generated roast'
        },
        4 // Normal priority for posting
      );
    });
  });

  describe('generateRoast', () => {
    test('should generate roast with custom parameters', async () => {
      const comment = {
        text: 'Your content is trash',
        toxicity_score: 0.9,
        toxicity_categories: ['TOXICITY', 'INSULT']
      };

      const settings = {
        tone: 'witty',
        humor_type: 'clever',
        language: 'en',
        platform: 'youtube'
      };

      const mockRoast = {
        text: 'Congratulations on reinventing the art of terrible comments.',
        tone: 'witty',
        humor_type: 'clever',
        language: 'en',
        tokens_used: 30,
        cost_cents: 6
      };

      mockOpenAIService.generateRoast.mockResolvedValue(mockRoast);

      const result = await worker.generateRoast(comment, settings);

      expect(result).toEqual(mockRoast);
      expect(mockOpenAIService.generateRoast).toHaveBeenCalledWith(
        comment.text,
        {
          ...settings,
          toxicity_categories: comment.toxicity_categories,
          toxicity_score: comment.toxicity_score
        }
      );
    });

    test('should handle OpenAI generation errors', async () => {
      const comment = { text: 'Test', toxicity_score: 0.8 };
      const settings = { tone: 'sarcastic' };

      mockOpenAIService.generateRoast.mockRejectedValue(
        new Error('OpenAI API error')
      );

      await expect(worker.generateRoast(comment, settings)).rejects.toThrow(
        'OpenAI API error'
      );
    });
  });

  describe('storeRoast', () => {
    test('should store roast in database', async () => {
      const roastData = {
        organization_id: 'org-123',
        platform: 'twitter',
        comment_id: 'comment-456',
        roast_text: 'Generated roast',
        tone: 'sarcastic',
        humor_type: 'witty',
        language: 'es',
        tokens_used: 25,
        cost_cents: 5
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'roast-123' },
              error: null
            })
          })
        })
      });

      const result = await worker.storeRoast(roastData);

      expect(result.success).toBe(true);
      expect(result.roastId).toBe('roast-123');
      expect(mockSupabase.from).toHaveBeenCalledWith('roasts');
    });

    test('should handle database storage errors', async () => {
      const roastData = {
        organization_id: 'org-123',
        roast_text: 'Test roast'
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' }
            })
          })
        })
      });

      await expect(worker.storeRoast(roastData)).rejects.toThrow('Insert failed');
    });
  });

  describe('shouldGenerateRoast', () => {
    test('should allow roast for high toxicity', () => {
      expect(worker.shouldGenerateRoast(0.8, ['TOXICITY'])).toBe(true);
    });

    test('should allow roast for medium toxicity with categories', () => {
      expect(worker.shouldGenerateRoast(0.6, ['INSULT'])).toBe(true);
    });

    test('should reject roast for low toxicity', () => {
      expect(worker.shouldGenerateRoast(0.3, [])).toBe(false);
    });

    test('should reject roast for medium toxicity without categories', () => {
      expect(worker.shouldGenerateRoast(0.6, [])).toBe(false);
    });
  });

  describe('validateRoastLength', () => {
    test('should pass Twitter length validation', () => {
      const shortRoast = 'Short roast text';
      expect(worker.validateRoastLength(shortRoast, 'twitter')).toBe(true);
    });

    test('should fail Twitter length validation for long text', () => {
      const longRoast = 'X'.repeat(281); // Over 280 characters
      expect(worker.validateRoastLength(longRoast, 'twitter')).toBe(false);
    });

    test('should pass YouTube length validation', () => {
      const mediumRoast = 'X'.repeat(500);
      expect(worker.validateRoastLength(mediumRoast, 'youtube')).toBe(true);
    });

    test('should fail YouTube length validation for very long text', () => {
      const veryLongRoast = 'X'.repeat(10001); // Over 10000 characters
      expect(worker.validateRoastLength(veryLongRoast, 'youtube')).toBe(false);
    });
  });

  describe('getOrganizationSettings', () => {
    test('should fetch organization roast settings', async () => {
      const organizationId = 'org-123';
      
      const mockSettings = {
        roast_tone: 'clever',
        roast_humor_type: 'witty',
        language: 'en',
        auto_post: true
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSettings,
              error: null
            })
          })
        })
      });

      const result = await worker.getOrganizationSettings(organizationId);

      expect(result).toEqual(mockSettings);
      expect(mockSupabase.from).toHaveBeenCalledWith('organizations');
    });

    test('should return default settings when organization not found', async () => {
      const organizationId = 'org-missing';

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const result = await worker.getOrganizationSettings(organizationId);

      expect(result.roast_tone).toBe('sarcastic');
      expect(result.roast_humor_type).toBe('witty');
      expect(result.language).toBe('es');
      expect(result.auto_post).toBe(false);
    });
  });

  describe('error handling', () => {
    test('should handle malformed job data', async () => {
      const malformedJob = {
        id: 'bad-job'
        // Missing required fields
      };

      await expect(worker.processJob(malformedJob)).rejects.toThrow();
    });

    test('should handle comment not found', async () => {
      const job = {
        id: 'job-missing-comment',
        organization_id: 'org-123',
        comment_id: 'missing-comment'
      };

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Comment not found: missing-comment');
    });

    test('should handle roast generation failures gracefully', async () => {
      const job = {
        id: 'job-generation-fail',
        organization_id: 'org-123',
        comment_id: 'comment-456'
      };

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  text: 'Toxic comment',
                  toxicity_score: 0.8,
                  toxicity_categories: ['TOXICITY']
                },
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { roast_tone: 'sarcastic' },
                error: null
              })
            })
          })
        });

      mockOpenAIService.generateRoast.mockRejectedValue(
        new Error('Content policy violation')
      );

      const result = await worker.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content policy violation');
    });
  });
});