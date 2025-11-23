const authService = require('../../../src/services/authService');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

// Mock Supabase clients
jest.mock('../../../src/config/supabase', () => ({
  supabaseAnonClient: {
    auth: {
      resetPasswordForEmail: jest.fn(),
      signInWithOtp: jest.fn()
    }
  }
}));

const { supabaseAnonClient } = require('../../../src/config/supabase');

describe('AuthService Password Recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resetPassword', () => {
    it('should send password reset email successfully', async () => {
      supabaseAnonClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null
      });

      const result = await authService.resetPassword('test@example.com');

      expect(result.message).toBe('Password reset email sent');
      expect(result.email).toBe('test@example.com');
      expect(supabaseAnonClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com'
      );
    });

    it('should handle password reset errors', async () => {
      supabaseAnonClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { message: 'User not found' }
      });

      await expect(authService.resetPassword('nonexistent@example.com')).rejects.toThrow(
        'Password reset failed: User not found'
      );
    });
  });

  describe('signInWithMagicLink', () => {
    it('should send magic link successfully', async () => {
      supabaseAnonClient.auth.signInWithOtp.mockResolvedValue({
        data: {},
        error: null
      });

      const result = await authService.signInWithMagicLink('test@example.com');

      expect(result.message).toBe('Magic link sent to your email');
      expect(result.email).toBe('test@example.com');
      expect(supabaseAnonClient.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com'
      });
    });

    it('should handle magic link errors', async () => {
      supabaseAnonClient.auth.signInWithOtp.mockResolvedValue({
        data: null,
        error: { message: 'Invalid email' }
      });

      await expect(authService.signInWithMagicLink('invalid-email')).rejects.toThrow(
        'Magic link sign in failed: Invalid email'
      );
    });
  });

  describe('signUpWithMagicLink', () => {
    it('should send signup magic link successfully', async () => {
      supabaseAnonClient.auth.signInWithOtp.mockResolvedValue({
        data: {},
        error: null
      });

      const result = await authService.signUpWithMagicLink({
        email: 'newuser@example.com',
        name: 'New User'
      });

      expect(result.message).toBe('Magic link sent to your email');
      expect(result.email).toBe('newuser@example.com');
      expect(supabaseAnonClient.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        options: {
          data: {
            name: 'New User'
          }
        }
      });
    });

    it('should handle signup magic link errors', async () => {
      supabaseAnonClient.auth.signInWithOtp.mockResolvedValue({
        data: null,
        error: { message: 'Email service unavailable' }
      });

      await expect(
        authService.signUpWithMagicLink({
          email: 'test@example.com'
        })
      ).rejects.toThrow('Magic link signup failed: Email service unavailable');
    });
  });
});
