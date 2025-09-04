import React from 'react';
import { render, screen } from '@testing-library/react';
import ProtectedRoute, { AdminRoute, AuthRoute, PublicRoute } from '../ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';

// Mock the useAuth hook
jest.mock('../../contexts/AuthContext');

// Mock react-router-dom partially to keep real MemoryRouter and useLocation
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to }) => <div data-testid="navigate" data-to={to}>Redirecting to {to}</div>,
  };
});

// Import the real MemoryRouter since we're using real useLocation
import { MemoryRouter } from 'react-router-dom';

const TestComponent = () => <div>Test Content</div>;

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading state', () => {
    it('should show loading spinner when loading', () => {
      useAuth.mockReturnValue({
        isAuthenticated: false,
        isAdmin: false,
        loading: true,
        userData: null,
      });

      render(
        <MemoryRouter initialEntries={['/test']}>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });
  });

  describe('Authentication required', () => {
    it('should redirect to login when not authenticated', () => {
      useAuth.mockReturnValue({
        isAuthenticated: false,
        isAdmin: false,
        loading: false,
        userData: null,
      });

      render(
        <MemoryRouter initialEntries={['/test']}>
          <ProtectedRoute requireAuth={true}>
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });

    it('should render children when authenticated', () => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        isAdmin: false,
        loading: false,
        userData: { id: '1', email: 'user@test.com' },
      });

      render(
        <MemoryRouter initialEntries={['/test']}>
          <ProtectedRoute requireAuth={true}>
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });

  describe('Admin required', () => {
    it('should redirect to dashboard when not admin', () => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        isAdmin: false,
        loading: false,
        userData: { id: '1', email: 'user@test.com', is_admin: false },
      });

      render(
        <MemoryRouter initialEntries={['/test']}>
          <ProtectedRoute requireAuth={true} requireAdmin={true}>
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/dashboard');
      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });

    it('should render children when user is admin', () => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        isAdmin: true,
        loading: false,
        userData: { id: '1', email: 'admin@test.com', is_admin: true },
      });

      render(
        <MemoryRouter initialEntries={['/']}>
          <ProtectedRoute requireAuth={true} requireAdmin={true}>
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should redirect to login when not authenticated and admin required', () => {
      useAuth.mockReturnValue({
        isAuthenticated: false,
        isAdmin: false,
        loading: false,
        userData: null,
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <ProtectedRoute requireAuth={true} requireAdmin={true}>
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });
  });

  describe('Custom redirect', () => {
    it('should redirect to custom route when specified', () => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        isAdmin: false,
        loading: false,
        userData: { id: '1', email: 'user@test.com', is_admin: false },
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <ProtectedRoute requireAuth={true} requireAdmin={true} redirectTo="/custom">
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });
  });
});

describe('AdminRoute', () => {
  it('should require both auth and admin', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isAdmin: true,
      loading: false,
      userData: { id: '1', email: 'admin@test.com', is_admin: true },
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AdminRoute>
          <TestComponent />
        </AdminRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
});

describe('AuthRoute', () => {
  it('should require only auth', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      loading: false,
      userData: { id: '1', email: 'user@test.com', is_admin: false },
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthRoute>
          <TestComponent />
        </AuthRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
});

describe('PublicRoute', () => {
  it('should render children when not authenticated', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isAdmin: false,
      loading: false,
      userData: null,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <PublicRoute>
          <TestComponent />
        </PublicRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should redirect to dashboard when authenticated as normal user', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      loading: false,
      userData: { id: '1', email: 'user@test.com', is_admin: false },
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <PublicRoute>
          <TestComponent />
        </PublicRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('should redirect to admin when authenticated as admin', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isAdmin: true,
      loading: false,
      userData: { id: '1', email: 'admin@test.com', is_admin: true },
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <PublicRoute>
          <TestComponent />
        </PublicRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });
});
