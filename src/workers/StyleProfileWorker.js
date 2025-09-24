const BaseWorker = require('./BaseWorker');
const styleProfileService = require('../services/styleProfileService');
const { logger } = require('../utils/logger');

/**
 * Worker for extracting and refreshing user style profiles
 * Processes style profile extraction jobs from the queue
 */
class StyleProfileWorker extends BaseWorker {
    constructor() {
        super('style_profile');
    }

    /**
     * Process style profile extraction job
     * @param {Object} job - Queue job
     * @returns {Promise<Object>} Processing result
     */
    async processJob(job) {
        const { userId, platform, accountRef, isRefresh = false } = job.data;

        try {
            logger.info('Processing style profile job', {
                userId,
                platform,
                isRefresh,
                jobId: job.id
            });

            // Check if refresh is needed (unless forced)
            if (!isRefresh) {
                const needsRefresh = await styleProfileService.needsRefresh(userId, platform);
                if (!needsRefresh) {
                    logger.info('Style profile is up to date, skipping', { userId, platform });
                    return {
                        success: true,
                        skipped: true,
                        message: 'Style profile is up to date'
                    };
                }
            }

            // Extract style profile
            const result = await styleProfileService.extractStyleProfile(userId, platform, accountRef);

            // Schedule next refresh check
            await this.scheduleNextRefresh(userId, platform);

            return {
                success: true,
                ...result
            };

        } catch (error) {
            logger.error('Style profile extraction failed', {
                error: error.message,
                userId,
                platform,
                jobId: job.id
            });

            // Determine if we should retry
            if (this.shouldRetry(error)) {
                throw error; // Let the queue system handle retry
            }

            // Non-retryable error
            return {
                success: false,
                error: error.message,
                permanent: true
            };
        }
    }

    /**
     * Schedule next refresh check for the profile
     * @param {string} userId - User ID
     * @param {string} platform - Platform name
     */
    async scheduleNextRefresh(userId, platform) {
        try {
            const nextRefreshDate = new Date();
            nextRefreshDate.setDate(nextRefreshDate.getDate() + 90); // 90 days from now

            await this.queueService.addJob('style_profile', {
                userId,
                platform,
                isRefresh: true
            }, {
                delay: nextRefreshDate.getTime() - Date.now(),
                priority: 3 // Low priority for scheduled refreshes
            });

            logger.info('Scheduled next style profile refresh', {
                userId,
                platform,
                nextRefreshDate: nextRefreshDate.toISOString()
            });

        } catch (error) {
            logger.error('Failed to schedule next refresh', {
                error: error.message,
                userId,
                platform
            });
        }
    }

    /**
     * Determine if error is retryable
     * @param {Error} error - The error that occurred
     * @returns {boolean} True if should retry
     */
    shouldRetry(error) {
        const nonRetryableErrors = [
            'Style profile feature is only available for Pro and Plus users',
            'Insufficient comments for style analysis'
        ];

        return !nonRetryableErrors.some(msg => error.message.includes(msg));
    }

    /**
     * Handle job completion
     * @param {Object} job - Completed job
     * @param {Object} result - Job result
     */
    async onJobComplete(job, result) {
        await super.onJobComplete(job, result);

        if (result.success && !result.skipped) {
            logger.info('Style profile extraction completed', {
                userId: job.data.userId,
                platform: job.data.platform,
                commentCount: result.commentCount
            });
        }
    }

    /**
     * Handle job failure
     * @param {Object} job - Failed job
     * @param {Error} error - The error that caused failure
     */
    async onJobFailed(job, error) {
        await super.onJobFailed(job, error);

        logger.error('Style profile job failed permanently', {
            userId: job.data.userId,
            platform: job.data.platform,
            error: error.message,
            attempts: job.attemptsMade
        });
    }
}

module.exports = StyleProfileWorker;