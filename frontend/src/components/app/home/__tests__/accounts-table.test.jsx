/**
 * Tests for AccountsTable Component - Issue #1046
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AccountsTable from '../accounts-table';
import { apiClient } from '../../../../lib/api';

// Mock useNavigate before importing component
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Mock apiClient
jest.mock('../../../../lib/api', () => ({
  apiClient: {
    get: jest.fn()
  }
}));

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('AccountsTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('should render loading state initially', () => {
    apiClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithRouter(<AccountsTable />);

    // Skeleton doesn't have testid, check by class or role
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render accounts table with data', async () => {
    const mockAccounts = [
      {
        id: 'acc_1',
        platform: 'twitter',
        handle: '@user1',
        status: 'active',
        roasts_count: 45,
        shield_interceptions: 12
      },
      {
        id: 'acc_2',
        platform: 'instagram',
        handle: '@user2',
        status: 'connected',
        roasts_count: 30,
        shield_interceptions: 5
      }
    ];

    apiClient.get.mockResolvedValue({ data: mockAccounts });

    renderWithRouter(<AccountsTable />);

    await waitFor(() => {
      expect(screen.getByText('Cuentas Conectadas')).toBeInTheDocument();
    });

    expect(screen.getByText('@user1')).toBeInTheDocument();
    expect(screen.getByText('@user2')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('should navigate to account detail on row click', async () => {
    const mockAccounts = [
      {
        id: 'acc_1',
        platform: 'twitter',
        handle: '@user1',
        status: 'active',
        roasts_count: 45,
        shield_interceptions: 12
      }
    ];

    apiClient.get.mockResolvedValue({ data: mockAccounts });

    renderWithRouter(<AccountsTable />);

    await waitFor(() => {
      expect(screen.getByText('@user1')).toBeInTheDocument();
    });

    const row = screen.getByText('@user1').closest('tr');
    fireEvent.click(row);

    expect(mockNavigate).toHaveBeenCalledWith('/app/accounts/acc_1');
  });

  it('should display correct status badges', async () => {
    const mockAccounts = [
      { id: 'acc_1', platform: 'twitter', handle: '@user1', status: 'active' },
      { id: 'acc_2', platform: 'instagram', handle: '@user2', status: 'disconnected' }
    ];

    apiClient.get.mockResolvedValue({ data: mockAccounts });

    renderWithRouter(<AccountsTable />);

    await waitFor(() => {
      expect(screen.getByText('Activa')).toBeInTheDocument();
      expect(screen.getByText('Desconectada')).toBeInTheDocument();
    });
  });

  it('should show empty state when no accounts', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: []
      }
    });

    renderWithRouter(<AccountsTable />);

    await waitFor(() => {
      expect(screen.getByText(/No tienes cuentas conectadas/i)).toBeInTheDocument();
    });
  });

  it('should handle error state', async () => {
    apiClient.get.mockRejectedValue(new Error('API Error'));

    renderWithRouter(<AccountsTable />);

    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
    });
  });

  it('should format numbers correctly', async () => {
    const mockAccounts = [
      {
        id: 'acc_1',
        platform: 'twitter',
        handle: '@user1',
        status: 'active',
        roasts_count: 1234,
        shield_interceptions: 567
      }
    ];

    apiClient.get.mockResolvedValue({ data: mockAccounts });

    renderWithRouter(<AccountsTable />);

    await waitFor(() => {
      expect(screen.getByText('1,234')).toBeInTheDocument();
      expect(screen.getByText('567')).toBeInTheDocument();
    });
  });

  it('should call correct API endpoint', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: []
      }
    });

    renderWithRouter(<AccountsTable />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/accounts');
    });
  });

  it('should handle different response formats', async () => {
    // Test with standardized response format
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: [{ id: 'acc_1', platform: 'twitter', handle: '@user1', status: 'active' }]
      }
    });

    renderWithRouter(<AccountsTable />);

    await waitFor(() => {
      expect(screen.getByText('@user1')).toBeInTheDocument();
    });
  });
});
