/**
 * Backend v2 - Main Entry Point
 *
 * This is the main application bootstrap file.
 * It initializes all services including Amplitude Analytics.
 */

import express from 'express';
import { initializeAmplitude } from './lib/analytics.js';

// Initialize Amplitude Analytics
initializeAmplitude();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    version: process.env.APP_VERSION || '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Backend v2 server running on port ${PORT}`);
  });
}

export default app;

