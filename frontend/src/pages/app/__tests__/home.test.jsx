/**
 * Tests for Home Page - Issue #1043
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from '../home';
import { getIntegrations } from '../../../api/integrations';

// Mock components
jest.mock('../../../components/app/home/usage-widgets', () => {
  return function UsageWidgets() {
    return <div data-testid="usage-widgets">Usage Widgets</div>;
  };
});

jest.mock('../../../components/app/home/connect-network-card', () => {
  return function ConnectNetworkCard({ accounts, onAccountConnected }) {
    return (
      <div data-testid="connect-network-card">
        Connect Network Card
        <button onClick={onAccountConnected}>Test Connect</button>
      </div>
    );
  };
});

jest.mock('../../../components/app/home/accounts-table', () => {
  return function AccountsTable() {
    return <div data-testid="accounts-table">Accounts Table</div>;
  };
});

// Mock API
jest.mock('../../../api/integrations', () => ({
  getIntegrations: jest.fn()
}));

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Home Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all components', async () => {
    getIntegrations.mockResolvedValue({ integrations: [] });

    renderWithRouter(<Home />);

    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByTestId('usage-widgets')).toBeInTheDocument();
    expect(screen.getByTestId('connect-network-card')).toBeInTheDocument();
    expect(screen.getByTestId('accounts-table')).toBeInTheDocument();
  });

  it('should fetch accounts on mount', async () => {
    const mockAccounts = [{ id: '1', platform: 'twitter', status: 'active' }];

    getIntegrations.mockResolvedValue({ integrations: mockAccounts });

    renderWithRouter(<Home />);

    await waitFor(() => {
      expect(getIntegrations).toHaveBeenCalled();
    });
  });

  it('should refresh accounts when connection callback is called', async () => {
    const mockAccounts = [{ id: '1', platform: 'twitter', status: 'active' }];
    getIntegrations.mockResolvedValue({ integrations: mockAccounts });

    renderWithRouter(<Home />);

    await waitFor(() => {
      expect(getIntegrations).toHaveBeenCalledTimes(1);
    });

    const connectButton = screen.getByText('Test Connect');
    connectButton.click();

    await waitFor(() => {
      expect(getIntegrations).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle API errors gracefully', async () => {
    getIntegrations.mockRejectedValue(new Error('API Error'));

    renderWithRouter(<Home />);

    await waitFor(() => {
      // Should still render components even if API fails
      expect(screen.getByTestId('usage-widgets')).toBeInTheDocument();
    });
  });

  it('should display page title and description', () => {
    getIntegrations.mockResolvedValue({ integrations: [] });

    renderWithRouter(<Home />);

    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText(/Gestiona tus cuentas/i)).toBeInTheDocument();
  });
});
