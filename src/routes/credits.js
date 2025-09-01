/**
 * Credits API Routes - Dual Credit System
 * 
 * Provides endpoints for credit status, consumption history,
 * and credit management for the dual credit system.
 * 
 * Routes:
 * - GET /api/user/credits/status - Get current credit status
 * - GET /api/user/credits/history - Get consumption history
 * - POST /api/user/credits/check - Check credit availability
 * 
 * @author Roastr.ai Team
 * @version 2.0.0
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const creditsService = require('../services/creditsService');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

/**
 * GET /api/user/credits/status
 * Get comprehensive credit status for authenticated user
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    logger.debug('Fetching credit status', { userId });
    
    const creditStatus = await creditsService.getCreditStatus(userId);
    
    res.json({
      success: true,
      data: creditStatus
    });

  } catch (error) {
    logger.error('Failed to get credit status', {
      userId: req.user?.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve credit status',
      code: 'CREDIT_STATUS_ERROR'
    });
  }
});

/**
 * GET /api/user/credits/history
 * Get credit consumption history with pagination and filtering
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      creditType,
      limit = 50,
      offset = 0,
      startDate,
      endDate
    } = req.query;

    // Validate parameters
    if (creditType && !['analysis', 'roast'].includes(creditType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credit type. Must be "analysis" or "roast"',
        code: 'INVALID_CREDIT_TYPE'
      });
    }

    if (limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit cannot exceed 100',
        code: 'LIMIT_TOO_HIGH'
      });
    }

    logger.debug('Fetching credit history', {
      userId,
      creditType,
      limit,
      offset
    });

    const history = await creditsService.getConsumptionHistory(userId, {
      creditType,
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: history.length === parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get credit history', {
      userId: req.user?.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve credit history',
      code: 'CREDIT_HISTORY_ERROR'
    });
  }
});

/**
 * POST /api/user/credits/check
 * Check credit availability for specific operations
 */
router.post('/check', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { creditType, amount = 1 } = req.body;

    // Validate input
    if (!creditType || !['analysis', 'roast'].includes(creditType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing credit type. Must be "analysis" or "roast"',
        code: 'INVALID_CREDIT_TYPE'
      });
    }

    if (!Number.isInteger(amount) || amount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive integer',
        code: 'INVALID_AMOUNT'
      });
    }

    logger.debug('Checking credit availability', {
      userId,
      creditType,
      amount
    });

    const availability = await creditsService.canConsume(userId, creditType, amount);

    res.json({
      success: true,
      data: availability
    });

  } catch (error) {
    logger.error('Failed to check credit availability', {
      userId: req.user?.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to check credit availability',
      code: 'CREDIT_CHECK_ERROR'
    });
  }
});

/**
 * GET /api/user/credits/summary
 * Get summarized credit usage statistics
 */
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'current' } = req.query;

    logger.debug('Fetching credit summary', { userId, period });

    // Get current period status
    const currentStatus = await creditsService.getCreditStatus(userId);
    
    // Calculate summary statistics
    const summary = {
      currentPeriod: currentStatus,
      statistics: {
        analysisUsagePercentage: currentStatus.analysis ? 
          Math.round((currentStatus.analysis.used / currentStatus.analysis.limit) * 100) : 0,
        roastUsagePercentage: currentStatus.roast ? 
          Math.round((currentStatus.roast.used / currentStatus.roast.limit) * 100) : 0,
        totalCreditsUsed: (currentStatus.analysis?.used || 0) + (currentStatus.roast?.used || 0),
        totalCreditsLimit: (currentStatus.analysis?.limit || 0) + (currentStatus.roast?.limit || 0),
        daysRemaining: currentStatus.period_end ? 
          Math.ceil((new Date(currentStatus.period_end) - new Date()) / (1000 * 60 * 60 * 24)) : 0
      },
      recommendations: []
    };

    // Add recommendations based on usage
    if (summary.statistics.analysisUsagePercentage >= 80) {
      summary.recommendations.push({
        type: 'warning',
        message: 'Analysis credits running low. Consider upgrading your plan.',
        action: 'upgrade'
      });
    }

    if (summary.statistics.roastUsagePercentage >= 80) {
      summary.recommendations.push({
        type: 'warning',
        message: 'Roast credits running low. Consider upgrading your plan.',
        action: 'upgrade'
      });
    }

    if (summary.statistics.daysRemaining <= 3) {
      summary.recommendations.push({
        type: 'info',
        message: 'Your billing period ends soon. Credits will reset automatically.',
        action: 'info'
      });
    }

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error('Failed to get credit summary', {
      userId: req.user?.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve credit summary',
      code: 'CREDIT_SUMMARY_ERROR'
    });
  }
});

/**
 * GET /api/credits/config
 * Get credit system configuration (public endpoint)
 */
router.get('/config', async (req, res) => {
  try {
    const config = {
      creditsV2Enabled: flags.isEnabled('ENABLE_CREDITS_V2'),
      creditTypes: [
        {
          type: 'analysis',
          name: 'Analysis Credits',
          description: 'Used for gatekeeper checks, toxicity analysis, and shield protection',
          icon: 'brain'
        },
        {
          type: 'roast',
          name: 'Roast Credits',
          description: 'Used for generating and posting roast responses',
          icon: 'zap'
        }
      ],
      planLimits: {
        free: { analysis: 100, roast: 10 },
        starter: { analysis: 1000, roast: 10 },
        pro: { analysis: 10000, roast: 1000 },
        plus: { analysis: 100000, roast: 5000 }
      }
    };

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    logger.error('Failed to get credit config', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve credit configuration',
      code: 'CREDIT_CONFIG_ERROR'
    });
  }
});

module.exports = router;
