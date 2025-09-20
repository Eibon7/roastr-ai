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

// Import Settings component
const Settings = require('../../../frontend/src/pages/Settings.jsx').default;

const SettingsWrapper = ({ children }) => (
  <BrowserRouter>
    {children || <Settings />}
  </BrowserRouter>
);

describe('Settings Component - CodeRabbit Round 5 Improvements', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    mockNavigate.mockClear();
    mockApiClient.get.mockResolvedValue({ data: {} });
    mockApiClient.post.mockResolvedValue({});
  });

  describe('Password Validation Regex Fixes', () => {
    test('should correctly validate special characters without unnecessary escapes', async () => {
      render(<SettingsWrapper />);
      
      const newPasswordInput = screen.getByLabelText(/new password/i);
      
      // Test various special characters that should be valid
      const testPasswords = [
        'Test123!',      // exclamation
        'Test123@',      // at symbol
        'Test123#',      // hash
        'Test123$',      // dollar
        'Test123%',      // percent
        'Test123^',      // caret
        'Test123&',      // ampersand
        'Test123*',      // asterisk
        'Test123(',      // parentheses
        'Test123)',      // parentheses
        'Test123_',      // underscore
        'Test123+',      // plus
        'Test123-',      // hyphen
        'Test123=',      // equals
        'Test123[',      // square brackets
        'Test123]',      // square brackets
        'Test123{',      // curly braces
        'Test123}',      // curly braces
        'Test123|',      // pipe
        'Test123;',      // semicolon
        "Test123'",      // single quote
        'Test123:',      // colon
        'Test123"',      // double quote
        'Test123.',      // period
        'Test123,',      // comma
        'Test123<',      // less than
        'Test123>',      // greater than
        'Test123?',      // question mark
        'Test123`',      // backtick
        'Test123~'       // tilde
      ];

      for (const password of testPasswords) {
        await user.clear(newPasswordInput);
        await user.type(newPasswordInput, password);
        
        await waitFor(() => {
          // Should not show "One special character" requirement since password contains one
          const requirementsList = screen.queryByRole('list');
          if (requirementsList) {
            const requirementText = requirementsList.textContent;
            expect(requirementText).not.toContain('One special character');
          }
        });
      }
    });

    test('should show special character requirement for passwords without special chars', async () => {
      render(<SettingsWrapper />);
      
      const newPasswordInput = screen.getByLabelText(/new password/i);
      
      // Test password without special characters
      await user.type(newPasswordInput, 'TestPassword123');
      
      await waitFor(() => {
        const requirementsList = screen.getByRole('list');
        expect(requirementsList).toHaveTextContent('One special character');
      });
    });

    test('should handle edge case special characters correctly', async () => {
      render(<SettingsWrapper />);
      
      const newPasswordInput = screen.getByLabelText(/new password/i);
      
      // Test edge case characters that were potentially affected by regex escaping
      const edgeCasePasswords = [
        'Test123[',      // opening square bracket
        'Test123]',      // closing square bracket  
        'Test123\\',     // backslash
        'Test123/',      // forward slash
      ];

      for (const password of edgeCasePasswords) {
        await user.clear(newPasswordInput);
        await user.type(newPasswordInput, password);
        
        await waitFor(() => {
          // Should recognize these as valid special characters
          const requirementsList = screen.queryByRole('list');
          if (requirementsList) {
            const requirementText = requirementsList.textContent;
            expect(requirementText).not.toContain('One special character');
          }
        });
      }
    });
  });

  describe('Password Validation Integration', () => {
    test('should update validation status in real-time as user types', async () => {
      render(<SettingsWrapper />);
      
      const newPasswordInput = screen.getByLabelText(/new password/i);
      
      // Start with invalid password
      await user.type(newPasswordInput, 'a');
      
      await waitFor(() => {
        const requirementsList = screen.getByRole('list');
        expect(requirementsList).toBeInTheDocument();
        // Should show multiple requirements missing
        expect(requirementsList.textContent).toContain('At least 8 characters');
        expect(requirementsList.textContent).toContain('One uppercase letter');
        expect(requirementsList.textContent).toContain('One number');
        expect(requirementsList.textContent).toContain('One special character');
      });
      
      // Gradually improve password
      await user.type(newPasswordInput, 'bcdefg1A!');
      
      await waitFor(() => {
        // Requirements list should disappear when all conditions are met
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
      });
    });

    test('should show password strength indicator with proper progression', async () => {
      render(<SettingsWrapper />);
      
      const newPasswordInput = screen.getByLabelText(/new password/i);
      
      // Weak password
      await user.type(newPasswordInput, 'weak');
      
      await waitFor(() => {
        expect(screen.getByText(/weak/i)).toBeInTheDocument();
        expect(screen.getByText(/password strength/i)).toBeInTheDocument();
      });
      
      // Medium password
      await user.clear(newPasswordInput);
      await user.type(newPasswordInput, 'MediumPass1');
      
      await waitFor(() => {
        expect(screen.getByText(/medium/i)).toBeInTheDocument();
      });
      
      // Strong password
      await user.clear(newPasswordInput);
      await user.type(newPasswordInput, 'VeryStrongPass123!');
      
      await waitFor(() => {
        expect(screen.getByText(/strong/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation and UX', () => {
    test('should prevent form submission with invalid passwords', async () => {
      render(<SettingsWrapper />);
      
      const currentPassword = screen.getByLabelText(/current password/i);
      const newPassword = screen.getByLabelText(/new password/i);
      const confirmPassword = screen.getByLabelText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });
      
      // Fill with invalid new password
      await user.type(currentPassword, 'ValidCurrent123!');
      await user.type(newPassword, 'invalid');  // Missing requirements
      await user.type(confirmPassword, 'invalid');
      
      // Button should be disabled
      expect(submitButton).toBeDisabled();
      
      // Clicking should show validation error
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/password must contain/i);
      });
    });

    test('should enable form submission only when all validation passes', async () => {
      render(<SettingsWrapper />);
      
      const currentPassword = screen.getByLabelText(/current password/i);
      const newPassword = screen.getByLabelText(/new password/i);
      const confirmPassword = screen.getByLabelText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });
      
      // Initially disabled
      expect(submitButton).toBeDisabled();
      
      // Fill with valid data
      await user.type(currentPassword, 'CurrentPass123!');
      await user.type(newPassword, 'NewValidPass456#');
      await user.type(confirmPassword, 'NewValidPass456#');
      
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Accessibility and Documentation Improvements', () => {
    test('should have proper aria-describedby connection', async () => {
      render(<SettingsWrapper />);
      
      const newPasswordInput = screen.getByLabelText(/new password/i);
      
      // Type weak password to show requirements
      await user.type(newPasswordInput, 'weak');
      
      await waitFor(() => {
        expect(newPasswordInput).toHaveAttribute('aria-describedby', 'password-requirements');
        
        const requirementsList = screen.getByRole('list');
        expect(requirementsList).toHaveAttribute('id', 'password-requirements');
      });
      
      // Clear password - connection should be removed
      await user.clear(newPasswordInput);
      await user.type(newPasswordInput, 'StrongPassword123!');
      
      await waitFor(() => {
        expect(newPasswordInput).not.toHaveAttribute('aria-describedby');
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
      });
    });

    test('should maintain accessibility standards for all form elements', async () => {
      render(<SettingsWrapper />);
      
      // Check all password inputs have labels
      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
      
      // Check password toggle buttons have accessible labels
      const toggleButtons = screen.getAllByLabelText(/show|hide.*password/i);
      expect(toggleButtons.length).toBeGreaterThanOrEqual(3);
      
      // Check submit button accessibility
      const submitButton = screen.getByRole('button', { name: /change password/i });
      expect(submitButton).toBeInTheDocument();
    });
  });
});