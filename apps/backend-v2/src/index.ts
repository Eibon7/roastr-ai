/**
 * Backend v2 - Main Entry Point
 *
 * This is the main application bootstrap file.
 * It initializes all services including Amplitude Analytics.
 */

import express from 'express';
import { initializeAmplitude } from './lib/analytics.js';
import { initializeRedis } from './lib/redisClient.js';
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import { attachRequestId } from './middleware/requestId.js';
import { logger } from './utils/logger.js';
import { rateLimitService } from './services/rateLimitService.js';
import { logRateLimit } from './utils/authObservability.js';

// Initialize Amplitude Analytics
initializeAmplitude();

// ROA-523: Initialize Redis/Upstash for rate limiting
initializeRedis();

// ROA-410: Connect rate limit service with observability
rateLimitService.setObservability({
  logRateLimit
});

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(attachRequestId);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    version: process.env.APP_VERSION || '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/v2/auth', authRoutes);
app.use('/api/v2/auth', oauthRoutes);

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Backend v2 server running on port ${PORT}`);
  });
}

export default app;
