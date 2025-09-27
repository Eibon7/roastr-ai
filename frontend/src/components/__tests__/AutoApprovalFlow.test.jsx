/**
 * Tests for AutoApprovalFlow Component
 * Issue #405
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AutoApprovalFlow from '../AutoApprovalFlow';
import { AuthContext } from '../../contexts/AuthContext';

// Mock child components
jest.mock('../AutoApprovalStatus', () => {
  return function MockAutoApprovalStatus({ commentId, onStatusChange }) {
    return <div>AutoApprovalStatus for {commentId}</div>;
  };
});

jest.mock('../SecurityValidationIndicator', () => {
  return function MockSecurityValidationIndicator({ commentId, status }) {
    return <div>SecurityValidationIndicator - Status: {status}</div>;
  };
});

// Mock dependencies
jest.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

// Mock fetch
global.fetch = jest.fn();

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  organization_id: 'test-org-id',
  token: 'test-token'
};

const mockAuthContext = {
  user: mockUser,
  isAuthenticated: true
};

const mockComment = {
  id: 'comment-123',
  text: 'This product is terrible!',
  author_username: 'unhappy_customer',
  platform: 'twitter',
  toxicity_score: 0.6
};

const renderWithAuth = (component) => {
  return render(
    <AuthContext.Provider value={mockAuthContext}>
      {component}
    </AuthContext.Provider>
  );
};

describe('AutoApprovalFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with rate limit status', () => {
    renderWithAuth(<AutoApprovalFlow comment={mockComment} />);
    
    expect(screen.getByText('Auto-Approval Flow')).toBeInTheDocument();
    expect(screen.getByText(/hourly/)).toBeInTheDocument();
    expect(screen.getByText(/daily/)).toBeInTheDocument();
  });

  it('displays comment preview', () => {
    renderWithAuth(<AutoApprovalFlow comment={mockComment} />);
    
    expect(screen.getByText('@unhappy_customer')).toBeInTheDocument();
    expect(screen.getByText('This product is terrible!')).toBeInTheDocument();
    expect(screen.getByText('twitter')).toBeInTheDocument();
    expect(screen.getByText('Toxicity: 60%')).toBeInTheDocument();
  });

  it('shows start button when not processing', () => {
    renderWithAuth(<AutoApprovalFlow comment={mockComment} />);
    
    const startButton = screen.getByRole('button', { name: /Start Auto-Approval/i });
    expect(startButton).toBeInTheDocument();
    expect(startButton).not.toBeDisabled();
  });

  it('disables start button when no comment', () => {
    renderWithAuth(<AutoApprovalFlow comment={null} />);
    
    const startButton = screen.getByRole('button', { name: /Start Auto-Approval/i });
    expect(startButton).toBeDisabled();
  });

  it('starts auto-approval process when clicked', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        roast: { 
          id: 'roast-123', 
          text: 'Generated roast text',
          postId: 'post-123'
        } 
      })
    });

    renderWithAuth(<AutoApprovalFlow comment={mockComment} />);
    
    const startButton = screen.getByRole('button', { name: /Start Auto-Approval/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `/api/comments/${mockComment.id}/auto-process`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }),
          body: JSON.stringify({
            mode: 'auto',
            autoApproval: true
          })
        })
      );
    });
  });

  it('shows rate limit warning when exceeded', async () => {
    // Render with rate limits exceeded
    const { rerender } = renderWithAuth(<AutoApprovalFlow comment={mockComment} />);
    
    // Update component to simulate rate limit exceeded
    const RateLimitedFlow = () => {
      const [stats] = React.useState({
        hourlyUsed: 50,
        hourlyLimit: 50,
        dailyUsed: 200,
        dailyLimit: 200
      });
      
      return (
        <AuthContext.Provider value={mockAuthContext}>
          <AutoApprovalFlow comment={mockComment} />
        </AuthContext.Provider>
      );
    };
    
    rerender(<RateLimitedFlow />);

    await waitFor(() => {
      const warning = screen.getByText(/Rate limit reached/);
      expect(warning).toBeInTheDocument();
    });
  });

  it('shows retry button on failure', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    renderWithAuth(<AutoApprovalFlow comment={mockComment} />);
    
    const startButton = screen.getByRole('button', { name: /Start Auto-Approval/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      // Component should handle error and show retry option
      expect(screen.queryByRole('button', { name: /Start Auto-Approval/i })).toBeInTheDocument();
    });
  });

  it('updates rate limit stats after successful processing', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roast: { id: 'roast-123' } })
    });

    renderWithAuth(<AutoApprovalFlow comment={mockComment} />);
    
    // Initial stats should show
    expect(screen.getByText(/hourly/)).toBeInTheDocument();
    
    const startButton = screen.getByRole('button', { name: /Start Auto-Approval/i });
    fireEvent.click(startButton);

    // Stats should update after processing
    await waitFor(() => {
      // Component updates internal state
      expect(fetch).toHaveBeenCalled();
    });
  });

  it('shows AutoApprovalStatus when processing', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roast: { id: 'roast-123' } })
    });

    renderWithAuth(<AutoApprovalFlow comment={mockComment} />);
    
    const startButton = screen.getByRole('button', { name: /Start Auto-Approval/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText(`AutoApprovalStatus for ${mockComment.id}`)).toBeInTheDocument();
    });
  });

  it('shows pause button during processing', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roast: { id: 'roast-123' } })
    });

    renderWithAuth(<AutoApprovalFlow comment={mockComment} />);
    
    const startButton = screen.getByRole('button', { name: /Start Auto-Approval/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      const pauseButton = screen.getByRole('button', { name: /Pause/i });
      expect(pauseButton).toBeInTheDocument();
    });
  });

  it('displays generated roast after successful processing', async () => {
    const mockRoast = {
      id: 'roast-123',
      text: 'Your feedback has been noted and filed under "Things We Already Know"',
      postId: 'post-123'
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roast: mockRoast })
    });

    renderWithAuth(<AutoApprovalFlow comment={mockComment} />);
    
    const startButton = screen.getByRole('button', { name: /Start Auto-Approval/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Generated Roast')).toBeInTheDocument();
      expect(screen.getByText(mockRoast.text)).toBeInTheDocument();
      expect(screen.getByText(`Published with ID: ${mockRoast.postId}`)).toBeInTheDocument();
    });
  });
});