import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PlanStatusCard from '../PlanStatusCard';

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const MockIcon = (props) => <div data-testid="mock-icon" {...props} />;
  return new Proxy({}, { get: () => MockIcon });
});

describe('PlanStatusCard', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('renders loading state initially', () => {
    render(<PlanStatusCard />);
    expect(screen.getByText('Plan Status')).toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton')).toHaveLength(4);
  });

  test('renders user data after successful API call', async () => {
    const mockUserData = {
      plan: 'pro',
      usage: {
        aiCalls: 150,
        limits: { aiCallsLimit: 2000 }
      },
      integrations: ['twitter', 'youtube'],
      features: {
        shield: true,
        rqc: false,
        analytics: true
      }
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUserData,
    });

    render(<PlanStatusCard />);

    await waitFor(() => {
      expect(screen.getByText('Pro')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('/ 2,000')).toBeInTheDocument();
      expect(screen.getByText('2 active')).toBeInTheDocument();
    });
  });

  test('renders empty state when API call fails', async () => {
    fetch.mockRejectedValueOnce(new Error('API Error'));

    render(<PlanStatusCard />);

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  test('displays correct features based on plan', async () => {
    const mockUserData = {
      plan: 'enterprise',
      usage: { aiCalls: 500, limits: { aiCallsLimit: 10000 }},
      integrations: ['twitter', 'youtube', 'instagram'],
      features: {
        shield: true,
        rqc: true,
        analytics: true
      }
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUserData,
    });

    render(<PlanStatusCard />);

    await waitFor(() => {
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
      expect(screen.getByText('Shield Active')).toBeInTheDocument();
      expect(screen.getByText('RQC Enabled')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });
  });

  test('calls user API endpoint on mount', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ plan: 'starter_trial' }),
    });

    render(<PlanStatusCard />);

    expect(fetch).toHaveBeenCalledWith('/api/user');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});