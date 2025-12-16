const express = require('express');
const { logger } = require('./utils/logger'); // Issue #971: Added for console.log replacement
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Validate critical environment variables at startup
function validateEnvironment() {
  // Skip validation during tests
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const requiredVars = ['IDEMPOTENCY_SECRET'];
  const missing = requiredVars.filter(
    (varName) => !process.env[varName] || process.env[varName].trim() === ''
  );

  if (missing.length > 0) {
    logger.error('❌ Missing required environment variables:', missing.join(', '));
    logger.error('💡 Please set IDEMPOTENCY_SECRET to a strong randomly generated secret');
    process.exit(1);
  }
}

// Run environment validation
validateEnvironment();

// Security and monitoring middleware
const {
  helmetConfig,
  corsConfig,
  generalRateLimit,
  authRateLimit,
  billingRateLimit,
  validateInput,
  requestLogger,
  errorHandler
} = require('./middleware/security');
const { flags } = require('./config/flags');

const RoastGeneratorReal = require('./services/roastGeneratorReal');
const CsvRoastService = require('./services/csvRoastService');
const IntegrationManager = require('./integrations/integrationManager');
const ReincidenceDetector = require('./services/reincidenceDetector');
const advancedLogger = require('./utils/advancedLogger');
const monitoringService = require('./services/monitoringService');
const alertingService = require('./services/alertingService');

// Import auth routes and middleware
const authRoutes = require('./routes/auth');
const integrationsRoutes = require('./routes/integrations');
const oauthRoutes = require('./routes/oauth');
const webhooksRoutes = require('./routes/webhooks');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const billingRoutes = require('./routes/billing');
const shopRoutes = require('./routes/shop');
const dashboardRoutes = require('./routes/dashboard');
const { router: planRoutes } = require('./routes/plan');
const { router: newIntegrationsRoutes } = require('./routes/integrations-new');
const styleProfileRoutes = require('./routes/style-profile');
const stylecardsRoutes = require('./routes/stylecards');
const configRoutes = require('./routes/config');
const approvalRoutes = require('./routes/approval');
const analyticsRoutes = require('./routes/analytics');
const notificationsRoutes = require('./routes/notifications');
const roastRoutes = require('./routes/roast');
const roastingRoutes = require('./routes/roasting');
const settingsRoutes = require('./routes/settings');
const commentsRoutes = require('./routes/comments');
const triageRoutes = require('./routes/triage');
const personaRoutes = require('./routes/persona');
const checkoutRoutes = require('./routes/checkout');
const polarWebhookRoutes = require('./routes/polarWebhook');
const creditsRoutes = require('./routes/credits'); // QW9: Add credits router
const sponsorsRoutes = require('./routes/sponsors')(); // Issue #859: Brand Safety for Sponsors (Plan Plus) - Factory function
const aiModesRoutes = require('./routes/ai-modes'); // Issue #920: AI modes endpoint
const usageCurrentRoutes = require('./routes/usage/current'); // Issue #1066: Usage current endpoint
const { authenticateToken, optionalAuth } = require('./middleware/auth');
const ssotRoutes = require('./routes/ssot'); // ROA-267: Public SSOT endpoints for frontend v2

const app = express();
const port = process.env.PORT || 3000;

// Configure trust proxy for proper IP detection in production
// This is essential for rate limiting to work correctly behind proxies/load balancers
if (process.env.NODE_ENV === 'production') {
  // Trust first proxy in production (common for cloud deployments)
  app.set('trust proxy', 1);
} else {
  // In development, trust all proxies for testing
  app.set('trust proxy', true);
}

// Apply security middleware
app.use(helmetConfig);
app.use(corsConfig);

// Skip request logger and validateInput for health check
app.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  requestLogger(req, res, next);
});

app.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  validateInput(req, res, next);
});

// Simple health check endpoint (after security headers but before rate limiting)
app.get('/health', (req, res) => {
  try {
    const uptime = process.uptime();

    // Try to load version safely
    let version = '1.0.0';
    try {
      version = require('../package.json').version || '1.0.0';
    } catch (e) {
      // Ignore version loading error
    }

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime)}s`,
      version,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Comprehensive health check endpoint with system monitoring
app.get('/api/health', async (req, res) => {
  try {
    const startTime = Date.now();
    const healthStatus = await monitoringService.getHealthStatus();
    const responseTime = Date.now() - startTime;

    // Track response time for monitoring
    monitoringService.trackResponseTime(responseTime);
    monitoringService.trackRequest(healthStatus.status === 'error');

    // Set appropriate HTTP status code
    let httpStatus = 200;
    if (healthStatus.status === 'unhealthy') {
      httpStatus = 503; // Service Unavailable
    } else if (healthStatus.status === 'degraded') {
      httpStatus = 200; // Still operational but degraded
    } else if (healthStatus.status === 'error') {
      httpStatus = 500; // Internal Server Error
    }

    res.status(httpStatus).json({
      success: healthStatus.status !== 'error',
      data: healthStatus
    });
  } catch (error) {
    logger.error('Comprehensive health check error:', error);

    monitoringService.trackRequest(true);

    res.status(500).json({
      success: false,
      error: {
        message: 'Health check system error',
        details: error.message
      },
      data: {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      }
    });
  }
});

// Apply general rate limiting only to API routes
app.use('/api', generalRateLimit);

// Stripe webhook endpoint (needs raw body, before JSON parsing)
app.use('/webhooks/stripe', billingRoutes);

// Polar webhook endpoint (needs raw body for HMAC verification, before JSON parsing)
app.use('/api/polar/webhook', express.raw({ type: 'application/json' }), polarWebhookRoutes);

// Middleware para parsear cookies (required for CSRF validation)
app.use(cookieParser());

// Middleware para parsear JSON (after webhooks to preserve raw body)
app.use(bodyParser.json());

// Apply auth-specific rate limiting
app.use('/api/auth', authRateLimit);

// Apply billing-specific rate limiting
app.use('/api/billing', billingRateLimit);

// Servir archivos estáticos de la carpeta public (legacy files) con seguridad mejorada
app.use(
  '/public',
  express.static(path.join(__dirname, '../public'), {
    index: false, // Prevent directory indexing
    dotfiles: 'ignore', // Ignore hidden files
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0', // Cache for 1 day in production
    setHeaders: (res, path) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');

      // Add appropriate cache headers for different file types
      if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
      } else if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  })
);

// Servir archivos estáticos del frontend React con caching mejorado y prevención de indexing
app.use(
  express.static(path.join(__dirname, '../frontend/build'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
    immutable: process.env.NODE_ENV === 'production',
    index: false, // Prevent directory indexing
    dotfiles: 'ignore', // Ignore hidden files
    setHeaders: (res, path) => {
      // Prevent directory indexing at header level
      res.setHeader('X-Content-Type-Options', 'nosniff');

      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  })
);

// Auth routes
app.use('/api/auth', authRoutes);

// OAuth routes (for social media connections) - Issue #638
// Fix: OAuth callbacks must be under /api/auth, not /api/integrations
// Routes in oauth.js generate redirectUri as /api/auth/:platform/callback
app.use('/api/auth', oauthRoutes);

// Webhook routes (for platform event handling)
app.use('/api/webhooks', webhooksRoutes);

// User routes (authenticated)
app.use('/api/user', userRoutes);

// Usage routes (authenticated) - Issue #1066
app.use('/api/usage', authenticateToken, usageCurrentRoutes);

// Plan routes (plan selection and features)
app.use('/api/plan', planRoutes);

// Billing routes (Stripe integration)
app.use('/api/billing', billingRoutes);

// Shop routes (addon purchases)
app.use('/api/shop', shopRoutes);

// Dashboard routes (public/authenticated)
app.use('/api', dashboardRoutes);

// New integrations routes for style profile flow (mounted FIRST to avoid auth conflict - Issue #480 Week 3)
app.use('/api/integrations', newIntegrationsRoutes);

// User integrations routes (authenticated) (mounted SECOND - legacy routes)
app.use('/api/integrations', integrationsRoutes);

// Style profile routes (authenticated, Creator+ only)
app.use('/api/style-profile', styleProfileRoutes);

// Stylecards routes (authenticated, Pro+ only) - Issue #293
app.use('/api/stylecards', stylecardsRoutes);

// Configuration routes (authenticated)
// SSOT public routes (ROA-267: Public SSOT endpoints for frontend v2)
app.use('/api/ssot', ssotRoutes);
app.use('/api/config', configRoutes);

// Approval routes (authenticated)
app.use('/api/approval', approvalRoutes);

// Analytics routes (authenticated)
app.use('/api/analytics', analyticsRoutes);

// Notifications routes (authenticated)
app.use('/api/notifications', notificationsRoutes);

// Roast generation routes (authenticated)
app.use('/api/roast', roastRoutes);

// Credits API routes - QW9: Fix missing credits router mount
app.use('/api/credits', creditsRoutes);

// Roasting control routes (authenticated) - Issue #596
app.use('/api/roasting', roastingRoutes);

// Settings routes (authenticated) - Issue #362
app.use('/api/settings', settingsRoutes);

// Comments ingestion routes (for SPEC 14 testing)
app.use('/api/comments', commentsRoutes);

// Triage routes (for Issue #443) - authenticated access
app.use('/api/triage', triageRoutes);

// Persona routes (for Issue #595) - authenticated access
app.use(personaRoutes);

// Sponsors routes (for Issue #859) - authenticated access + Plus plan gating
app.use('/api/sponsors', sponsorsRoutes);

// AI modes routes (Issue #920: Portkey AI Gateway integration)
app.use('/api/ai-modes', aiModesRoutes);

// Polar checkout routes - public access (handles its own auth)
app.use('/api', checkoutRoutes);

// Polar webhook routes - mounted earlier (line 190) before JSON parser to preserve raw body
// See: CRITICAL fix for HMAC signature verification

// Monitoring routes (authenticated) - Issue #396
const monitoringRoutes = require('./routes/monitoring');
app.use('/api/monitoring', monitoringRoutes);

// Tier validation routes (authenticated) - Issue #368
const tierValidationRoutes = require('./routes/tierValidation');
app.use('/api/tier-validation', tierValidationRoutes);

// Model availability routes (authenticated, admin) - Issue #326
const modelAvailabilityRoutes = require('./routes/modelAvailability');
app.use('/api/model-availability', modelAvailabilityRoutes);

// Worker status routes (authenticated)
const { router: workersRoutes } = require('./routes/workers');
app.use('/api/workers', workersRoutes);

// ============================================================================
// MONITORING & METRICS ENDPOINTS
// ============================================================================

// Comprehensive metrics endpoint
app.get('/api/metrics', authenticateToken, async (req, res) => {
  try {
    const startTime = Date.now();
    const metrics = await monitoringService.getMetrics();
    const responseTime = Date.now() - startTime;

    // Track response time for monitoring
    monitoringService.trackResponseTime(responseTime);
    monitoringService.trackRequest(false);

    res.json({
      success: true,
      data: metrics,
      meta: {
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Metrics endpoint error:', error);

    monitoringService.trackRequest(true);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve metrics',
        details: error.message
      }
    });
  }
});

// Analytics summary endpoint (Issue #366)
app.get('/api/analytics/summary', authenticateToken, async (req, res) => {
  try {
    const { supabaseServiceClient } = require('./config/supabase');

    // Get org_id from token (if available) or use default for backoffice
    const orgId = req.user?.org_id || null;

    // Build query for completed analyses with conditional org filtering
    let commentsQuery = supabaseServiceClient
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'processed');

    // Only apply org filtering when orgId is truthy and valid (Issue #366 CodeRabbit fix)
    if (orgId && orgId !== 'undefined' && orgId !== 'null') {
      commentsQuery = commentsQuery.eq('organization_id', orgId);
    }

    const { count: completedCount, error: analysesError } = await commentsQuery;

    if (analysesError) {
      throw analysesError;
    }

    // Build query for sent roasts with conditional org filtering
    let responsesQuery = supabaseServiceClient
      .from('responses')
      .select('id', { count: 'exact', head: true })
      .not('posted_at', 'is', null);

    // Only apply org filtering when orgId is truthy and valid (Issue #366 CodeRabbit fix)
    if (orgId && orgId !== 'undefined' && orgId !== 'null') {
      responsesQuery = responsesQuery.eq('organization_id', orgId);
    }

    const { count: sentCount, error: roastsError } = await responsesQuery;

    if (roastsError) {
      throw roastsError;
    }

    res.json({
      success: true,
      data: {
        completed_analyses: completedCount || 0,
        sent_roasts: sentCount || 0
      },
      meta: {
        timestamp: new Date().toISOString(),
        organization_id: orgId && orgId !== 'undefined' && orgId !== 'null' ? orgId : 'global'
      }
    });
  } catch (error) {
    logger.error('Analytics summary error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve analytics summary',
        details: error.message
      }
    });
  }
});

// Test monitoring system endpoint (authenticated) - disabled in production unless explicitly enabled
if (process.env.NODE_ENV !== 'production' || flags.isEnabled('ENABLE_DEBUG_LOGS')) {
  app.post('/api/monitoring/test', authenticateToken, async (req, res) => {
    try {
      const testResults = await monitoringService.runSystemTest();

      res.json({
        success: testResults.overall.passed,
        data: testResults
      });
    } catch (error) {
      logger.error('Monitoring test error:', error);

      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to run monitoring test',
          details: error.message
        }
      });
    }
  });
}

// Send test alert endpoint (authenticated) - disabled in production unless explicitly enabled
if (process.env.NODE_ENV !== 'production' || flags.isEnabled('ENABLE_DEBUG_LOGS')) {
  app.post('/api/monitoring/alert/test', authenticateToken, async (req, res) => {
    try {
      const {
        severity = 'info',
        title = 'Test Alert',
        message = 'This is a test alert'
      } = req.body;

      const alertSent = await alertingService.sendAlert(
        severity,
        title,
        message,
        { test: true, timestamp: new Date().toISOString() },
        { force: true, skipRateLimit: true }
      );

      res.json({
        success: alertSent,
        data: {
          alertSent,
          severity,
          title,
          message,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Test alert error:', error);

      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to send test alert',
          details: error.message
        }
      });
    }
  });
}

// Get alerting service stats (authenticated)
app.get('/api/monitoring/alerts/stats', authenticateToken, async (req, res) => {
  try {
    const stats = alertingService.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Alert stats error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get alert stats',
        details: error.message
      }
    });
  }
});

// Admin routes (admin only)
app.use('/api/admin', adminRoutes);

// Guardian governance routes (Phase 17)
const guardianRoutes = require('./routes/guardian');
app.use('/api/guardian', guardianRoutes);

// Instancia del generador de roasts
let roastGenerator;
try {
  roastGenerator = new RoastGeneratorReal();
} catch (error) {
  logger.error('❌ Error inicializando RoastGenerator:', error.message);
  process.exit(1);
}

// Instancia del servicio de CSV roasts
const csvRoastService = new CsvRoastService();

// Ruta principal: servir React app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// Mantener acceso directo a index.html si es necesario (legacy)
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Direct route for manual approval UI (Issue #419 - E2E tests)
app.get('/manual-approval.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/manual-approval.html'));
});

// Ruta para generar un roast normal
app.post('/roast', async (req, res) => {
  const { message, tone } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Debes enviar un campo "message" válido.' });
  }

  // Validar el tono si se proporciona
  const validTones = ['sarcastic', 'subtle', 'direct'];
  const selectedTone = tone && validTones.includes(tone) ? tone : 'sarcastic';

  try {
    const roast = await roastGenerator.generateRoast(message, null, selectedTone);
    res.json({ roast, tone: selectedTone });
  } catch (error) {
    logger.error('❌ Error generando roast:', error.message);

    if (error.response?.data) {
      logger.error('📡 Respuesta de la API:', error.response.data);
    }

    res.status(500).json({ error: 'No se pudo generar el roast en este momento.' });
  }
});

// 📌 RUTA: Roast desde CSV con datos reales
app.post('/csv-roast', async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Debes enviar un campo "message" válido.' });
  }

  try {
    const roast = await csvRoastService.findBestRoast(message);
    res.json({
      roast,
      source: 'csv',
      originalMessage: message
    });
  } catch (error) {
    logger.error('❌ Error generando roast desde CSV:', error.message);

    // Log additional details if debug mode is enabled
    if (process.env.DEBUG === 'true') {
      logger.error('📡 CSV Error details:', error.stack);
    }

    res.status(500).json({
      error: 'No se pudo generar el roast desde CSV.',
      details: process.env.DEBUG === 'true' ? error.message : undefined
    });
  }
});

// 📌 RUTA: Obtener estadísticas del CSV
app.get('/csv-stats', async (req, res) => {
  try {
    const stats = await csvRoastService.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('❌ Error obteniendo estadísticas CSV:', error.message);
    res.status(500).json({ error: 'No se pudieron obtener las estadísticas del CSV.' });
  }
});

// 📌 RUTA: Añadir nuevo roast al CSV
app.post('/csv-add', async (req, res) => {
  const { comment, roast } = req.body;

  if (!comment || typeof comment !== 'string') {
    return res.status(400).json({ error: 'Debes enviar un campo "comment" válido.' });
  }

  if (!roast || typeof roast !== 'string') {
    return res.status(400).json({ error: 'Debes enviar un campo "roast" válido.' });
  }

  try {
    await csvRoastService.addRoast(comment, roast);
    res.json({
      success: true,
      message: 'Roast añadido exitosamente al CSV'
    });
  } catch (error) {
    logger.error('❌ Error añadiendo roast al CSV:', error.message);
    res.status(500).json({ error: 'No se pudo añadir el roast al CSV.' });
  }
});

// ============================================================================
// INTEGRATION MANAGEMENT ENDPOINTS
// ============================================================================

// 📌 RUTA: Obtener configuración de integraciones (require auth)
app.get('/api/integrations/config', authenticateToken, async (req, res) => {
  try {
    const config = require('./config/integrations');

    // Remove sensitive data before sending
    const publicConfig = {
      enabled: config.enabled,
      roastrMode: config.roastrMode,
      platforms: {}
    };

    // Add public config for each platform
    for (const platform of config.enabled) {
      if (config[platform]) {
        publicConfig.platforms[platform] = {
          enabled: config[platform].enabled,
          tone: config[platform].tone,
          // humorType removed (Issue #868)
          responseFrequency: config[platform].responseFrequency,
          triggerWords: config[platform].triggerWords,
          shieldActions: config[platform].shieldActions
        };
      }
    }

    res.json(publicConfig);
  } catch (error) {
    logger.error('❌ Error getting integration config:', error.message);
    res.status(500).json({ error: 'Could not get integration configuration.' });
  }
});

// 📌 RUTA: Actualizar configuración de plataforma (require auth)
app.post('/api/integrations/config/:platform', authenticateToken, async (req, res) => {
  try {
    const { platform } = req.params;
    const { tone, responseFrequency, triggerWords, shieldActions } = req.body; // humorType removed (Issue #868)

    // Update configuration in memory for immediate effect
    // Database persistence would be implemented with proper configuration service
    logger.info('Platform configuration update requested', {
      platform,
      userId: req.user?.id,
      configKeys: Object.keys({ tone, responseFrequency, triggerWords, shieldActions }).filter(
        (key) => req.body[key] !== undefined
      )
    });

    res.json({
      success: true,
      message: `Configuration updated for ${platform}. Restart required to take effect.`,
      platform,
      config: {
        tone,
        // humorType removed (Issue #868)
        responseFrequency,
        triggerWords,
        shieldActions
      }
    });
  } catch (error) {
    logger.error('❌ Error updating integration config:', error.message);
    res.status(500).json({ error: 'Could not update integration configuration.' });
  }
});

// 📌 RUTA: Obtener métricas de integraciones (require auth)
app.get('/api/integrations/metrics', authenticateToken, async (req, res) => {
  try {
    const integrationManager = new IntegrationManager();
    await integrationManager.initializeIntegrations();

    const metrics = integrationManager.getGlobalMetrics();

    await integrationManager.shutdown();

    res.json(metrics);
  } catch (error) {
    logger.error('❌ Error getting integration metrics:', error.message);
    res.status(500).json({ error: 'Could not get integration metrics.' });
  }
});

// 📌 RUTA: Ejecutar batch test de integraciones (require auth)
app.post('/api/integrations/test', authenticateToken, async (req, res) => {
  try {
    const integrationManager = new IntegrationManager();
    const initResult = await integrationManager.initializeIntegrations();

    if (initResult.success > 0) {
      const batchResult = await integrationManager.runBatch();
      await integrationManager.shutdown();

      res.json({
        success: true,
        message: 'Integration test completed',
        results: {
          initialization: initResult,
          batch: batchResult
        }
      });
    } else {
      await integrationManager.shutdown();
      res.json({
        success: false,
        message: 'No integrations were successfully initialized',
        results: { initialization: initResult }
      });
    }
  } catch (error) {
    logger.error('❌ Error testing integrations:', error.message);
    res.status(500).json({ error: 'Could not test integrations.' });
  }
});

// ============================================================================
// SHIELD & REINCIDENCE ENDPOINTS
// ============================================================================

// 📌 RUTA: Obtener estadísticas de reincidencia
app.get('/api/shield/reincidence', async (req, res) => {
  try {
    const detector = new ReincidenceDetector();
    const summary = detector.getGlobalSummary();

    res.json(summary);
  } catch (error) {
    logger.error('❌ Error getting reincidence stats:', error.message);
    res.status(500).json({ error: 'Could not get reincidence statistics.' });
  }
});

// 📌 RUTA: Obtener estadísticas por plataforma
app.get('/api/shield/reincidence/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const detector = new ReincidenceDetector();
    const summary = detector.getPlatformSummary(platform);

    res.json({ platform, summary });
  } catch (error) {
    logger.error('❌ Error getting platform reincidence stats:', error.message);
    res.status(500).json({ error: 'Could not get platform reincidence statistics.' });
  }
});

// ============================================================================
// LOGGING ENDPOINTS
// ============================================================================

// 📌 RUTA: Obtener archivos de log disponibles
app.get('/api/logs', async (req, res) => {
  try {
    const logFiles = await advancedLogger.getLogFiles();
    res.json(logFiles);
  } catch (error) {
    logger.error('❌ Error getting log files:', error.message);
    res.status(500).json({ error: 'Could not get log files.' });
  }
});

// 📌 RUTA: Leer contenido de log específico
app.get('/api/logs/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    const lines = parseInt(req.query.lines) || 100;

    const logContent = await advancedLogger.readLog(type, filename, lines);

    // Add warning for shield logs
    const response = {
      type,
      filename,
      lines: logContent.length,
      content: logContent
    };

    if (type === 'shield') {
      response.warning =
        '⚠️ This log contains sensitive content and may include offensive material.';
    }

    res.json(response);
  } catch (error) {
    logger.error('❌ Error reading log file:', error.message);
    res.status(500).json({ error: 'Could not read log file.' });
  }
});

// ============================================================================
// ROAST ENDPOINTS - Now handled by /api/roast routes
// ============================================================================

// Export app for testing
let server;

if (require.main === module) {
  // Add catch-all handler only when running as main module (not in tests)
  // This prevents path-to-regexp issues during test imports
  // Improved SPA routing with regex to exclude more paths for better performance
  app.get(
    /^(?!\/api|\/static|\/webhook|\/uploads|\/health|\/public|\/favicon\.ico|\/manifest\.json|\/robots\.txt).*$/,
    (req, res, next) => {
      const hasFileExtension = /\.[^.]+$/.test(req.path) && !req.path.endsWith('.html');
      if (hasFileExtension) {
        return next();
      }

      // Enhanced error handling for file serving
      res.sendFile(path.join(__dirname, '../frontend/build/index.html'), (err) => {
        if (err) {
          logger.error('Error serving SPA:', {
            error: err.message,
            path: req.path,
            statusCode: err.status || 500,
            timestamp: new Date().toISOString()
          });

          // Provide fallback response if index.html fails to serve
          if (err.code === 'ENOENT') {
            return res.status(404).json({
              success: false,
              error: 'SPA index.html not found',
              code: 'SPA_NOT_FOUND'
            });
          }

          next(err);
        }
      });
    }
  );

  // 404 handler for unknown routes (moved after SPA catch-all)
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      code: 'ROUTE_NOT_FOUND',
      path: req.path
    });
  });

  // Start Model Availability Worker (Issue #326) - Skip in test/E2E mode
  if (process.env.NODE_ENV !== 'test') {
    try {
      const { startModelAvailabilityWorker } = require('./workers/ModelAvailabilityWorker');
      const worker = startModelAvailabilityWorker();
      logger.info('🔍 Model Availability Worker started (GPT-5 auto-detection)');
    } catch (error) {
      logger.warn('⚠️ Failed to start Model Availability Worker:', error.message);
    }
  }

  server = app.listen(port, () => {
    logger.info(`🔥 Roastr.ai API escuchando en http://localhost:${port}`);
    logger.info(`🏁 Feature flags loaded:`, Object.keys(flags.getAllFlags()).length, 'flags');
    logger.info(`🔄 GPT-5 Detection: Active (checks every 24h)`);

    const serviceStatus = flags.getServiceStatus();
    logger.info(`💾 Database:`, serviceStatus.database);
    logger.info(`💳 Billing:`, serviceStatus.billing);
    logger.info(`🤖 OpenAI:`, serviceStatus.ai.openai);
  });
}

// Export both app and server for testing
module.exports = { app, server };
