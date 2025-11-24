/**
 * Audit Service Tests
 *
 * Tests for audit logging functionality including:
 * - Subscription change logging
 * - Plan change logging and history
 * - GDPR action logging
 * - User setting change logging
 * - Audit trail retrieval
 * - Error handling and retry logic
 */

const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// Create mocks BEFORE jest.mock() calls
const mockSupabase = createSupabaseMock({
  subscription_audit_log: [],
  plan_change_history: [],
  plan_change_analytics: [],
  audit_logs: []
});

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../../src/utils/retry', () => ({
  withRetry: jest.fn((fn, options) => fn()),
  isRetryableError: jest.fn(() => false)
}));

const auditService = require('../../../src/services/auditService');

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase._reset();
  });

  describe('logSubscriptionChange', () => {
    it('should log subscription change successfully', async () => {
      const changeData = {
        userId: 'user-123',
        eventType: 'plan_change',
        oldPlan: 'free',
        newPlan: 'pro',
        oldStatus: 'active',
        newStatus: 'active',
        customerId: 'cus_123',
        subscriptionId: 'sub_123',
        eventId: 'evt_123',
        reason: 'upgrade',
        metadata: { source: 'dashboard' },
        initiatedBy: 'user'
      };

      // Mock successful insert
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'subscription_audit_log') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: { id: 'log-1', ...changeData },
                  error: null
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logSubscriptionChange(changeData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      const changeData = {
        userId: 'user-123',
        eventType: 'plan_change',
        oldPlan: 'free',
        newPlan: 'pro'
      };

      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'subscription_audit_log') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: null,
                  error: { message: 'Database error' }
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logSubscriptionChange(changeData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('logPlanChange', () => {
    it('should log plan change with upgrade type', async () => {
      const changeData = {
        userId: 'user-123',
        organizationId: 'org-123',
        fromPlan: 'free',
        toPlan: 'pro',
        changeStatus: 'completed',
        usageSnapshot: { roasts: 10 },
        prorationAmount: 500,
        subscriptionId: 'sub_123',
        initiatedBy: 'user'
      };

      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'plan_change_history') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: { id: 'change-1', change_type: 'upgrade', ...changeData },
                  error: null
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logPlanChange(changeData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should determine change type correctly', () => {
      expect(auditService.determineChangeType('free', 'pro')).toBe('upgrade');
      expect(auditService.determineChangeType('pro', 'free')).toBe('downgrade');
      expect(auditService.determineChangeType('pro', 'pro')).toBe('lateral');
      expect(auditService.determineChangeType('unknown', 'pro')).toBe('upgrade');
    });

    it('should handle plan change with error', async () => {
      const changeData = {
        userId: 'user-123',
        fromPlan: 'free',
        toPlan: 'pro',
        changeStatus: 'failed',
        blockedReason: 'Payment failed'
      };

      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'plan_change_history') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: null,
                  error: { message: 'Insert failed' }
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logPlanChange(changeData);

      expect(result.success).toBe(false);
    });
  });

  describe('getSubscriptionHistory', () => {
    it('should return subscription history for user', async () => {
      const mockHistory = [
        {
          id: '1',
          user_id: 'user-123',
          event_type: 'plan_change',
          old_plan: 'free',
          new_plan: 'pro',
          created_at: new Date().toISOString()
        }
      ];

      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'subscription_audit_log') {
          const builder = {
            select: jest.fn(() => builder),
            eq: jest.fn(() => builder),
            order: jest.fn(() => builder),
            range: jest.fn(() => Promise.resolve({
              data: mockHistory,
              error: null
            }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      const result = await auditService.getSubscriptionHistory('user-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should filter by eventType', async () => {
      const originalFrom = mockSupabase.from;
      let eqCalls = [];
      mockSupabase.from = jest.fn((table) => {
        if (table === 'subscription_audit_log') {
          const builder = {
            select: jest.fn(() => builder),
            eq: jest.fn((key, value) => {
              eqCalls.push({ key, value });
              return builder;
            }),
            order: jest.fn(() => builder),
            range: jest.fn(() => Promise.resolve({ data: [], error: null }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      await auditService.getSubscriptionHistory('user-123', {
        eventType: 'plan_change'
      });

      expect(eqCalls.some(c => c.key === 'event_type' && c.value === 'plan_change')).toBe(true);
    });
  });

  describe('getPlanChangeHistory', () => {
    it('should return plan change history', async () => {
      const mockHistory = [
        {
          id: '1',
          user_id: 'user-123',
          from_plan: 'free',
          to_plan: 'pro',
          change_type: 'upgrade',
          initiated_at: new Date().toISOString()
        }
      ];

      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'plan_change_history') {
          const builder = {
            select: jest.fn(() => builder),
            eq: jest.fn(() => builder),
            order: jest.fn(() => builder),
            range: jest.fn(() => Promise.resolve({
              data: mockHistory,
              error: null
            }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      const result = await auditService.getPlanChangeHistory('user-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('updatePlanChangeStatus', () => {
    it('should update plan change status to completed', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'plan_change_history') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn(() => Promise.resolve({
                    data: { id: 'change-1', change_status: 'completed' },
                    error: null
                  }))
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.updatePlanChangeStatus('change-1', 'completed');

      expect(result.success).toBe(true);
      expect(result.data.change_status).toBe('completed');
    });

    it('should update status with reason when failed', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'plan_change_history') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn(() => Promise.resolve({
                    data: {
                      id: 'change-1',
                      change_status: 'blocked',
                      blocked_reason: 'Payment failed'
                    },
                    error: null
                  }))
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.updatePlanChangeStatus(
        'change-1',
        'blocked',
        'Payment failed'
      );

      expect(result.success).toBe(true);
      expect(result.data.blocked_reason).toBe('Payment failed');
    });
  });

  describe('logGdprAction', () => {
    it('should log GDPR action successfully', async () => {
      const actionData = {
        action: 'account_deletion_requested',
        userId: 'user-123',
        resourceId: 'req-123',
        legalBasis: 'gdpr_article_17_right_to_be_forgotten',
        details: { grace_period_days: 30 }
      };

      const mockReq = {
        ip: '127.0.0.1',
        get: jest.fn(() => 'Mozilla/5.0')
      };

      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: { id: 'log-1', ...actionData },
                  error: null
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logGdprAction(actionData, mockReq);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('logUserSettingChange', () => {
    it('should log user setting change', async () => {
      const details = {
        old_value: 'dark',
        new_value: 'light'
      };

      const mockReq = {
        ip: '127.0.0.1',
        get: jest.fn(() => 'Mozilla/5.0')
      };

      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: { id: 'log-1', setting_name: 'theme', ...details },
                  error: null
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logUserSettingChange(
        'user-123',
        'theme',
        details,
        mockReq
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('cleanupOldLogs', () => {
    it('should cleanup old audit logs', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'subscription_audit_log' || table === 'plan_change_history') {
          return {
            delete: jest.fn(() => ({
              lt: jest.fn(() => Promise.resolve({
                count: 10,
                error: null
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.cleanupOldLogs(365);

      expect(result.success).toBe(true);
      expect(result.auditRecordsRemoved).toBe(10);
      expect(result.planHistoryRemoved).toBe(10);
    });

    it('should handle cleanup errors gracefully', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'subscription_audit_log') {
          return {
            delete: jest.fn(() => ({
              lt: jest.fn(() => Promise.resolve({
                count: null,
                error: { message: 'Delete failed' }
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.cleanupOldLogs(365);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getPlanChangeAnalytics', () => {
    it('should return plan change analytics', async () => {
      const mockAnalytics = [
        { month: '2025-01', upgrades: 10, downgrades: 2 },
        { month: '2024-12', upgrades: 8, downgrades: 3 }
      ];

      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'plan_change_analytics') {
          const builder = {
            select: jest.fn(() => builder),
            gte: jest.fn(() => builder),
            lte: jest.fn(() => builder),
            order: jest.fn(() => Promise.resolve({
              data: mockAnalytics,
              error: null
            }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      const result = await auditService.getPlanChangeAnalytics({});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should filter analytics by date range', async () => {
      const originalFrom = mockSupabase.from;
      let gteCalled = false;
      let lteCalled = false;

      mockSupabase.from = jest.fn((table) => {
        if (table === 'plan_change_analytics') {
          const builder = {
            select: jest.fn(() => builder),
            gte: jest.fn(() => { gteCalled = true; return builder; }),
            lte: jest.fn(() => { lteCalled = true; return builder; }),
            order: jest.fn(() => Promise.resolve({ data: [], error: null }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      await auditService.getPlanChangeAnalytics({
        since: new Date('2024-01-01'),
        until: new Date('2024-12-31')
      });

      expect(gteCalled).toBe(true);
      expect(lteCalled).toBe(true);
    });

    it('should handle analytics query error', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'plan_change_analytics') {
          const builder = {
            select: jest.fn(() => builder),
            order: jest.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Query failed' }
            }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      const result = await auditService.getPlanChangeAnalytics({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('logAccountDeletionRequest', () => {
    it('should log account deletion request', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'log-1',
                    action: 'account_deletion_requested',
                    user_id: 'user-123'
                  },
                  error: null
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logAccountDeletionRequest(
        'user-123',
        'req-456',
        { gracePeriodDays: 30, scheduledDeletionAt: new Date().toISOString() }
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('account_deletion_requested');
    });
  });

  describe('logAccountDeletionAttempt', () => {
    it('should log account deletion attempt', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'log-1',
                    action: 'account_deletion_attempted',
                    user_id: 'user-123'
                  },
                  error: null
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logAccountDeletionAttempt(
        'user-123',
        { success: false, reason: 'invalid_password', error: 'Password mismatch' }
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('account_deletion_attempted');
    });
  });

  describe('logDataExport', () => {
    it('should log data export', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'log-1',
                    action: 'gdpr_data_exported',
                    user_id: 'user-123'
                  },
                  error: null
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logDataExport('user-123', {
        filename: 'export-123.zip',
        size: 1024,
        dataCategories: ['profile', 'roasts'],
        expiresAt: new Date().toISOString()
      });

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('gdpr_data_exported');
    });

    it('should log data export with different actor', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'log-1',
                    action: 'gdpr_data_exported',
                    user_id: 'user-123',
                    actor_id: 'admin-456'
                  },
                  error: null
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logDataExport('user-123', {
        filename: 'export-123.zip'
      }, 'admin-456');

      expect(result.success).toBe(true);
    });
  });

  describe('logAccountDeletionCancellation', () => {
    it('should log account deletion cancellation', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'log-1',
                    action: 'account_deletion_cancelled',
                    user_id: 'user-123'
                  },
                  error: null
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logAccountDeletionCancellation(
        'user-123',
        'req-456',
        { reason: 'changed_mind' }
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('account_deletion_cancelled');
    });
  });

  describe('logAccountDeletionCompleted', () => {
    it('should log account deletion completed', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'log-1',
                    action: 'account_deletion_completed',
                    user_id: null
                  },
                  error: null
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logAccountDeletionCompleted(
        'user-123',
        'req-456',
        {
          dataCategoriesDeleted: ['profile', 'roasts', 'comments'],
          anonymizedRecordsCount: 50
        }
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('account_deletion_completed');
    });
  });

  describe('getGdprAuditTrail', () => {
    it('should return GDPR audit trail for user', async () => {
      const mockAuditTrail = [
        {
          id: '1',
          user_id: 'user-123',
          action: 'account_deletion_requested',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          user_id: 'user-123',
          action: 'gdpr_data_exported',
          created_at: new Date().toISOString()
        }
      ];

      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          const builder = {
            select: jest.fn(() => builder),
            or: jest.fn(() => builder),
            in: jest.fn(() => builder),
            order: jest.fn(() => builder),
            range: jest.fn(() => Promise.resolve({
              data: mockAuditTrail,
              error: null,
              count: 2
            }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      const result = await auditService.getGdprAuditTrail('user-123');

      expect(result.success).toBe(true);
      expect(result.data.auditLogs).toHaveLength(2);
      expect(result.data.totalCount).toBe(2);
    });

    it('should handle pagination correctly', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          const builder = {
            select: jest.fn(() => builder),
            or: jest.fn(() => builder),
            in: jest.fn(() => builder),
            order: jest.fn(() => builder),
            range: jest.fn(() => Promise.resolve({
              data: [{ id: '1' }],
              error: null,
              count: 150
            }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      const result = await auditService.getGdprAuditTrail('user-123', 50, 0);

      expect(result.success).toBe(true);
      expect(result.data.hasMore).toBe(true);
    });

    it('should handle GDPR audit trail query error', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          const builder = {
            select: jest.fn(() => builder),
            or: jest.fn(() => builder),
            in: jest.fn(() => builder),
            order: jest.fn(() => builder),
            range: jest.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Query failed' },
              count: null
            }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      const result = await auditService.getGdprAuditTrail('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getSubscriptionHistory - edge cases', () => {
    it('should filter by since date', async () => {
      const originalFrom = mockSupabase.from;
      let gteCalled = false;

      mockSupabase.from = jest.fn((table) => {
        if (table === 'subscription_audit_log') {
          const builder = {
            select: jest.fn(() => builder),
            eq: jest.fn(() => builder),
            gte: jest.fn(() => { gteCalled = true; return builder; }),
            order: jest.fn(() => builder),
            range: jest.fn(() => Promise.resolve({ data: [], error: null }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      await auditService.getSubscriptionHistory('user-123', {
        since: new Date('2024-01-01')
      });

      expect(gteCalled).toBe(true);
    });

    it('should handle query error', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'subscription_audit_log') {
          const builder = {
            select: jest.fn(() => builder),
            eq: jest.fn(() => builder),
            order: jest.fn(() => builder),
            range: jest.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Query failed' }
            }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      const result = await auditService.getSubscriptionHistory('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getPlanChangeHistory - edge cases', () => {
    it('should filter by changeType', async () => {
      const originalFrom = mockSupabase.from;
      let eqCalls = [];

      mockSupabase.from = jest.fn((table) => {
        if (table === 'plan_change_history') {
          const builder = {
            select: jest.fn(() => builder),
            eq: jest.fn((key, value) => { eqCalls.push({ key, value }); return builder; }),
            order: jest.fn(() => builder),
            range: jest.fn(() => Promise.resolve({ data: [], error: null }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      await auditService.getPlanChangeHistory('user-123', {
        changeType: 'upgrade'
      });

      expect(eqCalls.some(c => c.key === 'change_type' && c.value === 'upgrade')).toBe(true);
    });

    it('should filter by since date', async () => {
      const originalFrom = mockSupabase.from;
      let gteCalled = false;

      mockSupabase.from = jest.fn((table) => {
        if (table === 'plan_change_history') {
          const builder = {
            select: jest.fn(() => builder),
            eq: jest.fn(() => builder),
            gte: jest.fn(() => { gteCalled = true; return builder; }),
            order: jest.fn(() => builder),
            range: jest.fn(() => Promise.resolve({ data: [], error: null }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      await auditService.getPlanChangeHistory('user-123', {
        since: new Date('2024-01-01')
      });

      expect(gteCalled).toBe(true);
    });

    it('should handle query error', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'plan_change_history') {
          const builder = {
            select: jest.fn(() => builder),
            eq: jest.fn(() => builder),
            order: jest.fn(() => builder),
            range: jest.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Query failed' }
            }))
          };
          return builder;
        }
        return originalFrom(table);
      });

      const result = await auditService.getPlanChangeHistory('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('updatePlanChangeStatus - edge cases', () => {
    it('should handle update error', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'plan_change_history') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn(() => Promise.resolve({
                    data: null,
                    error: { message: 'Update failed' }
                  }))
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.updatePlanChangeStatus('change-1', 'completed');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('logGdprAction - edge cases', () => {
    it('should handle GDPR action error', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: null,
                  error: { message: 'Insert failed' }
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logGdprAction({
        action: 'test_action',
        userId: 'user-123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle null request object', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: { id: 'log-1', action: 'test_action' },
                  error: null
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logGdprAction({
        action: 'test_action',
        userId: 'user-123'
      }, null);

      expect(result.success).toBe(true);
    });
  });

  describe('logUserSettingChange - edge cases', () => {
    it('should handle setting change error', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: null,
                  error: { message: 'Insert failed' }
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logUserSettingChange(
        'user-123',
        'theme',
        { old_value: 'dark', new_value: 'light' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle null request object', async () => {
      const originalFrom = mockSupabase.from;
      mockSupabase.from = jest.fn((table) => {
        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: { id: 'log-1', setting_name: 'theme' },
                  error: null
                }))
              }))
            }))
          };
        }
        return originalFrom(table);
      });

      const result = await auditService.logUserSettingChange(
        'user-123',
        'theme',
        { old_value: 'dark', new_value: 'light' },
        null
      );

      expect(result.success).toBe(true);
    });
  });

  describe('determineChangeType - edge cases', () => {
    it('should handle creator_plus tier', () => {
      expect(auditService.determineChangeType('pro', 'creator_plus')).toBe('upgrade');
      expect(auditService.determineChangeType('creator_plus', 'pro')).toBe('downgrade');
      expect(auditService.determineChangeType('creator_plus', 'free')).toBe('downgrade');
    });

    it('should handle unknown plans', () => {
      expect(auditService.determineChangeType('unknown_plan', 'another_unknown')).toBe('lateral');
      expect(auditService.determineChangeType('unknown', 'free')).toBe('lateral');
    });
  });
});

