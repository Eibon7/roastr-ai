import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { Login, Register, ResetPassword } from '../pages/auth';
import AuthCallback from '../pages/auth-callback';
import AdminDashboard from '../pages/admin/AdminDashboard';
import UserDetail from '../pages/admin/UserDetail';
import AdminUsersPage from '../pages/admin/users';
import AdminLayout from '../components/admin/AdminLayout';
import AdminMetrics from '../pages/admin/AdminMetrics';
import AdminLogs from '../pages/admin/AdminLogs';
import AdminSettings from '../pages/admin/AdminSettings';
import AppShell from '../components/AppShell';
import Dashboard from '../pages/dashboard';
import Compose from '../pages/Compose';
import Integrations from '../pages/Integrations';
import Billing from '../pages/Billing';
import Settings from '../pages/Settings';
import Logs from '../pages/Logs';
import PlanPicker from '../pages/PlanPicker';
import Connect from '../pages/Connect';
import StyleProfile from '../pages/StyleProfile';
import Configuration from '../pages/Configuration';
import Approval from '../pages/Approval';
import AccountsPage from '../pages/AccountsPage';
import Pricing from '../pages/Pricing';
import Shop from '../pages/Shop';
import ProtectedRoute, { AdminRoute, AuthRoute, PublicRoute } from '../components/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import { isMockModeEnabled } from '../lib/mockMode';

// Helper component to track current location
const LocationTracker = ({ onLocationChange }) => {
  const location = useLocation();
  React.useEffect(() => {
    onLocationChange(location.pathname);
  }, [location.pathname, onLocationChange]);
  return null;
};

// Test version of App without Router wrapper
const TestApp = ({ onLocationChange }) => {
  return (
    <AuthProvider>
      <div className="App">
        {onLocationChange && <LocationTracker onLocationChange={onLocationChange} />}
        <Routes>
          {/* Public routes - redirect if already authenticated */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PublicRoute>
                <ResetPassword />
              </PublicRoute>
            }
          />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected routes with AppShell - require authentication */}
          <Route
            path="/"
            element={
              <AuthRoute>
                <AppShell />
              </AuthRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="compose" element={<Compose />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="integrations/connect" element={<Connect />} />
            <Route path="configuration" element={<Configuration />} />
            <Route path="approval" element={<Approval />} />
            <Route path="billing" element={<Billing />} />
            <Route path="settings" element={<Settings />} />
            <Route path="logs" element={<Logs />} />
            <Route path="plans" element={<PlanPicker />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="style-profile" element={<StyleProfile />} />
            <Route path="style-profile/generate" element={<StyleProfile />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="profile" element={<Settings />} />
            <Route path="shop" element={<Shop />} />
          </Route>

          {/* Admin routes with AdminLayout - require admin permissions */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="/admin/users" replace />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:userId" element={<UserDetail />} />
            <Route path="metrics" element={<AdminMetrics />} />
            <Route path="logs" element={<AdminLogs />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* 404 fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
};

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
          ENABLE_BILLING: true
        }
      })
    });

    isMockModeEnabled.mockReturnValue(false);
  });

  describe('Unauthenticated User Flow', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        isAuthenticated: false,
        isAdmin: false,
        loading: false,
        userData: null
      });
    });

    it('should redirect to login when accessing protected routes', async () => {
      let currentPath = '/dashboard';
      const handleLocationChange = (path) => {
        currentPath = path;
      };

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <TestApp onLocationChange={handleLocationChange} />
        </MemoryRouter>
      );

      // Should be redirected to login
      await waitFor(() => {
        expect(currentPath).toBe('/login');
      });
    });

    it('should show login page when accessing /login', async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <TestApp />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Iniciar sesión/i)).toBeInTheDocument();
      });
    });

    it('should show register page when accessing /register', async () => {
      render(
        <MemoryRouter initialEntries={['/register']}>
          <TestApp />
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
          is_admin: false
        }
      });
    });

    it('should redirect to dashboard from root', async () => {
      let currentPath = '/';
      const handleLocationChange = (path) => {
        currentPath = path;
      };

      render(
        <MemoryRouter initialEntries={['/']}>
          <TestApp onLocationChange={handleLocationChange} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(currentPath).toBe('/dashboard');
      });
    });

    it('should access dashboard successfully', async () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <TestApp />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
      });
    });

    it('should access settings page', async () => {
      render(
        <MemoryRouter initialEntries={['/settings']}>
          <TestApp />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Settings/i)).toBeInTheDocument();
      });
    });

    it('should access shop page when feature flag is enabled', async () => {
      render(
        <MemoryRouter initialEntries={['/shop']}>
          <TestApp />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Roastr Shop/i)).toBeInTheDocument();
      });
    });

    it('should be redirected from admin routes', async () => {
      let currentPath = '/admin';
      const handleLocationChange = (path) => {
        currentPath = path;
      };

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <TestApp onLocationChange={handleLocationChange} />
        </MemoryRouter>
      );

      // Should be redirected away from admin
      await waitFor(() => {
        expect(currentPath).toBe('/dashboard');
      });
    });

    it('should redirect from public routes to dashboard', async () => {
      let currentPath = '/login';
      const handleLocationChange = (path) => {
        currentPath = path;
      };

      render(
        <MemoryRouter initialEntries={['/login']}>
          <TestApp onLocationChange={handleLocationChange} />
        </MemoryRouter>
      );

      // Should be redirected to dashboard
      await waitFor(() => {
        expect(currentPath).toBe('/dashboard');
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
          is_admin: true
        }
      });
    });

    it('should access admin dashboard', async () => {
      let currentPath = '/admin';
      const handleLocationChange = (path) => {
        currentPath = path;
      };

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <TestApp onLocationChange={handleLocationChange} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(currentPath).toBe('/admin/users');
      });
    });

    it('should access admin users page', async () => {
      let currentPath = '/admin/users';
      const handleLocationChange = (path) => {
        currentPath = path;
      };

      render(
        <MemoryRouter initialEntries={['/admin/users']}>
          <TestApp onLocationChange={handleLocationChange} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(currentPath).toBe('/admin/users');
      });
    });

    it('should also access normal user routes', async () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <TestApp />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
      });
    });

    it('should redirect from public routes to admin', async () => {
      let currentPath = '/login';
      const handleLocationChange = (path) => {
        currentPath = path;
      };

      render(
        <MemoryRouter initialEntries={['/login']}>
          <TestApp onLocationChange={handleLocationChange} />
        </MemoryRouter>
      );

      // Should be redirected to admin
      await waitFor(() => {
        expect(currentPath).toBe('/admin/users');
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state while auth is loading', async () => {
      useAuth.mockReturnValue({
        isAuthenticated: false,
        isAdmin: false,
        loading: true,
        userData: null
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <TestApp />
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
          is_admin: false
        }
      });

      render(
        <MemoryRouter initialEntries={['/shop']}>
          <TestApp />
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
          is_admin: false
        }
      });

      let currentPath = '/nonexistent';
      const handleLocationChange = (path) => {
        currentPath = path;
      };

      render(
        <MemoryRouter initialEntries={['/nonexistent']}>
          <TestApp onLocationChange={handleLocationChange} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(currentPath).toBe('/dashboard');
      });
    });
  });
});
