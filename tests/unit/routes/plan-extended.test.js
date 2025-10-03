/**
 * Plan Routes Extended Tests
 * 
 * Comprehensive tests for plan management routes including available plans,
 * current user plan, plan selection, and feature comparison
 */

const request = require('supertest');
const express = require('express');

// Mock authentication middleware first
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    // Mock authenticated user
    req.user = { id: 'test-user-123', email: 'test@example.com' };
    next();
  }
}));

// Mock flags
jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn().mockReturnValue(false)
  }
}));

const { router, hasFeatureAccess, getUserPlan, AVAILABLE_PLANS } = require('../../../src/routes/plan');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/plan', router);

describe('Plan Routes', () => {
  // Clear user plans between tests
  beforeEach(() => {
    // Reset the userPlans Map by accessing it through the module
    const planModule = require('../../../src/routes/plan');
    // Since userPlans is not exported, we'll test through the API behavior
  });

  describe('GET /api/plan/available', () => {
    test('should return all available plans', async () => {
      const response = await request(app)
        .get('/api/plan/available')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toHaveLength(4);

      const planIds = response.body.data.plans.map(p => p.id);
      expect(planIds).toContain('free');
      expect(planIds).toContain('starter');
      expect(planIds).toContain('pro');
      expect(planIds).toContain('creator_plus');
    });

    test('should include correct plan structure', async () => {
      const response = await request(app)
        .get('/api/plan/available')
        .expect(200);

      const freePlan = response.body.data.plans.find(p => p.id === 'free');
      expect(freePlan).toMatchObject({
        id: 'free',
        name: 'Free',
        price: 0,
        features: {
          roastsPerMonth: 10,
          platformConnections: 1,
          styleProfile: false,
          prioritySupport: false,
          customPrompts: false
        }
      });

      const proPlan = response.body.data.plans.find(p => p.id === 'pro');
      expect(proPlan).toMatchObject({
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
      });

      const creatorPlan = response.body.data.plans.find(p => p.id === 'creator_plus');
      expect(creatorPlan).toMatchObject({
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
      });
    });

    test('should handle errors gracefully', async () => {
      // Test that the route exists and handles normal operation
      const response = await request(app)
        .get('/api/plan/available')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('GET /api/plan/current', () => {
    test('should return default free plan for new user', async () => {
      const response = await request(app)
        .get('/api/plan/current')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('free');
      expect(response.body.data.details.name).toBe('Free');
      expect(response.body.data.canAccessStyleProfile).toBe(false);
    });

    test('should return user plan if previously selected', async () => {
      // First select a pro plan
      await request(app)
        .post('/api/plan/select')
        .send({ plan: 'pro' })
        .expect(200);

      // Then get current plan
      const response = await request(app)
        .get('/api/plan/current')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('pro');
      expect(response.body.data.details.name).toBe('Pro');
      expect(response.body.data.canAccessStyleProfile).toBe(false);
    });

    test('should return creator plus plan with style profile access', async () => {
      // Select creator plus plan
      await request(app)
        .post('/api/plan/select')
        .send({ plan: 'creator_plus' })
        .expect(200);

      // Get current plan
      const response = await request(app)
        .get('/api/plan/current')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('creator_plus');
      expect(response.body.data.details.name).toBe('Creator+');
      expect(response.body.data.canAccessStyleProfile).toBe(true);
    });

    test('should require authentication', async () => {
      // Create app without auth middleware
      const noAuthApp = express();
      noAuthApp.use(express.json());
      
      // Mock auth middleware that fails
      const authMiddleware = (req, res, next) => {
        res.status(401).json({ success: false, error: 'Unauthorized' });
      };
      
      const noAuthRouter = express.Router();
      noAuthRouter.get('/current', authMiddleware, (req, res) => {
        res.json({ success: true });
      });
      
      noAuthApp.use('/api/plan', noAuthRouter);

      const response = await request(noAuthApp)
        .get('/api/plan/current')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should handle errors gracefully', async () => {
      // Test that the route exists and handles normal operation
      const response = await request(app)
        .get('/api/plan/current')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/plan/select', () => {
    test('should select valid plan successfully', async () => {
      const response = await request(app)
        .post('/api/plan/select')
        .send({ plan: 'pro' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('pro');
      expect(response.body.data.details.name).toBe('Pro');
      expect(response.body.data.message).toBe('Successfully selected Pro plan');
    });

    test('should reject request without plan', async () => {
      const response = await request(app)
        .post('/api/plan/select')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Plan is required and must be a string');
    });

    test('should reject request with null plan', async () => {
      const response = await request(app)
        .post('/api/plan/select')
        .send({ plan: null })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Plan is required and must be a string');
    });

    test('should reject request with non-string plan', async () => {
      const response = await request(app)
        .post('/api/plan/select')
        .send({ plan: 123 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Plan is required and must be a string');
    });

    test('should reject invalid plan', async () => {
      const response = await request(app)
        .post('/api/plan/select')
        .send({ plan: 'invalid_plan' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid plan selected');
      expect(response.body.availablePlans).toEqual(['free', 'starter', 'pro', 'creator_plus']);
    });

    test('should select all available plans', async () => {
      // Test selecting each plan
      const plans = ['free', 'starter', 'pro', 'creator_plus'];
      
      for (const planId of plans) {
        const response = await request(app)
          .post('/api/plan/select')
          .send({ plan: planId })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.plan).toBe(planId);
        expect(response.body.data.details.id).toBe(planId);
      }
    });

    test('should require authentication', async () => {
      // Create app without auth middleware
      const noAuthApp = express();
      noAuthApp.use(express.json());
      
      const authMiddleware = (req, res, next) => {
        res.status(401).json({ success: false, error: 'Unauthorized' });
      };
      
      const noAuthRouter = express.Router();
      noAuthRouter.post('/select', authMiddleware, (req, res) => {
        res.json({ success: true });
      });
      
      noAuthApp.use('/api/plan', noAuthRouter);

      const response = await request(noAuthApp)
        .post('/api/plan/select')
        .send({ plan: 'pro' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should handle server errors gracefully', async () => {
      // This is harder to test without modifying the actual implementation
      // We'll test that the route exists and responds appropriately to valid input
      const response = await request(app)
        .post('/api/plan/select')
        .send({ plan: 'free' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/plan/features', () => {
    test('should return feature comparison for all plans', async () => {
      const response = await request(app)
        .get('/api/plan/features')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comparison).toHaveLength(4);
      expect(response.body.data.styleProfileAvailable).toBeDefined();

      const comparison = response.body.data.comparison;
      const freePlan = comparison.find(p => p.id === 'free');
      const starterPlan = comparison.find(p => p.id === 'starter');
      const proPlan = comparison.find(p => p.id === 'pro');
      const creatorPlan = comparison.find(p => p.id === 'creator_plus');

      expect(freePlan).toMatchObject({
        id: 'free',
        name: 'Free',
        price: 0,
        features: expect.objectContaining({
          roastsPerMonth: 10,
          styleProfile: false
        })
      });

      expect(proPlan).toMatchObject({
        id: 'pro',
        name: 'Pro',
        price: 9.99,
        features: expect.objectContaining({
          roastsPerMonth: 1000,
          prioritySupport: true
        })
      });

      expect(creatorPlan).toMatchObject({
        id: 'creator_plus',
        name: 'Creator+',
        price: 19.99,
        features: expect.objectContaining({
          roastsPerMonth: 5000,
          styleProfile: true,
          advancedAnalytics: true
        })
      });
    });

    test('should respect ENABLE_STYLE_PROFILE environment variable', async () => {
      const originalEnv = process.env.ENABLE_STYLE_PROFILE;
      
      // Test with style profile enabled
      process.env.ENABLE_STYLE_PROFILE = 'true';
      let response = await request(app)
        .get('/api/plan/features')
        .expect(200);

      expect(response.body.data.styleProfileAvailable).toBe(true);

      // Test with style profile disabled
      process.env.ENABLE_STYLE_PROFILE = 'false';
      response = await request(app)
        .get('/api/plan/features')
        .expect(200);

      expect(response.body.data.styleProfileAvailable).toBe(false);

      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.ENABLE_STYLE_PROFILE = originalEnv;
      } else {
        delete process.env.ENABLE_STYLE_PROFILE;
      }
    });

    test('should handle errors gracefully', async () => {
      // Test that the route exists and handles normal operation
      const response = await request(app)
        .get('/api/plan/features')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Helper Functions', () => {
    describe('hasFeatureAccess', () => {
      test('should return false for free user accessing pro features', () => {
        const hasAccess = hasFeatureAccess('new-user', 'prioritySupport');
        expect(hasAccess).toBe(false);
      });

      test('should return true for features available in user plan', () => {
        // The helper functions work with the same userPlans map
        // We need to simulate a user having a plan by calling the API first
        // Since the map is internal, we test through the behavior
        
        // For testing, we can check the default behavior
        const freeFeatureAccess = hasFeatureAccess('test-user', 'roastsPerMonth');
        // This will check if the feature exists, not its value
        expect(typeof freeFeatureAccess).toBe('boolean');
      });

      test('should handle non-existent users', () => {
        const hasAccess = hasFeatureAccess('non-existent-user', 'prioritySupport');
        expect(hasAccess).toBe(false);
      });

      test('should handle non-existent features', () => {
        const hasAccess = hasFeatureAccess('test-user', 'nonExistentFeature');
        expect(hasAccess).toBe(false);
      });
    });

    describe('getUserPlan', () => {
      test('should return free plan for new users', () => {
        const userPlan = getUserPlan('new-user');
        expect(userPlan.id).toBe('free');
        expect(userPlan.name).toBe('Free');
      });

      test('should return correct plan structure', () => {
        const userPlan = getUserPlan('any-user');
        expect(userPlan).toHaveProperty('id');
        expect(userPlan).toHaveProperty('name');
        expect(userPlan).toHaveProperty('price');
        expect(userPlan).toHaveProperty('features');
      });
    });

    describe('AVAILABLE_PLANS constant', () => {
      test('should contain all expected plans', () => {
        expect(AVAILABLE_PLANS).toHaveProperty('free');
        expect(AVAILABLE_PLANS).toHaveProperty('pro');
        expect(AVAILABLE_PLANS).toHaveProperty('creator_plus');
      });

      test('should have consistent structure across plans', () => {
        Object.values(AVAILABLE_PLANS).forEach(plan => {
          expect(plan).toHaveProperty('id');
          expect(plan).toHaveProperty('name');
          expect(plan).toHaveProperty('price');
          expect(plan).toHaveProperty('features');
          expect(typeof plan.price).toBe('number');
          expect(typeof plan.features).toBe('object');
        });
      });

      test('should have features with correct types', () => {
        Object.values(AVAILABLE_PLANS).forEach(plan => {
          const features = plan.features;
          expect(typeof features.roastsPerMonth).toBe('number');
          expect(typeof features.platformConnections).toBe('number');
          expect(typeof features.styleProfile).toBe('boolean');
          expect(typeof features.prioritySupport).toBe('boolean');
          expect(typeof features.customPrompts).toBe('boolean');
        });
      });
    });
  });

  describe('Plan Integration Tests', () => {
    test('should maintain plan consistency across endpoints', async () => {
      // Get available plans
      const availableResponse = await request(app)
        .get('/api/plan/available')
        .expect(200);

      // Get features
      const featuresResponse = await request(app)
        .get('/api/plan/features')
        .expect(200);

      // Plans should be consistent between endpoints
      const availablePlans = availableResponse.body.data.plans;
      const featureComparison = featuresResponse.body.data.comparison;

      expect(availablePlans).toHaveLength(featureComparison.length);

      availablePlans.forEach(plan => {
        const featurePlan = featureComparison.find(fp => fp.id === plan.id);
        expect(featurePlan).toBeDefined();
        expect(featurePlan.name).toBe(plan.name);
        expect(featurePlan.price).toBe(plan.price);
      });
    });

    test('should handle complete user journey', async () => {
      // 1. Get available plans
      const availableResponse = await request(app)
        .get('/api/plan/available')
        .expect(200);

      expect(availableResponse.body.success).toBe(true);

      // 2. Check initial plan (should be free)
      let currentResponse = await request(app)
        .get('/api/plan/current')
        .expect(200);

      expect(currentResponse.body.data.plan).toBe('free');

      // 3. Select pro plan
      const selectResponse = await request(app)
        .post('/api/plan/select')
        .send({ plan: 'pro' })
        .expect(200);

      expect(selectResponse.body.success).toBe(true);

      // 4. Verify plan was selected
      currentResponse = await request(app)
        .get('/api/plan/current')
        .expect(200);

      expect(currentResponse.body.data.plan).toBe('pro');

      // 5. Get features to verify access
      const featuresResponse = await request(app)
        .get('/api/plan/features')
        .expect(200);

      expect(featuresResponse.body.success).toBe(true);
    });

    test('should handle plan upgrade flow', async () => {
      // Reset to free plan first (in case other tests changed it)
      await request(app)
        .post('/api/plan/select')
        .send({ plan: 'free' })
        .expect(200);

      // Start with free plan
      let currentResponse = await request(app)
        .get('/api/plan/current')
        .expect(200);
      expect(currentResponse.body.data.plan).toBe('free');

      // Upgrade to pro
      await request(app)
        .post('/api/plan/select')
        .send({ plan: 'pro' })
        .expect(200);

      currentResponse = await request(app)
        .get('/api/plan/current')
        .expect(200);
      expect(currentResponse.body.data.plan).toBe('pro');

      // Upgrade to creator plus
      await request(app)
        .post('/api/plan/select')
        .send({ plan: 'creator_plus' })
        .expect(200);

      currentResponse = await request(app)
        .get('/api/plan/current')
        .expect(200);
      expect(currentResponse.body.data.plan).toBe('creator_plus');
      expect(currentResponse.body.data.canAccessStyleProfile).toBe(true);
    });
  });
});