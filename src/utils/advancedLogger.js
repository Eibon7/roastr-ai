const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const fs = require('fs-extra');
const path = require('path');

class AdvancedLogger {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    this.ensureLogsDir();
    
    // Different log types
    this.logTypes = {
      normal: 'normal',
      shield: 'shield',
      integration: 'integration',
      security: 'security'
    };

    // Initialize Winston loggers
    this.initializeWinstonLoggers();
  }

  /**
   * Initialize Winston loggers with rotation
   */
  initializeWinstonLoggers() {
    // Custom format for structured logging
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}]${service ? ` [${service}]` : ''}: ${message}${metaStr}`;
      })
    );

    // Transport configurations with rotation
    const createRotatingTransport = (filename, level = 'info', maxSize = '20m', maxFiles = '30d') => {
      return new DailyRotateFile({
        filename: path.join(this.logsDir, filename),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize,
        maxFiles,
        level,
        format: logFormat,
        auditFile: path.join(this.logsDir, `.${filename.replace('/', '_')}-audit.json`)
      });
    };

    // Application logger with rotating files
    this.applicationLogger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { service: 'roastr-ai' },
      transports: [
        // Console transport for development
        ...(process.env.NODE_ENV !== 'production' ? [
          new winston.transports.Console({
            format: consoleFormat,
            level: 'debug'
          })
        ] : []),

        // Application logs - daily rotation
        createRotatingTransport('application/app-%DATE%.log', 'info'),
        
        // Error logs - separate file for errors only
        createRotatingTransport('application/error-%DATE%.log', 'error', '10m', '60d')
      ],
      
      // Handle uncaught exceptions and rejections
      exceptionHandlers: [
        createRotatingTransport('application/exceptions-%DATE%.log', 'error', '10m', '90d')
      ],
      rejectionHandlers: [
        createRotatingTransport('application/rejections-%DATE%.log', 'error', '10m', '90d')
      ]
    });

    // Security logger - for auth, access control, and security events
    this.securityLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      defaultMeta: { service: 'roastr-ai-security' },
      transports: [
        createRotatingTransport('security/security-%DATE%.log', 'info', '10m', '90d'),
        createRotatingTransport('security/auth-%DATE%.log', 'info', '10m', '90d')
      ]
    });

    // Integration logger - for external API calls and integrations
    this.integrationLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      defaultMeta: { service: 'roastr-ai-integrations' },
      transports: [
        createRotatingTransport('integrations/integrations-%DATE%.log', 'info', '20m', '30d'),
        createRotatingTransport('integrations/api-errors-%DATE%.log', 'error', '10m', '60d')
      ]
    });

    // Worker logger - for background workers and queue processing
    this.workerLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      defaultMeta: { service: 'roastr-ai-workers' },
      transports: [
        createRotatingTransport('workers/workers-%DATE%.log', 'info', '30m', '30d'),
        createRotatingTransport('workers/queue-%DATE%.log', 'info', '20m', '30d'),
        createRotatingTransport('workers/worker-errors-%DATE%.log', 'error', '10m', '60d')
      ]
    });

    // Shield logger - for sensitive content
    this.shieldLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      defaultMeta: { service: 'roastr-ai-shield' },
      transports: [
        createRotatingTransport('shield/shield-%DATE%.log', 'info', '20m', '90d'),
        createRotatingTransport('shield/actions-%DATE%.log', 'info', '10m', '90d')
      ]
    });

    // Audit logger - for compliance and audit trails
    this.auditLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      defaultMeta: { service: 'roastr-ai-audit' },
      transports: [
        createRotatingTransport('audit/audit-%DATE%.log', 'info', '10m', '365d'), // Keep audit logs for 1 year
        createRotatingTransport('audit/user-actions-%DATE%.log', 'info', '10m', '365d'),
        createRotatingTransport('audit/admin-actions-%DATE%.log', 'info', '10m', '365d')
      ]
    });
  }

  /**
   * Ensure logs directory exists
   */
  async ensureLogsDir() {
    try {
      await fs.ensureDir(this.logsDir);
      
      // Create subdirectories for different log types
      const subdirs = ['application', 'integrations', 'shield', 'security', 'workers', 'audit'];
      for (const subdir of subdirs) {
        await fs.ensureDir(path.join(this.logsDir, subdir));
      }
      
    } catch (error) {
      console.error('Error creating logs directory:', error);
    }
  }

  /**
   * Get timestamp string
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log entry
   */
  formatLogEntry(level, platform, message, data = null) {
    const entry = {
      timestamp: this.getTimestamp(),
      level: level.toUpperCase(),
      platform: platform.toUpperCase(),
      message,
      pid: process.pid
    };

    if (data) {
      entry.data = data;
    }

    return JSON.stringify(entry) + '\n';
  }

  /**
   * Write to specific log file using Winston loggers
   */
  async writeLog(logType, platform, level, message, data = null) {
    try {
      const logData = {
        platform: platform.toUpperCase(),
        ...(data && typeof data === 'object' ? data : { data })
      };

      switch (logType) {
        case this.logTypes.integration:
          this.integrationLogger[level] ? this.integrationLogger[level](message, logData) : this.integrationLogger.info(message, logData);
          break;
        case this.logTypes.shield:
          this.shieldLogger[level] ? this.shieldLogger[level](message, logData) : this.shieldLogger.info(message, logData);
          break;
        case this.logTypes.security:
          this.securityLogger[level] ? this.securityLogger[level](message, logData) : this.securityLogger.info(message, logData);
          break;
        default:
          this.applicationLogger[level] ? this.applicationLogger[level](message, logData) : this.applicationLogger.info(message, logData);
      }

    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }

  /**
   * Log normal roast activity
   */
  async logNormal(platform, level, message, data = null) {
    await this.writeLog(this.logTypes.normal, platform, level, message, data);
  }

  /**
   * Log Shield activity (sensitive content warning)
   */
  async logShield(platform, level, message, data = null) {
    // Add warning to Shield logs
    const warningMessage = `[⚠️ SENSITIVE CONTENT] ${message}`;
    await this.writeLog(this.logTypes.shield, platform, level, warningMessage, data);
  }

  /**
   * Log integration activity
   */
  async logIntegration(platform, level, message, data = null) {
    await this.writeLog(this.logTypes.integration, platform, level, message, data);
  }

  /**
   * Log security events (reincidence, auto-actions, etc.)
   */
  async logSecurity(level, message, data = null) {
    await this.writeLog(this.logTypes.security, 'security', level, message, data);
  }

  /**
   * Log user reincidence
   */
  async logReincidence(platform, userId, username, count, severity, data = null) {
    const message = `User reincidence detected: ${username} (${userId}) - Count: ${count}, Severity: ${severity}`;
    
    const logData = {
      userId,
      username,
      reincidenceCount: count,
      severity,
      platform,
      ...data
    };

    await this.logSecurity('warning', message, logData);
  }

  /**
   * Log automatic actions taken
   */
  async logAutoAction(platform, action, userId, username, reason, data = null) {
    const message = `Auto-action executed: ${action} on ${username} (${userId}) - Reason: ${reason}`;
    
    const logData = {
      action,
      userId,
      username,
      reason,
      platform,
      timestamp: this.getTimestamp(),
      ...data
    };

    await this.logSecurity('info', message, logData);
    await this.logShield(platform, 'action', message, logData);
  }

  /**
   * Log roast generation
   */
  async logRoast(platform, mode, userId, originalMessage, roastResponse, tone, data = null) {
    const isShield = mode === 'shield';
    const message = `Roast generated for ${userId} - Tone: ${tone}`;
    
    const logData = {
      userId,
      originalMessage: isShield ? '[REDACTED]' : originalMessage,
      roastResponse: isShield ? '[REDACTED]' : roastResponse,
      tone,
      mode,
      ...data
    };

    if (isShield) {
      await this.logShield(platform, 'roast', message, logData);
    } else {
      await this.logNormal(platform, 'roast', message, logData);
    }
  }

  /**
   * Get log files list
   */
  async getLogFiles() {
    try {
      const logFiles = {
        normal: [],
        integration: [],
        shield: [],
        security: []
      };

      // Get normal logs
      const normalFiles = await fs.readdir(this.logsDir);
      logFiles.normal = normalFiles.filter(f => f.endsWith('_normal.log'));

      // Get integration logs
      const integrationsDir = path.join(this.logsDir, 'integrations');
      if (await fs.pathExists(integrationsDir)) {
        logFiles.integration = await fs.readdir(integrationsDir);
      }

      // Get shield logs
      const shieldDir = path.join(this.logsDir, 'shield');
      if (await fs.pathExists(shieldDir)) {
        logFiles.shield = await fs.readdir(shieldDir);
      }

      // Get security logs
      const securityDir = path.join(this.logsDir, 'security');
      if (await fs.pathExists(securityDir)) {
        logFiles.security = await fs.readdir(securityDir);
      }

      return logFiles;

    } catch (error) {
      console.error('Error getting log files:', error);
      return { normal: [], integration: [], shield: [], security: [] };
    }
  }

  /**
   * Read log file content
   */
  async readLog(logType, filename, lines = 100) {
    try {
      let logFile;
      
      switch (logType) {
        case 'integration':
          logFile = path.join(this.logsDir, 'integrations', filename);
          break;
        case 'shield':
          logFile = path.join(this.logsDir, 'shield', filename);
          break;
        case 'security':
          logFile = path.join(this.logsDir, 'security', filename);
          break;
        default:
          logFile = path.join(this.logsDir, filename);
      }

      if (!(await fs.pathExists(logFile))) {
        return [];
      }

      const content = await fs.readFile(logFile, 'utf8');
      const logLines = content.trim().split('\n').filter(line => line.length > 0);
      
      // Return last N lines
      const recentLines = logLines.slice(-lines);
      
      // Parse JSON entries
      return recentLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line, timestamp: null };
        }
      });

    } catch (error) {
      console.error('Error reading log file:', error);
      return [];
    }
  }

  /**
   * Clean old log files with enhanced retention policies
   */
  async cleanOldLogs(options = {}) {
    try {
      const {
        applicationDays = 30,
        integrationDays = 30,
        shieldDays = 90,
        securityDays = 90,
        workerDays = 30,
        auditDays = 365,
        dryRun = false
      } = options;

      const retentionPolicies = {
        'application': applicationDays,
        'integrations': integrationDays,
        'shield': shieldDays,
        'security': securityDays,
        'workers': workerDays,
        'audit': auditDays
      };

      let totalFilesRemoved = 0;
      let totalSizeFreed = 0;

      for (const [dirName, daysToKeep] of Object.entries(retentionPolicies)) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        const dir = path.join(this.logsDir, dirName);
        
        if (await fs.pathExists(dir)) {
          const files = await fs.readdir(dir);
          
          for (const file of files) {
            // Skip audit files (winston metadata)
            if (file.endsWith('-audit.json')) continue;
            
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime < cutoffDate) {
              if (dryRun) {
                this.applicationLogger.info(`Would remove old log file: ${path.relative(this.logsDir, filePath)} (${this.formatFileSize(stats.size)})`);
              } else {
                await fs.remove(filePath);
                totalFilesRemoved++;
                totalSizeFreed += stats.size;
                this.applicationLogger.info(`Cleaned old log file: ${path.relative(this.logsDir, filePath)} (${this.formatFileSize(stats.size)})`);
              }
            }
          }
        }
      }

      if (!dryRun && totalFilesRemoved > 0) {
        this.applicationLogger.info(`Log cleanup completed: ${totalFilesRemoved} files removed, ${this.formatFileSize(totalSizeFreed)} freed`);
      }

      return {
        filesRemoved: totalFilesRemoved,
        sizeFreed: totalSizeFreed,
        dryRun
      };

    } catch (error) {
      this.applicationLogger.error('Error cleaning old logs:', error);
      throw error;
    }
  }

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  /**
   * Enhanced Winston logging methods
   */
  
  // Application logging
  info(message, meta = {}) {
    this.applicationLogger.info(message, meta);
  }

  error(message, meta = {}) {
    this.applicationLogger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.applicationLogger.warn(message, meta);
  }

  debug(message, meta = {}) {
    this.applicationLogger.debug(message, meta);
  }

  // Security-specific logging
  authEvent(message, meta = {}) {
    this.securityLogger.info(message, { 
      type: 'auth_event',
      timestamp: new Date().toISOString(),
      ...meta 
    });
  }

  securityEvent(message, meta = {}) {
    this.securityLogger.info(message, { 
      type: 'security_event',
      timestamp: new Date().toISOString(),
      ...meta 
    });
  }

  // Integration-specific logging
  integrationEvent(message, meta = {}) {
    this.integrationLogger.info(message, { 
      type: 'integration_event',
      timestamp: new Date().toISOString(),
      ...meta 
    });
  }

  apiError(message, meta = {}) {
    this.integrationLogger.error(message, { 
      type: 'api_error',
      timestamp: new Date().toISOString(),
      ...meta 
    });
  }

  // Worker-specific logging
  workerEvent(message, meta = {}) {
    this.workerLogger.info(message, { 
      type: 'worker_event',
      timestamp: new Date().toISOString(),
      ...meta 
    });
  }

  queueEvent(message, meta = {}) {
    this.workerLogger.info(message, { 
      type: 'queue_event',
      timestamp: new Date().toISOString(),
      ...meta 
    });
  }

  // Audit-specific logging
  auditEvent(message, meta = {}) {
    this.auditLogger.info(message, { 
      type: 'audit_event',
      timestamp: new Date().toISOString(),
      ...meta 
    });
  }

  userAction(userId, action, meta = {}) {
    this.auditLogger.info(`User action: ${action}`, { 
      type: 'user_action',
      userId,
      action,
      timestamp: new Date().toISOString(),
      ...meta 
    });
  }

  adminAction(adminId, action, meta = {}) {
    this.auditLogger.info(`Admin action: ${action}`, { 
      type: 'admin_action',
      adminId,
      action,
      timestamp: new Date().toISOString(),
      ...meta 
    });
  }

  /**
   * Get logging statistics
   */
  async getLogStatistics() {
    try {
      const stats = {
        directories: {},
        totalFiles: 0,
        totalSize: 0,
        oldestLog: null,
        newestLog: null
      };

      const subdirs = ['application', 'integrations', 'shield', 'security', 'workers', 'audit'];
      
      for (const subdir of subdirs) {
        const dir = path.join(this.logsDir, subdir);
        
        if (await fs.pathExists(dir)) {
          const files = await fs.readdir(dir);
          let dirSize = 0;
          let dirFiles = 0;
          
          for (const file of files) {
            if (file.endsWith('-audit.json')) continue;
            
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);
            
            dirSize += stat.size;
            dirFiles++;
            stats.totalSize += stat.size;
            stats.totalFiles++;
            
            if (!stats.oldestLog || stat.mtime < stats.oldestLog.mtime) {
              stats.oldestLog = { file: path.relative(this.logsDir, filePath), mtime: stat.mtime };
            }
            
            if (!stats.newestLog || stat.mtime > stats.newestLog.mtime) {
              stats.newestLog = { file: path.relative(this.logsDir, filePath), mtime: stat.mtime };
            }
          }
          
          stats.directories[subdir] = {
            files: dirFiles,
            size: dirSize,
            sizeFormatted: this.formatFileSize(dirSize)
          };
        }
      }
      
      stats.totalSizeFormatted = this.formatFileSize(stats.totalSize);
      
      return stats;
      
    } catch (error) {
      this.applicationLogger.error('Error getting log statistics:', error);
      throw error;
    }
  }

  /**
   * Get all available Winston loggers
   */
  getLoggers() {
    return {
      application: this.applicationLogger,
      security: this.securityLogger,
      integration: this.integrationLogger,
      worker: this.workerLogger,
      shield: this.shieldLogger,
      audit: this.auditLogger
    };
  }

  /**
   * Create correlation context for observability (Issue #417)
   *
   * Generates a standardized correlation context object with timestamp
   * and all relevant IDs for request tracing across the system.
   *
   * @param {Object} params - Correlation parameters
   * @param {string} params.correlationId - Unique correlation ID (UUID)
   * @param {string} params.tenantId - Organization/tenant ID
   * @param {string} params.userId - User ID (optional)
   * @param {string} params.commentId - Comment ID (optional)
   * @param {string} params.roastId - Roast/response ID (optional)
   * @returns {Object} Correlation context with timestamp
   */
  createCorrelationContext({
    correlationId,
    tenantId,
    userId,
    commentId,
    roastId,
    ...meta
  } = {}) {
    const context = {
      timestamp: new Date().toISOString(),
      ...meta
    };

    if (correlationId) context.correlationId = correlationId;
    if (tenantId) context.tenantId = tenantId;
    if (userId) context.userId = userId;
    if (commentId) context.commentId = commentId;
    if (roastId) context.roastId = roastId;

    return context;
  }

  /**
   * Log job lifecycle event with full correlation context (Issue #417)
   *
   * Logs key lifecycle events (enqueued, started, completed, failed) with
   * correlation IDs for end-to-end request tracing.
   *
   * @param {string} workerName - Name of the worker or service
   * @param {string} jobId - Job ID
   * @param {string} lifecycle - Lifecycle event (enqueued, started, completed, failed)
   * @param {Object} correlationContext - Correlation context from createCorrelationContext
   * @param {Object} result - Optional result data to include in log
   */
  logJobLifecycle(workerName, jobId, lifecycle, correlationContext = {}, result = null) {
    const context = this.createCorrelationContext(correlationContext);

    const logData = {
      worker: workerName,
      jobId,
      lifecycle,
      ...context
    };

    if (result) {
      logData.result = result;
    }

    const message = `Job ${lifecycle}: ${jobId}`;

    // Use appropriate log level based on lifecycle
    if (lifecycle === 'failed') {
      this.workerLogger.error(message, logData);
    } else {
      this.workerLogger.info(message, logData);
    }
  }

  /**
   * Log worker error with correlation context (Issue #417)
   *
   * Logs worker errors with full stack trace and correlation IDs
   * for debugging and traceability.
   *
   * @param {string} workerName - Name of the worker
   * @param {string} action - Action that failed
   * @param {Error} error - Error object
   * @param {Object} correlationContext - Correlation context
   */
  logWorkerError(workerName, action, error, correlationContext = {}) {
    const context = this.createCorrelationContext(correlationContext);

    this.workerLogger.error(`Worker ${action} failed`, {
      worker: workerName,
      action,
      error: error.message,
      stack: error.stack,
      ...context
    });
  }

  /**
   * Log worker action with correlation context (Issue #417)
   *
   * Logs general worker actions for observability and debugging.
   *
   * @param {string} workerName - Name of the worker
   * @param {string} action - Action being performed
   * @param {Object} correlationContext - Correlation context
   * @param {Object} metadata - Additional metadata
   */
  logWorkerAction(workerName, action, correlationContext = {}, metadata = {}) {
    const context = this.createCorrelationContext(correlationContext);

    this.workerLogger.info(`Worker action: ${action}`, {
      worker: workerName,
      action,
      ...context,
      ...metadata
    });
  }

  /**
   * Aliases for compatibility with tests
   */
  get queueLogger() {
    return this.workerLogger;
  }

  get errorLogger() {
    return this.applicationLogger;
  }
}

module.exports = new AdvancedLogger();