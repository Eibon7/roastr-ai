/**
 * Complete Roast Flow Integration Tests
 * 
 * Tests the entire pipeline from comment reception to roast delivery:
 * 1. Comment detection and fetching
 * 2. Toxicity analysis and filtering
 * 3. User configuration application
 * 4. Roast generation with proper formatting
 * 5. Character limit enforcement
 * 6. Response validation and delivery
 * 7. Error handling and UI state management
 */

const request = require('supertest');
const { app } = require('../../src/index');
const FetchCommentsWorker = require('../../src/workers/FetchCommentsWorker');
const AnalyzeToxicityWorker = require('../../src/workers/AnalyzeToxicityWorker');
const GenerateReplyWorker = require('../../src/workers/GenerateReplyWorker');

// Mock external services
jest.mock('@supabase/supabase-js');
jest.mock('../../src/services/queueService');
jest.mock('../../src/services/costControl');
jest.mock('twitter-api-v2');
jest.mock('discord.js');

describe('Complete Roast Flow Integration', () => {
  let mockSupabase;
  let mockQueueService;
  let workers = [];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase with comprehensive responses
    const mockEq = jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'config-123',
            organization_id: 'org-123',
            platform: 'twitter',
            enabled: true,
            tone: 'sarcastic',
            humor_type: 'witty',
            response_frequency: 0.8,
            shield_enabled: true
          },
          error: null
        })
      })),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Test comment',
          toxicity_score: 0.7,
          integration_config_id: 'config-123'
        },
        error: null
      })
    }));

    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => mockEq),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: { id: 'response-123' },
              error: null
            })
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        }))
      }))
    };

    // Mock Queue Service
    mockQueueService = {
      addJob: jest.fn().mockResolvedValue({ id: 'job-123' }),
      processJob: jest.fn(),
      shutdown: jest.fn()
    };

    // Mock Cost Control Service
    const mockCostControl = {
      canPerformOperation: jest.fn().mockResolvedValue({
        allowed: true,
        reason: 'Within limits'
      }),
      recordUsage: jest.fn().mockResolvedValue({ success: true })
    };

    // Set up environment
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.PERSPECTIVE_API_KEY = 'test-perspective-key';

    // Make cost control available globally for workers
    global.mockCostControl = mockCostControl;
  });

  afterEach(async () => {
    // Clean up workers
    for (const worker of workers) {
      if (worker.shutdown) {
        await worker.shutdown();
      }
    }
    workers = [];
  });

  describe('User Configuration Handling', () => {
    test('should apply user tone preferences correctly', async () => {
      const userConfig = {
        tone: 'playful',
        humor_type: 'clever',
        response_frequency: 0.9,
        character_limit: 280
      };

      // Mock user configuration fetch
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'org-123',
                preferences: userConfig
              },
              error: null
            })
          }))
        }))
      });

      const worker = new GenerateReplyWorker();
      worker.supabase = mockSupabase;
      worker.costControl = global.mockCostControl;
      workers.push(worker);

      const job = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'This app is terrible',
          toxicity_score: 0.7,
          categories: ['TOXICITY']
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.config.tone).toBe('playful');
      expect(result.config.humor_type).toBe('clever');
    });

    test('should enforce character limits per platform', async () => {
      const platforms = [
        { name: 'twitter', limit: 280 },
        { name: 'instagram', limit: 2200 },
        { name: 'discord', limit: 2000 }
      ];

      for (const platform of platforms) {
        const worker = new GenerateReplyWorker();
        worker.supabase = mockSupabase;
        worker.costControl = global.mockCostControl;
        workers.push(worker);

        // Mock a long response that exceeds platform limit
        const longResponse = 'a'.repeat(platform.limit + 100);
        
        const validatedResponse = worker.validateResponseLength(longResponse, platform.name);
        
        expect(validatedResponse.length).toBeLessThanOrEqual(platform.limit);
        expect(validatedResponse).toContain('...'); // Should be truncated
      }
    });

    test('should handle missing user configuration gracefully', async () => {
      // Mock missing configuration
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' } // No rows found
            })
          }))
        }))
      });

      const worker = new GenerateReplyWorker();
      worker.supabase = mockSupabase;
      worker.costControl = global.mockCostControl;
      workers.push(worker);

      const job = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-missing',
          platform: 'twitter',
          original_text: 'Test comment',
          toxicity_score: 0.6
        }
      };

      const result = await worker.processJob(job);

      // Should use default configuration
      expect(result.success).toBe(true);
      expect(result.config.tone).toBe('sarcastic'); // Default tone
      expect(result.config.humor_type).toBe('witty'); // Default humor type
    });
  });

  describe('Response Format Validation', () => {
    test('should generate responses in correct format', async () => {
      const worker = new GenerateReplyWorker();
      worker.supabase = mockSupabase;
      worker.costControl = global.mockCostControl;
      workers.push(worker);

      // Mock OpenAI response
      worker.openaiClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'Your comment shows the intellectual depth of a puddle. 🧠💧'
                }
              }],
              usage: { total_tokens: 25 }
            })
          }
        }
      };

      const job = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'This is stupid',
          toxicity_score: 0.8
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.response.text).toBeDefined();
      expect(result.response.text.length).toBeGreaterThan(0);
      expect(result.response.text.length).toBeLessThanOrEqual(280); // Twitter limit
      expect(result.response.tokensUsed).toBeDefined();
      expect(result.response.model).toBeDefined();
    });

    test('should handle special characters and emojis correctly', async () => {
      const worker = new GenerateReplyWorker();
      worker.supabase = mockSupabase;
      worker.costControl = global.mockCostControl;
      workers.push(worker);

      const testCases = [
        'Comment with émojis 🔥💀',
        'Comment with "quotes" and symbols @#$%',
        'Comment with unicode: 测试 العربية русский',
        'Comment with newlines\nand\ttabs'
      ];

      for (const testComment of testCases) {
        const job = {
          payload: {
            comment_id: 'comment-special',
            organization_id: 'org-123',
            platform: 'twitter',
            original_text: testComment,
            toxicity_score: 0.6
          }
        };

        const result = await worker.processJob(job);
        
        expect(result.success).toBe(true);
        expect(result.response.text).toBeDefined();
        // Should handle special characters without crashing
      }
    });

    test('should apply transparency disclaimers correctly', async () => {
      const worker = new GenerateReplyWorker();
      worker.supabase = mockSupabase;
      worker.costControl = global.mockCostControl;
      workers.push(worker);

      // Mock organization with transparency enabled
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'org-123',
                transparency_enabled: true,
                preferences: {
                  tone: 'sarcastic'
                }
              },
              error: null
            })
          }))
        }))
      });

      const job = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Test comment',
          toxicity_score: 0.7
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      // Should include transparency disclaimer
      expect(result.response.text).toMatch(/🤖|AI|bot|automated/i);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle OpenAI API failures gracefully', async () => {
      const worker = new GenerateReplyWorker();
      worker.supabase = mockSupabase;
      worker.costControl = global.mockCostControl;
      workers.push(worker);

      // Mock OpenAI failure
      worker.openaiClient = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('OpenAI API rate limit exceeded'))
          }
        }
      };

      const job = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Test comment',
          toxicity_score: 0.7
        }
      };

      const result = await worker.processJob(job);

      // Should fallback to template response
      expect(result.success).toBe(true);
      expect(result.response.templated).toBe(true);
      expect(result.response.text).toBeDefined();
    });

    test('should handle database connection failures', async () => {
      const worker = new GenerateReplyWorker();
      worker.costControl = global.mockCostControl;

      // Mock database failure
      worker.supabase = {
        from: jest.fn(() => {
          throw new Error('Database connection failed');
        })
      };
      workers.push(worker);

      const job = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Test comment',
          toxicity_score: 0.7
        }
      };

      // Should handle gracefully without crashing
      await expect(worker.processJob(job)).resolves.toBeDefined();
    });

    test('should handle malformed job data', async () => {
      const worker = new GenerateReplyWorker();
      worker.supabase = mockSupabase;
      worker.costControl = global.mockCostControl;
      workers.push(worker);

      const malformedJobs = [
        {}, // Empty job
        { payload: { comment_id: 'test' } }, // Missing required fields
        { payload: { comment_id: null, organization_id: 'org-123' } }, // Null values
        { payload: { comment_id: 'test', organization_id: 'org-123', original_text: '' } } // Empty text
      ];

      for (const job of malformedJobs) {
        const result = await worker.processJob(job);
        
        // Should handle gracefully
        expect(result).toBeDefined();
        if (result.success === false) {
          expect(result.error).toBeDefined();
        }
      }
    });
  });

  describe('Complete Pipeline Integration', () => {
    test('should process comment through entire pipeline', async () => {
      // Set up all workers
      const fetchWorker = new FetchCommentsWorker();
      const toxicityWorker = new AnalyzeToxicityWorker();
      const replyWorker = new GenerateReplyWorker();
      
      workers.push(fetchWorker, toxicityWorker, replyWorker);

      // Mock all external services
      fetchWorker.supabase = mockSupabase;
      fetchWorker.costControl = global.mockCostControl;
      toxicityWorker.supabase = mockSupabase;
      toxicityWorker.costControl = global.mockCostControl;
      replyWorker.supabase = mockSupabase;
      replyWorker.costControl = global.mockCostControl;

      // Mock Perspective API
      toxicityWorker.perspectiveClient = {
        comments: {
          analyze: jest.fn().mockResolvedValue({
            data: {
              attributeScores: {
                TOXICITY: { summaryScore: { value: 0.8 } },
                INSULT: { summaryScore: { value: 0.9 } }
              }
            }
          })
        }
      };

      // Mock OpenAI
      replyWorker.openaiClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'Your comment lacks the creativity of a broken calculator.'
                }
              }],
              usage: { total_tokens: 30 }
            })
          }
        }
      };

      // Step 1: Fetch comments
      const fetchJob = {
        organization_id: 'org-123',
        platform: 'twitter',
        integration_config_id: 'config-123',
        payload: { post_id: 'tweet-123' }
      };

      const fetchResult = await fetchWorker.processJob(fetchJob);
      expect(fetchResult.success).toBe(true);

      // Step 2: Analyze toxicity
      const toxicityJob = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        text: 'This app is garbage and the developers are idiots',
        author_id: 'user-toxic'
      };

      const toxicityResult = await toxicityWorker.processJob(toxicityJob);
      expect(toxicityResult.success).toBe(true);
      expect(toxicityResult.toxicity_score).toBeGreaterThan(0.5);

      // Step 3: Generate reply
      const replyJob = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: toxicityJob.text,
          toxicity_score: toxicityResult.toxicity_score,
          categories: toxicityResult.categories
        }
      };

      const replyResult = await replyWorker.processJob(replyJob);
      expect(replyResult.success).toBe(true);
      expect(replyResult.response.text).toBeDefined();
      expect(replyResult.response.text.length).toBeLessThanOrEqual(280);
    });

    test('should handle high-volume concurrent processing', async () => {
      const replyWorker = new GenerateReplyWorker();
      replyWorker.supabase = mockSupabase;
      replyWorker.costControl = global.mockCostControl;
      workers.push(replyWorker);

      // Mock OpenAI with variable response times
      replyWorker.openaiClient = {
        chat: {
          completions: {
            create: jest.fn().mockImplementation(() => 
              new Promise(resolve => {
                setTimeout(() => {
                  resolve({
                    choices: [{
                      message: {
                        content: `Roast response ${Math.random()}`
                      }
                    }],
                    usage: { total_tokens: 25 }
                  });
                }, Math.random() * 100); // Random delay 0-100ms
              })
            )
          }
        }
      };

      // Process 20 jobs concurrently
      const jobs = Array.from({ length: 20 }, (_, i) => ({
        payload: {
          comment_id: `comment-${i}`,
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: `Test comment ${i}`,
          toxicity_score: 0.6 + (i * 0.01)
        }
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        jobs.map(job => replyWorker.processJob(job))
      );
      const endTime = Date.now();

      // All jobs should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete within reasonable time (concurrent processing)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });
  });

  describe('UI State Management Validation', () => {
    test('should provide proper loading states via API', async () => {
      const response = await request(app)
        .post('/api/roast/preview')
        .send({
          text: 'Test comment for preview',
          platform: 'twitter'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('roast');
      expect(response.body).toHaveProperty('processingTime');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.processingTime).toBeGreaterThan(0);
    });

    test('should handle API errors with proper error responses', async () => {
      const response = await request(app)
        .post('/api/roast/preview')
        .send({
          // Missing required text field
          platform: 'twitter'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(false);
    });
  });
});
