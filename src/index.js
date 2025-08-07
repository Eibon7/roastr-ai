const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const RoastGeneratorReal = require('./services/roastGeneratorReal');
const CsvRoastService = require('./services/csvRoastService');
const IntegrationManager = require('./integrations/integrationManager');
const ReincidenceDetector = require('./services/reincidenceDetector');
const advancedLogger = require('./utils/advancedLogger');

// Import auth routes and middleware
const authRoutes = require('./routes/auth');
const integrationsRoutes = require('./routes/integrations');
const { authenticateToken, optionalAuth } = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(bodyParser.json());

// Servir archivos estáticos de la carpeta public
app.use(express.static(path.join(__dirname, '../public')));

// Auth routes
app.use('/api/auth', authRoutes);

// User integrations routes (authenticated)
app.use('/api/integrations', integrationsRoutes);

// Instancia del generador de roasts
let roastGenerator;
try {
  roastGenerator = new RoastGeneratorReal();
} catch (error) {
  console.error("❌ Error inicializando RoastGenerator:", error.message);
  process.exit(1);
}

// Instancia del servicio de CSV roasts
const csvRoastService = new CsvRoastService();

// Ruta principal: mostrar index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
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
    console.error('❌ Error generando roast:', error.message);

    if (error.response?.data) {
      console.error('📡 Respuesta de la API:', error.response.data);
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
    console.error('❌ Error generando roast desde CSV:', error.message);
    
    // Log additional details if debug mode is enabled
    if (process.env.DEBUG === 'true') {
      console.error('📡 CSV Error details:', error.stack);
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
    console.error('❌ Error obteniendo estadísticas CSV:', error.message);
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
    console.error('❌ Error añadiendo roast al CSV:', error.message);
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
          humorType: config[platform].humorType,
          responseFrequency: config[platform].responseFrequency,
          triggerWords: config[platform].triggerWords,
          shieldActions: config[platform].shieldActions
        };
      }
    }

    res.json(publicConfig);
  } catch (error) {
    console.error('❌ Error getting integration config:', error.message);
    res.status(500).json({ error: 'Could not get integration configuration.' });
  }
});

// 📌 RUTA: Actualizar configuración de plataforma (require auth)
app.post('/api/integrations/config/:platform', authenticateToken, async (req, res) => {
  try {
    const { platform } = req.params;
    const { tone, humorType, responseFrequency, triggerWords, shieldActions } = req.body;

    // TODO: Update configuration in database or file
    // For now, this would require restart to take effect
    
    res.json({ 
      success: true, 
      message: `Configuration updated for ${platform}. Restart required to take effect.`,
      platform,
      config: {
        tone,
        humorType,
        responseFrequency,
        triggerWords,
        shieldActions
      }
    });
  } catch (error) {
    console.error('❌ Error updating integration config:', error.message);
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
    console.error('❌ Error getting integration metrics:', error.message);
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
    console.error('❌ Error testing integrations:', error.message);
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
    console.error('❌ Error getting reincidence stats:', error.message);
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
    console.error('❌ Error getting platform reincidence stats:', error.message);
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
    console.error('❌ Error getting log files:', error.message);
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
      response.warning = '⚠️ This log contains sensitive content and may include offensive material.';
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Error reading log file:', error.message);
    res.status(500).json({ error: 'Could not read log file.' });
  }
});

// ============================================================================
// ROAST PREVIEW ENDPOINTS
// ============================================================================

// 📌 RUTA: Preview de roast con tono específico
app.post('/api/roast/preview', async (req, res) => {
  try {
    const { message, tone = 'sarcastic', humorType = 'witty' } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Debes enviar un campo "message" válido.' });
    }

    // Generate roast with specific tone
    const customPrompt = `Generate a ${tone} and ${humorType} roast response to: "${message}". Keep it clever and not offensive.`;
    
    const roast = await roastGenerator.generateRoastWithPrompt(message, customPrompt);
    
    res.json({ 
      roast,
      tone,
      humorType,
      preview: true
    });
  } catch (error) {
    console.error('❌ Error generating roast preview:', error.message);
    res.status(500).json({ error: 'No se pudo generar el preview del roast.' });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🔥 Roastr.ai API escuchando en http://localhost:${port}`);
});
