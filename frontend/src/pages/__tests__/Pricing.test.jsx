import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Pricing from '../Pricing';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
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

describe('Pricing Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderPricing = () => {
    return render(<Pricing />);
  };

  it('renders pricing page with all 4 plan tiers', async () => {
    // Mock successful user fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ plan: 'free' })
    });

    renderPricing();

    await waitFor(() => {
      expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    });

    // Check that all 4 plans are rendered
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Plus')).toBeInTheDocument();

    // Check pricing
    expect(screen.getByText('€5')).toBeInTheDocument();
    expect(screen.getByText('€15')).toBeInTheDocument();
    expect(screen.getByText('€50')).toBeInTheDocument();
  });

  it('shows current plan badge correctly', async () => {
    // Mock user with pro plan
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ plan: 'pro' })
    });

    renderPricing();

    await waitFor(() => {
      expect(screen.getByText('Current Plan')).toBeInTheDocument();
    });

    // Pro plan should show as current
    const proCard = screen.getByText('Pro').closest('.relative');
    expect(proCard).toHaveTextContent('Current Plan');
  });

  it('displays plan features correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ plan: 'free' })
    });

    renderPricing();

    await waitFor(() => {
      expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    });

    // Check key features
    expect(screen.getByText('Shield protection')).toBeInTheDocument();
    expect(screen.getByText('RQC embedded mode')).toBeInTheDocument();
    expect(screen.getByText('GPT-4 model')).toBeInTheDocument();
  });

  it('handles upgrade button clicks', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ plan: 'free' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: 'https://checkout.stripe.com/session_123' })
      });

    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true
    });

    renderPricing();

    await waitFor(() => {
      expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    });

    // Click upgrade to Starter
    const starterUpgradeBtn = screen.getByText('Upgrade to Starter');
    fireEvent.click(starterUpgradeBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'starter' })
      });
    });
  });

  it('shows loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderPricing();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays feature comparison table', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ plan: 'free' })
    });

    renderPricing();

    await waitFor(() => {
      expect(screen.getByText('Feature Comparison')).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getByText('Monthly Analyses')).toBeInTheDocument();
    expect(screen.getByText('Monthly Roasts')).toBeInTheDocument();
  });

  it('shows RQC Embedded highlight section', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ plan: 'free' })
    });

    renderPricing();

    await waitFor(() => {
      expect(screen.getByText('RQC Embedded Mode')).toBeInTheDocument();
    });

    expect(screen.getByText('Semantic context analysis')).toBeInTheDocument();
    expect(screen.getByText('Enhanced response quality')).toBeInTheDocument();
  });

  it('handles navigation to billing page', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ plan: 'free' })
    });

    renderPricing();

    await waitFor(() => {
      expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    });

    const billingButton = screen.getByText('View Current Usage & Billing');
    fireEvent.click(billingButton);

    expect(mockNavigate).toHaveBeenCalledWith('/billing');
  });

  it('handles downgrade for free plan', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ plan: 'pro' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: 'https://billing.stripe.com/portal_123' })
      });

    // Mock window.open
    window.open = jest.fn();

    renderPricing();

    await waitFor(() => {
      expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    });

    // Click downgrade to free
    const downgradeBtn = screen.getByText('Downgrade');
    fireEvent.click(downgradeBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/billing/portal', {
        method: 'POST'
      });
    });
  });
});