import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthGuard } from '../auth-guard';
import { AuthProvider, useAuth } from '@/lib/auth-context';

// Mock the auth context
vi.mock('@/lib/auth-context', () => {
  const actual = vi.importActual('@/lib/auth-context');
  return {
    ...actual,
    useAuth: vi.fn()
  };
});

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('redirects to login when user is not authenticated', () => {
    (useAuth as any).mockReturnValue({
      isAuthenticated: false,
      loading: false
    });

    render(
      <BrowserRouter>
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      </BrowserRouter>
    );

    // Should redirect to login
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    (useAuth as any).mockReturnValue({
      isAuthenticated: true,
      loading: false
    });

    render(
      <BrowserRouter>
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      </BrowserRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows loading state while checking authentication', () => {
    (useAuth as any).mockReturnValue({
      isAuthenticated: false,
      loading: true
    });

    render(
      <BrowserRouter>
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      </BrowserRouter>
    );

    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });
});
