/**
 * Tests for Mock Mode Detection and MockSupabaseClient
 */

import { isMockModeEnabled, isSupabaseConfigured, getMockModeStatus } from '../mockMode';
import { createSupabaseClient } from '../supabaseClient';

// Mock environment variables
const originalEnv = process.env;

describe('Mock Mode Detection', () => {
  beforeEach(() => {
    // Reset process.env for each test
    process.env = { ...originalEnv };
    
    // Clear any existing environment variables
    delete process.env.REACT_APP_SUPABASE_URL;
    delete process.env.REACT_APP_SUPABASE_ANON_KEY;
    delete process.env.REACT_APP_ENABLE_MOCK_MODE;
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('isSupabaseConfigured', () => {
    test('returns false when no Supabase variables are set', () => {
      expect(isSupabaseConfigured()).toBe(false);
    });

    test('returns false when only URL is set', () => {
      process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
      expect(isSupabaseConfigured()).toBe(false);
    });

    test('returns false when only anon key is set', () => {
      process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-key';
      expect(isSupabaseConfigured()).toBe(false);
    });

    test('returns true when both variables are set', () => {
      process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
      process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-key';
      expect(isSupabaseConfigured()).toBe(true);
    });
  });

  describe('isMockModeEnabled', () => {
    test('returns true when Supabase is not configured (forced mock mode)', () => {
      expect(isMockModeEnabled()).toBe(true);
    });

    test('returns true in test environment even when Supabase is configured', () => {
      process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
      process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-key';
      // In test environment, mock mode is always enabled
      expect(isMockModeEnabled()).toBe(true);
    });

    test('returns true when Supabase is configured but mock mode is explicitly enabled', () => {
      process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
      process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-key';
      process.env.REACT_APP_ENABLE_MOCK_MODE = 'true';
      expect(isMockModeEnabled()).toBe(true);
    });

    test('returns true in test environment even when explicit mock mode is disabled', () => {
      process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
      process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-key';
      process.env.REACT_APP_ENABLE_MOCK_MODE = 'false';
      // In test environment, mock mode is always enabled regardless of explicit setting
      expect(isMockModeEnabled()).toBe(true);
    });
  });

  describe('getMockModeStatus', () => {
    test('returns correct status when Supabase is not configured', () => {
      const status = getMockModeStatus();
      
      expect(status.enabled).toBe(true);
      expect(status.supabaseConfigured).toBe(false);
      expect(status.mockModeForced).toBe(true);
      expect(status.mockModeExplicit).toBe(false);
      // In test environment, test env reason takes priority
      expect(status.reason).toBe('Forced in test environment');
    });

    test('returns correct status when mock mode is explicitly enabled', () => {
      process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
      process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-key';
      process.env.REACT_APP_ENABLE_MOCK_MODE = 'true';
      
      const status = getMockModeStatus();
      
      expect(status.enabled).toBe(true);
      expect(status.supabaseConfigured).toBe(true);
      expect(status.mockModeForced).toBe(true); // True in test environment
      expect(status.mockModeExplicit).toBe(true);
      // In test environment, test env reason takes priority
      expect(status.reason).toBe('Forced in test environment');
    });

    test('returns correct status in test environment', () => {
      process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
      process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-key';
      
      const status = getMockModeStatus();
      
      // In test environment, mock mode is always enabled
      expect(status.enabled).toBe(true);
      expect(status.supabaseConfigured).toBe(true);
      expect(status.mockModeForced).toBe(true);
      expect(status.reason).toBe('Forced in test environment');
    });
  });

  describe('MockSupabaseClient', () => {
    let mockClient;
    const originalLocalStorage = global.localStorage;

    beforeEach(() => {
      // Force mock mode for these tests
      delete process.env.REACT_APP_SUPABASE_URL;
      delete process.env.REACT_APP_SUPABASE_ANON_KEY;
      
      // Mock localStorage
      const localStorageMock = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      global.localStorage = localStorageMock;
      
      mockClient = createSupabaseClient();
    });

    afterEach(() => {
      global.localStorage = originalLocalStorage;
      jest.clearAllMocks();
    });

    describe('Authentication Methods', () => {
      test('signInWithPassword creates mock session', async () => {
        const result = await mockClient.auth.signInWithPassword({
          email: 'test@example.com',
          password: 'password'
        });

        expect(result.data.user).toBeDefined();
        expect(result.data.session).toBeDefined();
        expect(result.data.user.email).toBe('test@example.com');
        expect(result.error).toBeNull();
      });

      test('signUp creates mock user', async () => {
        const result = await mockClient.auth.signUp({
          email: 'newuser@example.com',
          password: 'password123'
        });

        expect(result.data.user).toBeDefined();
        expect(result.data.session).toBeDefined();
        expect(result.data.user.email).toBe('newuser@example.com');
        expect(result.error).toBeNull();
      });

      test('signOut clears session', async () => {
        const result = await mockClient.auth.signOut();
        
        expect(result.error).toBeNull();
      });

      test('getSession with no stored session returns null', async () => {
        // localStorage.getItem returns null by default in our mock
        const result = await mockClient.auth.getSession();
        
        expect(result.data.session).toBeNull();
        expect(result.error).toBeNull();
      });

      test('getUser with no stored user returns null', async () => {
        // localStorage.getItem returns null by default in our mock
        const result = await mockClient.auth.getUser();
        
        expect(result.data.user).toBeNull();
        expect(result.error).toBeNull();
      });
    });

    describe('Auth State Changes', () => {
      test('onAuthStateChange sets up listener', () => {
        const callback = jest.fn();
        
        const { data: { subscription } } = mockClient.auth.onAuthStateChange(callback);
        
        expect(subscription).toBeDefined();
        expect(typeof subscription.unsubscribe).toBe('function');
      });
    });
  });
});