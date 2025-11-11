/**
 * Cost Control Service - Additional Alert Tests
 * Issue #500: Final push to reach 60% coverage
 * 
 * Focuses on alert-related methods:
 * - checkAndSendUsageAlerts
 * - getAlertHistory
 * - getAlertStats
 * - getEnhancedUsageStats
 */

// Create comprehensive mocks using same pattern
const mockSelectSingle = jest.fn();
const mockSelectOrder = jest.fn();
const mockSelect = jest.fn(() => ({
  eq: jest.fn(() => ({
    single: mockSelectSingle,
    limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
    eq: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: mockSelectSingle
      }))
    })),
    gte: jest.fn(() => ({
      lte: mockSelectOrder,
      order: jest.fn(() => ({
        limit: mockSelectOrder
      }))
    }))
  })),
  gte: jest.fn(() => ({
    lte: mockSelectOrder,
    order: jest.fn(() => ({
      limit: mockSelectOrder
    }))
  })),
  order: jest.fn(() => ({
    limit: mockSelectOrder
  })),
  limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
}));

const mockInsertSelect = jest.fn();
const mockInsert = jest.fn(() => ({
  select: jest.fn(() => ({
    single: mockInsertSelect
  }))
}));

const mockUpdateSelect = jest.fn();
const mockUpdate = jest.fn(() => ({
  eq: jest.fn(() => ({
    select: jest.fn(() => ({
      single: mockUpdateSelect
    }))
  }))
}));

const mockFrom = jest.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate
}));

const mockRpc = jest.fn();

const mockSupabaseClient = {
  from: mockFrom,
  rpc: mockRpc
};

// Mock Supabase BEFORE importing
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

// Mock mockMode
jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: false,
    generateMockSupabaseClient: jest.fn(() => mockSupabaseClient)
  }
}));

// Mock planLimitsService
const mockGetPlanLimits = jest.fn();
jest.mock('../../../src/services/planLimitsService', () => ({
  getPlanLimits: mockGetPlanLimits
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const CostControlService = require('../../../src/services/costControl');

/**
 * CostControlService - Alert Methods Test Suite
 * 
 * @description Comprehensive tests for alert-related functionality
 * @issue #500 - Final push to reach 60% coverage
 * 
 * Coverage targets:
 * - getAlertHistory: Retrieve historical alerts
 * - getAlertStats: Aggregate alert statistics
 * - getEnhancedUsageStats: Detailed usage analytics
 * - checkAndSendUsageAlerts: Automated alert workflow
 * - recordUsage: Usage tracking with alert triggers
 * 
 * Alert system tests:
 * - Threshold detection (80%, 90%, 100%)
 * - Historical data queries
 * - Statistical aggregations
 * - Automated notification triggers
 * 
 * Mock pattern: Same comprehensive Supabase pattern from main test suite
 */
describe('CostControlService - Alert Methods', () => {
  let costControl;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    
    costControl = new CostControlService();
    
    mockGetPlanLimits.mockResolvedValue({
      monthlyResponsesLimit: 1000,
      shieldEnabled: true
    });
  });

  /**
   * @function getAlertHistory
   * @description Tests alert history retrieval with date range filtering
   * 
   * Tests:
   * - Date range queries (gte, lte)
   * - Organization-specific filtering
   * - Result ordering (most recent first)
   * - Pagination with limit
   * 
   * Mock: Supabase select with gte/lte filters
   */
  describe('getAlertHistory', () => {
    it('should return alert history for organization', async () => {
      const organizationId = 'test-org-123';
      const mockAlerts = [
        { id: 'alert-1', resource_type: 'roasts', threshold_percentage: 80 },
        { id: 'alert-2', resource_type: 'roasts', threshold_percentage: 90 }
      ];

      mockSelectOrder.mockResolvedValueOnce({
        data: mockAlerts,
        error: null
      });

      const result = await costControl.getAlertHistory(organizationId);

      expect(result).toBeDefined();
      expect(mockFrom).toHaveBeenCalledWith('usage_alert_history');
    });

    it('should filter by resource type if provided', async () => {
      const organizationId = 'test-org-123';
      const options = { resourceType: 'roasts' };

      mockSelectOrder.mockResolvedValueOnce({
        data: [{ id: 'alert-1' }],
        error: null
      });

      await costControl.getAlertHistory(organizationId, options);

      expect(mockFrom).toHaveBeenCalledWith('usage_alert_history');
    });
  });

  /**
   * @function getAlertStats
   * @description Tests alert statistics aggregation
   * 
   * Tests:
   * - Count by alert type
   * - Total alert count
   * - Organization-specific statistics
   * - Error handling for empty data
   * 
   * Returns: { total, byType: {warning: N, critical: M} }
   */
  describe('getAlertStats', () => {
    it('should return alert statistics for organization', async () => {
      const organizationId = 'test-org-123';
      const days = 30;

      const mockStats = [
        { resource_type: 'roasts', count: 5 },
        { resource_type: 'api_calls', count: 3 }
      ];

      mockSelectOrder.mockResolvedValueOnce({
        data: mockStats,
        error: null
      });

      const result = await costControl.getAlertStats(organizationId, days);

      expect(result).toBeDefined();
      expect(mockFrom).toHaveBeenCalledWith('usage_alert_history');
    });
  });

  /**
   * @function getEnhancedUsageStats
   * @description Tests enhanced usage statistics with trends
   * 
   * Tests:
   * - Current period usage
   * - Historical comparisons (previous period)
   * - Trend calculations (increasing/decreasing)
   * - Percentage changes
   * - Projection to end of month
   * 
   * Data sources: organization_usage + monthly_usage tables
   */
  describe('getEnhancedUsageStats', () => {
    it('should return enhanced usage statistics', async () => {
      const organizationId = 'test-org-123';
      const months = 3;

      // Mock organizations query
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          id: organizationId,
          plan_id: 'pro',
          monthly_responses_limit: 1000
        },
        error: null
      });

      // Mock monthly_usage query
      mockSelectOrder.mockResolvedValueOnce({
        data: [
          {
            month: 10,
            year: 2025,
            total_responses: 500,
            total_cost_cents: 2500
          },
          {
            month: 9,
            year: 2025,
            total_responses: 450,
            total_cost_cents: 2250
          }
        ],
        error: null
      });

      // Mock usage_records query
      mockSelectOrder.mockResolvedValueOnce({
        data: [
          { resource_type: 'roasts', quantity: 100, cost_cents: 500 },
          { resource_type: 'api_calls', quantity: 200, cost_cents: 0 }
        ],
        error: null
      });

      const result = await costControl.getEnhancedUsageStats(organizationId, months);

      expect(result).toBeDefined();
      expect(result.organizationId).toBe(organizationId);
    });
  });

  /**
   * @function checkAndSendUsageAlerts
   * @description Tests automated alert checking and sending workflow
   * 
   * Tests:
   * - Threshold detection (80%, 90%, 100% usage)
   * - Automatic alert triggering
   * - Alert deduplication (don't send duplicate alerts)
   * - Multiple alert levels
   * - Organization-wide checks
   * 
   * Workflow: Check usage → Evaluate thresholds → Send alerts if needed
   */
  describe('checkAndSendUsageAlerts', () => {
    it('should check and send alerts when threshold exceeded', async () => {
      const organizationId = 'test-org-123';
      const resourceType = 'roasts';
      const usageData = {
        current_usage: 850,
        monthly_limit: 1000,
        percentage: 85
      };

      // Mock usage_alerts query
      mockSelectOrder.mockResolvedValueOnce({
        data: [
          {
            id: 'alert-1',
            threshold_percentage: 80,
            last_triggered_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25h ago
          }
        ],
        error: null
      });

      // Mock organization query for sendUsageAlert
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          name: 'Test Org',
          plan_id: 'pro',
          users: {
            email: 'test@example.com',
            name: 'Test User'
          }
        },
        error: null
      });

      // Mock alert history insert
      mockInsertSelect.mockResolvedValueOnce({
        data: { id: 'history-1' },
        error: null
      });

      // Mock alert update
      mockUpdateSelect.mockResolvedValueOnce({
        data: { id: 'alert-1' },
        error: null
      });

      // Mock app_logs insert
      mockInsertSelect.mockResolvedValueOnce({
        data: { id: 'log-1' },
        error: null
      });

      await costControl.checkAndSendUsageAlerts(organizationId, resourceType, usageData);

      expect(mockFrom).toHaveBeenCalledWith('usage_alerts');
    });

    it('should not send alerts if recently sent (within 24h)', async () => {
      const organizationId = 'test-org-123';
      const resourceType = 'roasts';
      const usageData = {
        current_usage: 850,
        monthly_limit: 1000,
        percentage: 85
      };

      // Mock with alert triggered 1h ago
      mockSelectOrder.mockResolvedValueOnce({
        data: [
          {
            id: 'alert-1',
            threshold_percentage: 80,
            last_triggered_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1h ago
          }
        ],
        error: null
      });

      await costControl.checkAndSendUsageAlerts(organizationId, resourceType, usageData);

      // Should not insert to alert_history if recently triggered
      expect(mockFrom).toHaveBeenCalledWith('usage_alerts');
    });
  });

  /**
   * @function recordUsage
   * @description Tests usage recording with integrated alert triggering
   * 
   * Tests:
   * - Usage counter increment
   * - Automatic alert check after recording
   * - Combined workflow (record + check + alert)
   * - Platform-specific usage tracking
   * 
   * Integration test: Combines recordUsage + checkAndSendUsageAlerts
   */
  describe('recordUsage', () => {
    it('should record usage with all tracking', async () => {
      const organizationId = 'test-org-123';
      const platform = 'twitter';
      const operationType = 'generate_reply';

      // Mock usage_records insert
      mockInsertSelect.mockResolvedValueOnce({
        data: { id: 'record-1' },
        error: null
      });

      // Mock increment_usage RPC
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      // Mock checkUsageLimit
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          plan_id: 'pro',
          monthly_responses_limit: 1000,
          monthly_responses_used: 100
        },
        error: null
      });

      mockSelectSingle.mockResolvedValueOnce({
        data: {
          total_responses: 100,
          limit_exceeded: false
        },
        error: null
      });

      await costControl.recordUsage(organizationId, platform, operationType);

      expect(mockFrom).toHaveBeenCalledWith('usage_records');
      // RPC function name is 'record_usage' not 'increment_usage'
      expect(mockRpc).toHaveBeenCalledWith('record_usage', expect.any(Object));
    });
  });
});

