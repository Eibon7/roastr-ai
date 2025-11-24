/**
 * Unit tests for ShopSettings component
 * Issue #260: Settings → Shop functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShopSettings from '../../../frontend/src/components/ShopSettings';
import { apiClient } from '../../../frontend/src/lib/api';

// Mock API client
jest.mock('../../../frontend/src/lib/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn()
  }
}));

// Store original window.location
const originalLocation = window.location;

beforeAll(() => {
  delete window.location;
  window.location = { href: '' };
});

afterAll(() => {
  window.location = originalLocation;
});

describe('ShopSettings Component', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    plan: 'pro'
  };

  const mockOnNotification = jest.fn();

  const mockShopData = {
    addons: {
      roasts: [
        {
          id: 'addon-1',
          key: 'roasts_100',
          name: 'Roasts Pack 100',
          description: 'Pack de 100 roasts extra',
          price: {
            cents: 499,
            currency: 'USD',
            formatted: '$4.99'
          },
          type: 'credits',
          creditAmount: 100
        }
      ],
      features: [
        {
          id: 'addon-2',
          key: 'rqc_monthly',
          name: 'RQC (Roastr Quality Check)',
          description: 'Filtro de calidad automático',
          price: {
            cents: 1499,
            currency: 'USD',
            formatted: '$14.99'
          },
          type: 'feature',
          featureKey: 'rqc_enabled'
        }
      ]
    },
    categories: {
      roasts: 'Roasts Extra',
      features: 'Funcionalidades'
    }
  };

  const mockUserAddons = {
    credits: {
      roasts: 50,
      analysis: 1000
    },
    features: {
      rqc_enabled: true
    },
    recentPurchases: [
      {
        addon_key: 'roasts_100',
        amount_cents: 499,
        status: 'completed',
        completed_at: '2024-01-15T10:00:00Z'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.location.href = '';
  });

  it('should render loading state initially', () => {
    apiClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<ShopSettings user={mockUser} onNotification={mockOnNotification} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Cargando')).toBeInTheDocument();
  });

  it('should render shop data after loading', async () => {
    apiClient.get
      .mockResolvedValueOnce({ success: true, data: mockShopData })
      .mockResolvedValueOnce({ success: true, data: mockUserAddons });

    render(<ShopSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Shop')).toBeInTheDocument();
    });

    // Check intro text
    expect(screen.getByText(/Mejora tu experiencia en Roastr/)).toBeInTheDocument();

    // Check current credits display
    expect(screen.getByText('Tus Créditos Actuales')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument(); // roast credits
    expect(screen.getByText('1,000')).toBeInTheDocument(); // analysis credits

    // Check addon categories
    expect(screen.getByText('Roasts Extra')).toBeInTheDocument();
    expect(screen.getByText('Funcionalidades')).toBeInTheDocument();

    // Check addon cards
    expect(screen.getByText('Roasts Pack 100')).toBeInTheDocument();
    expect(screen.getByText('RQC (Roastr Quality Check)')).toBeInTheDocument();
    expect(screen.getByText('$4.99')).toBeInTheDocument();
    expect(screen.getByText('$14.99')).toBeInTheDocument();
  });

  it('should display current credits correctly', async () => {
    apiClient.get
      .mockResolvedValueOnce({ success: true, data: mockShopData })
      .mockResolvedValueOnce({ success: true, data: mockUserAddons });

    render(<ShopSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    // Check roast credits
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('Roasts Extra')).toBeInTheDocument();

    // Check analysis credits
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('Análisis Extra')).toBeInTheDocument();

    // Check RQC status (should show checkmark when enabled)
    const rqcSection = screen.getByText('RQC Activo').closest('div');
    expect(rqcSection).toBeInTheDocument();
  });

  it('should handle purchase button click', async () => {
    const mockCheckoutResponse = {
      success: true,
      data: {
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/pay/cs_test123'
      }
    };

    apiClient.get
      .mockResolvedValueOnce({ success: true, data: mockShopData })
      .mockResolvedValueOnce({ success: true, data: mockUserAddons });
    apiClient.post.mockResolvedValue(mockCheckoutResponse);

    render(<ShopSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Roasts Pack 100')).toBeInTheDocument();
    });

    // Find and click purchase button
    const purchaseButtons = screen.getAllByText('Comprar');
    fireEvent.click(purchaseButtons[0]);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/shop/checkout', {
        addonKey: 'roasts_100'
      });
    });

    // Should redirect to Stripe checkout
    expect(window.location.href).toBe('https://checkout.stripe.com/pay/cs_test123');
  });

  it('should show error message when purchase fails', async () => {
    apiClient.get
      .mockResolvedValueOnce({ success: true, data: mockShopData })
      .mockResolvedValueOnce({ success: true, data: mockUserAddons });
    apiClient.post.mockRejectedValue(new Error('Payment failed'));

    render(<ShopSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Roasts Pack 100')).toBeInTheDocument();
    });

    // Click purchase button
    const purchaseButtons = screen.getAllByText('Comprar');
    fireEvent.click(purchaseButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/No se pudo completar la compra/)).toBeInTheDocument();
    });

    expect(mockOnNotification).toHaveBeenCalledWith('Error en la compra', 'error');
  });

  it('should display recent purchases when available', async () => {
    apiClient.get
      .mockResolvedValueOnce({ success: true, data: mockShopData })
      .mockResolvedValueOnce({ success: true, data: mockUserAddons });

    render(<ShopSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Compras Recientes')).toBeInTheDocument();
    });

    expect(screen.getByText('Roasts Pack 100')).toBeInTheDocument();
    expect(screen.getByText('$4.99')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('should not display recent purchases section when no purchases exist', async () => {
    const userAddonsWithoutPurchases = {
      ...mockUserAddons,
      recentPurchases: []
    };

    apiClient.get
      .mockResolvedValueOnce({ success: true, data: mockShopData })
      .mockResolvedValueOnce({ success: true, data: userAddonsWithoutPurchases });

    render(<ShopSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Shop')).toBeInTheDocument();
    });

    expect(screen.queryByText('Compras Recientes')).not.toBeInTheDocument();
  });

  it('should show loading state on purchase button when processing', async () => {
    apiClient.get
      .mockResolvedValueOnce({ success: true, data: mockShopData })
      .mockResolvedValueOnce({ success: true, data: mockUserAddons });

    // Mock a slow API response
    apiClient.post.mockImplementation(() => new Promise(() => {}));

    render(<ShopSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Roasts Pack 100')).toBeInTheDocument();
    });

    // Click purchase button
    const purchaseButtons = screen.getAllByText('Comprar');
    fireEvent.click(purchaseButtons[0]);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Procesando...')).toBeInTheDocument();
    });

    // All purchase buttons should be disabled
    const allButtons = screen.getAllByRole('button');
    const purchaseButtonsAfterClick = allButtons.filter(
      (btn) => btn.textContent.includes('Comprar') || btn.textContent.includes('Procesando')
    );

    purchaseButtonsAfterClick.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('should handle API errors gracefully', async () => {
    apiClient.get
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ success: true, data: mockUserAddons });

    render(<ShopSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(mockOnNotification).toHaveBeenCalledWith('Error al cargar la tienda', 'error');
    });
  });
});
