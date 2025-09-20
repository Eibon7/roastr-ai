import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock dependencies
const mockNavigate = jest.fn();
const mockApiClient = {
  get: jest.fn(),
  post: jest.fn()
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
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

// Import Settings component using require (Jest compatibility)
const Settings = require('../../../frontend/src/pages/Settings.jsx').default;

const SettingsWrapper = ({ children }) => (
  <BrowserRouter>
    {children || <Settings />}
  </BrowserRouter>
);

describe('Settings Component - CodeRabbit Round 3 Improvements', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    mockNavigate.mockClear();
    mockApiClient.get.mockResolvedValue({ data: {} });
    mockApiClient.post.mockResolvedValue({});
  });

  describe('Component Identity and Debugging', () => {
    test('should have displayName for better debugging', () => {
      expect(Settings.displayName).toBe('Settings');
    });

    test('should be identifiable in React DevTools', () => {
      const { container } = render(<SettingsWrapper />);
      
      // Component should render successfully with proper identity
      expect(container.firstChild).toBeInTheDocument();
      expect(Settings.displayName).toBeTruthy();
    });
  });

  describe('Enhanced Notification Accessibility', () => {
    test('should have proper ARIA attributes for notifications', async () => {
      render(<SettingsWrapper />);
      
      // Trigger a notification
      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        const notification = screen.getByRole('alert');
        expect(notification).toBeInTheDocument();
        expect(notification).toHaveAttribute('aria-live', 'polite');
        expect(notification).toHaveAttribute('aria-atomic', 'true');
        expect(notification).toHaveAttribute('role', 'alert');
      });
    });

    test('should have accessible close button with aria-label', async () => {
      render(<SettingsWrapper />);
      
      // Trigger a notification
      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close notification');
        expect(closeButton).toBeInTheDocument();
        expect(closeButton).toHaveAttribute('aria-label', 'Close notification');
      });
    });

    test('should maintain accessibility during notification lifecycle', async () => {
      render(<SettingsWrapper />);
      
      // Trigger notification
      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);
      
      // Check initial accessibility
      await waitFor(() => {
        const notification = screen.getByRole('alert');
        expect(notification).toHaveAttribute('aria-live', 'polite');
      });
      
      // Dismiss notification
      const closeButton = screen.getByLabelText('Close notification');
      await user.click(closeButton);
      
      // Should no longer be in DOM
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    test('should handle multiple notification types with proper accessibility', async () => {
      render(<SettingsWrapper />);
      
      // Test error notification
      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        const notification = screen.getByRole('alert');
        // Check for error styling semantically rather than specific classes
        expect(notification).toHaveAttribute('aria-live', 'polite');
        expect(notification).toBeInTheDocument();
      });
    });
  });

  describe('Enhanced Button Validation State Management', () => {
    test('should disable submit button when form is invalid', async () => {
      render(<SettingsWrapper />);
      
      const submitButton = screen.getByRole('button', { name: /change password/i });
      expect(submitButton).toBeDisabled();
    });

    test('should enable submit button only when all validation passes', async () => {
      render(<SettingsWrapper />);
      
      const currentPassword = screen.getByLabelText(/current password/i);
      const newPassword = screen.getByLabelText(/new password/i);
      const confirmPassword = screen.getByLabelText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });
      
      // Fill form with valid data
      await user.type(currentPassword, 'currentPass123!');
      await user.type(newPassword, 'ValidNewPass456!');
      await user.type(confirmPassword, 'ValidNewPass456!');
      
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    test('should disable button when passwords do not match', async () => {
      render(<SettingsWrapper />);
      
      const currentPassword = screen.getByLabelText(/current password/i);
      const newPassword = screen.getByLabelText(/new password/i);
      const confirmPassword = screen.getByLabelText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });
      
      await user.type(currentPassword, 'currentPass123!');
      await user.type(newPassword, 'ValidNewPass456!');
      await user.type(confirmPassword, 'DifferentPass789!');
      
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });

    test('should disable button when new password is same as current', async () => {
      render(<SettingsWrapper />);
      
      const currentPassword = screen.getByLabelText(/current password/i);
      const newPassword = screen.getByLabelText(/new password/i);
      const confirmPassword = screen.getByLabelText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });
      
      const samePassword = 'SamePass123!';
      await user.type(currentPassword, samePassword);
      await user.type(newPassword, samePassword);
      await user.type(confirmPassword, samePassword);
      
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });

    test('should disable button when password validation fails', async () => {
      render(<SettingsWrapper />);
      
      const currentPassword = screen.getByLabelText(/current password/i);
      const newPassword = screen.getByLabelText(/new password/i);
      const confirmPassword = screen.getByLabelText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });
      
      await user.type(currentPassword, 'currentPass123!');
      await user.type(newPassword, 'weak'); // Doesn't meet requirements
      await user.type(confirmPassword, 'weak');
      
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });

    test('should have aria-describedby when password requirements are shown', async () => {
      render(<SettingsWrapper />);
      
      const newPassword = screen.getByLabelText(/new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });
      
      // Type weak password to show requirements
      await user.type(newPassword, 'weak');
      
      await waitFor(() => {
        expect(submitButton).toHaveAttribute('aria-describedby', 'password-requirements');
        expect(screen.getByRole('list', { name: /password requirements/i })).toBeInTheDocument();
      });
    });

    test('should remove aria-describedby when password requirements are hidden', async () => {
      render(<SettingsWrapper />);
      
      const newPassword = screen.getByLabelText(/new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });
      
      // Type strong password
      await user.type(newPassword, 'StrongPass123!');
      
      await waitFor(() => {
        expect(submitButton).not.toHaveAttribute('aria-describedby');
        expect(screen.queryByRole('list', { name: /password requirements/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Password Requirements Accessibility', () => {
    test('should have proper id for password requirements list', async () => {
      render(<SettingsWrapper />);
      
      const newPassword = screen.getByLabelText(/new password/i);
      
      // Type weak password to trigger requirements
      await user.type(newPassword, 'weak');
      
      await waitFor(() => {
        const requirementsList = screen.getByRole('list');
        expect(requirementsList).toHaveAttribute('id', 'password-requirements');
      });
    });

    test('should maintain connection between button and requirements', async () => {
      render(<SettingsWrapper />);
      
      const newPassword = screen.getByLabelText(/new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });
      
      // Show requirements
      await user.type(newPassword, 'weak');
      
      await waitFor(() => {
        const requirementsList = screen.getByRole('list');
        expect(requirementsList).toHaveAttribute('id', 'password-requirements');
        expect(submitButton).toHaveAttribute('aria-describedby', 'password-requirements');
      });
      
      // Hide requirements
      await user.clear(newPassword);
      await user.type(newPassword, 'StrongPass123!');
      
      await waitFor(() => {
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
        expect(submitButton).not.toHaveAttribute('aria-describedby');
      });
    });
  });

  describe('Form State Integration', () => {
    test('should maintain validation state during rapid input changes', async () => {
      render(<SettingsWrapper />);
      
      const newPassword = screen.getByLabelText(/new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });
      
      const passwords = ['a', 'ab', 'abc', 'abcd', 'abcde', 'Abcde1!', 'StrongPass123!'];
      
      for (const password of passwords) {
        await user.clear(newPassword);
        await user.type(newPassword, password);
        
        // Button state should update accordingly
        if (password === 'StrongPass123!') {
          // Still disabled because other fields are empty
          expect(submitButton).toBeDisabled();
        } else {
          expect(submitButton).toBeDisabled();
        }
      }
    });

    test('should handle complex validation scenarios', async () => {
      render(<SettingsWrapper />);
      
      const currentPassword = screen.getByLabelText(/current password/i);
      const newPassword = screen.getByLabelText(/new password/i);
      const confirmPassword = screen.getByLabelText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });
      
      // Scenario 1: All valid
      await user.type(currentPassword, 'CurrentPass123!');
      await user.type(newPassword, 'NewPass456!');
      await user.type(confirmPassword, 'NewPass456!');
      
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
      
      // Scenario 2: Change confirm password to invalid
      await user.clear(confirmPassword);
      await user.type(confirmPassword, 'DifferentPass789!');
      
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
      
      // Scenario 3: Fix confirm password
      await user.clear(confirmPassword);
      await user.type(confirmPassword, 'NewPass456!');
      
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Loading States and Accessibility', () => {
    test('should maintain accessibility during loading state', async () => {
      mockApiClient.post.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({}), 100);
      }));
      
      render(<SettingsWrapper />);
      
      const currentPassword = screen.getByLabelText(/current password/i);
      const newPassword = screen.getByLabelText(/new password/i);
      const confirmPassword = screen.getByLabelText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });
      
      // Fill form with valid data
      await user.type(currentPassword, 'CurrentPass123!');
      await user.type(newPassword, 'NewPass456!');
      await user.type(confirmPassword, 'NewPass456!');
      
      // Submit form
      await user.click(submitButton);
      
      // Should show loading state
      expect(submitButton).toBeDisabled();
      expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
      
      // Wait for completion
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });
});