const request = require('supertest');
const app = require('../../../src/index');

describe('Plan Routes', () => {
  let authToken;

  beforeAll(async () => {
    // Mock authentication token (in real tests, this would come from auth service)
    authToken = 'mock-jwt-token';
  });

  describe('GET /api/plan/available', () => {
    it('should return all available plans', async () => {
      const response = await request(app)
        .get('/api/plan/available');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toBeInstanceOf(Array);
      expect(response.body.data.plans.length).toBe(3);

      // Verify plan structure
      const plans = response.body.data.plans;
      expect(plans.map(p => p.id)).toEqual(
        expect.arrayContaining(['free', 'pro', 'creator_plus'])
      );

      // Check Creator+ plan has style profile feature
      const creatorPlan = plans.find(p => p.id === 'creator_plus');
      expect(creatorPlan.features.styleProfile).toBe(true);

      // Check Free plan doesn't have style profile
      const freePlan = plans.find(p => p.id === 'free');
      expect(freePlan.features.styleProfile).toBe(false);
    });
  });

  describe('GET /api/plan/current', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/plan/current');

      expect(response.status).toBe(401);
    });

    it('should return free plan for new user', async () => {
      const response = await request(app)
        .get('/api/plan/current')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('free');
      expect(response.body.data.canAccessStyleProfile).toBe(false);
    });
  });

  describe('POST /api/plan/select', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/plan/select')
        .send({ plan: 'creator_plus' });

      expect(response.status).toBe(401);
    });

    it('should require valid plan', async () => {
      const response = await request(app)
        .post('/api/plan/select')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ plan: 'invalid_plan' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid plan selected');
    });

    it('should successfully select Creator+ plan', async () => {
      const response = await request(app)
        .post('/api/plan/select')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ plan: 'creator_plus' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('creator_plus');
      expect(response.body.data.details.features.styleProfile).toBe(true);
    });

    it('should successfully select Pro plan', async () => {
      const response = await request(app)
        .post('/api/plan/select')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ plan: 'pro' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('pro');
      expect(response.body.data.details.features.styleProfile).toBe(false);
    });
  });

  describe('GET /api/plan/features', () => {
    it('should return feature comparison', async () => {
      const response = await request(app)
        .get('/api/plan/features');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.comparison).toBeInstanceOf(Array);
      expect(response.body.data.comparison.length).toBe(3);
      expect(response.body.data.styleProfileAvailable).toBe(true);

      // Verify feature comparison structure
      const features = response.body.data.comparison;
      features.forEach(plan => {
        expect(plan).toHaveProperty('id');
        expect(plan).toHaveProperty('name');
        expect(plan).toHaveProperty('price');
        expect(plan).toHaveProperty('features');
        expect(plan.features).toHaveProperty('roastsPerMonth');
        expect(plan.features).toHaveProperty('platformConnections');
        expect(plan.features).toHaveProperty('styleProfile');
      });
    });
  });
});