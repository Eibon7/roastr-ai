/**
 * Tests for AuthContext in Mock Mode
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../AuthContext';

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

// Test component to access auth context
const TestComponent = () => {
  const { user, session, userData, mockMode, signIn, signUp, signOut } = useAuth();
  
  return (
    <div>
      <div data-testid="mock-mode">{mockMode ? 'true' : 'false'}</div>
      <div data-testid="user-email">{user?.email || 'no-user'}</div>
      <div data-testid="session-status">{session ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="user-data">{userData?.name || 'no-user-data'}</div>
      
      <button 
        onClick={() => signIn('test@example.com', 'password')}
        data-testid="sign-in-btn"
      >
        Sign In
      </button>
      
      <button 
        onClick={() => signUp('newuser@example.com', 'password')}
        data-testid="sign-up-btn"
      >
        Sign Up
      </button>
      
      <button 
        onClick={signOut}
        data-testid="sign-out-btn"
      >
        Sign Out
      </button>
    </div>
  );
};

const renderWithAuth = () => {
  return render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  );
};

describe('AuthContext - Mock Mode', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    
    // Default to no stored session
    localStorageMock.getItem.mockReturnValue(null);
  });

  test('initializes with mock mode enabled', async () => {
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-mode')).toHaveTextContent('true');
    });
  });

  test('starts with no authenticated user', async () => {
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
      expect(screen.getByTestId('session-status')).toHaveTextContent('unauthenticated');
    });
  });

  test('restores session from localStorage on mount', async () => {
    const mockStoredSession = {
      user: { id: 'stored-user', email: 'stored@example.com' },
      access_token: 'stored-token',
      expires_at: Date.now() + 3600000 // 1 hour from now
    };
    
    const mockStoredUser = {
      id: 'stored-user',
      email: 'stored@example.com',
      name: 'Stored User'
    };

    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'mock_supabase_session') {
        return JSON.stringify(mockStoredSession);
      }
      if (key === 'mock_supabase_user') {
        return JSON.stringify(mockStoredUser);
      }
      return null;
    });

    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('stored@example.com');
      expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
    });
  });

  test('does not restore expired session', async () => {
    const expiredSession = {
      user: { id: 'expired-user', email: 'expired@example.com' },
      access_token: 'expired-token',
      expires_at: Date.now() - 3600000 // 1 hour ago
    };

    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'mock_supabase_session') {
        return JSON.stringify(expiredSession);
      }
      return null;
    });

    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
      expect(screen.getByTestId('session-status')).toHaveTextContent('unauthenticated');
    });
  });

  describe('Authentication Actions', () => {
    test('signIn creates mock session and user', async () => {
      const user = userEvent.setup();
      renderWithAuth();
      
      await act(async () => {
        await user.click(screen.getByTestId('sign-in-btn'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
        expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
      });
      
      // Verify localStorage was called to store session
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'mock_supabase_session', 
        expect.stringContaining('test@example.com')
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'mock_supabase_user',
        expect.stringContaining('test@example.com')
      );
    });

    test('signUp creates mock user and session', async () => {
      const user = userEvent.setup();
      renderWithAuth();
      
      await act(async () => {
        await user.click(screen.getByTestId('sign-up-btn'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('newuser@example.com');
        expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
      });
    });

    test('signOut clears user and session', async () => {
      const user = userEvent.setup();
      
      // First sign in
      renderWithAuth();
      
      await act(async () => {
        await user.click(screen.getByTestId('sign-in-btn'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
      });
      
      // Then sign out
      await act(async () => {
        await user.click(screen.getByTestId('sign-out-btn'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
        expect(screen.getByTestId('session-status')).toHaveTextContent('unauthenticated');
      });
      
      // Verify localStorage was cleared
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('mock_supabase_session');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('mock_supabase_user');
    });
  });

  describe('User Data Management', () => {
    test('loads user data after authentication', async () => {
      const user = userEvent.setup();
      renderWithAuth();
      
      await act(async () => {
        await user.click(screen.getByTestId('sign-in-btn'));
      });
      
      await waitFor(() => {
        // In mock mode, userData should be populated with mock data
        expect(screen.getByTestId('user-data')).not.toHaveTextContent('no-user-data');
      });
    });
  });

  describe('Error Handling', () => {
    test('handles localStorage errors gracefully', async () => {
      // Mock localStorage to throw errors
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('LocalStorage error');
      });
      
      // Should not crash the app
      expect(() => renderWithAuth()).not.toThrow();
      
      await waitFor(() => {
        expect(screen.getByTestId('mock-mode')).toHaveTextContent('true');
      });
    });

    test('handles invalid JSON in localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');
      
      expect(() => renderWithAuth()).not.toThrow();
      
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
      });
    });
  });
});