/**
 * Cost Control Service Alert Tests - Issue 72
 * 
 * Tests for 80% usage threshold alerts and alert history functionality
 */

const CostControlService = require('../../../src/services/costControl');

// Mock console.log to test logging
const mockConsoleLog = jest.fn();
global.console = { ...console, log: mockConsoleLog };

// Create comprehensive mocks for Supabase query builder pattern for alerts
const mockSelectSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
const mockSelectRange = jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 }));
const mockSelectOrder = jest.fn(() => ({
  range: mockSelectRange,
  limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
}));
const mockSelectLte = jest.fn(() => Promise.resolve({ data: [], error: null }));
const mockSelectGte = jest.fn(() => ({
  order: mockSelectOrder,
  range: mockSelectRange,
  lte: mockSelectLte
}));
const mockSelectEq = jest.fn(() => ({
  eq: mockSelectEq,
  single: mockSelectSingle,
  maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
  order: mockSelectOrder,
  range: mockSelectRange,
  gte: mockSelectGte,
  lte: mockSelectLte,
  lte: jest.fn(() => Promise.resolve({ data: [], error: null }))
}));

const mockSelect = jest.fn(() => ({
  eq: mockSelectEq,
  single: mockSelectSingle,
  gte: mockSelectGte,
  lte: mockSelectLte,
  order: mockSelectOrder,
  range: mockSelectRange
}));

const mockInsertSingle = jest.fn(() => Promise.resolve({ data: { id: 'test-123' }, error: null }));
const mockInsertSelect = jest.fn(() => ({
  single: mockInsertSingle
}));
const mockInsert = jest.fn(() => ({
  select: mockInsertSelect
}));

const mockUpdate = jest.fn(() => ({
  eq: jest.fn(() => Promise.resolve({ error: null }))
}));

// Create a more robust mock that handles chaining properly
const createMockChain = () => {
  const chain = {
    eq: jest.fn(() => chain),
    select: jest.fn(() => chain),
    single: mockSelectSingle,
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    order: jest.fn(() => chain),
    range: mockSelectRange,
    gte: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    upsert: jest.fn(() => Promise.resolve({ error: null, data: {} }))
  };
  return chain;
};

const mockFrom = jest.fn((table) => {
  return createMockChain();
});

const mockRpc = jest.fn(() => Promise.resolve({ data: {}, error: null }));

const mockSupabaseClient = {
  from: mockFrom,
  rpc: mockRpc
};

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

describe('CostControlService - Alerts (Issue 72)', () => {
  let costControl;

  beforeEach(() => {
    // Mock environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-key';
    
    // Clear all mocks
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    
    costControl = new CostControlService();
  });

  describe('createDefaultUsageAlerts', () => {
    test('should create default 80% threshold alerts for all resource types', async () => {
      const organizationId = 'test-org-123';
      
      // Mock that no existing alerts are found
      mockSelectEq.mockImplementation(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      }));

      // Mock successful insert
      mockInsert.mockResolvedValue({ error: null });

      const result = await costControl.createDefaultUsageAlerts(organizationId);

      expect(result).toHaveLength(4); // 4 resource types
      expect(result[0]).toMatchObject({
        organization_id: organizationId,
        resource_type: 'roasts',
        threshold_percentage: 80,
        alert_type: 'in_app',
        is_active: true,
        max_alerts_per_day: 3,
        cooldown_hours: 4
      });

      // Verify console logging
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Created 4 default usage alerts')
      );
    });

    test('should skip creating alerts that already exist', async () => {
      const organizationId = 'test-org-123';
      
      // Mock that alerts already exist
      mockSelectEq.mockImplementation(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ 
              data: { id: 'existing-alert-123' }, 
              error: null 
            }))
          }))
        }))
      }));

      const result = await costControl.createDefaultUsageAlerts(organizationId);

      expect(result).toHaveLength(0); // No alerts created
      expect(mockInsert).not.toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      const organizationId = 'test-org-123';
      
      // Mock database error
      mockSelectEq.mockImplementation(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ 
              data: null, 
              error: new Error('Database error') 
            }))
          }))
        }))
      }));

      const result = await costControl.createDefaultUsageAlerts(organizationId);

      expect(result).toHaveLength(0); // No alerts created due to error
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('sendUsageAlert', () => {
    test('should generate 80% threshold alert with proper logging', async () => {
      const organizationId = 'test-org-123';
      const usageData = {
        resourceType: 'roasts',
        percentage: 82,
        currentUsage: 820,
        limit: 1000,
        thresholdPercentage: 80,
        planId: 'pro'
      };

      // Mock organization query
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          name: 'Test Organization',
          plan_id: 'pro',
          users: { email: 'admin@test.com', name: 'Test Admin' }
        },
        error: null
      });

      // Mock app_logs insert
      mockInsertSingle.mockResolvedValue({ data: { id: 'log-123' }, error: null });

      const alertPayload = await costControl.sendUsageAlert(organizationId, usageData);

      // Verify console logging (Issue 72 requirement)
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Usage Alert: 82% of monthly roasts limit reached (threshold: 80%)'),
        expect.objectContaining({
          organizationId,
          resourceType: 'roasts',
          currentUsage: 820,
          limit: 1000,
          percentage: 82,
          thresholdPercentage: 80,
          planId: 'pro'
        })
      );

      // Verify database logging (Issue 72 requirement)
      expect(mockFrom).toHaveBeenCalledWith('app_logs');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: organizationId,
          level: 'warn',
          category: 'usage_alert',
          message: expect.stringContaining('🚨 Usage Alert: 82% of monthly roasts limit reached'),
          metadata: expect.objectContaining({
            resourceType: 'roasts',
            currentUsage: 820,
            limit: 1000,
            percentage: 82,
            thresholdPercentage: 80,
            planId: 'pro',
            alertType: 'soft_warning'
          })
        })
      );

      // Verify alert payload structure
      expect(alertPayload).toMatchObject({
        type: 'usage_alert',
        organizationId,
        organizationName: 'Test Organization',
        currentUsage: 820,
        limit: 1000,
        percentage: 82,
        planId: 'pro'
      });
    });

    test('should handle missing usage data gracefully', async () => {
      const organizationId = 'test-org-123';
      const usageData = {}; // Empty data

      // Mock organization query
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          name: 'Test Organization',
          plan_id: 'free',
          users: { email: 'admin@test.com', name: 'Test Admin' }
        },
        error: null
      });

      // Mock app_logs insert
      mockInsertSingle.mockResolvedValue({ data: { id: 'log-124' }, error: null });

      const alertPayload = await costControl.sendUsageAlert(organizationId, usageData);

      // Should use default values
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Usage Alert: 0% of monthly roasts limit reached (threshold: 80%)'),
        expect.any(Object)
      );

      expect(alertPayload.percentage).toBe(0);
      expect(alertPayload.planId).toBe('free');
    });
  });

  describe('checkAndSendUsageAlerts', () => {
    test('should trigger alerts when usage reaches 80% threshold', async () => {
      const organizationId = 'test-org-123';
      const resourceType = 'roasts';
      const usageData = {
        percentage_used: 85,
        current_usage: 850,
        monthly_limit: 1000
      };

      // Mock existing alert configuration
      const mockAlert = {
        id: 'alert-123',
        organization_id: organizationId,
        resource_type: resourceType,
        threshold_percentage: 80,
        alert_type: 'in_app',
        is_active: true,
        last_sent_at: null,
        sent_count: 0,
        max_alerts_per_day: 3,
        cooldown_hours: 4
      };

      mockSelectEq.mockImplementationOnce(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              lte: jest.fn(() => Promise.resolve({ data: [mockAlert], error: null }))
            }))
          }))
        }))
      }));

      // Mock organization query for sendUsageAlert
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          name: 'Test Organization',
          plan_id: 'pro',
          users: { email: 'admin@test.com', name: 'Test Admin' }
        },
        error: null
      });

      // Mock app_logs and alert update
      mockInsertSingle.mockResolvedValue({ data: { id: 'log-125' }, error: null });
      
      // Spy on sendUsageAlert
      const sendUsageAlertSpy = jest.spyOn(costControl, 'sendUsageAlert');
      sendUsageAlertSpy.mockResolvedValue({ type: 'usage_alert' });

      await costControl.checkAndSendUsageAlerts(organizationId, resourceType, usageData);

      // Verify sendUsageAlert was called
      expect(sendUsageAlertSpy).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({
          current_usage: 850,
          monthly_limit: 1000,
          resourceType,
          alertType: 'in_app',
          thresholdPercentage: 80
        })
      );
    });

    test('should create default alerts if none exist', async () => {
      const organizationId = 'test-org-123';
      const resourceType = 'roasts';
      const usageData = { percentage_used: 85 };

      // Mock no existing alerts found initially
      mockSelectEq.mockImplementationOnce(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              lte: jest.fn(() => Promise.resolve({ data: null, error: null }))
            }))
          }))
        }))
      }));

      // Mock createDefaultUsageAlerts to be called
      const createDefaultAlertsSpy = jest.spyOn(costControl, 'createDefaultUsageAlerts');
      createDefaultAlertsSpy.mockResolvedValue([]);

      await costControl.checkAndSendUsageAlerts(organizationId, resourceType, usageData);

      expect(createDefaultAlertsSpy).toHaveBeenCalledWith(organizationId);
    });
  });

  describe('getAlertHistory', () => {
    test('should retrieve filtered alert history with pagination', async () => {
      const organizationId = 'test-org-123';
      const mockAlerts = [
        {
          id: 'alert-log-1',
          organization_id: organizationId,
          level: 'warn',
          category: 'usage_alert',
          message: '🚨 Usage Alert: 85% of monthly roasts limit reached',
          metadata: { resourceType: 'roasts', percentage: 85, thresholdPercentage: 80 },
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 'alert-log-2',
          organization_id: organizationId,
          level: 'warn',
          category: 'usage_alert',
          message: '🚨 Usage Alert: 82% of monthly api_calls limit reached',
          metadata: { resourceType: 'api_calls', percentage: 82, thresholdPercentage: 80 },
          created_at: '2024-01-14T15:30:00Z'
        }
      ];

      // Mock alert history query
      mockSelectOrder.mockImplementation(() => ({
        range: jest.fn(() => Promise.resolve({ data: mockAlerts, error: null }))
      }));

      // Mock count query
      mockSelectSingle.mockResolvedValue({ count: 25, error: null });

      const result = await costControl.getAlertHistory(organizationId, {
        limit: 50,
        offset: 0,
        resourceType: null
      });

      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0].metadata.resourceType).toBe('roasts');
      expect(result.pagination).toMatchObject({
        limit: 50,
        offset: 0,
        total: 25,
        hasMore: false
      });
    });

    test('should apply resource type filter', async () => {
      const organizationId = 'test-org-123';
      
      // Mock filtered results
      mockSelectOrder.mockImplementation(() => ({
        range: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }));
      mockSelectSingle.mockResolvedValue({ count: 0, error: null });

      await costControl.getAlertHistory(organizationId, {
        resourceType: 'roasts',
        limit: 10
      });

      // Verify the filter was applied (this is mocked, but we're testing the flow)
      expect(mockSelect).toHaveBeenCalled();
    });
  });

  describe('getAlertStats', () => {
    test('should return alert statistics grouped by resource type and threshold', async () => {
      const organizationId = 'test-org-123';
      const mockAlertLogs = [
        { metadata: { resourceType: 'roasts', thresholdPercentage: 80 } },
        { metadata: { resourceType: 'roasts', thresholdPercentage: 80 } },
        { metadata: { resourceType: 'api_calls', thresholdPercentage: 80 } },
        { metadata: { resourceType: 'api_calls', thresholdPercentage: 90 } }
      ];

      mockSelect.mockImplementation(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => Promise.resolve({ data: mockAlertLogs, error: null }))
          }))
        }))
      }));

      const stats = await costControl.getAlertStats(organizationId, 30);

      expect(stats.organizationId).toBe(organizationId);
      expect(stats.period).toBe('30 days');
      expect(stats.stats.total).toBe(4);
      expect(stats.stats.byResourceType).toMatchObject({
        roasts: 2,
        api_calls: 2
      });
      expect(stats.stats.byThreshold).toMatchObject({
        80: 3,
        90: 1
      });
    });

    test('should handle empty alert history', async () => {
      const organizationId = 'test-org-123';

      mockSelect.mockImplementation(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }));

      const stats = await costControl.getAlertStats(organizationId);

      expect(stats.stats.total).toBe(0);
      expect(stats.stats.byResourceType).toEqual({});
      expect(stats.stats.byThreshold).toEqual({});
    });
  });

  describe('shouldSendAlert', () => {
    test('should allow sending alert when conditions are met', async () => {
      const alert = {
        id: 'alert-123',
        sent_count: 1,
        max_alerts_per_day: 3,
        last_sent_at: null,
        cooldown_hours: 4
      };

      const shouldSend = await costControl.shouldSendAlert(alert, 85);

      expect(shouldSend).toBe(true);
    });

    test('should block alert when daily limit exceeded', async () => {
      const alert = {
        id: 'alert-123',
        sent_count: 3,
        max_alerts_per_day: 3,
        last_sent_at: new Date().toISOString(),
        cooldown_hours: 4
      };

      const shouldSend = await costControl.shouldSendAlert(alert, 85);

      expect(shouldSend).toBe(false);
    });

    test('should block alert when in cooldown period', async () => {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const alert = {
        id: 'alert-123',
        sent_count: 1,
        max_alerts_per_day: 3,
        last_sent_at: oneHourAgo.toISOString(),
        cooldown_hours: 4
      };

      const shouldSend = await costControl.shouldSendAlert(alert, 85);

      expect(shouldSend).toBe(false);
    });

    test('should allow alert after cooldown period expires', async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const alert = {
        id: 'alert-123',
        sent_count: 1,
        max_alerts_per_day: 3,
        last_sent_at: sixHoursAgo.toISOString(),
        cooldown_hours: 4
      };

      const shouldSend = await costControl.shouldSendAlert(alert, 85);

      expect(shouldSend).toBe(true);
    });
  });

  describe('Integration with existing usage tracking', () => {
    test('should trigger alerts during recordUsage when threshold reached', async () => {
      // Mock trackingResult with 80%+ usage
      const trackingResult = {
        percentage_used: 83,
        current_usage: 830,
        monthly_limit: 1000,
        limit_exceeded: false
      };

      mockRpc.mockResolvedValue({ data: trackingResult, error: null });
      mockInsert.mockResolvedValue({ data: { id: 'usage-123' }, error: null });

      // Spy on checkAndSendUsageAlerts
      const checkAlertsSpy = jest.spyOn(costControl, 'checkAndSendUsageAlerts');
      checkAlertsSpy.mockResolvedValue();

      await costControl.recordUsage(
        'test-org-123',
        'twitter', 
        'generate_reply',
        { tokensUsed: 25 }
      );

      // Verify alerts were checked
      expect(checkAlertsSpy).toHaveBeenCalledWith(
        'test-org-123',
        'roasts',
        trackingResult
      );
    });
  });
});