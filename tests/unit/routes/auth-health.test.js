/**
 * Unit tests for Auth Health Check Endpoint
 * ROA-524: Session Refresh and Health Check Completion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock dependencies before importing
vi.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: vi.fn()
  }
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    error: vi.fn()
  }
}));

describe('Auth Health Check Endpoint - ROA-524', () => {
  let app;
  let authRouter;
  let flags;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import after mocks are set
    const flagsModule = await import('../../../src/config/flags.js');
    flags = flagsModule.flags;

    // Setup default flags
    flags.isEnabled.mockImplementation((flag) => {
      const enabledFlags = {
        ENABLE_SESSION_REFRESH: true,
        ENABLE_MAGIC_LINK: true,
        ENABLE_PASSWORD_HISTORY: true,
        ENABLE_RATE_LIMIT: true,
        ENABLE_CSRF_PROTECTION: true,
        ENABLE_SUPABASE: true,
        ENABLE_EMAIL_NOTIFICATIONS: false
      };
      return enabledFlags[flag] || false;
    });

    // Create minimal Express app for testing
    app = express();
    app.use(express.json());

    // Import and mount auth router
    const authRouterModule = await import('../../../src/routes/auth.js');
    authRouter = authRouterModule.default || authRouterModule;
    app.use('/api/auth', authRouter);
  });

  describe('GET /api/auth/health', () => {
    it('should return 200 with health status', async () => {
      const response = await request(app).get('/api/auth/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('features');
      expect(response.body).toHaveProperty('services');
    });

    it('should report feature flags correctly', async () => {
      const response = await request(app).get('/api/auth/health');

      expect(response.body.features).toEqual({
        sessionRefresh: 'enabled',
        magicLink: 'enabled',
        passwordHistory: 'enabled',
        rateLimit: 'enabled',
        csrfProtection: 'enabled'
      });
    });

    it('should report service availability', async () => {
      const response = await request(app).get('/api/auth/health');

      expect(response.body.services).toEqual({
        supabase: 'available',
        email: 'unavailable'
      });
    });

    it('should report disabled features correctly', async () => {
      flags.isEnabled.mockImplementation(() => false);

      const response = await request(app).get('/api/auth/health');

      expect(response.body.features.sessionRefresh).toBe('disabled');
      expect(response.body.features.magicLink).toBe('disabled');
    });

    it('should report mock mode for services', async () => {
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_SUPABASE') return false;
        return true;
      });

      const response = await request(app).get('/api/auth/health');

      expect(response.body.services.supabase).toBe('mock');
    });

    it('should include timestamp in ISO format', async () => {
      const response = await request(app).get('/api/auth/health');

      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should be accessible without authentication', async () => {
      // No auth headers provided
      const response = await request(app).get('/api/auth/health');

      // Should still return 200 (public endpoint)
      expect(response.status).toBe(200);
    });
  });
});
