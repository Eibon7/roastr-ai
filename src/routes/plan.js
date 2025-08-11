const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { flags } = require('../config/flags');

// Mock plan data and user plan storage (in production, this would be in the database)
const AVAILABLE_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    features: {
      roastsPerMonth: 100,
      platformConnections: 2,
      styleProfile: false,
      prioritySupport: false,
      customPrompts: false
    }
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    features: {
      roastsPerMonth: 1000,
      platformConnections: 5,
      styleProfile: false,
      prioritySupport: true,
      customPrompts: true
    }
  },
  creator_plus: {
    id: 'creator_plus',
    name: 'Creator+',
    price: 19.99,
    features: {
      roastsPerMonth: 5000,
      platformConnections: 10,
      styleProfile: true,
      prioritySupport: true,
      customPrompts: true,
      advancedAnalytics: true
    }
  }
};

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
    console.error('❌ Error getting available plans:', error.message);
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
    const userPlan = userPlans.get(userId) || 'free';
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
    console.error('❌ Error getting current plan:', error.message);
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

    console.log(`📋 User ${userId} selected plan: ${plan}`);

    res.json({
      success: true,
      data: {
        plan,
        details: selectedPlan,
        message: `Successfully selected ${selectedPlan.name} plan`
      }
    });
  } catch (error) {
    console.error('❌ Error selecting plan:', error.message);
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

    res.json({
      success: true,
      data: {
        comparison: featureComparison,
        styleProfileAvailable: flags.isEnabled('ENABLE_STYLE_PROFILE')
      }
    });
  } catch (error) {
    console.error('❌ Error getting plan features:', error.message);
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
  const userPlan = userPlans.get(userId) || 'free';
  const plan = AVAILABLE_PLANS[userPlan];
  return plan && plan.features[feature] === true;
}

/**
 * Helper function to get user's plan
 */
function getUserPlan(userId) {
  const userPlan = userPlans.get(userId) || 'free';
  return AVAILABLE_PLANS[userPlan];
}

module.exports = {
  router,
  hasFeatureAccess,
  getUserPlan,
  AVAILABLE_PLANS
};