/**
 * Analyze Toxicity Worker Tests
 * 
 * Tests for toxicity analysis using Perspective API and OpenAI fallback
 */

const AnalyzeToxicityWorker = require('../../../src/workers/AnalyzeToxicityWorker');

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

// Mock Perspective API
const mockPerspectiveService = {
  analyzeToxicity: jest.fn(),
  initialize: jest.fn()
};

jest.mock('../../../src/services/perspective', () => mockPerspectiveService);

// Mock OpenAI service
const mockOpenAIService = {
  moderateContent: jest.fn(),
  initialize: jest.fn()
};

jest.mock('../../../src/services/openai', () => mockOpenAIService);

// Mock Shield service
const mockShieldService = {
  analyzeContent: jest.fn(),
  executeActions: jest.fn(),
  initialize: jest.fn(),
  shutdown: jest.fn()
};

jest.mock('../../../src/services/shieldService', () => {
  return jest.fn().mockImplementation(() => mockShieldService);
});

describe('AnalyzeToxicityWorker', () => {
  let worker;
  let mockSupabase;
  let mockQueueService;

  beforeEach(() => {
    worker = new AnalyzeToxicityWorker();
    mockSupabase = worker.supabase;
    mockQueueService = worker.queueService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize worker with correct type', () => {
      expect(worker.workerType).toBe('analyze_toxicity');
      expect(worker.perspectiveService).toBe(mockPerspectiveService);
      expect(worker.openaiService).toBe(mockOpenAIService);
    });
  });

  describe('processJob', () => {
    test('should analyze toxicity using Perspective API', async () => {
      const job = {
        id: 'job-123',
        organization_id: 'org-123',
        platform: 'twitter',
        comment_id: 'comment-456',
        text: 'This is a toxic comment you idiot',
        author_id: 'user-789'
      };

      const perspectiveResult = {
        success: true,
        scores: {
          TOXICITY: 0.87,
          SEVERE_TOXICITY: 0.23,
          IDENTITY_ATTACK: 0.15,
          INSULT: 0.91,
          PROFANITY: 0.45,
          THREAT: 0.12
        },
        categories: ['TOXICITY', 'INSULT']
      };

      mockPerspectiveService.analyzeToxicity.mockResolvedValue(perspectiveResult);

      // Mock comment update
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      // Mock Shield analysis
      mockShieldService.analyzeContent.mockResolvedValue({
        shouldTakeAction: true,
        actionLevel: 'high',
        recommendedActions: ['warning', 'temporary_mute'],
        userRisk: 'medium'
      });

      mockShieldService.executeActions.mockResolvedValue({
        success: true,
        actionsExecuted: ['warning', 'temporary_mute']
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.method).toBe('perspective_api');
      expect(result.toxicity_score).toBe(0.87);
      expect(result.categories).toContain('TOXICITY');
      expect(result.categories).toContain('INSULT');
      expect(result.shield_actions).toContain('warning');

      expect(mockPerspectiveService.analyzeToxicity).toHaveBeenCalledWith(
        'This is a toxic comment you idiot'
      );
    });

    test('should fallback to OpenAI when Perspective API fails', async () => {
      const job = {
        id: 'job-456',
        organization_id: 'org-123',
        platform: 'twitter',
        comment_id: 'comment-789',
        text: 'Another toxic message',
        author_id: 'user-123'
      };

      // Perspective API fails
      mockPerspectiveService.analyzeToxicity.mockRejectedValue(
        new Error('API quota exceeded')
      );

      // OpenAI succeeds
      const openaiResult = {
        success: true,
        flagged: true,
        categories: {
          harassment: true,
          hate: false,
          violence: false,
          sexual: false
        },
        category_scores: {
          harassment: 0.85,
          hate: 0.12,
          violence: 0.05,
          sexual: 0.02
        }
      };

      mockOpenAIService.moderateContent.mockResolvedValue(openaiResult);

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      mockShieldService.analyzeContent.mockResolvedValue({
        shouldTakeAction: true,
        actionLevel: 'medium',
        recommendedActions: ['warning'],
        userRisk: 'low'
      });

      mockShieldService.executeActions.mockResolvedValue({
        success: true,
        actionsExecuted: ['warning']
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.method).toBe('openai_fallback');
      expect(result.toxicity_score).toBe(0.85); // Highest score from harassment
      expect(result.categories).toContain('harassment');
      expect(result.fallback_reason).toBe('API quota exceeded');
    });

    test('should use pattern-based fallback when both APIs fail', async () => {
      const job = {
        id: 'job-789',
        organization_id: 'org-123',
        platform: 'twitter',
        comment_id: 'comment-123',
        text: 'You are such an idiot and moron!',
        author_id: 'user-456'
      };

      // Both APIs fail
      mockPerspectiveService.analyzeToxicity.mockRejectedValue(
        new Error('Perspective API down')
      );
      mockOpenAIService.moderateContent.mockRejectedValue(
        new Error('OpenAI API down')
      );

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      mockShieldService.analyzeContent.mockResolvedValue({
        shouldTakeAction: false,
        actionLevel: 'low',
        recommendedActions: [],
        userRisk: 'low'
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.method).toBe('pattern_fallback');
      expect(result.toxicity_score).toBeGreaterThan(0.5); // Should detect "idiot" and "moron"
      expect(result.categories).toContain('insult');
    });

    test('should handle non-toxic content', async () => {
      const job = {
        id: 'job-clean',
        organization_id: 'org-123',
        platform: 'twitter',
        comment_id: 'comment-clean',
        text: 'This is a perfectly nice comment!',
        author_id: 'user-123'
      };

      const perspectiveResult = {
        success: true,
        scores: {
          TOXICITY: 0.12,
          SEVERE_TOXICITY: 0.03,
          IDENTITY_ATTACK: 0.05,
          INSULT: 0.08,
          PROFANITY: 0.02,
          THREAT: 0.01
        },
        categories: []
      };

      mockPerspectiveService.analyzeToxicity.mockResolvedValue(perspectiveResult);

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      mockShieldService.analyzeContent.mockResolvedValue({
        shouldTakeAction: false,
        actionLevel: 'none',
        recommendedActions: [],
        userRisk: 'low'
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.toxicity_score).toBe(0.12);
      expect(result.categories).toHaveLength(0);
      expect(result.shield_actions).toHaveLength(0);
    });
  });

  describe('analyzeWithPerspective', () => {
    test('should analyze text with Perspective API', async () => {
      const text = 'You are stupid';
      
      const mockResponse = {
        success: true,
        scores: {
          TOXICITY: 0.78,
          INSULT: 0.85,
          PROFANITY: 0.15
        },
        categories: ['TOXICITY', 'INSULT']
      };

      mockPerspectiveService.analyzeToxicity.mockResolvedValue(mockResponse);

      const result = await worker.analyzeWithPerspective(text);

      expect(result.success).toBe(true);
      expect(result.toxicity_score).toBe(0.78);
      expect(result.categories).toEqual(['TOXICITY', 'INSULT']);
    });

    test('should handle Perspective API errors', async () => {
      const text = 'Test text';
      
      mockPerspectiveService.analyzeToxicity.mockRejectedValue(
        new Error('API key invalid')
      );

      await expect(worker.analyzeWithPerspective(text)).rejects.toThrow('API key invalid');
    });
  });

  describe('analyzeWithOpenAI', () => {
    test('should analyze text with OpenAI moderation', async () => {
      const text = 'This content is harassment';
      
      const mockResponse = {
        success: true,
        flagged: true,
        categories: {
          harassment: true,
          hate: false,
          violence: false,
          sexual: false
        },
        category_scores: {
          harassment: 0.92,
          hate: 0.15,
          violence: 0.08,
          sexual: 0.03
        }
      };

      mockOpenAIService.moderateContent.mockResolvedValue(mockResponse);

      const result = await worker.analyzeWithOpenAI(text);

      expect(result.success).toBe(true);
      expect(result.toxicity_score).toBe(0.92);
      expect(result.categories).toEqual(['harassment']);
    });
  });

  describe('analyzeWithPatterns', () => {
    test('should detect profanity patterns', () => {
      const result = worker.analyzeWithPatterns('You are a fucking idiot');

      expect(result.success).toBe(true);
      expect(result.toxicity_score).toBeGreaterThan(0.7);
      expect(result.categories).toContain('profanity');
      expect(result.categories).toContain('insult');
    });

    test('should detect threat patterns', () => {
      const result = worker.analyzeWithPatterns('I will kill you');

      expect(result.success).toBe(true);
      expect(result.toxicity_score).toBeGreaterThan(0.8);
      expect(result.categories).toContain('threat');
    });

    test('should detect hate speech patterns', () => {
      const result = worker.analyzeWithPatterns('All [group] are terrible');

      expect(result.success).toBe(true);
      expect(result.categories).toContain('hate');
    });

    test('should handle clean content', () => {
      const result = worker.analyzeWithPatterns('This is a nice comment');

      expect(result.success).toBe(true);
      expect(result.toxicity_score).toBeLessThan(0.3);
      expect(result.categories).toHaveLength(0);
    });

    test('should be case insensitive', () => {
      const result = worker.analyzeWithPatterns('YOU ARE STUPID');

      expect(result.success).toBe(true);
      expect(result.toxicity_score).toBeGreaterThan(0.5);
      expect(result.categories).toContain('insult');
    });
  });

  describe('updateCommentAnalysis', () => {
    test('should update comment with analysis results', async () => {
      const commentId = 'comment-123';
      const analysis = {
        toxicity_score: 0.85,
        categories: ['TOXICITY', 'INSULT'],
        method: 'perspective_api',
        confidence: 0.92
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      await worker.updateCommentAnalysis(commentId, analysis);

      expect(mockSupabase.from).toHaveBeenCalledWith('comments');
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        toxicity_score: 0.85,
        toxicity_categories: ['TOXICITY', 'INSULT'],
        analysis_method: 'perspective_api',
        analysis_confidence: 0.92,
        analyzed_at: expect.any(String)
      });
    });

    test('should handle database errors', async () => {
      const commentId = 'comment-456';
      const analysis = { toxicity_score: 0.5 };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'Update failed' }
          })
        })
      });

      await expect(
        worker.updateCommentAnalysis(commentId, analysis)
      ).rejects.toThrow('Update failed');
    });
  });

  describe('processWithShield', () => {
    test('should process content through Shield when enabled', async () => {
      const analysis = {
        toxicity_score: 0.8,
        categories: ['TOXICITY'],
        method: 'perspective_api'
      };

      const user = {
        user_id: 'user-123',
        platform: 'twitter',
        organization_id: 'org-123'
      };

      const content = {
        comment_id: 'comment-456',
        text: 'Toxic comment'
      };

      const shieldAnalysis = {
        shouldTakeAction: true,
        actionLevel: 'medium',
        recommendedActions: ['warning', 'content_removal'],
        userRisk: 'medium'
      };

      const shieldExecution = {
        success: true,
        actionsExecuted: ['warning', 'content_removal']
      };

      mockShieldService.analyzeContent.mockResolvedValue(shieldAnalysis);
      mockShieldService.executeActions.mockResolvedValue(shieldExecution);

      const result = await worker.processWithShield(analysis, user, content, true);

      expect(result.processed).toBe(true);
      expect(result.actionsExecuted).toEqual(['warning', 'content_removal']);
      
      expect(mockShieldService.analyzeContent).toHaveBeenCalledWith(
        {
          text: 'Toxic comment',
          toxicity_score: 0.8,
          categories: ['TOXICITY']
        },
        user
      );
    });

    test('should skip Shield processing when disabled', async () => {
      const analysis = { toxicity_score: 0.8 };
      const user = { user_id: 'user-123' };
      const content = { text: 'Test' };

      const result = await worker.processWithShield(analysis, user, content, false);

      expect(result.processed).toBe(false);
      expect(result.reason).toBe('shield_disabled');
      expect(mockShieldService.analyzeContent).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('should handle malformed job data', async () => {
      const malformedJob = {
        id: 'bad-job',
        organization_id: 'org-123'
        // Missing required fields
      };

      await expect(worker.processJob(malformedJob)).rejects.toThrow();
    });

    test('should handle empty text content', async () => {
      const job = {
        id: 'job-empty',
        organization_id: 'org-123',
        platform: 'twitter',
        comment_id: 'comment-empty',
        text: '',
        author_id: 'user-123'
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.method).toBe('pattern_fallback');
      expect(result.toxicity_score).toBe(0);
      expect(result.categories).toHaveLength(0);
    });

    test('should handle Shield service errors gracefully', async () => {
      const job = {
        id: 'job-shield-error',
        organization_id: 'org-123',
        platform: 'twitter',
        comment_id: 'comment-123',
        text: 'Toxic content',
        author_id: 'user-456'
      };

      mockPerspectiveService.analyzeToxicity.mockResolvedValue({
        success: true,
        scores: { TOXICITY: 0.8 },
        categories: ['TOXICITY']
      });

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      mockShieldService.analyzeContent.mockRejectedValue(
        new Error('Shield service unavailable')
      );

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.shield_error).toBe('Shield service unavailable');
      expect(result.shield_actions).toHaveLength(0);
    });
  });
});