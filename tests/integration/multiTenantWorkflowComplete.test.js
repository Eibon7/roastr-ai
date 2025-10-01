/**
 * Comprehensive Multi-Tenant Workflow Integration Tests
 * 
 * Tests the complete end-to-end workflow for the multi-tenant system including:
 * - Organization-scoped data isolation
 * - Worker job processing pipeline
 * - Cost control and usage tracking
 * - Shield automated moderation
 * - Queue management across tenants
 * - Error handling and failover scenarios
 */

const request = require('supertest');
const app = require('../../src/index');
const { createClient } = require('@supabase/supabase-js');
const BaseWorker = require('../../src/workers/BaseWorker');
const AnalyzeToxicityWorker = require('../../src/workers/AnalyzeToxicityWorker');
const GenerateReplyWorker = require('../../src/workers/GenerateReplyWorker');
const ShieldActionWorker = require('../../src/workers/ShieldActionWorker');
const CostControlService = require('../../src/services/costControl');
const { auditLogger } = require('../../src/services/auditLogService');
const QueueService = require('../../src/services/queueService');

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('openai');
jest.mock('../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: true,
    generateMockSupabaseClient: jest.fn(),
    generateMockOpenAI: jest.fn()
  }
}));

describe('Multi-Tenant Workflow Integration', () => {
  let mockSupabaseClient;
  let orgAId = 'org-a-123';
  let orgBId = 'org-b-456';
  let testServer;
  let workers = [];

  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    
    testServer = app.listen(0); // Let OS assign port
  });

  afterAll(async () => {
    // Clean up workers
    await Promise.all(workers.map(worker => worker.stop()));
    
    if (testServer) {
      await new Promise(resolve => testServer.close(resolve));
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup comprehensive mock Supabase client
    mockSupabaseClient = createComprehensiveMockClient();
    createClient.mockReturnValue(mockSupabaseClient);
  });

  describe('Organization Data Isolation', () => {
    test('should maintain strict data isolation between organizations', async () => {
      // Setup data for two organizations
      setupOrganizationData(orgAId, 'Organization A', 'free');
      setupOrganizationData(orgBId, 'Organization B', 'pro');

      const costControlA = new CostControlService(orgAId);
      const costControlB = new CostControlService(orgBId);

      // Org A should only see their data
      const orgAUsage = await costControlA.getUsageStats(orgAId);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('usage_records');
      
      // Org B should only see their data  
      const orgBUsage = await costControlB.getUsageStats(orgBId);
      
      // Verify RLS is enforced through separate calls
      const fromCalls = mockSupabaseClient.from.mock.calls;
      expect(fromCalls.length).toBeGreaterThanOrEqual(2);
      expect(fromCalls.some(call => call[0] === 'organizations')).toBe(true);
    });

    test('should prevent cross-organization data access', async () => {
      const costControl = new CostControlService(orgAId);
      
      // Attempt to access org B data from org A context should be filtered by RLS
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null, // RLS prevents access
        error: null
      });

      const result = await costControl.getUsageStats(orgBId);
      expect(result.success).toBe(false);
    });
  });

  describe('Complete Worker Pipeline', () => {
    let queueService;

    beforeEach(async () => {
      queueService = new QueueService();
      await queueService.initialize();
    });

    afterEach(async () => {
      if (queueService) {
        await queueService.shutdown();
      }
    });

    test('should process complete toxicity detection and response pipeline', async () => {
      // Setup workers
      const toxicityWorker = new AnalyzeToxicityWorker();
      const replyWorker = new GenerateReplyWorker();
      const shieldWorker = new ShieldActionWorker();
      workers.push(toxicityWorker, replyWorker, shieldWorker);

      // Mock external services
      setupMockPerspectiveAPI(0.85, ['TOXICITY', 'INSULT']);
      setupMockOpenAI('Your comment lacks creativity. Try thinking before typing.');
      setupMockShieldService();

      // Start workers
      await Promise.all([
        toxicityWorker.start(),
        replyWorker.start(),
        shieldWorker.start()
      ]);

      // Simulate incoming toxic comment
      const toxicComment = {
        id: 'comment-toxic-1',
        organization_id: orgAId,
        platform: 'twitter',
        author_id: 'toxic-user-123',
        text: 'This post is absolutely terrible and stupid',
        external_id: 'tweet-123456'
      };

      // Add initial job to analyze toxicity
      await queueService.addJob('analyze_toxicity', {
        organization_id: orgAId,
        platform: 'twitter',
        comment_id: 'comment-toxic-1',
        text: toxicComment.text,
        author_id: toxicComment.author_id
      });

      // Wait for processing pipeline
      await waitForJobsToProcess(5000);

      // Verify pipeline execution
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('comments');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('roasts');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('usage_records');

      // Verify cost control was checked
      const costControlCalls = mockSupabaseClient.from.mock.calls.filter(
        call => call[0] === 'organizations'
      );
      expect(costControlCalls.length).toBeGreaterThan(0);
    });

    test('should handle Shield automated moderation with priority', async () => {
      const shieldWorker = new ShieldActionWorker();
      workers.push(shieldWorker);
      
      await shieldWorker.start();

      // Setup high-severity user requiring immediate action
      setupMockUserWithViolations('toxic-user-456', 3, 'high');

      // Add shield action job with priority
      await queueService.addJob('shield_action', {
        organization_id: orgAId,
        platform: 'twitter',
        user_id: 'toxic-user-456',
        action: 'mute',
        reason: 'Repeated high-toxicity violations',
        severity: 'high'
      }, 1); // Priority 1 for shield actions

      await waitForJobsToProcess(2000);

      // Verify action was logged
      expect(auditLogger.logSystemEvent).toHaveBeenCalledWith(
        'shield_action_executed',
        expect.objectContaining({
          platform: 'twitter',
          userId: 'toxic-user-456',
          action: 'mute'
        })
      );
    });
  });

  describe('Cost Control and Plan Enforcement', () => {
    test('should enforce plan limits across organizations', async () => {
      // Setup org A with free plan (100 responses limit)
      setupOrganizationWithUsage(orgAId, 'free', 95, 100);
      
      // Setup org B with pro plan (1000 responses limit)  
      setupOrganizationWithUsage(orgBId, 'pro', 500, 1000);

      const costControlA = new CostControlService(orgAId);
      const costControlB = new CostControlService(orgBId);

      // Org A should be near limit
      const canPerformA = await costControlA.canPerformOperation(orgAId);
      expect(canPerformA.allowed).toBe(true);
      expect(canPerformA.percentage).toBe(95);

      // Org B should have plenty of capacity
      const canPerformB = await costControlB.canPerformOperation(orgBId);
      expect(canPerformB.allowed).toBe(true);
      expect(canPerformB.percentage).toBe(50);
    });

    test('should block operations when plan limits exceeded', async () => {
      setupOrganizationWithUsage(orgAId, 'free', 105, 100); // Over limit

      const costControl = new CostControlService(orgAId);
      const canPerform = await costControl.canPerformOperation(orgAId);

      expect(canPerform.allowed).toBe(false);
      expect(canPerform.reason).toBe('monthly_limit_exceeded');
    });

    test('should track usage accurately per organization', async () => {
      const costControl = new CostControlService(orgAId);

      // Record several operations
      await costControl.recordUsage(orgAId, 'twitter', 'analyze_toxicity', { tokensUsed: 10 });
      await costControl.recordUsage(orgAId, 'twitter', 'generate_reply', { tokensUsed: 25 });
      await costControl.recordUsage(orgAId, 'youtube', 'generate_reply', { tokensUsed: 30 });

      // Verify usage was recorded with correct organization scoping
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('usage_records');
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: orgAId,
          platform: 'twitter',
          action_type: 'analyze_toxicity'
        })
      );
    });
  });

  describe('Queue Management and Job Priority', () => {
    test('should handle job priorities correctly', async () => {
      const queueService = new QueueService();
      await queueService.initialize();

      // Add jobs with different priorities
      await queueService.addJob('generate_reply', { org: orgAId }, 4); // Normal priority
      await queueService.addJob('shield_action', { org: orgAId }, 1); // High priority
      await queueService.addJob('fetch_comments', { org: orgAId }, 5); // Low priority

      // Shield action should be processed first due to priority
      const highPriorityJob = await queueService.getNextJob('shield_action');
      expect(highPriorityJob).toBeDefined();
      expect(highPriorityJob.priority).toBe(1);

      await queueService.shutdown();
    });

    test('should maintain queue isolation between organizations', async () => {
      const queueService = new QueueService();
      await queueService.initialize();

      // Add jobs for different organizations
      await queueService.addJob('analyze_toxicity', { 
        organization_id: orgAId, 
        comment: 'Org A comment' 
      });
      await queueService.addJob('analyze_toxicity', { 
        organization_id: orgBId, 
        comment: 'Org B comment' 
      });

      // Each organization should only process their own jobs
      const jobA = await queueService.getNextJob('analyze_toxicity', { organizationId: orgAId });
      expect(jobA.organization_id).toBe(orgAId);

      const jobB = await queueService.getNextJob('analyze_toxicity', { organizationId: orgBId });
      expect(jobB.organization_id).toBe(orgBId);

      await queueService.shutdown();
    });
  });

  describe('Error Handling and Failover', () => {
    test('should handle database connection failures gracefully', async () => {
      // Mock database failure
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      const costControl = new CostControlService(orgAId);
      
      // Should not crash the application
      const result = await costControl.canPerformOperation(orgAId).catch(err => ({
        error: err.message
      }));
      
      expect(result.error).toContain('Database connection lost');
    });

    test('should fallback to file-based audit logging when database unavailable', async () => {
      // Mock database failure for audit logs
      mockSupabaseClient.from().insert.mockReturnValue({
        error: { message: 'Connection timeout' }
      });

      // Should fallback to file logging
      const result = await auditLogger.logEvent('auth.login', {
        userId: 'user-123',
        ipAddress: '192.168.1.1'
      });

      expect(result).toBe(true); // Should succeed with file fallback
    });

    test('should handle worker failures and restarts', async () => {
      const worker = new AnalyzeToxicityWorker({
        maxRetries: 2,
        retryDelay: 100
      });
      workers.push(worker);

      // Mock job that fails initially then succeeds
      let attempt = 0;
      worker.processJob = jest.fn().mockImplementation(() => {
        attempt++;
        if (attempt < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true, result: 'recovered' };
      });

      let result;
      try {
        await worker.start();

        // Simulate job processing
        const testJob = {
          id: 'failing-job',
          organization_id: orgAId,
          text: 'test comment'
        };

        // Should eventually succeed after retries
        result = await worker.processJobAsync(testJob);
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }
      
      expect(worker.processJob).toHaveBeenCalledTimes(3);
      expect(worker.processedJobs).toBe(1);
    });
  });

  describe('Multi-Platform Integration', () => {
    test('should handle comments from multiple platforms per organization', async () => {
      const platforms = ['twitter', 'youtube', 'instagram', 'facebook'];
      const queueService = new QueueService();
      await queueService.initialize();

      // Add jobs for each platform
      for (const platform of platforms) {
        await queueService.addJob('analyze_toxicity', {
          organization_id: orgAId,
          platform,
          comment_id: `${platform}-comment-1`,
          text: `Test comment from ${platform}`
        });
      }

      const toxicityWorker = new AnalyzeToxicityWorker();
      workers.push(toxicityWorker);
      
      // Mock successful processing
      toxicityWorker.processJob = jest.fn().mockResolvedValue({
        success: true,
        toxicityScore: 0.3,
        platform: expect.any(String)
      });

      await toxicityWorker.start();
      await waitForJobsToProcess(3000);

      // Should have processed jobs from all platforms
      expect(toxicityWorker.processJob).toHaveBeenCalledTimes(platforms.length);
      
      // Verify platform-specific processing
      const processedPlatforms = toxicityWorker.processJob.mock.calls.map(
        call => call[0].platform
      );
      platforms.forEach(platform => {
        expect(processedPlatforms).toContain(platform);
      });

      await queueService.shutdown();
    });
  });

  describe('Audit and Compliance', () => {
    test('should maintain comprehensive audit trail', async () => {
      const auditEvents = [];
      
      // Mock audit logging to capture events
      auditLogger.logEvent = jest.fn().mockImplementation((eventType, details) => {
        auditEvents.push({ eventType, details });
        return Promise.resolve(true);
      });

      // Simulate various system events
      await auditLogger.logUserLogin('user-123', '192.168.1.1', 'Chrome');
      await auditLogger.logBillingEvent('subscription_updated', { 
        organizationId: orgAId,
        newPlan: 'pro'
      });
      await auditLogger.logIntegrationEvent('connect', 'user-123', 'twitter', {
        accountId: '@testuser'
      });
      await auditLogger.logSystemEvent('api_error', {
        endpoint: '/api/roasts',
        statusCode: 500
      });

      expect(auditEvents).toHaveLength(4);
      expect(auditEvents.some(e => e.eventType === 'auth.login')).toBe(true);
      expect(auditEvents.some(e => e.eventType === 'billing.subscription_updated')).toBe(true);
      expect(auditEvents.some(e => e.eventType === 'integrations.connect')).toBe(true);
      expect(auditEvents.some(e => e.eventType === 'system.api_error')).toBe(true);
    });
  });

  // Helper functions
  function createComprehensiveMockClient() {
    const mockData = new Map();
    
    return {
      from: jest.fn((table) => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({
                data: mockData.get(`${table}_single`),
                error: null
              })),
              limit: jest.fn(() => ({
                data: mockData.get(`${table}_list`) || [],
                error: null
              }))
            })),
            single: jest.fn(() => ({
              data: mockData.get(`${table}_single`),
              error: null
            })),
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                data: mockData.get(`${table}_ordered`) || [],
                error: null
              }))
            }))
          })),
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              data: mockData.get(`${table}_ordered`) || [],
              error: null
            }))
          })),
          limit: jest.fn(() => ({
            data: mockData.get(`${table}_list`) || [],
            error: null
          }))
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: { id: `${table}-${Date.now()}` },
              error: null
            }))
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({
                data: { updated: true },
                error: null
              }))
            }))
          }))
        })),
        rpc: jest.fn(() => ({ error: null }))
      })),
      rpc: jest.fn(() => ({ error: null }))
    };
  }

  function setupOrganizationData(orgId, orgName, planId) {
    const mockData = mockSupabaseClient.from().select().eq().single();
    mockData.mockResolvedValue({
      data: {
        id: orgId,
        name: orgName,
        plan_id: planId,
        monthly_responses_limit: planId === 'free' ? 100 : 1000,
        monthly_responses_used: 0,
        created_at: new Date().toISOString()
      },
      error: null
    });
  }

  function setupOrganizationWithUsage(orgId, planId, used, limit) {
    const mockData = mockSupabaseClient.from().select().eq().single();
    mockData.mockResolvedValue({
      data: {
        id: orgId,
        plan_id: planId,
        monthly_responses_limit: limit,
        monthly_responses_used: used
      },
      error: null
    });
  }

  function setupMockPerspectiveAPI(score, categories) {
    // Mock Perspective API response
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY: { summaryScore: { value: score } },
          SEVERE_TOXICITY: { summaryScore: { value: score * 0.8 } },
          IDENTITY_ATTACK: { summaryScore: { value: score * 0.6 } },
          INSULT: { summaryScore: { value: score * 0.7 } },
          PROFANITY: { summaryScore: { value: score * 0.5 } },
          THREAT: { summaryScore: { value: score * 0.3 } }
        }
      })
    });
  }

  function setupMockOpenAI(responseText) {
    const OpenAI = require('openai');
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: responseText
                }
              }
            ],
            usage: {
              total_tokens: 25
            }
          })
        }
      }
    }));
  }

  function setupMockShieldService() {
    // Mock Shield service responses
    jest.doMock('../../src/services/shieldService', () => ({
      shouldTakeAction: jest.fn().mockResolvedValue({
        action: 'mute',
        reason: 'High toxicity threshold exceeded',
        confidence: 0.9
      }),
      executeAction: jest.fn().mockResolvedValue({
        success: true,
        actionTaken: 'mute',
        timestamp: new Date().toISOString()
      })
    }));
  }

  function setupMockUserWithViolations(userId, violationCount, severity) {
    const mockUserData = {
      id: userId,
      platform_user_id: userId,
      violation_count: violationCount,
      last_violation_severity: severity,
      last_violation_date: new Date().toISOString()
    };

    mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
      data: mockUserData,
      error: null
    });
  }

  async function waitForJobsToProcess(timeoutMs) {
    return new Promise(resolve => {
      setTimeout(resolve, timeoutMs);
    });
  }
});