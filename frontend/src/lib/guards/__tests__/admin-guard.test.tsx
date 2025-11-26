import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminGuard } from '../admin-guard';
import { AuthProvider } from '../../auth-context';

// Mock the API module to prevent actual API calls
vi.mock('../../api', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn()
  }
}));

describe('AdminGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const TestContent = () => <div>Admin Content</div>;

  it('shows loading state while checking auth', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <AdminGuard>
            <TestContent />
          </AdminGuard>
        </AuthProvider>
      </BrowserRouter>
    );

    // Should show loading initially
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('renders children when user is authenticated admin (demo mode)', async () => {
    const adminUser = {
      id: '1',
      email: 'admin@example.com',
      name: 'Admin User',
      is_admin: true
    };

    localStorage.setItem('user', JSON.stringify(adminUser));
    localStorage.setItem('auth_token', 'demo-token-admin');

    render(
      <BrowserRouter>
        <AuthProvider>
          <AdminGuard>
            <TestContent />
          </AdminGuard>
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByText('Admin Content')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
