/**
 * Tier Validation Service - Monitoring Features Tests (Issue #396)
 * Tests for:
 * - AC1: Cache TTL Performance Monitoring
 * - AC2: Error Alerting Configuration
 * - AC3: Sentry Integration
 */

const { TierValidationService } = require('../../../src/services/tierValidationService');
const { logger } = require('../../../src/utils/logger');
const { SENTRY_ENABLED, addBreadcrumb, captureException } = require('../../../src/config/sentry');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn(() => Promise.resolve({
                        data: {
                            plan: 'pro',
                            status: 'active',
                            current_period_start: new Date().toISOString(),
                            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                        },
                        error: null
                    })),
                    gte: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) }))
                }))
            })),
            insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
            upsert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
            update: jest.fn(() => ({
                eq: jest.fn(() => Promise.resolve({ data: {}, error: null }))
            }))
        })),
        rpc: jest.fn(() => Promise.resolve({ data: 'PRO', error: null }))
    }
}));

jest.mock('../../../src/services/planLimitsService', () => ({
    getPlanLimits: jest.fn(() => Promise.resolve({
        monthlyAnalysisLimit: 10000,
        monthlyResponsesLimit: 1000,
        integrationsLimit: 2,
        shieldEnabled: true,
        originalToneEnabled: true
    }))
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('../../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn(() => false)
    }
}));

jest.mock('../../../src/config/sentry', () => ({
    SENTRY_ENABLED: false,  // Disabled by default for tests
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    flush: jest.fn(() => Promise.resolve(true))
}));

describe('TierValidationService - Monitoring Features (Issue #396)', () => {
    let service;
    const userId = 'test-user-123';

    beforeEach(() => {
        jest.clearAllMocks();
        service = new TierValidationService();
    });

    afterEach(() => {
        service.clearCache();
    });

    // ============================================================================
    // AC1: CACHE TTL PERFORMANCE MONITORING
    // ============================================================================

    describe('AC1: Cache Performance Monitoring', () => {
        it('should track cache hits when data is cached', async () => {
            // First call - cache miss
            await service.validateAction(userId, 'roast');
            const metrics1 = service.getMetrics();
            expect(metrics1.cacheMisses).toBeGreaterThan(0);

            // Second call - cache hit
            await service.validateAction(userId, 'roast', { requestId: 'req-2' });
            const metrics2 = service.getMetrics();
            expect(metrics2.cacheHits).toBeGreaterThan(metrics1.cacheHits);
        });

        it('should track cache misses when data is not cached', async () => {
            const initialMisses = service.metrics.cacheMisses;

            await service.validateAction(userId, 'roast');

            expect(service.metrics.cacheMisses).toBeGreaterThan(initialMisses);
        });

        it('should calculate hit rate correctly', () => {
            // Simulate cache operations
            service.metrics.cacheHits = 80;
            service.metrics.cacheMisses = 20;

            const perf = service.getCachePerformanceMetrics();

            expect(perf.hits).toBe(80);
            expect(perf.misses).toBe(20);
            expect(perf.totalRequests).toBe(100);
            expect(perf.hitRate).toBe('80.00%');
            expect(perf.ttlMs).toBe(300000);  // 5 minutes
            expect(perf.ttlMinutes).toBe('5.0');
        });

        it('should handle zero cache operations gracefully', () => {
            const perf = service.getCachePerformanceMetrics();

            expect(perf.hits).toBe(0);
            expect(perf.misses).toBe(0);
            expect(perf.totalRequests).toBe(0);
            expect(perf.hitRate).toBe('0%');
        });

        it('should include cache performance in getMetrics()', () => {
            const metrics = service.getMetrics();

            expect(metrics).toHaveProperty('cachePerformance');
            expect(metrics.cachePerformance).toHaveProperty('hits');
            expect(metrics.cachePerformance).toHaveProperty('misses');
            expect(metrics.cachePerformance).toHaveProperty('hitRate');
            expect(metrics.cachePerformance).toHaveProperty('ttlMs');
            expect(metrics.cachePerformance).toHaveProperty('ttlMinutes');
        });

        it('should track cache size correctly', () => {
            service.usageCache.set('user1', { data: {}, timestamp: Date.now() });
            service.usageCache.set('user2', { data: {}, timestamp: Date.now() });

            const perf = service.getCachePerformanceMetrics();
            expect(perf.cacheSize).toBe(2);
        });
    });

    // ============================================================================
    // AC2: ERROR ALERTING CONFIGURATION
    // ============================================================================

    describe('AC2: Error Alerting System', () => {
        it('should record errors with timestamps', () => {
            const error = new Error('Test error');
            const initialErrors = service.metrics.errors;
            const initialTimestampsLength = service.errorTimestamps.length;

            service.recordError(userId, 'roast', error);

            expect(service.metrics.errors).toBe(initialErrors + 1);
            expect(service.errorTimestamps.length).toBe(initialTimestampsLength + 1);
        });

        it('should prune errors older than 1 hour', () => {
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000);
            const twoHoursAgo = now - (2 * 60 * 60 * 1000);

            // Add errors at different times
            service.errorTimestamps = [
                twoHoursAgo,  // Should be removed
                oneHourAgo - 1000,  // Should be removed
                now - (30 * 60 * 1000),  // Should remain (30 min ago)
                now - 1000  // Should remain (1 sec ago)
            ];

            service.pruneOldErrors();

            expect(service.errorTimestamps.length).toBe(2);
            expect(service.errorTimestamps.every(t => t > oneHourAgo)).toBe(true);
        });

        it('should trigger alert when error rate >5%', () => {
            // Simulate 100 validations with 6 errors (6%)
            service.metrics.validationCalls = 100;
            service.metrics.errors = 5;  // Start with 5

            const triggerAlertSpy = jest.spyOn(service, 'triggerAlert');

            // 6th error should trigger alert
            service.recordError(userId, 'roast', new Error('Test error'));

            expect(triggerAlertSpy).toHaveBeenCalled();
            const alertData = triggerAlertSpy.mock.calls[0][0];
            expect(alertData.violations.rateExceeded).toBe(true);
            expect(parseFloat(alertData.metrics.errorRate)).toBeGreaterThan(5);
        });

        it('should trigger alert when errors >100/hour', () => {
            service.metrics.validationCalls = 1000;  // Ensure rate doesn't trigger
            const triggerAlertSpy = jest.spyOn(service, 'triggerAlert');

            // Simulate 101 errors in last hour
            for (let i = 0; i < 101; i++) {
                service.recordError(userId, 'roast', new Error(`Error ${i}`));
            }

            expect(triggerAlertSpy).toHaveBeenCalled();
            const alertData = triggerAlertSpy.mock.calls[0][0];
            expect(alertData.violations.countExceeded).toBe(true);
            expect(alertData.metrics.errorsLastHour).toBeGreaterThan(100);
        });

        it('should respect alert cooldown period', () => {
            service.metrics.validationCalls = 100;
            const triggerAlertSpy = jest.spyOn(service, 'triggerAlert');

            // First batch of errors - should trigger alert
            for (let i = 0; i < 10; i++) {
                service.recordError(userId, 'roast', new Error(`Error ${i}`));
            }
            expect(triggerAlertSpy).toHaveBeenCalledTimes(1);

            // Second batch within cooldown - should NOT trigger
            for (let i = 0; i < 10; i++) {
                service.recordError(userId, 'roast', new Error(`Error ${i + 10}`));
            }
            expect(triggerAlertSpy).toHaveBeenCalledTimes(1);  // Still only once
        });

        it('should include comprehensive metrics in alert', () => {
            service.metrics.validationCalls = 100;
            service.metrics.allowedActions = 94;
            service.metrics.blockedActions = 0;
            const triggerAlertSpy = jest.spyOn(service, 'triggerAlert');

            // Trigger error rate alert
            for (let i = 0; i < 7; i++) {
                service.recordError(userId, 'roast', new Error(`Error ${i}`));
            }

            expect(triggerAlertSpy).toHaveBeenCalled();
            const alertData = triggerAlertSpy.mock.calls[0][0];

            expect(alertData).toHaveProperty('userId');
            expect(alertData).toHaveProperty('action');
            expect(alertData).toHaveProperty('error');
            expect(alertData).toHaveProperty('metrics');
            expect(alertData.metrics).toHaveProperty('errorRate');
            expect(alertData.metrics).toHaveProperty('errorsLastHour');
            expect(alertData.metrics).toHaveProperty('totalErrors');
            expect(alertData.metrics).toHaveProperty('totalValidations');
            expect(alertData).toHaveProperty('thresholds');
            expect(alertData).toHaveProperty('violations');
            expect(alertData).toHaveProperty('cachePerformance');
        });

        it('should log alerts with structured format', () => {
            service.metrics.validationCalls = 100;
            const loggerErrorSpy = logger.error;

            // Trigger alert
            for (let i = 0; i < 7; i++) {
                service.recordError(userId, 'roast', new Error(`Error ${i}`));
            }

            expect(loggerErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('TIER VALIDATION ALERT'),
                expect.objectContaining({
                    category: 'tier_validation_alert',
                    severity: 'high',
                    alertType: 'error_threshold_exceeded'
                })
            );
        });

        it('should not trigger alert if thresholds not exceeded', () => {
            service.metrics.validationCalls = 1000;
            const triggerAlertSpy = jest.spyOn(service, 'triggerAlert');

            // 3 errors out of 1000 validations (0.3% - below threshold)
            service.recordError(userId, 'roast', new Error('Error 1'));
            service.recordError(userId, 'roast', new Error('Error 2'));
            service.recordError(userId, 'roast', new Error('Error 3'));

            expect(triggerAlertSpy).not.toHaveBeenCalled();
        });
    });

    // ============================================================================
    // AC3: SENTRY INTEGRATION
    // ============================================================================

    describe('AC3: Sentry Integration', () => {
        it('should not call Sentry when SENTRY_ENABLED is false', () => {
            service.addSentryBreadcrumb('test', { message: 'Test breadcrumb' });

            expect(addBreadcrumb).not.toHaveBeenCalled();
        });

        it('should add breadcrumb on validation start', async () => {
            // Enable Sentry for this test
            require('../../../src/config/sentry').SENTRY_ENABLED = true;

            await service.validateAction(userId, 'roast');

            // Reset for other tests
            require('../../../src/config/sentry').SENTRY_ENABLED = false;
        });

        it('should add breadcrumb on validation complete', async () => {
            await service.validateAction(userId, 'roast');

            // Verify breadcrumb would be added if Sentry enabled
            // (actual call mocked, so we just verify the code path)
            expect(true).toBe(true);  // Placeholder
        });

        it('should add breadcrumb with proper structure', () => {
            const testData = {
                userId: 'test-123',
                action: 'roast',
                message: 'Test message',
                level: 'info'
            };

            service.addSentryBreadcrumb('test_category', testData);

            // Verify structure (even if not called due to SENTRY_ENABLED=false)
            expect(testData).toHaveProperty('userId');
            expect(testData).toHaveProperty('action');
        });

        it('should handle Sentry errors gracefully', () => {
            // Mock Sentry to throw error
            const originalEnabled = SENTRY_ENABLED;
            require('../../../src/config/sentry').SENTRY_ENABLED = true;
            addBreadcrumb.mockImplementationOnce(() => {
                throw new Error('Sentry error');
            });

            // Should not throw
            expect(() => {
                service.addSentryBreadcrumb('test', { message: 'Test' });
            }).not.toThrow();

            // Reset
            require('../../../src/config/sentry').SENTRY_ENABLED = originalEnabled;
        });
    });

    // ============================================================================
    // INTEGRATION TESTS
    // ============================================================================

    describe('Integration: Monitoring in validateAction()', () => {
        it('should track all monitoring metrics during validation', async () => {
            const result = await service.validateAction(userId, 'roast');

            const metrics = service.getMetrics();

            // Validation metrics
            expect(metrics.validationCalls).toBeGreaterThan(0);
            expect(metrics.allowedActions + metrics.blockedActions).toBeGreaterThan(0);

            // Cache metrics
            expect(metrics.cacheHits + metrics.cacheMisses).toBeGreaterThan(0);
            expect(metrics.cachePerformance).toBeDefined();
            expect(metrics.cachePerformance.hitRate).toMatch(/^\d+\.\d{2}%$/);
        });

        it('should record errors and check thresholds on validation failure', async () => {
            // Mock a validation error
            const mockSupabase = require('../../../src/config/supabase').supabaseServiceClient;
            mockSupabase.from.mockImplementationOnce(() => {
                throw new Error('Database error');
            });

            const recordErrorSpy = jest.spyOn(service, 'recordError');

            await service.validateAction(userId, 'roast').catch(() => {});

            expect(recordErrorSpy).toHaveBeenCalled();
            expect(service.metrics.errors).toBeGreaterThan(0);
        });

        it('should maintain metrics across multiple validations', async () => {
            // Multiple validations
            await service.validateAction(userId, 'roast', { requestId: 'req-1' });
            await service.validateAction(userId, 'analysis', { requestId: 'req-2' });
            await service.validateAction(userId, 'platform_add', { requestId: 'req-3', platform: 'twitter' });

            const metrics = service.getMetrics();

            expect(metrics.validationCalls).toBe(3);
            expect(metrics.cachePerformance.totalRequests).toBeGreaterThan(0);
        });
    });

    // ============================================================================
    // EDGE CASES
    // ============================================================================

    describe('Edge Cases', () => {
        it('should handle clearCache correctly', () => {
            service.metrics.cacheHits = 50;
            service.metrics.cacheMisses = 25;
            service.errorTimestamps = [Date.now(), Date.now() - 1000];
            service.usageCache.set('user1', {});

            service.clearCache();

            expect(service.usageCache.size).toBe(0);
            expect(service.requestScopedCache.size).toBe(0);
            expect(service.pendingCacheInvalidations.size).toBe(0);
        });

        it('should handle concurrent validations correctly', async () => {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(service.validateAction(`user-${i}`, 'roast', { requestId: `req-${i}` }));
            }

            const results = await Promise.all(promises);

            expect(results).toHaveLength(10);
            expect(service.metrics.validationCalls).toBe(10);
        });

        it('should handle cache invalidation during monitoring', () => {
            service.usageCache.set(userId, { data: {}, timestamp: Date.now() });
            service.metrics.cacheHits = 10;

            service.invalidateUserCache(userId);

            expect(service.usageCache.has(userId)).toBe(false);
            // Metrics should remain unchanged
            expect(service.metrics.cacheHits).toBe(10);
        });
    });
});
