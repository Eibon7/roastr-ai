/**
 * ApprovalCard Component Tests
 * 
 * Tests for the manual roast approval component including:
 * - Basic rendering and display
 * - Edit mode functionality
 * - Character limit validation
 * - Approval/rejection actions
 * - Regeneration functionality
 * - Error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApprovalCard } from '../Approval';

// Mock the toast hook
const mockToast = jest.fn();
jest.mock('../../hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  XCircle: () => <div data-testid="x-circle-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  Edit3: () => <div data-testid="edit-icon" />,
  MessageSquare: () => <div data-testid="message-icon" />,
  Shield: () => <div data-testid="shield-icon" />
}));

// Mock UI components
jest.mock('../../components/ui/card', () => ({
  Card: ({ children, className }) => <div className={className}>{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardContent: ({ children }) => <div>{children}</div>
}));

jest.mock('../../components/ui/badge', () => ({
  Badge: ({ children, variant, className }) => (
    <span className={`badge ${variant} ${className}`}>{children}</span>
  )
}));

jest.mock('../../components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, title, ...props }) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={className}
      title={title}
      {...props}
    >
      {children}
    </button>
  )
}));

jest.mock('../../components/ui/textarea', () => ({
  Textarea: ({ value, onChange, className, placeholder, ...props }) => (
    <textarea
      value={value}
      onChange={onChange}
      className={className}
      placeholder={placeholder}
      {...props}
    />
  )
}));

jest.mock('../../components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />
}));

describe('ApprovalCard', () => {
  const mockResponse = {
    id: 'response-123',
    response_text: 'This is a test roast response',
    tone: 'balanceado', // Issue #872: Updated to new 3-tone system
    // humor_type removed (deprecated post-#686)
    created_at: '2025-01-01T10:00:00Z',
    attempt_number: 1,
    total_attempts: 1,
    comment: {
      platform: 'twitter',
      platform_username: 'testuser',
      original_text: 'Original comment text',
      severity_level: 'medium',
      toxicity_score: 0.7
    }
  };

  const mockProps = {
    response: mockResponse,
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onRegenerate: jest.fn(),
    loading: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders response information correctly', () => {
      render(<ApprovalCard {...mockProps} />);

      expect(screen.getByText('twitter')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
      expect(screen.getByText('70% toxic')).toBeInTheDocument();
      expect(screen.getByText('@testuser')).toBeInTheDocument();
      expect(screen.getByText('Original comment text')).toBeInTheDocument();
      expect(screen.getByText('This is a test roast response')).toBeInTheDocument();
    });

    test('shows attempt counter for multiple attempts', () => {
      const multiAttemptResponse = {
        ...mockResponse,
        attempt_number: 2,
        total_attempts: 3
      };

      render(<ApprovalCard {...mockProps} response={multiAttemptResponse} />);

      expect(screen.getByText('Attempt 2/3')).toBeInTheDocument();
    });

    test('displays tone badge', () => {
      render(<ApprovalCard {...mockProps} />);

      // Issue #872: Only tone is displayed, humor_type removed
      expect(screen.getByText(/Tono:/)).toBeInTheDocument();
      expect(screen.getByText(/balanceado/)).toBeInTheDocument();
    });
  });

  describe('Edit Mode Functionality', () => {
    test('toggles edit mode when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      await user.click(editButton);

      expect(screen.getByPlaceholderText('Edit the response text...')).toBeInTheDocument();
      expect(screen.getByDisplayValue('This is a test roast response')).toBeInTheDocument();
    });

    test('shows character counter in edit mode', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      await user.click(editButton);

      expect(screen.getByText('28/280 characters')).toBeInTheDocument();
    });

    test('updates character counter when text is edited', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      await user.click(editButton);

      const textarea = screen.getByPlaceholderText('Edit the response text...');
      await user.clear(textarea);
      await user.type(textarea, 'Short text');

      expect(screen.getByText('10/280 characters')).toBeInTheDocument();
    });
  });

  describe('Character Limit Validation', () => {
    test('shows warning when approaching character limit', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      await user.click(editButton);

      const textarea = screen.getByPlaceholderText('Edit the response text...');
      const longText = 'a'.repeat(265); // 15 characters remaining
      await user.clear(textarea);
      await user.type(textarea, longText);

      expect(screen.getByText('15 characters remaining')).toBeInTheDocument();
    });

    test('shows error when exceeding character limit', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      await user.click(editButton);

      const textarea = screen.getByPlaceholderText('Edit the response text...');
      const tooLongText = 'a'.repeat(300); // Exceeds Twitter's 280 limit
      await user.clear(textarea);
      await user.type(textarea, tooLongText);

      expect(screen.getByText('20 characters over limit')).toBeInTheDocument();
      expect(screen.getByText(/This response is too long for twitter/)).toBeInTheDocument();
    });

    test('disables approve button when over character limit', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      await user.click(editButton);

      const textarea = screen.getByPlaceholderText('Edit the response text...');
      const tooLongText = 'a'.repeat(300);
      await user.clear(textarea);
      await user.type(textarea, tooLongText);

      const approveButton = screen.getByText(/Approve & Edit/);
      expect(approveButton).toBeDisabled();
      expect(approveButton).toHaveAttribute('title', 'Cannot approve: 20 characters over limit');
    });

    test('applies correct styling for over-limit text', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      await user.click(editButton);

      const textarea = screen.getByPlaceholderText('Edit the response text...');
      const tooLongText = 'a'.repeat(300);
      await user.clear(textarea);
      await user.type(textarea, tooLongText);

      expect(textarea).toHaveClass('border-red-500');
    });
  });

  describe('Platform-Specific Limits', () => {
    test('applies Instagram character limit correctly', async () => {
      const instagramResponse = {
        ...mockResponse,
        comment: { ...mockResponse.comment, platform: 'instagram' }
      };

      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} response={instagramResponse} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      await user.click(editButton);

      expect(screen.getByText('28/2200 characters')).toBeInTheDocument();
    });

    test('applies YouTube character limit correctly', async () => {
      const youtubeResponse = {
        ...mockResponse,
        comment: { ...mockResponse.comment, platform: 'youtube' }
      };

      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} response={youtubeResponse} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      await user.click(editButton);

      expect(screen.getByText('28/10000 characters')).toBeInTheDocument();
    });

    test('uses default limit for unknown platforms', async () => {
      const unknownResponse = {
        ...mockResponse,
        comment: { ...mockResponse.comment, platform: 'unknown' }
      };

      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} response={unknownResponse} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      await user.click(editButton);

      expect(screen.getByText('28/1000 characters')).toBeInTheDocument();
    });
  });

  describe('Approval Actions', () => {
    test('calls onApprove with original text when not editing', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const approveButton = screen.getByText('Approve');
      await user.click(approveButton);

      expect(mockProps.onApprove).toHaveBeenCalledWith('response-123', null);
    });

    test('calls onApprove with edited text when editing', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      await user.click(editButton);

      const textarea = screen.getByPlaceholderText('Edit the response text...');
      await user.clear(textarea);
      await user.type(textarea, 'Edited roast text');

      const approveButton = screen.getByText(/Approve & Edit/);
      await user.click(approveButton);

      expect(mockProps.onApprove).toHaveBeenCalledWith('response-123', 'Edited roast text');
    });

    test('prevents approval when text exceeds character limit', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      await user.click(editButton);

      const textarea = screen.getByPlaceholderText('Edit the response text...');
      const tooLongText = 'a'.repeat(300);
      await user.clear(textarea);
      await user.type(textarea, tooLongText);

      const approveButton = screen.getByText(/Approve & Edit/);
      await user.click(approveButton);

      expect(mockProps.onApprove).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: "Cannot approve response",
        description: "Response exceeds 280 character limit for twitter. Please shorten the text.",
        variant: "destructive",
      });
    });

    test('exits edit mode after successful approval', async () => {
      const user = userEvent.setup();
      mockProps.onApprove.mockResolvedValue();
      render(<ApprovalCard {...mockProps} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      await user.click(editButton);

      const approveButton = screen.getByText(/Approve & Edit/);
      await user.click(approveButton);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Edit the response text...')).not.toBeInTheDocument();
      });
    });

    test('shows success toast after approval', async () => {
      const user = userEvent.setup();
      mockProps.onApprove.mockResolvedValue();
      render(<ApprovalCard {...mockProps} />);

      const approveButton = screen.getByText('Approve');
      await user.click(approveButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Response approved",
          description: "The roast has been approved and queued for posting",
        });
      });
    });

    test('shows error toast when approval fails', async () => {
      const user = userEvent.setup();
      mockProps.onApprove.mockRejectedValue(new Error('Approval failed'));
      render(<ApprovalCard {...mockProps} />);

      const approveButton = screen.getByText('Approve');
      await user.click(approveButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error approving response",
          description: "Approval failed",
          variant: "destructive",
        });
      });
    });
  });

  describe('Rejection Actions', () => {
    test('shows rejection form when reject button is clicked', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const rejectButton = screen.getByText('Reject');
      await user.click(rejectButton);

      expect(screen.getByPlaceholderText('Reason for rejection (optional)...')).toBeInTheDocument();
      expect(screen.getByText('Confirm Reject')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    test('calls onReject with reason when confirmed', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const rejectButton = screen.getByText('Reject');
      await user.click(rejectButton);

      const reasonTextarea = screen.getByPlaceholderText('Reason for rejection (optional)...');
      await user.type(reasonTextarea, 'Not funny enough');

      const confirmButton = screen.getByText('Confirm Reject');
      await user.click(confirmButton);

      expect(mockProps.onReject).toHaveBeenCalledWith('response-123', 'Not funny enough');
    });

    test('cancels rejection form when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const rejectButton = screen.getByText('Reject');
      await user.click(rejectButton);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(screen.queryByPlaceholderText('Reason for rejection (optional)...')).not.toBeInTheDocument();
    });
  });

  describe('Regeneration Actions', () => {
    test('calls onRegenerate when regenerate button is clicked', async () => {
      const user = userEvent.setup();
      render(<ApprovalCard {...mockProps} />);

      const regenerateButton = screen.getByText('Regenerate');
      await user.click(regenerateButton);

      expect(mockProps.onRegenerate).toHaveBeenCalledWith('response-123');
    });

    test('shows loading state during regeneration', async () => {
      const user = userEvent.setup();
      mockProps.onRegenerate.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<ApprovalCard {...mockProps} />);

      const regenerateButton = screen.getByText('Regenerate');
      await user.click(regenerateButton);

      expect(regenerateButton).toBeDisabled();
    });
  });

  describe('Loading States', () => {
    test('disables all buttons when loading', () => {
      render(<ApprovalCard {...mockProps} loading={true} />);

      expect(screen.getByText('Approve')).toBeDisabled();
      expect(screen.getByText('Reject')).toBeDisabled();
      expect(screen.getByText('Regenerate')).toBeDisabled();
    });
  });
});
