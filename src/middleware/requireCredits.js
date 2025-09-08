/**
 * Credits Middleware - Dual Credit System Guards
 * 
 * Provides middleware functions to verify and consume credits
 * before allowing access to protected endpoints.
 * 
 * Features:
 * - Pre-flight credit verification
 * - Atomic credit consumption
 * - Graceful degradation when credits system is disabled
 * - Comprehensive error handling and logging
 * 
 * @author Roastr.ai Team
 * @version 2.0.0
 */

const creditsService = require('../services/creditsService');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

/**
 * Middleware to require analysis credits
 * Used for: gatekeeper checks, toxicity analysis, shield protection, etc.
 * 
 * @param {Object} options - Middleware options
 * @param {number} options.amount - Number of credits to consume (default: 1)
 * @param {string} options.actionType - Type of action consuming credits
 * @param {boolean} options.preCheck - Only check availability, don't consume (default: false)
 * @returns {Function} Express middleware
 */
function requireAnalysisCredits(options = {}) {
  const {
    amount = 1,
    actionType = 'analysis',
    preCheck = false
  } = options;

  return async (req, res, next) => {
    // Skip if credits system is disabled
    if (!flags.isEnabled('ENABLE_CREDITS_V2')) {
      logger.debug('Credits v2 disabled, skipping analysis credit check', {
        userId: req.user?.id,
        actionType
      });
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    try {
      // Check credit availability
      const availability = await creditsService.canConsume(userId, 'analysis', amount);
      
      if (!availability.canConsume) {
        logger.warn('Analysis credits insufficient', {
          userId,
          actionType,
          amount,
          remaining: availability.remaining,
          limit: availability.limit
        });

        return res.status(402).json({
          success: false,
          error: 'Insufficient analysis credits',
          code: 'INSUFFICIENT_ANALYSIS_CREDITS',
          data: {
            creditType: 'analysis',
            required: amount,
            remaining: availability.remaining,
            limit: availability.limit,
            periodEnd: availability.periodEnd
          }
        });
      }

      // If pre-check only, don't consume credits yet
      if (preCheck) {
        req.creditsPreChecked = {
          analysis: { amount, available: true }
        };
        return next();
      }

      // Consume credits atomically
      const consumed = await creditsService.consume(userId, 'analysis', {
        amount,
        actionType,
        platform: req.body?.platform || req.query?.platform,
        metadata: {
          endpoint: req.route?.path || req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      });

      if (!consumed) {
        logger.warn('Failed to consume analysis credits', {
          userId,
          actionType,
          amount
        });

        return res.status(402).json({
          success: false,
          error: 'Failed to consume analysis credits',
          code: 'CREDIT_CONSUMPTION_FAILED',
          data: {
            creditType: 'analysis',
            amount
          }
        });
      }

      // Add credit info to request for downstream use
      req.creditsConsumed = {
        analysis: amount
      };

      logger.debug('Analysis credits consumed successfully', {
        userId,
        actionType,
        amount
      });

      next();

    } catch (error) {
      logger.error('Analysis credits middleware error', {
        userId,
        actionType,
        amount,
        error: error.message
      });

      // Fail open to prevent blocking critical functionality
      logger.warn('Allowing request due to credits middleware error');
      next();
    }
  };
}

/**
 * Middleware to require roast credits
 * Used for: roast generation, response posting, etc.
 * 
 * @param {Object} options - Middleware options
 * @param {number} options.amount - Number of credits to consume (default: 1)
 * @param {string} options.actionType - Type of action consuming credits
 * @param {boolean} options.preCheck - Only check availability, don't consume (default: false)
 * @returns {Function} Express middleware
 */
function requireRoastCredits(options = {}) {
  const {
    amount = 1,
    actionType = 'roast_generation',
    preCheck = false
  } = options;

  return async (req, res, next) => {
    // Skip if credits system is disabled
    if (!flags.isEnabled('ENABLE_CREDITS_V2')) {
      logger.debug('Credits v2 disabled, skipping roast credit check', {
        userId: req.user?.id,
        actionType
      });
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    try {
      // Check credit availability
      const availability = await creditsService.canConsume(userId, 'roast', amount);
      
      if (!availability.canConsume) {
        logger.warn('Roast credits insufficient', {
          userId,
          actionType,
          amount,
          remaining: availability.remaining,
          limit: availability.limit
        });

        return res.status(402).json({
          success: false,
          error: 'Insufficient roast credits',
          code: 'INSUFFICIENT_ROAST_CREDITS',
          data: {
            creditType: 'roast',
            required: amount,
            remaining: availability.remaining,
            limit: availability.limit,
            periodEnd: availability.periodEnd
          }
        });
      }

      // If pre-check only, don't consume credits yet
      if (preCheck) {
        req.creditsPreChecked = {
          ...req.creditsPreChecked,
          roast: { amount, available: true }
        };
        return next();
      }

      // Consume credits atomically
      const consumed = await creditsService.consume(userId, 'roast', {
        amount,
        actionType,
        platform: req.body?.platform || req.query?.platform,
        metadata: {
          endpoint: req.route?.path || req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      });

      if (!consumed) {
        logger.warn('Failed to consume roast credits', {
          userId,
          actionType,
          amount
        });

        return res.status(402).json({
          success: false,
          error: 'Failed to consume roast credits',
          code: 'CREDIT_CONSUMPTION_FAILED',
          data: {
            creditType: 'roast',
            amount
          }
        });
      }

      // Add credit info to request for downstream use
      req.creditsConsumed = {
        ...req.creditsConsumed,
        roast: amount
      };

      logger.debug('Roast credits consumed successfully', {
        userId,
        actionType,
        amount
      });

      next();

    } catch (error) {
      logger.error('Roast credits middleware error', {
        userId,
        actionType,
        amount,
        error: error.message
      });

      // Fail open to prevent blocking critical functionality
      logger.warn('Allowing request due to credits middleware error');
      next();
    }
  };
}

/**
 * Middleware to require both analysis and roast credits
 * Used for: full roast workflow (analyze + generate)
 * 
 * @param {Object} options - Middleware options
 * @param {number} options.analysisAmount - Analysis credits to consume (default: 1)
 * @param {number} options.roastAmount - Roast credits to consume (default: 1)
 * @param {string} options.actionType - Type of action consuming credits
 * @param {boolean} options.preCheck - Only check availability, don't consume (default: false)
 * @returns {Function} Express middleware
 */
function requireBothCredits(options = {}) {
  const {
    analysisAmount = 1,
    roastAmount = 1,
    actionType = 'full_roast_workflow',
    preCheck = false
  } = options;

  return async (req, res, next) => {
    // Skip if credits system is disabled
    if (!flags.isEnabled('ENABLE_CREDITS_V2')) {
      logger.debug('Credits v2 disabled, skipping dual credit check', {
        userId: req.user?.id,
        actionType
      });
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    try {
      // Check both credit types
      const [analysisAvailability, roastAvailability] = await Promise.all([
        creditsService.canConsume(userId, 'analysis', analysisAmount),
        creditsService.canConsume(userId, 'roast', roastAmount)
      ]);

      // Check analysis credits
      if (!analysisAvailability.canConsume) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient analysis credits',
          code: 'INSUFFICIENT_ANALYSIS_CREDITS',
          data: {
            creditType: 'analysis',
            required: analysisAmount,
            remaining: analysisAvailability.remaining,
            limit: analysisAvailability.limit,
            periodEnd: analysisAvailability.periodEnd
          }
        });
      }

      // Check roast credits
      if (!roastAvailability.canConsume) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient roast credits',
          code: 'INSUFFICIENT_ROAST_CREDITS',
          data: {
            creditType: 'roast',
            required: roastAmount,
            remaining: roastAvailability.remaining,
            limit: roastAvailability.limit,
            periodEnd: roastAvailability.periodEnd
          }
        });
      }

      // If pre-check only, don't consume credits yet
      if (preCheck) {
        req.creditsPreChecked = {
          analysis: { amount: analysisAmount, available: true },
          roast: { amount: roastAmount, available: true }
        };
        return next();
      }

      // Consume both credit types
      const [analysisConsumed, roastConsumed] = await Promise.all([
        creditsService.consume(userId, 'analysis', {
          amount: analysisAmount,
          actionType: `${actionType}_analysis`,
          platform: req.body?.platform || req.query?.platform,
          metadata: { endpoint: req.route?.path || req.path }
        }),
        creditsService.consume(userId, 'roast', {
          amount: roastAmount,
          actionType: `${actionType}_roast`,
          platform: req.body?.platform || req.query?.platform,
          metadata: { endpoint: req.route?.path || req.path }
        })
      ]);

      if (!analysisConsumed || !roastConsumed) {
        logger.error('Failed to consume dual credits', {
          userId,
          actionType,
          analysisConsumed,
          roastConsumed
        });

        return res.status(402).json({
          success: false,
          error: 'Failed to consume required credits',
          code: 'CREDIT_CONSUMPTION_FAILED',
          data: {
            analysisConsumed,
            roastConsumed
          }
        });
      }

      // Add credit info to request
      req.creditsConsumed = {
        analysis: analysisAmount,
        roast: roastAmount
      };

      logger.debug('Dual credits consumed successfully', {
        userId,
        actionType,
        analysisAmount,
        roastAmount
      });

      next();

    } catch (error) {
      logger.error('Dual credits middleware error', {
        userId,
        actionType,
        error: error.message
      });

      // Fail open to prevent blocking critical functionality
      logger.warn('Allowing request due to credits middleware error');
      next();
    }
  };
}

module.exports = {
  requireAnalysisCredits,
  requireRoastCredits,
  requireBothCredits
};
