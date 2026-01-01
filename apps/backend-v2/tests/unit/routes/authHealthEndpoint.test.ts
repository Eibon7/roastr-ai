/**
 * Auth Health Endpoint Tests
 * 
 * Tests de infraestructura:
 * - Endpoint accesible (public)
 * - Response format correcto
 * - Status codes apropiados
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRouter from '../../../src/routes/auth';

// Mock authService
vi.mock('../../../src/services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn()
  }
}));

// Mock loadSettings
vi.mock('../../../src/lib/loadSettings', () => ({
  loadSettings: vi.fn()
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    error: vi.fn()
  }
}));

describe('GET /auth/health', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
  });

  it('should return 200 OK when all services healthy', async () => {
    const { authService } = await import('../../../src/services/authService');
    const { loadSettings } = await import('../../../src/lib/loadSettings');

    // Supabase check (throws expected error but is reachable)
    vi.mocked(authService.getCurrentUser).mockRejectedValueOnce(
      new (await import('../../../src/utils/authErrorTaxonomy')).AuthError(
        'TOKEN_INVALID' as any
      )
    );

    // Settings loader OK
    vi.mocked(loadSettings).mockResolvedValueOnce({} as any);

    const res = await request(app).get('/auth/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      supabase: 'ok',
      ssot: 'ok'
    });
    expect(res.body.timestamp).toBeDefined();
  });

  it('should return 503 when services degraded', async () => {
    const { authService } = await import('../../../src/services/authService');
    const { loadSettings } = await import('../../../src/lib/loadSettings');

    // Supabase OK
    vi.mocked(authService.getCurrentUser).mockRejectedValueOnce(
      new (await import('../../../src/utils/authErrorTaxonomy')).AuthError(
        'TOKEN_INVALID' as any
      )
    );

    // Settings loader fails
    vi.mocked(loadSettings).mockRejectedValueOnce(new Error('Settings unavailable'));

    const res = await request(app).get('/auth/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      status: 'degraded',
      supabase: 'ok',
      ssot: 'error'
    });
  });

  it('should be accessible without authentication', async () => {
    const { authService } = await import('../../../src/services/authService');
    const { loadSettings } = await import('../../../src/lib/loadSettings');

    vi.mocked(authService.getCurrentUser).mockRejectedValueOnce(
      new (await import('../../../src/utils/authErrorTaxonomy')).AuthError(
        'TOKEN_INVALID' as any
      )
    );
    vi.mocked(loadSettings).mockResolvedValueOnce({} as any);

    // No Authorization header
    const res = await request(app).get('/auth/health');

    expect(res.status).toBe(200);
  });
});

