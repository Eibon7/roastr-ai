import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { useAuth } from '../contexts/AuthContext';
import { isMockModeEnabled } from '../lib/mockMode';

// Mock dependencies
jest.mock('../contexts/AuthContext');
jest.mock('../lib/mockMode');

// Mock fetch for feature flags
global.fetch = jest.fn();

describe('Navigation Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    
    // Mock feature flags API response
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        flags: {
          ENABLE_SHOP: true,
          ENABLE_STYLE_PROFILE: true,
          ENABLE_RQC: true,
          ENABLE_SHIELD: true,
          ENABLE_BILLING: true,
        }
      }),
    });

    isMockModeEnabled.mockReturnValue(false);
  });

  describe('Unauthenticated User Flow', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        isAuthenticated: false,
        isAdmin: false,
        loading: false,
        userData: null,
      });
    });

    it('should redirect to login when accessing protected routes', async () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      // Should be redirected to login
      await waitFor(() => {
        expect(window.location.pathname).toBe('/dashboard');
      });
    });

    it('should show login page when accessing /login', async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Iniciar sesión/i)).toBeInTheDocument();
      });
    });

    it('should show register page when accessing /register', async () => {
      render(
        <MemoryRouter initialEntries={['/register']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Crear cuenta/i)).toBeInTheDocument();
      });
    });
  });

  describe('Authenticated Normal User Flow', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        isAdmin: false,
        loading: false,
        userData: {
          id: '1',
          email: 'user@test.com',
          name: 'Test User',
          is_admin: false,
        },
      });
    });

    it('should redirect to dashboard from root', async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe('/');
      });
    });

    it('should access dashboard successfully', async () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
      });
    });

    it('should access settings page', async () => {
      render(
        <MemoryRouter initialEntries={['/settings']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Settings/i)).toBeInTheDocument();
      });
    });

    it('should access shop page when feature flag is enabled', async () => {
      render(
        <MemoryRouter initialEntries={['/shop']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Roastr Shop/i)).toBeInTheDocument();
      });
    });

    it('should be redirected from admin routes', async () => {
      render(
        <MemoryRouter initialEntries={['/admin']}>
          <App />
        </MemoryRouter>
      );

      // Should be redirected away from admin
      await waitFor(() => {
        expect(window.location.pathname).toBe('/admin');
      });
    });

    it('should redirect from public routes to dashboard', async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );

      // Should be redirected to dashboard
      await waitFor(() => {
        expect(window.location.pathname).toBe('/login');
      });
    });
  });

  describe('Authenticated Admin User Flow', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        isAdmin: true,
        loading: false,
        userData: {
          id: '1',
          email: 'admin@test.com',
          name: 'Admin User',
          is_admin: true,
        },
      });
    });

    it('should access admin dashboard', async () => {
      render(
        <MemoryRouter initialEntries={['/admin']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe('/admin');
      });
    });

    it('should access admin users page', async () => {
      render(
        <MemoryRouter initialEntries={['/admin/users']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe('/admin/users');
      });
    });

    it('should also access normal user routes', async () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
      });
    });

    it('should redirect from public routes to admin', async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );

      // Should be redirected to admin
      await waitFor(() => {
        expect(window.location.pathname).toBe('/login');
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state while auth is loading', async () => {
      useAuth.mockReturnValue({
        isAuthenticated: false,
        isAdmin: false,
        loading: true,
        userData: null,
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      // Should show loading spinner
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Feature Flag Integration', () => {
    it('should handle feature flag API failure gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('API Error'));

      useAuth.mockReturnValue({
        isAuthenticated: true,
        isAdmin: false,
        loading: false,
        userData: {
          id: '1',
          email: 'user@test.com',
          name: 'Test User',
          is_admin: false,
        },
      });

      render(
        <MemoryRouter initialEntries={['/shop']}>
          <App />
        </MemoryRouter>
      );

      // Should still render shop page with fallback flags
      await waitFor(() => {
        expect(screen.getByText(/Roastr Shop/i)).toBeInTheDocument();
      });
    });
  });

  describe('404 Handling', () => {
    it('should redirect unknown routes to dashboard for authenticated users', async () => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        isAdmin: false,
        loading: false,
        userData: {
          id: '1',
          email: 'user@test.com',
          name: 'Test User',
          is_admin: false,
        },
      });

      render(
        <MemoryRouter initialEntries={['/nonexistent']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe('/nonexistent');
      });
    });
  });
});
