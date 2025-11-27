const express = require('express');
const metricsService = require('../../services/metricsService');
const { logger } = require('../../utils/logger');

const router = express.Router();

/**
 * GET /api/admin/metrics
 * Obtener métricas agregadas del sistema (Issue #1065)
 *
 * @description Devuelve métricas agregadas: análisis totales, roasts totales, usuarios activos,
 * distribución por plan, uso de features, y costes medios.
 *
 * @access Admin only (middleware aplicado en admin.js)
 *
 * @returns {Object} Response object containing:
 *   - success: boolean
 *   - data: Object with aggregated metrics
 *     - total_analysis: number - Total análisis realizados
 *     - total_roasts: number - Total roasts generados
 *     - active_users: number - Usuarios activos
 *     - avg_analysis_per_user: number - Análisis medios por usuario
 *     - avg_roasts_per_user: number - Roasts medios por usuario
 *     - users_by_plan: Object - % usuarios por plan
 *     - feature_usage: Object - % uso de features (persona, sponsors, custom_tone)
 *     - costs: Object - Costes medios (por análisis y por roast)
 *
 * @example
 * GET /api/admin/metrics
 * Response: {
 *   "success": true,
 *   "data": {
 *     "total_analysis": 15234,
 *     "total_roasts": 8934,
 *     "active_users": 245,
 *     "avg_analysis_per_user": 62.18,
 *     "avg_roasts_per_user": 36.47,
 *     "users_by_plan": {
 *       "free": 45.5,
 *       "pro": 32.2,
 *       "plus": 22.3
 *     },
 *     "feature_usage": {
 *       "persona": 12.5,
 *       "sponsors": 8.3,
 *       "custom_tone": 0
 *     },
 *     "costs": {
 *       "avg_cost_per_analysis": 0.01,
 *       "avg_tokens_per_analysis": 150.5,
 *       "avg_cost_per_roast": 0.05,
 *       "avg_tokens_per_roast": 250.3
 *     }
 *   }
 * }
 */
router.get('/', async (req, res) => {
  try {
    const metrics = await metricsService.getAggregatedMetrics();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Admin metrics endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch aggregated metrics',
      message: error.message
    });
  }
});

module.exports = router;
