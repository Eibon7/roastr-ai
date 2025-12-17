/**
 * Audit Log Service Tests
 *
 * Tests for security audit logging functionality including:
 * - Event logging with proper categorization
 * - Database and file-based storage
 * - Event statistics and filtering
 * - Error handling and fallback mechanisms
 */

const fs = require('fs').promises;
const path = require('path');
const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls (Issue #892 - Fix Supabase Mock Pattern)
// ============================================================================

// Create Supabase mock with table-specific defaults
const mockSupabase = createSupabaseMock({
  audit_logs: [] // Default empty array for audit logs
});

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

// ============================================================================
// STEP 2: Reference pre-created mock in jest.mock() calls
// ============================================================================

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

// ============================================================================
// STEP 3: Require modules AFTER mocks are configured
// ============================================================================

const { auditLogger, AuditLogService } = require('../../../src/services/auditLogService');

jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn()
  }
}));

// Mock fs for file operations
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    appendFile: jest.fn(),
    readFile: jest.fn()
  }
}));

const { logger } = require('../../../src/utils/logger');
const { flags } = require('../../../src/config/flags');

describe('AuditLogService', () => {
  let auditLogService;
  let mockFrom;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset Supabase mock to defaults
    mockSupabase._reset();

    // Create fresh instance for each test
    auditLogService = new AuditLogService();

    // Configure mockSupabase.from to return a mock that works with the service
    // The service does: await supabaseServiceClient.from('audit_logs').insert(auditEntry)
    // So insert() must return a promise that resolves to { data: [...], error: null }
    mockFrom = {
      insert: jest.fn(() => Promise.resolve({ data: [], error: null })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({
                lte: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
                  }))
                }))
              }))
            }))
          })),
          gte: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          })),
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      })),
      delete: jest.fn(() => ({
        lt: jest.fn(() => Promise.resolve({ error: null }))
      }))
    };

    // Configure mockSupabase.from to return our configured mockFrom
    mockSupabase.from.mockReturnValue(mockFrom);

    // Configure default flag states
    flags.isEnabled.mockImplementation((flag) => {
      switch (flag) {
        case 'ENABLE_SUPABASE':
          return true;
        default:
          return false;
      }
    });
  });

  describe('constructor', () => {
    test('should initialize with correct event types', () => {
      expect(auditLogService.eventTypes).toBeDefined();
      expect(auditLogService.eventTypes['auth.login']).toEqual({
        severity: 'info',
        description: 'User login'
      });
      expect(auditLogService.eventTypes['billing.payment_failed']).toEqual({
        severity: 'warning',
        description: 'Payment failed'
      });
      expect(auditLogService.eventTypes['system.api_error']).toEqual({
        severity: 'error',
        description: 'API error occurred'
      });
    });

    test('should set correct log file path', () => {
      const expectedPath = path.join(process.cwd(), 'data', 'audit.log');
      expect(auditLogService.logFile).toBe(expectedPath);
    });
  });

  describe('logEvent', () => {
    test('should log valid event to database when Supabase is enabled', async () => {
      const eventType = 'auth.login';
      const details = {
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      mockFrom.insert.mockReturnValue({ error: null });

      const result = await auditLogService.logEvent(eventType, details);

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockFrom.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: eventType,
          severity: 'info',
          description: 'User login',
          user_id: 'user-123',
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          details: expect.any(String),
          created_at: expect.any(String)
        })
      );
      expect(logger.debug).toHaveBeenCalledWith('Audit event saved to database:', eventType);
    });

    test('should fallback to file logging when database fails', async () => {
      const eventType = 'auth.failed_login';
      const details = { ipAddress: '192.168.1.100' };

      // Mock database failure
      mockFrom.insert.mockReturnValue({ error: { message: 'Database connection failed' } });
      fs.mkdir.mockResolvedValue();
      fs.appendFile.mockResolvedValue();

      const result = await auditLogService.logEvent(eventType, details);

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to save audit log to database, falling back to file:',
        'Database audit log error: Database connection failed'
      );
      expect(fs.appendFile).toHaveBeenCalledWith(
        auditLogService.logFile,
        expect.stringContaining(eventType)
      );
      expect(logger.debug).toHaveBeenCalledWith('Audit event saved to file:', eventType);
    });

    test('should use file logging when Supabase is disabled', async () => {
      flags.isEnabled.mockReturnValue(false); // Disable Supabase
      fs.mkdir.mockResolvedValue();
      fs.appendFile.mockResolvedValue();

      const result = await auditLogService.logEvent('user.created', { userId: 'user-456' });

      expect(result).toBe(true);
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(fs.appendFile).toHaveBeenCalled();
    });

    test('should reject unknown event types', async () => {
      const result = await auditLogService.logEvent('unknown.event', {});

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith('Unknown audit event type:', 'unknown.event');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    test('should handle complete logging failure gracefully', async () => {
      mockFrom.insert.mockReturnValue({ error: { message: 'Database error' } });
      fs.mkdir.mockRejectedValue(new Error('File system error'));

      const result = await auditLogService.logEvent('auth.login', {});

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Failed to log audit event:', expect.any(Error));
    });

    test('should include environment and timestamp in details', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      mockFrom.insert.mockReturnValue({ error: null });

      await auditLogService.logEvent('system.feature_flag_changed', { flag: 'TEST_FLAG' });

      const insertCall = mockFrom.insert.mock.calls[0][0];
      const details = JSON.parse(insertCall.details);

      expect(details.environment).toBe('test');
      expect(details.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      expect(details.flag).toBe('TEST_FLAG');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('saveToDatabaseAuditLog', () => {
    test('should save audit entry to database successfully', async () => {
      const auditEntry = {
        event_type: 'auth.login',
        severity: 'info',
        user_id: 'user-123'
      };

      mockFrom.insert.mockReturnValue({ error: null });

      await expect(auditLogService.saveToDatabaseAuditLog(auditEntry)).resolves.toBeUndefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockFrom.insert).toHaveBeenCalledWith(auditEntry);
    });

    test('should throw error when database operation fails', async () => {
      const auditEntry = { event_type: 'test' };
      const dbError = { message: 'Primary key violation' };

      mockFrom.insert.mockReturnValue({ error: dbError });

      await expect(auditLogService.saveToDatabaseAuditLog(auditEntry)).rejects.toThrow(
        'Database audit log error: Primary key violation'
      );
    });
  });

  describe('saveToFileAuditLog', () => {
    test('should create directory and append to file', async () => {
      const auditEntry = {
        event_type: 'billing.checkout_created',
        severity: 'info',
        created_at: '2024-01-01T00:00:00Z'
      };

      fs.mkdir.mockResolvedValue();
      fs.appendFile.mockResolvedValue();

      await auditLogService.saveToFileAuditLog(auditEntry);

      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(auditLogService.logFile), {
        recursive: true
      });
      expect(fs.appendFile).toHaveBeenCalledWith(
        auditLogService.logFile,
        JSON.stringify(auditEntry) + '\n'
      );
    });

    test('should propagate file system errors', async () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(auditLogService.saveToFileAuditLog({})).rejects.toThrow('Permission denied');
    });
  });

  describe('getRecentLogs', () => {
    test('should retrieve logs from database when Supabase is enabled', async () => {
      const mockLogs = [
        { id: 1, event_type: 'auth.login', severity: 'info' },
        { id: 2, event_type: 'auth.logout', severity: 'info' }
      ];

      const mockQuery = {
        eq: jest.fn(() => mockQuery),
        gte: jest.fn(() => mockQuery),
        lte: jest.fn(() => mockQuery),
        order: jest.fn(() => mockQuery),
        limit: jest.fn(() => mockQuery)
      };

      mockFrom.select.mockReturnValue(mockQuery);
      mockQuery.order.mockReturnValue(mockQuery);
      mockQuery.limit.mockReturnValue({ data: mockLogs, error: null });

      const result = await auditLogService.getRecentLogs({ limit: 50 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockLogs);
      expect(result.source).toBe('database');
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
    });

    test('should apply filters correctly', async () => {
      const filters = {
        eventType: 'auth.login',
        severity: 'warning',
        userId: 'user-123',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      // The service does: from('audit_logs').select('*').order(...).limit(...).eq(...).eq(...).gte(...).lte(...)
      // Then it does: await query, so the query must be thenable
      const mockQueryResult = { data: [], error: null };
      const mockQuery = {
        eq: jest.fn(function (...args) {
          return this;
        }),
        gte: jest.fn(function (...args) {
          return this;
        }),
        lte: jest.fn(function (...args) {
          return this;
        }),
        order: jest.fn(function (...args) {
          return this;
        }),
        limit: jest.fn(function (...args) {
          return this;
        }),
        // Make it thenable so await works
        then: jest.fn((resolve) => {
          return Promise.resolve(mockQueryResult).then(resolve);
        })
      };

      // Configure mockSupabase.from to return a mock with select that returns mockQuery
      const mockTableBuilder = {
        select: jest.fn(() => mockQuery)
      };
      mockSupabase.from.mockReturnValue(mockTableBuilder);

      await auditLogService.getRecentLogs(filters);

      // Verify that filters were applied
      expect(mockQuery.eq).toHaveBeenCalledWith('event_type', 'auth.login');
      expect(mockQuery.eq).toHaveBeenCalledWith('severity', 'warning');
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(mockQuery.lte).toHaveBeenCalledWith('created_at', '2024-01-31');
    });

    test('should retrieve logs from file when Supabase is disabled', async () => {
      flags.isEnabled.mockReturnValue(false);
      const fileContent =
        JSON.stringify({ event_type: 'test1' }) +
        '\n' +
        JSON.stringify({ event_type: 'test2' }) +
        '\n';

      fs.readFile.mockResolvedValue(fileContent);

      const result = await auditLogService.getRecentLogs();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.source).toBe('file');
      expect(result.data[0].event_type).toBe('test1');
      expect(fs.readFile).toHaveBeenCalledWith(auditLogService.logFile, 'utf8');
    });

    test('should handle missing file gracefully', async () => {
      flags.isEnabled.mockReturnValue(false);
      const error = new Error('File not found');
      error.code = 'ENOENT';

      fs.readFile.mockRejectedValue(error);

      const result = await auditLogService.getRecentLogs();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.source).toBe('file');
    });

    test('should handle malformed JSON in log file', async () => {
      flags.isEnabled.mockReturnValue(false);
      const fileContent =
        JSON.stringify({ event_type: 'valid' }) +
        '\n' +
        'invalid json line\n' +
        JSON.stringify({ event_type: 'valid2' }) +
        '\n';

      fs.readFile.mockResolvedValue(fileContent);

      const result = await auditLogService.getRecentLogs();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].event_type).toBe('valid');
      expect(result.data[1].event_type).toBe('valid2');
    });

    test('should handle database errors gracefully', async () => {
      const mockQuery = {
        eq: jest.fn(() => mockQuery),
        order: jest.fn(() => mockQuery),
        limit: jest.fn(() => ({ data: null, error: { message: 'Connection timeout' } }))
      };

      mockFrom.select.mockReturnValue(mockQuery);

      const result = await auditLogService.getRecentLogs();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to retrieve audit logs');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to retrieve audit logs:',
        expect.any(Error)
      );
    });
  });

  describe('helper methods', () => {
    test('logUserLogin should log auth.login event correctly', async () => {
      mockFrom.insert.mockReturnValue({ error: null });

      const result = await auditLogService.logUserLogin('user-123', '192.168.1.1', 'Chrome');

      expect(result).toBe(true);
      const insertCall = mockFrom.insert.mock.calls[0][0];
      expect(insertCall.event_type).toBe('auth.login');
      expect(insertCall.user_id).toBe('user-123');
      expect(insertCall.ip_address).toBe('192.168.1.1');
      expect(insertCall.user_agent).toBe('Chrome');
    });

    test('logBillingEvent should log billing events with correct prefix', async () => {
      mockFrom.insert.mockReturnValue({ error: null });

      await auditLogService.logBillingEvent('payment_failed', { amount: 1000 });

      const insertCall = mockFrom.insert.mock.calls[0][0];
      expect(insertCall.event_type).toBe('billing.payment_failed');
      const details = JSON.parse(insertCall.details);
      expect(details.amount).toBe(1000);
    });

    test('logIntegrationEvent should log integration events correctly', async () => {
      mockFrom.insert.mockReturnValue({ error: null });

      await auditLogService.logIntegrationEvent('connect', 'user-456', 'twitter', {
        accountId: '@testuser'
      });

      const insertCall = mockFrom.insert.mock.calls[0][0];
      expect(insertCall.event_type).toBe('integrations.connect');
      const details = JSON.parse(insertCall.details);
      expect(details.userId).toBe('user-456');
      expect(details.platform).toBe('twitter');
      expect(details.accountId).toBe('@testuser');
    });

    test('logSystemEvent should log system events correctly', async () => {
      mockFrom.insert.mockReturnValue({ error: null });

      await auditLogService.logSystemEvent('api_error', {
        endpoint: '/api/roasts',
        statusCode: 500
      });

      const insertCall = mockFrom.insert.mock.calls[0][0];
      expect(insertCall.event_type).toBe('system.api_error');
      const details = JSON.parse(insertCall.details);
      expect(details.endpoint).toBe('/api/roasts');
      expect(details.statusCode).toBe(500);
    });
  });

  describe('getEventStats', () => {
    test('should return statistics for specified time range', async () => {
      const mockLogs = [
        { event_type: 'auth.login', severity: 'info' },
        { event_type: 'auth.login', severity: 'info' },
        { event_type: 'billing.payment_failed', severity: 'warning' },
        { event_type: 'system.api_error', severity: 'error' }
      ];

      const mockQuery = {
        gte: jest.fn(() => mockQuery),
        order: jest.fn(() => ({ data: mockLogs, error: null }))
      };

      mockFrom.select.mockReturnValue(mockQuery);

      const result = await auditLogService.getEventStats('24h');

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(4);
      expect(result.data.byType['auth.login']).toBe(2);
      expect(result.data.byType['billing.payment_failed']).toBe(1);
      expect(result.data.bySeverity.info).toBe(2);
      expect(result.data.bySeverity.warning).toBe(1);
      expect(result.data.bySeverity.error).toBe(1);
      expect(result.timeRange).toBe('24h');
    });

    test('should return error when Supabase is disabled', async () => {
      flags.isEnabled.mockReturnValue(false);

      const result = await auditLogService.getEventStats();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Statistics only available with database');
    });

    test('should handle database errors in stats', async () => {
      const mockQuery = {
        gte: jest.fn(() => mockQuery),
        order: jest.fn(() => ({ data: null, error: { message: 'Query failed' } }))
      };

      mockFrom.select.mockReturnValue(mockQuery);

      const result = await auditLogService.getEventStats();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to retrieve event statistics');
    });
  });

  describe('getStartDateForRange', () => {
    test('should calculate correct start dates for different ranges', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      const originalNow = Date.now;
      const originalDate = global.Date;

      // Mock Date constructor and Date.now
      global.Date = jest.fn((...args) => {
        if (args.length === 0) {
          return new originalDate('2024-01-01T12:00:00Z');
        }
        return new originalDate(...args);
      });
      global.Date.now = jest.fn(() => now.getTime());
      global.Date.prototype = originalDate.prototype;

      expect(auditLogService.getStartDateForRange('1h')).toBe(
        new Date('2024-01-01T11:00:00Z').toISOString()
      );

      expect(auditLogService.getStartDateForRange('24h')).toBe(
        new Date('2023-12-31T12:00:00Z').toISOString()
      );

      expect(auditLogService.getStartDateForRange('7d')).toBe(
        new Date('2023-12-25T12:00:00Z').toISOString()
      );

      expect(auditLogService.getStartDateForRange('30d')).toBe(
        new Date('2023-12-02T12:00:00Z').toISOString()
      );

      // Should default to 24h for unknown ranges
      expect(auditLogService.getStartDateForRange('unknown')).toBe(
        new Date('2023-12-31T12:00:00Z').toISOString()
      );

      global.Date = originalDate;
      Date.now = originalNow;
    });
  });

  describe('cleanOldLogs', () => {
    test('should clean old logs when Supabase is enabled', async () => {
      const mockDelete = {
        lt: jest.fn(() => ({ error: null }))
      };

      mockFrom.delete.mockReturnValue(mockDelete);

      const result = await auditLogService.cleanOldLogs(30);

      expect(result).toBe(true);
      expect(mockFrom.delete).toHaveBeenCalled();
      expect(mockDelete.lt).toHaveBeenCalledWith('created_at', expect.any(String));
      expect(logger.info).toHaveBeenCalledWith('Cleaned audit logs older than 30 days');
    });

    test('should return false when Supabase is disabled', async () => {
      flags.isEnabled.mockReturnValue(false);

      const result = await auditLogService.cleanOldLogs(90);

      expect(result).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('File-based audit logs require manual cleanup');
    });

    test('should handle cleanup errors gracefully', async () => {
      const mockDelete = {
        lt: jest.fn(() => Promise.resolve({ error: { message: 'Delete failed' } }))
      };

      mockFrom.delete.mockReturnValue(mockDelete);

      const result = await auditLogService.cleanOldLogs(90);

      expect(result).toBe(false);
      // The service wraps the error object in an Error, so check for either
      expect(logger.error).toHaveBeenCalled();
      const errorCall = logger.error.mock.calls.find(
        (call) => call[0] === 'Failed to clean old audit logs:'
      );
      expect(errorCall).toBeDefined();
    });
  });

  describe('singleton instance', () => {
    test('should export singleton auditLogger instance', () => {
      expect(auditLogger).toBeInstanceOf(AuditLogService);
      expect(auditLogger.eventTypes).toBeDefined();
    });
  });

  // ROA-357: Tests for v2 taxonomy support
  describe('v2 Taxonomy Support (ROA-357)', () => {
    beforeEach(() => {
      flags.isEnabled.mockReturnValue(true);
    });

    describe('v2 event logging', () => {
      test('should log v2 event directly', async () => {
        const result = await auditLogService.logEvent(
          'auth.session.login.success',
          { userId: 'user-123', ipAddress: '127.0.0.1' }
        );

        expect(result).toBe(true);
        expect(mockFrom.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.session.login.success',
            severity: 'info',
            description: 'User successfully logged in'
          })
        );
      });

      test('should map v1 event to v2 automatically', async () => {
        const result = await auditLogService.logEvent('auth.login', {
          userId: 'user-123',
          ipAddress: '127.0.0.1'
        });

        expect(result).toBe(true);
        expect(mockFrom.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.session.login.success'
          })
        );
      });

      test('should support v2 password reset events', async () => {
        const result = await auditLogService.logEvent(
          'auth.password.reset.requested',
          { userId: 'user-123', email: 'test@example.com' }
        );

        expect(result).toBe(true);
        expect(mockFrom.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.password.reset.requested',
            severity: 'warning'
          })
        );
      });
    });

    describe('v2 helper methods', () => {
      test('logUserLogin should use v2 event', async () => {
        const result = await auditLogService.logUserLogin(
          'user-123',
          '127.0.0.1',
          'Mozilla/5.0'
        );

        expect(result).toBe(true);
        expect(mockFrom.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.session.login.success'
          })
        );
      });

      test('logUserLoginFailed should log failed login', async () => {
        const result = await auditLogService.logUserLoginFailed(
          'user-123',
          '127.0.0.1',
          'Mozilla/5.0',
          'invalid_credentials'
        );

        expect(result).toBe(true);
        expect(mockFrom.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.session.login.failed',
            severity: 'warning'
          })
        );
      });

      test('logUserLogout should support manual and automatic', async () => {
        await auditLogService.logUserLogout('user-123', '127.0.0.1', 'Mozilla/5.0', 'manual');
        expect(mockFrom.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.session.logout.manual'
          })
        );

        await auditLogService.logUserLogout('user-123', '127.0.0.1', 'Mozilla/5.0', 'automatic');
        expect(mockFrom.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.session.logout.automatic'
          })
        );
      });

      test('logUserSignup should log registration events', async () => {
        await auditLogService.logUserSignup('user-123', 'test@example.com', true);
        expect(mockFrom.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.registration.signup.success'
          })
        );

        await auditLogService.logUserSignup('user-123', 'test@example.com', false);
        expect(mockFrom.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.registration.signup.failed'
          })
        );
      });

      test('logPasswordResetRequested should log reset request', async () => {
        const result = await auditLogService.logPasswordResetRequested(
          'user-123',
          'test@example.com'
        );

        expect(result).toBe(true);
        expect(mockFrom.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.password.reset.requested'
          })
        );
      });

      test('logPasswordResetCompleted should log reset completion', async () => {
        const result = await auditLogService.logPasswordResetCompleted(
          'user-123',
          'test@example.com'
        );

        expect(result).toBe(true);
        expect(mockFrom.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.password.reset.completed'
          })
        );
      });

      test('logMagicLinkLoginSent should log magic link sent', async () => {
        const result = await auditLogService.logMagicLinkLoginSent(
          'user-123',
          'test@example.com'
        );

        expect(result).toBe(true);
        expect(mockFrom.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.magic_link.login.sent'
          })
        );
      });

      test('logOAuthInitiated should log OAuth initiation', async () => {
        const result = await auditLogService.logOAuthInitiated('google', 'user-123');

        expect(result).toBe(true);
        expect(mockFrom.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.oauth.initiated'
          })
        );
      });
    });

    describe('backward compatibility', () => {
      test('should still support v1 events', async () => {
        const result = await auditLogService.logEvent('auth.login', {
          userId: 'user-123'
        });

        expect(result).toBe(true);
        // Should be mapped to v2 but still work
        expect(mockFrom.insert).toHaveBeenCalled();
      });

      test('should maintain v1 event types in eventTypes object', () => {
        expect(auditLogService.eventTypes['auth.login']).toBeDefined();
        expect(auditLogService.eventTypes['auth.logout']).toBeDefined();
        expect(auditLogService.eventTypes['auth.failed_login']).toBeDefined();
      });
    });
  });
});
