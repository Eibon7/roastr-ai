/**
 * AI Modes API Routes
 *
 * Issue #920: Portkey AI Gateway integration
 * Endpoint para listar modos de AI disponibles y su configuración
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const LLMClient = require('../lib/llmClient');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/ai-modes
 *
 * Lista todos los modos de AI disponibles con su metadata
 *
 * Response:
 * {
 *   success: true,
 *   modes: [
 *     {
 *       id: 'flanders',
 *       name: 'Flanders',
 *       description: 'Tono amable pero con ironía sutil',
 *       intensity: 2,
 *       provider: 'openai',
 *       model: 'gpt-5.1',
 *       temperature: 0.7,
 *       available: true
 *     },
 *     ...
 *   ]
 * }
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const availableModes = LLMClient.getAvailableModes();

    const modesMetadata = availableModes.map((modeId) => {
      const route = LLMClient.getRoute(modeId);

      // Metadata específica por modo
      const modeMetadata = {
        flanders: {
          name: 'Flanders',
          description: 'Tono amable pero con ironía sutil',
          intensity: 2,
          displayName: 'Flanders'
        },
        balanceado: {
          name: 'Balanceado',
          description: 'Equilibrio entre ingenio y firmeza',
          intensity: 3,
          displayName: 'Balanceado'
        },
        canalla: {
          name: 'Canalla',
          description: 'Directo y sin filtros, más picante',
          intensity: 4,
          displayName: 'Canalla'
        },
        nsfw: {
          name: 'NSFW',
          description: 'Modo NSFW con Grok (requiere configuración)',
          intensity: 5,
          displayName: 'NSFW'
        },
        default: {
          name: 'Por Defecto',
          description: 'Modo por defecto (GPT-5.1)',
          intensity: 3,
          displayName: 'Default'
        }
      };

      const metadata = modeMetadata[modeId] || modeMetadata.default;

      // Check if mode is available (NSFW requires Grok API key or Portkey)
      let available = true;
      if (modeId === 'nsfw') {
        const grokApiKey = process.env.GROK_API_KEY;
        const portkeyConfigured = LLMClient.isPortkeyConfigured();
        available = !!(grokApiKey || portkeyConfigured);
      }

      return {
        id: modeId,
        name: metadata.name,
        displayName: metadata.displayName,
        description: metadata.description,
        intensity: metadata.intensity,
        provider: route.provider,
        model: route.model,
        temperature: route.config.temperature,
        maxTokens: route.config.max_tokens,
        timeout: route.config.timeout,
        available,
        fallbackAvailable: modeId === 'nsfw' && !available // NSFW puede usar OpenAI como fallback
      };
    });

    logger.info('AI modes listed', {
      userId: req.user?.id,
      count: modesMetadata.length
    });

    res.json({
      success: true,
      modes: modesMetadata,
      portkeyConfigured: LLMClient.isPortkeyConfigured()
    });
  } catch (error) {
    logger.error('Error listing AI modes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar modos de AI',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/ai-modes/:modeId
 *
 * Obtiene información detallada de un modo específico
 */
router.get('/:modeId', authenticateToken, async (req, res) => {
  try {
    const { modeId } = req.params;

    if (!LLMClient.modeExists(modeId)) {
      return res.status(404).json({
        success: false,
        error: `Modo "${modeId}" no encontrado`
      });
    }

    const route = LLMClient.getRoute(modeId);
    const fallbackChain = LLMClient.getFallbackChain(modeId);

    // Check availability
    let available = true;
    if (modeId === 'nsfw') {
      const grokApiKey = process.env.GROK_API_KEY;
      const portkeyConfigured = LLMClient.isPortkeyConfigured();
      available = !!(grokApiKey || portkeyConfigured);
    }

    const modeMetadata = {
      flanders: {
        name: 'Flanders',
        description: 'Tono amable pero con ironía sutil',
        intensity: 2
      },
      balanceado: {
        name: 'Balanceado',
        description: 'Equilibrio entre ingenio y firmeza',
        intensity: 3
      },
      canalla: {
        name: 'Canalla',
        description: 'Directo y sin filtros, más picante',
        intensity: 4
      },
      nsfw: {
        name: 'NSFW',
        description: 'Modo NSFW con Grok (requiere configuración)',
        intensity: 5
      },
      default: {
        name: 'Por Defecto',
        description: 'Modo por defecto (GPT-5.1)',
        intensity: 3
      }
    };

    const metadata = modeMetadata[modeId] || modeMetadata.default;

    res.json({
      success: true,
      mode: {
        id: modeId,
        name: metadata.name,
        description: metadata.description,
        intensity: metadata.intensity,
        provider: route.provider,
        model: route.model,
        config: route.config,
        fallbackChain,
        available,
        fallbackAvailable: modeId === 'nsfw' && !available
      }
    });
  } catch (error) {
    logger.error(`Error getting AI mode ${req.params.modeId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener modo de AI',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
