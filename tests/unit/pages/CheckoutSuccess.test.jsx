/**
 * CheckoutSuccess Component - Unit Tests
 *
 * Tests for post-checkout success page with shadcn/ui components
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CheckoutSuccess from '../../../frontend/src/pages/CheckoutSuccess';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('checkout_id=test_123')]
}));

// Mock fetch
global.fetch = jest.fn();

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <CheckoutSuccess />
    </BrowserRouter>
  );
};

describe('CheckoutSuccess Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        checkout: {
          status: 'completed',
          customer_email: 'test@example.com',
          amount: 500,
          currency: 'eur'
        }
      })
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render success message', async () => {
      renderComponent();

      expect(screen.getByText(/Payment Successful!/i)).toBeInTheDocument();
      expect(screen.getByText(/Thank you for your purchase/i)).toBeInTheDocument();
    });

    it('should display checkout ID from URL', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Checkout ID:/i)).toBeInTheDocument();
        expect(screen.getByText(/test_123/i)).toBeInTheDocument();
      });
    });

    it('should render action buttons', () => {
      renderComponent();

      expect(screen.getByRole('button', { name: /Go to Dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /View Billing/i })).toBeInTheDocument();
    });

    it('should render confirmation messages', () => {
      renderComponent();

      expect(screen.getByText(/confirmation email has been sent/i)).toBeInTheDocument();
      expect(screen.getByText(/premium features are now active/i)).toBeInTheDocument();
    });
  });

  describe('Checkout Details Fetching', () => {
    it('should fetch checkout details on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/checkout/test_123');
      });
    });

    it('should display checkout details when fetched successfully', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Order Details/i)).toBeInTheDocument();
        expect(screen.getByText(/completed/i)).toBeInTheDocument();
        expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
        expect(screen.getByText(/5.00 EUR/i)).toBeInTheDocument();
      });
    });

    it('should handle fetch error gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Could not load checkout details/i)).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching', () => {
      global.fetch.mockImplementation(() => new Promise(() => {}));

      renderComponent();

      expect(screen.getByText(/Loading checkout details/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to dashboard when button clicked', async () => {
      renderComponent();

      await waitFor(() => {
        const dashboardButton = screen.getByRole('button', { name: /Go to Dashboard/i });
        dashboardButton.click();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('should navigate to billing when button clicked', async () => {
      renderComponent();

      await waitFor(() => {
        const billingButton = screen.getByRole('button', { name: /View Billing/i });
        billingButton.click();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/billing');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing checkout_id in URL', () => {
      jest
        .spyOn(require('react-router-dom'), 'useSearchParams')
        .mockReturnValue([new URLSearchParams('')]);

      renderComponent();

      expect(screen.queryByText(/Checkout ID:/i)).not.toBeInTheDocument();
    });

    it('should handle API error response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Checkout not found' })
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Could not load checkout details/i)).toBeInTheDocument();
      });
    });
  });
});
