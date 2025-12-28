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
    expect(res.body.success).toBe(false);
    expect(res.body.error.slug).toBe('POLICY_RATE_LIMITED');
    expect(res.body.error.retryable).toBe(true);
    expect(res.body.request_id).toBeTypeOf('string');
  });

  it('rateLimitByType devuelve 429 en bloqueo temporal', async () => {
    mockRecordAttempt.mockReturnValueOnce({ allowed: false, blockedUntil: Date.now() + 10_000 });

    const { rateLimitByType } = await import('../../../src/middleware/rateLimit');

    const app = express();
    app.get('/x', rateLimitByType('login'), (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/x');
    expect(res.status).toBe(429);
    // Retry-After header in seconds for backoff
    expect(res.headers['retry-after']).toBeDefined();
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
    app.get('/x', rateLimitByIp({ windowMs: 60_000, maxAttempts: 1 }), (_req, res) =>
      res.json({ ok: true })
    );

    await request(app).get('/x'); // 1st ok
    const res2 = await request(app).get('/x'); // 2nd blocked
    expect(res2.status).toBe(429);
  });
});
