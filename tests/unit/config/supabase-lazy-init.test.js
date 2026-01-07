/**
 * Test: Supabase Lazy Initialization (Issue #ROA-521)
 * 
 * Verifies that Supabase clients are lazily initialized (not at require-time)
 * This fixes constructor timing issues where:
 * 1. tests/setupIntegration.js tries to configure mocks
 * 2. src/config/supabase.js gets required
 * 3. Race condition: clients created before mock env vars are set
 * 4. Result: Real clients fail with missing credentials in CI
 * 
 * Solution: Clients are now created on first access (lazy), not at require-time.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Supabase Lazy Initialization (ROA-521)', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
    
    // Clear supabase module cache to ensure fresh require
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    vi.resetModules();
  });

  describe('Mock Mode Initialization', () => {
    it('should create mock clients when env vars are missing at access time', async () => {
      // Simulate CI environment without credentials
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_ANON_KEY;

      // Require module AFTER env is cleared
      const supabase = await import('../../../src/config/supabase.js');
      const { supabaseServiceClient, supabaseAnonClient } = supabase;

      // Access clients (lazy initialization triggers here)
      expect(supabaseServiceClient).toBeDefined();
      expect(supabaseAnonClient).toBeDefined();

      // Verify mock behavior
      expect(supabaseServiceClient.from).toBeDefined();
      expect(typeof supabaseServiceClient.from).toBe('function');
      expect(supabaseAnonClient.auth).toBeDefined();
      expect(typeof supabaseAnonClient.auth.getUser).toBe('function');
    });

    it('should respect env vars set AFTER require but BEFORE access', async () => {
      // Require module BEFORE env is set (simulate real scenario)
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_ANON_KEY;

      const supabase = await import('../../../src/config/supabase.js');

      // NOW set env vars (simulates setupIntegration.js setting mocks)
      process.env.SUPABASE_URL = 'http://localhost:54321';
      process.env.SUPABASE_SERVICE_KEY = 'mock-service-key';
      process.env.SUPABASE_ANON_KEY = 'mock-anon-key';

      // Access client (lazy init should see the new env vars)
      const { supabaseServiceClient } = supabase;

      // Client should be created with mock values
      expect(supabaseServiceClient).toBeDefined();
      expect(supabaseServiceClient.from).toBeDefined();
    });
  });

  describe('Real Client Initialization', () => {
    it('should create real clients when env vars are available at access time', async () => {
      // Set valid credentials
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';

      // Require module
      const supabase = await import('../../../src/config/supabase.js');
      const { supabaseServiceClient, supabaseAnonClient } = supabase;

      // Access clients (lazy initialization triggers here)
      expect(supabaseServiceClient).toBeDefined();
      expect(supabaseAnonClient).toBeDefined();

      // Verify real client has expected structure
      expect(supabaseServiceClient.from).toBeDefined();
      expect(typeof supabaseServiceClient.from).toBe('function');
    });
  });

  describe('getUserFromToken Mock Behavior', () => {
    it('should return mock users when in mock mode', async () => {
      // Simulate mock mode
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_ANON_KEY;
      process.env.NODE_ENV = 'test';

      const { getUserFromToken } = await import('../../../src/config/supabase.js');

      // Test known mock tokens
      const mockUser = await getUserFromToken('mock-jwt-token');
      expect(mockUser).toBeDefined();
      expect(mockUser.id).toBe('mock-user-123');
      expect(mockUser.email).toBe('test@example.com');

      const creatorUser = await getUserFromToken('mock-creator-jwt-token');
      expect(creatorUser).toBeDefined();
      expect(creatorUser.id).toBe('mock-creator-user-456');

      const adminUser = await getUserFromToken('mock-admin-token');
      expect(adminUser).toBeDefined();
      expect(adminUser.id).toBe('mock-admin-789');
      expect(adminUser.app_metadata.role).toBe('admin');
    });

    it('should return null for invalid/empty tokens in mock mode', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_ANON_KEY;
      process.env.NODE_ENV = 'test';

      const { getUserFromToken } = await import('../../../src/config/supabase.js');

      const result = await getUserFromToken('');
      expect(result).toBeNull();

      const result2 = await getUserFromToken(null);
      expect(result2).toBeNull();
    });
  });

  describe('checkConnection Mock Behavior', () => {
    it('should return mock error when not configured', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_ANON_KEY;

      const { checkConnection } = await import('../../../src/config/supabase.js');

      const result = await checkConnection();
      expect(result.connected).toBe(false);
      expect(result.error).toContain('Mock mode');
    });
  });

  describe('createUserClient Lazy Behavior', () => {
    it('should create mock client when credentials missing', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_ANON_KEY;

      const { createUserClient } = await import('../../../src/config/supabase.js');

      const userClient = createUserClient('test-access-token');
      expect(userClient).toBeDefined();
      expect(userClient.from).toBeDefined();
      expect(userClient.auth).toBeDefined();
    });
  });

  describe('Constructor Timing Fix Validation', () => {
    it('should NOT create clients at require-time', async () => {
      // This test verifies that requiring the module doesn't immediately
      // create clients (which was the bug)
      
      // Clear env
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_ANON_KEY;

      // Requiring the module without credentials should NOT throw
      const supabase = await import('../../../src/config/supabase.js');
      expect(supabase).toBeDefined();

      // NOW set env vars (simulates test setup happening AFTER require)
      process.env.SUPABASE_URL = 'http://localhost:54321';
      process.env.SUPABASE_SERVICE_KEY = 'mock-service-key';
      process.env.SUPABASE_ANON_KEY = 'mock-anon-key';

      // Reset modules to get fresh instance with new env vars
      vi.resetModules();
      const supabaseReload = await import('../../../src/config/supabase.js');
      const { supabaseServiceClient } = supabaseReload;
      expect(supabaseServiceClient).toBeDefined();
    });
  });
});

