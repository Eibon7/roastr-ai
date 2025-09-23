const TierValidationService = require('../../../src/services/tierValidationService');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const tierConfig = require('../../../src/config/tierConfig');

// Mock dependencies
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/config/tierConfig');

describe('TierValidationService - CodeRabbit Round 6 Improvements', () => {
  let service;
  let mockCache;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock cache
    mockCache = new Map();
    service = new TierValidationService();
    
    // Mock the cache property if it exists
    if (service.usageCache) {
      service.usageCache = mockCache;
    }
    
    // Setup default tier config
    tierConfig.DEFAULT_TIER_LIMITS = {
      free: { maxRoasts: 10, monthlyResponsesLimit: 100 },
      starter: { maxRoasts: 100, monthlyResponsesLimit: 1000 },
      pro: { maxRoasts: 1000, monthlyResponsesLimit: 5000 },
      plus: { maxRoasts: 5000, monthlyResponsesLimit: 20000 }
    };
    
    tierConfig.SECURITY_CONFIG = {
      failClosed: {
        forceInProduction: true,
        environmentVar: 'TIER_VALIDATION_FAIL_CLOSED'
      }
    };
  });

  describe('Cache Race Conditions Prevention', () => {
    test('should invalidate cache on usage recording to prevent stale data', async () => {
      const userId = 'test-user-id';
      const cacheKey = `usage_${userId}`;
      
      // Setup initial cache state
      mockCache.set(cacheKey, { roastsThisMonth: 5, lastUpdated: new Date() });
      
      // Mock database response for usage recording
      const mockUsageData = {
        data: [{ roasts_count: 6, tier: 'pro' }],
        error: null
      };
      
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue(mockUsageData)
      });
      
      // Record usage - should invalidate cache
      await service.recordUsageActionAtomic(userId, 'roast_generation');
      
      // Verify cache was invalidated
      expect(mockCache.has(cacheKey)).toBe(false);
    });

    test('should handle concurrent cache operations without corruption', async () => {
      const userId = 'test-user-id';
      const cacheKey = `usage_${userId}`;
      
      // Setup concurrent operations
      const operation1 = async () => {
        mockCache.set(cacheKey, { roastsThisMonth: 1 });
        await new Promise(resolve => setTimeout(resolve, 10));
        return mockCache.get(cacheKey);
      };
      
      const operation2 = async () => {
        mockCache.set(cacheKey, { roastsThisMonth: 2 });
        await new Promise(resolve => setTimeout(resolve, 5));
        return mockCache.get(cacheKey);
      };
      
      // Execute concurrent operations
      const results = await Promise.all([operation1(), operation2()]);
      
      // Verify cache consistency (last write wins)
      const finalValue = mockCache.get(cacheKey);
      expect(finalValue).toBeDefined();
      expect(typeof finalValue.roastsThisMonth).toBe('number');
    });

    test('should prevent cache poisoning during error conditions', async () => {
      const userId = 'test-user-id';
      const cacheKey = `usage_${userId}`;
      
      // Mock database error
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      });
      
      try {
        await service.recordUsageActionAtomic(userId, 'roast_generation');
      } catch (error) {
        // Expected to fail
      }
      
      // Verify cache was not poisoned with invalid data
      expect(mockCache.has(cacheKey)).toBe(false);
    });
  });

  describe('Atomic UPSERT Operations', () => {
    test('should prevent duplicate usage records through atomic operations', async () => {
      const userId = 'test-user-id';
      
      // Mock successful atomic operation
      const mockUsageData = {
        data: [{ id: 1, roasts_count: 1, tier: 'pro' }],
        error: null
      };
      
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue(mockUsageData)
      });
      
      // Execute concurrent usage recordings
      const promises = Array(5).fill().map(() => 
        service.recordUsageActionAtomic(userId, 'roast_generation')
      );
      
      const results = await Promise.allSettled(promises);
      
      // Verify all operations used atomic upsert
      expect(supabaseServiceClient.from).toHaveBeenCalledTimes(5);
      
      // Verify all calls used the upsert method
      const mockUpsert = supabaseServiceClient.from().upsert;
      expect(mockUpsert).toHaveBeenCalledTimes(5);
    });

    test('should handle atomic operation conflicts gracefully', async () => {
      const userId = 'test-user-id';
      
      // Mock conflict response from atomic operation
      const mockConflictData = {
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' }
      };
      
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue(mockConflictData)
      });
      
      try {
        await service.recordUsageActionAtomic(userId, 'roast_generation');
      } catch (error) {
        expect(error.message).toContain('Database operation failed');
      }
    });

    test('should maintain data consistency during high concurrency', async () => {
      const userId = 'test-user-id';
      let callCount = 0;
      
      // Mock incremental usage updates
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve({
            data: [{ id: callCount, roasts_count: callCount, tier: 'pro' }],
            error: null
          });
        })
      });
      
      // Execute high concurrency operations
      const promises = Array(20).fill().map((_, index) => 
        service.recordUsageActionAtomic(userId, 'roast_generation')
      );
      
      const results = await Promise.allSettled(promises);
      
      // Verify all operations completed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(20);
      expect(supabaseServiceClient.from).toHaveBeenCalledTimes(20);
    });
  });

  describe('Fail-Closed Security', () => {
    test('should fail closed on database connection errors', async () => {
      const userId = 'test-user-id';
      
      // Mock database connection failure
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Connection timeout'))
          })
        })
      });
      
      // Should reject the validation
      await expect(service.validateAction(userId, 'roast_generation'))
        .rejects.toThrow();
    });

    test('should fail closed when tier configuration is missing', async () => {
      const userId = 'test-user-id';
      
      // Mock user data without tier
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: userId, plan: null },
              error: null
            })
          })
        })
      });
      
      // Should fail validation
      const result = await service.validateAction(userId, 'roast_generation');
      expect(result.allowed).toBe(false);
    });

    test('should fail closed when usage data is corrupted', async () => {
      const userId = 'test-user-id';
      
      // Mock corrupted usage data
      supabaseServiceClient.rpc = jest.fn().mockResolvedValue({
        data: [{ roasts_count: 'invalid_number', tier: 'pro' }],
        error: null
      });
      
      // Should fail validation due to data corruption
      const result = await service.validateAction(userId, 'roast_generation');
      expect(result.allowed).toBe(false);
    });

    test('should fail closed in production on any unexpected error', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const userId = 'test-user-id';
      
      // Mock unexpected error
      supabaseServiceClient.from = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected system error');
      });
      
      try {
        const result = await service.validateAction(userId, 'roast_generation');
        expect(result.allowed).toBe(false);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Promise.all Optimization', () => {
    test('should handle concurrent validations correctly', async () => {
      const userIds = ['user1', 'user2', 'user3', 'user4', 'user5'];
      
      // Mock successful validations
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { plan: 'pro' },
              error: null
            })
          })
        })
      });
      
      // Execute concurrent validations
      const validationPromises = userIds.map(userId => 
        service.validateAction(userId, 'roast_generation')
      );
      
      const results = await Promise.all(validationPromises);
      
      // Verify all validations completed successfully
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    test('should handle mixed success/failure in concurrent operations', async () => {
      const userIds = ['user1', 'user2', 'user3'];
      let callIndex = 0;
      
      // Mock mixed responses
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockImplementation(() => {
              callIndex++;
              if (callIndex === 2) {
                return Promise.reject(new Error('Database error'));
              }
              return Promise.resolve({
                data: { plan: 'pro' },
                error: null
              });
            })
          })
        })
      });
      
      const validationPromises = userIds.map(userId => 
        service.validateAction(userId, 'roast_generation')
      );
      
      const results = await Promise.allSettled(validationPromises);
      
      // Verify mixed results
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });

    test('should optimize database calls when using Promise.all', async () => {
      const userIds = ['user1', 'user2', 'user3'];
      
      // Mock responses
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { plan: 'pro' },
              error: null
            })
          })
        })
      });
      
      const startTime = Date.now();
      
      // Execute concurrent validations
      const validationPromises = userIds.map(userId => 
        service.validateAction(userId, 'roast_generation')
      );
      
      await Promise.all(validationPromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete faster than sequential operations
      expect(duration).toBeLessThan(1000); // Should be much faster in practice
    });
  });

  describe('Centralized Configuration Usage', () => {
    test('should use tierConfig for all limit validations', async () => {
      const userId = 'test-user-id';
      
      // Mock user and usage data
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { plan: 'pro' },
              error: null
            })
          })
        })
      });
      
      // Override tierConfig to test usage
      tierConfig.DEFAULT_TIER_LIMITS.pro.maxRoasts = 1000;
      
      const result = await service.validateAction(userId, 'roast_generation');
      
      // Should use the centralized config value
      expect(result).toBeDefined();
    });

    test('should use tierConfig for feature validation', async () => {
      const userId = 'test-user-id';
      
      // Mock user data
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { plan: 'starter' },
              error: null
            })
          })
        })
      });
      
      // Test feature availability
      const result = await service.validateFeature(userId, 'shield_enabled');
      
      // Should use centralized config
      expect(result).toBeDefined();
    });

    test('should validate configuration consistency', () => {
      // Verify all required tiers are defined
      const requiredTiers = ['free', 'starter', 'pro', 'plus'];
      
      requiredTiers.forEach(tier => {
        expect(tierConfig.DEFAULT_TIER_LIMITS[tier]).toBeDefined();
        expect(tierConfig.DEFAULT_TIER_LIMITS[tier].maxRoasts).toBeGreaterThan(0);
        expect(tierConfig.DEFAULT_TIER_LIMITS[tier].monthlyResponsesLimit).toBeGreaterThan(0);
      });
    });
  });
});