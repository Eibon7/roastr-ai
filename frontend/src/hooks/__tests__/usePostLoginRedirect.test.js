import { renderHook } from '@testing-library/react';
import { usePostLoginRedirect } from '../usePostLoginRedirect';
import { useAuth } from '../../contexts/AuthContext';

// Mock the useAuth hook
jest.mock('../../contexts/AuthContext');

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('usePostLoginRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderHookWithRouter = () => {
    return renderHook(() => usePostLoginRedirect());
  };

  it('should not redirect when loading', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isAdmin: false,
      userData: null,
      loading: true,
    });

    const { result } = renderHookWithRouter();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(result.current.isRedirecting).toBe(false);
    expect(result.current.targetRoute).toBe(null);
  });

  it('should not redirect when not authenticated', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isAdmin: false,
      userData: null,
      loading: false,
    });

    const { result } = renderHookWithRouter();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(result.current.isRedirecting).toBe(false);
    expect(result.current.targetRoute).toBe(null);
  });

  it('should redirect admin user to /admin', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isAdmin: true,
      userData: { id: '1', email: 'admin@test.com', is_admin: true },
      loading: false,
    });

    const { result } = renderHookWithRouter();

    expect(mockNavigate).toHaveBeenCalledWith('/admin');
    expect(result.current.isRedirecting).toBe(true);
    expect(result.current.targetRoute).toBe('/admin');
  });

  it('should redirect normal user to /dashboard', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      userData: { id: '1', email: 'user@test.com', is_admin: false },
      loading: false,
    });

    const { result } = renderHookWithRouter();

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    expect(result.current.isRedirecting).toBe(true);
    expect(result.current.targetRoute).toBe('/dashboard');
  });

  it('should handle userData without is_admin field', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      userData: { id: '1', email: 'user@test.com' }, // No is_admin field
      loading: false,
    });

    const { result } = renderHookWithRouter();

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    expect(result.current.isRedirecting).toBe(true);
    expect(result.current.targetRoute).toBe('/dashboard');
  });

  it('should not redirect multiple times', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      userData: { id: '1', email: 'user@test.com', is_admin: false },
      loading: false,
    });

    const { rerender } = renderHookWithRouter();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');

    // Rerender with same values
    rerender();

    // Should not call navigate again
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
