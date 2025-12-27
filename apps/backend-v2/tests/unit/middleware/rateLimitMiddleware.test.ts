/**
 * Rate limit middleware v2 - tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockRecordAttempt = vi.fn();

vi.mock('../../../src/services/rateLimitService', () => ({
  rateLimitService: {
    recordAttempt: mockRecordAttempt
  }
}));

describe('middleware/rateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rateLimitByType devuelve 429 en bloqueo permanente', async () => {
    mockRecordAttempt.mockReturnValueOnce({ allowed: false, blockedUntil: null });

    const { rateLimitByType } = await import('../../../src/middleware/rateLimit');

    const app = express();
    app.get('/x', rateLimitByType('login'), (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/x');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBeDefined();
    expect(res.body.error.retry_after).toBeNull();
  });

  it('rateLimitByType devuelve 429 en bloqueo temporal', async () => {
    mockRecordAttempt.mockReturnValueOnce({ allowed: false, blockedUntil: Date.now() + 10_000 });

    const { rateLimitByType } = await import('../../../src/middleware/rateLimit');

    const app = express();
    app.get('/x', rateLimitByType('login'), (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/x');
    expect(res.status).toBe(429);
    expect(res.body.error.retry_after).toBeGreaterThan(0);
  });

  it('rateLimitByType deja pasar cuando allowed=true', async () => {
    mockRecordAttempt.mockReturnValueOnce({ allowed: true, remaining: 1 });

    const { rateLimitByType } = await import('../../../src/middleware/rateLimit');

    const app = express();
    app.get('/x', rateLimitByType('login'), (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/x');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rateLimitByIp bloquea cuando excede maxAttempts', async () => {
    const { rateLimitByIp } = await import('../../../src/middleware/rateLimit');

    const app = express();
    app.get(
      '/x',
      rateLimitByIp({ windowMs: 60_000, maxAttempts: 1 }),
      (_req, res) => res.json({ ok: true })
    );

    await request(app).get('/x'); // 1st ok
    const res2 = await request(app).get('/x'); // 2nd blocked
    expect(res2.status).toBe(429);
  });
});

