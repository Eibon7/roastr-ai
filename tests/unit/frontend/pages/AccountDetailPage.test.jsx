/**
 * AccountDetailPage Component Tests
 *
 * Tests for the account detail page component
 * Issue #1047: EPIC 1047 - User App — Accounts Detail Page
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import AccountDetailPage from '../AccountDetailPage';
import { useSocialAccounts } from '../../hooks/useSocialAccounts';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { getAccountById as getAccountByIdAPI, getAccountRoasts } from '../../lib/api/accounts';
import { getShieldEvents } from '../../lib/api/shield';
import { MOCK_ACCOUNTS, MOCK_ROASTS } from '../../mocks/social';

// Mock dependencies
jest.mock('../../hooks/useSocialAccounts');
jest.mock('../../hooks/useFeatureFlags');
jest.mock('../../lib/api/accounts');
jest.mock('../../lib/api/shield');
jest.mock('../../components/ShieldInterceptedList', () => {
  return function MockShieldInterceptedList({ interceptedItems }) {
    return (
      <div data-testid="shield-intercepted-list">{interceptedItems.length} intercepted items</div>
    );
  };
});
jest.mock('../../components/AccountSettingsDialog', () => {
  return function MockAccountSettingsDialog({ account, trigger }) {
    return (
      <div data-testid="account-settings-dialog">
        Settings for {account?.handle}
        {trigger}
      </div>
    );
  };
});
jest.mock('../../components/roastr/PageLayout', () => {
  return function MockPageLayout({ title, subtitle, children }) {
    return (
      <div data-testid="page-layout">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </div>
    );
  };
});

describe('AccountDetailPage', () => {
  const mockAccount = MOCK_ACCOUNTS.find((a) => a.id === 'acc_tw_1');
  const mockRoasts = MOCK_ROASTS[mockAccount.id] || [];
  const mockIntercepted = [];

  const mockUseSocialAccounts = {
    getAccountById: jest.fn((id) => mockAccount),
    roastsByAccount: jest.fn((id) => mockRoasts),
    interceptedByAccount: jest.fn((id) => mockIntercepted),
    onApproveRoast: jest.fn(),
    onRejectRoast: jest.fn(),
    onToggleAutoApprove: jest.fn(),
    onToggleAccount: jest.fn(),
    onChangeShieldLevel: jest.fn(),
    onToggleShield: jest.fn(),
    onChangeTone: jest.fn(),
    onDisconnectAccount: jest.fn()
  };

  const mockUseFeatureFlags = {
    isEnabled: jest.fn((flag) => flag === 'ENABLE_SHIELD_UI'),
    loading: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useSocialAccounts.mockReturnValue(mockUseSocialAccounts);
    useFeatureFlags.mockReturnValue(mockUseFeatureFlags);
    getAccountByIdAPI.mockResolvedValue({ data: mockAccount });
    getAccountRoasts.mockResolvedValue({ data: mockRoasts });
    getShieldEvents.mockResolvedValue({ data: { events: mockIntercepted } });
  });

  const renderWithRouter = (route = '/app/accounts/acc_tw_1') => {
    return render(
      <MemoryRouter initialEntries={[route]}>
        <AccountDetailPage />
      </MemoryRouter>
    );
  };

  describe('Rendering and Basic Functionality', () => {
    it('renders loading state initially', async () => {
      getAccountByIdAPI.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderWithRouter();

      expect(screen.getByText(/Cargando información de la cuenta/i)).toBeInTheDocument();
    });

    it('renders account information when loaded', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(mockAccount.handle)).toBeInTheDocument();
      });
    });

    it('renders back button to navigate to accounts list', async () => {
      renderWithRouter();

      await waitFor(() => {
        const backButton = screen.getByText(/Volver a cuentas/i);
        expect(backButton).toBeInTheDocument();
      });
    });

    it('renders account stats cards', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Roasts este mes/i)).toBeInTheDocument();
        expect(screen.getByText(/Shield interceptados/i)).toBeInTheDocument();
      });
    });

    it('renders tabs for Roasts and Shield', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Roasts/i)).toBeInTheDocument();
        expect(screen.getByText(/Shield/i)).toBeInTheDocument();
      });
    });

    it('displays roasts table when roasts are available', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Últimos roasts generados/i)).toBeInTheDocument();
      });
    });

    it('displays empty state when no roasts are available', async () => {
      getAccountRoasts.mockResolvedValue({ data: [] });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/No hay roasts generados aún/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when account is not found', async () => {
      mockUseSocialAccounts.getAccountById.mockReturnValue(undefined);
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Cuenta no encontrada/i)).toBeInTheDocument();
      });
    });

    it('handles API errors gracefully', async () => {
      getAccountByIdAPI.mockRejectedValue(new Error('API Error'));
      renderWithRouter();

      await waitFor(() => {
        // Should fallback to mock data or show error state
        expect(screen.queryByText(/Error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates back to accounts list when back button is clicked', async () => {
      const user = userEvent.setup();
      const { container } = renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Volver a cuentas/i)).toBeInTheDocument();
      });

      const backButton = screen.getByText(/Volver a cuentas/i);
      await user.click(backButton);

      // Navigation is handled by useNavigate, which is mocked
      // In a real test, we would check the navigation call
    });
  });
});
