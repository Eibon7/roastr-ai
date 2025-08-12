/**
 * Backend Integration Tests - Authentication and Initial Loading
 * 
 * Tests the initial authentication flow and account loading from real backend
 * Run with: REACT_APP_ENABLE_MOCK_MODE=false npm run test:integration-backend
 */

import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AccountsPage from '../../../../frontend/src/pages/AccountsPage';
import socialAPI from '../../../../frontend/src/api/social';

// Test utilities for backend integration
import { 
  setupRealBackendTest, 
  teardownRealBackendTest,
  authenticateTestUser,
  loadFixtureIfNeeded 
} from '../utils/backendTestUtils';

describe('Backend Integration - Authentication and Loading', () => {
  let testContext;

  beforeAll(async () => {
    testContext = await setupRealBackendTest();
  });

  afterAll(async () => {
    await teardownRealBackendTest(testContext);
  });

  beforeEach(async () => {
    // Authenticate test user before each test
    await authenticateTestUser(testContext);
  });

  describe('Initial Authentication Flow', () => {
    it('should authenticate user and load accounts from backend', async () => {
      const accountsData = await loadFixtureIfNeeded('accounts.json', () => 
        socialAPI.getAccounts()
      );

      expect(accountsData).toHaveProperty('success', true);
      expect(accountsData.data).toHaveProperty('accounts');
      expect(Array.isArray(accountsData.data.accounts)).toBe(true);
    });

    it('should handle empty accounts response gracefully', async () => {
      // Test with user that has no connected accounts
      const emptyResponse = {
        success: true,
        data: {
          accounts: [],
          networks: { connected: {}, available: ['twitter', 'instagram'] }
        }
      };

      render(
        <BrowserRouter>
          <AccountsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/conectar otra cuenta/i)).toBeInTheDocument();
        expect(screen.getByText(/no tienes cuentas conectadas/i)).toBeInTheDocument();
      });
    });

    it('should load and display multiple accounts per network correctly', async () => {
      const accountsData = await loadFixtureIfNeeded('accounts.json', () => 
        socialAPI.getAccounts()
      );

      render(
        <BrowserRouter>
          <AccountsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Should show multiple Twitter accounts
        const twitterAccounts = accountsData.data.accounts.filter(acc => acc.network === 'twitter');
        twitterAccounts.forEach(account => {
          expect(screen.getByText(account.handle)).toBeInTheDocument();
          expect(screen.getByText(account.monthlyRoasts.toLocaleString())).toBeInTheDocument();
        });

        // Should show Instagram account
        const igAccount = accountsData.data.accounts.find(acc => acc.network === 'instagram');
        if (igAccount) {
          expect(screen.getByText(igAccount.handle)).toBeInTheDocument();
        }
      });
    });

    it('should display correct statistics aggregation', async () => {
      const accountsData = await loadFixtureIfNeeded('accounts.json', () => 
        socialAPI.getAccounts()
      );

      render(
        <BrowserRouter>
          <AccountsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const totalAccounts = accountsData.data.accounts.length;
        const activeAccounts = accountsData.data.accounts.filter(acc => acc.status === 'active').length;
        const totalRoasts = accountsData.data.accounts.reduce((sum, acc) => sum + acc.monthlyRoasts, 0);

        expect(screen.getByText(totalAccounts.toString())).toBeInTheDocument();
        expect(screen.getByText(activeAccounts.toString())).toBeInTheDocument();
        expect(screen.getByText(totalRoasts.toLocaleString())).toBeInTheDocument();
      });
    });

    it('should show available networks for connection', async () => {
      const accountsData = await loadFixtureIfNeeded('accounts.json', () => 
        socialAPI.getAccounts()
      );

      render(
        <BrowserRouter>
          <AccountsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Check that unconnected networks show as available
        const availableNetworks = accountsData.data.networks.available || [];
        
        availableNetworks.forEach(network => {
          // Should show network icon and connection count (0)
          expect(screen.getByTestId(`network-${network}`)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Network Connection Counts', () => {
    it('should display correct connection counts per network', async () => {
      const accountsData = await loadFixtureIfNeeded('accounts.json', () => 
        socialAPI.getAccounts()
      );

      render(
        <BrowserRouter>
          <AccountsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const connectedCounts = accountsData.data.networks.connected;
        
        Object.entries(connectedCounts).forEach(([network, count]) => {
          if (count > 0) {
            expect(screen.getByTestId(`network-${network}-count`))
              .toHaveTextContent(count.toString());
          }
        });
      });
    });

    it('should handle backend errors gracefully', async () => {
      // Simulate backend error by using invalid auth
      localStorage.removeItem('auth_token');

      render(
        <BrowserRouter>
          <AccountsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/error al cargar cuentas/i)).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('Real API Response Validation', () => {
    it('should receive responses matching expected schema', async () => {
      const response = await socialAPI.getAccounts();

      // Validate response structure
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(response.data).toHaveProperty('accounts');
      expect(response.data).toHaveProperty('networks');
      
      // Validate each account has required fields
      response.data.accounts.forEach(account => {
        expect(account).toHaveProperty('id');
        expect(account).toHaveProperty('network');
        expect(account).toHaveProperty('handle');
        expect(account).toHaveProperty('status');
        expect(account).toHaveProperty('monthlyRoasts');
        expect(account).toHaveProperty('settings');
        
        // Validate settings structure
        expect(account.settings).toHaveProperty('autoApprove');
        expect(account.settings).toHaveProperty('shieldEnabled');
        expect(account.settings).toHaveProperty('shieldLevel');
        expect(account.settings).toHaveProperty('defaultTone');
      });
    });

    it('should handle pagination correctly', async () => {
      const response = await socialAPI.getAccounts({ limit: 2 });

      expect(response.data).toHaveProperty('pagination');
      expect(response.data.pagination).toHaveProperty('total');
      expect(response.data.pagination).toHaveProperty('hasMore');
      
      if (response.data.pagination.hasMore) {
        expect(response.data.pagination).toHaveProperty('nextCursor');
      }
    });
  });
});