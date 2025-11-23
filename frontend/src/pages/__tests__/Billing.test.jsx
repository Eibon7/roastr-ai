import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Billing from '../Billing';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const MockIcon = (props) => <div data-testid="mock-icon" {...props} />;
  return new Proxy({}, { get: () => MockIcon });
});

// Mock createMockFetch
const mockFetch = jest.fn();
jest.mock('../../lib/mockMode', () => ({
  createMockFetch: () => mockFetch
}));

describe('Billing Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderBilling = () => {
    return render(<Billing />);
  };

  const mockApiResponses = (userPlan = 'pro', usageData = {}, entitlementsData = {}) => {
    const defaultEntitlements = {
      analysis_limit_monthly: 10000,
      roast_limit_monthly: 1000,
      plan_name: userPlan,
      model: 'gpt-4',
      shield_enabled: true,
      rqc_mode: 'basic',
      ...entitlementsData
    };

    const defaultUsage = {
      analysis_used: 750,
      roast_used: 45,
      costCents: 1500,
      ...usageData
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ plan: userPlan })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(defaultUsage)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(defaultEntitlements)
      });
  };

  it('renders billing page with usage progress bars', async () => {
    mockApiResponses();

    renderBilling();

    await waitFor(() => {
      expect(screen.getByText('Billing & Usage')).toBeInTheDocument();
    });

    // Check that progress bars are rendered
    expect(screen.getByText('Monthly Usage')).toBeInTheDocument();
    expect(screen.getByText('Analyses Used')).toBeInTheDocument();
    expect(screen.getByText('Roasts Generated')).toBeInTheDocument();

    // Check usage numbers
    expect(screen.getByText('750')).toBeInTheDocument(); // analyses used
    expect(screen.getByText('45')).toBeInTheDocument(); // roasts used
  });

  it('shows correct plan information', async () => {
    mockApiResponses('pro');

    renderBilling();

    await waitFor(() => {
      expect(screen.getByText('Current Plan')).toBeInTheDocument();
    });

    // Check plan details
    expect(screen.getByText('pro')).toBeInTheDocument();
    expect(screen.getByText('€15/month')).toBeInTheDocument();
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
    expect(screen.getByText('✓ Enabled')).toBeInTheDocument(); // Shield
  });

  it('displays warning when usage approaches 80% limit', async () => {
    mockApiResponses('pro', {
      analysis_used: 8500, // 85% of 10000
      roast_used: 850 // 85% of 1000
    });

    renderBilling();

    await waitFor(() => {
      expect(screen.getByText('Billing & Usage')).toBeInTheDocument();
    });

    // Check for warning indicators
    const warningTexts = screen.getAllByText(/Approaching limit/);
    expect(warningTexts).toHaveLength(2); // Both progress bars should show warning
  });

  it('displays error when usage reaches 100% limit', async () => {
    mockApiResponses('pro', {
      analysis_used: 10000, // 100% of 10000
      roast_used: 1000 // 100% of 1000
    });

    renderBilling();

    await waitFor(() => {
      expect(screen.getByText('Billing & Usage')).toBeInTheDocument();
    });

    // Check for limit reached indicators
    const limitTexts = screen.getAllByText(/Limit reached!/);
    expect(limitTexts).toHaveLength(2); // Both progress bars should show limit reached
  });

  it('calculates usage percentages correctly', async () => {
    mockApiResponses('pro', {
      analysis_used: 2500, // 25% of 10000
      roast_used: 250 // 25% of 1000
    });

    renderBilling();

    await waitFor(() => {
      expect(screen.getByText('Billing & Usage')).toBeInTheDocument();
    });

    // Check percentage displays
    expect(screen.getAllByText('25.0% used')).toHaveLength(2);
  });

  it('handles billing portal button click', async () => {
    mockApiResponses();

    // Mock portal response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: 'https://billing.stripe.com/portal_123' })
    });

    window.open = jest.fn();

    renderBilling();

    await waitFor(() => {
      expect(screen.getByText('Manage Billing')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Manage Billing'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/billing/portal', {
        method: 'POST'
      });
    });
  });

  it('navigates to pricing page when clicking View Plans', async () => {
    mockApiResponses();

    renderBilling();

    await waitFor(() => {
      expect(screen.getByText('View Plans')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View Plans'));

    expect(mockNavigate).toHaveBeenCalledWith('/pricing');
  });

  it('shows correct billing history for paid plans', async () => {
    mockApiResponses('pro');

    renderBilling();

    await waitFor(() => {
      expect(screen.getByText('Billing History')).toBeInTheDocument();
    });

    // Check for invoice entries
    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText('€15.00')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('shows no billing history for starter_trial plan', async () => {
    mockApiResponses('starter_trial');

    renderBilling();

    await waitFor(() => {
      expect(screen.getByText('Billing History')).toBeInTheDocument();
    });

    // Check for no billing history message
    expect(screen.getByText('No billing history')).toBeInTheDocument();
    expect(screen.getByText('Upgrade to a paid plan to see invoices')).toBeInTheDocument();
  });

  it('displays cost information correctly', async () => {
    mockApiResponses('pro', { costCents: 1500 });

    renderBilling();

    await waitFor(() => {
      expect(screen.getByText('Total Spend')).toBeInTheDocument();
    });

    // Check cost display (1500 cents = €15.00)
    expect(screen.getByText('€15.00')).toBeInTheDocument();
  });

  it('calculates days remaining in billing cycle', async () => {
    mockApiResponses();

    renderBilling();

    await waitFor(() => {
      expect(screen.getByText('Days Remaining')).toBeInTheDocument();
    });

    // Should show some number of days remaining
    const daysElement = screen.getByText(/\d+/).closest('.text-2xl');
    expect(daysElement).toBeInTheDocument();
  });

  it('calculates efficiency ratio correctly', async () => {
    mockApiResponses('pro', {
      analysis_used: 1000,
      roast_used: 100 // 10% efficiency
    });

    renderBilling();

    await waitFor(() => {
      expect(screen.getByText('Efficiency')).toBeInTheDocument();
    });

    // Check efficiency calculation (100/1000 * 100 = 10%)
    expect(screen.getByText('10%')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderBilling();

    expect(screen.getByText('Loading your billing information...')).toBeInTheDocument();
  });

  it('uses fallback data when API calls fail', async () => {
    // Mock failed API calls
    mockFetch
      .mockRejectedValueOnce(new Error('API Error'))
      .mockRejectedValueOnce(new Error('API Error'))
      .mockRejectedValueOnce(new Error('API Error'));

    renderBilling();

    await waitFor(() => {
      expect(screen.getByText('Billing & Usage')).toBeInTheDocument();
    });

    // Should still render with mock data
    expect(screen.getByText('Monthly Usage')).toBeInTheDocument();
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
  });
});
