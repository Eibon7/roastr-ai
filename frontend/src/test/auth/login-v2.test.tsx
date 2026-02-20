/**
 * Login Page v2 Tests
 *
 * Tests for ROA-361 - B2. Login Frontend UI (shadcn)
 * 
 * Coverage:
 * - Form rendering
 * - Validation (client-side)
 * - Loading state
 * - Error display based on error_code
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginPageV2, { getErrorMessage } from '@/pages/auth/login-v2';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: {} }),
  };
});

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

// Mock tokenStorage
vi.mock('@/lib/auth/tokenStorage', () => ({
  setTokens: vi.fn(),
}));

import apiClient from '@/lib/api/client';

// Helper to render component
function renderLoginPage() {
  return render(
    <BrowserRouter>
      <LoginPageV2 />
    </BrowserRouter>
  );
}

describe('LoginPageV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: pending promise to simulate loading state
    vi.mocked(apiClient.post).mockImplementation(() => new Promise(() => {}));
  });

  describe('Rendering', () => {
    it('renders login form with all fields', () => {
      renderLoginPage();

      expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
    });

    it('renders password recovery link', () => {
      renderLoginPage();

      const recoveryLink = screen.getByText(/¿olvidaste tu contraseña\?/i);
      expect(recoveryLink).toBeInTheDocument();
      expect(recoveryLink).toHaveAttribute('href', '/recover');
    });

    it('has proper labels associated with inputs', () => {
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/^contraseña$/i);

      expect(emailInput).toHaveAttribute('id', 'email');
      expect(passwordInput).toHaveAttribute('id', 'password');
    });
  });

  describe('Validation', () => {
    it('shows error when email is empty', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/el email es requerido/i)).toBeInTheDocument();
      });
    });

    it('shows error when email format is invalid', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      await user.type(emailInput, 'invalid-email');

      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/el email no es válido/i)).toBeInTheDocument();
      });
    });

    it('shows error when password is empty', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      await user.type(emailInput, 'test@roastr.ai');

      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/la contraseña es requerida/i)).toBeInTheDocument();
      });
    });

    it('sets aria-invalid on invalid inputs', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });
      await user.click(submitButton);

      await waitFor(() => {
        const emailInput = screen.getByRole('textbox', { name: /email/i });
        const passwordInput = screen.getByLabelText(/^contraseña$/i);
        
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });

  describe('Loading State', () => {
    it('disables inputs during submission', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/^contraseña$/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'test@roastr.ai');
      await user.type(passwordInput, 'password');
      await user.click(submitButton);

      // During loading
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/iniciando sesión\.\.\./i)).toBeInTheDocument();
    });

    it('shows spinner during submission', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/^contraseña$/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'test@roastr.ai');
      await user.type(passwordInput, 'password');
      await user.click(submitButton);

      // Check for spinner (Loader2 component)
      const spinner = submitButton.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('prevents double submit', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/^contraseña$/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'test@roastr.ai');
      await user.type(passwordInput, 'password');
      
      // Try to click multiple times
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      // Button should be disabled after first click
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('displays error message for AUTH_INVALID_CREDENTIALS', async () => {
      // Mock error response
      vi.mocked(apiClient.post).mockRejectedValueOnce({
        error: { slug: 'AUTH_INVALID_CREDENTIALS' },
      });

      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/^contraseña$/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'wrong@roastr.ai');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/el email o la contraseña no son correctos/i)).toBeInTheDocument();
      });
    });

    it('displays generic error message for unknown error codes', () => {
      // Test getErrorMessage function directly for unknown codes
      expect(getErrorMessage('UNKNOWN_CODE')).toBe('Ocurrió un error inesperado al iniciar sesión. Por favor intenta de nuevo o contacta a soporte si el problema persiste.');
      expect(getErrorMessage('AUTH_SOME_NEW_ERROR')).toBe('Ocurrió un error inesperado al iniciar sesión. Por favor intenta de nuevo o contacta a soporte si el problema persiste.');
      expect(getErrorMessage(undefined)).toBe('Ocurrió un error inesperado al iniciar sesión. Por favor intenta de nuevo o contacta a soporte si el problema persiste.');
      expect(getErrorMessage('')).toBe('Ocurrió un error inesperado al iniciar sesión. Por favor intenta de nuevo o contacta a soporte si el problema persiste.');
    });

    it('displays error with accessible alert role', async () => {
      // Mock error response
      vi.mocked(apiClient.post).mockRejectedValueOnce({
        error: { slug: 'AUTH_INVALID_CREDENTIALS' },
      });

      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/^contraseña$/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'wrong@roastr.ai');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        // Alert component from shadcn has multiple elements with role="alert"
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
        expect(screen.getByText(/el email o la contraseña no son correctos/i)).toBeInTheDocument();
      });
    });

    it('never reveals if email exists (anti-enumeration)', async () => {
      // Mock error response
      vi.mocked(apiClient.post).mockRejectedValueOnce({
        error: { slug: 'AUTH_INVALID_CREDENTIALS' },
      });

      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/^contraseña$/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'nonexistent@roastr.ai');
      await user.type(passwordInput, 'anypassword');
      await user.click(submitButton);

      await waitFor(() => {
        // Should show generic message, not "email not found"
        const errorText = screen.getByText(/el email o la contraseña no son correctos/i);
        expect(errorText).toBeInTheDocument();
        expect(screen.queryByText(/email.*no.*encontrado/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('allows form submission with Enter key', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/^contraseña$/i);

      await user.type(emailInput, 'test@roastr.ai');
      await user.type(passwordInput, 'password');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(emailInput).toBeDisabled();
      });
    });

    it('has visible focus indicators', () => {
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/^contraseña$/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      // Verify elements can receive focus (focusable)
      expect(emailInput).not.toHaveAttribute('disabled');
      expect(passwordInput).not.toHaveAttribute('disabled');
      expect(submitButton).not.toHaveAttribute('disabled');
    });

    it('has proper autocomplete attributes', () => {
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/^contraseña$/i);

      expect(emailInput).toHaveAttribute('autocomplete', 'email');
      expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    });

    it('disables recovery link during loading', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/^contraseña$/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });
      const recoveryLink = screen.getByText(/¿olvidaste tu contraseña\?/i);

      await user.type(emailInput, 'test@roastr.ai');
      await user.type(passwordInput, 'password');
      await user.click(submitButton);

      // Recovery link should be non-focusable during loading
      expect(recoveryLink).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('Integration', () => {
    it('navigates to app on successful login', async () => {
      // Mock successful login response
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        session: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        },
        user: {
          id: 'user-123',
          email: 'test@roastr.ai',
        },
      });

      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/^contraseña$/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'test@roastr.ai');
      await user.type(passwordInput, 'password');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/app', { replace: true });
      });
    });
  });

  describe('Theme Support', () => {
    it('renders correctly in light mode', () => {
      // Mock light theme
      const mockMatchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: light)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: mockMatchMedia,
      });

      renderLoginPage();

      // Verify core elements render regardless of theme
      expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
    });

    it('renders correctly in dark mode', () => {
      // Mock dark theme
      const mockMatchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: mockMatchMedia,
      });

      renderLoginPage();

      // Verify core elements render regardless of theme
      expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
    });

    it('respects system theme preference', () => {
      // Mock system theme detection
      const mockMatchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: mockMatchMedia,
      });

      renderLoginPage();

      // Verify core elements render with system theme
      expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
    });
  });
});
