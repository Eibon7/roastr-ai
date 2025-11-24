const express = require('express');
const { logger } = require('./../utils/logger'); // Issue #971: Added for console.log replacement
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { flags } = require('../config/flags');

// Issue #841: Use planService.js as single source of truth
const { getPlanFeatures, getAllPlans } = require('../services/planService');

// Get plans dynamically from planService.js
// Issue #841: Filter out 'custom' plan - it's ad-hoc and not available for users to contract
function getAvailablePlans() {
  const allPlans = getAllPlans();
  const plans = {};

  for (const [planId, plan] of Object.entries(allPlans)) {
    // Skip 'custom' plan - it's ad-hoc, pay-per-use, and not available for standard subscription
    if (planId === 'custom') {
      continue;
    }

    plans[planId] = {
      id: planId,
      name: plan.name,
      price: plan.price / 100, // Convert from cents to currency units
      features: {
        roastsPerMonth: plan.limits.roastsPerMonth,
        platformConnections: plan.limits.platformIntegrations,
        styleProfile: plan.features.customTones || false,
        prioritySupport: plan.features.prioritySupport || false,
        customPrompts: plan.features.customPrompts || false,
        advancedAnalytics: plan.features.advancedAnalytics || false
      }
    };
  }

  return plans;
}

const AVAILABLE_PLANS = getAvailablePlans();

// Mock user plans storage (in production, this would be in database)
const userPlans = new Map();

/**
 * GET /api/plan/available
 * Get all available plans
 */
router.get('/available', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        plans: Object.values(AVAILABLE_PLANS)
      }
    });
  } catch (error) {
    logger.error('❌ Error getting available plans:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not get available plans'
    });
  }
});

/**
 * GET /api/plan/current
 * Get current user plan
 */
router.get('/current', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const userPlan = userPlans.get(userId) || 'starter_trial';
    const plan = AVAILABLE_PLANS[userPlan];

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    res.json({
      success: true,
      data: {
        plan: userPlan,
        details: plan,
        canAccessStyleProfile: plan.features.styleProfile
      }
    });
  } catch (error) {
    logger.error('❌ Error getting current plan:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not get current plan'
    });
  }
});

/**
 * POST /api/plan/select
 * Select a plan for the authenticated user
 */
router.post('/select', authenticateToken, (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user.id;

    if (!plan || typeof plan !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Plan is required and must be a string'
      });
    }

    if (!AVAILABLE_PLANS[plan]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan selected',
        availablePlans: Object.keys(AVAILABLE_PLANS)
      });
    }

    // In production, this would involve payment processing for paid plans
    // For mock mode, we just store the selection
    const selectedPlan = AVAILABLE_PLANS[plan];
    userPlans.set(userId, plan);

    logger.info(`📋 User ${userId} selected plan: ${plan}`);

    res.json({
      success: true,
      data: {
        plan,
        details: selectedPlan,
        message: `Successfully selected ${selectedPlan.name} plan`
      }
    });
  } catch (error) {
    logger.error('❌ Error selecting plan:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not select plan'
    });
  }
});

/**
 * GET /api/plan/features
 * Get feature comparison for all plans
 */
router.get('/features', (req, res) => {
  try {
    const featureComparison = Object.entries(AVAILABLE_PLANS).map(([planId, plan]) => ({
      id: planId,
      name: plan.name,
      price: plan.price,
      features: plan.features
    }));

    // Dynamic check for style profile availability (for test compatibility)
    const styleProfileEnabled = process.env.ENABLE_STYLE_PROFILE !== 'false';

    res.json({
      success: true,
      data: {
        comparison: featureComparison,
        styleProfileAvailable: styleProfileEnabled
      }
    });
  } catch (error) {
    logger.error('❌ Error getting plan features:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not get plan features'
    });
  }
});

/**
 * Helper function to check if user has access to a feature
 */
function hasFeatureAccess(userId, feature) {
  const userPlan = userPlans.get(userId) || 'starter_trial';
  const plan = AVAILABLE_PLANS[userPlan];
  return plan && plan.features[feature] === true;
}

/**
 * Helper function to get user's plan
 */
function getUserPlan(userId) {
  const userPlan = userPlans.get(userId) || 'starter_trial';
  return AVAILABLE_PLANS[userPlan];
}

module.exports = {
  router,
  hasFeatureAccess,
  getUserPlan,
  AVAILABLE_PLANS
};
