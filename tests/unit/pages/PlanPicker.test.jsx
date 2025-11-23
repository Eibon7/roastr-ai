/**
 * PlanPicker Component - Unit Tests
 *
 * Tests for plan selection with plan-features integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PlanPicker from '../../../frontend/src/pages/PlanPicker';
import { createMockFetch } from '../../../frontend/src/lib/mockMode';

jest.mock('../../../frontend/src/lib/mockMode');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

const mockPlans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 5,
    features: {
      roastsPerMonth: 10,
      platformConnections: 2,
      styleProfile: false,
      customPrompts: false,
      prioritySupport: false,
      advancedAnalytics: false
    }
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 15,
    features: {
      roastsPerMonth: 1000,
      platformConnections: 5,
      styleProfile: false,
      customPrompts: true,
      prioritySupport: true,
      advancedAnalytics: true
    }
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 50,
    features: {
      roastsPerMonth: 5000,
      platformConnections: 10,
      styleProfile: true,
      customPrompts: true,
      prioritySupport: true,
      advancedAnalytics: true
    }
  }
];

describe('PlanPicker Component', () => {
  let mockFetchApi;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFetchApi = jest.fn((url, options) => {
      if (url === '/api/plan/available') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { plans: mockPlans } })
        });
      }
      if (url === '/api/plan/current') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { plan: 'starter' } })
        });
      }
      if (url === '/api/plan/select') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { message: 'Plan selected' } })
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    createMockFetch.mockReturnValue(mockFetchApi);
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <PlanPicker />
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

    it('should fetch and display available plans', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
        expect(screen.getByText('Pro')).toBeInTheDocument();
        expect(screen.getByText('Plus')).toBeInTheDocument();
      });
    });

    it('should display plan features', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/10 roasts\/month/i)).toBeInTheDocument();
        expect(screen.getByText(/1,000 roasts\/month/i)).toBeInTheDocument();
        expect(screen.getByText(/5,000 roasts\/month/i)).toBeInTheDocument();
      });
    });

    it('should highlight current plan', async () => {
      renderComponent();

      await waitFor(() => {
        const currentPlanBadges = screen.getAllByText(/Current Plan/i);
        expect(currentPlanBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Plan Selection', () => {
    it('should allow selecting a different plan', async () => {
      renderComponent();

      await waitFor(() => {
        const proButton = screen.getByRole('button', { name: /Select Pro/i });
        fireEvent.click(proButton);
      });

      await waitFor(() => {
        expect(mockFetchApi).toHaveBeenCalledWith(
          '/api/plan/select',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ plan: 'pro' })
          })
        );
      });
    });

    it('should navigate after successful selection', async () => {
      renderComponent();

      await waitFor(() => {
        const proButton = screen.getByRole('button', { name: /Select Pro/i });
        fireEvent.click(proButton);
      });

      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith('/integrations/connect');
        },
        { timeout: 2000 }
      );
    });

    it('should disable current plan button', async () => {
      renderComponent();

      await waitFor(() => {
        const currentButton = screen.getByRole('button', { name: /Current Plan/i });
        expect(currentButton).toBeDisabled();
      });
    });

    it('should show selecting state', async () => {
      mockFetchApi.mockImplementation((url) => {
        if (url === '/api/plan/select') {
          return new Promise(() => {}); // Never resolves
        }
        return mockFetchApi(url);
      });

      renderComponent();

      await waitFor(() => {
        const proButton = screen.getByRole('button', { name: /Select Pro/i });
        fireEvent.click(proButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Selecting.../i)).toBeInTheDocument();
      });
    });
  });

  describe('Plan Features Display', () => {
    it('should show AI Style Profile for Plus plan', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/AI Style Profile Generation/i)).toBeInTheDocument();
      });
    });

    it('should display platform connections limit', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/2 platform connections/i)).toBeInTheDocument();
        expect(screen.getByText(/5 platform connections/i)).toBeInTheDocument();
        expect(screen.getByText(/10 platform connections/i)).toBeInTheDocument();
      });
    });

    it('should show premium features for higher tiers', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Custom roast prompts/i)).toBeInTheDocument();
        expect(screen.getByText(/Priority support/i)).toBeInTheDocument();
        expect(screen.getByText(/Advanced analytics/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle failed plan fetch', async () => {
      mockFetchApi.mockImplementation((url) => {
        if (url === '/api/plan/available') {
          return Promise.resolve({ ok: false });
        }
        return mockFetchApi(url);
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/No plans available/i)).toBeInTheDocument();
      });
    });

    it('should handle failed plan selection gracefully', async () => {
      mockFetchApi.mockImplementation((url, options) => {
        if (url === '/api/plan/select') {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: 'Payment required' })
          });
        }
        if (url === '/api/plan/available') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { plans: mockPlans } })
          });
        }
        if (url === '/api/plan/current') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { plan: 'starter' } })
          });
        }
      });

      renderComponent();

      await waitFor(() => {
        const proButton = screen.getByRole('button', { name: /Select Pro/i });
        fireEvent.click(proButton);
      });

      // Button should be enabled again after error
      await waitFor(() => {
        const proButton = screen.getByRole('button', { name: /Select Pro/i });
        expect(proButton).not.toBeDisabled();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      mockFetchApi.mockImplementation(() => new Promise(() => {}));

      renderComponent();

      expect(screen.getByText(/Loading plans.../i)).toBeInTheDocument();
    });
  });
});
