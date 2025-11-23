/**
 * Log Maintenance Service Tests
 *
 * Tests for log maintenance functionality including:
 * - Service initialization and configuration
 * - Scheduled cleanup and backup jobs
 * - Health monitoring and alerting
 * - Manual operations
 * - Error handling and recovery
 */

const { CronJob } = require('cron');
const LogMaintenanceService = require('../../../src/utils/logMaintenance');
const LogBackupService = require('../../../src/services/logBackupService');

// Mock dependencies
jest.mock('cron');
jest.mock('../../../src/services/logBackupService');
jest.mock('../../../src/services/alertService');
jest.mock('../../../src/utils/advancedLogger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  cleanOldLogs: jest.fn(),
  getLogStatistics: jest.fn(),
  formatFileSize: jest.fn((size) => `${size} bytes`)
}));

describe('LogMaintenanceService', () => {
  let logMaintenanceService;
  let mockBackupService;
  let mockCronJob;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set up test environment
    process.env.LOG_CLEANUP_ENABLED = 'true';
    process.env.LOG_RETENTION_APPLICATION_DAYS = '30';
    process.env.LOG_RETENTION_INTEGRATION_DAYS = '14';
    process.env.LOG_RETENTION_SHIELD_DAYS = '7';
    process.env.LOG_RETENTION_SECURITY_DAYS = '90';
    process.env.LOG_RETENTION_WORKER_DAYS = '7';
    process.env.LOG_RETENTION_AUDIT_DAYS = '365';
    process.env.LOG_CLEANUP_SCHEDULE = '0 2 * * *';

    process.env.LOG_BACKUP_ENABLED = 'true';
    process.env.LOG_BACKUP_RECENT_DAYS = '7';
    process.env.LOG_BACKUP_RETENTION_DAYS = '90';
    process.env.LOG_BACKUP_SCHEDULE = '0 3 * * *';
    process.env.LOG_BACKUP_CLEANUP_SCHEDULE = '0 4 0 * *';

    process.env.LOG_MONITORING_ENABLED = 'true';
    process.env.LOG_MONITORING_SCHEDULE = '0 */6 * * *';
    process.env.LOG_ALERT_THRESHOLD_GB = '5.0';

    // Mock CronJob
    mockCronJob = {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn()
    };
    CronJob.mockImplementation(() => mockCronJob);

    // Mock LogBackupService
    mockBackupService = {
      isBackupEnabled: jest.fn().mockReturnValue(true),
      backupRecentLogs: jest.fn(),
      cleanOldBackups: jest.fn()
    };
    LogBackupService.mockImplementation(() => mockBackupService);

    logMaintenanceService = new LogMaintenanceService();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(logMaintenanceService.config.cleanup.enabled).toBe(true);
      expect(logMaintenanceService.config.cleanup.applicationDays).toBe(30);
      expect(logMaintenanceService.config.cleanup.integrationDays).toBe(14);
      expect(logMaintenanceService.config.cleanup.shieldDays).toBe(7);
      expect(logMaintenanceService.config.cleanup.securityDays).toBe(90);
      expect(logMaintenanceService.config.cleanup.workerDays).toBe(7);
      expect(logMaintenanceService.config.cleanup.auditDays).toBe(365);
      expect(logMaintenanceService.config.cleanup.schedule).toBe('0 2 * * *');
    });

    test('should initialize backup configuration', () => {
      expect(logMaintenanceService.config.backup.enabled).toBe(true);
      expect(logMaintenanceService.config.backup.dailyBackupDays).toBe(7);
      expect(logMaintenanceService.config.backup.retentionDays).toBe(90);
      expect(logMaintenanceService.config.backup.schedule).toBe('0 3 * * *');
      expect(logMaintenanceService.config.backup.cleanupSchedule).toBe('0 4 0 * *');
    });

    test('should initialize monitoring configuration', () => {
      expect(logMaintenanceService.config.monitoring.enabled).toBe(true);
      expect(logMaintenanceService.config.monitoring.schedule).toBe('0 */6 * * *');
      expect(logMaintenanceService.config.monitoring.alertThresholdGB).toBe(5.0);
    });

    test('should use default values for missing environment variables', () => {
      delete process.env.LOG_RETENTION_APPLICATION_DAYS;
      delete process.env.LOG_BACKUP_RECENT_DAYS;
      delete process.env.LOG_ALERT_THRESHOLD_GB;

      const service = new LogMaintenanceService();

      expect(service.config.cleanup.applicationDays).toBe(30); // default
      expect(service.config.backup.dailyBackupDays).toBe(7); // default
      expect(service.config.monitoring.alertThresholdGB).toBe(5.0); // default
    });
  });

  describe('start', () => {
    test('should start all enabled services', async () => {
      await logMaintenanceService.start();

      expect(logMaintenanceService.isRunning).toBe(true);
      expect(CronJob).toHaveBeenCalledTimes(4); // cleanup, backup, backup_cleanup, monitoring
    });

    test('should skip backup jobs when S3 is not configured', async () => {
      mockBackupService.isBackupEnabled.mockReturnValue(false);

      await logMaintenanceService.start();

      expect(logMaintenanceService.isRunning).toBe(true);
      expect(CronJob).toHaveBeenCalledTimes(2); // cleanup, monitoring only
    });

    test('should skip disabled services', async () => {
      process.env.LOG_CLEANUP_ENABLED = 'false';
      process.env.LOG_BACKUP_ENABLED = 'false';
      process.env.LOG_MONITORING_ENABLED = 'false';

      const service = new LogMaintenanceService();
      await service.start();

      expect(CronJob).not.toHaveBeenCalled();
    });

    test('should not start if already running', async () => {
      logMaintenanceService.isRunning = true;

      await logMaintenanceService.start();

      expect(CronJob).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      await logMaintenanceService.start();
    });

    test('should stop all running jobs', async () => {
      await logMaintenanceService.stop();

      expect(logMaintenanceService.isRunning).toBe(false);
      expect(mockCronJob.stop).toHaveBeenCalledTimes(4);
      expect(mockCronJob.destroy).toHaveBeenCalledTimes(4);
    });

    test('should handle stop when not running', async () => {
      logMaintenanceService.isRunning = false;

      await logMaintenanceService.stop();

      // Should not throw error
      expect(logMaintenanceService.isRunning).toBe(false);
    });
  });

  describe('runCleanup', () => {
    test('should perform manual cleanup with default options', async () => {
      const mockCleanupResult = {
        filesRemoved: 10,
        sizeFreed: 1024000
      };

      require('../../../src/utils/advancedLogger').cleanOldLogs.mockResolvedValue(
        mockCleanupResult
      );

      const result = await logMaintenanceService.runCleanup();

      expect(require('../../../src/utils/advancedLogger').cleanOldLogs).toHaveBeenCalledWith({
        applicationDays: 30,
        integrationDays: 14,
        shieldDays: 7,
        securityDays: 90,
        workerDays: 7,
        auditDays: 365,
        dryRun: false
      });

      expect(result).toEqual(mockCleanupResult);
    });

    test('should perform dry run cleanup', async () => {
      const mockCleanupResult = {
        filesRemoved: 5,
        sizeFreed: 512000
      };

      require('../../../src/utils/advancedLogger').cleanOldLogs.mockResolvedValue(
        mockCleanupResult
      );

      const result = await logMaintenanceService.runCleanup({ dryRun: true });

      expect(require('../../../src/utils/advancedLogger').cleanOldLogs).toHaveBeenCalledWith(
        expect.objectContaining({ dryRun: true })
      );

      expect(result).toEqual(mockCleanupResult);
    });

    test('should use custom retention days', async () => {
      const customOptions = {
        applicationDays: 60,
        auditDays: 730
      };

      await logMaintenanceService.runCleanup(customOptions);

      expect(require('../../../src/utils/advancedLogger').cleanOldLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationDays: 60,
          auditDays: 730
        })
      );
    });

    test('should handle cleanup errors', async () => {
      const error = new Error('Cleanup failed');
      require('../../../src/utils/advancedLogger').cleanOldLogs.mockRejectedValue(error);

      await expect(logMaintenanceService.runCleanup()).rejects.toThrow('Cleanup failed');
    });
  });

  describe('runBackup', () => {
    test('should perform manual backup with default options', async () => {
      const mockBackupResult = {
        summary: {
          totalDays: 7,
          totalUploaded: 20,
          totalSkipped: 5,
          totalSizeFormatted: '10.5 MB',
          successRate: '95%'
        }
      };

      mockBackupService.backupRecentLogs.mockResolvedValue(mockBackupResult);

      const result = await logMaintenanceService.runBackup();

      expect(mockBackupService.backupRecentLogs).toHaveBeenCalledWith(7, {
        dryRun: false,
        skipExisting: true
      });

      expect(result).toEqual(mockBackupResult);
    });

    test('should perform dry run backup', async () => {
      const mockBackupResult = {
        summary: { totalDays: 3, totalUploaded: 10 }
      };

      mockBackupService.backupRecentLogs.mockResolvedValue(mockBackupResult);

      const result = await logMaintenanceService.runBackup({
        days: 3,
        dryRun: true
      });

      expect(mockBackupService.backupRecentLogs).toHaveBeenCalledWith(3, {
        dryRun: true,
        skipExisting: true
      });

      expect(result).toEqual(mockBackupResult);
    });

    test('should handle backup errors', async () => {
      const error = new Error('Backup failed');
      mockBackupService.backupRecentLogs.mockRejectedValue(error);

      await expect(logMaintenanceService.runBackup()).rejects.toThrow('Backup failed');
    });
  });

  describe('getStatus', () => {
    test('should return service status', async () => {
      await logMaintenanceService.start();

      const status = await logMaintenanceService.getStatus();

      expect(status).toEqual({
        isRunning: true,
        activeJobs: expect.any(Array),
        config: logMaintenanceService.config,
        backupEnabled: true
      });
    });

    test('should include job names in active jobs', async () => {
      await logMaintenanceService.start();

      const status = await logMaintenanceService.getStatus();

      expect(status.activeJobs).toContain('cleanup');
      expect(status.activeJobs).toContain('backup');
      expect(status.activeJobs).toContain('backup_cleanup');
      expect(status.activeJobs).toContain('monitoring');
    });
  });

  describe('performHealthCheck', () => {
    test('should perform health check and return statistics', async () => {
      const mockStats = {
        totalSize: 1024000,
        totalSizeFormatted: '1.0 MB',
        fileCount: 100,
        oldestFile: new Date('2024-01-01'),
        newestFile: new Date('2024-01-31')
      };

      require('../../../src/utils/advancedLogger').getLogStatistics.mockResolvedValue(mockStats);

      const result = await logMaintenanceService.performHealthCheck();

      expect(result).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        statistics: mockStats,
        alerts: []
      });
    });

    test('should detect high disk usage and create alert', async () => {
      const mockStats = {
        totalSize: 6 * 1024 * 1024 * 1024, // 6 GB
        totalSizeFormatted: '6.0 GB',
        fileCount: 1000
      };

      require('../../../src/utils/advancedLogger').getLogStatistics.mockResolvedValue(mockStats);

      const result = await logMaintenanceService.performHealthCheck();

      expect(result.status).toBe('warning');
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toEqual({
        type: 'high_disk_usage',
        severity: 'warning',
        message: expect.stringContaining('Log directory size (6.0 GB) exceeds threshold')
      });
    });

    test('should handle health check errors', async () => {
      const error = new Error('Health check failed');
      require('../../../src/utils/advancedLogger').getLogStatistics.mockRejectedValue(error);

      const result = await logMaintenanceService.performHealthCheck();

      expect(result.status).toBe('error');
      expect(result.error).toBe('Health check failed');
    });
  });
});
