#!/usr/bin/env node

/**
 * Worker Startup Script for Roastr.ai Multi-Tenant Architecture
 * 
 * Usage:
 *   node src/workers/cli/start-workers.js [options]
 *   npm run workers:start [options]
 * 
 * Options:
 *   --workers=type1,type2    Specify which workers to start
 *   --config=path           Path to worker configuration file
 *   --env=environment       Environment (development, production)
 *   --debug                 Enable debug logging
 */

require('dotenv').config();
const WorkerManager = require('../WorkerManager');
const express = require('express');
const { setWorkerManager } = require('../../routes/workers');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

args.forEach(arg => {
  if (arg.startsWith('--workers=')) {
    options.enabledWorkers = arg.split('=')[1].split(',').map(w => w.trim());
  } else if (arg.startsWith('--config=')) {
    options.configPath = arg.split('=')[1];
  } else if (arg.startsWith('--env=')) {
    options.environment = arg.split('=')[1];
  } else if (arg === '--debug') {
    options.debug = true;
    process.env.DEBUG = 'true';
  }
});

// Load configuration
let config = {
  enabledWorkers: ['fetch_comments', 'analyze_toxicity', 'generate_reply', 'style_profile'],
  workerConfig: {
    fetch_comments: {
      maxConcurrency: 5,
      pollInterval: 2000
    },
    analyze_toxicity: {
      maxConcurrency: 3,
      pollInterval: 1500
    },
    generate_reply: {
      maxConcurrency: 2,
      pollInterval: 2000
    },
    style_profile: {
      maxConcurrency: 2,
      pollInterval: 5000 // Less frequent polling as it's not time-critical
    }
  },
  healthCheckInterval: 30000
};

// Override with command line options
if (options.enabledWorkers) {
  config.enabledWorkers = options.enabledWorkers;
}

// Load config file if specified
if (options.configPath) {
  try {
    const fileConfig = require(require('path').resolve(options.configPath));
    config = { ...config, ...fileConfig };
  } catch (error) {
    console.error(`Failed to load config file ${options.configPath}:`, error.message);
    process.exit(1);
  }
}

// Environment-specific adjustments
if (options.environment === 'production') {
  config.workerConfig = {
    ...config.workerConfig,
    fetch_comments: {
      ...config.workerConfig.fetch_comments,
      maxConcurrency: 10,
      pollInterval: 1000
    },
    analyze_toxicity: {
      ...config.workerConfig.analyze_toxicity,
      maxConcurrency: 5,
      pollInterval: 1000
    },
    generate_reply: {
      ...config.workerConfig.generate_reply,
      maxConcurrency: 3,
      pollInterval: 1500
    }
  };
}

// Validate environment variables
function validateEnvironment() {
  const required = ['SUPABASE_URL'];
  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  
  // Check optional but recommended variables
  const recommended = ['OPENAI_API_KEY', 'PERSPECTIVE_API_KEY', 'UPSTASH_REDIS_REST_URL'];
  const missingRecommended = recommended.filter(env => !process.env[env]);
  
  if (missingRecommended.length > 0) {
    console.warn('Missing recommended environment variables (workers may use fallbacks):', 
      missingRecommended.join(', '));
  }
}

// Main startup function
async function startWorkers() {
  console.log(`
🚀 Starting Roastr.ai Worker System
================================

Environment: ${options.environment || 'development'}
Workers: ${config.enabledWorkers.join(', ')}
Debug: ${options.debug ? 'enabled' : 'disabled'}

Configuration:
${JSON.stringify(config, null, 2)}
`);

  // Validate environment
  validateEnvironment();
  
  try {
    // Create and start worker manager
    const workerManager = new WorkerManager(config);
    await workerManager.start();
    
    // Set the worker manager for the API routes
    setWorkerManager(workerManager);
    
    console.log('✅ All workers started successfully!');
    console.log('');
    console.log('Worker Status:');
    console.log(JSON.stringify(workerManager.getSummary(), null, 2));
    
    // Log periodic status updates
    if (options.debug) {
      setInterval(() => {
        console.log('\n📊 Worker Status Update:');
        console.log(JSON.stringify(workerManager.getSummary(), null, 2));
      }, 60000); // Every minute
    }
    
    // Start a simple HTTP server for health endpoints
    const app = express();
    app.use(express.json());
    
    // Add CORS for local development
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      next();
    });
    
    // Mount worker routes
    const { router: workersRoutes } = require('../../routes/workers');
    app.use('/api/workers', workersRoutes);
    
    // Simple health check
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        service: 'worker-manager',
        uptime: process.uptime()
      });
    });
    
    const PORT = process.env.WORKER_STATUS_PORT || 3001;
    app.listen(PORT, () => {
      console.log(`\n📊 Worker status API available at http://localhost:${PORT}/api/workers/status`);
      console.log(`🏥 Health check available at http://localhost:${PORT}/api/workers/health`);
    });
    
    // Keep process alive
    console.log('\nPress Ctrl+C to stop workers gracefully...');
    
  } catch (error) {
    console.error('❌ Failed to start workers:', error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Handle process signals for graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, initiating graceful shutdown...');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, initiating graceful shutdown...');
});

// Start workers
startWorkers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});