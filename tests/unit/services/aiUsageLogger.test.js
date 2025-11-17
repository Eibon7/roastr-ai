/**
 * Tests for AI Usage Logger Service
 * Issue #858: Logging de tokens para prompt caching
 */

const aiUsageLogger = require('../../../src/services/aiUsageLogger');
const { supabaseServiceClient } = require('../../../src/config/database');

// Mock dependencies
jest.mock('../../../src/config/database', () => ({
  supabaseServiceClient: {
    from: jest.fn()
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

jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: false
  }
}));

describe('AIUsageLogger', () => {
  let mockSupabaseQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Supabase mock chain
    mockSupabaseQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis()
    };
    
    supabaseServiceClient.from.mockReturnValue(mockSupabaseQuery);
  });

  describe('logUsage', () => {
    test('should insert usage log to database', async () => {
      mockSupabaseQuery.insert.mockResolvedValue({ error: null });
      
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
      expect(mockSupabaseQuery.insert).toHaveBeenCalledWith([
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
      mockSupabaseQuery.insert.mockResolvedValue({ error: null });
      
      await aiUsageLogger.logUsage({
        userId: 'user-123',
        model: 'gpt-5.1',
        inputTokens: 20,
        outputTokens: 50,
        cachedTokens: 80
      });
      
      const insertCall = mockSupabaseQuery.insert.mock.calls[0][0][0];
      const totalInput = 20 + 80;
      const expectedRatio = 80 / totalInput;
      
      expect(insertCall.cache_hit_ratio).toBeCloseTo(expectedRatio, 4);
    });

    test('should handle zero cache hit ratio', async () => {
      mockSupabaseQuery.insert.mockResolvedValue({ error: null });
      
      await aiUsageLogger.logUsage({
        userId: 'user-123',
        model: 'gpt-5.1',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0
      });
      
      const insertCall = mockSupabaseQuery.insert.mock.calls[0][0][0];
      expect(insertCall.cache_hit_ratio).toBe(0);
    });

    test('should skip logging when userId is missing', async () => {
      await aiUsageLogger.logUsage({
        model: 'gpt-5.1',
        inputTokens: 100,
        outputTokens: 50
      });
      
      expect(mockSupabaseQuery.insert).not.toHaveBeenCalled();
    });

    test('should skip logging when model is missing', async () => {
      await aiUsageLogger.logUsage({
        userId: 'user-123',
        inputTokens: 100,
        outputTokens: 50
      });
      
      expect(mockSupabaseQuery.insert).not.toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockSupabaseQuery.insert.mockResolvedValue({ error: dbError });
      
      // Should not throw
      await expect(aiUsageLogger.logUsage({
        userId: 'user-123',
        model: 'gpt-5.1',
        inputTokens: 100,
        outputTokens: 50
      })).resolves.not.toThrow();
    });

    test('should include orgId when provided', async () => {
      mockSupabaseQuery.insert.mockResolvedValue({ error: null });
      
      await aiUsageLogger.logUsage({
        userId: 'user-123',
        orgId: 'org-456',
        model: 'gpt-5.1',
        inputTokens: 100,
        outputTokens: 50
      });
      
      const insertCall = mockSupabaseQuery.insert.mock.calls[0][0][0];
      expect(insertCall.org_id).toBe('org-456');
    });

    test('should default missing fields to null or 0', async () => {
      mockSupabaseQuery.insert.mockResolvedValue({ error: null });
      
      await aiUsageLogger.logUsage({
        userId: 'user-123',
        model: 'gpt-5.1'
      });
      
      const insertCall = mockSupabaseQuery.insert.mock.calls[0][0][0];
      expect(insertCall.input_tokens).toBe(0);
      expect(insertCall.output_tokens).toBe(0);
      expect(insertCall.input_cached_tokens).toBe(0);
      expect(insertCall.plan).toBeNull();
      expect(insertCall.endpoint).toBeNull();
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
      
      mockSupabaseQuery.select.mockReturnThis();
      mockSupabaseQuery.eq.mockReturnThis();
      mockSupabaseQuery.gte.mockReturnThis();
      mockSupabaseQuery.lte.mockReturnThis();
      mockSupabaseQuery.select.mockResolvedValue({ data: mockData, error: null });
      
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
          input_cached_tokens: 80
        },
        {
          input_tokens: 30,
          input_cached_tokens: 70
        }
      ];
      
      mockSupabaseQuery.select.mockResolvedValue({ data: mockData, error: null });
      
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
      
      mockSupabaseQuery.select.mockResolvedValue({ data: [], error: null });
      
      await aiUsageLogger.getUsageStats({
        userId: 'user-123',
        startDate,
        endDate
      });
      
      expect(mockSupabaseQuery.gte).toHaveBeenCalledWith('created_at', startDate.toISOString());
      expect(mockSupabaseQuery.lte).toHaveBeenCalledWith('created_at', endDate.toISOString());
    });

    test('should filter by organization', async () => {
      mockSupabaseQuery.select.mockResolvedValue({ data: [], error: null });
      
      await aiUsageLogger.getUsageStats({
        orgId: 'org-456'
      });
      
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('org_id', 'org-456');
    });

    test('should handle database errors', async () => {
      const dbError = new Error('Query failed');
      mockSupabaseQuery.select.mockResolvedValue({ data: null, error: dbError });
      
      const stats = await aiUsageLogger.getUsageStats({
        userId: 'user-123'
      });
      
      expect(stats.error).toBe('Query failed');
    });

    test('should group statistics by model, plan, and endpoint', async () => {
      const mockData = [
        { model: 'gpt-5.1', plan: 'pro', endpoint: 'roast', input_tokens: 100, output_tokens: 50 },
        { model: 'gpt-4o', plan: 'starter', endpoint: 'roast', input_tokens: 50, output_tokens: 25 },
        { model: 'gpt-5.1', plan: 'pro', endpoint: 'shield', input_tokens: 75, output_tokens: 30 }
      ];
      
      mockSupabaseQuery.select.mockResolvedValue({ data: mockData, error: null });
      
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
  });
});

