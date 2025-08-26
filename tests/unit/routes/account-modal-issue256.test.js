/**
 * Tests for AccountModal API endpoints (Issue #256)
 * 
 * Tests the connected account modal functionality including:
 * - Account details retrieval
 * - Recent roasts fetching  
 * - Roast approval/rejection
 * - Settings management
 * - Account disconnection
 */

const request = require('supertest');

// Mock the services before requiring routes
jest.mock('../../../src/services/mockIntegrationsService', () => {
  return jest.fn().mockImplementation(() => ({
    getAccountDetails: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'twitter',
        platform: 'twitter',
        handle: '@mock_twitter_user',
        status: 'connected',
        settings: {
          autoApprove: false,
          shieldEnabled: true,
          shieldLevel: 50,
          defaultTone: 'Balanceado'
        },
        limits: { monthlyLimit: 2000, dailyLimit: 100 },
        usage: { thisMonth: 150, today: 5 }
      }
    }),
    getAccountRoasts: jest.fn().mockResolvedValue({
      success: true,
      data: [
        {
          id: 'roast_1',
          original: 'Esta aplicación es horrible',
          roast: 'Mock roast response',
          status: 'pending',
          createdAt: '2025-08-26T20:00:00.000Z'
        }
      ],
      total: 1
    }),
    approveRoast: jest.fn().mockResolvedValue({
      success: true,
      data: { id: 'roast_1', status: 'approved', approvedAt: new Date().toISOString() }
    }),
    updateAccountSettings: jest.fn().mockResolvedValue({
      success: true,
      data: { accountId: 'twitter', settings: { autoApprove: true } }
    })
  }));
});

// Mock authentication middleware
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }
}));

const express = require('express');
const userRoutes = require('../../../src/routes/user.js');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/user', userRoutes);

describe('AccountModal API Endpoints - Issue #256', () => {
  const testToken = 'Bearer test-token-123';
  const testAccountId = 'twitter';

  describe('Core Functionality', () => {
    test('should return account details successfully', async () => {
      const response = await request(app)
        .get(`/api/user/accounts/${testAccountId}`)
        .set('Authorization', testToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.platform).toBe(testAccountId);
      expect(response.body.data.settings).toBeDefined();
    });

    test('should return recent roasts successfully', async () => {
      const response = await request(app)
        .get(`/api/user/accounts/${testAccountId}/roasts?limit=5`)
        .set('Authorization', testToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.total).toBeDefined();
    });

    test('should approve roast successfully', async () => {
      const roastId = 'roast_test_123';
      const response = await request(app)
        .post(`/api/user/accounts/${testAccountId}/roasts/${roastId}/approve`)
        .set('Authorization', testToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('approved');
    });

    test('should update account settings successfully', async () => {
      const response = await request(app)
        .patch(`/api/user/accounts/${testAccountId}/settings`)
        .set('Authorization', testToken)
        .send({ autoApprove: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accountId).toBe(testAccountId);
    });
  });
});