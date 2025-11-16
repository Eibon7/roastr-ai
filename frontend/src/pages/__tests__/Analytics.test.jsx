import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Analytics from '../Analytics';

jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart" />,
  Doughnut: () => <div data-testid="doughnut-chart" />,
  Bar: () => <div data-testid="bar-chart" />
}));

describe('Analytics Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  it('renders analytics summary after fetching data', async () => {
    const mockDashboard = {
      summary: {
        totals: { roasts: 42, analyses: 10, shieldActions: 5, cost: 1234 },
        averages: { response_time_ms: 120, rqc_score: 0.8 },
        growth: { roasts_pct: 5.2, shield_pct: -2.1 }
      },
      charts: {
        timeline: { labels: ['Hoy'], datasets: [] },
        platform: { labels: ['twitter'], datasets: [] },
        credits: { labels: ['roasts'], datasets: [] }
      },
      shield: {
        total_actions: 5,
        actions_by_type: { block: 2 },
        severity_distribution: { high: 3 },
        recent: []
      },
      credits: {
        totals: {},
        limits: {}
      },
      features: {
        analyticsEnabled: true,
        exportAllowed: true
      }
    };

    const mockBilling = {
      polar: { available: true, totals: { revenue_cents: 5000 } },
      localCosts: { total_cost_cents: 2000 }
    };

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockDashboard })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockBilling })
      });

    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText(/Roasts generados/i)).toBeInTheDocument();
    });

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('shows an error message when dashboard fails', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'fail' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { polar: { available: false }, localCosts: { total_cost_cents: 0 } } })
      });

    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText(/fail/i)).toBeInTheDocument();
    });
  });
});

