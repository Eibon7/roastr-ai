/**
 * Credits API Integration Tests
 * 
 * Tests the complete credits API endpoints including:
 * - Authentication and authorization
 * - Credit status retrieval
 * - Consumption history
 * - Error handling and edge cases
 */

const request = require('supertest');
const express = require('express');
const creditsRoutes = require('../../src/routes/credits');
const { authenticateToken } = require('../../src/middleware/auth');
const creditsService = require('../../src/services/creditsService');

// Mock dependencies
jest.mock('../../src/middleware/auth');
jest.mock('../../src/services/creditsService');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

const app = express();
app.use(express.json());
app.use('/api/user/credits', creditsRoutes);

describe('Credits API Integration', () => {
  const mockUser = {
    id: 'test-user-123',
    email: 'test@example.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock authentication middleware
    authenticateToken.mockImplementation((req, res, next) => {
      req.user = mockUser;
      next();
    });
  });

  describe('GET /api/user/credits/status', () => {
    it('should return credit status successfully', async () => {
      const mockStatus = {
        period_start: '2024-01-01T00:00:00Z',
        period_end: '2024-02-01T00:00:00Z',
        analysis: {
          used: 150,
          limit: 10000,
          remaining: 9850
        },
        roast: {
          used: 25,
          limit: 1000,
          remaining: 975
        },
        creditsV2Enabled: true,
        lastUpdated: '2024-01-15T10:00:00Z'
      };

      creditsService.getCreditStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/user/credits/status')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockStatus
      });

      expect(creditsService.getCreditStatus).toHaveBeenCalledWith(mockUser.id);
    });

    it('should handle service errors', async () => {
      creditsService.getCreditStatus.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/user/credits/status')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to retrieve credit status',
        code: 'CREDIT_STATUS_ERROR'
      });
    });

    it('should require authentication', async () => {
      authenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      await request(app)
        .get('/api/user/credits/status')
        .expect(401);
    });
  });

  describe('GET /api/user/credits/history', () => {
    it('should return consumption history with default parameters', async () => {
      const mockHistory = [
        {
          id: 1,
          credit_type: 'analysis',
          amount_consumed: 1,
          action_type: 'gatekeeper_check',
          platform: 'twitter',
          consumed_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 2,
          credit_type: 'roast',
          amount_consumed: 1,
          action_type: 'roast_generation',
          platform: 'twitter',
          consumed_at: '2024-01-15T09:30:00Z'
        }
      ];

      creditsService.getConsumptionHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/user/credits/history')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          history: mockHistory,
          pagination: {
            limit: 50,
            offset: 0,
            hasMore: false
          }
        }
      });

      expect(creditsService.getConsumptionHistory).toHaveBeenCalledWith(mockUser.id, {
        creditType: undefined,
        limit: 50,
        offset: 0,
        startDate: undefined,
        endDate: undefined
      });
    });

    it('should handle query parameters correctly', async () => {
      creditsService.getConsumptionHistory.mockResolvedValue([]);

      await request(app)
        .get('/api/user/credits/history')
        .query({
          creditType: 'analysis',
          limit: 25,
          offset: 10,
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-31T23:59:59Z'
        })
        .expect(200);

      expect(creditsService.getConsumptionHistory).toHaveBeenCalledWith(mockUser.id, {
        creditType: 'analysis',
        limit: 25,
        offset: 10,
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z'
      });
    });

    it('should validate credit type parameter', async () => {
      const response = await request(app)
        .get('/api/user/credits/history')
        .query({ creditType: 'invalid' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credit type. Must be "analysis" or "roast"',
        code: 'INVALID_CREDIT_TYPE'
      });
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/user/credits/history')
        .query({ limit: 150 })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Limit cannot exceed 100',
        code: 'LIMIT_TOO_HIGH'
      });
    });
  });

  describe('POST /api/user/credits/check', () => {
    it('should check credit availability successfully', async () => {
      const mockAvailability = {
        canConsume: true,
        remaining: 9850,
        limit: 10000,
        used: 150,
        reason: null,
        periodEnd: '2024-02-01T00:00:00Z'
      };

      creditsService.canConsume.mockResolvedValue(mockAvailability);

      const response = await request(app)
        .post('/api/user/credits/check')
        .send({
          creditType: 'analysis',
          amount: 5
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockAvailability
      });

      expect(creditsService.canConsume).toHaveBeenCalledWith(mockUser.id, 'analysis', 5);
    });

    it('should validate credit type', async () => {
      const response = await request(app)
        .post('/api/user/credits/check')
        .send({
          creditType: 'invalid',
          amount: 1
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid or missing credit type. Must be "analysis" or "roast"',
        code: 'INVALID_CREDIT_TYPE'
      });
    });

    it('should validate amount parameter', async () => {
      const response = await request(app)
        .post('/api/user/credits/check')
        .send({
          creditType: 'analysis',
          amount: -1
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Amount must be a positive integer',
        code: 'INVALID_AMOUNT'
      });
    });

    it('should default amount to 1', async () => {
      creditsService.canConsume.mockResolvedValue({ canConsume: true });

      await request(app)
        .post('/api/user/credits/check')
        .send({ creditType: 'roast' })
        .expect(200);

      expect(creditsService.canConsume).toHaveBeenCalledWith(mockUser.id, 'roast', 1);
    });
  });

  describe('GET /api/user/credits/summary', () => {
    it('should return credit summary with recommendations', async () => {
      const mockStatus = {
        period_start: '2024-01-01T00:00:00Z',
        period_end: '2024-02-01T00:00:00Z',
        analysis: { used: 8500, limit: 10000, remaining: 1500 },
        roast: { used: 850, limit: 1000, remaining: 150 }
      };

      creditsService.getCreditStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/user/credits/summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.currentPeriod).toEqual(mockStatus);
      expect(response.body.data.statistics).toEqual({
        analysisUsagePercentage: 85,
        roastUsagePercentage: 85,
        totalCreditsUsed: 9350,
        totalCreditsLimit: 11000,
        daysRemaining: expect.any(Number)
      });

      // Should have warnings for both credit types
      expect(response.body.data.recommendations.length).toBeGreaterThanOrEqual(2);
      const warnings = response.body.data.recommendations.filter(r => r.type === 'warning');
      expect(warnings).toHaveLength(2);
    });
  });

  describe('GET /api/credits/config', () => {
    it('should return credit system configuration', async () => {
      const response = await request(app)
        .get('/api/credits/config')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('creditsV2Enabled');
      expect(response.body.data).toHaveProperty('creditTypes');
      expect(response.body.data).toHaveProperty('planLimits');
      
      expect(response.body.data.creditTypes).toHaveLength(2);
      expect(response.body.data.creditTypes[0].type).toBe('analysis');
      expect(response.body.data.creditTypes[1].type).toBe('roast');
    });
  });

  describe('Error handling', () => {
    it('should handle missing request body gracefully', async () => {
      const response = await request(app)
        .post('/api/user/credits/check')
        .send({})
        .expect(400);

      expect(response.body.code).toBe('INVALID_CREDIT_TYPE');
    });

    it('should handle service unavailability', async () => {
      creditsService.getCreditStatus.mockRejectedValue(new Error('Database unavailable'));

      const response = await request(app)
        .get('/api/user/credits/status')
        .expect(500);

      expect(response.body.code).toBe('CREDIT_STATUS_ERROR');
    });
  });
});
