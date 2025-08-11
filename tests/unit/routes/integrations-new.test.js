const request = require('supertest');
const app = require('../../../src/index');

describe('New Integration Routes', () => {
  let authToken;

  beforeAll(async () => {
    authToken = 'mock-jwt-token';
  });

  describe('GET /api/integrations/platforms', () => {
    it('should return all supported platforms', async () => {
      const response = await request(app)
        .get('/api/integrations/platforms');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.platforms).toBeInstanceOf(Array);
      expect(response.body.data.count).toBe(7);

      // Verify required platforms are included
      const platformNames = response.body.data.platforms.map(p => p.name);
      expect(platformNames).toEqual(
        expect.arrayContaining(['twitter', 'instagram', 'youtube', 'tiktok', 'linkedin', 'facebook', 'bluesky'])
      );

      // Verify platform structure
      const platforms = response.body.data.platforms;
      platforms.forEach(platform => {
        expect(platform).toHaveProperty('name');
        expect(platform).toHaveProperty('displayName');
        expect(platform).toHaveProperty('icon');
        expect(platform).toHaveProperty('description');
        expect(platform).toHaveProperty('maxImportLimit');
        expect(platform).toHaveProperty('languages');
        expect(platform.maxImportLimit).toBe(300);
      });
    });
  });

  describe('GET /api/integrations/status', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/integrations/status');

      expect(response.status).toBe(401);
    });

    it('should return empty status for new user', async () => {
      const response = await request(app)
        .get('/api/integrations/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.integrations).toBeInstanceOf(Array);
      expect(response.body.data.connectedCount).toBe(0);
      expect(response.body.data.totalPlatforms).toBe(7);

      // All platforms should show disconnected status
      response.body.data.integrations.forEach(integration => {
        expect(integration.status).toBe('disconnected');
        expect(integration.importedCount).toBe(0);
      });
    });
  });

  describe('POST /api/integrations/connect', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/integrations/connect')
        .send({ platform: 'twitter' });

      expect(response.status).toBe(401);
    });

    it('should require platform parameter', async () => {
      const response = await request(app)
        .post('/api/integrations/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Platform is required');
    });

    it('should reject unsupported platform', async () => {
      const response = await request(app)
        .post('/api/integrations/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'unsupported_platform' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Unsupported platform');
      expect(response.body.supportedPlatforms).toBeInstanceOf(Array);
    });

    it('should successfully connect to Twitter', async () => {
      const response = await request(app)
        .post('/api/integrations/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'twitter' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.platform).toBe('twitter');
      expect(response.body.data.status).toBe('connected');
      expect(response.body.data.message).toContain('Successfully connected');
      expect(response.body.data.connectedAt).toBeDefined();
    });

    it('should successfully connect to multiple platforms', async () => {
      const platforms = ['instagram', 'youtube', 'tiktok'];
      
      for (const platform of platforms) {
        const response = await request(app)
          .post('/api/integrations/connect')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ platform });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.platform).toBe(platform);
        expect(response.body.data.status).toBe('connected');
      }
    });
  });

  describe('POST /api/integrations/import', () => {
    beforeAll(async () => {
      // Connect to Twitter first
      await request(app)
        .post('/api/integrations/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'twitter' });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/integrations/import')
        .send({ platform: 'twitter' });

      expect(response.status).toBe(401);
    });

    it('should require platform parameter', async () => {
      const response = await request(app)
        .post('/api/integrations/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Platform is required');
    });

    it('should require platform to be connected first', async () => {
      const response = await request(app)
        .post('/api/integrations/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'linkedin' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Please connect to linkedin first');
    });

    it('should successfully start import from connected platform', async () => {
      const response = await request(app)
        .post('/api/integrations/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'twitter', limit: 200 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.platform).toBe('twitter');
      expect(response.body.data.imported).toBe(200);
      expect(response.body.data.languageHints).toBeInstanceOf(Array);
      expect(response.body.data.status).toBe('importing');
      expect(response.body.data.estimatedTime).toBeDefined();
    });

    it('should respect maximum import limit', async () => {
      const response = await request(app)
        .post('/api/integrations/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'twitter', limit: 500 });

      expect(response.status).toBe(200);
      expect(response.body.data.imported).toBe(300); // Should be capped at 300
    });
  });

  describe('GET /api/integrations/import/status/:platform', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/integrations/import/status/twitter');

      expect(response.status).toBe(401);
    });

    it('should reject unsupported platform', async () => {
      const response = await request(app)
        .get('/api/integrations/import/status/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Unsupported platform');
    });

    it('should return import status for connected platform', async () => {
      const response = await request(app)
        .get('/api/integrations/import/status/twitter')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.platform).toBe('twitter');
      expect(response.body.data.status).toBe('connected');
      expect(response.body.data.languageHints).toBeInstanceOf(Array);
      expect(response.body.data.importedCount).toBeGreaterThan(0);
    });
  });

  describe('POST /api/integrations/disconnect', () => {
    beforeAll(async () => {
      // Ensure Instagram is connected
      await request(app)
        .post('/api/integrations/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'instagram' });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/integrations/disconnect')
        .send({ platform: 'instagram' });

      expect(response.status).toBe(401);
    });

    it('should require platform parameter', async () => {
      const response = await request(app)
        .post('/api/integrations/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Platform is required');
    });

    it('should fail for not connected platform', async () => {
      const response = await request(app)
        .post('/api/integrations/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'linkedin' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Platform not connected');
    });

    it('should successfully disconnect from platform', async () => {
      const response = await request(app)
        .post('/api/integrations/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'instagram' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.platform).toBe('instagram');
      expect(response.body.data.status).toBe('disconnected');
    });
  });

  describe('Integration flow testing', () => {
    it('should handle complete connect-import-disconnect flow', async () => {
      const platform = 'youtube';

      // 1. Connect
      const connectResponse = await request(app)
        .post('/api/integrations/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform });

      expect(connectResponse.status).toBe(200);
      expect(connectResponse.body.data.status).toBe('connected');

      // 2. Import
      const importResponse = await request(app)
        .post('/api/integrations/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform, limit: 150 });

      expect(importResponse.status).toBe(200);
      expect(importResponse.body.data.imported).toBe(150);

      // 3. Check status
      const statusResponse = await request(app)
        .get(`/api/integrations/import/status/${platform}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.platform).toBe(platform);

      // 4. Disconnect
      const disconnectResponse = await request(app)
        .post('/api/integrations/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform });

      expect(disconnectResponse.status).toBe(200);
      expect(disconnectResponse.body.data.status).toBe('disconnected');
    });
  });
});