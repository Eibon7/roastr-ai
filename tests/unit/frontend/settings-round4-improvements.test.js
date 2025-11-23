const React = require('react');
const { render, screen, fireEvent, waitFor } = require('@testing-library/react');
const userEvent = require('@testing-library/user-event');
const { BrowserRouter } = require('react-router-dom');
require('@testing-library/jest-dom');

// Mock dependencies
const mockNavigate = jest.fn();
const mockApiClient = {
  get: jest.fn(),
  post: jest.fn()
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

jest.mock('../../../frontend/src/lib/api', () => ({
  apiClient: mockApiClient
}));

jest.mock('../../../frontend/src/contexts/AuthContext', () => ({
  useAuth: () => ({
    userData: {
      email: 'test@example.com',
      plan: 'pro'
    }
  })
}));

// Import Settings component
const Settings = require('../../../frontend/src/pages/Settings.jsx').default;

const SettingsWrapper = ({ children }) => <BrowserRouter>{children || <Settings />}</BrowserRouter>;

describe('Settings Component - CodeRabbit Round 4 Improvements', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    mockNavigate.mockClear();
    mockApiClient.get.mockResolvedValue({ data: {} });
    mockApiClient.post.mockResolvedValue({});
  });

  describe('Accessibility Enhancements', () => {
    test('should connect new password input to requirements with aria-describedby', async () => {
      render(<SettingsWrapper />);

      const newPasswordInput = screen.getByLabelText(/new password/i);

      // Initially no aria-describedby when no password entered
      expect(newPasswordInput).not.toHaveAttribute('aria-describedby');

      // Type weak password to trigger requirements
      await user.type(newPasswordInput, 'weak');

      await waitFor(() => {
        expect(newPasswordInput).toHaveAttribute('aria-describedby', 'password-requirements');
        expect(screen.getByRole('list')).toHaveAttribute('id', 'password-requirements');
      });

      // Clear password - aria-describedby should be removed
      await user.clear(newPasswordInput);
      await user.type(newPasswordInput, 'StrongPass123!');

      await waitFor(() => {
        expect(newPasswordInput).not.toHaveAttribute('aria-describedby');
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
      });
    });

    test('should have accessible password toggle buttons', async () => {
      render(<SettingsWrapper />);

      const currentPasswordToggle = screen.getByLabelText(
        /show current password|hide current password/i
      );
      const newPasswordToggle = screen.getByLabelText(/show new password|hide new password/i);
      const confirmPasswordToggle = screen.getByLabelText(
        /show confirmation password|hide confirmation password/i
      );

      expect(currentPasswordToggle).toBeInTheDocument();
      expect(newPasswordToggle).toBeInTheDocument();
      expect(confirmPasswordToggle).toBeInTheDocument();

      // Test toggle functionality
      await user.click(currentPasswordToggle);
      await waitFor(() => {
        expect(screen.getByLabelText(/hide current password/i)).toBeInTheDocument();
      });
    });

    test('should provide semantic password requirements list', async () => {
      render(<SettingsWrapper />);

      const newPasswordInput = screen.getByLabelText(/new password/i);
      await user.type(newPasswordInput, 'weak');

      await waitFor(() => {
        const requirementsList = screen.getByRole('list');
        expect(requirementsList).toHaveAttribute('id', 'password-requirements');

        // Check for list items with requirements
        const listItems = screen.getAllByRole('listitem');
        expect(listItems.length).toBeGreaterThan(0);

        // Each item should contain requirement text
        listItems.forEach((item) => {
          expect(item).toHaveTextContent(/characters|uppercase|lowercase|number|special/i);
        });
      });
    });
  });

  describe('Navigation and Client-side Routing', () => {
    test('should use React Router navigate for billing navigation', async () => {
      render(<SettingsWrapper />);

      // Navigate to billing tab
      const billingTab = screen.getByRole('tab', { name: /billing/i });
      await user.click(billingTab);

      await waitFor(() => {
        const viewBillingButton = screen.getByRole('button', { name: /view full billing/i });
        expect(viewBillingButton).toBeInTheDocument();
      });

      const viewBillingButton = screen.getByRole('button', { name: /view full billing/i });
      await user.click(viewBillingButton);

      expect(mockNavigate).toHaveBeenCalledWith('/billing');
    });

    test('should use React Router navigate for pricing navigation', async () => {
      render(<SettingsWrapper />);

      // Navigate to billing tab
      const billingTab = screen.getByRole('tab', { name: /billing/i });
      await user.click(billingTab);

      await waitFor(() => {
        const upgradePlanButtons = screen.getAllByRole('button', { name: /upgrade/i });
        expect(upgradePlanButtons.length).toBeGreaterThan(0);
      });

      const upgradePlanButton = screen.getAllByRole('button', { name: /upgrade/i })[0];
      await user.click(upgradePlanButton);

      expect(mockNavigate).toHaveBeenCalledWith('/pricing');
    });

    test('should navigate after successful account deletion', async () => {
      mockApiClient.post.mockResolvedValueOnce({});

      render(<SettingsWrapper />);

      // Navigate to account tab and find delete button
      const deleteButton = screen.getByRole('button', { name: /delete account/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
      });

      // Type DELETE confirmation
      const confirmInput = screen.getByLabelText(/type "delete" to confirm/i);
      await user.type(confirmInput, 'DELETE');

      const confirmDeleteButton = screen.getByRole('button', { name: /delete forever/i });
      await user.click(confirmDeleteButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Form Validation and Pre-validation', () => {
    test('should perform comprehensive password pre-validation', async () => {
      render(<SettingsWrapper />);

      const currentPassword = screen.getByLabelText(/current password/i);
      const newPassword = screen.getByLabelText(/new password/i);
      const confirmPassword = screen.getByLabelText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });

      // Test validation: empty current password
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/current password is required/i);
      });

      // Test validation: weak new password
      await user.type(currentPassword, 'currentPass123!');
      await user.type(newPassword, 'weak');
      await user.type(confirmPassword, 'weak');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/password must contain/i);
      });

      // Test validation: password mismatch
      await user.clear(newPassword);
      await user.clear(confirmPassword);
      await user.type(newPassword, 'StrongPass123!');
      await user.type(confirmPassword, 'DifferentPass456!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/passwords do not match/i);
      });

      // Test validation: same as current password
      await user.clear(newPassword);
      await user.clear(confirmPassword);
      await user.type(newPassword, 'currentPass123!');
      await user.type(confirmPassword, 'currentPass123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /must be different from current password/i
        );
      });
    });

    test('should enable submit button only when all validation passes', async () => {
      render(<SettingsWrapper />);

      const currentPassword = screen.getByLabelText(/current password/i);
      const newPassword = screen.getByLabelText(/new password/i);
      const confirmPassword = screen.getByLabelText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });

      // Initially disabled
      expect(submitButton).toBeDisabled();

      // Fill with valid data
      await user.type(currentPassword, 'currentPass123!');
      await user.type(newPassword, 'NewValidPass456!');
      await user.type(confirmPassword, 'NewValidPass456!');

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Password Strength Indicator', () => {
    test('should show password strength indicator', async () => {
      render(<SettingsWrapper />);

      const newPassword = screen.getByLabelText(/new password/i);

      // Type weak password
      await user.type(newPassword, 'weak');

      await waitFor(() => {
        expect(screen.getByText(/password strength/i)).toBeInTheDocument();
        expect(screen.getByText(/weak/i)).toBeInTheDocument();
      });

      // Type strong password
      await user.clear(newPassword);
      await user.type(newPassword, 'VeryStrongPass123!');

      await waitFor(() => {
        expect(screen.getByText(/strong/i)).toBeInTheDocument();
      });
    });

    test('should show progress bar for password strength', async () => {
      render(<SettingsWrapper />);

      const newPassword = screen.getByLabelText(/new password/i);
      await user.type(newPassword, 'MediumPass1!');

      await waitFor(() => {
        // Should have a visual progress indicator
        const progressBar = screen
          .getByText(/password strength/i)
          .closest('div')
          .querySelector('[style*="width"]');
        expect(progressBar).toBeInTheDocument();
      });
    });
  });

  describe('Notification System Improvements', () => {
    test('should handle notification timeout properly with useRef', async () => {
      render(<SettingsWrapper />);

      const submitButton = screen.getByRole('button', { name: /change password/i });

      // Trigger notification
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Trigger another notification quickly
      await user.click(submitButton);

      // Should still have only one notification
      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts).toHaveLength(1);
      });
    });

    test('should allow manual notification dismissal', async () => {
      render(<SettingsWrapper />);

      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText(/close notification/i);
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });
});
