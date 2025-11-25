const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// Create mocks BEFORE jest.mock() calls
const mockSupabase = createSupabaseMock({
  organizations: { id: 'org-123', plan_id: 'pro' },
  analytics_snapshots: [],
  usage_records: [],
  shield_actions: []
});

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

jest.mock('../../../src/services/planLimitsService', () => ({
  getPlanLimits: jest.fn(() =>
    Promise.resolve({
      analyticsEnabled: true,
      maxRoasts: 1000,
      monthlyAnalysisLimit: 5000
    })
  )
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const analyticsDashboardService = require('../../../src/services/analyticsDashboardService');
const planLimitsService = require('../../../src/services/planLimitsService');

describe('AnalyticsDashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase._reset();
  });

  describe('_calculateTrend', () => {
    // Test edge case identified by CodeRabbit: values between 0 and 1
    it('should calculate trend correctly when previous is between 0 and 1', () => {
      // Previous: 0.5, Latest: 1.0
      // Expected: ((1.0 - 0.5) / 0.5) * 100 = 100%
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
      // Previous: 100, Latest: 50
      // Expected: ((50 - 100) / 100) * 100 = -50%
      const series = [100, 50];
      const trend = analyticsDashboardService._calculateTrend(series);
      expect(trend).toBe(-50);
    });

    it('should calculate positive trend correctly', () => {
      // Previous: 50, Latest: 100
      // Expected: ((100 - 50) / 50) * 100 = 100%
      const series = [50, 100];
      const trend = analyticsDashboardService._calculateTrend(series);
      expect(trend).toBe(100);
    });

    it('should handle decimal values correctly', () => {
      // Previous: 0.25, Latest: 0.75
      // Expected: ((0.75 - 0.25) / 0.25) * 100 = 200%
      const series = [0.25, 0.75];
      const trend = analyticsDashboardService._calculateTrend(series);
      expect(trend).toBe(200);
    });
  });

  describe('_clampRange', () => {
    it('should clamp range to minimum 7 days', () => {
      expect(analyticsDashboardService._clampRange(0)).toBe(7);
      expect(analyticsDashboardService._clampRange(-5)).toBe(7);
      expect(analyticsDashboardService._clampRange(3)).toBe(7);
    });

    it('should clamp range to maximum 365 days', () => {
      expect(analyticsDashboardService._clampRange(500)).toBe(365);
      expect(analyticsDashboardService._clampRange(1000)).toBe(365);
    });

    it('should return valid range as-is', () => {
      expect(analyticsDashboardService._clampRange(30)).toBe(30);
      expect(analyticsDashboardService._clampRange(90)).toBe(90);
      expect(analyticsDashboardService._clampRange(180)).toBe(180);
    });

    it('should handle invalid input by defaulting to 30', () => {
      expect(analyticsDashboardService._clampRange('invalid')).toBe(30);
      expect(analyticsDashboardService._clampRange(null)).toBe(30);
      expect(analyticsDashboardService._clampRange(undefined)).toBe(30);
    });
  });

  describe('_sanitizeGroupBy', () => {
    it('should return valid groupBy values', () => {
      expect(analyticsDashboardService._sanitizeGroupBy('day')).toBe('day');
      expect(analyticsDashboardService._sanitizeGroupBy('week')).toBe('week');
      expect(analyticsDashboardService._sanitizeGroupBy('month')).toBe('month');
    });

    it('should be case insensitive', () => {
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
    it('should return platform name when valid', () => {
      expect(analyticsDashboardService._sanitizePlatform('twitter')).toBe('twitter');
      expect(analyticsDashboardService._sanitizePlatform('discord')).toBe('discord');
    });

    it('should return all for all platform', () => {
      expect(analyticsDashboardService._sanitizePlatform('all')).toBe('all');
      expect(analyticsDashboardService._sanitizePlatform('ALL')).toBe('all');
    });

    it('should default to all for null/undefined', () => {
      expect(analyticsDashboardService._sanitizePlatform(null)).toBe('all');
      expect(analyticsDashboardService._sanitizePlatform(undefined)).toBe('all');
    });
  });

  describe('_buildTimeframe', () => {
    it('should build correct timeframe for given rangeDays', () => {
      const { startDate, endDate } = analyticsDashboardService._buildTimeframe(30);

      expect(endDate).toBeInstanceOf(Date);
      expect(startDate).toBeInstanceOf(Date);

      const diffDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    });

    it('should have endDate as current time', () => {
      const before = new Date();
      const { endDate } = analyticsDashboardService._buildTimeframe(7);
      const after = new Date();

      expect(endDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(endDate.getTime()).toBeLessThanOrEqual(after.getTime() + 1000); // Allow 1s margin
    });
  });

  describe('_toNumber', () => {
    it('should convert valid numbers', () => {
      expect(analyticsDashboardService._toNumber(100)).toBe(100);
      expect(analyticsDashboardService._toNumber('50')).toBe(50);
      expect(analyticsDashboardService._toNumber(0)).toBe(0);
    });

    it('should return 0 for invalid values', () => {
      expect(analyticsDashboardService._toNumber(null)).toBe(0);
      expect(analyticsDashboardService._toNumber(undefined)).toBe(0);
      expect(analyticsDashboardService._toNumber('invalid')).toBe(0);
      expect(analyticsDashboardService._toNumber(NaN)).toBe(0);
    });
  });

  describe('_averageField', () => {
    it('should calculate average of valid numeric values', () => {
      const rows = [{ field: 10 }, { field: 20 }, { field: 30 }];
      const avg = analyticsDashboardService._averageField(rows, 'field');
      expect(avg).toBe(20);
    });

    it('should ignore invalid values', () => {
      const rows = [
        { field: 10 },
        { field: null },
        { field: 20 },
        { field: 'invalid' },
        { field: 30 }
      ];
      const avg = analyticsDashboardService._averageField(rows, 'field');
      expect(avg).toBe(20); // (10 + 20 + 30) / 3
    });

    it('should return 0 for empty array', () => {
      expect(analyticsDashboardService._averageField([], 'field')).toBe(0);
    });

    it('should return 0 when no valid values', () => {
      const rows = [{ field: null }, { field: 'invalid' }, { field: undefined }];
      expect(analyticsDashboardService._averageField(rows, 'field')).toBe(0);
    });

    it('should ignore zero values', () => {
      const rows = [{ field: 10 }, { field: 0 }, { field: 20 }];
      const avg = analyticsDashboardService._averageField(rows, 'field');
      expect(avg).toBe(15); // (10 + 20) / 2, ignoring 0
    });
  });

  describe('_formatLabel', () => {
    it('should format date for day groupBy', () => {
      const date = new Date('2025-01-15T10:00:00Z');
      const label = analyticsDashboardService._formatLabel(date.toISOString(), 'day');
      expect(label).toMatch(/15/);
      expect(label).toMatch(/ene|jan/i);
    });

    it('should format date for week groupBy', () => {
      const date = new Date('2025-01-15T10:00:00Z');
      const label = analyticsDashboardService._formatLabel(date.toISOString(), 'week');
      expect(label).toMatch(/Sem|Week/i);
    });

    it('should format date for month groupBy', () => {
      const date = new Date('2025-01-15T10:00:00Z');
      const label = analyticsDashboardService._formatLabel(date.toISOString(), 'month');
      expect(label).toMatch(/ene|jan/i);
      expect(label).toMatch(/2025/);
    });

    it('should return empty string for invalid date', () => {
      expect(analyticsDashboardService._formatLabel('invalid', 'day')).toBe('');
      expect(analyticsDashboardService._formatLabel(null, 'day')).toBe('');
    });
  });

  describe('_emptyShieldStats', () => {
    it('should return empty shield stats structure', () => {
      const stats = analyticsDashboardService._emptyShieldStats();
      expect(stats).toEqual({
        total_actions: 0,
        actions_by_type: {},
        severity_distribution: {},
        platform_distribution: {},
        recent: []
      });
    });
  });

  describe('_resolveOrganizationContext', () => {
    it('should throw error when user is not authenticated', async () => {
      await expect(analyticsDashboardService._resolveOrganizationContext(null)).rejects.toThrow(
        'Usuario no autenticado'
      );

      await expect(analyticsDashboardService._resolveOrganizationContext({})).rejects.toThrow(
        'Usuario no autenticado'
      );
    });

    it('should return org context when user has org_id', async () => {
      const user = {
        id: 'user-123',
        org_id: 'org-456',
        plan: 'pro'
      };

      const context = await analyticsDashboardService._resolveOrganizationContext(user);
      expect(context).toEqual({
        organizationId: 'org-456',
        planId: 'pro'
      });
    });

    it('should lookup organization from database when user has no org_id', async () => {
      const user = {
        id: 'user-123',
        plan: 'pro'
      };

      // Mock Supabase to return organization
      mockSupabase._setTableData('organizations', {
        id: 'org-789',
        plan_id: 'pro'
      });

      const context = await analyticsDashboardService._resolveOrganizationContext(user);
      expect(context).toEqual({
        organizationId: 'org-789',
        planId: 'pro'
      });
    });

    it('should use default plan when organization has no plan_id', async () => {
      const user = {
        id: 'user-123'
      };

      mockSupabase._setTableData('organizations', {
        id: 'org-789',
        plan_id: null
      });

      const context = await analyticsDashboardService._resolveOrganizationContext(user);
      expect(context.organizationId).toBe('org-789');
      expect(context.planId).toBe('starter_trial'); // DEFAULT_PLAN
    });

    it('should throw error when organization not found', async () => {
      const user = {
        id: 'user-123'
      };

      // Mock Supabase to return error
      mockSupabase.from = jest.fn(() => {
        const builder = {
          select: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          single: jest.fn(() => Promise.resolve({ data: null, error: { message: 'Not found' } }))
        };
        return builder;
      });

      await expect(analyticsDashboardService._resolveOrganizationContext(user)).rejects.toThrow(
        'No se encontró la organización del usuario'
      );
    });
  });

  describe('_buildSummary', () => {
    it('should calculate totals from snapshots', () => {
      const snapshots = [
        { total_roasts: 10, total_analyses: 5, total_shield_actions: 2, total_cost_cents: 100 },
        { total_roasts: 20, total_analyses: 10, total_shield_actions: 3, total_cost_cents: 200 }
      ];
      const timeline = {
        series: {
          roasts: [10, 20],
          shieldActions: [2, 3]
        }
      };

      const summary = analyticsDashboardService._buildSummary(snapshots, timeline);
      expect(summary.totals.roasts).toBe(30);
      expect(summary.totals.analyses).toBe(15);
      expect(summary.totals.shieldActions).toBe(5);
      expect(summary.totals.cost).toBe(300);
    });

    it('should calculate averages correctly', () => {
      const snapshots = [
        { avg_response_time_ms: 100, avg_rqc_score: 0.8, user_approval_rate: 90 },
        { avg_response_time_ms: 200, avg_rqc_score: 0.9, user_approval_rate: 95 }
      ];
      const timeline = { series: { roasts: [10, 20], shieldActions: [2, 3] } };

      const summary = analyticsDashboardService._buildSummary(snapshots, timeline);
      expect(summary.averages.response_time_ms).toBe(150);
      expect(summary.averages.rqc_score).toBeCloseTo(0.85, 2);
      expect(summary.averages.approval_rate).toBeCloseTo(92.5, 1);
    });

    it('should include highlights when roasts trend is positive', () => {
      const snapshots = [];
      const timeline = {
        series: {
          roasts: [10, 30], // 200% growth
          shieldActions: [2, 3]
        }
      };

      const summary = analyticsDashboardService._buildSummary(snapshots, timeline);
      expect(summary.highlights.length).toBeGreaterThan(0);
      expect(summary.highlights[0]).toContain('crecieron');
    });
  });

  describe('_buildShieldStats', () => {
    it('should return empty stats for empty records', () => {
      const stats = analyticsDashboardService._buildShieldStats([]);
      expect(stats).toEqual(analyticsDashboardService._emptyShieldStats());
    });

    it('should aggregate stats from records', () => {
      const records = [
        {
          id: '1',
          action_type: 'block',
          severity: 'high',
          platform: 'twitter',
          status: 'completed',
          created_at: '2025-01-01'
        },
        {
          id: '2',
          action_type: 'mute',
          severity: 'medium',
          platform: 'twitter',
          status: 'completed',
          created_at: '2025-01-02'
        },
        {
          id: '3',
          action_type: 'block',
          severity: 'high',
          platform: 'discord',
          status: 'completed',
          created_at: '2025-01-03'
        }
      ];

      const stats = analyticsDashboardService._buildShieldStats(records);
      expect(stats.total_actions).toBe(3);
      expect(stats.actions_by_type.block).toBe(2);
      expect(stats.actions_by_type.mute).toBe(1);
      expect(stats.severity_distribution.high).toBe(2);
      expect(stats.severity_distribution.medium).toBe(1);
      expect(stats.platform_distribution.twitter).toBe(2);
      expect(stats.platform_distribution.discord).toBe(1);
      expect(stats.recent.length).toBe(3);
    });

    it('should limit recent to 5 records', () => {
      const records = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        action_type: 'block',
        severity: 'high',
        platform: 'twitter',
        status: 'completed',
        created_at: `2025-01-${String(i + 1).padStart(2, '0')}`
      }));

      const stats = analyticsDashboardService._buildShieldStats(records);
      expect(stats.recent.length).toBe(5);
    });
  });

  describe('_buildPlatformChart', () => {
    it('should aggregate platform data from snapshots', () => {
      const snapshots = [
        { roasts_by_platform: { twitter: 10, discord: 5 } },
        { roasts_by_platform: { twitter: 20, discord: 10 } }
      ];

      const chart = analyticsDashboardService._buildPlatformChart(snapshots, 'all');
      expect(chart.labels).toContain('twitter');
      expect(chart.labels).toContain('discord');
      expect(chart.datasets[0].data).toContain(30); // twitter total
      expect(chart.datasets[0].data).toContain(15); // discord total
    });

    it('should filter by platform when platformFilter is set', () => {
      const snapshots = [
        { roasts_by_platform: { twitter: 10, discord: 5 } },
        { roasts_by_platform: { twitter: 20, discord: 10 } }
      ];

      const chart = analyticsDashboardService._buildPlatformChart(snapshots, 'twitter');
      expect(chart.labels).toContain('twitter');
      expect(chart.labels).not.toContain('discord');
    });

    it('should return empty chart for empty snapshots', () => {
      const chart = analyticsDashboardService._buildPlatformChart([], 'all');
      expect(chart.labels).toEqual([]);
      expect(chart.datasets).toEqual([]);
    });
  });

  describe('_buildTimelineChart', () => {
    it('should build timeline chart with correct structure', () => {
      const snapshots = [
        {
          period_start: '2025-01-01T00:00:00Z',
          total_roasts: 10,
          total_analyses: 5,
          total_shield_actions: 2
        },
        {
          period_start: '2025-01-02T00:00:00Z',
          total_roasts: 20,
          total_analyses: 10,
          total_shield_actions: 3
        }
      ];

      const timeline = analyticsDashboardService._buildTimelineChart(snapshots, 'day');
      expect(timeline.chart.labels.length).toBe(2);
      expect(timeline.chart.datasets.length).toBe(3);
      expect(timeline.chart.datasets[0].label).toBe('Roasts generados');
      expect(timeline.chart.datasets[1].label).toBe('Análisis completados');
      expect(timeline.chart.datasets[2].label).toBe('Acciones Shield');
      expect(timeline.series.roasts).toEqual([10, 20]);
      expect(timeline.series.analyses).toEqual([5, 10]);
      expect(timeline.series.shieldActions).toEqual([2, 3]);
    });

    it('should use period_end when period_start is missing', () => {
      const snapshots = [
        {
          period_end: '2025-01-01T00:00:00Z',
          total_roasts: 10
        }
      ];

      const timeline = analyticsDashboardService._buildTimelineChart(snapshots, 'day');
      expect(timeline.chart.labels.length).toBe(1);
    });
  });

  describe('_buildCredits', () => {
    it('should aggregate credits from usage records', () => {
      const usageRecords = [
        { resource_type: 'roasts', quantity: 10, cost_cents: 100 },
        { resource_type: 'analyses', quantity: 5, cost_cents: 50 },
        { resource_type: 'roasts', quantity: 20, cost_cents: 200 }
      ];
      const planLimits = {
        maxRoasts: 1000,
        monthlyAnalysisLimit: 5000
      };

      const credits = analyticsDashboardService._buildCredits(usageRecords, planLimits);
      expect(credits.summary.totals.roasts.quantity).toBe(30);
      expect(credits.summary.totals.roasts.cost_cents).toBe(300);
      expect(credits.summary.totals.analyses.quantity).toBe(5);
      expect(credits.summary.limits.roasts).toBe(1000);
      expect(credits.chart.labels).toContain('roasts');
      expect(credits.chart.labels).toContain('analyses');
    });

    it('should use metadata.resource_type when resource_type is missing', () => {
      const usageRecords = [
        { metadata: { resource_type: 'roasts' }, quantity: 10, cost_cents: 100 }
      ];

      const credits = analyticsDashboardService._buildCredits(usageRecords);
      expect(credits.summary.totals.roasts.quantity).toBe(10);
    });

    it('should default to otros when no resource_type', () => {
      const usageRecords = [{ quantity: 10, cost_cents: 100 }];

      const credits = analyticsDashboardService._buildCredits(usageRecords);
      expect(credits.summary.totals.otros.quantity).toBe(10);
    });
  });

  describe('_buildCostOverview', () => {
    it('should calculate cost overview correctly', () => {
      const snapshots = [{ total_cost_cents: 100 }, { total_cost_cents: 200 }];
      const usageRecords = [{ cost_cents: 50 }, { cost_cents: 75 }];
      const summary = {
        totals: { roasts: 30 }
      };

      const costs = analyticsDashboardService._buildCostOverview(snapshots, usageRecords, summary);
      expect(costs.total_snapshot_cents).toBe(300);
      expect(costs.usage_cost_cents).toBe(125);
      expect(costs.average_cost_per_roast).toBe(10); // 300 / 30
    });

    it('should return 0 average cost when no roasts', () => {
      const costs = analyticsDashboardService._buildCostOverview([], [], { totals: { roasts: 0 } });
      expect(costs.average_cost_per_roast).toBe(0);
    });
  });

  describe('getDashboardData', () => {
    it('should return dashboard data with correct structure', async () => {
      const user = {
        id: 'user-123',
        org_id: 'org-456',
        plan: 'pro'
      };

      // Mock Supabase queries
      mockSupabase._setTableData('analytics_snapshots', []);
      mockSupabase._setTableData('usage_records', []);
      mockSupabase._setTableData('shield_actions', []);

      const result = await analyticsDashboardService.getDashboardData({
        user,
        rangeDays: 30,
        groupBy: 'day',
        platformFilter: 'all'
      });

      expect(result).toHaveProperty('organizationId');
      expect(result).toHaveProperty('planId');
      expect(result).toHaveProperty('timeframe');
      expect(result).toHaveProperty('features');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('charts');
      expect(result).toHaveProperty('shield');
      expect(result).toHaveProperty('credits');
      expect(result).toHaveProperty('costs');
    });

    it('should sanitize rangeDays to valid range', async () => {
      const user = { id: 'user-123', org_id: 'org-456' };
      mockSupabase._setTableData('analytics_snapshots', []);
      mockSupabase._setTableData('usage_records', []);
      mockSupabase._setTableData('shield_actions', []);

      const result = await analyticsDashboardService.getDashboardData({
        user,
        rangeDays: 500 // Should be clamped to 365
      });

      expect(result.timeframe.rangeDays).toBe(365);
    });

    it('should handle different groupBy values', async () => {
      const user = { id: 'user-123', org_id: 'org-456' };
      mockSupabase._setTableData('analytics_snapshots', []);
      mockSupabase._setTableData('usage_records', []);
      mockSupabase._setTableData('shield_actions', []);

      const resultWeek = await analyticsDashboardService.getDashboardData({
        user,
        groupBy: 'week'
      });
      expect(resultWeek.timeframe.groupBy).toBe('week');

      const resultMonth = await analyticsDashboardService.getDashboardData({
        user,
        groupBy: 'month'
      });
      expect(resultMonth.timeframe.groupBy).toBe('month');
    });

    it('should filter by platform when platformFilter is set', async () => {
      const user = { id: 'user-123', org_id: 'org-456' };
      mockSupabase._setTableData('analytics_snapshots', []);
      mockSupabase._setTableData('usage_records', []);
      mockSupabase._setTableData('shield_actions', []);

      await analyticsDashboardService.getDashboardData({
        user,
        platformFilter: 'twitter'
      });

      // Verify platform filter was applied (through mock calls)
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  describe('_fetchSnapshots', () => {
    it('should fetch snapshots successfully', async () => {
      const mockSnapshots = [
        {
          id: '1',
          organization_id: 'org-123',
          period_start: '2025-01-01T00:00:00Z',
          period_end: '2025-01-01T23:59:59Z',
          total_roasts: 10
        }
      ];

      mockSupabase._setTableData('analytics_snapshots', mockSnapshots);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const snapshots = await analyticsDashboardService._fetchSnapshots(
        'org-123',
        startDate,
        endDate
      );
      expect(Array.isArray(snapshots)).toBe(true);
    });

    it('should throw error when query fails', async () => {
      mockSupabase.from = jest.fn(() => {
        const builder = {
          select: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          gte: jest.fn(() => builder),
          lte: jest.fn(() => builder),
          order: jest.fn(() => builder),
          limit: jest.fn(() => Promise.resolve({ data: null, error: { message: 'Query failed' } }))
        };
        return builder;
      });

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      await expect(
        analyticsDashboardService._fetchSnapshots('org-123', startDate, endDate)
      ).rejects.toThrow('No se pudieron obtener los snapshots de analytics');
    });
  });

  describe('_fetchUsageRecords', () => {
    it('should fetch usage records successfully', async () => {
      const mockRecords = [
        {
          id: '1',
          organization_id: 'org-123',
          resource_type: 'roasts',
          quantity: 10,
          cost_cents: 100
        }
      ];

      mockSupabase._setTableData('usage_records', mockRecords);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const records = await analyticsDashboardService._fetchUsageRecords(
        'org-123',
        startDate,
        endDate
      );
      expect(Array.isArray(records)).toBe(true);
    });

    it('should throw error when query fails', async () => {
      mockSupabase.from = jest.fn(() => {
        const builder = {
          select: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          gte: jest.fn(() => builder),
          lte: jest.fn(() => builder),
          order: jest.fn(() => builder),
          limit: jest.fn(() => Promise.resolve({ data: null, error: { message: 'Query failed' } }))
        };
        return builder;
      });

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      await expect(
        analyticsDashboardService._fetchUsageRecords('org-123', startDate, endDate)
      ).rejects.toThrow('No se pudo obtener el historial de uso');
    });
  });

  describe('_fetchShieldActions', () => {
    it('should fetch shield actions successfully', async () => {
      const mockActions = [
        {
          id: '1',
          organization_id: 'org-123',
          action_type: 'block',
          severity: 'high',
          platform: 'twitter',
          status: 'completed',
          created_at: '2025-01-01T00:00:00Z'
        }
      ];

      mockSupabase._setTableData('shield_actions', mockActions);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const stats = await analyticsDashboardService._fetchShieldActions(
        'org-123',
        startDate,
        endDate,
        'all'
      );
      expect(stats.total_actions).toBe(1);
    });

    it('should filter by platform when platform is specified', async () => {
      mockSupabase._setTableData('shield_actions', []);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      await analyticsDashboardService._fetchShieldActions('org-123', startDate, endDate, 'twitter');
      expect(mockSupabase.from).toHaveBeenCalledWith('shield_actions');
    });

    it('should return empty stats when query fails', async () => {
      mockSupabase.from = jest.fn(() => {
        const builder = {
          select: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          gte: jest.fn(() => builder),
          lte: jest.fn(() => builder),
          order: jest.fn(() => builder),
          limit: jest.fn(() => Promise.resolve({ data: null, error: { message: 'Query failed' } }))
        };
        return builder;
      });

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const stats = await analyticsDashboardService._fetchShieldActions(
        'org-123',
        startDate,
        endDate,
        'all'
      );
      expect(stats).toEqual(analyticsDashboardService._emptyShieldStats());
    });
  });

  describe('getBillingAnalytics', () => {
    it('should return billing analytics with local costs', async () => {
      const user = { id: 'user-123', org_id: 'org-456', plan: 'pro' };
      mockSupabase._setTableData('usage_records', [{ cost_cents: 100 }, { cost_cents: 200 }]);

      const result = await analyticsDashboardService.getBillingAnalytics({
        user,
        rangeDays: 90
      });

      expect(result).toHaveProperty('organizationId');
      expect(result).toHaveProperty('planId');
      expect(result).toHaveProperty('timeframe');
      expect(result).toHaveProperty('localCosts');
      expect(result).toHaveProperty('polar');
      expect(result.localCosts.currency).toBe('EUR');
    });

    it('should handle Polar client when available', async () => {
      const user = { id: 'user-123', org_id: 'org-456', plan: 'pro' };
      mockSupabase._setTableData('usage_records', []);

      // Note: Polar client is initialized in constructor, so we can't easily mock it
      // This test verifies the structure when Polar is not available
      const result = await analyticsDashboardService.getBillingAnalytics({
        user,
        rangeDays: 90
      });

      expect(result.polar).toHaveProperty('available');
      expect(result.polar).toHaveProperty('totals');
    });
  });

  describe('exportAnalytics', () => {
    it('should throw error for invalid format', async () => {
      const user = { id: 'user-123', org_id: 'org-456', plan: 'pro' };

      await expect(
        analyticsDashboardService.exportAnalytics({
          user,
          format: 'xml' // Invalid format
        })
      ).rejects.toThrow('Formato de exportación no soportado');
    });

    it('should throw error for invalid dataset', async () => {
      const user = { id: 'user-123', org_id: 'org-456', plan: 'pro' };

      await expect(
        analyticsDashboardService.exportAnalytics({
          user,
          format: 'csv',
          dataset: 'invalid'
        })
      ).rejects.toThrow('Dataset no soportado para exportación');
    });

    it('should throw error when plan does not allow export', async () => {
      const user = { id: 'user-123', org_id: 'org-456', plan: 'free' };

      await expect(
        analyticsDashboardService.exportAnalytics({
          user,
          format: 'csv',
          dataset: 'snapshots'
        })
      ).rejects.toThrow('Tu plan no permite exportar analytics');
    });

    it('should export CSV successfully for pro plan', async () => {
      const user = { id: 'user-123', org_id: 'org-456', plan: 'pro' };
      mockSupabase._setTableData('analytics_snapshots', [
        { id: '1', period_start: '2025-01-01', total_roasts: 10 }
      ]);

      const result = await analyticsDashboardService.exportAnalytics({
        user,
        format: 'csv',
        dataset: 'snapshots',
        rangeDays: 30
      });

      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('contentType', 'text/csv; charset=utf-8');
      expect(result).toHaveProperty('body');
      expect(result.filename).toContain('.csv');
    });

    it('should export JSON successfully', async () => {
      const user = { id: 'user-123', org_id: 'org-456', plan: 'pro' };
      mockSupabase._setTableData('analytics_snapshots', [
        { id: '1', period_start: '2025-01-01', total_roasts: 10 }
      ]);

      const result = await analyticsDashboardService.exportAnalytics({
        user,
        format: 'json',
        dataset: 'snapshots',
        rangeDays: 30
      });

      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('contentType', 'application/json');
      expect(result).toHaveProperty('body');
      expect(result.filename).toContain('.json');
      expect(() => JSON.parse(result.body)).not.toThrow();
    });

    it('should export usage dataset', async () => {
      const user = { id: 'user-123', org_id: 'org-456', plan: 'pro' };
      mockSupabase._setTableData('usage_records', [
        { id: '1', resource_type: 'roasts', quantity: 10 }
      ]);

      const result = await analyticsDashboardService.exportAnalytics({
        user,
        format: 'csv',
        dataset: 'usage',
        rangeDays: 30
      });

      expect(result.filename).toContain('usage');
    });

    it('should export events dataset', async () => {
      const user = { id: 'user-123', org_id: 'org-456', plan: 'pro' };
      mockSupabase._setTableData('analytics_events', [{ id: '1', event_type: 'roast_generated' }]);

      const result = await analyticsDashboardService.exportAnalytics({
        user,
        format: 'csv',
        dataset: 'events',
        rangeDays: 30
      });

      expect(result.filename).toContain('events');
    });
  });
});
