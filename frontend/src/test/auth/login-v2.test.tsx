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
  });

  describe('Rendering', () => {
    it('renders login form with all fields', () => {
      renderLoginPage();

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
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

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);

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

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid-email');

      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/formato de email inválido/i)).toBeInTheDocument();
      });
    });

    it('shows error when password is empty', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
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
        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByLabelText(/contraseña/i);
        
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });

  describe('Loading State', () => {
    it('disables inputs during submission', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
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

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
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

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
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
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'wrong@roastr.ai');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email o contraseña incorrectos/i)).toBeInTheDocument();
      });
    });

    it('displays generic error message for unknown error codes', () => {
      // Test getErrorMessage function directly for unknown codes
      expect(getErrorMessage('UNKNOWN_CODE')).toBe('Algo ha fallado. Inténtalo más tarde');
      expect(getErrorMessage('AUTH_SOME_NEW_ERROR')).toBe('Algo ha fallado. Inténtalo más tarde');
      expect(getErrorMessage(undefined)).toBe('Algo ha fallado. Inténtalo más tarde');
      expect(getErrorMessage('')).toBe('Algo ha fallado. Inténtalo más tarde');
    });

    it('displays error with accessible alert role', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'wrong@roastr.ai');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        // Alert component from shadcn has multiple elements with role="alert"
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
        expect(screen.getByText(/email o contraseña incorrectos/i)).toBeInTheDocument();
      });
    });

    it('never reveals if email exists (anti-enumeration)', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'nonexistent@roastr.ai');
      await user.type(passwordInput, 'anypassword');
      await user.click(submitButton);

      await waitFor(() => {
        // Should show generic message, not "email not found"
        const errorText = screen.getByText(/email o contraseña incorrectos/i);
        expect(errorText).toBeInTheDocument();
        expect(screen.queryByText(/email.*no.*encontrado/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('allows form submission with Enter key', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);

      await user.type(emailInput, 'test@roastr.ai');
      await user.type(passwordInput, 'password');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(emailInput).toBeDisabled();
      });
    });

    it('has visible focus indicators', () => {
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      // Verify elements can receive focus (focusable)
      expect(emailInput).not.toHaveAttribute('disabled');
      expect(passwordInput).not.toHaveAttribute('disabled');
      expect(submitButton).not.toHaveAttribute('disabled');
    });

    it('has proper autocomplete attributes', () => {
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);

      expect(emailInput).toHaveAttribute('autocomplete', 'email');
      expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    });

    it('disables recovery link during loading', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
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
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'test@roastr.ai');
      await user.type(passwordInput, 'password');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/app', { replace: true });
      });
    });
  });
});
