import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import BillingPanel from '../BillingPanel';
import { useAuth } from '../../../contexts/AuthContext';
import { apiClient } from '../../../lib/api';
import { toast } from 'sonner';

// Mocks
jest.mock('../../../contexts/AuthContext');
jest.mock('../../../lib/api');
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

describe('BillingPanel', () => {
  const mockUser = {
    email: 'test@example.com',
    plan: 'pro'
  };

  const mockBillingInfo = {
    usage: {
      roastsUsed: 150,
      apiCalls: 200
    },
    limits: {
      roastsPerMonth: 1000,
      apiCallsPerMonth: 1000
    }
  };

  beforeEach(() => {
    useAuth.mockReturnValue({
      userData: mockUser
    });
    apiClient.get = jest.fn().mockResolvedValue({ data: mockBillingInfo });
  });

  it('renders loading state initially', () => {
    render(
      <BrowserRouter>
        <BillingPanel />
      </BrowserRouter>
    );

    expect(screen.getByText(/loading billing information/i)).toBeInTheDocument();
  });

  it('loads and displays billing information', async () => {
    render(
      <BrowserRouter>
        <BillingPanel />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/current plan/i)).toBeInTheDocument();
      expect(screen.getByText(/roasts generated/i)).toBeInTheDocument();
      expect(screen.getByText(/api calls/i)).toBeInTheDocument();
    });
  });

  it('displays plan information correctly', async () => {
    render(
      <BrowserRouter>
        <BillingPanel />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/pro plan/i)).toBeInTheDocument();
    });
  });

  it('displays usage metrics', async () => {
    render(
      <BrowserRouter>
        <BillingPanel />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
    });
  });

  it('displays available plans', async () => {
    render(
      <BrowserRouter>
        <BillingPanel />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/available plans/i)).toBeInTheDocument();
    });
  });

  it('handles billing info load error', async () => {
    apiClient.get.mockRejectedValue(new Error('Failed to load'));

    render(
      <BrowserRouter>
        <BillingPanel />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load billing information');
    });
  });
});

