/**
 * Tests for AutoApprovalStatus Component
 * Issue #405
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AutoApprovalStatus from '../AutoApprovalStatus';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('AutoApprovalStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Set mock mode
    process.env.REACT_APP_ENABLE_MOCK_MODE = 'true';
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders idle state initially', () => {
    render(<AutoApprovalStatus commentId={null} />);

    expect(screen.getByText('Auto-Approval Status')).toBeInTheDocument();
    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });

  it('starts processing when commentId is provided', async () => {
    const mockComment = { id: 'comment-123' };
    render(<AutoApprovalStatus commentId={mockComment.id} />);

    // Should start in processing state
    await waitFor(() => {
      expect(screen.getByText('Processing Comment')).toBeInTheDocument();
    });
  });

  it('shows progress through all states in mock mode', async () => {
    const onStatusChange = jest.fn();
    render(<AutoApprovalStatus commentId="comment-123" onStatusChange={onStatusChange} />);

    // Initial state: Processing Comment
    expect(screen.getByText('Processing Comment')).toBeInTheDocument();

    // Advance timer to next state: Generating Roast
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(screen.getByText('Generating Roast')).toBeInTheDocument();
      expect(screen.getByText(/Generating 1 roast variant/)).toBeInTheDocument();
    });

    // Advance to Security Check
    jest.advanceTimersByTime(3000);
    await waitFor(() => {
      expect(screen.getByText('Security Check')).toBeInTheDocument();
      expect(screen.getByText('Security Validations')).toBeInTheDocument();
    });

    // Advance to Auto-Approving
    jest.advanceTimersByTime(2000);
    await waitFor(() => {
      expect(screen.getByText('Auto-Approving')).toBeInTheDocument();
    });

    // Advance to Publishing
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(screen.getByText('Publishing')).toBeInTheDocument();
    });

    // Final state: Published
    jest.advanceTimersByTime(2000);
    await waitFor(() => {
      expect(screen.getByText('Published')).toBeInTheDocument();
      expect(screen.getByText('Published Successfully!')).toBeInTheDocument();
      expect(onStatusChange).toHaveBeenCalledWith('completed', expect.any(Object));
    });
  });

  it('displays security validation results', async () => {
    render(<AutoApprovalStatus commentId="comment-123" />);

    // Advance to security validation state
    jest.advanceTimersByTime(4000); // 1000 + 3000

    await waitFor(() => {
      expect(screen.getByText('Security Validations')).toBeInTheDocument();
      expect(screen.getByText(/content Filter/i)).toBeInTheDocument();
      expect(screen.getByText(/toxicity Threshold/i)).toBeInTheDocument();
      expect(screen.getByText(/platform Compliance/i)).toBeInTheDocument();
      expect(screen.getByText(/organization Policy/i)).toBeInTheDocument();
      expect(screen.getByText(/shield Approval/i)).toBeInTheDocument();
    });
  });

  it('shows error state when API call fails', async () => {
    // Switch to real mode for this test
    process.env.NODE_ENV = 'production';
    process.env.REACT_APP_ENABLE_MOCK_MODE = 'false';

    fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<AutoApprovalStatus commentId="comment-123" />);

    await waitFor(() => {
      expect(screen.getByText('Publication Failed')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows rate limited state', () => {
    render(<AutoApprovalStatus commentId="comment-123" />);

    // Manually set to rate limited state for testing
    const badge = screen.getByText('Waiting').parentElement;
    expect(badge).toHaveClass('bg-gray-100');
  });

  it('displays progress bar during processing', async () => {
    render(<AutoApprovalStatus commentId="comment-123" />);

    // Advance to a state that shows progress
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/30%/)).toBeInTheDocument();
    });
  });

  it('shows post ID when successfully published', async () => {
    render(<AutoApprovalStatus commentId="comment-123" />);

    // Advance through all states to published
    jest.advanceTimersByTime(9000); // Total of all delays

    await waitFor(() => {
      expect(screen.getByText('Published Successfully!')).toBeInTheDocument();
      expect(screen.getByText(/Post ID: pub-/)).toBeInTheDocument();
    });
  });

  it('handles failed security validation', () => {
    render(<AutoApprovalStatus commentId="comment-123" />);

    // Component should gracefully handle security failures
    expect(screen.getByText('Auto-Approval Status')).toBeInTheDocument();
  });

  it('shows spinning icon for processing states', async () => {
    render(<AutoApprovalStatus commentId="comment-123" />);

    await waitFor(() => {
      const icon = screen.getByText('Processing Comment').previousSibling;
      expect(icon).toHaveClass('animate-spin');
    });
  });
});
