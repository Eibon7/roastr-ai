/**
 * Model Availability Service
 * Checks for GPT-5 availability and manages model fallbacks (Issue #326)
 *
 * Features:
 * - Daily checks for GPT-5 availability
 * - Smart fallback system: GPT-5 → GPT-4o → GPT-3.5-turbo
 * - Database caching to minimize API calls
 * - Configurable check intervals
 */

const OpenAI = require('openai');
const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');
const { flags } = require('../config/flags');

class ModelAvailabilityService {
  constructor() {
    this.openai = null;
    this.lastCheck = null;
    this.checkInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.cache = new Map();

    // Initialize OpenAI client if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        maxRetries: 2, // Standard resilience config (CodeRabbit #3343936799)
        timeout: 30000 // 30 second timeout
      });
    }

    // Plan-specific model preferences (Issue #326)
    this.modelPreferences = {
      starter_trial: ['gpt-3.5-turbo'], // Trial plan stays on GPT-3.5
      starter: ['gpt-5', 'gpt-4o', 'gpt-3.5-turbo'],
      pro: ['gpt-5', 'gpt-4o', 'gpt-3.5-turbo'],
      plus: ['gpt-5', 'gpt-4o', 'gpt-3.5-turbo'],
      custom: ['gpt-5', 'gpt-4o', 'gpt-3.5-turbo']
    };
  }

  /**
   * Get the best available model for a plan
   * @param {string} planId - User's plan ID
   * @returns {Promise<string>} - Best available model
   */
  async getModelForPlan(planId) {
    try {
      // Check if we need to update model availability
      await this.checkModelAvailabilityIfNeeded();

      const preferences = this.modelPreferences[planId] || this.modelPreferences['pro'];

      // Find the first available model from preferences
      for (const model of preferences) {
        if (await this.isModelAvailable(model)) {
          logger.info('Model selected for plan', {
            plan: planId,
            selectedModel: model,
            preferences: preferences
          });
          return model;
        }
      }

      // Ultimate fallback
      logger.warn('All preferred models unavailable, using fallback', {
        plan: planId,
        fallback: 'gpt-3.5-turbo'
      });
      return 'gpt-3.5-turbo';
    } catch (error) {
      logger.error('Error getting model for plan', {
        plan: planId,
        error: error.message
      });
      // Safe fallback
      return planId === 'starter_trial' ? 'gpt-3.5-turbo' : 'gpt-4o';
    }
  }

  /**
   * Check if we need to update model availability (daily check)
   */
  async checkModelAvailabilityIfNeeded() {
    const now = Date.now();

    // Check if we need to refresh (daily or first run)
    if (!this.lastCheck || now - this.lastCheck > this.checkInterval) {
      await this.updateModelAvailability();
      this.lastCheck = now;
    }
  }

  /**
   * Update model availability by checking OpenAI API
   */
  async updateModelAvailability() {
    if (!this.openai) {
      logger.warn('OpenAI client not initialized, using default model availability');
      await this.setDefaultAvailability();
      return;
    }

    try {
      logger.info('🔍 Checking OpenAI model availability...');

      // Get list of available models with timeout protection
      const controller = new AbortController();
      const timeoutMs = 10000; // 10 seconds timeout
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response;
      try {
        // Pass AbortController signal via RequestOptions (2nd arg)
        response = await this.openai.models.list({}, { signal: controller.signal });
      } catch (error) {
        if (error.name === 'AbortError' || /aborted/i.test(error.message || '')) {
          throw new Error(`OpenAI models.list() timed out after ${timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }

      const availableModels = response.data.map((model) => model.id);

      // Check specific models we're interested in
      const modelsToCheck = ['gpt-5', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'];
      const availability = {};

      for (const model of modelsToCheck) {
        const isAvailable = availableModels.includes(model);
        availability[model] = isAvailable;

        if (model === 'gpt-5' && isAvailable) {
          logger.info('🎉 GPT-5 is now available! Updating model preferences...');
        }
      }

      // Cache the results
      await this.saveAvailabilityToDatabase(availability);
      this.updateMemoryCache(availability);

      logger.info('✅ Model availability updated', {
        availability: availability,
        gpt5Available: availability['gpt-5'] || false
      });
    } catch (error) {
      logger.error('Failed to check model availability', {
        error: error.message,
        stack: error.stack
      });

      // Load from database cache as fallback
      await this.loadAvailabilityFromDatabase();
    }
  }

  /**
   * Check if a specific model is available
   * @param {string} modelId - Model identifier
   * @returns {Promise<boolean>} - Whether model is available
   */
  async isModelAvailable(modelId) {
    // Check memory cache first
    if (this.cache.has(modelId)) {
      return this.cache.get(modelId);
    }

    // Check database cache
    try {
      const { data, error } = await supabaseServiceClient
        .from('model_availability')
        .select('is_available')
        .eq('model_id', modelId)
        .single();

      if (error || !data) {
        // Default availability for known models
        const defaults = {
          'gpt-3.5-turbo': true,
          'gpt-4o': true,
          'gpt-4o-mini': true,
          'gpt-5': false // Default to false until confirmed available
        };
        return defaults[modelId] || false;
      }

      // Update cache
      this.cache.set(modelId, data.is_available);
      return data.is_available;
    } catch (error) {
      logger.error('Error checking model availability', {
        model: modelId,
        error: error.message
      });
      return modelId !== 'gpt-5'; // Conservative fallback (assume everything except GPT-5 is available)
    }
  }

  /**
   * Save availability data to database
   */
  async saveAvailabilityToDatabase(availability) {
    try {
      for (const [modelId, isAvailable] of Object.entries(availability)) {
        await supabaseServiceClient.from('model_availability').upsert({
          model_id: modelId,
          is_available: isAvailable,
          last_checked_at: new Date().toISOString(),
          api_version: 'v1'
        });
      }

      logger.info('Model availability saved to database');
    } catch (error) {
      logger.error('Failed to save model availability', {
        error: error.message
      });
    }
  }

  /**
   * Load availability from database cache
   */
  async loadAvailabilityFromDatabase() {
    try {
      const { data, error } = await supabaseServiceClient
        .from('model_availability')
        .select('model_id, is_available')
        .order('last_checked_at', { ascending: false });

      if (error || !data) {
        await this.setDefaultAvailability();
        return;
      }

      // Update memory cache
      data.forEach((row) => {
        this.cache.set(row.model_id, row.is_available);
      });

      logger.info('Model availability loaded from database', {
        modelsLoaded: data.length
      });
    } catch (error) {
      logger.error('Failed to load model availability from database', {
        error: error.message
      });
      await this.setDefaultAvailability();
    }
  }

  /**
   * Set default availability when API is not accessible
   */
  async setDefaultAvailability() {
    const defaults = {
      'gpt-3.5-turbo': true,
      'gpt-4o': true,
      'gpt-4o-mini': true,
      'gpt-5': false
    };

    this.updateMemoryCache(defaults);
    logger.info('Using default model availability', { defaults });
  }

  /**
   * Update memory cache
   */
  updateMemoryCache(availability) {
    for (const [modelId, isAvailable] of Object.entries(availability)) {
      this.cache.set(modelId, isAvailable);
    }
  }

  /**
   * Force refresh model availability (for admin use)
   */
  async forceRefresh() {
    logger.info('🔄 Forcing model availability refresh...');
    this.lastCheck = null;
    await this.updateModelAvailability();
    return this.getAvailabilityStatus();
  }

  /**
   * Get current availability status
   */
  getAvailabilityStatus() {
    const status = {};
    for (const [model, available] of this.cache.entries()) {
      status[model] = available;
    }

    return {
      models: status,
      lastCheck: this.lastCheck,
      nextCheck: this.lastCheck ? new Date(this.lastCheck + this.checkInterval) : null,
      gpt5Available: status['gpt-5'] || false
    };
  }

  /**
   * Get model statistics for monitoring
   */
  async getModelStats() {
    try {
      const { data, error } = await supabaseServiceClient
        .from('roast_usage')
        .select('metadata')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error || !data) return {};

      const stats = {};
      data.forEach((row) => {
        const model = row.metadata?.model || 'unknown';
        stats[model] = (stats[model] || 0) + 1;
      });

      return {
        usage_last_7_days: stats,
        total_requests: Object.values(stats).reduce((a, b) => a + b, 0),
        gpt5_usage: stats['gpt-5'] || 0,
        availability: this.getAvailabilityStatus()
      };
    } catch (error) {
      logger.error('Failed to get model stats', { error: error.message });
      return {};
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get the model availability service instance
 */
function getModelAvailabilityService() {
  if (!instance) {
    instance = new ModelAvailabilityService();
  }
  return instance;
}

module.exports = {
  ModelAvailabilityService,
  getModelAvailabilityService
};
