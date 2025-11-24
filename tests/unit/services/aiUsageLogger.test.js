/**
 * Tests for AI Usage Logger Service
 * Issue #858: Logging de tokens para prompt caching
 */

// Setup test environment
process.env.NODE_ENV = 'test';
process.env.LOG_AI_USAGE = 'true';

// Mock queueService to prevent initialization errors
jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    enqueue: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getNextJob: jest.fn().mockResolvedValue(null),
    completeJob: jest.fn().mockResolvedValue(),
    failJob: jest.fn().mockResolvedValue(),
    shutdown: jest.fn().mockResolvedValue(),
    log: jest.fn()
  }));
});

// Mock advancedLogger to prevent queueLogger errors
jest.mock('../../../src/utils/advancedLogger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  auditEvent: jest.fn(),
  queueLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  },
  workerLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock alertingService to prevent setup issues
jest.mock('../../../src/services/alertingService', () => ({
  shutdown: jest.fn()
}));

// Create mock Supabase query builder
const createMockQueryBuilder = (defaultData = [], defaultError = null) => {
  let resolveData = defaultData;
  let resolveError = defaultError;
  
  const builder = {
    insert: jest.fn(() => Promise.resolve({ data: resolveData, error: resolveError })),
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    // Make the builder thenable for async/await
    then: jest.fn((resolve) => {
      return Promise.resolve({ data: resolveData, error: resolveError }).then(resolve);
    }),
    catch: jest.fn((reject) => Promise.resolve().catch(reject)),
    // Allow setting return data for tests
    _setData: (data) => { resolveData = data; },
    _setError: (error) => { resolveError = error; }
  };
  
  return builder;
};

let mockQueryBuilder = createMockQueryBuilder();

// Mock Supabase client
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn(() => mockQueryBuilder)
  }
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock mockMode to enable logging in tests
jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: false // Enable actual logging for tests
  }
}));

// Import after mocks are set up
const aiUsageLogger = require('../../../src/services/aiUsageLogger');
const { supabaseServiceClient } = require('../../../src/config/supabase');

describe('AIUsageLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the query builder for each test
    mockQueryBuilder = createMockQueryBuilder();
    supabaseServiceClient.from.mockReturnValue(mockQueryBuilder);
    // Ensure logger is enabled
    aiUsageLogger.enabled = true;
  });

  describe('logUsage', () => {
    test('should insert usage log to database', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: null });

      await aiUsageLogger.logUsage({
        userId: 'user-123',
        model: 'gpt-5.1',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 80,
        plan: 'pro',
        endpoint: 'roast'
      });

      expect(supabaseServiceClient.from).toHaveBeenCalledWith('ai_usage_logs');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          user_id: 'user-123',
          model: 'gpt-5.1',
          input_tokens: 100,
          output_tokens: 50,
          input_cached_tokens: 80,
          plan: 'pro',
          endpoint: 'roast'
        })
      ]);
    });

    test('should calculate cache hit ratio correctly', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: null });

      await aiUsageLogger.logUsage({
        userId: 'user-123',
        model: 'gpt-5.1',
        inputTokens: 20,
        outputTokens: 50,
        cachedTokens: 80
      });

      const insertCall = mockQueryBuilder.insert.mock.calls[0][0][0];
      const totalInput = 20 + 80;
      const expectedRatio = 80 / totalInput;

      expect(insertCall.cache_hit_ratio).toBeCloseTo(expectedRatio, 4);
    });

    test('should handle zero cache hit ratio', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: null });

      await aiUsageLogger.logUsage({
        userId: 'user-123',
        model: 'gpt-5.1',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0
      });

      const insertCall = mockQueryBuilder.insert.mock.calls[0][0][0];
      expect(insertCall.cache_hit_ratio).toBe(0);
    });

    test('should skip logging when userId is missing', async () => {
      await aiUsageLogger.logUsage({
        model: 'gpt-5.1',
        inputTokens: 100,
        outputTokens: 50
      });

      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });

    test('should skip logging when model is missing', async () => {
      await aiUsageLogger.logUsage({
        userId: 'user-123',
        inputTokens: 100,
        outputTokens: 50
      });

      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockQueryBuilder.insert.mockResolvedValue({ error: dbError });

      // Should not throw
      await expect(
        aiUsageLogger.logUsage({
          userId: 'user-123',
          model: 'gpt-5.1',
          inputTokens: 100,
          outputTokens: 50
        })
      ).resolves.not.toThrow();
    });

    test('should include orgId when provided', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: null });

      await aiUsageLogger.logUsage({
        userId: 'user-123',
        orgId: 'org-456',
        model: 'gpt-5.1',
        inputTokens: 100,
        outputTokens: 50
      });

      const insertCall = mockQueryBuilder.insert.mock.calls[0][0][0];
      expect(insertCall.org_id).toBe('org-456');
    });

    test('should default missing fields to null or 0', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: null });

      await aiUsageLogger.logUsage({
        userId: 'user-123',
        model: 'gpt-5.1'
      });

      const insertCall = mockQueryBuilder.insert.mock.calls[0][0][0];
      expect(insertCall.input_tokens).toBe(0);
      expect(insertCall.output_tokens).toBe(0);
      expect(insertCall.input_cached_tokens).toBe(0);
      expect(insertCall.plan).toBeNull();
      expect(insertCall.endpoint).toBeNull();
    });

    test('should skip logging when disabled', async () => {
      aiUsageLogger.enabled = false;

      await aiUsageLogger.logUsage({
        userId: 'user-123',
        model: 'gpt-5.1',
        inputTokens: 100
      });

      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
      
      // Re-enable for other tests
      aiUsageLogger.enabled = true;
    });
  });

  describe('getUsageStats', () => {
    test('should return usage statistics for user', async () => {
      const mockData = [
        {
          model: 'gpt-5.1',
          input_tokens: 100,
          output_tokens: 50,
          input_cached_tokens: 80,
          plan: 'pro',
          endpoint: 'roast'
        },
        {
          model: 'gpt-5.1',
          input_tokens: 50,
          output_tokens: 25,
          input_cached_tokens: 40,
          plan: 'pro',
          endpoint: 'roast'
        }
      ];

      // Create a new query builder that returns the mock data
      const queryBuilder = createMockQueryBuilder(mockData, null);
      supabaseServiceClient.from.mockReturnValue(queryBuilder);

      const stats = await aiUsageLogger.getUsageStats({
        userId: 'user-123'
      });

      expect(stats.totalRequests).toBe(2);
      expect(stats.totalInputTokens).toBe(150);
      expect(stats.totalOutputTokens).toBe(75);
      expect(stats.totalCachedTokens).toBe(120);
      expect(stats.byModel['gpt-5.1'].requests).toBe(2);
      expect(stats.byPlan['pro'].requests).toBe(2);
    });

    test('should calculate average cache hit ratio', async () => {
      const mockData = [
        {
          input_tokens: 20,
          input_cached_tokens: 80,
          model: 'gpt-5.1',
          output_tokens: 0,
          plan: 'pro',
          endpoint: 'test'
        },
        {
          input_tokens: 30,
          input_cached_tokens: 70,
          model: 'gpt-5.1',
          output_tokens: 0,
          plan: 'pro',
          endpoint: 'test'
        }
      ];

      const queryBuilder = createMockQueryBuilder(mockData, null);
      supabaseServiceClient.from.mockReturnValue(queryBuilder);

      const stats = await aiUsageLogger.getUsageStats({
        userId: 'user-123'
      });

      // Total input: 20 + 30 = 50
      // Total cached: 80 + 70 = 150
      // Total with cache: 50 + 150 = 200
      // Ratio: 150 / 200 = 0.75
      expect(stats.averageCacheHitRatio).toBeCloseTo(0.75, 2);
    });

    test('should filter by date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const queryBuilder = createMockQueryBuilder([], null);
      supabaseServiceClient.from.mockReturnValue(queryBuilder);

      await aiUsageLogger.getUsageStats({
        userId: 'user-123',
        startDate,
        endDate
      });

      expect(queryBuilder.gte).toHaveBeenCalledWith('created_at', startDate.toISOString());
      expect(queryBuilder.lte).toHaveBeenCalledWith('created_at', endDate.toISOString());
    });

    test('should filter by organization', async () => {
      const queryBuilder = createMockQueryBuilder([], null);
      supabaseServiceClient.from.mockReturnValue(queryBuilder);

      await aiUsageLogger.getUsageStats({
        orgId: 'org-456'
      });

      expect(queryBuilder.eq).toHaveBeenCalledWith('org_id', 'org-456');
    });

    test('should handle database errors', async () => {
      const dbError = { message: 'Query failed' };

      const queryBuilder = createMockQueryBuilder(null, dbError);
      supabaseServiceClient.from.mockReturnValue(queryBuilder);

      const stats = await aiUsageLogger.getUsageStats({
        userId: 'user-123'
      });

      expect(stats.error).toBe('Query failed');
    });

    test('should group statistics by model, plan, and endpoint', async () => {
      const mockData = [
        { model: 'gpt-5.1', plan: 'pro', endpoint: 'roast', input_tokens: 100, output_tokens: 50, input_cached_tokens: 0 },
        { model: 'gpt-4o', plan: 'starter', endpoint: 'roast', input_tokens: 50, output_tokens: 25, input_cached_tokens: 0 },
        { model: 'gpt-5.1', plan: 'pro', endpoint: 'shield', input_tokens: 75, output_tokens: 30, input_cached_tokens: 0 }
      ];

      const queryBuilder = createMockQueryBuilder(mockData, null);
      supabaseServiceClient.from.mockReturnValue(queryBuilder);

      const stats = await aiUsageLogger.getUsageStats({
        userId: 'user-123'
      });

      expect(stats.byModel['gpt-5.1'].requests).toBe(2);
      expect(stats.byModel['gpt-4o'].requests).toBe(1);
      expect(stats.byPlan['pro'].requests).toBe(2);
      expect(stats.byPlan['starter'].requests).toBe(1);
      expect(stats.byEndpoint['roast'].requests).toBe(2);
      expect(stats.byEndpoint['shield'].requests).toBe(1);
    });

    test('should return disabled status when logger is disabled', async () => {
      aiUsageLogger.enabled = false;

      const stats = await aiUsageLogger.getUsageStats({
        userId: 'user-123'
      });

      expect(stats.enabled).toBe(false);
      
      // Re-enable for other tests
      aiUsageLogger.enabled = true;
    });

    test('should handle empty results', async () => {
      const queryBuilder = createMockQueryBuilder([], null);
      supabaseServiceClient.from.mockReturnValue(queryBuilder);

      const stats = await aiUsageLogger.getUsageStats({
        userId: 'user-123'
      });

      expect(stats.totalRequests).toBe(0);
      expect(stats.totalInputTokens).toBe(0);
      expect(stats.totalOutputTokens).toBe(0);
      expect(stats.totalCachedTokens).toBe(0);
      expect(stats.averageCacheHitRatio).toBe(0);
    });

    test('should handle unknown model/plan/endpoint', async () => {
      const mockData = [
        { input_tokens: 100, output_tokens: 50, input_cached_tokens: 0 }
        // model, plan, endpoint are undefined
      ];

      const queryBuilder = createMockQueryBuilder(mockData, null);
      supabaseServiceClient.from.mockReturnValue(queryBuilder);

      const stats = await aiUsageLogger.getUsageStats({
        userId: 'user-123'
      });

      expect(stats.byModel['unknown'].requests).toBe(1);
      expect(stats.byPlan['unknown'].requests).toBe(1);
      expect(stats.byEndpoint['unknown'].requests).toBe(1);
    });
  });
});
