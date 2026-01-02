/**
 * OAuth Infra Tests
 *
 * Tests de infraestructura (sin providers reales):
 * - Feature flag validation
 * - Provider enum validation
 * - Error contracts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import oauthRouter from '../../../src/routes/oauth';

// Mock authFlags
vi.mock('../../../src/lib/authFlags', () => ({
  isAuthEndpointEnabled: vi.fn()
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn()
  }
}));

describe('OAuth Infra Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/v2/auth', oauthRouter); // Mount under /api/v2/auth like production
  });

  describe('POST /api/v2/auth/oauth/:provider', () => {
    it('should block when feature flag disabled', async () => {
      const { isAuthEndpointEnabled } = await import('../../../src/lib/authFlags');

      vi.mocked(isAuthEndpointEnabled).mockRejectedValueOnce(
        new (await import('../../../src/utils/authErrorTaxonomy')).AuthError('AUTH_DISABLED' as any)
      );

      const res = await request(app).post('/api/v2/auth/oauth/x');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe('AUTH_DISABLED');
    });

    it('should reject unsupported provider', async () => {
      const { isAuthEndpointEnabled } = await import('../../../src/lib/authFlags');

      vi.mocked(isAuthEndpointEnabled).mockResolvedValueOnce(true);

      const res = await request(app).post('/api/v2/auth/oauth/unsupported-provider');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe('POLICY_INVALID_REQUEST');
    });

    it('should return 501 for supported but unimplemented provider', async () => {
      const { isAuthEndpointEnabled } = await import('../../../src/lib/authFlags');

      vi.mocked(isAuthEndpointEnabled).mockResolvedValueOnce(true);

      const res = await request(app).post('/api/v2/auth/oauth/x');

      expect(res.status).toBe(501);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe('NOT_IMPLEMENTED');
      expect(res.body.error.provider).toBe('x');
    });

    it('should accept "youtube" as supported provider', async () => {
      const { isAuthEndpointEnabled } = await import('../../../src/lib/authFlags');

      vi.mocked(isAuthEndpointEnabled).mockResolvedValueOnce(true);

      const res = await request(app).post('/api/v2/auth/oauth/youtube');

      expect(res.status).toBe(501);
      expect(res.body.error.slug).toBe('NOT_IMPLEMENTED');
      expect(res.body.error.provider).toBe('youtube');
    });
  });

  describe('GET /api/v2/auth/oauth/:provider/callback', () => {
    it('should block when feature flag disabled', async () => {
      const { isAuthEndpointEnabled } = await import('../../../src/lib/authFlags');

      vi.mocked(isAuthEndpointEnabled).mockRejectedValueOnce(
        new (await import('../../../src/utils/authErrorTaxonomy')).AuthError('AUTH_DISABLED' as any)
      );

      const res = await request(app).get('/api/v2/auth/oauth/x/callback');

      expect(res.status).toBe(401);
      expect(res.body.error.slug).toBe('AUTH_DISABLED');
    });

    it('should reject unsupported provider', async () => {
      const { isAuthEndpointEnabled } = await import('../../../src/lib/authFlags');

      vi.mocked(isAuthEndpointEnabled).mockResolvedValueOnce(true);

      const res = await request(app).get('/api/v2/auth/oauth/unsupported/callback');

      expect(res.status).toBe(400);
      expect(res.body.error.slug).toBe('POLICY_INVALID_REQUEST');
    });

    it('should return 501 for supported but unimplemented callback', async () => {
      const { isAuthEndpointEnabled } = await import('../../../src/lib/authFlags');

      vi.mocked(isAuthEndpointEnabled).mockResolvedValueOnce(true);

      const res = await request(app).get('/api/v2/auth/oauth/x/callback');

      expect(res.status).toBe(501);
      expect(res.body.error.slug).toBe('NOT_IMPLEMENTED');
    });
  });
});
