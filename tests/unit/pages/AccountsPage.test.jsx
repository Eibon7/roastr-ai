/**
 * AccountsPage Component - Unit Tests
 * 
 * Tests for multi-tenant social accounts management with RLS
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AccountsPage from '../../../frontend/src/pages/AccountsPage';
import { useSocialAccounts } from '../../../frontend/src/hooks/useSocialAccounts';

// Mock the hook
jest.mock('../../../frontend/src/hooks/useSocialAccounts');

// Mock child components
jest.mock('../../../frontend/src/components/AccountCard', () => {
  return function AccountCard({ account, onClick }) {
    return (
      <div data-testid={`account-card-${account.id}`} onClick={onClick}>
        {account.platform} - {account.username}
      </div>
    );
  };
});

jest.mock('../../../frontend/src/components/AccountModal', () => {
  return function AccountModal({ account, onClose }) {
    return (
      <div data-testid="account-modal">
        Modal for {account.username}
        <button onClick={onClose}>Close</button>
      </div>
    );
  };
});

jest.mock('../../../frontend/src/components/NetworkConnectModal', () => {
  return function NetworkConnectModal({ isOpen, networkName, onClose, onConnect }) {
    if (!isOpen) return null;
    return (
      <div data-testid="network-modal">
        Connect to {networkName}
        <button onClick={() => onConnect('twitter')}>Connect</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    );
  };
});

const mockAccounts = [
  {
    id: 'acc1',
    platform: 'twitter',
    username: '@testuser',
    status: 'active'
  },
  {
    id: 'acc2',
    platform: 'instagram',
    username: '@testinsta',
    status: 'active'
  }
];

const mockAvailableNetworks = [
  { network: 'twitter', name: 'Twitter', canConnect: true, totalConnections: 1, maxConnections: 2 },
  { network: 'facebook', name: 'Facebook', canConnect: false, totalConnections: 2, maxConnections: 2 }
];

const defaultHookReturn = {
  accounts: mockAccounts,
  availableNetworks: mockAvailableNetworks,
  userData: { plan: 'pro' },
  getAccountById: jest.fn((id) => mockAccounts.find(acc => acc.id === id)),
  roastsByAccount: jest.fn(() => []),
  interceptedByAccount: jest.fn(() => []),
  getConnectionLimits: jest.fn(() => ({ 
    maxConnections: 2, 
    maxConnectionsPerPlatform: 2,
    planTier: 'pro'
  })),
  totalAccounts: 2,
  activeAccounts: 2,
  totalMonthlyRoasts: 150,
  onApproveRoast: jest.fn(),
  onRejectRoast: jest.fn(),
  onToggleAutoApprove: jest.fn(),
  onToggleAccount: jest.fn(),
  onChangeShieldLevel: jest.fn(),
  onToggleShield: jest.fn(),
  onChangeTone: jest.fn(),
  onConnectNetwork: jest.fn(),
  onDisconnectAccount: jest.fn()
};

const renderComponent = (hookOverrides = {}) => {
  useSocialAccounts.mockReturnValue({
    ...defaultHookReturn,
    ...hookOverrides
  });

  return render(
    <BrowserRouter>
      <AccountsPage />
    </BrowserRouter>
  );
};

describe('AccountsPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render page header', () => {
      renderComponent();
      
      expect(screen.getByText(/Cuentas conectadas/i)).toBeInTheDocument();
      expect(screen.getByText(/Gestiona tus cuentas conectadas/i)).toBeInTheDocument();
    });

    it('should render stats cards', () => {
      renderComponent();
      
      expect(screen.getByText(/2/)).toBeInTheDocument(); // Total accounts
      expect(screen.getByText(/150/)).toBeInTheDocument(); // Monthly roasts
    });

    it('should render connected accounts', () => {
      renderComponent();
      
      expect(screen.getByTestId('account-card-acc1')).toBeInTheDocument();
      expect(screen.getByTestId('account-card-acc2')).toBeInTheDocument();
    });

    it('should show empty state when no accounts', () => {
      renderComponent({ accounts: [] });
      
      expect(screen.getByText(/No tienes cuentas conectadas/i)).toBeInTheDocument();
    });
  });

  describe('Connection Limits Alert', () => {
    it('should display connection limits for current plan', () => {
      renderComponent();
      
      expect(screen.getByText(/Límites de conexión por plan/i)).toBeInTheDocument();
      expect(screen.getByText(/Tu plan actual \(pro\)/i)).toBeInTheDocument();
    });

    it('should show upgrade message for starter plan', () => {
      renderComponent({
        userData: { plan: 'starter' },
        getConnectionLimits: jest.fn(() => ({ 
          maxConnections: 1,
          maxConnectionsPerPlatform: 1, 
          planTier: 'starter' 
        }))
      });
      
      expect(screen.getByText(/Actualiza a Pro para conectar hasta 2 cuentas/i)).toBeInTheDocument();
    });
  });

  describe('Network Connection', () => {
    it('should render available networks', () => {
      renderComponent();
      
      expect(screen.getByText(/Twitter/i)).toBeInTheDocument();
      expect(screen.getByText(/Facebook/i)).toBeInTheDocument();
    });

    it('should open connect modal when clicking available network', () => {
      renderComponent();
      
      const twitterButton = screen.getByText(/Twitter/i);
      fireEvent.click(twitterButton);
      
      expect(screen.getByTestId('network-modal')).toBeInTheDocument();
    });

    it('should disable connection for networks at limit', () => {
      renderComponent();
      
      const facebookSection = screen.getByText(/Facebook/i).closest('div');
      expect(facebookSection).toHaveTextContent(/Límite alcanzado/i);
    });

    it('should call onConnectNetwork when connecting', async () => {
      const onConnectNetwork = jest.fn();
      renderComponent({ onConnectNetwork });
      
      const twitterButton = screen.getByText(/Twitter/i);
      fireEvent.click(twitterButton);
      
      const connectButton = screen.getByRole('button', { name: /Connect/i });
      fireEvent.click(connectButton);
      
      await waitFor(() => {
        expect(onConnectNetwork).toHaveBeenCalledWith('twitter');
      });
    });
  });

  describe('Account Modal', () => {
    it('should open account modal when clicking account card', () => {
      renderComponent();
      
      const accountCard = screen.getByTestId('account-card-acc1');
      fireEvent.click(accountCard);
      
      expect(screen.getByTestId('account-modal')).toBeInTheDocument();
    });

    it('should close account modal', () => {
      renderComponent();
      
      const accountCard = screen.getByTestId('account-card-acc1');
      fireEvent.click(accountCard);
      
      const closeButton = screen.getByRole('button', { name: /Close/i });
      fireEvent.click(closeButton);
      
      expect(screen.queryByTestId('account-modal')).not.toBeInTheDocument();
    });
  });

  describe('Multi-tenant RLS', () => {
    it('should format roast count correctly for large numbers', () => {
      renderComponent({ totalMonthlyRoasts: 1500 });
      
      expect(screen.getByText(/1.5k/i)).toBeInTheDocument();
    });

    it('should display correct stats per organization', () => {
      renderComponent({
        totalAccounts: 5,
        activeAccounts: 3,
        totalMonthlyRoasts: 420
      });
      
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('420')).toBeInTheDocument();
    });
  });
});

