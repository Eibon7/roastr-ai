/**
 * AI Modes API Routes
 * 
 * Endpoint for retrieving available AI modes and their configurations
 * Issue #920: Portkey AI Gateway integration
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const LLMClient = require('../lib/llmClient');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/ai-modes
 *
 * Retrieve available AI modes with their configurations and metadata.
 *
 * @auth Required (JWT)
 * @returns {Object} modes - List of available AI modes
 * 
 * Example response:
 * {
 *   success: true,
 *   data: [
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
    logger.info('Fetching available AI modes');
    const availableModes = LLMClient.getAvailableModes();
    
    const modesMetadata = availableModes.map(modeId => {
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
          name: 'Default',
          description: 'Modo por defecto',
          intensity: 3,
          displayName: 'Default'
        }
      };

      const metadata = modeMetadata[modeId] || {
        name: modeId,
        description: `Modo ${modeId}`,
        intensity: 3,
        displayName: modeId
      };

      // Check if mode is available (e.g., NSFW requires Grok API key)
      let available = true;
      if (modeId === 'nsfw') {
        available = !!(process.env.GROK_API_KEY || process.env.PORTKEY_API_KEY);
      }

      return {
        id: modeId,
        name: metadata.name,
        displayName: metadata.displayName,
        description: metadata.description,
        intensity: metadata.intensity,
        provider: route.provider,
        model: route.model,
        temperature: route.config?.temperature || 0.8,
        maxTokens: route.config?.max_tokens || 150,
        available: available,
        fallbackChain: LLMClient.getFallbackChain(modeId)
      };
    });

    res.status(200).json({
      success: true,
      data: modesMetadata
    });
  } catch (error) {
    logger.error('Error fetching AI modes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve AI modes',
      details: error.message
    });
  }
});

module.exports = router;

