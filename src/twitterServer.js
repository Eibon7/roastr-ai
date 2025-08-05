#!/usr/bin/env node

/**
 * Persistent Twitter Bot Server
 * This file creates a simple HTTP server that runs the Twitter bot in streaming mode
 * Useful for deployment on platforms that require an HTTP server
 */

const express = require('express');
const TwitterRoastBot = require('./services/twitter');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

let bot = null;
let botStatus = 'stopped';

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bot_status: botStatus,
    timestamp: new Date().toISOString()
  });
});

// Bot status endpoint
app.get('/bot/status', (req, res) => {
  res.json({
    status: botStatus,
    bot_user: bot ? {
      id: bot.botUserId,
      username: bot.botUsername
    } : null,
    timestamp: new Date().toISOString()
  });
});

// Start bot endpoint
app.post('/bot/start', async (req, res) => {
  try {
    if (botStatus === 'running') {
      return res.status(400).json({ error: 'Bot is already running' });
    }

    console.log('📡 Starting Twitter bot via API request...');
    
    bot = new TwitterRoastBot();
    botStatus = 'starting';
    
    // Start the bot in background
    bot.runStream().catch(error => {
      console.error('❌ Bot crashed:', error);
      botStatus = 'error';
    });
    
    botStatus = 'running';
    
    res.json({
      message: 'Bot started successfully',
      status: botStatus,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error starting bot:', error);
    botStatus = 'error';
    res.status(500).json({ 
      error: 'Failed to start bot',
      message: error.message 
    });
  }
});

// Stop bot endpoint
app.post('/bot/stop', (req, res) => {
  try {
    if (botStatus !== 'running') {
      return res.status(400).json({ error: 'Bot is not running' });
    }

    console.log('🛑 Stopping Twitter bot via API request...');
    
    if (bot && bot.stream) {
      bot.stream.close();
    }
    
    bot = null;
    botStatus = 'stopped';
    
    res.json({
      message: 'Bot stopped successfully',
      status: botStatus,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error stopping bot:', error);
    res.status(500).json({ 
      error: 'Failed to stop bot',
      message: error.message 
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Roastr.ai Twitter Bot Server',
    version: '1.0.0',
    status: 'running',
    bot_status: botStatus,
    endpoints: {
      'GET /health': 'Health check',
      'GET /bot/status': 'Bot status',
      'POST /bot/start': 'Start bot',
      'POST /bot/stop': 'Stop bot'
    }
  });
});

// Start server
app.listen(port, async () => {
  console.log(`🔥 Roastr.ai Twitter Bot Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🤖 Bot status: http://localhost:${port}/bot/status`);
  
  // Auto-start bot if environment variable is set
  if (process.env.AUTO_START_BOT === 'true') {
    try {
      console.log('🚀 Auto-starting Twitter bot...');
      bot = new TwitterRoastBot();
      botStatus = 'starting';
      
      bot.runStream().catch(error => {
        console.error('❌ Bot crashed:', error);
        botStatus = 'error';
      });
      
      botStatus = 'running';
      console.log('✅ Twitter bot auto-started');
      
    } catch (error) {
      console.error('❌ Failed to auto-start bot:', error);
      botStatus = 'error';
    }
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  
  if (bot && bot.stream) {
    bot.stream.close();
  }
  
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  
  if (bot && bot.stream) {
    bot.stream.close();
  }
  
  process.exit(0);
});