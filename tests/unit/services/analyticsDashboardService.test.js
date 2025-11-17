const analyticsDashboardService = require('../../../src/services/analyticsDashboardService');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const planLimitsService = require('../../../src/services/planLimitsService');
const { logger } = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn()
    }
}));

jest.mock('../../../src/services/planLimitsService', () => ({
    getPlanLimits: jest.fn()
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

describe('AnalyticsDashboardService', () => {
    let mockFrom, mockSelect, mockEq, mockGte, mockLte, mockOrder, mockLimit;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup Supabase query chain mocks
        mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });
        mockOrder = jest.fn(() => ({ limit: mockLimit }));
        mockLte = jest.fn(() => ({ order: mockOrder }));
        mockGte = jest.fn(() => ({ lte: mockLte }));
        mockEq = jest.fn(() => ({ gte: mockGte }));
        mockSelect = jest.fn(() => ({ eq: mockEq }));
        mockFrom = jest.fn(() => ({ select: mockSelect }));

        supabaseServiceClient.from = mockFrom;
    });

    describe('_calculateTrend', () => {
        // Test edge case identified by CodeRabbit: values between 0 and 1
        it('should calculate trend correctly when previous is between 0 and 1', () => {
            const series = [0.5, 1.0];
            const trend = analyticsDashboardService._calculateTrend(series);
            expect(trend).toBe(100);
        });

        it('should return 0 for series with less than 2 values', () => {
            expect(analyticsDashboardService._calculateTrend([])).toBe(0);
            expect(analyticsDashboardService._calculateTrend([1])).toBe(0);
        });

        it('should return 100 when previous is 0 and latest > 0', () => {
            const series = [0, 1];
            const trend = analyticsDashboardService._calculateTrend(series);
            expect(trend).toBe(100);
        });

        it('should return 0 when previous is 0 and latest is 0', () => {
            const series = [0, 0];
            const trend = analyticsDashboardService._calculateTrend(series);
            expect(trend).toBe(0);
        });

        it('should calculate negative trend correctly', () => {
            const series = [100, 50];
            const trend = analyticsDashboardService._calculateTrend(series);
            expect(trend).toBe(-50);
        });

        it('should calculate positive trend correctly', () => {
            const series = [50, 100];
            const trend = analyticsDashboardService._calculateTrend(series);
            expect(trend).toBe(100);
        });

        it('should handle decimal values correctly', () => {
            const series = [0.25, 0.75];
            const trend = analyticsDashboardService._calculateTrend(series);
            expect(trend).toBe(200);
        });
    });

    describe('_clampRange', () => {
        it('should return valid range for normal values', () => {
            expect(analyticsDashboardService._clampRange(30)).toBe(30);
            expect(analyticsDashboardService._clampRange(90)).toBe(90);
            expect(analyticsDashboardService._clampRange(365)).toBe(365);
        });

        it('should clamp values below 7 to 7', () => {
            expect(analyticsDashboardService._clampRange(1)).toBe(7);
            expect(analyticsDashboardService._clampRange(5)).toBe(7);
            expect(analyticsDashboardService._clampRange(0)).toBe(7);
        });

        it('should clamp values above 365 to 365', () => {
            expect(analyticsDashboardService._clampRange(500)).toBe(365);
            expect(analyticsDashboardService._clampRange(1000)).toBe(365);
        });

        it('should handle invalid inputs', () => {
            expect(analyticsDashboardService._clampRange('invalid')).toBe(30);
            expect(analyticsDashboardService._clampRange(null)).toBe(30);
            expect(analyticsDashboardService._clampRange(undefined)).toBe(30);
            expect(analyticsDashboardService._clampRange(NaN)).toBe(30);
        });
    });

    describe('_sanitizeGroupBy', () => {
        it('should return valid groupBy values', () => {
            expect(analyticsDashboardService._sanitizeGroupBy('day')).toBe('day');
            expect(analyticsDashboardService._sanitizeGroupBy('week')).toBe('week');
            expect(analyticsDashboardService._sanitizeGroupBy('month')).toBe('month');
        });

        it('should handle case insensitive input', () => {
            expect(analyticsDashboardService._sanitizeGroupBy('DAY')).toBe('day');
            expect(analyticsDashboardService._sanitizeGroupBy('Week')).toBe('week');
            expect(analyticsDashboardService._sanitizeGroupBy('MONTH')).toBe('month');
        });

        it('should default to day for invalid values', () => {
            expect(analyticsDashboardService._sanitizeGroupBy('invalid')).toBe('day');
            expect(analyticsDashboardService._sanitizeGroupBy('year')).toBe('day');
            expect(analyticsDashboardService._sanitizeGroupBy(null)).toBe('day');
            expect(analyticsDashboardService._sanitizeGroupBy(123)).toBe('day');
        });
    });

    describe('_sanitizePlatform', () => {
        it('should return "all" for "all" input', () => {
            expect(analyticsDashboardService._sanitizePlatform('all')).toBe('all');
            expect(analyticsDashboardService._sanitizePlatform('ALL')).toBe('all');
        });

        it('should return normalized platform name', () => {
            expect(analyticsDashboardService._sanitizePlatform('twitter')).toBe('twitter');
            expect(analyticsDashboardService._sanitizePlatform('TWITTER')).toBe('twitter');
            expect(analyticsDashboardService._sanitizePlatform('YouTube')).toBe('youtube');
        });

        it('should return "all" for null/undefined', () => {
            expect(analyticsDashboardService._sanitizePlatform(null)).toBe('all');
            expect(analyticsDashboardService._sanitizePlatform(undefined)).toBe('all');
            expect(analyticsDashboardService._sanitizePlatform('')).toBe('all');
        });
    });

    describe('_buildTimeframe', () => {
        it('should build correct timeframe for given range', () => {
            const { startDate, endDate } = analyticsDashboardService._buildTimeframe(30);
            
            expect(endDate).toBeInstanceOf(Date);
            expect(startDate).toBeInstanceOf(Date);
            expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
            
            const diffDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(30);
        });

        it('should handle different ranges', () => {
            const { startDate, endDate } = analyticsDashboardService._buildTimeframe(7);
            const diffDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(7);
        });
    });

    describe('_toNumber', () => {
        it('should convert valid numbers', () => {
            expect(analyticsDashboardService._toNumber(42)).toBe(42);
            expect(analyticsDashboardService._toNumber('42')).toBe(42);
            expect(analyticsDashboardService._toNumber(42.5)).toBe(42.5);
        });

        it('should return 0 for invalid values', () => {
            expect(analyticsDashboardService._toNumber(null)).toBe(0);
            expect(analyticsDashboardService._toNumber(undefined)).toBe(0);
            expect(analyticsDashboardService._toNumber('invalid')).toBe(0);
            expect(analyticsDashboardService._toNumber(NaN)).toBe(0);
        });
    });

    describe('_averageField', () => {
        it('should calculate average of valid values', () => {
            const rows = [
                { value: 10 },
                { value: 20 },
                { value: 30 }
            ];
            const avg = analyticsDashboardService._averageField(rows, 'value');
            expect(avg).toBe(20);
        });

        it('should filter out invalid values', () => {
            const rows = [
                { value: 10 },
                { value: null },
                { value: 20 },
                { value: 'invalid' },
                { value: 0 }
            ];
            const avg = analyticsDashboardService._averageField(rows, 'value');
            expect(avg).toBe(15); // (10 + 20) / 2
        });

        it('should return 0 for empty arrays', () => {
            expect(analyticsDashboardService._averageField([], 'value')).toBe(0);
            expect(analyticsDashboardService._averageField(null, 'value')).toBe(0);
        });

        it('should return 0 when no valid values', () => {
            const rows = [
                { value: null },
                { value: 0 },
                { value: 'invalid' }
            ];
            expect(analyticsDashboardService._averageField(rows, 'value')).toBe(0);
        });
    });

    describe('_resolveOrganizationContext', () => {
        it('should return context when user has org_id', async () => {
            const user = { id: 'user-123', org_id: 'org-456', plan: 'pro' };
            const context = await analyticsDashboardService._resolveOrganizationContext(user);
            
            expect(context.organizationId).toBe('org-456');
            expect(context.planId).toBe('pro');
        });

        it('should fetch org from database when org_id missing', async () => {
            const mockSingle = jest.fn().mockResolvedValue({
                data: { id: 'org-789', plan_id: 'plus' },
                error: null
            });
            const mockEq = jest.fn(() => ({ single: mockSingle }));
            const mockSelect = jest.fn(() => ({ eq: mockEq }));
            mockFrom.mockReturnValue({ select: mockSelect });

            const user = { id: 'user-123' };
            const context = await analyticsDashboardService._resolveOrganizationContext(user);
            
            expect(mockFrom).toHaveBeenCalledWith('organizations');
            expect(context.organizationId).toBe('org-789');
            expect(context.planId).toBe('plus');
        });

        it('should throw error for unauthenticated user', async () => {
            await expect(
                analyticsDashboardService._resolveOrganizationContext(null)
            ).rejects.toThrow('Usuario no autenticado');

            await expect(
                analyticsDashboardService._resolveOrganizationContext({})
            ).rejects.toThrow('Usuario no autenticado');
        });
    });

    describe('getDashboardData', () => {
        const mockUser = { id: 'user-123', org_id: 'org-456', plan: 'pro' };
        const mockSnapshots = [
            {
                period_start: '2025-11-01T00:00:00Z',
                period_end: '2025-11-01T23:59:59Z',
                total_roasts: 10,
                total_analyses: 5,
                total_shield_actions: 2,
                total_cost_cents: 1000
            },
            {
                period_start: '2025-11-02T00:00:00Z',
                period_end: '2025-11-02T23:59:59Z',
                total_roasts: 15,
                total_analyses: 8,
                total_shield_actions: 3,
                total_cost_cents: 1500
            }
        ];

        beforeEach(() => {
            planLimitsService.getPlanLimits.mockResolvedValue({
                analyticsEnabled: true
            });

            // Mock snapshots fetch
            const mockSnapshotsLimit = jest.fn().mockResolvedValue({
                data: mockSnapshots,
                error: null
            });
            const mockSnapshotsOrder = jest.fn(() => ({ limit: mockSnapshotsLimit }));
            const mockSnapshotsLte = jest.fn(() => ({ order: mockSnapshotsOrder }));
            const mockSnapshotsGte = jest.fn(() => ({ lte: mockSnapshotsLte }));
            const mockSnapshotsEq = jest.fn(() => ({ gte: mockSnapshotsGte }));
            const mockSnapshotsSelect = jest.fn(() => ({ eq: mockSnapshotsEq }));

            // Mock usage records fetch
            const mockUsageLimit = jest.fn().mockResolvedValue({
                data: [],
                error: null
            });
            const mockUsageOrder = jest.fn(() => ({ limit: mockUsageLimit }));
            const mockUsageLte = jest.fn(() => ({ order: mockUsageOrder }));
            const mockUsageGte = jest.fn(() => ({ lte: mockUsageLte }));
            const mockUsageEq = jest.fn(() => ({ gte: mockUsageGte }));
            const mockUsageSelect = jest.fn(() => ({ eq: mockUsageEq }));

            // Mock shield actions fetch
            const mockShieldLimit = jest.fn().mockResolvedValue({
                data: [],
                error: null
            });
            const mockShieldOrder = jest.fn(() => ({ limit: mockShieldLimit }));
            const mockShieldLte = jest.fn(() => ({ order: mockShieldOrder }));
            const mockShieldGte = jest.fn(() => ({ lte: mockShieldLte }));
            const mockShieldEq = jest.fn(() => ({ gte: mockShieldGte }));
            const mockShieldSelect = jest.fn(() => ({ eq: mockShieldEq }));

            // Create a chainable mock for shield_actions that supports platform filtering
            // The query chain needs to support: select -> eq -> gte -> lte -> order -> limit -> eq (for platform filter)
            // After limit(), the query should still be chainable for the platform filter
            const createShieldQueryChain = () => {
                const limitResult = Promise.resolve({ data: [], error: null });
                const chain = {
                    eq: jest.fn((field, value) => chain),
                    gte: jest.fn(() => chain),
                    lte: jest.fn(() => chain),
                    order: jest.fn(() => chain),
                    limit: jest.fn(() => chain) // Return chain, not promise, so we can chain .eq() after
                };
                // Override limit to return a thenable that resolves to { data, error }
                chain.limit = jest.fn(() => {
                    // Return an object that has both chain methods AND then/catch for promise
                    return Object.assign(chain, {
                        then: limitResult.then.bind(limitResult),
                        catch: limitResult.catch.bind(limitResult)
                    });
                });
                return chain;
            };
            
            const mockShieldSelectWithFilter = jest.fn(() => createShieldQueryChain());

            mockFrom.mockImplementation((table) => {
                if (table === 'analytics_snapshots') {
                    return { select: mockSnapshotsSelect };
                } else if (table === 'usage_records') {
                    return { select: mockUsageSelect };
                } else if (table === 'shield_actions') {
                    return { select: mockShieldSelectWithFilter };
                }
                return { select: jest.fn() };
            });
        });

        it('should return dashboard data with valid parameters', async () => {
            const result = await analyticsDashboardService.getDashboardData({
                user: mockUser,
                rangeDays: 30,
                groupBy: 'day',
                platformFilter: 'all'
            });

            expect(result).toHaveProperty('organizationId', 'org-456');
            expect(result).toHaveProperty('planId', 'pro');
            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('charts');
            expect(result).toHaveProperty('shield');
            expect(result).toHaveProperty('credits');
            expect(result).toHaveProperty('costs');
            expect(result.summary.totals.roasts).toBe(25);
        });

        it('should handle different time ranges', async () => {
            const result7 = await analyticsDashboardService.getDashboardData({
                user: mockUser,
                rangeDays: 7
            });
            expect(result7.timeframe.rangeDays).toBe(7);

            const result90 = await analyticsDashboardService.getDashboardData({
                user: mockUser,
                rangeDays: 90
            });
            expect(result90.timeframe.rangeDays).toBe(90);
        });

        it('should handle different groupBy values', async () => {
            const resultDay = await analyticsDashboardService.getDashboardData({
                user: mockUser,
                groupBy: 'day'
            });
            expect(resultDay.timeframe.groupBy).toBe('day');

            const resultWeek = await analyticsDashboardService.getDashboardData({
                user: mockUser,
                groupBy: 'week'
            });
            expect(resultWeek.timeframe.groupBy).toBe('week');
        });

        it('should handle platform filters', async () => {
            const result = await analyticsDashboardService.getDashboardData({
                user: mockUser,
                platformFilter: 'twitter'
            });

            expect(result).toHaveProperty('charts');
        });
    });

    describe('getBillingAnalytics', () => {
        const mockUser = { id: 'user-123', org_id: 'org-456', plan: 'pro' };

        beforeEach(() => {
            // Mock usage records for local costs
            const mockUsageLimit = jest.fn().mockResolvedValue({
                data: [],
                error: null
            });
            const mockUsageOrder = jest.fn(() => ({ limit: mockUsageLimit }));
            const mockUsageLte = jest.fn(() => ({ order: mockUsageOrder }));
            const mockUsageGte = jest.fn(() => ({ lte: mockUsageLte }));
            const mockUsageEq = jest.fn(() => ({ gte: mockUsageGte }));
            const mockUsageSelect = jest.fn(() => ({ eq: mockUsageEq }));

            mockFrom.mockReturnValue({ select: mockUsageSelect });
        });

        it('should return billing data without Polar', async () => {
            const result = await analyticsDashboardService.getBillingAnalytics({
                user: mockUser,
                rangeDays: 90
            });

            expect(result).toHaveProperty('organizationId');
            expect(result).toHaveProperty('planId');
            expect(result).toHaveProperty('localCosts');
            expect(result).toHaveProperty('polar');
            expect(result.polar.available).toBe(false);
        });

        it('should handle different ranges', async () => {
            const result = await analyticsDashboardService.getBillingAnalytics({
                user: mockUser,
                rangeDays: 30
            });

            expect(result.timeframe.rangeDays).toBe(30);
        });
    });

    describe('exportAnalytics', () => {
        const mockUser = { id: 'user-123', org_id: 'org-456', plan: 'pro' };
        const mockSnapshots = [
            {
                id: 'snapshot-1',
                period_start: '2025-11-01T00:00:00Z',
                total_roasts: 10
            }
        ];

        beforeEach(() => {
            planLimitsService.getPlanLimits.mockResolvedValue({
                analyticsEnabled: true
            });

            const mockLimit = jest.fn().mockResolvedValue({
                data: mockSnapshots,
                error: null
            });
            const mockOrder = jest.fn(() => ({ limit: mockLimit }));
            const mockLte = jest.fn(() => ({ order: mockOrder }));
            const mockGte = jest.fn(() => ({ lte: mockLte }));
            const mockEq = jest.fn(() => ({ gte: mockGte }));
            const mockSelect = jest.fn(() => ({ eq: mockEq }));

            mockFrom.mockReturnValue({ select: mockSelect });
        });

        it('should export CSV format', async () => {
            const result = await analyticsDashboardService.exportAnalytics({
                user: mockUser,
                format: 'csv',
                dataset: 'snapshots',
                rangeDays: 90
            });

            expect(result.contentType).toBe('text/csv; charset=utf-8');
            expect(result.filename).toContain('.csv');
            expect(result.body).toBeTruthy();
        });

        it('should export JSON format', async () => {
            const result = await analyticsDashboardService.exportAnalytics({
                user: mockUser,
                format: 'json',
                dataset: 'snapshots',
                rangeDays: 90
            });

            expect(result.contentType).toBe('application/json');
            expect(result.filename).toContain('.json');
            const parsed = JSON.parse(result.body);
            expect(parsed).toHaveProperty('dataset', 'snapshots');
            expect(parsed).toHaveProperty('rows');
        });

        it('should throw error for invalid format', async () => {
            await expect(
                analyticsDashboardService.exportAnalytics({
                    user: mockUser,
                    format: 'xml',
                    dataset: 'snapshots'
                })
            ).rejects.toThrow('Formato de exportación no soportado');
        });

        it('should throw error for invalid dataset', async () => {
            await expect(
                analyticsDashboardService.exportAnalytics({
                    user: mockUser,
                    format: 'csv',
                    dataset: 'invalid'
                })
            ).rejects.toThrow('Dataset no soportado para exportación');
        });

        it('should throw error for free plan', async () => {
            const freeUser = { id: 'user-123', org_id: 'org-456', plan: 'free' };
            
            await expect(
                analyticsDashboardService.exportAnalytics({
                    user: freeUser,
                    format: 'csv',
                    dataset: 'snapshots'
                })
            ).rejects.toThrow('Tu plan no permite exportar analytics');
        });

        it('should export usage dataset', async () => {
            const result = await analyticsDashboardService.exportAnalytics({
                user: mockUser,
                format: 'csv',
                dataset: 'usage',
                rangeDays: 90
            });

            expect(result.filename).toContain('usage');
        });

        it('should export events dataset', async () => {
            const result = await analyticsDashboardService.exportAnalytics({
                user: mockUser,
                format: 'csv',
                dataset: 'events',
                rangeDays: 90
            });

            expect(result.filename).toContain('events');
        });
    });

    describe('_buildTimelineChart', () => {
        it('should build timeline chart with data', () => {
            const snapshots = [
                {
                    period_start: '2025-11-01T00:00:00Z',
                    total_roasts: 10,
                    total_analyses: 5,
                    total_shield_actions: 2
                },
                {
                    period_start: '2025-11-02T00:00:00Z',
                    total_roasts: 15,
                    total_analyses: 8,
                    total_shield_actions: 3
                }
            ];

            const result = analyticsDashboardService._buildTimelineChart(snapshots, 'day');

            expect(result.chart).toHaveProperty('labels');
            expect(result.chart).toHaveProperty('datasets');
            expect(result.chart.datasets).toHaveLength(3);
            expect(result.series).toHaveProperty('roasts');
            expect(result.series.roasts).toEqual([10, 15]);
        });

        it('should handle empty snapshots', () => {
            const result = analyticsDashboardService._buildTimelineChart([], 'day');

            expect(result.chart.labels).toEqual([]);
            expect(result.chart.datasets).toHaveLength(3);
            expect(result.series.roasts).toEqual([]);
        });
    });

    describe('_buildSummary', () => {
        it('should build summary from snapshots and timeline', () => {
            const snapshots = [
                {
                    total_roasts: 10,
                    total_analyses: 5,
                    total_shield_actions: 2,
                    total_cost_cents: 1000
                },
                {
                    total_roasts: 15,
                    total_analyses: 8,
                    total_shield_actions: 3,
                    total_cost_cents: 1500
                }
            ];

            const timeline = {
                series: {
                    roasts: [10, 15],
                    shieldActions: [2, 3]
                }
            };

            const result = analyticsDashboardService._buildSummary(snapshots, timeline);

            expect(result.totals.roasts).toBe(25);
            expect(result.totals.analyses).toBe(13);
            expect(result.totals.shieldActions).toBe(5);
            expect(result.totals.cost).toBe(2500);
            expect(result).toHaveProperty('averages');
            expect(result).toHaveProperty('growth');
        });
    });

    describe('_buildPlatformChart', () => {
        it('should build platform chart with data', () => {
            const snapshots = [
                { roasts_by_platform: { twitter: 10, youtube: 5 } },
                { roasts_by_platform: { twitter: 15, youtube: 8 } }
            ];

            const result = analyticsDashboardService._buildPlatformChart(snapshots, 'all');

            expect(result).toHaveProperty('labels');
            expect(result).toHaveProperty('datasets');
            expect(result.datasets).toHaveLength(1);
            expect(result.datasets[0]).toHaveProperty('data');
            expect(result.datasets[0].data).toEqual([25, 13]); // twitter: 10+15, youtube: 5+8
        });

        it('should handle empty snapshots', () => {
            const result = analyticsDashboardService._buildPlatformChart([], 'all');

            expect(result.labels).toEqual([]);
            expect(result.datasets).toEqual([]);
        });

        it('should filter by platform when platformFilter is not "all"', () => {
            const snapshots = [
                { roasts_by_platform: { twitter: 10, youtube: 5 } },
                { roasts_by_platform: { twitter: 15, instagram: 8 } }
            ];

            const result = analyticsDashboardService._buildPlatformChart(snapshots, 'twitter');

            expect(result.labels).toContain('twitter');
            expect(result.labels).not.toContain('youtube');
            expect(result.labels).not.toContain('instagram');
        });
    });

    describe('Constructor and Polar Client', () => {
        it('should initialize without Polar token', () => {
            const originalEnv = process.env.POLAR_ACCESS_TOKEN;
            delete process.env.POLAR_ACCESS_TOKEN;
            
            // Re-require to test constructor
            jest.resetModules();
            const service = require('../../../src/services/analyticsDashboardService');
            
            expect(service.polarClient).toBeNull();
            
            if (originalEnv) {
                process.env.POLAR_ACCESS_TOKEN = originalEnv;
            }
        });
    });

    describe('getBillingAnalytics - Polar Integration', () => {
        const mockUser = { id: 'user-123', org_id: 'org-456', plan: 'pro' };

        it('should handle Polar client error gracefully', async () => {
            // Mock usage records
            const mockUsageLimit = jest.fn().mockResolvedValue({
                data: [],
                error: null
            });
            const mockUsageOrder = jest.fn(() => ({ limit: mockUsageLimit }));
            const mockUsageLte = jest.fn(() => ({ order: mockUsageOrder }));
            const mockUsageGte = jest.fn(() => ({ lte: mockUsageLte }));
            const mockUsageEq = jest.fn(() => ({ gte: mockUsageGte }));
            const mockUsageSelect = jest.fn(() => ({ eq: mockUsageEq }));
            mockFrom.mockReturnValue({ select: mockUsageSelect });

            // Mock Polar client to throw error
            const originalPolar = analyticsDashboardService.polarClient;
            analyticsDashboardService.polarClient = {
                orders: {
                    list: jest.fn().mockRejectedValue(new Error('Polar API error'))
                }
            };

            const result = await analyticsDashboardService.getBillingAnalytics({
                user: mockUser,
                rangeDays: 90
            });

            expect(result.polar.available).toBe(false);
            expect(result.polar.error).toContain('No se pudo consultar Polar');

            analyticsDashboardService.polarClient = originalPolar;
        });
    });

    describe('exportAnalytics - Error Cases', () => {
        const mockUser = { id: 'user-123', org_id: 'org-456', plan: 'pro' };

        it('should throw error when analytics disabled', async () => {
            planLimitsService.getPlanLimits.mockResolvedValue({
                analyticsEnabled: false
            });

            await expect(
                analyticsDashboardService.exportAnalytics({
                    user: mockUser,
                    format: 'csv',
                    dataset: 'snapshots'
                })
            ).rejects.toThrow('Tu plan no tiene analytics habilitados');
        });
    });

    describe('_resolveOrganizationContext - Error Cases', () => {
        it('should throw error when organization not found', async () => {
            const mockSingle = jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
            });
            const mockEq = jest.fn(() => ({ single: mockSingle }));
            const mockSelect = jest.fn(() => ({ eq: mockEq }));
            mockFrom.mockReturnValue({ select: mockSelect });

            const user = { id: 'user-123' };
            
            await expect(
                analyticsDashboardService._resolveOrganizationContext(user)
            ).rejects.toThrow('No se encontró la organización del usuario');
        });
    });

    describe('_fetchSnapshots - Error Handling', () => {
        it('should throw error when query fails', async () => {
            const mockLimit = jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
            });
            const mockOrder = jest.fn(() => ({ limit: mockLimit }));
            const mockLte = jest.fn(() => ({ order: mockOrder }));
            const mockGte = jest.fn(() => ({ lte: mockLte }));
            const mockEq = jest.fn(() => ({ gte: mockGte }));
            const mockSelect = jest.fn(() => ({ eq: mockEq }));
            mockFrom.mockReturnValue({ select: mockSelect });

            await expect(
                analyticsDashboardService._fetchSnapshots('org-123', new Date(), new Date())
            ).rejects.toThrow('No se pudieron obtener los snapshots de analytics');
        });
    });

    describe('_fetchUsageRecords - Error Handling', () => {
        it('should throw error when query fails', async () => {
            const mockLimit = jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
            });
            const mockOrder = jest.fn(() => ({ limit: mockLimit }));
            const mockLte = jest.fn(() => ({ order: mockOrder }));
            const mockGte = jest.fn(() => ({ lte: mockLte }));
            const mockEq = jest.fn(() => ({ gte: mockGte }));
            const mockSelect = jest.fn(() => ({ eq: mockEq }));
            mockFrom.mockReturnValue({ select: mockSelect });

            await expect(
                analyticsDashboardService._fetchUsageRecords('org-123', new Date(), new Date())
            ).rejects.toThrow('No se pudo obtener el historial de uso');
        });
    });

    describe('_fetchShieldActions - Error Handling', () => {
        it('should return empty stats when query fails', async () => {
            const createErrorChain = () => {
                const errorResult = Promise.resolve({
                    data: null,
                    error: { message: 'Database error' }
                });
                const chain = {
                    eq: jest.fn(() => chain),
                    gte: jest.fn(() => chain),
                    lte: jest.fn(() => chain),
                    order: jest.fn(() => chain),
                    limit: jest.fn(() => {
                        return Object.assign(chain, {
                            then: errorResult.then.bind(errorResult),
                            catch: errorResult.catch.bind(errorResult)
                        });
                    })
                };
                return chain;
            };
            const mockSelect = jest.fn(() => createErrorChain());
            mockFrom.mockReturnValue({ select: mockSelect });

            const result = await analyticsDashboardService._fetchShieldActions(
                'org-123',
                new Date(),
                new Date(),
                'all'
            );

            expect(result.total_actions).toBe(0);
            expect(result.actions_by_type).toEqual({});
        });
    });

    describe('_fetchAnalyticsEvents - Error Handling', () => {
        it('should throw error when query fails', async () => {
            const mockLimit = jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
            });
            const mockOrder = jest.fn(() => ({ limit: mockLimit }));
            const mockLte = jest.fn(() => ({ order: mockOrder }));
            const mockGte = jest.fn(() => ({ lte: mockLte }));
            const mockEq = jest.fn(() => ({ gte: mockGte }));
            const mockSelect = jest.fn(() => ({ eq: mockEq }));
            mockFrom.mockReturnValue({ select: mockSelect });

            await expect(
                analyticsDashboardService._fetchAnalyticsEvents('org-123', new Date(), new Date())
            ).rejects.toThrow('No se pudieron obtener los eventos de analytics');
        });
    });

    describe('_buildCredits', () => {
        it('should build credits chart and summary', () => {
            const usageRecords = [
                { resource_type: 'openai', quantity: 100, cost_cents: 1000 },
                { resource_type: 'perspective', quantity: 50, cost_cents: 500 }
            ];
            const planLimits = {
                maxRoasts: 1000,
                monthlyAnalysisLimit: 500
            };

            const result = analyticsDashboardService._buildCredits(usageRecords, planLimits);

            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('chart');
            expect(result.chart.labels).toContain('openai');
            expect(result.chart.labels).toContain('perspective');
            expect(result.summary.totals.openai.quantity).toBe(100);
        });

        it('should handle empty usage records', () => {
            const result = analyticsDashboardService._buildCredits([], {});

            expect(result.chart.labels).toEqual([]);
            expect(result.summary.totals).toEqual({});
        });
    });

    describe('_buildCostOverview', () => {
        it('should build cost overview', () => {
            const snapshots = [
                { total_cost_cents: 1000 },
                { total_cost_cents: 1500 }
            ];
            const usageRecords = [
                { cost_cents: 500 },
                { cost_cents: 300 }
            ];
            const summary = {
                totals: { cost: 2500 }
            };

            const result = analyticsDashboardService._buildCostOverview(snapshots, usageRecords, summary);

            expect(result).toHaveProperty('total_snapshot_cents');
            expect(result).toHaveProperty('usage_cost_cents');
            expect(result.total_snapshot_cents).toBe(2500);
            expect(result.usage_cost_cents).toBe(800);
        });
    });

    describe('_buildShieldStats', () => {
        it('should build shield stats from records', () => {
            const records = [
                {
                    id: 'action-1',
                    action_type: 'block',
                    severity: 'high',
                    platform: 'twitter',
                    status: 'completed',
                    created_at: '2025-11-17T10:00:00Z'
                },
                {
                    id: 'action-2',
                    action_type: 'warn',
                    severity: 'medium',
                    platform: 'youtube',
                    status: 'pending',
                    created_at: '2025-11-17T11:00:00Z'
                }
            ];

            const result = analyticsDashboardService._buildShieldStats(records);

            expect(result.total_actions).toBe(2);
            expect(result.actions_by_type.block).toBe(1);
            expect(result.actions_by_type.warn).toBe(1);
            expect(result.severity_distribution.high).toBe(1);
            expect(result.severity_distribution.medium).toBe(1);
            expect(result.recent).toHaveLength(2);
        });

        it('should return empty stats for empty records', () => {
            const result = analyticsDashboardService._buildShieldStats([]);

            expect(result.total_actions).toBe(0);
            expect(result.actions_by_type).toEqual({});
        });
    });

    describe('_emptyShieldStats', () => {
        it('should return empty shield stats structure', () => {
            const result = analyticsDashboardService._emptyShieldStats();

            expect(result).toEqual({
                total_actions: 0,
                actions_by_type: {},
                severity_distribution: {},
                platform_distribution: {},
                recent: []
            });
        });
    });

    describe('_formatLabel', () => {
        it('should format date label for day grouping', () => {
            const date = new Date('2025-11-17T10:00:00Z');
            const label = analyticsDashboardService._formatLabel(date, 'day');
            expect(typeof label).toBe('string');
            expect(label.length).toBeGreaterThan(0);
        });

        it('should format date label for week grouping', () => {
            const date = new Date('2025-11-17T10:00:00Z');
            const label = analyticsDashboardService._formatLabel(date, 'week');
            expect(typeof label).toBe('string');
            expect(label).toContain('Sem');
        });

        it('should format date label for month grouping', () => {
            const date = new Date('2025-11-17T10:00:00Z');
            const label = analyticsDashboardService._formatLabel(date, 'month');
            expect(typeof label).toBe('string');
            expect(label.length).toBeGreaterThan(0);
        });
    });

    describe('_getWeekNumber', () => {
        it('should calculate week number correctly', () => {
            const date = new Date('2025-11-17T10:00:00Z');
            const weekNumber = analyticsDashboardService._getWeekNumber(date);
            expect(typeof weekNumber).toBe('number');
            expect(weekNumber).toBeGreaterThan(0);
        });
    });

    describe('_flattenRow', () => {
        it('should flatten row data for export', () => {
            const row = {
                id: 'snapshot-1',
                period_start: '2025-11-17T00:00:00Z',
                total_roasts: 10,
                metadata: { key: 'value' }
            };

            const result = analyticsDashboardService._flattenRow(row, 'es-ES', 'UTC');

            expect(result).toHaveProperty('id', 'snapshot-1');
            expect(result).toHaveProperty('total_roasts', 10);
        });
    });
});
