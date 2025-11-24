const advancedLogger = require('./advancedLogger');
const LogBackupService = require('../services/logBackupService');
const AlertService = require('../services/alertService');
const { CronJob } = require('cron');
const { formatFileSize } = require('./formatUtils');

class LogMaintenanceService {
  constructor() {
    this.logger = advancedLogger;
    this.backupService = new LogBackupService();
    this.alertService = new AlertService();
    this.maintenanceJobs = new Map();
    this.isRunning = false;

    // Default configuration
    this.config = {
      // Cleanup configuration
      cleanup: {
        enabled: process.env.LOG_CLEANUP_ENABLED !== 'false', // Default enabled
        applicationDays: parseInt(process.env.LOG_RETENTION_APPLICATION_DAYS) || 30,
        integrationDays: parseInt(process.env.LOG_RETENTION_INTEGRATION_DAYS) || 30,
        shieldDays: parseInt(process.env.LOG_RETENTION_SHIELD_DAYS) || 90,
        securityDays: parseInt(process.env.LOG_RETENTION_SECURITY_DAYS) || 90,
        workerDays: parseInt(process.env.LOG_RETENTION_WORKER_DAYS) || 30,
        auditDays: parseInt(process.env.LOG_RETENTION_AUDIT_DAYS) || 365,
        schedule: process.env.LOG_CLEANUP_SCHEDULE || '0 2 * * *' // Daily at 2 AM
      },

      // Backup configuration
      backup: {
        enabled: process.env.LOG_BACKUP_ENABLED === 'true',
        dailyBackupDays: parseInt(process.env.LOG_BACKUP_RECENT_DAYS) || 7,
        retentionDays: parseInt(process.env.LOG_BACKUP_RETENTION_DAYS) || 90,
        schedule: process.env.LOG_BACKUP_SCHEDULE || '0 3 * * *', // Daily at 3 AM
        cleanupSchedule: process.env.LOG_BACKUP_CLEANUP_SCHEDULE || '0 4 0 * *' // Weekly on Sunday at 4 AM
      },

      // Statistics and monitoring
      monitoring: {
        enabled: process.env.LOG_MONITORING_ENABLED !== 'false',
        schedule: process.env.LOG_MONITORING_SCHEDULE || '0 */6 * * *', // Every 6 hours
        alertThresholdGB: parseFloat(process.env.LOG_ALERT_THRESHOLD_GB) || 5.0
      }
    };
  }

  /**
   * Start all maintenance jobs
   */
  start() {
    if (this.isRunning) {
      this.logger.warn('Log maintenance service is already running');
      return;
    }

    // Validate configuration at startup
    this.validateStartupConfiguration();

    this.logger.info('Starting log maintenance service', { config: this.config });

    try {
      // Start cleanup job
      if (this.config.cleanup.enabled) {
        this.startCleanupJob();
      }

      // Start backup jobs
      if (this.config.backup.enabled && this.backupService.isBackupEnabled()) {
        this.startBackupJobs();
      } else if (this.config.backup.enabled) {
        this.logger.warn('Backup is enabled but S3 is not configured properly');
      }

      // Start monitoring job
      if (this.config.monitoring.enabled) {
        this.startMonitoringJob();
      }

      this.isRunning = true;
      this.logger.info('Log maintenance service started successfully', {
        activeJobs: Array.from(this.maintenanceJobs.keys())
      });
    } catch (error) {
      this.logger.error('Failed to start log maintenance service', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop all maintenance jobs
   */
  stop() {
    if (!this.isRunning) {
      this.logger.warn('Log maintenance service is not running');
      return;
    }

    this.logger.info('Stopping log maintenance service');

    this.maintenanceJobs.forEach((job, name) => {
      try {
        job.stop();
        this.logger.info(`Stopped maintenance job: ${name}`);
      } catch (error) {
        this.logger.error(`Failed to stop maintenance job: ${name}`, { error: error.message });
      }
    });

    this.maintenanceJobs.clear();
    this.isRunning = false;

    this.logger.info('Log maintenance service stopped');
  }

  /**
   * Start log cleanup job
   */
  startCleanupJob() {
    const job = new CronJob(
      this.config.cleanup.schedule,
      async () => {
        const jobContext = {
          jobType: 'cleanup',
          startTime: new Date(),
          schedule: this.config.cleanup.schedule
        };

        try {
          this.logger.info('Starting scheduled log cleanup', jobContext);

          const cleanupOptions = {
            applicationDays: this.config.cleanup.applicationDays,
            integrationDays: this.config.cleanup.integrationDays,
            shieldDays: this.config.cleanup.shieldDays,
            securityDays: this.config.cleanup.securityDays,
            workerDays: this.config.cleanup.workerDays,
            auditDays: this.config.cleanup.auditDays,
            dryRun: false
          };

          const result = await this.logger.cleanOldLogs(cleanupOptions);

          const duration = Date.now() - jobContext.startTime.getTime();
          this.logger.info('Scheduled log cleanup completed', {
            ...jobContext,
            duration: `${duration}ms`,
            filesRemoved: result.filesRemoved,
            sizeFreed: this.logger.formatFileSize(result.sizeFreed)
          });

          // Alert if cleanup failed
          if (result.filesRemoved === 0) {
            this.logger.warn(
              'Log cleanup completed but no files were removed - check retention settings',
              jobContext
            );
          }
        } catch (error) {
          const duration = Date.now() - jobContext.startTime.getTime();
          const errorDetails = {
            ...jobContext,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
            errorType: error.constructor.name
          };

          this.logger.error('Scheduled log cleanup failed', errorDetails);

          try {
            await this.sendAlert('cleanup_failed', errorDetails);
          } catch (alertError) {
            this.logger.error('Failed to send cleanup failure alert', {
              originalError: error.message,
              alertError: alertError.message
            });
          }
        }
      },
      null, // onComplete
      true, // start immediately
      'UTC' // timezone
    );

    // Add error handler for the cron job itself
    job.addCallback(() => {
      this.logger.debug('Cleanup cron job callback executed', {
        schedule: this.config.cleanup.schedule,
        nextRun: job.nextDates().toISOString()
      });
    });

    this.maintenanceJobs.set('cleanup', job);
    this.logger.info('Log cleanup job scheduled', {
      schedule: this.config.cleanup.schedule,
      nextRun: job.nextDates().toISOString()
    });
  }

  /**
   * Start backup jobs
   */
  startBackupJobs() {
    // Daily backup job
    const backupJob = new CronJob(
      this.config.backup.schedule,
      async () => {
        const jobContext = {
          jobType: 'backup',
          startTime: new Date(),
          schedule: this.config.backup.schedule
        };

        try {
          this.logger.info('Starting scheduled log backup', jobContext);

          const result = await this.backupService.backupRecentLogs(
            this.config.backup.dailyBackupDays,
            { skipExisting: true }
          );

          const duration = Date.now() - jobContext.startTime.getTime();
          this.logger.info('Scheduled log backup completed', {
            ...jobContext,
            duration: `${duration}ms`,
            ...result.summary
          });

          // Alert if backup has high error rate
          const errorRate = (result.summary.errorDates.length / result.summary.totalDays) * 100;
          if (errorRate > 20) {
            try {
              await this.sendAlert('backup_high_error_rate', {
                ...jobContext,
                errorRate: errorRate.toFixed(1) + '%',
                errorDates: result.summary.errorDates
              });
            } catch (alertError) {
              this.logger.error('Failed to send backup high error rate alert', {
                errorRate,
                alertError: alertError.message
              });
            }
          }
        } catch (error) {
          const duration = Date.now() - jobContext.startTime.getTime();
          const errorDetails = {
            ...jobContext,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
            errorType: error.constructor.name
          };

          this.logger.error('Scheduled log backup failed', errorDetails);

          try {
            await this.sendAlert('backup_failed', errorDetails);
          } catch (alertError) {
            this.logger.error('Failed to send backup failure alert', {
              originalError: error.message,
              alertError: alertError.message
            });
          }
        }
      },
      null, // onComplete
      true, // start immediately
      'UTC' // timezone
    );

    // Weekly backup cleanup job
    const cleanupJob = new CronJob(
      this.config.backup.cleanupSchedule,
      async () => {
        try {
          this.logger.info('Starting scheduled backup cleanup');

          const result = await this.backupService.cleanOldBackups(
            this.config.backup.retentionDays,
            { dryRun: false }
          );

          this.logger.info('Scheduled backup cleanup completed', {
            deleted: result.deleted.length,
            totalSizeFreed: formatFileSize(result.totalSize),
            errors: result.errors.length
          });
        } catch (error) {
          this.logger.error('Scheduled backup cleanup failed', { error: error.message });
          await this.sendAlert('backup_cleanup_failed', { error: error.message });
        }
      },
      null, // onComplete
      true, // start immediately
      'UTC' // timezone
    );

    this.maintenanceJobs.set('backup', backupJob);
    this.maintenanceJobs.set('backup_cleanup', cleanupJob);

    this.logger.info('Backup jobs scheduled', {
      backup: this.config.backup.schedule,
      cleanup: this.config.backup.cleanupSchedule
    });
  }

  /**
   * Start monitoring job
   */
  startMonitoringJob() {
    const job = new CronJob(
      this.config.monitoring.schedule,
      async () => {
        try {
          await this.performHealthCheck();
        } catch (error) {
          this.logger.error('Log monitoring health check failed', { error: error.message });
        }
      },
      null, // onComplete
      true, // start immediately
      'UTC' // timezone
    );

    this.maintenanceJobs.set('monitoring', job);
    this.logger.info('Log monitoring job scheduled', { schedule: this.config.monitoring.schedule });
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    this.logger.info('Starting log system health check');

    const healthReport = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      issues: [],
      statistics: null,
      backup: null
    };

    try {
      // Get log statistics
      const stats = await this.logger.getLogStatistics();
      healthReport.statistics = stats;

      // Check for size alerts
      const totalSizeGB = stats.totalSize / (1024 * 1024 * 1024);
      if (totalSizeGB > this.config.monitoring.alertThresholdGB) {
        healthReport.issues.push({
          type: 'size_alert',
          message: `Total log size (${stats.totalSizeFormatted}) exceeds threshold (${this.config.monitoring.alertThresholdGB}GB)`,
          severity: 'warning'
        });
      }

      // Check for very old logs
      if (stats.oldestLog) {
        const oldestDate = new Date(stats.oldestLog.mtime);
        const daysSinceOldest = Math.floor(
          (Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceOldest > 365) {
          healthReport.issues.push({
            type: 'old_logs',
            message: `Oldest log is ${daysSinceOldest} days old (${stats.oldestLog.file})`,
            severity: 'warning'
          });
        }
      }

      // Check backup status if enabled
      if (this.config.backup.enabled && this.backupService.isBackupEnabled()) {
        try {
          const backupList = await this.backupService.listBackups({ maxKeys: 10 });
          healthReport.backup = {
            enabled: true,
            recentBackups: backupList.totalObjects,
            totalSize: formatFileSize(backupList.totalSize)
          };

          // Check if backups are recent
          if (backupList.backups.length > 0) {
            const latestBackup = new Date(
              Math.max(...backupList.backups.map((b) => new Date(b.lastModified)))
            );
            const hoursSinceLastBackup = (Date.now() - latestBackup.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLastBackup > 48) {
              healthReport.issues.push({
                type: 'stale_backup',
                message: `Last backup is ${Math.floor(hoursSinceLastBackup)} hours old`,
                severity: 'warning'
              });
            }
          }
        } catch (error) {
          healthReport.backup = { enabled: true, error: error.message };
          healthReport.issues.push({
            type: 'backup_error',
            message: `Backup check failed: ${error.message}`,
            severity: 'error'
          });
        }
      } else {
        healthReport.backup = { enabled: false };
      }

      // Determine overall status
      const errorIssues = healthReport.issues.filter((i) => i.severity === 'error');
      const warningIssues = healthReport.issues.filter((i) => i.severity === 'warning');

      if (errorIssues.length > 0) {
        healthReport.status = 'error';
      } else if (warningIssues.length > 0) {
        healthReport.status = 'warning';
      }

      // Log health report
      this.logger.info('Log system health check completed', {
        status: healthReport.status,
        totalSize: stats.totalSizeFormatted,
        totalFiles: stats.totalFiles,
        issues: healthReport.issues.length,
        backupEnabled: healthReport.backup?.enabled || false
      });

      // Send alerts for issues
      if (healthReport.issues.length > 0) {
        await this.sendAlert('health_issues', {
          status: healthReport.status,
          issues: healthReport.issues
        });
      }

      return healthReport;
    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Manual cleanup operation
   */
  async runCleanup(options = {}) {
    const cleanupOptions = {
      applicationDays: options.applicationDays || this.config.cleanup.applicationDays,
      integrationDays: options.integrationDays || this.config.cleanup.integrationDays,
      shieldDays: options.shieldDays || this.config.cleanup.shieldDays,
      securityDays: options.securityDays || this.config.cleanup.securityDays,
      workerDays: options.workerDays || this.config.cleanup.workerDays,
      auditDays: options.auditDays || this.config.cleanup.auditDays,
      dryRun: options.dryRun || false
    };

    this.logger.info('Starting manual log cleanup', cleanupOptions);

    try {
      const result = await this.logger.cleanOldLogs(cleanupOptions);

      this.logger.info('Manual log cleanup completed', {
        filesRemoved: result.filesRemoved,
        sizeFreed: this.logger.formatFileSize(result.sizeFreed),
        dryRun: result.dryRun
      });

      return result;
    } catch (error) {
      this.logger.error('Manual log cleanup failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Manual backup operation
   */
  async runBackup(options = {}) {
    const backupOptions = {
      days: options.days || this.config.backup.dailyBackupDays,
      dryRun: options.dryRun || false,
      skipExisting: options.skipExisting !== false
    };

    this.logger.info('Starting manual log backup', backupOptions);

    try {
      const result = await this.backupService.backupRecentLogs(backupOptions.days, {
        dryRun: backupOptions.dryRun,
        skipExisting: backupOptions.skipExisting
      });

      this.logger.info('Manual log backup completed', result.summary);
      return result;
    } catch (error) {
      this.logger.error('Manual log backup failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Send alert for maintenance issues
   */
  async sendAlert(alertType, data) {
    try {
      // Use the integrated alert service
      const result = await this.alertService.sendAlert(alertType, data, {
        service: 'log-maintenance'
      });

      if (result.sent) {
        this.logger.info('Maintenance alert sent successfully', {
          alertType,
          successCount: result.successCount,
          totalChannels: result.totalChannels
        });
      } else {
        this.logger.warn('Maintenance alert not sent', {
          alertType,
          reason: result.reason || 'unknown'
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to send maintenance alert', {
        alertType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get maintenance service status
   */
  getStatus() {
    return {
      running: this.isRunning,
      config: this.config,
      activeJobs: Array.from(this.maintenanceJobs.keys()),
      backupService: this.backupService.getStatus(),
      nextRuns: this.getNextRunTimes()
    };
  }

  /**
   * Get next run times for all jobs
   */
  getNextRunTimes() {
    const nextRuns = {};

    this.maintenanceJobs.forEach((job, name) => {
      if (job.running) {
        nextRuns[name] = job.nextDates().toISOString();
      }
    });

    return nextRuns;
  }

  /**
   * Validate startup configuration including cron expressions and S3 setup
   */
  validateStartupConfiguration() {
    // Validate all cron expressions in the configuration
    const cronFields = [
      { field: 'cleanup.schedule', value: this.config.cleanup.schedule },
      { field: 'backup.schedule', value: this.config.backup.schedule },
      { field: 'backup.cleanupSchedule', value: this.config.backup.cleanupSchedule },
      { field: 'monitoring.schedule', value: this.config.monitoring.schedule }
    ];

    cronFields.forEach(({ field, value }) => {
      if (value && !this.isValidCronExpression(value)) {
        throw new Error(`Invalid cron expression for ${field}: "${value}"`);
      }
    });

    // Validate S3 configuration if backup is enabled
    if (this.config.backup.enabled) {
      const s3Status = this.backupService.getStatus();

      if (!s3Status.configured.bucket) {
        throw new Error(
          'S3 backup is enabled but LOG_BACKUP_S3_BUCKET environment variable is not set'
        );
      }

      if (!s3Status.configured.credentials) {
        throw new Error(
          'S3 backup is enabled but AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are not configured'
        );
      }

      if (!s3Status.configured.s3) {
        throw new Error('S3 backup is enabled but S3 client initialization failed');
      }

      this.logger.info('S3 backup configuration validated', {
        bucket: s3Status.bucket,
        region: s3Status.region,
        prefix: s3Status.prefix
      });
    }

    // Validate retention days are reasonable
    const retentionFields = [
      { field: 'cleanup.applicationDays', value: this.config.cleanup.applicationDays, max: 365 },
      { field: 'cleanup.integrationDays', value: this.config.cleanup.integrationDays, max: 365 },
      { field: 'cleanup.shieldDays', value: this.config.cleanup.shieldDays, max: 365 },
      { field: 'cleanup.securityDays', value: this.config.cleanup.securityDays, max: 1095 }, // 3 years for security logs
      { field: 'cleanup.workerDays', value: this.config.cleanup.workerDays, max: 365 },
      { field: 'cleanup.auditDays', value: this.config.cleanup.auditDays, max: 2555 }, // 7 years for audit logs
      { field: 'backup.retentionDays', value: this.config.backup.retentionDays, max: 3650 } // 10 years max
    ];

    retentionFields.forEach(({ field, value, max }) => {
      if (value < 0) {
        throw new Error(`${field} cannot be negative: ${value}`);
      }
      if (value > max) {
        this.logger.warn(`${field} exceeds recommended maximum`, { value, max, field });
      }
    });

    this.logger.info('Startup configuration validation completed successfully');
  }

  /**
   * Validate configuration object
   */
  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be a valid object');
    }

    // Validate cleanup configuration
    if (config.cleanup) {
      const { cleanup } = config;

      if (cleanup.applicationDays !== undefined) {
        if (typeof cleanup.applicationDays !== 'number' || cleanup.applicationDays < 0) {
          throw new Error('cleanup.applicationDays must be a non-negative number');
        }
      }

      if (cleanup.integrationDays !== undefined) {
        if (typeof cleanup.integrationDays !== 'number' || cleanup.integrationDays < 0) {
          throw new Error('cleanup.integrationDays must be a non-negative number');
        }
      }

      if (cleanup.shieldDays !== undefined) {
        if (typeof cleanup.shieldDays !== 'number' || cleanup.shieldDays < 0) {
          throw new Error('cleanup.shieldDays must be a non-negative number');
        }
      }

      if (cleanup.securityDays !== undefined) {
        if (typeof cleanup.securityDays !== 'number' || cleanup.securityDays < 0) {
          throw new Error('cleanup.securityDays must be a non-negative number');
        }
      }

      if (cleanup.workerDays !== undefined) {
        if (typeof cleanup.workerDays !== 'number' || cleanup.workerDays < 0) {
          throw new Error('cleanup.workerDays must be a non-negative number');
        }
      }

      if (cleanup.auditDays !== undefined) {
        if (typeof cleanup.auditDays !== 'number' || cleanup.auditDays < 0) {
          throw new Error('cleanup.auditDays must be a non-negative number');
        }
      }

      if (cleanup.schedule !== undefined) {
        if (typeof cleanup.schedule !== 'string' || !this.isValidCronExpression(cleanup.schedule)) {
          throw new Error('cleanup.schedule must be a valid cron expression');
        }
      }
    }

    // Validate backup configuration
    if (config.backup) {
      const { backup } = config;

      if (backup.dailyBackupDays !== undefined) {
        if (typeof backup.dailyBackupDays !== 'number' || backup.dailyBackupDays < 0) {
          throw new Error('backup.dailyBackupDays must be a non-negative number');
        }
      }

      if (backup.retentionDays !== undefined) {
        if (typeof backup.retentionDays !== 'number' || backup.retentionDays < 0) {
          throw new Error('backup.retentionDays must be a non-negative number');
        }
      }

      if (backup.schedule !== undefined) {
        if (typeof backup.schedule !== 'string' || !this.isValidCronExpression(backup.schedule)) {
          throw new Error('backup.schedule must be a valid cron expression');
        }
      }

      if (backup.cleanupSchedule !== undefined) {
        if (
          typeof backup.cleanupSchedule !== 'string' ||
          !this.isValidCronExpression(backup.cleanupSchedule)
        ) {
          throw new Error('backup.cleanupSchedule must be a valid cron expression');
        }
      }
    }

    // Validate monitoring configuration
    if (config.monitoring) {
      const { monitoring } = config;

      if (monitoring.schedule !== undefined) {
        if (
          typeof monitoring.schedule !== 'string' ||
          !this.isValidCronExpression(monitoring.schedule)
        ) {
          throw new Error('monitoring.schedule must be a valid cron expression');
        }
      }

      if (monitoring.alertThresholdGB !== undefined) {
        if (typeof monitoring.alertThresholdGB !== 'number' || monitoring.alertThresholdGB < 0) {
          throw new Error('monitoring.alertThresholdGB must be a non-negative number');
        }
      }
    }
  }

  /**
   * Basic cron expression validation
   */
  isValidCronExpression(cronExpression) {
    if (typeof cronExpression !== 'string') {
      return false;
    }

    // Basic validation - check for 5 or 6 parts separated by spaces
    const parts = cronExpression.trim().split(/\s+/);
    return parts.length === 5 || parts.length === 6;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    // Validate new configuration
    this.validateConfig(newConfig);

    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    this.logger.info('Log maintenance configuration updated', {
      oldConfig,
      newConfig: this.config
    });

    // Restart if running to apply new configuration
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

module.exports = LogMaintenanceService;
