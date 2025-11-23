/**
 * Usage Enforcement Middleware - Issue #168
 *
 * Middleware for tracking and enforcing usage limits based on entitlements
 * - Checks usage limits before allowing actions
 * - Increments usage counters after successful actions
 * - Returns semantic errors for UI handling
 * - Supports analysis and roast endpoints
 */

const EntitlementsService = require('../services/entitlementsService');
const { logger } = require('../utils/logger');

class UsageEnforcementMiddleware {
  constructor() {
    this.entitlementsService = new EntitlementsService();
  }

  /**
   * Check usage limit before allowing action
   * @param {string} actionType - 'analysis' or 'roasts'
   * @returns {Function} Express middleware
   */
  checkLimit(actionType) {
    return async (req, res, next) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          });
        }

        // Check if user can perform this action
        const limitCheck = await this.entitlementsService.checkUsageLimit(userId, actionType);

        if (limitCheck.error) {
          logger.error('Usage limit check failed', {
            userId,
            actionType,
            error: limitCheck.error
          });

          return res.status(500).json({
            success: false,
            error: 'Usage validation failed',
            code: 'USAGE_CHECK_FAILED'
          });
        }

        if (!limitCheck.allowed) {
          logger.warn('Usage limit exceeded', {
            userId,
            actionType,
            used: limitCheck.used,
            limit: limitCheck.limit
          });

          return res.status(429).json({
            success: false,
            error: `Monthly ${actionType} limit reached`,
            code: 'LIMIT_REACHED',
            details: {
              action_type: actionType,
              used: limitCheck.used,
              limit: limitCheck.limit,
              period_end: limitCheck.period_end,
              unlimited: limitCheck.unlimited
            }
          });
        }

        // Store limit info in request for potential use by route handlers
        req.usageLimitInfo = limitCheck;
        next();
      } catch (error) {
        logger.error('Usage enforcement middleware error', {
          userId: req.user?.id,
          actionType,
          error: error.message,
          stack: error.stack
        });

        return res.status(500).json({
          success: false,
          error: 'Usage validation failed',
          code: 'USAGE_CHECK_FAILED'
        });
      }
    };
  }

  /**
   * Increment usage after successful action
   * @param {string} actionType - 'analysis' or 'roasts'
   * @param {number} incrementBy - Amount to increment (default: 1)
   * @returns {Function} Express middleware
   */
  incrementUsage(actionType, incrementBy = 1) {
    return async (req, res, next) => {
      // Store original res.json to intercept successful responses
      const originalJson = res.json;

      res.json = async function (data) {
        try {
          const userId = req.user?.id;

          if (userId && data && data.success !== false) {
            // Only increment on successful responses
            const result = await req.app.locals.entitlementsService.incrementUsage(
              userId,
              actionType,
              incrementBy
            );

            if (result.success) {
              logger.info('Usage incremented', {
                userId,
                actionType,
                incrementBy: result.incremented_by
              });
            } else {
              logger.error('Failed to increment usage', {
                userId,
                actionType,
                incrementBy,
                error: result.error
              });
            }
          }
        } catch (error) {
          logger.error('Usage increment error', {
            userId: req.user?.id,
            actionType,
            incrementBy,
            error: error.message
          });
          // Don't fail the response if usage increment fails
        }

        // Call original res.json with the data
        originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Combined middleware: check limit + increment usage
   * @param {string} actionType - 'analysis' or 'roasts'
   * @param {number} incrementBy - Amount to increment (default: 1)
   * @returns {Array<Function>} Array of Express middlewares
   */
  enforceUsage(actionType, incrementBy = 1) {
    return [this.checkLimit(actionType), this.incrementUsage(actionType, incrementBy)];
  }

  /**
   * Middleware to add usage summary to response
   * Useful for dashboard/settings endpoints
   * @returns {Function} Express middleware
   */
  attachUsageSummary() {
    return async (req, res, next) => {
      try {
        const userId = req.user?.id;

        if (userId) {
          const usageSummary = await this.entitlementsService.getUsageSummary(userId);
          req.usageSummary = usageSummary;
        }

        next();
      } catch (error) {
        logger.error('Failed to attach usage summary', {
          userId: req.user?.id,
          error: error.message
        });

        // Don't fail request if usage summary fails
        next();
      }
    };
  }

  /**
   * Middleware to check if feature is enabled in entitlements
   * @param {string} featureName - Feature to check (shield_enabled, rqc_mode, etc.)
   * @param {*} requiredValue - Required value (true, 'advanced', etc.)
   * @returns {Function} Express middleware
   */
  requireFeature(featureName, requiredValue = true) {
    return async (req, res, next) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          });
        }

        const entitlements = await this.entitlementsService.getEntitlements(userId);
        const featureValue = entitlements[featureName];

        let hasFeature = false;

        if (typeof requiredValue === 'boolean') {
          hasFeature = featureValue === requiredValue;
        } else if (Array.isArray(requiredValue)) {
          hasFeature = requiredValue.includes(featureValue);
        } else {
          hasFeature = featureValue === requiredValue;
        }

        if (!hasFeature) {
          logger.warn('Feature access denied', {
            userId,
            featureName,
            requiredValue,
            actualValue: featureValue,
            planName: entitlements.plan_name
          });

          return res.status(403).json({
            success: false,
            error: `Feature '${featureName}' not available in your plan`,
            code: 'FEATURE_NOT_AVAILABLE',
            details: {
              feature: featureName,
              current_plan: entitlements.plan_name,
              required_value: requiredValue,
              actual_value: featureValue
            }
          });
        }

        req.entitlements = entitlements;
        next();
      } catch (error) {
        logger.error('Feature check middleware error', {
          userId: req.user?.id,
          featureName,
          requiredValue,
          error: error.message
        });

        return res.status(500).json({
          success: false,
          error: 'Feature validation failed',
          code: 'FEATURE_CHECK_FAILED'
        });
      }
    };
  }

  /**
   * Express middleware factory for analysis endpoints
   * @param {number} incrementBy - Amount to increment (default: 1)
   * @returns {Array<Function>} Array of middlewares
   */
  static forAnalysis(incrementBy = 1) {
    const instance = new UsageEnforcementMiddleware();
    return instance.enforceUsage('analysis', incrementBy);
  }

  /**
   * Express middleware factory for roast endpoints
   * @param {number} incrementBy - Amount to increment (default: 1)
   * @returns {Array<Function>} Array of middlewares
   */
  static forRoasts(incrementBy = 1) {
    const instance = new UsageEnforcementMiddleware();
    return instance.enforceUsage('roasts', incrementBy);
  }

  /**
   * Express middleware factory for Shield feature
   * @returns {Function} Express middleware
   */
  static requireShield() {
    const instance = new UsageEnforcementMiddleware();
    return instance.requireFeature('shield_enabled', true);
  }

  /**
   * Express middleware factory for advanced RQC
   * @returns {Function} Express middleware
   */
  static requireAdvancedRQC() {
    const instance = new UsageEnforcementMiddleware();
    return instance.requireFeature('rqc_mode', ['advanced', 'premium']);
  }

  /**
   * Express middleware factory for premium RQC
   * @returns {Function} Express middleware
   */
  static requirePremiumRQC() {
    const instance = new UsageEnforcementMiddleware();
    return instance.requireFeature('rqc_mode', 'premium');
  }
}

/**
 * Initialize entitlements service in app locals for use by middleware
 * @param {Object} app - Express app instance
 */
function initializeUsageEnforcement(app) {
  app.locals.entitlementsService = new EntitlementsService();
  logger.info('Usage enforcement initialized');
}

module.exports = {
  UsageEnforcementMiddleware,
  initializeUsageEnforcement
};
