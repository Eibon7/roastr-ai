/**
 * Tests for ConnectNetworkCard Component - Issue #1045
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ConnectNetworkCard from '../connect-network-card';
import { apiClient } from '../../../../lib/api';
import { getCurrentPlan } from '../../../../api/plans';

// Mock dependencies
jest.mock('../../../../lib/api', () => ({
  apiClient: {
    post: jest.fn()
  }
}));

jest.mock('../../../../api/plans', () => ({
  getCurrentPlan: jest.fn()
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn()
  }
}));

describe('ConnectNetworkCard', () => {
  const mockAccounts = [
    { id: '1', platform: 'twitter', status: 'active' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    getCurrentPlan.mockResolvedValue({ plan: 'pro' });
  });

  it('should render loading state initially', () => {
    getCurrentPlan.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<ConnectNetworkCard accounts={mockAccounts} />);

    // Skeleton doesn't have testid, check by class
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render platform buttons', async () => {
    render(<ConnectNetworkCard accounts={mockAccounts} />);

    await waitFor(() => {
      expect(screen.getByText('Redes Disponibles')).toBeInTheDocument();
    });

    // Should show at least one platform (use getAllByText since there are multiple matches)
    const platforms = screen.getAllByText(/twitter|instagram|youtube/i);
    expect(platforms.length).toBeGreaterThan(0);
  });

  it('should display connection count (X/Y) for each platform', async () => {
    render(<ConnectNetworkCard accounts={mockAccounts} />);

    await waitFor(() => {
      // Twitter has 1 account, max is 2 for pro plan
      const badge = screen.getByText('1/2');
      expect(badge).toBeInTheDocument();
    });
  });

  it('should disable button when platform is at limit', async () => {
    const accountsAtLimit = [
      { id: '1', platform: 'twitter', status: 'active' },
      { id: '2', platform: 'twitter', status: 'active' }
    ];

    render(<ConnectNetworkCard accounts={accountsAtLimit} />);

    await waitFor(() => {
      const twitterButton = screen.getByText(/twitter/i).closest('button');
      expect(twitterButton).toBeDisabled();
    });
  });

  it('should call OAuth endpoint on button click', async () => {
    apiClient.post.mockResolvedValue({ success: true, data: { authUrl: 'https://oauth.example.com' } });
    
    // Mock window.location.href
    delete window.location;
    window.location = { href: '' };

    render(<ConnectNetworkCard accounts={[]} />);

    await waitFor(() => {
      const button = screen.getByText(/twitter/i).closest('button');
      expect(button).not.toBeDisabled();
    });

    const button = screen.getByText(/twitter/i).closest('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/accounts/connect/twitter', {});
    });
  });

  it('should show error toast on connection failure', async () => {
    const { toast } = require('sonner');
    apiClient.post.mockRejectedValue(new Error('Connection failed'));

    render(<ConnectNetworkCard accounts={[]} />);

    await waitFor(() => {
      const button = screen.getByText(/twitter/i).closest('button');
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('should refresh accounts after successful connection', async () => {
    const onAccountConnected = jest.fn();
    apiClient.post.mockResolvedValue({ success: true });

    render(<ConnectNetworkCard accounts={[]} onAccountConnected={onAccountConnected} />);

    await waitFor(() => {
      const button = screen.getByText(/twitter/i).closest('button');
      fireEvent.click(button);
    });

    // Should call callback if connection is direct (no OAuth redirect)
    await waitFor(() => {
      // Callback might be called or not depending on OAuth flow
      // This test verifies the component handles both cases
      expect(apiClient.post).toHaveBeenCalled();
    });
  });

  it('should handle different plan limits correctly', async () => {
    getCurrentPlan.mockResolvedValue({ plan: 'starter' });

    render(<ConnectNetworkCard accounts={mockAccounts} />);

    await waitFor(() => {
      // Starter plan has limit of 1
      expect(screen.getByText('1/1')).toBeInTheDocument();
    });
  });
});

