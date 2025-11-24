/**
 * Tests for Monitoring Routes - Issue #932
 *
 * Provides test coverage for:
 * - GET /api/monitoring/health
 * - GET /api/monitoring/metrics
 * - GET /api/monitoring/cache
 * - POST /api/monitoring/cache/clear
 * - GET /api/monitoring/alerts/config
 * - PUT /api/monitoring/alerts/config
 * - POST /api/monitoring/alerts/test
 * - GET /api/monitoring/performance
 */

const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls
// ============================================================================

const mockSupabase = createSupabaseMock({
  users: [],
  organizations: []
});

// Mock tier validation monitoring service
const mockTierValidationMonitoringService = {
  getHealthStatus: jest.fn(() => ({
    status: 'healthy',
    lastCheck: new Date().toISOString(),
    uptimeSeconds: 3600,
    validationCount: 100,
    errorCount: 2
  })),
  getHealthMetrics: jest.fn(() => ({
    validationCount: 100,
    errorCount: 2,
    errorRate: 0.02,
    cacheHitRate: 0.85,
    averagePerformance: 15
  })),
  getPerformanceAnalytics: jest.fn(() => ({
    averageResponseTime: 15,
    p95ResponseTime: 45,
    p99ResponseTime: 100,
    throughput: 500
  })),
  cache: {
    size: 50
  },
  getCacheHitRate: jest.fn(() => 0.85),
  metrics: {
    cacheHits: 85,
    cacheMisses: 15
  },
  cacheTTL: 300000,
  alertThresholds: {
    errorRatePercentage: 5,
    criticalErrorRatePercentage: 10,
    maxErrorsPerHour: 100,
    maxValidationsPerMinute: 1000
  },
  alertCooldown: 300000,
  externalAlerts: {
    webhookUrl: 'https://webhook.example.com',
    slackWebhook: null
  },
  clearCache: jest.fn(),
  updateAlertThresholds: jest.fn(),
  sendAlert: jest.fn(() => Promise.resolve())
};

// Mock plan limits service
const mockPlanLimitsService = {
  getPlanLimits: jest.fn(() =>
    Promise.resolve({
      maxRoasts: 100,
      maxPlatforms: 3
    })
  ),
  cache: {
    size: 10
  },
  cacheTimeout: 300000,
  lastCacheRefresh: Date.now() - 60000,
  clearCache: jest.fn()
};

// Mock supabase
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

// Track if current request should be admin
let mockIsAdmin = false;

// Mock authentication middleware
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      id: mockIsAdmin ? 'admin-123' : 'user-123',
      email: mockIsAdmin ? 'admin@example.com' : 'test@example.com',
      is_admin: mockIsAdmin
    };
    next();
  },
  requireAdmin: (req, res, next) => {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    next();
  }
}));

// Mock tier validation monitoring service
jest.mock('../../../src/services/tierValidationMonitoringService', () => mockTierValidationMonitoringService);

// Mock plan limits service
jest.mock('../../../src/services/planLimitsService', () => mockPlanLimitsService);

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
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

// ============================================================================
// STEP 2: Require modules AFTER mocks are configured
// ============================================================================

const request = require('supertest');
const express = require('express');
const monitoringRoutes = require('../../../src/routes/monitoring');

describe('Monitoring Routes - Issue #932', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/monitoring', monitoringRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to non-admin by default
    mockIsAdmin = false;
  });

  // ==========================================================================
  // GET /api/monitoring/health
  // ==========================================================================
  describe('GET /api/monitoring/health', () => {
    test('should return health status successfully', async () => {
      const response = await request(app).get('/api/monitoring/health').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('components');
      expect(response.body.data.components).toHaveProperty('tierValidation', 'healthy');
      expect(response.body.data.components).toHaveProperty('planLimits');
      expect(mockTierValidationMonitoringService.getHealthStatus).toHaveBeenCalled();
    });

    test('should return degraded status with 200', async () => {
      mockTierValidationMonitoringService.getHealthStatus.mockReturnValueOnce({
        status: 'degraded',
        lastCheck: new Date().toISOString(),
        uptimeSeconds: 3600
      });

      const response = await request(app).get('/api/monitoring/health').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('degraded');
    });

    test('should return unhealthy status with 503', async () => {
      mockTierValidationMonitoringService.getHealthStatus.mockReturnValueOnce({
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        uptimeSeconds: 0
      });

      const response = await request(app).get('/api/monitoring/health').expect(503);

      expect(response.body.success).toBe(false);
    });

    test('should handle error gracefully', async () => {
      mockTierValidationMonitoringService.getHealthStatus.mockImplementationOnce(() => {
        throw new Error('Service unavailable');
      });

      const response = await request(app).get('/api/monitoring/health').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to get health status');
    });
  });

  // ==========================================================================
  // GET /api/monitoring/metrics
  // ==========================================================================
  describe('GET /api/monitoring/metrics', () => {
    test('should return metrics successfully', async () => {
      const response = await request(app).get('/api/monitoring/metrics').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('monitoring');
      expect(response.body.data).toHaveProperty('performance');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(mockTierValidationMonitoringService.getHealthMetrics).toHaveBeenCalled();
      expect(mockTierValidationMonitoringService.getPerformanceAnalytics).toHaveBeenCalled();
    });

    test('should handle error gracefully', async () => {
      mockTierValidationMonitoringService.getHealthMetrics.mockImplementationOnce(() => {
        throw new Error('Metrics unavailable');
      });

      const response = await request(app).get('/api/monitoring/metrics').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to get metrics');
    });
  });

  // ==========================================================================
  // GET /api/monitoring/cache
  // ==========================================================================
  describe('GET /api/monitoring/cache', () => {
    test('should return cache metrics successfully', async () => {
      const response = await request(app).get('/api/monitoring/cache').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('monitoring');
      expect(response.body.data).toHaveProperty('planLimits');
      expect(response.body.data.monitoring).toHaveProperty('size', 50);
      expect(response.body.data.monitoring).toHaveProperty('hitRate', 0.85);
      expect(response.body.data.monitoring).toHaveProperty('hits', 85);
      expect(response.body.data.monitoring).toHaveProperty('misses', 15);
    });

    test('should handle error gracefully', async () => {
      // Temporarily break the mock
      const originalCache = mockTierValidationMonitoringService.cache;
      mockTierValidationMonitoringService.cache = undefined;

      const response = await request(app).get('/api/monitoring/cache').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to get cache metrics');

      // Restore
      mockTierValidationMonitoringService.cache = originalCache;
    });
  });

  // ==========================================================================
  // POST /api/monitoring/cache/clear
  // ==========================================================================
  describe('POST /api/monitoring/cache/clear', () => {
    test('should deny non-admin users', async () => {
      const response = await request(app).post('/api/monitoring/cache/clear').expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });

    test('should clear caches for admin users', async () => {
      mockIsAdmin = true;
      const response = await request(app).post('/api/monitoring/cache/clear').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('All caches cleared successfully');
      expect(mockTierValidationMonitoringService.clearCache).toHaveBeenCalled();
      expect(mockPlanLimitsService.clearCache).toHaveBeenCalled();
    });

    test('should handle error gracefully', async () => {
      mockIsAdmin = true;
      mockTierValidationMonitoringService.clearCache.mockImplementationOnce(() => {
        throw new Error('Cache clear failed');
      });

      const response = await request(app).post('/api/monitoring/cache/clear').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to clear caches');
    });
  });

  // ==========================================================================
  // GET /api/monitoring/alerts/config
  // ==========================================================================
  describe('GET /api/monitoring/alerts/config', () => {
    test('should return alert configuration successfully', async () => {
      const response = await request(app).get('/api/monitoring/alerts/config').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('thresholds');
      expect(response.body.data).toHaveProperty('cooldown');
      expect(response.body.data).toHaveProperty('externalAlerts');
      expect(response.body.data.thresholds).toHaveProperty('errorRatePercentage', 5);
      expect(response.body.data.externalAlerts.webhookConfigured).toBe(true);
      expect(response.body.data.externalAlerts.slackConfigured).toBe(false);
    });

    test('should handle undefined thresholds gracefully', async () => {
      const originalThresholds = mockTierValidationMonitoringService.alertThresholds;
      mockTierValidationMonitoringService.alertThresholds = undefined;

      // The endpoint returns undefined thresholds without crashing
      const response = await request(app).get('/api/monitoring/alerts/config').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.thresholds).toBeUndefined();

      mockTierValidationMonitoringService.alertThresholds = originalThresholds;
    });
  });

  // ==========================================================================
  // PUT /api/monitoring/alerts/config
  // ==========================================================================
  describe('PUT /api/monitoring/alerts/config', () => {
    test('should deny non-admin users', async () => {
      const response = await request(app)
        .put('/api/monitoring/alerts/config')
        .send({ thresholds: { errorRatePercentage: 10 } })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });

    test('should update alert thresholds for admin users', async () => {
      mockIsAdmin = true;
      const newThresholds = {
        errorRatePercentage: 10,
        maxErrorsPerHour: 200
      };

      const response = await request(app)
        .put('/api/monitoring/alerts/config')
        .send({ thresholds: newThresholds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Alert thresholds updated successfully');
      expect(mockTierValidationMonitoringService.updateAlertThresholds).toHaveBeenCalledWith(
        newThresholds
      );
    });

    test('should reject invalid thresholds object', async () => {
      mockIsAdmin = true;
      const response = await request(app)
        .put('/api/monitoring/alerts/config')
        .send({ thresholds: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid thresholds configuration');
    });

    test('should reject missing thresholds', async () => {
      mockIsAdmin = true;
      const response = await request(app).put('/api/monitoring/alerts/config').send({}).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid thresholds configuration');
    });

    test('should reject invalid threshold keys', async () => {
      mockIsAdmin = true;
      const response = await request(app)
        .put('/api/monitoring/alerts/config')
        .send({ thresholds: { invalidKey: 10 } })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid threshold key');
    });

    test('should reject negative threshold values', async () => {
      mockIsAdmin = true;
      const response = await request(app)
        .put('/api/monitoring/alerts/config')
        .send({ thresholds: { errorRatePercentage: -5 } })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid threshold value');
    });

    test('should reject non-numeric threshold values', async () => {
      mockIsAdmin = true;
      const response = await request(app)
        .put('/api/monitoring/alerts/config')
        .send({ thresholds: { errorRatePercentage: 'high' } })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid threshold value');
    });

    test('should handle error gracefully', async () => {
      mockIsAdmin = true;
      mockTierValidationMonitoringService.updateAlertThresholds.mockImplementationOnce(() => {
        throw new Error('Update failed');
      });

      const response = await request(app)
        .put('/api/monitoring/alerts/config')
        .send({ thresholds: { errorRatePercentage: 10 } })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to update alert configuration');
    });
  });

  // ==========================================================================
  // POST /api/monitoring/alerts/test
  // ==========================================================================
  describe('POST /api/monitoring/alerts/test', () => {
    beforeEach(() => {
      // Ensure sendAlert mock is reset and returns resolved promise by default
      mockTierValidationMonitoringService.sendAlert.mockReset();
      mockTierValidationMonitoringService.sendAlert.mockResolvedValue(undefined);
    });

    test('should deny non-admin users', async () => {
      const response = await request(app).post('/api/monitoring/alerts/test').expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });

    test('should send test alert with custom values', async () => {
      mockIsAdmin = true;
      const alertData = {
        severity: 'warning',
        title: 'Custom Test Alert',
        message: 'This is a custom test alert'
      };

      const response = await request(app)
        .post('/api/monitoring/alerts/test')
        .send(alertData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alertDetails.severity).toBe('warning');
      expect(response.body.data.alertDetails.title).toBe('Custom Test Alert');
      expect(mockTierValidationMonitoringService.sendAlert).toHaveBeenCalledWith(
        'warning',
        'Custom Test Alert',
        'This is a custom test alert'
      );
    });

    test('should send test alert with default values', async () => {
      mockIsAdmin = true;

      // Send empty body to trigger default values (without body, req.body is undefined)
      const response = await request(app)
        .post('/api/monitoring/alerts/test')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Test alert sent successfully');
      expect(response.body.data.alertDetails.severity).toBe('info');
      expect(response.body.data.alertDetails.title).toBe('Test Alert');
      expect(mockTierValidationMonitoringService.sendAlert).toHaveBeenCalledWith(
        'info',
        'Test Alert',
        'This is a test alert from monitoring system'
      );
    });

    test('should reject invalid severity', async () => {
      mockIsAdmin = true;
      const response = await request(app)
        .post('/api/monitoring/alerts/test')
        .send({ severity: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid severity level');
    });

    test('should handle error gracefully', async () => {
      mockIsAdmin = true;
      mockTierValidationMonitoringService.sendAlert.mockRejectedValueOnce(
        new Error('Alert send failed')
      );

      const response = await request(app).post('/api/monitoring/alerts/test').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to send test alert');
    });
  });

  // ==========================================================================
  // GET /api/monitoring/performance
  // ==========================================================================
  describe('GET /api/monitoring/performance', () => {
    test('should return performance analytics successfully', async () => {
      const response = await request(app).get('/api/monitoring/performance').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('analytics');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data.summary).toHaveProperty('totalValidations');
      expect(response.body.data.summary).toHaveProperty('errorRate');
      expect(response.body.data.summary).toHaveProperty('cacheHitRate');
    });

    test('should handle error gracefully', async () => {
      mockTierValidationMonitoringService.getPerformanceAnalytics.mockImplementationOnce(() => {
        throw new Error('Analytics unavailable');
      });

      const response = await request(app).get('/api/monitoring/performance').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to get performance analytics');
    });
  });
});

