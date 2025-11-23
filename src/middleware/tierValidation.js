/**
 * Tier Validation Middleware - SPEC 10
 * Runtime validation middleware for enforcing tier limits on API endpoints
 */

const tierValidationService = require('../services/tierValidationService');
const { logger } = require('../utils/logger');

/**
 * Middleware to validate action limits before processing
 * @param {string} action - Action type (analysis, roast, platform_add)
 * @param {Object} options - Additional validation options
 */
function validateTierLimit(action, options = {}) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Perform tier validation
      const validation = await tierValidationService.validateAction(userId, action, {
        ...options,
        ...req.body,
        ...req.query
      });

      if (!validation.allowed) {
        return res.status(403).json({
          success: false,
          error: validation.message || 'Action not allowed by current tier',
          code: validation.reason || 'TIER_LIMIT_EXCEEDED',
          details: {
            currentTier: validation.currentTier,
            currentUsage: validation.currentUsage,
            upgradeRequired: validation.upgradeRequired,
            action: action
          }
        });
      }

      // Add validation results to request for use in handlers
      req.tierValidation = validation;
      next();
    } catch (error) {
      logger.error('Tier validation middleware error:', error);

      const failOpen =
        process.env.NODE_ENV !== 'production' && process.env.TIER_VALIDATION_FAIL_OPEN === 'true';
      if (failOpen) {
        req.tierValidation = { allowed: true, fallback: true, error: error.message };
        return next();
      }
      return res.status(503).json({
        success: false,
        error: 'Tier validation temporarily unavailable',
        code: 'TIER_VALIDATION_ERROR'
      });
    }
  };
}

/**
 * Middleware to validate feature access
 * @param {string} feature - Feature name (shield, ENABLE_ORIGINAL_TONE, embedded_judge)
 */
function validateFeatureAccess(feature) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const featureValidation = await tierValidationService.validateFeature(userId, feature);

      if (!featureValidation.available) {
        return res.status(403).json({
          success: false,
          error: featureValidation.message || `Feature '${feature}' not available in current tier`,
          code: featureValidation.reason || 'FEATURE_NOT_AVAILABLE',
          details: {
            feature: feature,
            upgradeRequired: featureValidation.upgradeRequired
          }
        });
      }

      // Add feature validation to request
      req.featureValidation = featureValidation;
      next();
    } catch (error) {
      logger.error('Feature validation middleware error:', error);

      // For security, deny access on error for features
      return res.status(500).json({
        success: false,
        error: 'Feature validation temporarily unavailable',
        code: 'FEATURE_VALIDATION_ERROR'
      });
    }
  };
}

/**
 * Middleware factory for specific tier validations
 */
const tierMiddleware = {
  /**
   * Validate analysis limits (100 free, 1,000 starter, 10,000 pro, 100,000 plus)
   */
  validateAnalysisLimit: () => validateTierLimit('analysis'),

  /**
   * Validate roast limits (10 free, 100 starter, 1,000 pro, 5,000 plus)
   */
  validateRoastLimit: () => validateTierLimit('roast'),

  /**
   * Validate platform addition (1 account per network for free/starter, 2 for pro/plus)
   */
  validatePlatformLimit: (platform) => validateTierLimit('platform_add', { platform }),

  /**
   * Validate Shield feature access (Starter+)
   */
  requireShield: () => validateFeatureAccess('shield'),

  /**
   * Validate Original Tone feature access (Pro+)
   */
  requireOriginalTone: () => validateFeatureAccess('ENABLE_ORIGINAL_TONE'),

  /**
   * Validate Embedded Judge feature access (Plus only)
   */
  requireEmbeddedJudge: () => validateFeatureAccess('embedded_judge'),

  /**
   * Combined validation for multiple actions
   */
  validateMultiple: (actions) => {
    return async (req, res, next) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
          });
        }

        const validations = {};
        let allAllowed = true;
        let firstError = null;

        // Validate each action
        for (const action of actions) {
          const validation = await tierValidationService.validateAction(userId, action, req.body);
          validations[action] = validation;

          if (!validation.allowed && !firstError) {
            allAllowed = false;
            firstError = validation;
          }
        }

        if (!allAllowed) {
          return res.status(403).json({
            success: false,
            error: firstError.message || 'One or more actions not allowed by current tier',
            code: firstError.reason || 'TIER_LIMIT_EXCEEDED',
            details: {
              validations: validations,
              currentTier: firstError.currentTier
            }
          });
        }

        req.tierValidations = validations;
        next();
      } catch (error) {
        logger.error('Multiple tier validation error:', error);

        const failOpen =
          process.env.NODE_ENV !== 'production' && process.env.TIER_VALIDATION_FAIL_OPEN === 'true';
        if (failOpen) {
          return next();
        }
        return res.status(503).json({
          success: false,
          error: 'Tier validation temporarily unavailable',
          code: 'TIER_VALIDATION_ERROR'
        });
      }
    };
  }
};

/**
 * Middleware to record successful usage after action completion
 * @param {string} action - Action type that was performed
 */
function recordUsage(action) {
  return async (req, res, next) => {
    // Store original res.json to intercept successful responses
    const originalJson = res.json;

    res.json = function (body) {
      // Only record usage if response was successful
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.success !== false) {
        const userId = req.user?.id;
        if (userId) {
          // Record usage asynchronously to not block response
          setImmediate(async () => {
            try {
              await recordActionUsage(userId, action, req);
            } catch (error) {
              logger.error('Error recording usage:', error);
            }
          });
        }
      }

      // Call original json method
      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Record usage for an action
 * @private
 */
async function recordActionUsage(userId, action, req) {
  const { supabaseServiceClient } = require('../config/supabase');

  try {
    switch (action) {
      case 'analysis':
        // Record in analysis_usage table
        await supabaseServiceClient.rpc('record_analysis_usage', {
          p_user_id: userId,
          p_quantity: req.body?.quantity || 1,
          p_analysis_type: req.body?.analysisType || 'toxicity_analysis',
          p_platform: req.body?.platform || null
        });
        break;

      case 'roast':
        // Record in user_activities (already handled by existing system)
        await supabaseServiceClient.from('user_activities').insert({
          user_id: userId,
          activity_type: 'roast_generated',
          details: {
            platform: req.body?.platform,
            tier_validated: true
          }
        });
        break;

      case 'platform_add':
        // Platform integration recorded separately in user_integrations
        logger.debug('Platform integration recorded separately');
        break;

      default:
        logger.warn('Unknown action type for usage recording:', action);
    }

    logger.debug('Usage recorded successfully:', { userId, action });
  } catch (error) {
    logger.error('Failed to record usage:', error);
    // Don't throw - this shouldn't block the user action
  }
}

/**
 * Middleware to add usage information to response
 */
function includeUsageInfo() {
  return async (req, res, next) => {
    // Store original res.json to add usage info
    const originalJson = res.json;

    res.json = function (body) {
      // Add usage info if tier validation was performed
      if (req.tierValidation && body && typeof body === 'object') {
        body.usage = req.tierValidation.currentUsage;
        body.tier = req.tierValidation.currentTier;
      }

      return originalJson.call(this, body);
    };

    next();
  };
}

module.exports = {
  validateTierLimit,
  validateFeatureAccess,
  recordUsage,
  includeUsageInfo,
  tierMiddleware
};
