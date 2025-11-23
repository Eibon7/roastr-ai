/**
 * Tests unitarios para las rutas de Model Availability (/api/model-availability)
 * Issue #925: Tests para Routes Básicas (0% → 60%+)
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies BEFORE requiring the routes
jest.mock('../../../src/middleware/auth');
jest.mock('../../../src/services/modelAvailabilityService');
jest.mock('../../../src/workers/ModelAvailabilityWorker');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Now require the modules after mocking
const modelAvailabilityRoutes = require('../../../src/routes/modelAvailability');
const { authenticateToken } = require('../../../src/middleware/auth');
const { getModelAvailabilityService } = require('../../../src/services/modelAvailabilityService');
const { getModelAvailabilityWorker } = require('../../../src/workers/ModelAvailabilityWorker');

describe('Model Availability Routes Tests', () => {
  let app;
  let mockUser;
  let mockAdminUser;
  let mockModelService;
  let mockWorker;
  let requireAdmin;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup express app
    app = express();
    app.use(express.json());
    app.use('/api/model-availability', modelAvailabilityRoutes);

    // Mock regular user
    mockUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      isAdmin: false,
      role: 'user'
    };

    // Mock admin user
    mockAdminUser = {
      id: 'admin-user-123',
      email: 'admin@example.com',
      isAdmin: true,
      role: 'admin'
    };

    // Mock authentication middleware (defaults to admin)
    // Note: requireAdmin middleware inside route file checks req.user.isAdmin or req.user.role === 'admin'
    authenticateToken.mockImplementation((req, res, next) => {
      req.user = mockAdminUser; // Admin user with isAdmin: true and role: 'admin'
      next();
    });

    // Mock service
    mockModelService = {
      getAvailabilityStatus: jest.fn().mockResolvedValue({
        gpt5Available: false,
        models: {
          'gpt-5': { available: false },
          'gpt-4o': { available: true },
          'gpt-3.5-turbo': { available: true }
        },
        lastCheck: new Date().toISOString(),
        nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }),
      getModelStats: jest.fn().mockResolvedValue({
        total_requests: 1000,
        usage_last_7_days: {
          'gpt-4o': 500,
          'gpt-3.5-turbo': 500
        }
      }),
      isModelAvailable: jest.fn().mockResolvedValue(true),
      getModelForPlan: jest.fn().mockResolvedValue('gpt-4o'),
      forceRefresh: jest.fn().mockResolvedValue({
        gpt5Available: false,
        models: {}
      })
    };

    getModelAvailabilityService.mockReturnValue(mockModelService);

    // Mock worker
    mockWorker = {
      getStatus: jest.fn().mockReturnValue({
        isRunning: false, // Default to not running so start works
        lastCheck: new Date().toISOString(),
        nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }),
      runManualCheck: jest.fn().mockResolvedValue({
        gpt5Available: false,
        models: {}
      }),
      start: jest.fn(),
      stop: jest.fn()
    };

    getModelAvailabilityWorker.mockReturnValue(mockWorker);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/model-availability/status', () => {
    it('should get model availability status successfully', async () => {
      const response = await request(app)
        .get('/api/model-availability/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('models');
      expect(response.body.data).toHaveProperty('worker');
      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.summary).toHaveProperty('gpt5Available');
      expect(mockModelService.getAvailabilityStatus).toHaveBeenCalled();
      expect(mockWorker.getStatus).toHaveBeenCalled();
      expect(mockModelService.getModelStats).toHaveBeenCalled();
    });

    it('should return 500 if service throws error', async () => {
      mockModelService.getAvailabilityStatus.mockRejectedValueOnce(
        new Error('Failed to get status')
      );

      const response = await request(app)
        .get('/api/model-availability/status')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to get model availability status');
    });

    it('should require admin authentication', async () => {
      // Mock authenticateToken to set non-admin user
      authenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = mockUser; // Non-admin user (isAdmin: false, role: 'user')
        next();
      });

      // The route's requireAdmin middleware should reject non-admin users
      const response = await request(app)
        .get('/api/model-availability/status')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });
  });

  describe('POST /api/model-availability/check', () => {
    it('should run manual check successfully', async () => {
      const response = await request(app)
        .post('/api/model-availability/check')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('checkCompleted', true);
      expect(response.body.data).toHaveProperty('result');
      expect(response.body.data).toHaveProperty('gpt5Available');
      expect(mockWorker.runManualCheck).toHaveBeenCalled();
    });

    it('should return 500 if worker throws error', async () => {
      mockWorker.runManualCheck.mockRejectedValueOnce(
        new Error('Failed to run check')
      );

      const response = await request(app)
        .post('/api/model-availability/check')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to check model availability');
    });

    it('should require admin authentication', async () => {
      authenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = mockUser; // Non-admin user
        next();
      });

      const response = await request(app)
        .post('/api/model-availability/check')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });
  });

  describe('GET /api/model-availability/model/:modelId', () => {
    it('should get model info successfully', async () => {
      const modelId = 'gpt-4o';

      const response = await request(app)
        .get(`/api/model-availability/model/${modelId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('modelId', modelId);
      expect(response.body.data).toHaveProperty('isAvailable');
      expect(response.body.data).toHaveProperty('usage');
      expect(mockModelService.isModelAvailable).toHaveBeenCalledWith(modelId);
      expect(mockModelService.getModelStats).toHaveBeenCalled();
    });

    it('should return 500 if service throws error', async () => {
      mockModelService.isModelAvailable.mockRejectedValueOnce(
        new Error('Failed to check model')
      );

      const modelId = 'gpt-4o';
      const response = await request(app)
        .get(`/api/model-availability/model/${modelId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to get model information');
    });

    it('should require admin authentication', async () => {
      authenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = mockUser; // Non-admin user
        next();
      });

      const modelId = 'gpt-4o';
      const response = await request(app)
        .get(`/api/model-availability/model/${modelId}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });
  });

  describe('GET /api/model-availability/stats', () => {
    it('should get model stats successfully', async () => {
      const response = await request(app)
        .get('/api/model-availability/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total_requests');
      expect(response.body.data).toHaveProperty('usage_last_7_days');
      expect(mockModelService.getModelStats).toHaveBeenCalled();
    });

    it('should return 500 if service throws error', async () => {
      mockModelService.getModelStats.mockRejectedValueOnce(
        new Error('Failed to get stats')
      );

      const response = await request(app)
        .get('/api/model-availability/stats')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to get model statistics');
    });

    it('should require admin authentication', async () => {
      authenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = mockUser; // Non-admin user
        next();
      });

      const response = await request(app)
        .get('/api/model-availability/stats')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });
  });

  describe('GET /api/model-availability/plans', () => {
    it('should get plan model assignments successfully', async () => {
      const response = await request(app)
        .get('/api/model-availability/plans')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('planModels');
      expect(response.body.data).toHaveProperty('explanation');
      expect(response.body.data.planModels).toHaveProperty('starter_trial');
      expect(response.body.data.planModels).toHaveProperty('starter');
      expect(response.body.data.planModels).toHaveProperty('pro');
      expect(response.body.data.planModels).toHaveProperty('plus');
      expect(response.body.data.planModels).toHaveProperty('custom');
      // getModelForPlan should be called for each plan
      expect(mockModelService.getModelForPlan).toHaveBeenCalledTimes(5);
    });

    it('should return 500 if service throws error', async () => {
      mockModelService.getModelForPlan.mockRejectedValueOnce(
        new Error('Failed to get plan model')
      );

      const response = await request(app)
        .get('/api/model-availability/plans')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to get plan model assignments');
    });

    it('should require admin authentication', async () => {
      authenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = mockUser; // Non-admin user
        next();
      });

      const response = await request(app)
        .get('/api/model-availability/plans')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });
  });

  describe('POST /api/model-availability/worker/start', () => {
    it('should start worker successfully', async () => {
      const response = await request(app)
        .post('/api/model-availability/worker/start')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Model availability worker');
      expect(response.body.data).toHaveProperty('isRunning');
      expect(mockWorker.start).toHaveBeenCalled();
    });

    it('should return success if worker already running', async () => {
      mockWorker.getStatus.mockReturnValueOnce({
        isRunning: true
      });

      const response = await request(app)
        .post('/api/model-availability/worker/start')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('already running');
    });

    it('should return 500 if worker throws error', async () => {
      mockWorker.getStatus.mockImplementationOnce(() => {
        throw new Error('Failed to get status');
      });

      const response = await request(app)
        .post('/api/model-availability/worker/start')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to start worker');
    });

    it('should require admin authentication', async () => {
      authenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = mockUser; // Non-admin user
        next();
      });

      const response = await request(app)
        .post('/api/model-availability/worker/start')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });
  });

  describe('POST /api/model-availability/worker/stop', () => {
    it('should stop worker successfully', async () => {
      const response = await request(app)
        .post('/api/model-availability/worker/stop')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Model availability worker stopped');
      expect(response.body.data).toHaveProperty('isRunning');
      expect(mockWorker.stop).toHaveBeenCalled();
    });

    it('should return 500 if worker throws error', async () => {
      mockWorker.stop.mockImplementationOnce(() => {
        throw new Error('Failed to stop');
      });

      const response = await request(app)
        .post('/api/model-availability/worker/stop')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to stop worker');
    });

    it('should require admin authentication', async () => {
      authenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = mockUser; // Non-admin user
        next();
      });

      const response = await request(app)
        .post('/api/model-availability/worker/stop')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
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
      
      // Mock authenticateToken to allow access (since we just want to verify it's called)
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = mockAdminUser;
        next();
      });
      
      await request(app)
        .get('/api/model-availability/status');

      // Verify authenticateToken was called
      expect(authenticateToken).toHaveBeenCalled();
    });
  });
});

