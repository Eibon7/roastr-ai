const BaseWorker = require('./BaseWorker');
const DataExportService = require('../services/dataExportService');
const emailService = require('../services/emailService');
const auditService = require('../services/auditService');
const { logger, SafeUtils } = require('../utils/logger');

/**
 * Account Deletion Worker for GDPR Compliance
 * 
 * Processes scheduled account deletions with proper GDPR compliance:
 * - Processes deletion requests after grace period
 * - Exports user data before deletion
 * - Anonymizes historical records
 * - Performs complete data deletion
 * - Sends completion notifications
 * - Maintains comprehensive audit trail
 */
class AccountDeletionWorker extends BaseWorker {
  constructor(options = {}) {
    super('account_deletion', {
      pollInterval: 5 * 60 * 1000, // Check every 5 minutes
      maxConcurrency: 1, // Process one deletion at a time for safety
      maxRetries: 3,
      retryDelay: 30 * 60 * 1000, // 30 minute retry delay
      ...options
    });
    
    this.dataExportService = new DataExportService();
    
    logger.info('AccountDeletionWorker initialized', {
      workerName: this.workerName,
      pollInterval: this.config.pollInterval,
      maxConcurrency: this.config.maxConcurrency
    });
  }

  /**
   * Start the worker
   */
  async start() {
    try {
      logger.info('Starting AccountDeletionWorker', {
        workerName: this.workerName
      });

      this.isRunning = true;
      this.startTime = Date.now();
      
      // Start main processing loop
      this.processingLoop();
      
      logger.info('AccountDeletionWorker started successfully', {
        workerName: this.workerName
      });

    } catch (error) {
      logger.error('Failed to start AccountDeletionWorker', {
        workerName: this.workerName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Main processing loop
   */
  async processingLoop() {
    while (this.isRunning) {
      try {
        await this.processPendingDeletions();
        await this.sendReminderNotifications();
        
        // Wait before next poll
        if (this.isRunning) {
          await this.sleep(this.config.pollInterval);
        }
        
      } catch (error) {
        logger.error('Error in AccountDeletionWorker processing loop', {
          workerName: this.workerName,
          error: error.message,
          stack: error.stack
        });
        
        // Wait longer on error to avoid rapid error loops
        if (this.isRunning) {
          await this.sleep(Math.min(this.config.pollInterval * 3, 300000)); // Max 5 minute wait
        }
      }
    }
  }

  /**
   * Process pending deletion requests
   */
  async processPendingDeletions() {
    try {
      // Find deletion requests ready for processing
      const { data: pendingDeletions, error } = await this.supabase
        .from('account_deletion_requests')
        .select('*')
        .eq('status', 'pending')
        .lt('scheduled_deletion_at', new Date().toISOString())
        .limit(this.config.maxConcurrency);

      if (error) {
        throw error;
      }

      if (!pendingDeletions || pendingDeletions.length === 0) {
        return;
      }

      logger.info('Found pending deletions to process', {
        workerName: this.workerName,
        count: pendingDeletions.length
      });

      // Process each deletion
      for (const deletionRequest of pendingDeletions) {
        if (!this.isRunning) break;
        
        try {
          await this.processSingleDeletion(deletionRequest);
        } catch (error) {
          logger.error('Failed to process single deletion', {
            workerName: this.workerName,
            deletionRequestId: deletionRequest.id,
            userId: deletionRequest.user_id,
            error: error.message
          });
          
          // Mark as failed if max retries exceeded
          await this.handleDeletionFailure(deletionRequest, error);
        }
      }

    } catch (error) {
      logger.error('Error processing pending deletions', {
        workerName: this.workerName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process a single account deletion
   */
  async processSingleDeletion(deletionRequest) {
    const startTime = Date.now();
    const userId = deletionRequest.user_id;
    const requestId = deletionRequest.id;

    logger.info('Processing account deletion', {
      workerName: this.workerName,
      requestId,
      userId: SafeUtils.safeUserIdPrefix(userId),
      userEmail: deletionRequest.user_email
    });

    try {
      // Mark as processing
      await this.updateDeletionStatus(requestId, 'processing');
      
      // Log start of processing
      await auditService.logGdprAction({
        action: 'account_deletion_processing_started',
        userId,
        actorId: this.workerName,
        actorType: 'system',
        resourceType: 'account_deletion_request',
        resourceId: requestId,
        details: {
          processing_start_time: new Date().toISOString(),
          worker_name: this.workerName
        },
        legalBasis: 'gdpr_article_17_right_to_be_forgotten',
        retentionPeriodDays: 2557
      });

      // Step 1: Export user data if not already done
      let dataExportResult = null;
      if (!deletionRequest.data_exported_at) {
        logger.info('Generating final data export before deletion', { requestId, userId: SafeUtils.safeUserIdPrefix(userId) });
        
        dataExportResult = await this.dataExportService.exportUserData(userId);
        
        if (dataExportResult.success) {
          await this.supabase
            .from('account_deletion_requests')
            .update({
              data_exported_at: new Date().toISOString(),
              data_export_url: dataExportResult.downloadUrl,
              data_export_expires_at: dataExportResult.expiresAt.toISOString()
            })
            .eq('id', requestId);

          // Log data export
          await auditService.logDataExport(userId, {
            filename: dataExportResult.filename,
            size: dataExportResult.size,
            expiresAt: dataExportResult.expiresAt,
            context: 'pre_deletion_export'
          }, this.workerName);
        }
      }

      // Step 2: Anonymize user data for compliance
      logger.info('Anonymizing user data for retention compliance', { requestId, userId: SafeUtils.safeUserIdPrefix(userId) });
      
      await this.dataExportService.anonymizeUserData(userId);
      
      // Log anonymization
      await auditService.logGdprAction({
        action: 'personal_data_anonymized',
        userId: null, // User will no longer exist
        actorId: this.workerName,
        actorType: 'system',
        resourceType: 'user_data',
        resourceId: userId,
        details: {
          anonymization_time: new Date().toISOString(),
          original_user_id: userId,
          deletion_request_id: requestId
        },
        legalBasis: 'gdpr_article_17_right_to_be_forgotten',
        retentionPeriodDays: 2557
      });

      // Step 3: Perform complete data deletion
      logger.info('Performing complete data deletion', { requestId, userId: SafeUtils.safeUserIdPrefix(userId) });
      
      await this.dataExportService.deleteUserData(userId);

      // Step 4: Mark deletion as completed
      await this.updateDeletionStatus(requestId, 'completed');

      // Step 5: Send completion notification email
      try {
        await emailService.sendAccountDeletionCompletedEmail(deletionRequest.user_email, {
          userName: deletionRequest.user_name || deletionRequest.user_email,
          deletionDate: new Date().toLocaleDateString()
        });
      } catch (emailError) {
        logger.warn('Failed to send deletion completion email', {
          requestId,
          userEmail: deletionRequest.user_email,
          error: emailError.message
        });
      }

      // Step 6: Log completion
      await auditService.logAccountDeletionCompleted(userId, requestId, {
        processing_duration_ms: Date.now() - startTime,
        worker_name: this.workerName,
        data_categories_deleted: [
          'user_profile',
          'organizations',
          'integrations',
          'comments',
          'responses',
          'usage_records',
          'api_keys'
        ],
        completion_method: 'automated_worker'
      });

      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);
      this.processedJobs++;
      this.lastActivityTime = Date.now();

      logger.info('Account deletion completed successfully', {
        workerName: this.workerName,
        requestId,
        originalUserId: SafeUtils.safeUserIdPrefix(userId),
        processingTimeMs: processingTime,
        dataExportGenerated: !!dataExportResult?.success
      });

    } catch (error) {
      logger.error('Account deletion processing failed', {
        workerName: this.workerName,
        requestId,
        userId: SafeUtils.safeUserIdPrefix(userId),
        error: error.message,
        processingTimeMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Send reminder notifications for upcoming deletions
   */
  async sendReminderNotifications() {
    try {
      const reminderThresholdDays = 3; // Send reminder 3 days before deletion
      const reminderDate = new Date();
      reminderDate.setDate(reminderDate.getDate() + reminderThresholdDays);

      // Find deletions that need reminders
      const { data: upcomingDeletions, error } = await this.supabase
        .from('account_deletion_requests')
        .select('*')
        .eq('status', 'pending')
        .lt('scheduled_deletion_at', reminderDate.toISOString())
        .gt('scheduled_deletion_at', new Date().toISOString())
        .is('reminder_sent_at', null)
        .limit(50);

      if (error || !upcomingDeletions || upcomingDeletions.length === 0) {
        return;
      }

      logger.info('Sending deletion reminder notifications', {
        workerName: this.workerName,
        count: upcomingDeletions.length
      });

      for (const deletionRequest of upcomingDeletions) {
        if (!this.isRunning) break;

        try {
          const scheduledDeletion = new Date(deletionRequest.scheduled_deletion_at);
          const daysUntilDeletion = Math.ceil((scheduledDeletion.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

          await emailService.sendAccountDeletionReminderEmail(deletionRequest.user_email, {
            userName: deletionRequest.user_name || deletionRequest.user_email,
            daysUntilDeletion,
            scheduledDeletionDate: scheduledDeletion.toLocaleDateString(),
            dataExportUrl: deletionRequest.data_export_url
          });

          // Mark reminder as sent
          await this.supabase
            .from('account_deletion_requests')
            .update({
              reminder_sent_at: new Date().toISOString()
            })
            .eq('id', deletionRequest.id);

          logger.info('Deletion reminder sent', {
            requestId: deletionRequest.id,
            userEmail: deletionRequest.user_email,
            daysUntilDeletion
          });

        } catch (error) {
          logger.warn('Failed to send deletion reminder', {
            requestId: deletionRequest.id,
            userEmail: deletionRequest.user_email,
            error: error.message
          });
        }
      }

    } catch (error) {
      logger.error('Error sending reminder notifications', {
        workerName: this.workerName,
        error: error.message
      });
    }
  }

  /**
   * Update deletion request status
   */
  async updateDeletionStatus(requestId, status) {
    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('account_deletion_requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) {
      throw error;
    }
  }

  /**
   * Handle deletion failure
   */
  async handleDeletionFailure(deletionRequest, error) {
    try {
      this.failedJobs++;

      // For now, just log the failure. In a production system, you might want to:
      // - Retry with exponential backoff
      // - Alert administrators
      // - Move to a failed queue for manual intervention
      
      logger.error('Deletion processing failed permanently', {
        workerName: this.workerName,
        requestId: deletionRequest.id,
        userId: deletionRequest.user_id?.substr(0, 8) + '...',
        error: error.message,
        failureCount: this.failedJobs
      });

      // Log failure for audit trail
      await auditService.logGdprAction({
        action: 'account_deletion_failed',
        userId: deletionRequest.user_id,
        actorId: this.workerName,
        actorType: 'system',
        resourceType: 'account_deletion_request',
        resourceId: deletionRequest.id,
        details: {
          error_message: error.message,
          failure_time: new Date().toISOString(),
          worker_name: this.workerName
        },
        legalBasis: 'gdpr_article_17_right_to_be_forgotten',
        retentionPeriodDays: 2557
      });

    } catch (auditError) {
      logger.error('Failed to log deletion failure', {
        workerName: this.workerName,
        originalError: error.message,
        auditError: auditError.message
      });
    }
  }

  /**
   * Get worker status and statistics
   */
  getStatus() {
    const uptime = Date.now() - this.startTime;
    const averageProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0;

    return {
      workerName: this.workerName,
      workerType: this.workerType,
      isRunning: this.isRunning,
      uptime,
      uptimeFormatted: this.formatDuration(uptime),
      processedJobs: this.processedJobs,
      failedJobs: this.failedJobs,
      successRate: this.processedJobs + this.failedJobs > 0
        ? ((this.processedJobs / (this.processedJobs + this.failedJobs)) * 100).toFixed(2) + '%'
        : 'N/A',
      averageProcessingTime: Math.round(averageProcessingTime),
      lastActivityTime: this.lastActivityTime,
      lastActivityFormatted: this.lastActivityTime
        ? this.formatDuration(Date.now() - this.lastActivityTime) + ' ago'
        : 'Never',
      config: {
        pollInterval: this.config.pollInterval,
        maxConcurrency: this.config.maxConcurrency,
        maxRetries: this.config.maxRetries,
        retryDelay: this.config.retryDelay
      }
    };
  }

  /**
   * Record processing time for statistics
   */
  recordProcessingTime(timeMs) {
    this.processingTimes.push(timeMs);
    if (this.processingTimes.length > this.maxProcessingTimeSamples) {
      this.processingTimes.shift();
    }
  }

  /**
   * Stop the worker gracefully
   */
  async stop() {
    logger.info('Stopping AccountDeletionWorker', {
      workerName: this.workerName
    });

    this.isRunning = false;

    // Wait for current processing to finish
    const shutdownTimeout = setTimeout(() => {
      logger.warn('AccountDeletionWorker shutdown timeout exceeded', {
        workerName: this.workerName
      });
    }, this.config.gracefulShutdownTimeout);

    // Wait a bit for current operations to finish
    await this.sleep(1000);

    clearTimeout(shutdownTimeout);
    
    logger.info('AccountDeletionWorker stopped', {
      workerName: this.workerName,
      finalStats: this.getStatus()
    });
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format duration utility
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdownHandler = async (signal) => {
      logger.info(`Received ${signal}, shutting down AccountDeletionWorker gracefully`, {
        workerName: this.workerName
      });
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);
    process.on('SIGUSR2', shutdownHandler); // nodemon
  }
}

module.exports = AccountDeletionWorker;