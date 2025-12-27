/**
 * Auth Register Endpoint Tests v2 (ROA-374)
 *
 * Valida el contrato de:
 * POST /api/v2/auth/register
 *
 * Reglas:
 * - Anti-enumeration: responde { success: true } incluso si el email ya existe
 * - Feature flag: feature_flags.enable_user_registration
 * - Validación: email requerido/normalizado, password >= 8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/lib/analytics', () => ({
  initializeAmplitude: vi.fn()
}));

// Mock loadSettings (feature flags)
vi.mock('../../src/lib/loadSettings', () => ({
  loadSettings: vi.fn()
}));

// Mock Supabase client
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
const mockSignUp = vi.fn();

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp
    },
    from: mockFrom
  }
}));

describe('POST /api/v2/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 404 cuando el feature flag está OFF', async () => {
    const { loadSettings } = await import('../../src/lib/loadSettings');
    vi.mocked(loadSettings).mockResolvedValueOnce({
      feature_flags: {
        enable_user_registration: false
      }
    } as any);

    const { default: app } = await import('../../src/index');

    const res = await request(app).post('/api/v2/auth/register').send({
      email: 'user@example.com',
      password: 'ValidPassword123'
    });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' }
    });
  });

  it('devuelve 400 si el payload es inválido', async () => {
    const { loadSettings } = await import('../../src/lib/loadSettings');
    vi.mocked(loadSettings).mockResolvedValueOnce({
      feature_flags: {
        enable_user_registration: true
      }
    } as any);

    const { default: app } = await import('../../src/index');

    const res = await request(app).post('/api/v2/auth/register').send({
      email: '',
      password: 'short'
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' }
    });
  });

  it('registra email nuevo y responde homogéneo { success: true }', async () => {
    const { loadSettings } = await import('../../src/lib/loadSettings');
    vi.mocked(loadSettings).mockResolvedValueOnce({
      feature_flags: {
        enable_user_registration: true
      }
    } as any);

    mockSignUp.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user_123',
          email: 'user@example.com',
          created_at: new Date().toISOString(),
          user_metadata: { role: 'user' }
        },
        session: null
      },
      error: null
    });

    mockInsert.mockResolvedValueOnce({ error: null });

    const { default: app } = await import('../../src/index');

    const res = await request(app).post('/api/v2/auth/register').send({
      email: 'USER@EXAMPLE.COM',
      password: 'ValidPassword123'
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        password: 'ValidPassword123'
      })
    );
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user_123',
        username: 'user@example.com',
        onboarding_state: 'welcome'
      })
    );
  });

  it('si el email ya existe, NO lo revela y responde { success: true }', async () => {
    const { loadSettings } = await import('../../src/lib/loadSettings');
    vi.mocked(loadSettings).mockResolvedValueOnce({
      feature_flags: {
        enable_user_registration: true
      }
    } as any);

    mockSignUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: {
        message: 'User already registered'
      }
    });

    const { default: app } = await import('../../src/index');

    const res = await request(app).post('/api/v2/auth/register').send({
      email: 'user@example.com',
      password: 'ValidPassword123'
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('devuelve 500 ante error técnico no recuperable', async () => {
    const { loadSettings } = await import('../../src/lib/loadSettings');
    vi.mocked(loadSettings).mockResolvedValueOnce({
      feature_flags: {
        enable_user_registration: true
      }
    } as any);

    mockSignUp.mockRejectedValueOnce(new Error('Network down'));

    const { default: app } = await import('../../src/index');

    const res = await request(app).post('/api/v2/auth/register').send({
      email: 'user@example.com',
      password: 'ValidPassword123'
    });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'INTERNAL_ERROR' }
    });
  });
});

