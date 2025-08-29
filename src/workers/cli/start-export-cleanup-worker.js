#!/usr/bin/env node

/**
 * Export Cleanup Worker CLI (Issue #116)
 * 
 * Starts the export file cleanup worker for GDPR compliance.
 * Automatically deletes expired export files based on retention rules.
 */

const ExportCleanupWorker = require('../ExportCleanupWorker');
const { logger } = require('../../utils/logger');

// Configuration
const config = {
    scanInterval: process.env.EXPORT_CLEANUP_INTERVAL_MS || 15 * 60 * 1000, // 15 minutes
    maxAgeAfterCreation: process.env.EXPORT_MAX_AGE_HOURS * 60 * 60 * 1000 || 24 * 60 * 60 * 1000, // 24 hours
    maxAgeAfterDownload: process.env.EXPORT_MAX_AGE_AFTER_DOWNLOAD_HOURS * 60 * 60 * 1000 || 60 * 60 * 1000, // 1 hour
};

async function startExportCleanupWorker() {
    logger.info('Starting Export Cleanup Worker for GDPR Compliance', {
        pid: process.pid,
        nodeVersion: process.version,
        config
    });

    try {
        const worker = new ExportCleanupWorker({
            scanInterval: config.scanInterval,
            maxAgeAfterCreation: config.maxAgeAfterCreation,
            maxAgeAfterDownload: config.maxAgeAfterDownload
        });

        // Start the worker
        await worker.start();

        // Handle process termination
        const gracefulShutdown = async (signal) => {
            logger.info(`Received ${signal}, shutting down export cleanup worker gracefully...`);
            
            try {
                await worker.stop();
                logger.info('Export cleanup worker stopped successfully');
                process.exit(0);
            } catch (error) {
                logger.error('Error during graceful shutdown', {
                    error: error.message
                });
                process.exit(1);
            }
        };

        // Listen for termination signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception in export cleanup worker', {
                error: error.message,
                stack: error.stack
            });
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled rejection in export cleanup worker', {
                reason: reason?.message || reason,
                stack: reason?.stack
            });
            process.exit(1);
        });

        // Status reporting every 5 minutes
        setInterval(() => {
            const status = worker.getStatus();
            logger.info('Export cleanup worker status', status);
        }, 5 * 60 * 1000);

        logger.info('Export cleanup worker started successfully', {
            workerName: worker.workerName,
            scanIntervalMinutes: config.scanInterval / (60 * 1000)
        });

    } catch (error) {
        logger.error('Failed to start export cleanup worker', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Start the worker if this file is run directly
if (require.main === module) {
    startExportCleanupWorker();
}

module.exports = { startExportCleanupWorker };