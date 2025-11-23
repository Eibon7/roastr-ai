/**
 * Monthly Usage Reset Cron Job - Issue #168
 * 
 * Resets usage counters monthly at UTC 00:00 on the 1st of each month
 * - Uses EntitlementsService to reset counters
 * - Logs results for monitoring
 * - Handles errors gracefully
 * - Can be run manually for testing
 */

const cron = require('node-cron');
const EntitlementsService = require('../services/entitlementsService');
const { logger } = require('../utils/logger');

class MonthlyUsageResetJob {
    constructor() {
        this.entitlementsService = new EntitlementsService();
        this.isRunning = false;
        this.cronJob = null;
    }

    /**
     * Start the monthly cron job
     * Runs at 00:00 UTC on the 1st of every month
     */
    start() {
        if (this.cronJob) {
            logger.warn('Monthly usage reset cron job already started');
            return;
        }

        // Cron pattern: '0 0 1 * *' = At 00:00 on day-of-month 1
        // Using UTC timezone to ensure consistent reset time globally
        this.cronJob = cron.schedule('0 0 1 * *', async () => {
            await this.executeReset();
        }, {
            timezone: 'UTC',
            scheduled: false // Don't start immediately
        });

        this.cronJob.start();

        logger.info('Monthly usage reset cron job started', {
            schedule: '0 0 1 * * (UTC)',
            nextRun: this.getNextRunTime()
        });
    }

    /**
     * Stop the monthly cron job
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            logger.info('Monthly usage reset cron job stopped');
        }
    }

    /**
     * Execute the monthly reset
     * Can be called manually for testing
     */
    async executeReset() {
        if (this.isRunning) {
            logger.warn('Monthly usage reset already in progress, skipping');
            return;
        }

        this.isRunning = true;
        const startTime = new Date();

        logger.info('Starting monthly usage counter reset', {
            startTime: startTime.toISOString(),
            currentMonth: startTime.getMonth() + 1,
            currentYear: startTime.getFullYear()
        });

        try {
            const result = await this.entitlementsService.resetMonthlyUsageCounters();

            const endTime = new Date();
            const duration = endTime - startTime;

            if (result.success) {
                logger.info('Monthly usage counter reset completed successfully', {
                    accounts_reset: result.accounts_reset,
                    duration_ms: duration,
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString()
                });

                // Optional: Send notification about reset completion
                await this.notifyResetCompletion(result);

            } else {
                logger.error('Monthly usage counter reset failed', {
                    error: result.error,
                    duration_ms: duration,
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString()
                });

                // Optional: Send alert about reset failure
                await this.notifyResetFailure(result);
            }

        } catch (error) {
            const endTime = new Date();
            const duration = endTime - startTime;

            logger.error('Monthly usage counter reset threw exception', {
                error: error.message,
                stack: error.stack,
                duration_ms: duration,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString()
            });

            // Optional: Send alert about reset exception
            await this.notifyResetFailure({ error: error.message });

        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Get the next scheduled run time
     * @returns {Date} Next run time in UTC
     */
    getNextRunTime() {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
        
        // If we're already in the current month and past the 1st, 
        // next run is the 1st of next month
        if (now.getDate() > 1 || (now.getDate() === 1 && now.getHours() > 0)) {
            nextMonth.setMonth(nextMonth.getMonth() + 1);
        }

        return nextMonth;
    }

    /**
     * Get status of the cron job
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isScheduled: !!this.cronJob,
            isRunning: this.isRunning,
            nextRunTime: this.cronJob ? this.getNextRunTime() : null,
            schedule: '0 0 1 * * (UTC)',
            timezone: 'UTC'
        };
    }

    /**
     * Run a test reset (for development/testing)
     * This will actually reset counters, so use carefully
     */
    async runTest() {
        logger.warn('Running TEST monthly usage reset - this will actually reset counters');
        await this.executeReset();
    }

    /**
     * Notify about successful reset completion
     * @private
     * @param {Object} result - Reset result
     */
    async notifyResetCompletion(result) {
        try {
            // Could integrate with notification service, Slack, email, etc.
            logger.info('Monthly reset notification sent', {
                accounts_reset: result.accounts_reset,
                notification_type: 'success'
            });

            // Example: Send to monitoring service
            // await monitoringService.reportMetric('monthly_reset_success', {
            //     accounts_reset: result.accounts_reset,
            //     timestamp: new Date().toISOString()
            // });

        } catch (error) {
            logger.error('Failed to send reset completion notification', {
                error: error.message
            });
        }
    }

    /**
     * Notify about reset failure
     * @private
     * @param {Object} result - Reset result with error
     */
    async notifyResetFailure(result) {
        try {
            // Could integrate with alerting service, PagerDuty, etc.
            logger.error('Monthly reset failure notification sent', {
                error: result.error,
                notification_type: 'failure'
            });

            // Example: Send to alerting service
            // await alertingService.sendAlert('monthly_reset_failed', {
            //     error: result.error,
            //     timestamp: new Date().toISOString(),
            //     severity: 'high'
            // });

        } catch (error) {
            logger.error('Failed to send reset failure notification', {
                error: error.message
            });
        }
    }
}

// Export singleton instance
const monthlyUsageResetJob = new MonthlyUsageResetJob();

/**
 * Initialize and start the monthly usage reset cron job
 * Call this from your main application startup
 */
function initializeMonthlyReset() {
    monthlyUsageResetJob.start();
    return monthlyUsageResetJob;
}

/**
 * CLI interface for manual execution
 */
async function runManualReset() {
    if (require.main === module) {
        // This file is being run directly
        logger.info('🔄 Running manual monthly usage reset...');
        
        try {
            await monthlyUsageResetJob.executeReset();
            logger.info('✅ Manual reset completed');
            process.exit(0);
        } catch (error) {
            logger.error('❌ Manual reset failed:', error.message);
            process.exit(1);
        }
    }
}

// Run manual reset if this file is executed directly
runManualReset();

module.exports = {
    MonthlyUsageResetJob,
    monthlyUsageResetJob,
    initializeMonthlyReset
};