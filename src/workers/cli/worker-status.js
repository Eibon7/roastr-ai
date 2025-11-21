#!/usr/bin/env node

/**
 * Worker Status CLI Tool
 * 
 * Monitor and inspect running workers in the Roastr.ai system
 * 
 * Usage:
 *   node src/workers/cli/worker-status.js [options]
 *   npm run workers:status [options]
 * 
 * Options:
 *   --watch             Watch mode - continuously update status
 *   --interval=seconds  Update interval for watch mode (default: 10)
 *   --worker=type       Show detailed info for specific worker type
 *   --json              Output in JSON format
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Redis } = require('@upstash/redis');

class WorkerStatusMonitor {
  constructor(options = {}) {
    this.options = {
      watchMode: false,
      updateInterval: 10000,
      specificWorker: null,
      jsonOutput: false,
      ...options
    };
    
    this.initializeConnections();
  }
  
  initializeConnections() {
    // Supabase connection
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (this.supabaseUrl && this.supabaseKey) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    }
    
    // Redis connection (Upstash REST SDK)
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
      this.redis = new Redis({
        url: redisUrl,
        token: redisToken
      });
    }
  }
  
  async getJobQueueStats() {
    if (!this.supabase) return null;
    
    try {
      // Get job counts by type and status
      const { data: jobStats, error } = await this.supabase
        .from('job_queue')
        .select('job_type, status')
        .order('created_at', { ascending: false })
        .limit(1000);
      
      if (error) throw error;
      
      const stats = {};
      
      jobStats.forEach(job => {
        if (!stats[job.job_type]) {
          stats[job.job_type] = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            retrying: 0
          };
        }
        stats[job.job_type][job.status] = (stats[job.job_type][job.status] || 0) + 1;
      });
      
      return stats;
      
    } catch (error) {
      console.error('Error getting job queue stats:', error.message);
      return null;
    }
  }
  
  async getRedisQueueStats() {
    if (!this.redis) return null;
    
    try {
      const queueTypes = ['fetch_comments', 'analyze_toxicity', 'generate_reply', 'post_response'];
      const stats = {};
      
      for (const queueType of queueTypes) {
        const queueKey = `roastr:jobs:${queueType}`;
        const length = await this.redis.llen(queueKey);
        stats[queueType] = { pending: length };
      }
      
      return stats;
      
    } catch (error) {
      console.error('Error getting Redis queue stats:', error.message);
      return null;
    }
  }
  
  async getRecentActivity() {
    if (!this.supabase) return null;
    
    try {
      const { data: recentJobs, error } = await this.supabase
        .from('job_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      return recentJobs;
      
    } catch (error) {
      console.error('Error getting recent activity:', error.message);
      return null;
    }
  }
  
  async getProcessingStats() {
    if (!this.supabase) return null;
    
    try {
      // Get stats for last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: stats, error } = await this.supabase
        .from('job_queue')
        .select('job_type, status, created_at, completed_at')
        .gte('created_at', oneDayAgo);
      
      if (error) throw error;
      
      const processingStats = {
        totalJobs: stats.length,
        completedJobs: stats.filter(j => j.status === 'completed').length,
        failedJobs: stats.filter(j => j.status === 'failed').length,
        avgProcessingTime: 0,
        byType: {}
      };
      
      // Calculate average processing time
      const completedWithTime = stats.filter(j => 
        j.status === 'completed' && j.completed_at && j.created_at
      );
      
      if (completedWithTime.length > 0) {
        const totalTime = completedWithTime.reduce((sum, job) => {
          const start = new Date(job.created_at).getTime();
          const end = new Date(job.completed_at).getTime();
          return sum + (end - start);
        }, 0);
        
        processingStats.avgProcessingTime = Math.round(totalTime / completedWithTime.length);
      }
      
      // Stats by job type
      stats.forEach(job => {
        if (!processingStats.byType[job.job_type]) {
          processingStats.byType[job.job_type] = {
            total: 0,
            completed: 0,
            failed: 0,
            success_rate: 0
          };
        }
        
        const typeStats = processingStats.byType[job.job_type];
        typeStats.total++;
        if (job.status === 'completed') typeStats.completed++;
        if (job.status === 'failed') typeStats.failed++;
        
        typeStats.success_rate = typeStats.total > 0 ? 
          Math.round((typeStats.completed / typeStats.total) * 100) : 0;
      });
      
      return processingStats;
      
    } catch (error) {
      console.error('Error getting processing stats:', error.message);
      return null;
    }
  }
  
  async getFullStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      connections: {
        database: !!this.supabase,
        redis: !!this.redis
      },
      jobQueues: await this.getJobQueueStats(),
      redisQueues: await this.getRedisQueueStats(),
      processingStats: await this.getProcessingStats(),
      recentActivity: await this.getRecentActivity()
    };
    
    return status;
  }
  
  formatStatus(status) {
    if (this.options.jsonOutput) {
      return JSON.stringify(status, null, 2);
    }
    
    let output = `
🎯 Roastr.ai Worker System Status
================================
📅 Timestamp: ${new Date(status.timestamp).toLocaleString()}

🔌 Connections:
   Database (Supabase): ${status.connections.database ? '✅ Connected' : '❌ Disconnected'}
   Redis/Queue:         ${status.connections.redis ? '✅ Connected' : '❌ Disconnected'}
`;

    // Job Queue Stats
    if (status.jobQueues) {
      output += '\n📊 Database Job Queues:\n';
      Object.entries(status.jobQueues).forEach(([jobType, stats]) => {
        const total = Object.values(stats).reduce((a, b) => a + b, 0);
        output += `   ${jobType.padEnd(20)} | `;
        output += `Pending: ${stats.pending.toString().padEnd(4)} | `;
        output += `Processing: ${stats.processing.toString().padEnd(4)} | `;
        output += `Completed: ${stats.completed.toString().padEnd(5)} | `;
        output += `Failed: ${stats.failed.toString().padEnd(4)} | `;
        output += `Total: ${total}\n`;
      });
    }
    
    // Redis Queue Stats
    if (status.redisQueues) {
      output += '\n🔄 Redis Job Queues:\n';
      Object.entries(status.redisQueues).forEach(([queueType, stats]) => {
        output += `   ${queueType.padEnd(20)} | Pending: ${stats.pending}\n`;
      });
    }
    
    // Processing Stats
    if (status.processingStats) {
      const stats = status.processingStats;
      output += `\n📈 24-Hour Processing Stats:
   Total Jobs:      ${stats.totalJobs}
   Completed:       ${stats.completedJobs} (${Math.round((stats.completedJobs/stats.totalJobs)*100)}%)
   Failed:          ${stats.failedJobs} (${Math.round((stats.failedJobs/stats.totalJobs)*100)}%)
   Avg Process Time: ${(stats.avgProcessingTime/1000).toFixed(1)}s

   Success Rate by Type:`;
      
      Object.entries(stats.byType).forEach(([type, typeStats]) => {
        output += `\n   ${type.padEnd(20)} | ${typeStats.success_rate}% (${typeStats.completed}/${typeStats.total})`;
      });
    }
    
    // Recent Activity
    if (status.recentActivity && status.recentActivity.length > 0) {
      output += '\n\n🕐 Recent Activity (Last 20 Jobs):\n';
      status.recentActivity.slice(0, 10).forEach(job => {
        const created = new Date(job.created_at).toLocaleTimeString();
        const statusEmoji = {
          pending: '⏳',
          processing: '⚙️',
          completed: '✅',
          failed: '❌',
          retrying: '🔄'
        }[job.status] || '❓';
        
        output += `   ${statusEmoji} ${created} | ${job.job_type.padEnd(16)} | ${job.status}\n`;
      });
    }
    
    return output;
  }
  
  async run() {
    if (this.options.watchMode) {
      console.clear();
      console.log('🔄 Starting watch mode...\n');
      
      const update = async () => {
        try {
          console.clear();
          const status = await this.getFullStatus();
          console.log(this.formatStatus(status));
          console.log(`\n⏱️  Auto-refresh every ${this.options.updateInterval/1000}s | Press Ctrl+C to exit`);
        } catch (error) {
          console.error('Error updating status:', error.message);
        }
      };
      
      await update();
      setInterval(update, this.options.updateInterval);
      
    } else {
      const status = await this.getFullStatus();
      console.log(this.formatStatus(status));
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

args.forEach(arg => {
  if (arg === '--watch') {
    options.watchMode = true;
  } else if (arg.startsWith('--interval=')) {
    options.updateInterval = parseInt(arg.split('=')[1]) * 1000;
  } else if (arg.startsWith('--worker=')) {
    options.specificWorker = arg.split('=')[1];
  } else if (arg === '--json') {
    options.jsonOutput = true;
  }
});

// Create and run monitor
const monitor = new WorkerStatusMonitor(options);
monitor.run().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});