#!/usr/bin/env node

/**
 * Account Deletion Worker Starter
 * 
 * Starts the GDPR-compliant account deletion worker for processing
 * scheduled user account deletions with proper audit trails.
 * 
 * Usage:
 * node src/workers/cli/start-account-deletion-worker.js
 * 
 * Environment Variables:
 * - NODE_ENV: Environment (development, production)
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_KEY: Supabase service key
 * - SENDGRID_API_KEY: SendGrid API key for email notifications
 * - APP_URL: Application base URL for email links
 */

require('dotenv').config();

const AccountDeletionWorker = require('../AccountDeletionWorker');
const { logger } = require('../../utils/logger');

async function main() {
  try {
    logger.info('🗑️ Starting Account Deletion Worker for GDPR Compliance');
    
    // Validate required environment variables
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.error('❌ Missing required environment variables:', {
        missing: missingVars
      });
      process.exit(1);
    }

    // Optional environment variables with warnings
    const optionalEnvVars = {
      'SENDGRID_API_KEY': 'Email notifications will be disabled',
      'APP_URL': 'Using default localhost URLs in emails'
    };

    for (const [varName, warning] of Object.entries(optionalEnvVars)) {
      if (!process.env[varName]) {
        logger.warn(`⚠️ Missing optional environment variable ${varName}: ${warning}`);
      }
    }

    // Worker configuration
    const workerConfig = {
      pollInterval: parseInt(process.env.DELETION_POLL_INTERVAL) || 5 * 60 * 1000, // 5 minutes
      maxConcurrency: parseInt(process.env.DELETION_MAX_CONCURRENCY) || 1,
      maxRetries: parseInt(process.env.DELETION_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.DELETION_RETRY_DELAY) || 30 * 60 * 1000, // 30 minutes
      gracefulShutdownTimeout: parseInt(process.env.DELETION_SHUTDOWN_TIMEOUT) || 30000
    };

    logger.info('🔧 Worker Configuration:', {
      pollIntervalMin: Math.round(workerConfig.pollInterval / (60 * 1000)),
      maxConcurrency: workerConfig.maxConcurrency,
      maxRetries: workerConfig.maxRetries,
      retryDelayMin: Math.round(workerConfig.retryDelay / (60 * 1000)),
      gracefulShutdownTimeoutSec: Math.round(workerConfig.gracefulShutdownTimeout / 1000)
    });

    // Create and start worker
    const worker = new AccountDeletionWorker(workerConfig);
    
    // Handle worker startup
    await worker.start();
    
    logger.info('✅ Account Deletion Worker started successfully');
    logger.info('📊 Worker Status:', worker.getStatus());
    
    // Keep the process alive and log periodic status
    const statusInterval = setInterval(() => {
      const status = worker.getStatus();
      logger.info('💻 Worker Status Update:', {
        processedJobs: status.processedJobs,
        failedJobs: status.failedJobs,
        successRate: status.successRate,
        uptime: status.uptimeFormatted,
        lastActivity: status.lastActivityFormatted
      });
    }, 15 * 60 * 1000); // Every 15 minutes

    // Cleanup on exit
    process.on('exit', () => {
      clearInterval(statusInterval);
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (error) => {
      logger.error('🚨 Unhandled Promise Rejection in Account Deletion Worker:', error);
      process.exit(1);
    });

    process.on('uncaughtException', (error) => {
      logger.error('🚨 Uncaught Exception in Account Deletion Worker:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('❌ Failed to start Account Deletion Worker:', error);
    process.exit(1);
  }
}

// Show help information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🗑️ Account Deletion Worker - GDPR Compliance

This worker processes scheduled user account deletions with full GDPR compliance:
- Processes deletion requests after grace period expires
- Generates final data export before deletion
- Anonymizes historical data for legal compliance
- Performs complete account and data deletion
- Sends email notifications to users
- Maintains comprehensive audit trail

Required Environment Variables:
  SUPABASE_URL              Supabase project URL
  SUPABASE_SERVICE_KEY      Supabase service key

Optional Environment Variables:
  SENDGRID_API_KEY          SendGrid API key for emails
  APP_URL                   Application base URL (default: localhost)
  DELETION_POLL_INTERVAL    Polling interval in ms (default: 300000 = 5min)
  DELETION_MAX_CONCURRENCY  Max concurrent deletions (default: 1)
  DELETION_MAX_RETRIES      Max retry attempts (default: 3)
  DELETION_RETRY_DELAY      Retry delay in ms (default: 1800000 = 30min)
  DELETION_SHUTDOWN_TIMEOUT Graceful shutdown timeout in ms (default: 30000)

Usage:
  node src/workers/cli/start-account-deletion-worker.js
  npm run worker:account-deletion

The worker will:
1. Check for pending deletion requests every 5 minutes
2. Process requests where grace period has expired
3. Generate final data exports before deletion
4. Anonymize data for compliance retention
5. Perform complete data deletion
6. Send completion notifications
7. Log all actions for audit compliance

For monitoring and management:
  node src/workers/cli/worker-status.js
  node src/workers/cli/queue-manager.js
`);
  process.exit(0);
}

// Start the worker
main().catch(error => {
  logger.error('💥 Fatal error in Account Deletion Worker:', error);
  process.exit(1);
});