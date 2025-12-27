/**
 * Auth middleware v2 - unit-ish tests with express
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../../src/services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn()
  }
}));

describe('middleware/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requireAuth devuelve 401 si falta Authorization', async () => {
    const { requireAuth } = await import('../../../src/middleware/auth');

    const app = express();
    app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBeDefined();
  });

  it('requireAuth adjunta req.user y permite pasar', async () => {
    const { authService } = await import('../../../src/services/authService');
    vi.mocked(authService.getCurrentUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'user@example.com',
      role: 'user',
      email_verified: true
    } as any);

    const { requireAuth } = await import('../../../src/middleware/auth');

    const app = express();
    app.get('/protected', requireAuth, (req, res) => res.json({ user: req.user }));

    const res = await request(app).get('/protected').set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('user@example.com');
  });

  it('requireRole bloquea si el rol no está permitido', async () => {
    const { requireRole } = await import('../../../src/middleware/auth');

    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = {
        id: 'u1',
        email: 'user@example.com',
        role: 'user',
        email_verified: true
      };
      next();
    });
    app.get('/admin', requireRole('admin'), (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/admin');
    expect(res.status).toBe(403);
  });

  it('requireRole devuelve 401 si no hay usuario autenticado', async () => {
    const { requireRole } = await import('../../../src/middleware/auth');

    const app = express();
    app.get('/admin', requireRole('admin'), (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/admin');
    expect(res.status).toBe(401);
  });

  it('requireAuth devuelve 401 si Authorization no es Bearer', async () => {
    const { requireAuth } = await import('../../../src/middleware/auth');

    const app = express();
    app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/protected').set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
  });

  it('optionalAuth no falla si el token es inválido', async () => {
    const { authService } = await import('../../../src/services/authService');
    vi.mocked(authService.getCurrentUser).mockRejectedValueOnce(new Error('bad token'));

    const { optionalAuth } = await import('../../../src/middleware/auth');

    const app = express();
    app.get('/maybe', optionalAuth, (req, res) => res.json({ user: req.user || null }));

    const res = await request(app).get('/maybe').set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it('optionalAuth continúa sin Authorization', async () => {
    const { optionalAuth } = await import('../../../src/middleware/auth');

    const app = express();
    app.get('/maybe', optionalAuth, (req, res) => res.json({ user: req.user || null }));

    const res = await request(app).get('/maybe');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});
