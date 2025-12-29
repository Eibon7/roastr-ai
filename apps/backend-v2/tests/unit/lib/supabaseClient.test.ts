/**
 * Supabase Client - Unit Tests v2
 *
 * Cubre:
 * - Inicialización correcta con env vars requeridas
 * - Error claro si faltan env vars
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('supabaseClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('lanza error si faltan variables de entorno requeridas', async () => {
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';

    await expect(import('../../../src/lib/supabaseClient')).rejects.toThrow(
      /Missing required Supabase environment variables/
    );
  });

  it('crea el cliente de Supabase con config esperada', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const createClient = vi.fn(() => ({ mocked: true }));
    vi.doMock('@supabase/supabase-js', () => ({
      createClient
    }));

    const mod = await import('../../../src/lib/supabaseClient');

    expect(mod.supabase).toBeDefined();
    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'service-role-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: false
        })
      })
    );
  });
});
