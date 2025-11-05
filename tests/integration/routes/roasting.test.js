/**
 * Tests for Roasting Control Routes (Issue #596)
 */

const request = require('supertest');
const express = require('express');
const roastingRoutes = require('../../src/routes/roasting');
const { supabaseServiceClient } = require('../../src/config/supabase');
const workerNotificationService = require('../../src/services/workerNotificationService');

// Mock dependencies
jest.mock('../../src/config/supabase');
jest.mock('../../src/services/workerNotificationService');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock authentication middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }
}));

describe('Roasting Control Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/roasting', roastingRoutes);

    jest.clearAllMocks();
  });

  describe('GET /api/roasting/status', () => {
    it('should return roasting status for authenticated user', async () => {
      const mockUserData = {
        roasting_enabled: true,
        roasting_disabled_at: null,
        roasting_disabled_reason: null
      };

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUserData,
              error: null
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/roasting/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.roasting_enabled).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error')
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/roasting/status')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/roasting/toggle', () => {
    it('should enable roasting successfully', async () => {
      const mockUpdatedData = {
        roasting_enabled: true,
        roasting_disabled_at: null,
        roasting_disabled_reason: null
      };

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdatedData,
                error: null
              })
            })
          })
        })
      });

      workerNotificationService.notifyRoastingStateChange = jest.fn().mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/roasting/toggle')
        .send({ enabled: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.roasting_enabled).toBe(true);
      expect(workerNotificationService.notifyRoastingStateChange).toHaveBeenCalledWith(
        'test-user-id',
        true,
        { reason: undefined }
      );
    });

    it('should disable roasting with reason', async () => {
      const mockUpdatedData = {
        roasting_enabled: false,
        roasting_disabled_at: new Date().toISOString(),
        roasting_disabled_reason: 'user_request'
      };

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdatedData,
                error: null
              })
            })
          })
        })
      });

      workerNotificationService.notifyRoastingStateChange = jest.fn().mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/roasting/toggle')
        .send({ enabled: false, reason: 'user_request' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.roasting_enabled).toBe(false);
      expect(response.body.data.roasting_disabled_reason).toBe('user_request');
    });

    it('should reject invalid enabled field', async () => {
      const response = await request(app)
        .post('/api/roasting/toggle')
        .send({ enabled: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('boolean');
    });
  });

  describe('GET /api/roasting/stats', () => {
    it('should return roasting statistics', async () => {
      // Mock organization lookup
      supabaseServiceClient.from = jest.fn((tableName) => {
        if (tableName === 'organizations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'test-org-id' },
                  error: null
                })
              })
            })
          };
        }
        if (tableName === 'job_queue') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              gte: jest.fn().mockResolvedValue({
                data: null,
                error: null,
                count: 5
              })
            })
          };
        }
        if (tableName === 'responses') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              gte: jest.fn().mockResolvedValue({
                data: null,
                error: null,
                count: 10
              })
            })
          };
        }
      });

      const response = await request(app)
        .get('/api/roasting/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pending_jobs).toBeDefined();
      expect(response.body.data.roasts_today).toBeDefined();
    });
  });
});
