/**
 * Unit Tests for TierValidationMonitoringService - Issue #396
 * Tests cache TTL performance monitoring, error alerting, and Sentry integration
 */

const tierValidationMonitoringService = require('../../../src/services/tierValidationMonitoringService');
const { logger } = require('../../../src/utils/logger');

// Mock dependencies
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

describe('TierValidationMonitoringService - Issue #396', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        tierValidationMonitoringService.clearCache();
        
        // Reset alert cooldowns
        tierValidationMonitoringService.lastAlertTime.clear();
    });

    describe('Cache Performance Monitoring', () => {
        it('should track cache hits correctly', () => {
            const key = 'test-key';
            const data = { userId: 'user-123', plan: 'pro' };
            
            // First call should be a miss
            const result1 = tierValidationMonitoringService.getCachedResult(key);
            expect(result1).toBeNull();
            expect(tierValidationMonitoringService.metrics.cacheMisses).toBe(1);
            expect(tierValidationMonitoringService.metrics.cacheHits).toBe(0);
            
            // Set cache
            tierValidationMonitoringService.setCachedResult(key, data);
            
            // Second call should be a hit
            const result2 = tierValidationMonitoringService.getCachedResult(key);
            expect(result2).toEqual(data);
            expect(tierValidationMonitoringService.metrics.cacheHits).toBe(1);
            expect(tierValidationMonitoringService.metrics.cacheMisses).toBe(1);
        });

        it('should handle cache TTL expiration correctly', () => {
            const key = 'test-key';
            const data = { userId: 'user-123', plan: 'pro' };
            
            tierValidationMonitoringService.setCachedResult(key, data);
            
            // Mock cache TTL to be very short
            const originalTTL = tierValidationMonitoringService.cacheTTL;
            tierValidationMonitoringService.cacheTTL = 1; // 1ms
            
            // Wait for TTL to expire
            setTimeout(() => {
                const result = tierValidationMonitoringService.getCachedResult(key);
                expect(result).toBeNull();
                expect(tierValidationMonitoringService.metrics.cacheMisses).toBe(1);
                
                // Restore original TTL
                tierValidationMonitoringService.cacheTTL = originalTTL;
            }, 5);
        });

        it('should calculate cache hit rate correctly', () => {
            const service = tierValidationMonitoringService;
            
            // Start with no cache operations
            expect(service.getCacheHitRate()).toBe(0);
            
            // Add some cache operations
            service.metrics.cacheHits = 8;
            service.metrics.cacheMisses = 2;
            
            expect(service.getCacheHitRate()).toBe(0.8); // 80% hit rate
        });

        it('should provide cache metrics in health status', () => {
            const service = tierValidationMonitoringService;
            service.metrics.cacheHits = 50;
            service.metrics.cacheMisses = 10;
            
            const health = service.getHealthStatus();
            
            expect(health.metrics.cacheHitRate).toBeCloseTo(0.833, 3); // ~83.3%
            expect(health.metrics.cacheSize).toBe(service.cache.size);
        });
    });

    describe('Performance Tracking', () => {
        it('should track validation performance metrics', () => {
            const service = tierValidationMonitoringService;
            
            service.trackValidation(100, false); // 100ms, no error
            service.trackValidation(200, true);  // 200ms, with error
            service.trackValidation(150, false); // 150ms, no error
            
            expect(service.metrics.validationCount).toBe(3);
            expect(service.metrics.errors).toBe(1);
            expect(service.metrics.performanceMetrics).toHaveLength(3);
            
            const avgPerformance = service.getAveragePerformance();
            expect(avgPerformance).toBeCloseTo(150, 1); // Average of 100, 200, 150
        });

        it('should limit performance metrics to prevent memory growth', () => {
            const service = tierValidationMonitoringService;
            
            // Add more than 100 metrics
            for (let i = 0; i < 150; i++) {
                service.trackValidation(i * 10, false);
            }
            
            // Should keep only last 100
            expect(service.metrics.performanceMetrics).toHaveLength(100);
            expect(service.metrics.validationCount).toBe(150);
        });

        it('should provide detailed performance analytics', () => {
            const service = tierValidationMonitoringService;
            
            // Add varied performance data
            const durations = [100, 200, 150, 300, 250, 180, 120, 400, 90, 160];
            durations.forEach((duration, index) => {
                service.trackValidation(duration, index % 4 === 0); // Every 4th is an error
            });
            
            const analytics = service.getPerformanceAnalytics();
            
            expect(analytics.count).toBe(10);
            expect(analytics.avgDuration).toBeCloseTo(195, 1);
            expect(analytics.minDuration).toBe(90);
            expect(analytics.maxDuration).toBe(400);
            expect(analytics.errorCount).toBe(3); // Indices 0, 4, 8
            expect(analytics.p95Duration).toBeGreaterThan(0);
        });
    });

    describe('Error Alerting', () => {
        beforeEach(() => {
            // Mock console methods to prevent spam in tests
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should calculate error rate correctly', () => {
            const service = tierValidationMonitoringService;
            
            service.metrics.validationCount = 100;
            service.metrics.errors = 5;
            
            expect(service.calculateErrorRate()).toBe(5); // 5%
        });

        it('should send alert when error rate exceeds threshold', () => {
            const service = tierValidationMonitoringService;
            jest.spyOn(service, 'sendAlert').mockImplementation(() => {});
            
            // Set up scenario with high error rate
            service.metrics.validationCount = 100;
            service.metrics.errors = 6; // 6% error rate
            
            service.checkAlertThresholds();
            
            expect(service.sendAlert).toHaveBeenCalledWith(
                'warning',
                'Tier Validation Error Rate High',
                expect.stringContaining('Error rate: 6.00%')
            );
        });

        it('should send critical alert when error rate exceeds critical threshold', () => {
            const service = tierValidationMonitoringService;
            jest.spyOn(service, 'sendAlert').mockImplementation(() => {});
            
            // Set up scenario with critical error rate
            service.metrics.validationCount = 100;
            service.metrics.errors = 11; // 11% error rate
            
            service.checkAlertThresholds();
            
            expect(service.sendAlert).toHaveBeenCalledWith(
                'critical',
                'Tier Validation Error Rate Critical',
                expect.stringContaining('Error rate: 11.00%')
            );
        });

        it('should respect alert cooldown period', async () => {
            const service = tierValidationMonitoringService;
            jest.spyOn(service, 'sendExternalAlert').mockImplementation(() => Promise.resolve());
            
            const alertKey = 'warning-Test Alert';
            
            // Send first alert
            await service.sendAlert('warning', 'Test Alert', 'Test message');
            expect(service.lastAlertTime.has(alertKey)).toBe(true);
            
            // Try to send same alert immediately - should be blocked by cooldown
            const loggerWarnSpy = jest.spyOn(logger, 'warn');
            await service.sendAlert('warning', 'Test Alert', 'Test message');
            
            // Should only have been called once due to cooldown
            expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
        });

        it('should track errors in last hour correctly', () => {
            const service = tierValidationMonitoringService;
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000);
            
            // Add some metrics with timestamps
            service.metrics.performanceMetrics = [
                { duration: 100, timestamp: oneHourAgo - 1000, error: true },  // >1 hour ago
                { duration: 200, timestamp: now - 1000, error: true },        // Recent error
                { duration: 150, timestamp: now - 2000, error: false },       // Recent success
                { duration: 300, timestamp: now - 3000, error: true }         // Recent error
            ];
            
            expect(service.getErrorsInLastHour()).toBe(2);
        });
    });

    describe('Health Status', () => {
        it('should return healthy status with good metrics', () => {
            const service = tierValidationMonitoringService;
            
            // Set up good metrics
            service.metrics.validationCount = 100;
            service.metrics.errors = 2; // 2% error rate
            service.metrics.cacheHits = 80;
            service.metrics.cacheMisses = 20; // 80% hit rate
            service.metrics.performanceMetrics = [
                { duration: 100, timestamp: Date.now(), error: false },
                { duration: 150, timestamp: Date.now(), error: false }
            ];
            
            const health = service.getHealthStatus();
            
            expect(health.status).toBe('healthy');
            expect(health.issues).toBeNull();
            expect(health.metrics.errorRate).toBe(2);
            expect(health.metrics.cacheHitRate).toBe(0.8);
        });

        it('should return degraded status with high error rate', () => {
            const service = tierValidationMonitoringService;
            
            // Set up degraded metrics
            service.metrics.validationCount = 100;
            service.metrics.errors = 7; // 7% error rate (above 5% threshold)
            service.metrics.cacheHits = 80;
            service.metrics.cacheMisses = 20;
            
            const health = service.getHealthStatus();
            
            expect(health.status).toBe('degraded');
            expect(health.issues).toContain('High error rate: 7.00%');
        });

        it('should return unhealthy status with critical error rate', () => {
            const service = tierValidationMonitoringService;
            
            // Set up unhealthy metrics
            service.metrics.validationCount = 100;
            service.metrics.errors = 12; // 12% error rate (above 10% critical threshold)
            service.metrics.cacheHits = 40;
            service.metrics.cacheMisses = 60; // 40% hit rate
            
            const health = service.getHealthStatus();
            
            expect(health.status).toBe('unhealthy');
            expect(health.issues).toContain('Critical error rate: 12.00%');
            expect(health.issues).toContain('Low cache hit rate: 40.00%');
        });

        it('should detect slow performance', () => {
            const service = tierValidationMonitoringService;
            
            // Set up slow performance metrics
            service.metrics.performanceMetrics = [
                { duration: 1500, timestamp: Date.now(), error: false }, // >1 second
                { duration: 2000, timestamp: Date.now(), error: false }  // >1 second
            ];
            
            const health = service.getHealthStatus();
            
            expect(health.status).toBe('degraded');
            expect(health.issues).toContain('Slow performance: 1750.00ms avg');
        });
    });

    describe('Configuration and Management', () => {
        it('should update alert thresholds correctly', () => {
            const service = tierValidationMonitoringService;
            const originalThresholds = { ...service.alertThresholds };
            
            const newThresholds = {
                errorRatePercentage: 3,
                maxErrorsPerHour: 50
            };
            
            service.updateAlertThresholds(newThresholds);
            
            expect(service.alertThresholds.errorRatePercentage).toBe(3);
            expect(service.alertThresholds.maxErrorsPerHour).toBe(50);
            // Other thresholds should remain unchanged
            expect(service.alertThresholds.criticalErrorRatePercentage).toBe(originalThresholds.criticalErrorRatePercentage);
        });

        it('should clear cache and reset metrics correctly', () => {
            const service = tierValidationMonitoringService;
            
            // Add some data
            service.setCachedResult('test', { data: 'value' });
            service.trackValidation(100, false);
            service.lastAlertTime.set('test-alert', Date.now());
            
            expect(service.cache.size).toBeGreaterThan(0);
            expect(service.metrics.validationCount).toBeGreaterThan(0);
            expect(service.lastAlertTime.size).toBeGreaterThan(0);
            
            service.clearCache();
            
            expect(service.cache.size).toBe(0);
            expect(service.metrics.validationCount).toBe(0);
            expect(service.metrics.errors).toBe(0);
            expect(service.lastAlertTime.size).toBe(0);
        });

        it('should provide comprehensive health metrics', () => {
            const service = tierValidationMonitoringService;
            
            service.metrics.validationCount = 50;
            service.metrics.errors = 3;
            service.metrics.cacheHits = 40;
            service.metrics.cacheMisses = 10;
            service.setCachedResult('test1', { data: 'value1' });
            service.setCachedResult('test2', { data: 'value2' });
            
            const metrics = service.getHealthMetrics();
            
            expect(metrics).toEqual({
                validationCount: 50,
                errorCount: 3,
                errorRate: 6, // 3/50 * 100
                cacheHitRate: 0.8, // 40/(40+10)
                averagePerformance: 0, // No performance metrics added
                cacheSize: 2,
                errorsInLastHour: 0 // No recent errors
            });
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle empty performance metrics gracefully', () => {
            const service = tierValidationMonitoringService;
            
            const analytics = service.getPerformanceAnalytics();
            
            expect(analytics).toEqual({
                count: 0,
                avgDuration: 0,
                minDuration: 0,
                maxDuration: 0,
                p95Duration: 0,
                errorCount: 0
            });
            
            expect(service.getAveragePerformance()).toBe(0);
        });

        it('should handle zero validation count for error rate', () => {
            const service = tierValidationMonitoringService;
            
            expect(service.calculateErrorRate()).toBe(0);
        });

        it('should handle external alert failures gracefully', async () => {
            const service = tierValidationMonitoringService;
            
            // Mock external alert methods to throw errors
            jest.spyOn(service, 'sendWebhookAlert').mockRejectedValue(new Error('Network error'));
            jest.spyOn(service, 'sendSlackAlert').mockRejectedValue(new Error('API error'));
            
            // Should not throw error even if external alerts fail
            await expect(service.sendExternalAlert({
                severity: 'warning',
                title: 'Test Alert',
                message: 'Test message'
            })).resolves.not.toThrow();
        });
    });
});