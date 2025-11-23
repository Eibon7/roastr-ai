/**
 * Pricing Component - Unit Tests
 *
 * Tests for public pricing page with plan features integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Pricing from '../../../frontend/src/pages/Pricing';
import { createMockFetch } from '../../../frontend/src/lib/mockMode';

jest.mock('../../../frontend/src/lib/mockMode');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

describe('Pricing Component', () => {
  let mockFetchApi;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFetchApi = jest.fn((url, options) => {
      if (url === '/api/user') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ plan: 'starter' })
        });
      }
      if (url === '/api/billing/create-checkout-session') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ url: 'https://checkout.stripe.com/test' })
        });
      }
      if (url === '/api/billing/start-trial') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    createMockFetch.mockReturnValue(mockFetchApi);

    // Mock window.location.href
    delete window.location;
    window.location = { href: jest.fn() };
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <Pricing />
      </BrowserRouter>
    );
  };

  describe('Rendering', () => {
    it('should render page header', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Choose Your Plan/i)).toBeInTheDocument();
      });
    });

    it('should display all plan tiers', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Starter Trial')).toBeInTheDocument();
        expect(screen.getByText('Starter')).toBeInTheDocument();
        expect(screen.getByText('Pro')).toBeInTheDocument();
        expect(screen.getByText('Plus')).toBeInTheDocument();
      });
    });

    it('should show plan prices', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Free')).toBeInTheDocument();
        expect(screen.getByText('€5')).toBeInTheDocument();
        expect(screen.getByText('€15')).toBeInTheDocument();
        expect(screen.getByText('€50')).toBeInTheDocument();
      });
    });

    it('should display feature comparison table', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Feature Comparison/i)).toBeInTheDocument();
        expect(screen.getByText(/Monthly Analyses/i)).toBeInTheDocument();
        expect(screen.getByText(/Monthly Roasts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Plan Features', () => {
    it('should show included features for each plan', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/GPT-4 model/i)).toBeInTheDocument();
        expect(screen.getByText(/Shield protection/i)).toBeInTheDocument();
        expect(screen.getByText(/RQC embedded mode/i)).toBeInTheDocument();
      });
    });

    it('should display limitations for lower tiers', async () => {
      renderComponent();

      await waitFor(() => {
        const limitations = screen.getAllByText(/No RQC embedded/i);
        expect(limitations.length).toBeGreaterThan(0);
      });
    });

    it('should highlight most popular plans', async () => {
      renderComponent();

      await waitFor(() => {
        const popularBadges = screen.getAllByText(/Most Popular/i);
        expect(popularBadges.length).toBeGreaterThan(0);
      });
    });

    it('should show enterprise badge for Plus plan', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Enterprise/i)).toBeInTheDocument();
      });
    });
  });

  describe('Plan Upgrade', () => {
    it('should handle upgrade to paid plan', async () => {
      renderComponent();

      await waitFor(() => {
        const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/i });
        fireEvent.click(upgradeButton);
      });

      await waitFor(() => {
        expect(mockFetchApi).toHaveBeenCalledWith(
          '/api/billing/create-checkout-session',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ plan: 'pro' })
          })
        );
      });
    });

    it('should redirect to checkout URL on successful upgrade', async () => {
      renderComponent();

      await waitFor(() => {
        const upgradeButton = screen.getByRole('button', { name: /Upgrade to Plus/i });
        fireEvent.click(upgradeButton);
      });

      await waitFor(() => {
        expect(window.location.href).toBe('https://checkout.stripe.com/test');
      });
    });

    it('should handle trial start', async () => {
      mockFetchApi.mockImplementation((url) => {
        if (url === '/api/user') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ plan: null })
          });
        }
        return mockFetchApi(url);
      });

      renderComponent();

      await waitFor(() => {
        const trialButton = screen.getByRole('button', { name: /Start Trial/i });
        fireEvent.click(trialButton);
      });

      await waitFor(() => {
        expect(mockFetchApi).toHaveBeenCalledWith(
          '/api/billing/start-trial',
          expect.objectContaining({
            method: 'POST'
          })
        );
      });
    });

    it('should show processing state during upgrade', async () => {
      mockFetchApi.mockImplementation((url) => {
        if (url === '/api/billing/create-checkout-session') {
          return new Promise(() => {}); // Never resolves
        }
        if (url === '/api/user') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ plan: 'starter' })
          });
        }
      });

      renderComponent();

      await waitFor(() => {
        const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/i });
        fireEvent.click(upgradeButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Processing.../i)).toBeInTheDocument();
      });
    });

    it('should disable current plan button', async () => {
      renderComponent();

      await waitFor(() => {
        const currentButton = screen.getByRole('button', { name: /Current Plan/i });
        expect(currentButton).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message on upgrade failure', async () => {
      mockFetchApi.mockImplementation((url, options) => {
        if (url === '/api/billing/create-checkout-session') {
          return Promise.reject(new Error('Network error'));
        }
        if (url === '/api/user') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ plan: 'starter' })
          });
        }
      });

      renderComponent();

      await waitFor(() => {
        const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/i });
        fireEvent.click(upgradeButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to process upgrade/i)).toBeInTheDocument();
      });
    });

    it('should handle timeout errors', async () => {
      mockFetchApi.mockImplementation((url, options) => {
        if (url === '/api/billing/create-checkout-session') {
          const error = new Error('Timeout');
          error.name = 'AbortError';
          return Promise.reject(error);
        }
        if (url === '/api/user') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ plan: 'starter' })
          });
        }
      });

      renderComponent();

      await waitFor(() => {
        const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/i });
        fireEvent.click(upgradeButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Request timed out/i)).toBeInTheDocument();
      });
    });

    it('should allow dismissing error message', async () => {
      mockFetchApi.mockImplementation((url, options) => {
        if (url === '/api/billing/create-checkout-session') {
          return Promise.reject(new Error('Network error'));
        }
        if (url === '/api/user') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ plan: 'starter' })
          });
        }
      });

      renderComponent();

      await waitFor(() => {
        const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/i });
        fireEvent.click(upgradeButton);
      });

      await waitFor(() => {
        const closeButton = screen.getByText('×');
        fireEvent.click(closeButton);
      });

      await waitFor(() => {
        expect(screen.queryByText(/Failed to process upgrade/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('FAQ Section', () => {
    it('should display FAQ questions', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Can I change plans anytime\?/i)).toBeInTheDocument();
        expect(screen.getByText(/What happens to unused credits\?/i)).toBeInTheDocument();
        expect(screen.getByText(/Is there a free trial\?/i)).toBeInTheDocument();
      });
    });

    it('should navigate to billing page', async () => {
      renderComponent();

      await waitFor(() => {
        const billingButton = screen.getByRole('button', { name: /View Current Usage & Billing/i });
        fireEvent.click(billingButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/billing');
    });
  });

  describe('RQC Embedded Highlight', () => {
    it('should show RQC embedded features', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/RQC Embedded Mode/i)).toBeInTheDocument();
        expect(screen.getByText(/Semantic context analysis/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      mockFetchApi.mockImplementation(() => new Promise(() => {}));

      renderComponent();

      expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
    });
  });
});
