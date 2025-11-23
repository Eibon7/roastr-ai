/**
 * Tests unitarios para las rutas de integraciones (/api/integrations)
 * Issue #925: Tests para Routes Básicas (0% → 60%+)
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies BEFORE requiring the routes
jest.mock('../../../src/middleware/auth');
jest.mock('../../../src/services/userIntegrationsService');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Now require the modules after mocking
const integrationsRoutes = require('../../../src/routes/integrations');
const { authenticateToken } = require('../../../src/middleware/auth');
const userIntegrationsService = require('../../../src/services/userIntegrationsService');

describe('Integrations Routes Tests', () => {
  let app;
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup express app
    app = express();
    app.use(express.json());
    app.use('/api/integrations', integrationsRoutes);

    // Mock user
    mockUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      org_id: 'test-org-id'
    };

    // Mock authentication middleware
    authenticateToken.mockImplementation((req, res, next) => {
      req.user = mockUser;
      req.accessToken = 'mock-access-token';
      next();
    });

    // Mock service methods
    userIntegrationsService.getUserIntegrations = jest.fn().mockResolvedValue([
      { id: 'int-1', platform: 'twitter', enabled: true },
      { id: 'int-2', platform: 'youtube', enabled: false }
    ]);

    userIntegrationsService.getAvailablePlatforms = jest.fn().mockResolvedValue([
      { platform: 'twitter', name: 'Twitter', enabled: true },
      { platform: 'youtube', name: 'YouTube', enabled: true },
      { platform: 'instagram', name: 'Instagram', enabled: false }
    ]);

    userIntegrationsService.updateIntegration = jest
      .fn()
      .mockImplementation((accessToken, platform, config) => {
        return Promise.resolve({
          id: 'int-1',
          platform: platform, // Use the platform parameter
          enabled: config.enabled !== undefined ? config.enabled : true,
          config: config
        });
      });

    userIntegrationsService.deleteIntegration = jest.fn().mockResolvedValue({
      success: true,
      message: 'Integration deleted successfully'
    });

    userIntegrationsService.getIntegrationsMetrics = jest.fn().mockResolvedValue({
      total: 2,
      enabled: 1,
      by_platform: {
        twitter: 1,
        youtube: 1
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/integrations', () => {
    it('should get user integrations successfully', async () => {
      const response = await request(app).get('/api/integrations').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('platform');
      expect(userIntegrationsService.getUserIntegrations).toHaveBeenCalledWith('mock-access-token');
    });

    it('should return 400 if service throws error', async () => {
      userIntegrationsService.getUserIntegrations.mockRejectedValueOnce(
        new Error('Failed to fetch integrations')
      );

      const response = await request(app).get('/api/integrations').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to fetch integrations');
    });
  });

  describe('GET /api/integrations/platforms', () => {
    it('should get available platforms successfully', async () => {
      const response = await request(app).get('/api/integrations/platforms').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0]).toHaveProperty('platform');
      expect(response.body.data[0]).toHaveProperty('name');
      expect(userIntegrationsService.getAvailablePlatforms).toHaveBeenCalledWith(
        'mock-access-token'
      );
    });

    it('should return 400 if service throws error', async () => {
      userIntegrationsService.getAvailablePlatforms.mockRejectedValueOnce(
        new Error('Failed to fetch platforms')
      );

      const response = await request(app).get('/api/integrations/platforms').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to fetch platforms');
    });
  });

  describe('POST /api/integrations/:platform', () => {
    it('should create or update integration successfully', async () => {
      const platform = 'twitter';
      const config = {
        enabled: true,
        api_key: 'test-key'
      };

      const response = await request(app)
        .post(`/api/integrations/${platform}`)
        .send(config)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('platform', platform);
      expect(userIntegrationsService.updateIntegration).toHaveBeenCalledWith(
        'mock-access-token',
        platform,
        config
      );
    });

    it('should return 400 if service throws error', async () => {
      userIntegrationsService.updateIntegration.mockRejectedValueOnce(
        new Error('Failed to update integration')
      );

      const platform = 'twitter';
      const config = { enabled: true };

      const response = await request(app)
        .post(`/api/integrations/${platform}`)
        .send(config)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to update integration');
    });
  });

  describe('PUT /api/integrations/:platform', () => {
    it('should update integration successfully', async () => {
      const platform = 'youtube';
      const config = {
        enabled: true,
        channel_id: 'test-channel'
      };

      const response = await request(app)
        .put(`/api/integrations/${platform}`)
        .send(config)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('platform', platform);
      expect(userIntegrationsService.updateIntegration).toHaveBeenCalledWith(
        'mock-access-token',
        platform,
        config
      );
    });

    it('should return 400 if service throws error', async () => {
      userIntegrationsService.updateIntegration.mockRejectedValueOnce(
        new Error('Failed to update integration')
      );

      const platform = 'youtube';
      const config = { enabled: true };

      const response = await request(app)
        .put(`/api/integrations/${platform}`)
        .send(config)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to update integration');
    });
  });

  describe('DELETE /api/integrations/:platform', () => {
    it('should delete integration successfully', async () => {
      const platform = 'twitter';

      const response = await request(app).delete(`/api/integrations/${platform}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('success', true);
      expect(userIntegrationsService.deleteIntegration).toHaveBeenCalledWith(
        'mock-access-token',
        platform
      );
    });

    it('should return 400 if service throws error', async () => {
      userIntegrationsService.deleteIntegration.mockRejectedValueOnce(
        new Error('Failed to delete integration')
      );

      const platform = 'twitter';

      const response = await request(app).delete(`/api/integrations/${platform}`).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to delete integration');
    });
  });

  describe('GET /api/integrations/metrics', () => {
    it('should get integration metrics successfully', async () => {
      const response = await request(app).get('/api/integrations/metrics').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('enabled');
      expect(response.body.data).toHaveProperty('by_platform');
      expect(userIntegrationsService.getIntegrationsMetrics).toHaveBeenCalledWith(
        'mock-access-token'
      );
    });

    it('should return 400 if service throws error', async () => {
      userIntegrationsService.getIntegrationsMetrics.mockRejectedValueOnce(
        new Error('Failed to fetch metrics')
      );

      const response = await request(app).get('/api/integrations/metrics').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to fetch metrics');
    });
  });

  describe('POST /api/integrations/:platform/enable', () => {
    it('should enable integration successfully', async () => {
      const platform = 'instagram';

      const response = await request(app).post(`/api/integrations/${platform}/enable`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('platform', platform);
      expect(userIntegrationsService.updateIntegration).toHaveBeenCalledWith(
        'mock-access-token',
        platform,
        { enabled: true }
      );
    });

    it('should return 400 if service throws error', async () => {
      userIntegrationsService.updateIntegration.mockRejectedValueOnce(
        new Error('Failed to enable integration')
      );

      const platform = 'instagram';

      const response = await request(app).post(`/api/integrations/${platform}/enable`).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to enable integration');
    });
  });

  describe('POST /api/integrations/:platform/disable', () => {
    it('should disable integration successfully', async () => {
      const platform = 'twitter';

      const response = await request(app).post(`/api/integrations/${platform}/disable`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('platform', platform);
      expect(userIntegrationsService.updateIntegration).toHaveBeenCalledWith(
        'mock-access-token',
        platform,
        { enabled: false }
      );
    });

    it('should return 400 if service throws error', async () => {
      userIntegrationsService.updateIntegration.mockRejectedValueOnce(
        new Error('Failed to disable integration')
      );

      const platform = 'twitter';

      const response = await request(app).post(`/api/integrations/${platform}/disable`).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to disable integration');
    });
  });

  describe('Authentication Middleware Integration', () => {
    it('should require authentication for all routes', async () => {
      // Note: All routes use router.use(authenticateToken), so authentication
      // is applied to all routes. We verify that the middleware is in place
      // by checking that routes work when authenticated (tested in other tests)
      // and that authenticateToken is called.

      // Reset mock to track calls
      authenticateToken.mockClear();

      await request(app).get('/api/integrations');

      // Verify authenticateToken was called
      expect(authenticateToken).toHaveBeenCalled();
    });
  });
});
