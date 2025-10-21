const request = require('supertest');
const { app } = require('../../../src/index');

describe('Style Profile Routes', () => {
  let authToken;
  let creatorAuthToken;

  beforeAll(async () => {
    authToken = 'mock-jwt-token';
    creatorAuthToken = 'mock-creator-jwt-token';

    // Set up Creator+ plan for creator user
    await request(app)
      .post('/api/plan/select')
      .set('Authorization', `Bearer ${creatorAuthToken}`)
      .send({ plan: 'creator_plus' });

    // Connect and import data for creator user
    await request(app)
      .post('/api/integrations/connect')
      .set('Authorization', `Bearer ${creatorAuthToken}`)
      .send({ platform: 'twitter' });

    await request(app)
      .post('/api/integrations/import')
      .set('Authorization', `Bearer ${creatorAuthToken}`)
      .send({ platform: 'twitter', limit: 300 });
  });

  describe('GET /api/style-profile/status', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/style-profile/status');

      expect(response.status).toBe(401);
    });

    it('should return no access for free user', async () => {
      const response = await request(app)
        .get('/api/style-profile/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasAccess).toBe(false);
      expect(response.body.data.available).toBe(false);
    });

    it('should return access for Creator+ user', async () => {
      const response = await request(app)
        .get('/api/style-profile/status')
        .set('Authorization', `Bearer ${creatorAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasAccess).toBe(true);
      expect(response.body.data.available).toBe(true);
      expect(response.body.data.featureEnabled).toBe(true);
    });
  });

  describe('GET /api/style-profile', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/style-profile');

      expect(response.status).toBe(401);
    });

    it('should deny access to free users', async () => {
      const response = await request(app)
        .get('/api/style-profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Creator+ plan');
      expect(response.body.upgrade).toBe(true);
    });

    it('should return no profile for Creator+ user without generated profile', async () => {
      const response = await request(app)
        .get('/api/style-profile')
        .set('Authorization', `Bearer ${creatorAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(false);
      expect(response.body.data.message).toContain('No style profile generated yet');
    });
  });

  describe('POST /api/style-profile/generate', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/style-profile/generate')
        .send({ platforms: ['twitter'] });

      expect(response.status).toBe(401);
    });

    it('should deny access to free users', async () => {
      const response = await request(app)
        .post('/api/style-profile/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platforms: ['twitter'] });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Creator+ plan');
      expect(response.body.upgrade).toBe(true);
    });

    it('should require platforms parameter', async () => {
      const response = await request(app)
        .post('/api/style-profile/generate')
        .set('Authorization', `Bearer ${creatorAuthToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('At least one platform is required');
      expect(response.body.example).toHaveProperty('platforms');
    });

    it('should require valid platforms array', async () => {
      const response = await request(app)
        .post('/api/style-profile/generate')
        .set('Authorization', `Bearer ${creatorAuthToken}`)
        .send({ platforms: 'twitter' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('At least one platform is required');
    });

    it('should successfully generate style profile', async () => {
      const response = await request(app)
        .post('/api/style-profile/generate')
        .set('Authorization', `Bearer ${creatorAuthToken}`)
        .send({ platforms: ['twitter'], maxItemsPerPlatform: 300 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('successfully');
      expect(response.body.data.profiles).toBeInstanceOf(Array);
      expect(response.body.data.profiles.length).toBeGreaterThan(0);
      expect(response.body.data.totalItems).toBeGreaterThan(0);
      expect(response.body.data.sources).toHaveProperty('twitter');
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.stats).toBeDefined();

      // Verify profile structure
      const profile = response.body.data.profiles[0];
      expect(profile).toHaveProperty('lang');
      expect(profile).toHaveProperty('prompt');
      expect(profile).toHaveProperty('sources');
      expect(profile).toHaveProperty('createdAt');
      expect(profile).toHaveProperty('metadata');
      expect(profile).toHaveProperty('examples');
      expect(profile.prompt.length).toBeLessThanOrEqual(1200);
      expect(profile.examples).toBeInstanceOf(Array);
      expect(profile.examples.length).toBeGreaterThan(0);
    });

    it('should generate multiple language profiles', async () => {
      // Connect to another platform with different language content
      await request(app)
        .post('/api/integrations/connect')
        .set('Authorization', `Bearer ${creatorAuthToken}`)
        .send({ platform: 'instagram' });

      await request(app)
        .post('/api/integrations/import')
        .set('Authorization', `Bearer ${creatorAuthToken}`)
        .send({ platform: 'instagram', limit: 200 });

      const response = await request(app)
        .post('/api/style-profile/generate')
        .set('Authorization', `Bearer ${creatorAuthToken}`)
        .send({ platforms: ['twitter', 'instagram'] });

      expect(response.status).toBe(200);
      expect(response.body.data.profiles.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.sources).toHaveProperty('twitter');
      expect(response.body.data.sources).toHaveProperty('instagram');
    });
  });

  describe('GET /api/style-profile (with generated profile)', () => {
    it('should return generated profile data', async () => {
      const response = await request(app)
        .get('/api/style-profile')
        .set('Authorization', `Bearer ${creatorAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(true);
      expect(response.body.data.profiles).toBeInstanceOf(Array);
      expect(response.body.data.profiles.length).toBeGreaterThan(0);
      expect(response.body.data.totalItems).toBeGreaterThan(0);
      expect(response.body.data.sources).toBeDefined();
      expect(response.body.data.stats).toBeDefined();
    });
  });

  describe('GET /api/style-profile/preview/:lang', () => {
    let availableLanguage;

    beforeAll(async () => {
      // Get available language from existing profile
      const profileResponse = await request(app)
        .get('/api/style-profile')
        .set('Authorization', `Bearer ${creatorAuthToken}`);

      // Issue #618 - Add defensive check for profiles array
      if (profileResponse.body.data.profiles && profileResponse.body.data.profiles.length > 0) {
        availableLanguage = profileResponse.body.data.profiles[0].lang;
      } else {
        // Fallback to 'es' if no profiles available (test will fail appropriately)
        availableLanguage = 'es';
      }
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/style-profile/preview/es');

      expect(response.status).toBe(401);
    });

    it('should deny access to free users', async () => {
      const response = await request(app)
        .get('/api/style-profile/preview/es')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Creator+ plan');
    });

    it('should return 404 for non-existent profile', async () => {
      const response = await request(app)
        .get('/api/style-profile/preview/unknown')
        .set('Authorization', `Bearer ${creatorAuthToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Language profile not found');
      expect(response.body.availableLanguages).toBeInstanceOf(Array);
    });

    it('should return language profile preview', async () => {
      const response = await request(app)
        .get(`/api/style-profile/preview/${availableLanguage}`)
        .set('Authorization', `Bearer ${creatorAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.language).toBe(availableLanguage);
      expect(response.body.data.profile).toBeDefined();
      expect(response.body.data.preview).toBeDefined();
      expect(response.body.data.preview.prompt).toBeDefined();
      expect(response.body.data.preview.examples).toBeInstanceOf(Array);
      expect(response.body.data.preview.metadata).toBeDefined();
      expect(response.body.data.preview.sources).toBeDefined();
    });
  });

  describe('GET /api/style-profile/stats', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/style-profile/stats');

      expect(response.status).toBe(401);
    });

    it('should deny access to free users', async () => {
      const response = await request(app)
        .get('/api/style-profile/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Creator+ plan');
    });

    it('should return profile statistics', async () => {
      const response = await request(app)
        .get('/api/style-profile/stats')
        .set('Authorization', `Bearer ${creatorAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasProfile).toBe(true);
      expect(response.body.data.languageCount).toBeGreaterThan(0);
      expect(response.body.data.languages).toBeInstanceOf(Array);
      expect(response.body.data.totalSources).toBeGreaterThan(0);
      expect(response.body.data.avgItemsPerLanguage).toBeGreaterThan(0);
      expect(response.body.data.generatedAt).toBeDefined();
    });
  });

  describe('DELETE /api/style-profile', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/style-profile');

      expect(response.status).toBe(401);
    });

    it('should deny access to free users', async () => {
      const response = await request(app)
        .delete('/api/style-profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Creator+ plan');
    });

    it('should successfully delete existing profile', async () => {
      const response = await request(app)
        .delete('/api/style-profile')
        .set('Authorization', `Bearer ${creatorAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('deleted successfully');

      // Verify profile is deleted
      const checkResponse = await request(app)
        .get('/api/style-profile')
        .set('Authorization', `Bearer ${creatorAuthToken}`);

      expect(checkResponse.body.data.available).toBe(false);
    });

    it('should return 404 when deleting non-existent profile', async () => {
      const response = await request(app)
        .delete('/api/style-profile')
        .set('Authorization', `Bearer ${creatorAuthToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('No style profile found to delete');
    });
  });

  describe('Feature flag integration', () => {
    it('should respect ENABLE_STYLE_PROFILE flag when disabled', async () => {
      // Mock feature flag as disabled
      const originalEnv = process.env.ENABLE_STYLE_PROFILE;
      process.env.ENABLE_STYLE_PROFILE = 'false';

      // Reload flags
      const { flags } = require('../../../src/config/flags');
      flags.reload();

      const response = await request(app)
        .post('/api/style-profile/generate')
        .set('Authorization', `Bearer ${creatorAuthToken}`)
        .send({ platforms: ['twitter'] });

      expect(response.status).toBe(503);
      expect(response.body.error).toContain('currently disabled');

      // Restore original flag
      process.env.ENABLE_STYLE_PROFILE = originalEnv || 'true';
      flags.reload();
    });
  });

  describe('Error handling and edge cases', () => {
    beforeAll(async () => {
      // Ensure user has Creator+ access and connected platforms
      await request(app)
        .post('/api/plan/select')
        .set('Authorization', `Bearer ${creatorAuthToken}`)
        .send({ plan: 'creator_plus' });
    });

    it('should handle insufficient content for generation', async () => {
      // Create new user token for testing insufficient content
      const newUserToken = 'mock-new-user-token';
      
      await request(app)
        .post('/api/plan/select')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({ plan: 'creator_plus' });

      const response = await request(app)
        .post('/api/style-profile/generate')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({ platforms: ['twitter'] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('No imported content found');
    });

    it('should handle generation with minimal content', async () => {
      // Test with very small import
      const minimalUserToken = 'mock-minimal-user-token';
      
      await request(app)
        .post('/api/plan/select')
        .set('Authorization', `Bearer ${minimalUserToken}`)
        .send({ plan: 'creator_plus' });

      await request(app)
        .post('/api/integrations/connect')
        .set('Authorization', `Bearer ${minimalUserToken}`)
        .send({ platform: 'twitter' });

      await request(app)
        .post('/api/integrations/import')
        .set('Authorization', `Bearer ${minimalUserToken}`)
        .send({ platform: 'twitter', limit: 30 });

      const response = await request(app)
        .post('/api/style-profile/generate')
        .set('Authorization', `Bearer ${minimalUserToken}`)
        .send({ platforms: ['twitter'] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient content');
      expect(response.body.details).toContain('50+ imported items');
    });
  });
});