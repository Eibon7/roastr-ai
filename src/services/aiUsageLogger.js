/**
 * AI Usage Logger Service
 * 
 * Issue #858: Logging de tokens para prompt caching
 * 
 * Logs AI usage metrics including:
 * - Input/output tokens
 * - Cached tokens (when available)
 * - Model used
 * - User/org context
 * - Plan information
 * 
 * @module services/aiUsageLogger
 */

const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/database');
const { mockMode } = require('../config/mockMode');

/**
 * AIUsageLogger - Logs AI usage metrics for cost analysis
 * 
 * @class AIUsageLogger
 */
class AIUsageLogger {
  constructor() {
    this.enabled = !mockMode.isMockMode && process.env.LOG_AI_USAGE !== 'false';
  }

  /**
   * Log AI usage for a request
   * 
   * @param {Object} usageData - Usage data
   * @param {string} usageData.userId - User ID
   * @param {string} usageData.orgId - Organization ID (optional)
   * @param {string} usageData.model - Model used (e.g., 'gpt-5.1')
   * @param {number} usageData.inputTokens - Input tokens used
   * @param {number} usageData.outputTokens - Output tokens used
   * @param {number} usageData.cachedTokens - Cached tokens (optional, when available)
   * @param {string} usageData.plan - User plan (starter, pro, plus, etc.)
   * @param {string} usageData.endpoint - Endpoint/operation (e.g., 'roast', 'shield')
   * @returns {Promise<void>}
   */
  async logUsage(usageData) {
    if (!this.enabled) {
      return;
    }

    try {
      const {
        userId,
        orgId = null,
        model,
        inputTokens = 0,
        outputTokens = 0,
        cachedTokens = 0,
        plan = null,
        endpoint = null
      } = usageData;

      // Validate required fields
      if (!userId || !model) {
        logger.warn('AI usage logging skipped: missing required fields', {
          hasUserId: !!userId,
          hasModel: !!model
        });
        return;
      }

      // Calculate cache hit ratio
      const totalInputTokens = inputTokens + cachedTokens;
      const cacheHitRatio = totalInputTokens > 0 ? (cachedTokens / totalInputTokens) : 0;

      // Prepare log entry
      const logEntry = {
        user_id: userId,
        org_id: orgId,
        model: model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        input_cached_tokens: cachedTokens,
        cache_hit_ratio: cacheHitRatio,
        plan: plan,
        endpoint: endpoint,
        created_at: new Date().toISOString()
      };

      // Try to insert into database
      try {
        const { error } = await supabaseServiceClient
          .from('ai_usage_logs')
          .insert([logEntry]);

        if (error) {
          // Table might not exist yet, log to console instead
          logger.warn('Failed to insert AI usage log to database', {
            error: error.message,
            logEntry
          });
          
          // Fallback: log to console with structured format
          logger.info('AI Usage', logEntry);
        } else {
          logger.debug('AI usage logged successfully', {
            userId,
            model,
            cachedTokens,
            cacheHitRatio: `${(cacheHitRatio * 100).toFixed(1)}%`
          });
        }
      } catch (dbError) {
        // Database error, fallback to console logging
        logger.warn('Database error in AI usage logging, using console fallback', {
          error: dbError.message
        });
        logger.info('AI Usage', logEntry);
      }

    } catch (error) {
      // Don't throw - logging failures shouldn't break the main flow
      logger.error('Error in AI usage logging', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Get usage statistics for a user or organization
   * 
   * @param {Object} options - Query options
   * @param {string} options.userId - User ID (optional)
   * @param {string} options.orgId - Organization ID (optional)
   * @param {Date} options.startDate - Start date (optional)
   * @param {Date} options.endDate - End date (optional)
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageStats(options = {}) {
    if (!this.enabled) {
      return { enabled: false };
    }

    try {
      const { userId, orgId, startDate, endDate } = options;

      let query = supabaseServiceClient
        .from('ai_usage_logs')
        .select('*');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (orgId) {
        query = query.eq('org_id', orgId);
      }

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        logger.warn('Failed to get AI usage stats', { error: error.message });
        return { error: error.message };
      }

      // Calculate statistics
      const stats = {
        totalRequests: data.length,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCachedTokens: 0,
        averageCacheHitRatio: 0,
        byModel: {},
        byPlan: {},
        byEndpoint: {}
      };

      data.forEach(entry => {
        stats.totalInputTokens += entry.input_tokens || 0;
        stats.totalOutputTokens += entry.output_tokens || 0;
        stats.totalCachedTokens += entry.input_cached_tokens || 0;

        // By model
        const model = entry.model || 'unknown';
        if (!stats.byModel[model]) {
          stats.byModel[model] = { requests: 0, tokens: 0, cachedTokens: 0 };
        }
        stats.byModel[model].requests++;
        stats.byModel[model].tokens += (entry.input_tokens || 0) + (entry.output_tokens || 0);
        stats.byModel[model].cachedTokens += entry.input_cached_tokens || 0;

        // By plan
        const plan = entry.plan || 'unknown';
        if (!stats.byPlan[plan]) {
          stats.byPlan[plan] = { requests: 0, tokens: 0 };
        }
        stats.byPlan[plan].requests++;
        stats.byPlan[plan].tokens += (entry.input_tokens || 0) + (entry.output_tokens || 0);

        // By endpoint
        const endpoint = entry.endpoint || 'unknown';
        if (!stats.byEndpoint[endpoint]) {
          stats.byEndpoint[endpoint] = { requests: 0, tokens: 0 };
        }
        stats.byEndpoint[endpoint].requests++;
        stats.byEndpoint[endpoint].tokens += (entry.input_tokens || 0) + (entry.output_tokens || 0);
      });

      // Calculate average cache hit ratio
      const totalInputWithCache = stats.totalInputTokens + stats.totalCachedTokens;
      stats.averageCacheHitRatio = totalInputWithCache > 0
        ? stats.totalCachedTokens / totalInputWithCache
        : 0;

      return stats;

    } catch (error) {
      logger.error('Error getting AI usage stats', { error: error.message });
      return { error: error.message };
    }
  }
}

// Export singleton instance
const aiUsageLogger = new AIUsageLogger();
module.exports = aiUsageLogger;

