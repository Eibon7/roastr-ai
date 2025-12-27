/**
 * Settings routes (public) - coverage test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../src/lib/loadSettings', () => ({
  getPublicSettings: vi.fn()
}));

describe('GET /api/v2/settings/public', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve settings públicos (200)', async () => {
    const { getPublicSettings } = await import('../../src/lib/loadSettings');
    vi.mocked(getPublicSettings).mockResolvedValueOnce({
      plans: { starter: { monthly_limit: 100, features: ['basic_roasting'] } }
    } as any);

    const { default: settingsRoutes } = await import('../../src/routes/settings');

    const app = express();
    app.use('/api/v2/settings', settingsRoutes);

    const res = await request(app).get('/api/v2/settings/public');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plans.starter.monthly_limit).toBe(100);
  });

  it('maneja error interno (500)', async () => {
    const { getPublicSettings } = await import('../../src/lib/loadSettings');
    vi.mocked(getPublicSettings).mockRejectedValueOnce(new Error('boom'));

    const { default: settingsRoutes } = await import('../../src/routes/settings');

    const app = express();
    app.use('/api/v2/settings', settingsRoutes);

    const res = await request(app).get('/api/v2/settings/public');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

