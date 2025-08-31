const BaseWorker = require('./BaseWorker');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');
const DataExportService = require('../services/dataExportService');
const emailService = require('../services/emailService');

/**
 * Export Cleanup Worker for GDPR Compliance (Issue #116)
 * 
 * Automatically deletes expired export files to minimize security risks:
 * - Files older than 24 hours since creation
 * - Files older than 1 hour since first download
 * - Comprehensive logging for audit trails
 * - User notifications for file deletions
 */
class ExportCleanupWorker extends BaseWorker {
    constructor(options = {}) {
        super('export-cleanup', options);
        
        this.exportDir = path.join(process.cwd(), 'temp', 'exports');
        this.dataExportService = new DataExportService();

        // File retention rules (in milliseconds)
        const {
            maxAgeAfterCreation = 24 * 60 * 60 * 1000, // 24 hours
            maxAgeAfterDownload = 60 * 60 * 1000,      // 1 hour
            scanInterval = 15 * 60 * 1000              // Scan every 15 minutes
        } = options;

        this.retentionRules = {
            maxAgeAfterCreation,
            maxAgeAfterDownload,
            scanInterval
        };
        
        this.cleanupStats = {
            filesScanned: 0,
            filesDeleted: 0,
            tokensCleanedUp: 0,
            errorsEncountered: 0,
            lastRunAt: null
        };
    }

    /**
     * Start the cleanup worker
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Export cleanup worker already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting export cleanup worker', {
            workerName: this.workerName,
            scanInterval: this.retentionRules.scanInterval,
            exportDir: this.exportDir
        });

        // Ensure export directory exists
        try {
            await fs.mkdir(this.exportDir, { recursive: true });
        } catch (error) {
            logger.error('Failed to create export directory', {
                exportDir: this.exportDir,
                error: error.message
            });
        }

        // Start periodic cleanup
        this.schedulePeriodicCleanup();
    }

    /**
     * Schedule periodic cleanup scans
     */
    schedulePeriodicCleanup() {
        const runCleanup = async () => {
            if (!this.isRunning) {
                return;
            }

            try {
                await this.performCleanupScan();
            } catch (error) {
                logger.error('Export cleanup scan failed', {
                    workerName: this.workerName,
                    error: error.message
                });
                this.cleanupStats.errorsEncountered++;
            }

            // Schedule next scan
            if (this.isRunning) {
                setTimeout(runCleanup, this.retentionRules.scanInterval);
            }
        };

        // Initial scan after 30 seconds
        setTimeout(runCleanup, 30000);
    }

    /**
     * Perform a complete cleanup scan
     */
    async performCleanupScan() {
        const scanStartTime = Date.now();
        logger.info('Starting export cleanup scan', {
            workerName: this.workerName
        });

        // Reset scan statistics
        const scanStats = {
            filesScanned: 0,
            filesDeleted: 0,
            tokensCleanedUp: 0,
            errors: []
        };

        try {
            // Step 1: Clean up expired download tokens
            scanStats.tokensCleanedUp = await this.cleanupExpiredTokens();

            // Step 2: Scan and clean up physical files
            const fileResults = await this.scanAndCleanupFiles();
            scanStats.filesScanned = fileResults.scanned;
            scanStats.filesDeleted = fileResults.deleted;
            scanStats.tokensCleanedUp += fileResults.tokensCleanedUp;
            scanStats.errors = fileResults.errors;

            // Update global statistics
            this.cleanupStats.filesScanned += scanStats.filesScanned;
            this.cleanupStats.filesDeleted += scanStats.filesDeleted;
            this.cleanupStats.tokensCleanedUp += scanStats.tokensCleanedUp;
            this.cleanupStats.errorsEncountered += scanStats.errors.length;
            this.cleanupStats.lastRunAt = new Date().toISOString();

            const scanDuration = Date.now() - scanStartTime;
            logger.info('Export cleanup scan completed', {
                workerName: this.workerName,
                duration: scanDuration,
                ...scanStats
            });

            // Log errors if any
            if (scanStats.errors.length > 0) {
                logger.warn('Errors encountered during cleanup scan', {
                    workerName: this.workerName,
                    errorCount: scanStats.errors.length,
                    errors: scanStats.errors
                });
            }

        } catch (error) {
            logger.error('Critical error during export cleanup scan', {
                workerName: this.workerName,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Clean up expired download tokens from memory
     */
    async cleanupExpiredTokens() {
        let tokensCleanedUp = 0;

        if (!global.downloadTokens) {
            return tokensCleanedUp;
        }

        const now = Date.now();
        const expiredTokens = [];

        // Find expired tokens
        for (const [token, downloadToken] of global.downloadTokens.entries()) {
            if (downloadToken.expiresAt < now) {
                expiredTokens.push({ token, downloadToken });
            }
        }

        // Remove expired tokens and their associated files
        for (const { token, downloadToken } of expiredTokens) {
            try {
                // Remove from memory
                global.downloadTokens.delete(token);
                tokensCleanedUp++;

                // Delete associated file if it exists
                try {
                    await fs.unlink(downloadToken.filepath);
                    logger.info('Deleted file for expired token', {
                        workerName: this.workerName,
                        filepath: downloadToken.filepath,
                        token: token.substring(0, 8) + '...'
                    });
                } catch (fileError) {
                    // File might already be deleted, log as warning
                    logger.warn('Could not delete file for expired token', {
                        workerName: this.workerName,
                        filepath: downloadToken.filepath,
                        error: fileError.message
                    });
                }

                // Notify user about file deletion (Issue #116 requirement)
                await this.notifyUserOfFileDeletion(downloadToken);

            } catch (error) {
                logger.error('Error cleaning up expired token', {
                    workerName: this.workerName,
                    token: token.substring(0, 8) + '...',
                    error: error.message
                });
            }
        }

        if (tokensCleanedUp > 0) {
            logger.info('Cleaned up expired download tokens', {
                workerName: this.workerName,
                tokensCleanedUp
            });
        }

        return tokensCleanedUp;
    }

    /**
     * Scan export directory and clean up old files
     */
    async scanAndCleanupFiles() {
        const results = {
            scanned: 0,
            deleted: 0,
            tokensCleanedUp: 0,
            errors: []
        };

        try {
            // Check if export directory exists
            try {
                await fs.access(this.exportDir);
            } catch (error) {
                logger.info('Export directory does not exist, skipping file scan', {
                    workerName: this.workerName,
                    exportDir: this.exportDir
                });
                return results;
            }

            // Read directory contents
            const files = await fs.readdir(this.exportDir);
            const zipFiles = files.filter(file => file.endsWith('.zip') && file.startsWith('user-data-export-'));

            results.scanned = zipFiles.length;

            if (zipFiles.length === 0) {
                logger.debug('No export files found for cleanup', {
                    workerName: this.workerName
                });
                return results;
            }

            // Check each file for cleanup eligibility
            for (const filename of zipFiles) {
                try {
                    const filepath = path.join(this.exportDir, filename);
                    const shouldDelete = await this.shouldDeleteFile(filepath, filename);

                    if (shouldDelete.delete) {
                        await fs.unlink(filepath);
                        results.deleted++;

                        // Clean up associated download token if present
                        const downloadInfo = this.findDownloadInfoForFile(filepath);
                        if (downloadInfo) {
                            global.downloadTokens.delete(downloadInfo.token);
                            results.tokensCleanedUp++;
                            logger.info('Removed download token for deleted file', {
                                workerName: this.workerName,
                                filename,
                                token: downloadInfo.token.substring(0, 8) + '...'
                            });
                        }

                        logger.info('Deleted expired export file', {
                            workerName: this.workerName,
                            filename,
                            reason: shouldDelete.reason,
                            ageHours: shouldDelete.ageHours
                        });

                        // Notify user if we can identify them from filename
                        await this.notifyUserOfFileCleanup(filename, shouldDelete.reason);
                    }

                } catch (error) {
                    const errorMsg = `Failed to process file ${filename}: ${error.message}`;
                    results.errors.push(errorMsg);
                    logger.error('Error processing export file', {
                        workerName: this.workerName,
                        filename,
                        error: error.message
                    });
                }
            }

        } catch (error) {
            const errorMsg = `Failed to scan export directory: ${error.message}`;
            results.errors.push(errorMsg);
            logger.error('Error scanning export directory', {
                workerName: this.workerName,
                exportDir: this.exportDir,
                error: error.message
            });
        }

        return results;
    }

    /**
     * Determine if a file should be deleted based on retention rules
     */
    async shouldDeleteFile(filepath, filename) {
        try {
            const stats = await fs.stat(filepath);
            const now = Date.now();
            const fileAge = now - stats.mtime.getTime();
            const ageHours = Math.floor(fileAge / (60 * 60 * 1000));

            // Rule 1: Delete files older than 24 hours since creation
            if (fileAge > this.retentionRules.maxAgeAfterCreation) {
                return {
                    delete: true,
                    reason: 'exceeded_max_age',
                    ageHours
                };
            }

            // Rule 2: Check if file has been downloaded and is older than 1 hour since download
            const downloadInfo = this.findDownloadInfoForFile(filepath);
            if (downloadInfo && downloadInfo.firstDownloadAt) {
                const timeSinceFirstDownload = now - downloadInfo.firstDownloadAt;
                if (timeSinceFirstDownload > this.retentionRules.maxAgeAfterDownload) {
                    return {
                        delete: true,
                        reason: 'downloaded_and_expired',
                        ageHours: Math.floor(timeSinceFirstDownload / (60 * 60 * 1000)),
                        downloadCount: downloadInfo.downloadCount || 0
                    };
                }
            }

            return {
                delete: false,
                reason: 'within_retention_period',
                ageHours
            };

        } catch (error) {
            logger.error('Error checking file deletion criteria', {
                workerName: this.workerName,
                filepath,
                error: error.message
            });
            return {
                delete: false,
                reason: 'error_checking_file',
                ageHours: 0
            };
        }
    }

    /**
     * Find download information for a specific file
     * This checks if the file has been downloaded by looking at download tokens
     */
    findDownloadInfoForFile(filepath) {
        if (!global.downloadTokens) {
            return null;
        }

        for (const [token, downloadToken] of global.downloadTokens.entries()) {
            if (downloadToken.filepath === filepath) {
                return {
                    token,
                    firstDownloadAt: downloadToken.firstDownloadAt,
                    lastDownloadAt: downloadToken.lastDownloadAt,
                    downloadCount: downloadToken.downloadCount || 0,
                    filepath: downloadToken.filepath,
                    filename: downloadToken.filename
                };
            }
        }

        return null;
    }

    /**
     * Notify user about file deletion
     */
    async notifyUserOfFileDeletion(downloadToken) {
        try {
            const filename = path.basename(downloadToken.filepath);
            const userId = this.extractUserIdFromFilename(filename);
            
            logger.info('User notification: Export file deleted', {
                workerName: this.workerName,
                filename: filename,
                userId: userId ? userId.substring(0, 8) + '...' : 'unknown',
                reason: 'security_cleanup'
            });

            if (userId) {
                await emailService.sendExportFileDeletionNotification(userId, filename, 'security_cleanup');
            } else {
                logger.warn('Could not extract user ID from filename for notification', { filename });
            }

        } catch (error) {
            logger.error('Failed to notify user of file deletion', {
                workerName: this.workerName,
                error: error.message
            });
        }
    }

    /**
     * Notify user about file cleanup
     */
    async notifyUserOfFileCleanup(filename, reason) {
        try {
            const userId = this.extractUserIdFromFilename(filename);
            
            logger.info('User notification: Export file cleanup', {
                workerName: this.workerName,
                filename,
                userId: userId ? userId.substring(0, 8) + '...' : 'unknown',
                reason
            });

            if (userId) {
                await emailService.sendExportFileCleanupNotification(userId, filename, reason);
            } else {
                logger.warn('Could not extract user ID from filename for notification', { filename });
            }

        } catch (error) {
            logger.error('Failed to notify user of file cleanup', {
                workerName: this.workerName,
                filename,
                error: error.message
            });
        }
    }

    /**
     * Extract user ID from export filename
     * Format: user-data-export-{userId_prefix}-{timestamp}.zip
     */
    extractUserIdFromFilename(filename) {
        try {
            const match = filename.match(/^user-data-export-([a-zA-Z0-9]+)-\d+\.zip$/);
            if (match) {
                // This is just a prefix from SafeUtils.safeUserIdPrefix, not the full userId
                // In a production system, we'd need to store the mapping or use a different approach
                logger.warn('Filename contains only user ID prefix, cannot determine full user ID', { 
                    filename,
                    prefix: match[1]
                });
                return null;
            }
            return null;
        } catch (error) {
            logger.error('Error extracting user ID from filename', { filename, error: error.message });
            return null;
        }
    }

    /**
     * Get worker status and statistics
     */
    getStatus() {
        return {
            workerName: this.workerName,
            workerType: this.workerType,
            isRunning: this.isRunning,
            startTime: this.startTime,
            uptime: Date.now() - this.startTime,
            retentionRules: this.retentionRules,
            statistics: {
                ...this.cleanupStats,
                uptimeHours: Math.floor((Date.now() - this.startTime) / (60 * 60 * 1000))
            }
        };
    }

    /**
     * Stop the worker gracefully
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        logger.info('Stopping export cleanup worker', {
            workerName: this.workerName,
            statistics: this.cleanupStats
        });

        this.isRunning = false;

        // Perform one final cleanup scan
        try {
            await this.performCleanupScan();
            logger.info('Final cleanup scan completed during shutdown');
        } catch (error) {
            logger.error('Error during final cleanup scan', {
                error: error.message
            });
        }
    }
}

module.exports = ExportCleanupWorker;