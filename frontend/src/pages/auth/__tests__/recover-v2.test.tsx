/**
 * Tests for RecoverPageV2 Component
 * 
 * Coverage:
 * - Component renders correctly
 * - Email validation (format, required)
 * - Submit with valid email
 * - Loading state
 * - Success state
 * - Generic error state
 * - Feature flag OFF scenario
 * - Analytics tracking (4 events)
 * 
 * Issue: ROA-380
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import RecoverPageV2 from '../recover-v2';
import * as analytics from '@/lib/analytics';
import * as authApi from '@/lib/api/auth';

// Mock dependencies
vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requestPasswordRecoveryV2: vi.fn(),
}));

vi.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: vi.fn(() => true), // Default: feature enabled
}));

// Helper to render component with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('RecoverPageV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders the recovery form correctly', () => {
      renderWithRouter(<RecoverPageV2 />);

      // Check title and description
      expect(screen.getByText('Recuperar Contraseña')).toBeInTheDocument();
      expect(screen.getByText(/Ingresa tu email/i)).toBeInTheDocument();

      // Check email input
      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('placeholder', 'tu@email.com');

      // Check submit button
      const submitButton = screen.getByRole('button', { name: /enviar enlace/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();

      // Check back to login link
      const loginLink = screen.getByRole('link', { name: /volver al inicio/i });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute('href', '/login');
    });

    it('tracks form view on mount', () => {
      renderWithRouter(<RecoverPageV2 />);

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'password_recovery_form_viewed',
        expect.objectContaining({
          feature_flag_state: true,
          page: '/recover',
        })
      );
    });
  });

  describe('Email Validation', () => {
    it('shows error when email is empty', async () => {
      const user = userEvent.setup();
      renderWithRouter(<RecoverPageV2 />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /enviar enlace/i });

      // Focus and blur without entering value
      await user.click(emailInput);
      await user.tab();

      // Try to submit
      await user.click(submitButton);

      // Check for error message
      await waitFor(() => {
        expect(screen.getByText(/el email es requerido/i)).toBeInTheDocument();
      });
    });

    it('shows error when email format is invalid', async () => {
      const user = userEvent.setup();
      renderWithRouter(<RecoverPageV2 />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /enviar enlace/i });

      // Enter invalid email
      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);

      // Check for error message
      await waitFor(() => {
        expect(screen.getByText(/formato de email inválido/i)).toBeInTheDocument();
      });
    });

    it('does not show error for valid email', async () => {
      const user = userEvent.setup();
      renderWithRouter(<RecoverPageV2 />);

      const emailInput = screen.getByLabelText(/email/i);

      // Enter valid email
      await user.type(emailInput, 'test@example.com');
      await user.tab();

      // No error should be shown
      expect(screen.queryByText(/formato de email inválido/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/el email es requerido/i)).not.toBeInTheDocument();
    });
  });

  describe('Form Submission - Happy Path', () => {
    it('shows loading state and submits successfully', async () => {
      const user = userEvent.setup();
      
      // Mock successful API response
      vi.mocked(authApi.requestPasswordRecoveryV2).mockResolvedValue({
        success: true,
        message: 'Recovery email sent',
      });

      renderWithRouter(<RecoverPageV2 />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /enviar enlace/i });

      // Enter valid email
      await user.type(emailInput, 'user@example.com');

      // Submit form
      await user.click(submitButton);

      // Check loading state
      await waitFor(() => {
        expect(screen.getByText(/enviando/i)).toBeInTheDocument();
        expect(submitButton).toBeDisabled();
      });

      // Check analytics: submit tracked
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'password_recovery_submitted',
        expect.objectContaining({
          feature_flag_state: true,
        })
      );

      // Wait for success state
      await waitFor(() => {
        expect(screen.getByText(/email enviado/i)).toBeInTheDocument();
      });

      // Check success message (anti-enumeration)
      expect(screen.getByText(/si existe una cuenta asociada/i)).toBeInTheDocument();
      expect(screen.getByText(/user@example.com/)).toBeInTheDocument();

      // Check analytics: success tracked
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'password_recovery_success_shown',
        expect.objectContaining({
          feature_flag_state: true,
        })
      );

      // API was called correctly
      expect(authApi.requestPasswordRecoveryV2).toHaveBeenCalledWith('user@example.com');
    });
  });

  describe('Error Handling', () => {
    it('shows generic error on network failure', async () => {
      const user = userEvent.setup();
      
      // Mock network error
      vi.mocked(authApi.requestPasswordRecoveryV2).mockRejectedValue(
        new Error('Network error')
      );

      renderWithRouter(<RecoverPageV2 />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /enviar enlace/i });

      // Enter valid email and submit
      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/no hemos podido procesar la solicitud/i)).toBeInTheDocument();
      });

      // Check analytics: error tracked
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'password_recovery_error_shown',
        expect.objectContaining({
          feature_flag_state: true,
          error_type: 'network_or_exception',
        })
      );

      // Submit button should be enabled again
      expect(submitButton).not.toBeDisabled();
    });

    it('shows generic error when response.success is false', async () => {
      const user = userEvent.setup();
      
      // Mock unsuccessful response
      vi.mocked(authApi.requestPasswordRecoveryV2).mockResolvedValue({
        success: false,
        message: 'Some backend error',
      });

      renderWithRouter(<RecoverPageV2 />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /enviar enlace/i });

      // Enter valid email and submit
      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/no hemos podido procesar la solicitud/i)).toBeInTheDocument();
      });

      // Check analytics: error tracked
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'password_recovery_error_shown',
        expect.objectContaining({
          feature_flag_state: true,
          error_type: 'response_not_success',
        })
      );
    });

    it('does not expose technical error details', async () => {
      const user = userEvent.setup();
      
      // Mock error with technical details
      vi.mocked(authApi.requestPasswordRecoveryV2).mockRejectedValue(
        new Error('ECONNREFUSED: Connection refused at 127.0.0.1:3000')
      );

      renderWithRouter(<RecoverPageV2 />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /enviar enlace/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // Wait for generic error
      await waitFor(() => {
        expect(screen.getByText(/no hemos podido procesar la solicitud/i)).toBeInTheDocument();
      });

      // Technical details should NOT be shown
      expect(screen.queryByText(/ECONNREFUSED/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/127.0.0.1/i)).not.toBeInTheDocument();
    });
  });

  describe('Feature Flag', () => {
    it('shows "not available" message when feature flag is OFF', async () => {
      // Mock feature flag as disabled
      const useFeatureFlagMock = await import('@/hooks/useFeatureFlag');
      vi.mocked(useFeatureFlagMock.useFeatureFlag).mockReturnValue(false);

      renderWithRouter(<RecoverPageV2 />);

      // Check for "not available" message
      expect(screen.getByText(/recuperación de contraseña no disponible/i)).toBeInTheDocument();
      expect(screen.getByText(/temporalmente deshabilitada/i)).toBeInTheDocument();

      // Form should NOT be visible
      expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /enviar enlace/i })).not.toBeInTheDocument();

      // Back to login button should be visible
      const loginButton = screen.getByRole('link', { name: /volver al inicio/i });
      expect(loginButton).toBeInTheDocument();

      // Analytics should track with flag disabled
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'password_recovery_form_viewed',
        expect.objectContaining({
          feature_flag_state: false,
        })
      );
    });

    it('shows form when feature flag is ON', () => {
      // Mock feature flag as enabled (default)
      renderWithRouter(<RecoverPageV2 />);

      // Form should be visible
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /enviar enlace/i })).toBeInTheDocument();

      // "Not available" message should NOT be visible
      expect(screen.queryByText(/recuperación de contraseña no disponible/i)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper labels and ARIA attributes', () => {
      renderWithRouter(<RecoverPageV2 />);

      const emailInput = screen.getByLabelText(/email/i);
      
      // Check input attributes
      expect(emailInput).toHaveAttribute('id', 'email');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autoComplete', 'email');
    });

    it('shows error with aria-invalid when validation fails', async () => {
      const user = userEvent.setup();
      renderWithRouter(<RecoverPageV2 />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /enviar enlace/i });

      // Trigger validation error
      await user.type(emailInput, 'invalid');
      await user.click(submitButton);

      // Wait for error
      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      });

      // Error message should have role="alert"
      const errorMessage = screen.getByRole('alert', { name: /formato de email inválido/i });
      expect(errorMessage).toBeInTheDocument();
    });

    it('disables inputs during submission', async () => {
      const user = userEvent.setup();
      
      // Mock slow API response
      vi.mocked(authApi.requestPasswordRecoveryV2).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
      );

      renderWithRouter(<RecoverPageV2 />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /enviar enlace/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // Check disabled states during submission
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(emailInput).toBeDisabled();
      });
    });
  });

  describe('Analytics Events', () => {
    it('tracks all 4 required events in happy path', async () => {
      const user = userEvent.setup();
      
      vi.mocked(authApi.requestPasswordRecoveryV2).mockResolvedValue({
        success: true,
      });

      renderWithRouter(<RecoverPageV2 />);

      // 1. Form viewed (on mount)
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'password_recovery_form_viewed',
        expect.any(Object)
      );

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /enviar enlace/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // 2. Submitted
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'password_recovery_submitted',
        expect.any(Object)
      );

      // 3. Success shown
      await waitFor(() => {
        expect(analytics.trackEvent).toHaveBeenCalledWith(
          'password_recovery_success_shown',
          expect.any(Object)
        );
      });

      // Total: 3 events (form_viewed, submitted, success_shown)
      expect(analytics.trackEvent).toHaveBeenCalledTimes(3);
    });

    it('does not include PII in analytics events', async () => {
      const user = userEvent.setup();
      
      vi.mocked(authApi.requestPasswordRecoveryV2).mockResolvedValue({
        success: true,
      });

      renderWithRouter(<RecoverPageV2 />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /enviar enlace/i });

      await user.type(emailInput, 'sensitive@email.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email enviado/i)).toBeInTheDocument();
      });

      // Check all analytics calls - none should include email
      const allCalls = vi.mocked(analytics.trackEvent).mock.calls;
      
      allCalls.forEach(([eventName, payload]) => {
        // Payload should not contain email or any PII
        const payloadString = JSON.stringify(payload);
        expect(payloadString).not.toContain('sensitive@email.com');
        expect(payloadString).not.toContain('email:');
        expect(payload).not.toHaveProperty('email');
        expect(payload).not.toHaveProperty('user_email');
      });
    });
  });

  describe('Integration: Full User Flow', () => {
    it('completes full recovery request flow', async () => {
      const user = userEvent.setup();
      
      vi.mocked(authApi.requestPasswordRecoveryV2).mockResolvedValue({
        success: true,
        message: 'Recovery email sent',
      });

      renderWithRouter(<RecoverPageV2 />);

      // Step 1: User sees form
      expect(screen.getByText('Recuperar Contraseña')).toBeInTheDocument();

      // Step 2: User enters email
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'john@example.com');

      // Step 3: User submits
      const submitButton = screen.getByRole('button', { name: /enviar enlace/i });
      await user.click(submitButton);

      // Step 4: Loading state
      expect(screen.getByText(/enviando/i)).toBeInTheDocument();

      // Step 5: Success message
      await waitFor(() => {
        expect(screen.getByText(/email enviado/i)).toBeInTheDocument();
      });

      // Step 6: Anti-enumeration message
      expect(screen.getByText(/si existe una cuenta asociada/i)).toBeInTheDocument();

      // Step 7: Back to login link
      const backLink = screen.getByRole('link', { name: /volver al inicio/i });
      expect(backLink).toHaveAttribute('href', '/login');
    });
  });
});

