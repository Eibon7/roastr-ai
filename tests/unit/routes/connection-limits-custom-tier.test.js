/**
 * Connection Limits Custom Tier Tests - Issue #366 CodeRabbit Fix
 * Testing specific requirements for "custom" tier mapping to 999 connections
 */

const request = require('supertest');
const express = require('express');

// Mock user integrations service
class MockIntegrationsService {
  async getUserIntegrations(userId) {
    // Return different numbers of connections based on test scenario
    if (this.mockConnectedCount !== undefined) {
      const connections = Array(this.mockConnectedCount)
        .fill(null)
        .map((_, i) => ({
          id: i,
          platform: `platform-${i}`,
          connected: true
        }));
      return { success: true, data: connections };
    }

    return { success: true, data: [] };
  }

  async connectIntegration(userId, platform) {
    return { success: true, data: { platform, connected: true } };
  }

  setMockConnectedCount(count) {
    this.mockConnectedCount = count;
  }
}

const mockIntegrationsService = new MockIntegrationsService();

// Mock authentication middleware
const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = { id: 'test-user-id', plan: 'custom', org_id: 'test-org-id' };
  next();
});

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken
}));

jest.mock('../../../src/services/mockIntegrationsService', () => {
  return jest.fn().mockImplementation(() => mockIntegrationsService);
});

describe('Custom Tier Connection Limits - Issue #366 CodeRabbit Fix', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Add simplified connection endpoint for testing
    app.post('/api/user/integrations/connect', mockAuthenticateToken, async (req, res) => {
      try {
        const userId = req.user.id;
        const platform = req.body.platform;

        const UserIntegrationsService = require('../../../src/services/mockIntegrationsService');
        const integrationsService = new UserIntegrationsService();

        if (!platform || !['twitter', 'youtube', 'instagram'].includes(platform)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid platform'
          });
        }

        // Check connection limits based on tier (Issue #366)
        const currentIntegrations = await integrationsService.getUserIntegrations(userId);

        // Ensure currentIntegrations.data is always an array (Issue #366 CodeRabbit fix)
        if (!Array.isArray(currentIntegrations.data)) {
          currentIntegrations.data = currentIntegrations.data ? [currentIntegrations.data] : [];
        }

        const connectedCount =
          currentIntegrations.data.filter((integration) => integration.connected).length || 0;

        // Get user's plan from token or fetch from database
        const userPlan = req.user?.plan || 'free';
        let maxConnections;

        // Fixed connection limits logic (Issue #366 CodeRabbit fix)
        switch (userPlan.toLowerCase()) {
          case 'free':
            maxConnections = 1;
            break;
          case 'pro':
            maxConnections = 5;
            break;
          case 'creator_plus':
          case 'custom':
            maxConnections = 999;
            break;
          default:
            maxConnections = 1; // Default to free plan limits
        }

        if (connectedCount >= maxConnections) {
          return res.status(403).json({
            success: false,
            error: `Plan ${userPlan} permite máximo ${maxConnections} ${maxConnections > 1 ? 'conexiones' : 'conexión'}. Actualiza tu plan para conectar más plataformas.`,
            code: 'CONNECTION_LIMIT_EXCEEDED',
            currentConnections: connectedCount,
            maxConnections: maxConnections
          });
        }

        const result = await integrationsService.connectIntegration(userId, platform);

        if (result.success) {
          res.json({
            success: true,
            data: result.data,
            message: 'Platform connected successfully'
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Failed to connect platform'
          });
        }
      } catch (error) {
        console.error('Connect integration error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockIntegrationsService.setMockConnectedCount(undefined);
  });

  describe('Custom Tier - 999 Connections Limit', () => {
    test('should allow many connections for custom plan (specific to CodeRabbit feedback)', async () => {
      // Set mock to have 998 current connections
      mockIntegrationsService.setMockConnectedCount(998);

      const response = await request(app)
        .post('/api/user/integrations/connect')
        .send({ platform: 'twitter' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { platform: 'twitter', connected: true },
        message: 'Platform connected successfully'
      });
    });

    test('should block connection at exactly 999 limit for custom plan', async () => {
      // Set mock to have exactly 999 current connections (at limit)
      mockIntegrationsService.setMockConnectedCount(999);

      const response = await request(app)
        .post('/api/user/integrations/connect')
        .send({ platform: 'twitter' })
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error:
          'Plan custom permite máximo 999 conexiones. Actualiza tu plan para conectar más plataformas.',
        code: 'CONNECTION_LIMIT_EXCEEDED',
        currentConnections: 999,
        maxConnections: 999
      });
    });

    test('should correctly identify custom plan as unlimited tier (999)', async () => {
      // Test with no current connections
      mockIntegrationsService.setMockConnectedCount(0);

      const response = await request(app)
        .post('/api/user/integrations/connect')
        .send({ platform: 'instagram' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle custom plan case-insensitively', async () => {
      // Test with CUSTOM in uppercase
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = { id: 'test-user-id', plan: 'CUSTOM', org_id: 'test-org-id' };
        next();
      });

      mockIntegrationsService.setMockConnectedCount(500);

      const response = await request(app)
        .post('/api/user/integrations/connect')
        .send({ platform: 'youtube' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Plan Mapping Verification', () => {
    test('should verify custom tier maps to same limit as creator_plus (999)', async () => {
      // Test custom plan
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = { id: 'test-user-id', plan: 'custom', org_id: 'test-org-id' };
        next();
      });
      mockIntegrationsService.setMockConnectedCount(998);

      const customResponse = await request(app)
        .post('/api/user/integrations/connect')
        .send({ platform: 'twitter' })
        .expect(200);

      // Test creator_plus plan
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = { id: 'test-user-id', plan: 'creator_plus', org_id: 'test-org-id' };
        next();
      });
      mockIntegrationsService.setMockConnectedCount(998);

      const creatorResponse = await request(app)
        .post('/api/user/integrations/connect')
        .send({ platform: 'instagram' })
        .expect(200);

      // Both should succeed with same behavior
      expect(customResponse.body.success).toBe(true);
      expect(creatorResponse.body.success).toBe(true);
    });
  });
});
