const request = require('supertest');
const express = require('express');

const mockSupabaseServiceClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn()
};

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabaseServiceClient
}));

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = { id: 'user-123', plan: 'pro', org_id: 'org-123' };
  next();
});

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken
}));

const mockAnalyticsDashboardService = {
  getDashboardData: jest.fn(),
  getBillingAnalytics: jest.fn(),
  exportAnalytics: jest.fn()
};

jest.mock('../../../src/services/analyticsDashboardService', () => mockAnalyticsDashboardService);

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Analytics dashboard endpoints', () => {
  let app;
  let analyticsRoutes;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    analyticsRoutes = require('../../../src/routes/analytics');
    app.use('/api/analytics', analyticsRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    if (analyticsRoutes.__clearAnalyticsCache) {
      analyticsRoutes.__clearAnalyticsCache();
    }
  });

  it('should return dashboard payload and cache the response', async () => {
    mockAnalyticsDashboardService.getDashboardData.mockResolvedValue({
      summary: { totals: { roasts: 42 } }
    });

    await request(app)
      .get('/api/analytics/dashboard?range=30')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.summary.totals.roasts).toBe(42);
      });

    expect(mockAnalyticsDashboardService.getDashboardData).toHaveBeenCalledTimes(1);

    // Second request should hit cache (no additional service call)
    await request(app)
      .get('/api/analytics/dashboard?range=30')
      .expect(200);

    expect(mockAnalyticsDashboardService.getDashboardData).toHaveBeenCalledTimes(1);
  });

  it('should handle dashboard errors gracefully', async () => {
    mockAnalyticsDashboardService.getDashboardData.mockRejectedValue(new Error('boom'));

    await request(app)
      .get('/api/analytics/dashboard')
      .expect(500)
      .expect((res) => {
        expect(res.body.success).toBe(false);
      });
  });

  it('should return billing analytics payload', async () => {
    mockAnalyticsDashboardService.getBillingAnalytics.mockResolvedValue({
      polar: { available: true }
    });

    await request(app)
      .get('/api/analytics/billing?range=60')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.polar.available).toBe(true);
      });

    expect(mockAnalyticsDashboardService.getBillingAnalytics).toHaveBeenCalledWith({
      user: expect.any(Object),
      rangeDays: 60
    });
  });

  it('should stream exported analytics files', async () => {
    mockAnalyticsDashboardService.exportAnalytics.mockResolvedValue({
      filename: 'analytics.csv',
      contentType: 'text/csv',
      body: 'id,value'
    });

    await request(app)
      .get('/api/analytics/export?format=csv&dataset=usage')
      .expect(200)
      .expect('Content-Type', /text\/csv/)
      .expect('Content-Disposition', /analytics\.csv/)
      .expect((res) => {
        expect(res.text).toBe('id,value');
      });
  });

  it('should surface export permission errors', async () => {
    const permissionError = new Error('forbidden');
    permissionError.statusCode = 403;
    mockAnalyticsDashboardService.exportAnalytics.mockRejectedValue(permissionError);

    await request(app)
      .get('/api/analytics/export')
      .expect(403)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('forbidden');
      });
  });
});

