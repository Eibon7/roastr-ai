const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');
const planLimitsService = require('./planLimitsService');

class UsageService {
  /**
   * Obtener uso actual del usuario para el mes actual
   * Issue #1066: Implementar endpoint de uso actual del usuario (backend)
   *
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} Objeto con análisis y roasts consumidos/disponibles
   */
  async getCurrentUsage(userId) {
    try {
      // Obtener plan del usuario
      const { data: user, error: userError } = await supabaseServiceClient
        .from('users')
        .select('plan')
        .eq('id', userId)
        .single();

      if (userError) {
        logger.warn('Error fetching user plan:', userError.message);
        // Usar plan 'free' como fallback
        return this.getUsageWithPlan(userId, 'free');
      }

      const userPlan = user?.plan || 'free';
      return this.getUsageWithPlan(userId, userPlan);
    } catch (error) {
      logger.error('Error getting current usage:', error.message);
      throw error;
    }
  }

  /**
   * Obtener uso con plan específico
   * @private
   */
  async getUsageWithPlan(userId, plan) {
    try {
      // Obtener límites del plan
      const planLimits = await planLimitsService.getPlanLimits(plan);

      // Calcular inicio y fin del mes actual
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // 1. Análisis consumidos (suma de analysis_usage del mes actual)
      const { data: analysisUsage, error: analysisError } = await supabaseServiceClient
        .from('analysis_usage')
        .select('count')
        .eq('user_id', userId)
        .gte('period_start', startOfMonth.toISOString())
        .lte('period_end', endOfMonth.toISOString());

      if (analysisError) {
        logger.warn('Error fetching analysis usage:', analysisError.message);
      }

      const analysisConsumed =
        analysisUsage?.reduce((sum, record) => sum + (record.count || 0), 0) || 0;

      // 2. Roasts consumidos (suma de roast_usage del mes actual)
      const { data: roastUsage, error: roastError } = await supabaseServiceClient
        .from('roast_usage')
        .select('count')
        .eq('user_id', userId)
        .gte('period_start', startOfMonth.toISOString())
        .lte('period_end', endOfMonth.toISOString());

      if (roastError) {
        logger.warn('Error fetching roast usage:', roastError.message);
      }

      const roastsConsumed =
        roastUsage?.reduce((sum, record) => sum + (record.count || 0), 0) || 0;

      // 3. Límites disponibles según plan
      const analysisAvailable = planLimits?.monthlyAnalysisLimit || 0;
      const roastsAvailable = planLimits?.monthlyResponsesLimit || 0;

      return {
        analysis: {
          consumed: analysisConsumed,
          available: analysisAvailable,
          remaining: Math.max(0, analysisAvailable - analysisConsumed)
        },
        roasts: {
          consumed: roastsConsumed,
          available: roastsAvailable,
          remaining: Math.max(0, roastsAvailable - roastsConsumed)
        },
        period: {
          start: startOfMonth.toISOString(),
          end: endOfMonth.toISOString()
        },
        plan
      };
    } catch (error) {
      logger.error('Error in getUsageWithPlan:', error.message);
      throw error;
    }
  }
}

module.exports = new UsageService();

