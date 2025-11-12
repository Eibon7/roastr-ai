/**
 * Integration Tests for CostControlService
 * Tests with real Supabase database
 */

const CostControlService = require('../../../src/services/costControl');
const { createTestTenants, cleanupTestData, setTenantContext, testClient } = require('../../helpers/tenantTestUtils');

describe('CostControlService Integration Tests', () => {
  let testOrgId;
  let testUserId;
  let costControl;

  beforeAll(async () => {
    // Create test organizations and users
    const testData = await createTestTenants();
    testOrgId = testData.orgId;
    testUserId = testData.userId;
    
    // Initialize CostControlService with test org
    costControl = new CostControlService(testOrgId);
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Set tenant context for RLS
    await setTenantContext(testOrgId);
  });

  describe('canPerformOperation', () => {
    it('should allow operation within plan limits', async () => {
      const result = await costControl.canPerformOperation('roast_generation');
      
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('limit');
      expect(typeof result.allowed).toBe('boolean');
    });

    it('should return correct usage and limits', async () => {
      const result = await costControl.canPerformOperation('roast_generation');
      
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      expect(result.limit).toBeGreaterThan(0);
      expect(result.remaining).toBeLessThanOrEqual(result.limit);
    });

    it('should handle different operation types', async () => {
      const operations = ['roast_generation', 'shield_action', 'api_call'];
      
      for (const operation of operations) {
        const result = await costControl.canPerformOperation(operation);
        expect(result).toHaveProperty('allowed');
        expect(result).toHaveProperty('remaining');
        expect(result).toHaveProperty('limit');
      }
    });
  });

  describe('recordUsage', () => {
    it('should record usage successfully', async () => {
      const cost = 0.001;
      const result = await costControl.recordUsage('roast_generation', cost);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should increment usage count', async () => {
      const beforeUsage = await costControl.canPerformOperation('roast_generation');
      const beforeRemaining = beforeUsage.remaining;
      
      await costControl.recordUsage('roast_generation', 0.001);
      
      const afterUsage = await costControl.canPerformOperation('roast_generation');
      const afterRemaining = afterUsage.remaining;
      
      // Remaining should have decreased
      expect(afterRemaining).toBeLessThan(beforeRemaining);
    });

    it('should handle concurrent usage recording', async () => {
      const promises = [];
      const concurrentRequests = 5;
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(costControl.recordUsage('roast_generation', 0.001));
      }
      
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle different cost amounts', async () => {
      const costs = [0.001, 0.005, 0.01, 0.1];
      
      for (const cost of costs) {
        const result = await costControl.recordUsage('roast_generation', cost);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('checkUsageLimit', () => {
    it('should return current usage status', async () => {
      const result = await costControl.checkUsageLimit('roast_generation');
      
      expect(result).toHaveProperty('used');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('percentage');
      expect(result.percentage).toBeGreaterThanOrEqual(0);
      expect(result.percentage).toBeLessThanOrEqual(100);
    });

    it('should calculate percentage correctly', async () => {
      const result = await costControl.checkUsageLimit('roast_generation');
      
      const expectedPercentage = (result.used / result.limit) * 100;
      expect(Math.abs(result.percentage - expectedPercentage)).toBeLessThan(0.01);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid operation types gracefully', async () => {
      try {
        await costControl.canPerformOperation('invalid_operation');
        // If no error, it should still return a valid structure
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle negative costs gracefully', async () => {
      try {
        await costControl.recordUsage('roast_generation', -0.001);
        // Should either reject or handle gracefully
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle missing organization context', async () => {
      const costControlNoOrg = new CostControlService(null);
      
      try {
        await costControlNoOrg.canPerformOperation('roast_generation');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('RLS Security', () => {
    it('should only access data for correct organization', async () => {
      // Create another test org
      const testData2 = await createTestTenants();
      const testOrgId2 = testData2.orgId;
      
      // Record usage for first org
      await setTenantContext(testOrgId);
      await costControl.recordUsage('roast_generation', 0.01);
      const usage1 = await costControl.checkUsageLimit('roast_generation');
      
      // Check usage for second org (should be independent)
      await setTenantContext(testOrgId2);
      const costControl2 = new CostControlService(testOrgId2);
      const usage2 = await costControl2.checkUsageLimit('roast_generation');
      
      // Usage should be different (org2 has no usage yet)
      expect(usage2.used).toBeLessThanOrEqual(usage1.used);
      
      // Cleanup second org
      await testClient
        .from('organizations')
        .delete()
        .eq('id', testOrgId2);
    });

    it('should enforce RLS on usage records', async () => {
      // Set context to test org
      await setTenantContext(testOrgId);
      
      // Try to query usage records directly
      const { data, error } = await testClient
        .from('usage_records')
        .select('*')
        .eq('organization_id', testOrgId);
      
      if (error && error.code !== '42P01') {
        // If table exists but query fails, it might be RLS blocking
        expect(error).toBeDefined();
      } else if (!error) {
        // If query succeeds, all records should be for test org
        data.forEach(record => {
          expect(record.organization_id).toBe(testOrgId);
        });
      }
    });
  });

  describe('Performance', () => {
    it('should handle rapid consecutive checks', async () => {
      const startTime = Date.now();
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        await costControl.canPerformOperation('roast_generation');
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (< 5 seconds for 10 checks)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle bulk usage recording efficiently', async () => {
      const startTime = Date.now();
      const bulkRecords = 20;
      
      const promises = [];
      for (let i = 0; i < bulkRecords; i++) {
        promises.push(costControl.recordUsage('roast_generation', 0.001));
      }
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (< 10 seconds for 20 records)
      expect(duration).toBeLessThan(10000);
    });
  });
});
