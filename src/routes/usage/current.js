const express = require('express');
const usageService = require('../../services/usageService');
const { logger } = require('../../utils/logger');

const router = express.Router();

/**
 * GET /api/usage/current
 * Obtener uso actual del usuario (Issue #1066)
 *
 * @description Devuelve el consumo actual del usuario para el mes actual:
 *   - Análisis consumidos/disponibles
 *   - Roasts consumidos/disponibles
 *   - Período actual (inicio y fin del mes)
 *   - Plan del usuario
 *
 * @access Usuario autenticado (middleware aplicado en index.js)
 *
 * @returns {Object} Response object containing:
 *   - success: boolean
 *   - data: Object with current usage
 *     - analysis: Object - { consumed, available, remaining }
 *     - roasts: Object - { consumed, available, remaining }
 *     - period: Object - { start, end }
 *     - plan: string - Plan del usuario
 *
 * @example
 * GET /api/usage/current
 * Response: {
 *   "success": true,
 *   "data": {
 *     "analysis": {
 *       "consumed": 45,
 *       "available": 100,
 *       "remaining": 55
 *     },
 *     "roasts": {
 *       "consumed": 12,
 *       "available": 50,
 *       "remaining": 38
 *     },
 *     "period": {
 *       "start": "2025-11-01T00:00:00.000Z",
 *       "end": "2025-11-30T23:59:59.000Z"
 *     },
 *     "plan": "pro"
 *   }
 * }
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User ID not found in request'
      });
    }

    const usage = await usageService.getCurrentUsage(userId);

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    logger.error('Usage current endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch current usage',
      message: error.message
    });
  }
});

module.exports = router;

