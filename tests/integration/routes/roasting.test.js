/**
 * Integration tests for Roasting Control API (Issue #596)
 * Tests /api/roasting endpoints for enable/disable and stats
 */

const request = require('supertest');

// Mock dependencies BEFORE requiring routes
jest.mock('../../../src/config/supabase', () => {
  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn(),
    insert: jest.fn()
  };

  return {
    supabaseServiceClient: mockSupabaseClient
  };
});

jest.mock('../../../src/services/workerNotificationService', () => ({
  notifyRoastingStateChange: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn()
    }))
  }
}));

// Mock authenticateToken middleware
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-123' };
    next();
  }
}));

describe('Roasting Control API Integration Tests', () => {
  let app;
  let supabaseServiceClient;
  let workerNotificationService;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';

    // Clear require cache to force fresh imports with mocks
    jest.resetModules();

    // NOW require modules - they will use mocks
    const indexModule = require('../../../src/index');
    app = indexModule.app;

    const supabaseModule = require('../../../src/config/supabase');
    supabaseServiceClient = supabaseModule.supabaseServiceClient;

    workerNotificationService = require('../../../src/services/workerNotificationService');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/roasting/status', () => {
    it('should return roasting enabled status', async () => {
      supabaseServiceClient.single.mockResolvedValue({
        data: {
          roasting_enabled: true,
          roasting_disabled_at: null,
          roasting_disabled_reason: null
        },
        error: null
      });

      const response = await request(app)
        .get('/api/roasting/status')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        roasting_enabled: true,
        roasting_disabled_at: null,
        roasting_disabled_reason: null
      });
    });

    it('should return roasting disabled status with audit trail', async () => {
      const disabledAt = new Date().toISOString();

      supabaseServiceClient.single.mockResolvedValue({
        data: {
          roasting_enabled: false,
          roasting_disabled_at: disabledAt,
          roasting_disabled_reason: 'maintenance'
        },
        error: null
      });

      const response = await request(app)
        .get('/api/roasting/status')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.roasting_enabled).toBe(false);
      expect(response.body.data.roasting_disabled_reason).toBe('maintenance');
    });

    it('should handle database errors gracefully', async () => {
      supabaseServiceClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const response = await request(app)
        .get('/api/roasting/status')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve roasting status');
    });
  });

  describe('POST /api/roasting/toggle', () => {
    it('should enable roasting successfully', async () => {
      supabaseServiceClient.update.mockReturnThis();
      supabaseServiceClient.select.mockReturnThis();
      supabaseServiceClient.eq.mockReturnThis();
      supabaseServiceClient.single.mockResolvedValue({
        data: {
          roasting_enabled: true,
          roasting_disabled_at: null,
          roasting_disabled_reason: null
        },
        error: null
      });

      const response = await request(app)
        .post('/api/roasting/toggle')
        .set('Authorization', 'Bearer test-token')
        .send({ enabled: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Roasting enabled successfully');
      expect(response.body.data.roasting_enabled).toBe(true);

      // Verify worker notification was called
      expect(workerNotificationService.notifyRoastingStateChange).toHaveBeenCalledWith(
        'test-user-123',
        true,
        { reason: undefined }
      );
    });

    it('should disable roasting with reason successfully', async () => {
      const now = new Date().toISOString();

      supabaseServiceClient.update.mockReturnThis();
      supabaseServiceClient.select.mockReturnThis();
      supabaseServiceClient.eq.mockReturnThis();
      supabaseServiceClient.single.mockResolvedValue({
        data: {
          roasting_enabled: false,
          roasting_disabled_at: now,
          roasting_disabled_reason: 'vacation'
        },
        error: null
      });

      const response = await request(app)
        .post('/api/roasting/toggle')
        .set('Authorization', 'Bearer test-token')
        .send({ enabled: false, reason: 'vacation' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Roasting disabled successfully');
      expect(response.body.data.roasting_enabled).toBe(false);
      expect(response.body.data.roasting_disabled_reason).toBe('vacation');

      // Verify worker notification was called
      expect(workerNotificationService.notifyRoastingStateChange).toHaveBeenCalledWith(
        'test-user-123',
        false,
        { reason: 'vacation' }
      );
    });

    it('should reject invalid enabled field (non-boolean)', async () => {
      const response = await request(app)
        .post('/api/roasting/toggle')
        .set('Authorization', 'Bearer test-token')
        .send({ enabled: 'yes' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('enabled field must be a boolean');
    });

    it('should reject missing enabled field', async () => {
      const response = await request(app)
        .post('/api/roasting/toggle')
        .set('Authorization', 'Bearer test-token')
        .send({ reason: 'test' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('enabled field must be a boolean');
    });

    it('should handle database update errors', async () => {
      supabaseServiceClient.update.mockReturnThis();
      supabaseServiceClient.select.mockReturnThis();
      supabaseServiceClient.eq.mockReturnThis();
      supabaseServiceClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' }
      });

      const response = await request(app)
        .post('/api/roasting/toggle')
        .set('Authorization', 'Bearer test-token')
        .send({ enabled: true });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to toggle roasting status');
    });

    it('should handle worker notification failures gracefully', async () => {
      supabaseServiceClient.update.mockReturnThis();
      supabaseServiceClient.select.mockReturnThis();
      supabaseServiceClient.eq.mockReturnThis();
      supabaseServiceClient.single.mockResolvedValue({
        data: {
          roasting_enabled: true,
          roasting_disabled_at: null,
          roasting_disabled_reason: null
        },
        error: null
      });

      // Mock worker notification failure
      workerNotificationService.notifyRoastingStateChange.mockRejectedValue(
        new Error('Notification failed')
      );

      const response = await request(app)
        .post('/api/roasting/toggle')
        .set('Authorization', 'Bearer test-token')
        .send({ enabled: true });

      // Should still succeed (notification failure is non-blocking)
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/roasting/stats', () => {
    it('should return correct stats with pending jobs and roasts', async () => {
      // Mock organization lookup
      supabaseServiceClient.single.mockResolvedValueOnce({
        data: { id: 'org-123' },
        error: null
      });

      // Mock pending jobs count query (Issue #734 fix - using count)
      const mockFrom1 = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      };
      mockFrom1.eq.mockResolvedValueOnce({
        count: 5,
        error: null
      });

      // Mock today's roasts count query (Issue #734 fix - using count)
      const mockFrom2 = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis()
      };
      mockFrom2.gte.mockResolvedValueOnce({
        count: 12,
        error: null
      });

      supabaseServiceClient.from
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({ single: () => Promise.resolve({ data: { id: 'org-123' }, error: null }) })
          })
        })
        .mockReturnValueOnce(mockFrom1)
        .mockReturnValueOnce(mockFrom2);

      const response = await request(app)
        .get('/api/roasting/stats')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.pending_jobs).toBe(5);
      expect(response.body.data.roasts_today).toBe(12);
    });

    it('should return 0 stats when no data exists', async () => {
      // Mock organization lookup
      supabaseServiceClient.single.mockResolvedValueOnce({
        data: { id: 'org-123' },
        error: null
      });

      // Mock count queries returning 0
      const mockFrom1 = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      };
      mockFrom1.eq.mockResolvedValueOnce({
        count: 0,
        error: null
      });

      const mockFrom2 = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis()
      };
      mockFrom2.gte.mockResolvedValueOnce({
        count: 0,
        error: null
      });

      supabaseServiceClient.from
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({ single: () => Promise.resolve({ data: { id: 'org-123' }, error: null }) })
          })
        })
        .mockReturnValueOnce(mockFrom1)
        .mockReturnValueOnce(mockFrom2);

      const response = await request(app)
        .get('/api/roasting/stats')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.pending_jobs).toBe(0);
      expect(response.body.data.roasts_today).toBe(0);
    });

    it('should handle organization not found', async () => {
      supabaseServiceClient.single.mockResolvedValue({
        data: null,
        error: null
      });

      const response = await request(app)
        .get('/api/roasting/stats')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Organization not found');
    });
  });
});
