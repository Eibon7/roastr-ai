#!/usr/bin/env node

/**
 * Queue Manager CLI Tool for Roastr.ai
 *
 * Manage and monitor Redis/Upstash queues and database job queues
 *
 * Usage:
 *   node src/workers/cli/queue-manager.js <command> [options]
 *   npm run queue:manage <command> [options]
 *
 * Commands:
 *   status              Show queue status and statistics
 *   clear <job_type>    Clear jobs from specific queue
 *   clear-all           Clear all queues
 *   retry-failed        Retry all failed jobs
 *   dlq                 Show dead letter queue contents
 *   purge-dlq           Clear dead letter queues
 *   monitor             Start monitoring mode
 */

require('dotenv').config();
const QueueService = require('../../services/queueService');

class QueueManager {
  constructor() {
    this.queueService = new QueueService();
  }

  async initialize() {
    await this.queueService.initialize();
  }

  /**
   * Show queue status and statistics
   */
  async showStatus() {
    console.log('📊 Queue Status\n' + '='.repeat(50));

    try {
      const stats = await this.queueService.getQueueStats();

      console.log(`Timestamp: ${new Date(stats.timestamp).toLocaleString()}`);
      console.log(`Redis Available: ${stats.redis ? '✅' : '❌'}`);
      console.log(`Database Available: ${stats.database ? '✅' : '❌'}\n`);

      if (stats.redisStats) {
        console.log('🔄 Redis Queue Status:');
        this.displayRedisStats(stats.redisStats);
      }

      if (stats.databaseStats) {
        console.log('🗄️  Database Queue Status:');
        this.displayDatabaseStats(stats.databaseStats);
      }
    } catch (error) {
      console.error('❌ Error getting queue status:', error.message);
    }
  }

  /**
   * Display Redis queue statistics
   */
  displayRedisStats(stats) {
    console.log(`Total Jobs in Redis Queues: ${stats.total}\n`);

    Object.entries(stats.queues).forEach(([jobType, queueData]) => {
      if (queueData.total > 0) {
        console.log(`  ${jobType.padEnd(20)} | Total: ${queueData.total}`);
        Object.entries(queueData.byPriority).forEach(([priority, count]) => {
          if (count > 0) {
            const priorityName = this.getPriorityName(parseInt(priority));
            console.log(`    Priority ${priority} (${priorityName}): ${count}`);
          }
        });
      }
    });

    console.log();
  }

  /**
   * Display database queue statistics
   */
  displayDatabaseStats(stats) {
    console.log(`Total Jobs in Database: ${stats.total}\n`);

    if (stats.byStatus && Object.keys(stats.byStatus).length > 0) {
      console.log('  By Status:');
      Object.entries(stats.byStatus).forEach(([status, count]) => {
        console.log(`    ${status.padEnd(12)} | ${count}`);
      });
      console.log();
    }

    if (stats.byType && Object.keys(stats.byType).length > 0) {
      console.log('  By Type:');
      Object.entries(stats.byType).forEach(([type, count]) => {
        console.log(`    ${type.padEnd(20)} | ${count}`);
      });
      console.log();
    }

    if (stats.byPriority && Object.keys(stats.byPriority).length > 0) {
      console.log('  By Priority:');
      Object.entries(stats.byPriority).forEach(([priority, count]) => {
        const priorityName = this.getPriorityName(parseInt(priority));
        console.log(`    Priority ${priority} (${priorityName.padEnd(8)}) | ${count}`);
      });
      console.log();
    }
  }

  /**
   * Clear jobs from specific queue
   */
  async clearQueue(jobType) {
    console.log(`🧹 Clearing ${jobType} queues...`);

    try {
      if (this.queueService.isRedisAvailable) {
        await this.clearRedisQueues(jobType);
      }

      await this.clearDatabaseQueue(jobType);

      console.log(`✅ Cleared all ${jobType} queues`);
    } catch (error) {
      console.error(`❌ Error clearing ${jobType} queues:`, error.message);
    }
  }

  /**
   * Clear Redis queues for job type
   */
  async clearRedisQueues(jobType) {
    for (let priority = 1; priority <= 5; priority++) {
      const queueKey = this.queueService.getQueueKey(jobType, priority);
      const count = await this.queueService.redis.llen(queueKey);

      if (count > 0) {
        await this.queueService.redis.del(queueKey);
        console.log(`  Cleared ${count} jobs from Redis priority ${priority} queue`);
      }
    }
  }

  /**
   * Clear database queue for job type
   */
  async clearDatabaseQueue(jobType) {
    if (!this.queueService.supabase) return;

    const { data, error } = await this.queueService.supabase
      .from('job_queue')
      .delete()
      .eq('job_type', jobType)
      .eq('status', 'pending');

    if (error) {
      throw error;
    }

    console.log(`  Cleared pending ${jobType} jobs from database`);
  }

  /**
   * Clear all queues
   */
  async clearAllQueues() {
    console.log('🧹 Clearing ALL queues...\n');

    const confirmation = await this.askForConfirmation(
      'This will delete ALL pending jobs from all queues. Are you sure? (y/N)'
    );

    if (!confirmation) {
      console.log('Operation cancelled.');
      return;
    }

    const jobTypes = ['fetch_comments', 'analyze_toxicity', 'generate_reply', 'shield_action'];

    for (const jobType of jobTypes) {
      await this.clearQueue(jobType);
    }

    console.log('\n✅ All queues cleared');
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs() {
    console.log('🔄 Retrying failed jobs...');

    try {
      if (!this.queueService.supabase) {
        console.log('❌ Database not available for retry operation');
        return;
      }

      const { data: failedJobs, error } = await this.queueService.supabase
        .from('job_queue')
        .select('*')
        .eq('status', 'failed')
        .lt('attempts', 'max_attempts');

      if (error) throw error;

      console.log(`Found ${failedJobs.length} failed jobs to retry`);

      let retried = 0;
      for (const job of failedJobs) {
        try {
          // Reset job for retry
          await this.queueService.supabase
            .from('job_queue')
            .update({
              status: 'pending',
              scheduled_at: new Date().toISOString(),
              started_at: null,
              completed_at: null,
              error_message: null
            })
            .eq('id', job.id);

          retried++;
        } catch (retryError) {
          console.error(`Failed to retry job ${job.id}:`, retryError.message);
        }
      }

      console.log(`✅ Successfully retried ${retried} jobs`);
    } catch (error) {
      console.error('❌ Error retrying failed jobs:', error.message);
    }
  }

  /**
   * Show dead letter queue contents
   */
  async showDeadLetterQueue() {
    console.log('💀 Dead Letter Queue Contents\n' + '='.repeat(50));

    try {
      if (!this.queueService.isRedisAvailable) {
        console.log('❌ Redis not available - DLQ only stored in Redis');
        return;
      }

      const jobTypes = ['fetch_comments', 'analyze_toxicity', 'generate_reply', 'shield_action'];
      let totalDLQ = 0;

      for (const jobType of jobTypes) {
        const dlqKey = `${this.queueService.dlqPrefix}:${jobType}`;
        const length = await this.queueService.redis.llen(dlqKey);

        if (length > 0) {
          console.log(`${jobType.padEnd(20)} | ${length} failed jobs`);
          totalDLQ += length;

          // Show first few jobs
          const jobs = await this.queueService.redis.lrange(dlqKey, 0, 2);
          jobs.forEach((jobData, index) => {
            const job = JSON.parse(jobData);
            console.log(
              `  [${index + 1}] ${job.id} - Failed: ${job.failed_at} - Error: ${job.final_error?.substring(0, 100)}...`
            );
          });

          if (length > 3) {
            console.log(`  ... and ${length - 3} more`);
          }
          console.log();
        }
      }

      if (totalDLQ === 0) {
        console.log('✅ No jobs in dead letter queues');
      } else {
        console.log(`Total jobs in DLQ: ${totalDLQ}`);
      }
    } catch (error) {
      console.error('❌ Error showing dead letter queue:', error.message);
    }
  }

  /**
   * Purge dead letter queues
   */
  async purgeDeadLetterQueue() {
    console.log('💀 Purging Dead Letter Queues...\n');

    const confirmation = await this.askForConfirmation(
      'This will permanently delete all jobs in the dead letter queues. Are you sure? (y/N)'
    );

    if (!confirmation) {
      console.log('Operation cancelled.');
      return;
    }

    try {
      if (!this.queueService.isRedisAvailable) {
        console.log('❌ Redis not available - DLQ only stored in Redis');
        return;
      }

      const jobTypes = ['fetch_comments', 'analyze_toxicity', 'generate_reply', 'shield_action'];
      let totalPurged = 0;

      for (const jobType of jobTypes) {
        const dlqKey = `${this.queueService.dlqPrefix}:${jobType}`;
        const length = await this.queueService.redis.llen(dlqKey);

        if (length > 0) {
          await this.queueService.redis.del(dlqKey);
          totalPurged += length;
          console.log(`  Purged ${length} jobs from ${jobType} DLQ`);
        }
      }

      console.log(`\n✅ Total jobs purged from DLQ: ${totalPurged}`);
    } catch (error) {
      console.error('❌ Error purging dead letter queues:', error.message);
    }
  }

  /**
   * Start monitoring mode
   */
  async startMonitoring() {
    console.log('📊 Starting Queue Monitoring Mode');
    console.log('Press Ctrl+C to stop\n');

    const updateInterval = 5000; // 5 seconds

    const monitor = async () => {
      try {
        console.clear();
        console.log(`📊 Queue Monitor - ${new Date().toLocaleString()}`);
        console.log('='.repeat(60));

        await this.showStatus();

        console.log(`\n⏱️  Auto-refresh every ${updateInterval / 1000}s | Press Ctrl+C to exit`);
      } catch (error) {
        console.error('❌ Monitoring error:', error.message);
      }
    };

    // Initial display
    await monitor();

    // Set up interval
    const monitorInterval = setInterval(monitor, updateInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n👋 Stopping monitor...');
      clearInterval(monitorInterval);
      process.exit(0);
    });
  }

  /**
   * Get priority name from number
   */
  getPriorityName(priority) {
    const names = {
      1: 'Critical',
      2: 'High',
      3: 'Medium',
      4: 'Normal',
      5: 'Low'
    };
    return names[priority] || 'Unknown';
  }

  /**
   * Ask for user confirmation
   */
  askForConfirmation(question) {
    return new Promise((resolve) => {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question(question + ' ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  /**
   * Show help
   */
  showHelp() {
    console.log(`
🔧 Queue Manager CLI for Roastr.ai

Usage: node src/workers/cli/queue-manager.js <command> [options]

Commands:
  status              Show queue status and statistics
  clear <job_type>    Clear jobs from specific queue (fetch_comments, analyze_toxicity, generate_reply, shield_action)
  clear-all           Clear all queues (requires confirmation)
  retry-failed        Retry all failed jobs from database
  dlq                 Show dead letter queue contents
  purge-dlq           Clear dead letter queues (requires confirmation)
  monitor             Start real-time monitoring mode
  help                Show this help message

Examples:
  npm run queue:manage status
  npm run queue:manage clear analyze_toxicity
  npm run queue:manage clear-all
  npm run queue:manage retry-failed
  npm run queue:manage dlq
  npm run queue:manage monitor

Environment Variables:
  UPSTASH_REDIS_REST_URL      Upstash Redis URL
  UPSTASH_REDIS_REST_TOKEN    Upstash Redis token
  REDIS_URL                   Standard Redis URL (fallback)
  SUPABASE_URL                Supabase project URL
  SUPABASE_SERVICE_KEY        Supabase service key
`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    const manager = new QueueManager();
    manager.showHelp();
    return;
  }

  const manager = new QueueManager();

  try {
    await manager.initialize();

    switch (command) {
      case 'status':
        await manager.showStatus();
        break;

      case 'clear':
        const jobType = args[1];
        if (!jobType) {
          console.error(
            '❌ Please specify job type (fetch_comments, analyze_toxicity, generate_reply, shield_action)'
          );
          process.exit(1);
        }
        await manager.clearQueue(jobType);
        break;

      case 'clear-all':
        await manager.clearAllQueues();
        break;

      case 'retry-failed':
        await manager.retryFailedJobs();
        break;

      case 'dlq':
        await manager.showDeadLetterQueue();
        break;

      case 'purge-dlq':
        await manager.purgeDeadLetterQueue();
        break;

      case 'monitor':
        await manager.startMonitoring();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        manager.showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }

  // Graceful shutdown
  await manager.queueService.shutdown();
}

// Run the CLI
main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
