import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import HealthFlagsCard from '../HealthFlagsCard';

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const MockIcon = (props) => <div data-testid="mock-icon" {...props} />;
  return new Proxy({}, { get: () => MockIcon });
});

// Mock timers for auto-refresh testing
jest.useFakeTimers('legacy');

describe('HealthFlagsCard', () => {
  beforeEach(() => {
    fetch.mockClear();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('renders loading state initially', () => {
    render(<HealthFlagsCard />);
    expect(screen.getByText('System Health')).toBeInTheDocument();
    // Check for skeleton loading elements by class
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  test('renders health data after successful API call', async () => {
    const mockHealthData = {
      services: {
        api: 'ok',
        billing: 'degraded',
        ai: 'degraded',
        db: 'ok'
      },
      flags: {
        rqc: true,
        shield: false,
        mockMode: true
      },
      timestamp: '2025-01-09T12:00:00Z'
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealthData,
    });

    render(<HealthFlagsCard />);

    await waitFor(() => {
      expect(screen.getByText('Services')).toBeInTheDocument();
      expect(screen.getByText('api')).toBeInTheDocument();
      expect(screen.getByText('billing')).toBeInTheDocument();
      expect(screen.getByText('ai')).toBeInTheDocument();
      expect(screen.getByText('db')).toBeInTheDocument();
      
      expect(screen.getAllByText('ok')).toHaveLength(1);
      expect(screen.getAllByText('degraded')).toHaveLength(2);
    });
  });

  test('renders feature flags correctly', async () => {
    const mockHealthData = {
      services: {},
      flags: {
        rqc: true,
        shield: false,
        mockMode: true,
        verboseLogs: false
      }
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealthData,
    });

    render(<HealthFlagsCard />);

    await waitFor(() => {
      expect(screen.getByText('Features')).toBeInTheDocument();
      expect(screen.getByText('rqc')).toBeInTheDocument();
      expect(screen.getByText('shield')).toBeInTheDocument();
      expect(screen.getByText('mockMode')).toBeInTheDocument();
      expect(screen.getByText('verboseLogs')).toBeInTheDocument();
    });
  });

  test('displays correct status variants based on service status', async () => {
    const mockHealthData = {
      services: {
        service1: 'ok',
        service2: 'degraded',
        service3: 'error'
      },
      flags: {}
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealthData,
    });

    render(<HealthFlagsCard />);

    await waitFor(() => {
      const statusElements = screen.getAllByText(/ok|degraded|error/);
      expect(statusElements).toHaveLength(3);
    });
  });

  test('shows timestamp when available', async () => {
    const mockHealthData = {
      services: {},
      flags: {},
      timestamp: '2025-01-09T15:30:00Z'
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealthData,
    });

    render(<HealthFlagsCard />);

    await waitFor(() => {
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });

  test('handles missing timestamp gracefully', async () => {
    const mockHealthData = {
      services: {},
      flags: {}
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealthData,
    });

    render(<HealthFlagsCard />);

    await waitFor(() => {
      expect(screen.getByText('Last updated: Unknown')).toBeInTheDocument();
    });
  });

  test('refreshes data every 30 seconds', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ services: {}, flags: {} }),
    });

    render(<HealthFlagsCard />);

    // Wait for initial call to complete
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    // Fast forward 30 seconds
    jest.advanceTimersByTime(30000);

    // Wait for the timer to trigger
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  test('calls health API endpoint on mount', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ services: {}, flags: {} }),
    });

    render(<HealthFlagsCard />);

    expect(fetch).toHaveBeenCalledWith('/api/health');
  });

  test('handles API error gracefully', async () => {
    fetch.mockRejectedValueOnce(new Error('API Error'));

    render(<HealthFlagsCard />);

    await waitFor(() => {
      // Should still render the basic structure without data
      expect(screen.getByText('System Health')).toBeInTheDocument();
    });
  });
});