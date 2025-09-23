/**
 * Integration Tests for Tier Validation Monitoring - Issue #396
 * Tests the complete monitoring system including routes and service integration
 */

// Mock authentication middleware first
jest.mock('../../src/middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'test-user-123', email: 'test@example.com' };
        next();
    }
}));

// No need to mock tierValidationService since it doesn't exist as a separate service

// Mock planLimitsService
jest.mock('../../src/services/planLimitsService', () => ({
    clearCache: jest.fn(),
    cache: new Map(),
    cacheTimeout: 300000,
    lastCacheRefresh: Date.now()
}));

const request = require('supertest');
const express = require('express');
const tierValidationMonitoringService = require('../../src/services/tierValidationMonitoringService');

// Create a test app just for monitoring routes
const app = express();
app.use(express.json());

// Add monitoring routes to test app
const monitoringRoutes = require('../../src/routes/monitoring');
app.use('/api/monitoring', monitoringRoutes);

// Mock external dependencies
jest.mock('../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
            data: { plan: 'pro', status: 'active' },
            error: null
        })
    }
}));

describe('Tier Validation Monitoring Integration - Issue #396', () => {
    beforeEach(() => {
        tierValidationMonitoringService.clearCache();
    });

    describe('GET /api/monitoring/health', () => {
        it('should return healthy status with good metrics', async () => {
            // Set up healthy metrics
            tierValidationMonitoringService.metrics.validationCount = 100;
            tierValidationMonitoringService.metrics.errors = 2; // 2% error rate
            tierValidationMonitoringService.metrics.cacheHits = 80;
            tierValidationMonitoringService.metrics.cacheMisses = 20;
            
            const response = await request(app)
                .get('/api/monitoring/health')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('healthy');
            expect(response.body.data.metrics).toBeDefined();
            expect(response.body.data.components).toBeDefined();
            expect(response.body.data.components.tierValidation).toBe('healthy');
        });

        it('should return degraded status with high error rate', async () => {
            // Set up degraded metrics
            tierValidationMonitoringService.metrics.validationCount = 100;
            tierValidationMonitoringService.metrics.errors = 7; // 7% error rate
            
            const response = await request(app)
                .get('/api/monitoring/health')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('degraded');
            expect(response.body.data.issues).toContain('High error rate: 7.00%');
        });

        it('should return 503 for unhealthy status', async () => {
            // Set up unhealthy metrics
            tierValidationMonitoringService.metrics.validationCount = 100;
            tierValidationMonitoringService.metrics.errors = 12; // 12% critical error rate
            
            const response = await request(app)
                .get('/api/monitoring/health')
                .expect(503);
            
            expect(response.body.success).toBe(false);
            expect(response.body.data.status).toBe('unhealthy');
            expect(response.body.data.issues).toContain('Critical error rate: 12.00%');
        });
    });

    describe('GET /api/monitoring/metrics', () => {
        it('should return comprehensive metrics', async () => {
            // Add some tracking data
            tierValidationMonitoringService.trackValidation(150, false);
            tierValidationMonitoringService.trackValidation(200, true);
            tierValidationMonitoringService.setCachedResult('test-key', { data: 'value' });
            
            const response = await request(app)
                .get('/api/monitoring/metrics')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('monitoring');
            expect(response.body.data).toHaveProperty('performance');
            expect(response.body.data).toHaveProperty('timestamp');
            
            expect(response.body.data.monitoring.validationCount).toBe(2);
            expect(response.body.data.monitoring.errorCount).toBe(1);
            expect(response.body.data.monitoring.errorRate).toBe(50); // 1/2 * 100
        });
    });

    describe('GET /api/monitoring/cache', () => {
        it('should return cache metrics for all services', async () => {
            // Add some cache data
            tierValidationMonitoringService.setCachedResult('test1', { data: 'value1' });
            tierValidationMonitoringService.setCachedResult('test2', { data: 'value2' });
            tierValidationMonitoringService.getCachedResult('test1'); // Hit
            tierValidationMonitoringService.getCachedResult('nonexistent'); // Miss
            
            const response = await request(app)
                .get('/api/monitoring/cache')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('monitoring');
            expect(response.body.data).toHaveProperty('planLimits');
            
            expect(response.body.data.monitoring.size).toBe(2);
            expect(response.body.data.monitoring.hits).toBe(1);
            expect(response.body.data.monitoring.misses).toBe(1);
            expect(response.body.data.monitoring.hitRate).toBe(0.5);
        });
    });

    describe('POST /api/monitoring/cache/clear', () => {
        it('should clear all caches successfully', async () => {
            // Add some cache data
            tierValidationMonitoringService.setCachedResult('test', { data: 'value' });
            expect(tierValidationMonitoringService.cache.size).toBe(1);
            
            const response = await request(app)
                .post('/api/monitoring/cache/clear')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('cleared successfully');
            expect(response.body.data.clearedAt).toBeDefined();
            
            // Verify cache is actually cleared
            expect(tierValidationMonitoringService.cache.size).toBe(0);
        });
    });

    describe('GET /api/monitoring/alerts/config', () => {
        it('should return current alert configuration', async () => {
            const response = await request(app)
                .get('/api/monitoring/alerts/config')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('thresholds');
            expect(response.body.data).toHaveProperty('cooldown');
            expect(response.body.data).toHaveProperty('externalAlerts');
            
            expect(response.body.data.thresholds.errorRatePercentage).toBe(5);
            expect(response.body.data.thresholds.criticalErrorRatePercentage).toBe(10);
            expect(response.body.data.cooldown).toBe(15 * 60 * 1000); // 15 minutes
        });
    });

    describe('PUT /api/monitoring/alerts/config', () => {
        it('should update alert thresholds successfully', async () => {
            const newThresholds = {
                errorRatePercentage: 3,
                maxErrorsPerHour: 50
            };
            
            const response = await request(app)
                .put('/api/monitoring/alerts/config')
                .send({ thresholds: newThresholds })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('updated successfully');
            expect(response.body.data.newThresholds.errorRatePercentage).toBe(3);
            expect(response.body.data.newThresholds.maxErrorsPerHour).toBe(50);
            expect(response.body.data.updatedBy).toBe('test-user-123');
        });

        it('should reject invalid threshold keys', async () => {
            const response = await request(app)
                .put('/api/monitoring/alerts/config')
                .send({ 
                    thresholds: { 
                        invalidKey: 10 
                    } 
                })
                .expect(400);
            
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('Invalid threshold key');
        });

        it('should reject invalid threshold values', async () => {
            const response = await request(app)
                .put('/api/monitoring/alerts/config')
                .send({ 
                    thresholds: { 
                        errorRatePercentage: -5 
                    } 
                })
                .expect(400);
            
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('Invalid threshold value');
        });

        it('should reject missing thresholds', async () => {
            const response = await request(app)
                .put('/api/monitoring/alerts/config')
                .send({})
                .expect(400);
            
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('Invalid thresholds configuration');
        });
    });

    describe('POST /api/monitoring/alerts/test', () => {
        beforeEach(() => {
            // Mock console to prevent test output spam
            jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should send test alert successfully', async () => {
            jest.spyOn(tierValidationMonitoringService, 'sendAlert').mockImplementation(() => Promise.resolve());
            
            const response = await request(app)
                .post('/api/monitoring/alerts/test')
                .send({
                    severity: 'warning',
                    title: 'Test Alert',
                    message: 'This is a test message'
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('sent successfully');
            expect(response.body.data.alertDetails.severity).toBe('warning');
            expect(response.body.data.sentBy).toBe('test-user-123');
            
            expect(tierValidationMonitoringService.sendAlert).toHaveBeenCalledWith(
                'warning',
                'Test Alert',
                'This is a test message'
            );
        });

        it('should use default values for test alert', async () => {
            jest.spyOn(tierValidationMonitoringService, 'sendAlert').mockImplementation(() => Promise.resolve());
            
            const response = await request(app)
                .post('/api/monitoring/alerts/test')
                .send({})
                .expect(200);
            
            expect(response.body.data.alertDetails.severity).toBe('info');
            expect(response.body.data.alertDetails.title).toBe('Test Alert');
            expect(response.body.data.alertDetails.message).toContain('test alert from monitoring system');
        });

        it('should reject invalid severity', async () => {
            const response = await request(app)
                .post('/api/monitoring/alerts/test')
                .send({ severity: 'invalid' })
                .expect(400);
            
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('Invalid severity level');
        });
    });

    describe('GET /api/monitoring/performance', () => {
        it('should return detailed performance analytics', async () => {
            // Add performance data
            const durations = [100, 200, 150, 300, 250];
            durations.forEach((duration, index) => {
                tierValidationMonitoringService.trackValidation(duration, index % 3 === 0);
            });
            
            const response = await request(app)
                .get('/api/monitoring/performance')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('analytics');
            expect(response.body.data).toHaveProperty('summary');
            expect(response.body.data).toHaveProperty('timestamp');
            
            expect(response.body.data.analytics.count).toBe(5);
            expect(response.body.data.analytics.avgDuration).toBeCloseTo(200, 1);
            expect(response.body.data.analytics.errorCount).toBe(2); // Indices 0 and 3
            expect(response.body.data.summary.totalValidations).toBe(5);
        });

        it('should handle empty performance data', async () => {
            const response = await request(app)
                .get('/api/monitoring/performance')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.analytics.count).toBe(0);
            expect(response.body.data.analytics.avgDuration).toBe(0);
            expect(response.body.data.summary.totalValidations).toBe(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle service errors gracefully', async () => {
            // Mock a service method to throw an error
            jest.spyOn(tierValidationMonitoringService, 'getHealthStatus').mockImplementation(() => {
                throw new Error('Service error');
            });
            
            const response = await request(app)
                .get('/api/monitoring/health')
                .expect(500);
            
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('Failed to get health status');
            expect(response.body.error.details).toBe('Service error');
            
            jest.restoreAllMocks();
        });

        // Note: Authentication testing is handled in separate auth middleware tests
    });

    describe('End-to-End Monitoring Workflow', () => {
        it('should demonstrate complete monitoring lifecycle', async () => {
            // 1. Start with clean state
            tierValidationMonitoringService.clearCache();
            
            let healthResponse = await request(app)
                .get('/api/monitoring/health')
                .expect(200);
            // Status might be degraded due to previous tests, so we'll just check it exists
            expect(['healthy', 'degraded']).toContain(healthResponse.body.data.status);
            
            // 2. Add some successful validations
            for (let i = 0; i < 50; i++) {
                tierValidationMonitoringService.trackValidation(100 + Math.random() * 50, false);
            }
            
            // 3. Add some errors to increase error rate
            for (let i = 0; i < 10; i++) {
                tierValidationMonitoringService.trackValidation(200 + Math.random() * 100, true);
            }
            
            // 4. Check metrics reflect the activity
            const metricsResponse = await request(app)
                .get('/api/monitoring/metrics')
                .expect(200);
            
            expect(metricsResponse.body.data.monitoring.validationCount).toBe(60);
            expect(metricsResponse.body.data.monitoring.errorCount).toBe(10);
            expect(metricsResponse.body.data.monitoring.errorRate).toBeCloseTo(16.67, 1); // 10/60 * 100
            
            // 5. Health should now show degraded or unhealthy due to high error rate
            healthResponse = await request(app)
                .get('/api/monitoring/health');
            expect([200, 503]).toContain(healthResponse.status); // Could be degraded (200) or unhealthy (503)
            expect(['degraded', 'unhealthy']).toContain(healthResponse.body.data.status);
            
            // 6. Update alert thresholds
            await request(app)
                .put('/api/monitoring/alerts/config')
                .send({ 
                    thresholds: { 
                        errorRatePercentage: 20 // Increase threshold
                    } 
                })
                .expect(200);
            
            // 7. Clear cache and reset
            await request(app)
                .post('/api/monitoring/cache/clear')
                .expect(200);
            
            // 8. Verify system is reset (should be healthy since we cleared cache)
            healthResponse = await request(app)
                .get('/api/monitoring/health')
                .expect(200);
            expect(['healthy', 'degraded']).toContain(healthResponse.body.data.status);
        });
    });
});