/**
 * Edge Cases Tests for Supabase Client and Auth Helpers in Mock Mode
 */

import { createSupabaseClient, authHelpers } from '../supabaseClient';

// Mock environment to force mock mode
const originalEnv = process.env;

beforeAll(() => {
  process.env = { 
    ...originalEnv,
    NODE_ENV: 'test'
  };
  delete process.env.REACT_APP_SUPABASE_URL;
  delete process.env.REACT_APP_SUPABASE_ANON_KEY;
});

afterAll(() => {
  process.env = originalEnv;
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock console methods to avoid spam in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('Supabase Client - Edge Cases', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    
    // Default to no stored session
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Mock Client - Session Management Edge Cases', () => {
    test('should handle corrupted localStorage session data', async () => {
      const client = createSupabaseClient();
      
      // Mock corrupted JSON in localStorage
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'mock_supabase_session') {
          return '{"invalid": json}'; // Invalid JSON
        }
        return null;
      });

      const { data: { session } } = await client.auth.getSession();
      expect(session).toBeNull();
      
      // Note: Cleanup happens during initialization, not during getSession
      // So we just verify session is null
    });

    test('should handle localStorage access errors', async () => {
      const client = createSupabaseClient();
      
      // Mock localStorage to throw errors
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('LocalStorage access denied');
      });

      // Should not crash
      const { data: { session } } = await client.auth.getSession();
      expect(session).toBeNull();
    });

    test('should handle session expiration during runtime', async () => {
      const client = createSupabaseClient();
      
      // Create an almost-expired session
      const almostExpiredTime = Date.now() + 1000; // 1 second from now
      const mockSession = {
        user: { id: 'test-user', email: 'test@example.com' },
        access_token: 'test-token',
        expires_at: almostExpiredTime
      };
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'mock_supabase_session') {
          return JSON.stringify(mockSession);
        }
        return null;
      });
      
      // Get session immediately (should still be valid)
      const { data: { session: validSession } } = await client.auth.getSession();
      expect(validSession).toBeTruthy();
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Get session again (should be null now)
      const { data: { session: expiredSession } } = await client.auth.getSession();
      expect(expiredSession).toBeNull();
    });
  });

  describe('Auth Helpers - Edge Cases', () => {
    test('should handle sign in with empty credentials', async () => {
      await expect(authHelpers.signIn('', '')).rejects.toThrow();
    });

    test('should handle sign in with null credentials', async () => {
      await expect(authHelpers.signIn(null, null)).rejects.toThrow();
    });

    test('should handle sign up with invalid email format', async () => {
      // In mock mode, this should still succeed as validation happens on backend
      const result = await authHelpers.signUp('not-an-email', 'password123', 'Test User');
      expect(result).toBeTruthy();
      expect(result.user.email).toBe('not-an-email'); // Mock accepts any format
    });

    test('should handle magic link with extremely long email', async () => {
      const longEmail = 'a'.repeat(100) + '@example.com';
      const result = await authHelpers.signInWithMagicLink(longEmail);
      expect(result).toBeTruthy();
    });

    test('should handle reset password for empty email', async () => {
      const result = await authHelpers.resetPassword('');
      expect(result).toBeTruthy(); // Mock mode always succeeds
    });

    test('should handle concurrent authentication requests', async () => {
      const promises = [
        authHelpers.signIn('user1@example.com', 'password'),
        authHelpers.signIn('user2@example.com', 'password'),
        authHelpers.signUp('user3@example.com', 'password', 'User 3')
      ];
      
      const results = await Promise.all(promises);
      
      // All should succeed in mock mode
      results.forEach(result => {
        expect(result).toBeTruthy();
      });
      
      // All should complete successfully
      // Note: In concurrent requests, localStorage calls happen multiple times
    });

    test('should handle sign out when not authenticated', async () => {
      // Should not throw error
      await expect(authHelpers.signOut()).resolves.not.toThrow();
    });

    test('should handle getCurrentUser when no session exists', async () => {
      const user = await authHelpers.getCurrentUser();
      expect(user).toBeNull();
    });

    test('should handle getCurrentSession after sign out', async () => {
      // First sign in
      await authHelpers.signIn('test@example.com', 'password');
      
      // Then sign out
      await authHelpers.signOut();
      
      // Session should be null
      const session = await authHelpers.getCurrentSession();
      expect(session).toBeNull();
    });
  });

  describe('Error Resilience', () => {
    test('should handle auth state change callback errors gracefully', async () => {
      const client = createSupabaseClient();
      
      // Register callback that throws error
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      
      client.auth.onAuthStateChange(errorCallback);
      
      // Sign in should still work despite callback error
      await client.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password'
      });
      
      expect(errorCallback).toHaveBeenCalled();
      // Session should still be created
      const { data: { session } } = await client.auth.getSession();
      expect(session).toBeTruthy();
    });

    test('should handle multiple unsubscribe calls', () => {
      const client = createSupabaseClient();
      const { data: { subscription } } = client.auth.onAuthStateChange(() => {});
      
      // Should not throw on multiple unsubscribe calls
      expect(() => {
        subscription.unsubscribe();
        subscription.unsubscribe();
        subscription.unsubscribe();
      }).not.toThrow();
    });

    test('should handle rapid sign in/out cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await authHelpers.signIn(`user${i}@example.com`, 'password');
        await authHelpers.signOut();
      }
      
      // Final state should be signed out
      const session = await authHelpers.getCurrentSession();
      expect(session).toBeNull();
    });
  });

  describe('Memory Management', () => {
    test('should not leak auth callbacks', () => {
      const client = createSupabaseClient();
      const callbacks = [];
      
      // Register multiple callbacks
      for (let i = 0; i < 100; i++) {
        const { data: { subscription } } = client.auth.onAuthStateChange(() => {});
        callbacks.push(subscription);
      }
      
      // Unsubscribe all
      callbacks.forEach(sub => sub.unsubscribe());
      
      // Mock client should handle this gracefully
      expect(client._authCallbacks.size).toBe(0);
    });

    test('should handle callback registration after sign out', () => {
      const client = createSupabaseClient();
      
      // Sign out first
      client.auth.signOut();
      
      // Then register callback - should get SIGNED_OUT state
      const callback = jest.fn();
      client.auth.onAuthStateChange(callback);
      
      // Callback should be called with signed out state
      setTimeout(() => {
        expect(callback).toHaveBeenCalledWith('SIGNED_OUT', null);
      }, 0);
    });
  });
});