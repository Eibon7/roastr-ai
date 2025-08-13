/**
 * Backend Integration Tests - Roasts Management
 * 
 * Tests roasts fetching, approval, and rejection against real backend
 * Run with: REACT_APP_ENABLE_MOCK_MODE=false npm run test:integration-backend
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AccountModal from '../../../../frontend/src/components/AccountModal';
import { useSocialAccounts } from '../../../../frontend/src/hooks/useSocialAccounts';
import socialAPI from '../../../../frontend/src/api/social';

// Test utilities
import { 
  setupRealBackendTest, 
  teardownRealBackendTest,
  authenticateTestUser,
  loadFixtureIfNeeded,
  createTestAccount 
} from '../utils/backendTestUtils';

// Mock the hook to control test data
jest.mock('../../../../frontend/src/hooks/useSocialAccounts');
const mockUseSocialAccounts = useSocialAccounts;

describe('Backend Integration - Roasts Management', () => {
  let testContext;
  let testAccount;

  beforeAll(async () => {
    testContext = await setupRealBackendTest();
    testAccount = await createTestAccount(testContext, 'twitter');
  });

  afterAll(async () => {
    await teardownRealBackendTest(testContext);
  });

  beforeEach(async () => {
    await authenticateTestUser(testContext);
  });

  describe('Roasts Fetching (GET)', () => {
    it('should fetch roasts from backend and display in modal', async () => {
      const roastsData = await loadFixtureIfNeeded('roasts.json', () => 
        socialAPI.getRoasts(testAccount.id, { limit: 10 })
      );

      // Mock the hook to return our test data
      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        roastsByAccount: jest.fn(() => roastsData.data.roasts),
        onApproveRoast: jest.fn(),
        onRejectRoast: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={testAccount}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      await waitFor(() => {
        roastsData.data.roasts.forEach(roast => {
          expect(screen.getByText(roast.original)).toBeInTheDocument();
          expect(screen.getByText(roast.roast)).toBeInTheDocument();
        });
      });
    });

    it('should display roast status correctly', async () => {
      const roastsData = await loadFixtureIfNeeded('roasts.json', () => 
        socialAPI.getRoasts(testAccount.id)
      );

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        roastsByAccount: jest.fn(() => roastsData.data.roasts),
        onApproveRoast: jest.fn(),
        onRejectRoast: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={testAccount}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Check different status displays
        const approvedRoast = roastsData.data.roasts.find(r => r.status === 'approved');
        const pendingRoast = roastsData.data.roasts.find(r => r.status === 'pending');
        const rejectedRoast = roastsData.data.roasts.find(r => r.status === 'rejected');

        if (approvedRoast) {
          expect(screen.getByTestId(`roast-status-${approvedRoast.id}`))
            .toHaveTextContent('Aprobado');
        }

        if (pendingRoast) {
          expect(screen.getByTestId(`roast-status-${pendingRoast.id}`))
            .toHaveTextContent('Pendiente');
        }

        if (rejectedRoast) {
          expect(screen.getByTestId(`roast-status-${rejectedRoast.id}`))
            .toHaveTextContent('Rechazado');
        }
      });
    });

    it('should conditionally show approve/reject buttons based on autoApprove setting', async () => {
      const roastsData = await loadFixtureIfNeeded('roasts.json', () => 
        socialAPI.getRoasts(testAccount.id)
      );

      // Test with autoApprove = false
      const accountWithManualApproval = { 
        ...testAccount, 
        settings: { ...testAccount.settings, autoApprove: false } 
      };

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => accountWithManualApproval),
        roastsByAccount: jest.fn(() => roastsData.data.roasts),
        onApproveRoast: jest.fn(),
        onRejectRoast: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={accountWithManualApproval}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      await waitFor(() => {
        const pendingRoasts = roastsData.data.roasts.filter(r => r.status === 'pending');
        
        pendingRoasts.forEach(roast => {
          expect(screen.getByTestId(`approve-button-${roast.id}`)).toBeInTheDocument();
          expect(screen.getByTestId(`reject-button-${roast.id}`)).toBeInTheDocument();
        });
      });
    });

    it('should hide approve/reject buttons when autoApprove is true', async () => {
      const roastsData = await loadFixtureIfNeeded('roasts.json', () => 
        socialAPI.getRoasts(testAccount.id)
      );

      // Test with autoApprove = true
      const accountWithAutoApproval = { 
        ...testAccount, 
        settings: { ...testAccount.settings, autoApprove: true } 
      };

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => accountWithAutoApproval),
        roastsByAccount: jest.fn(() => roastsData.data.roasts),
        onApproveRoast: jest.fn(),
        onRejectRoast: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={accountWithAutoApproval}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Buttons should not exist for any roasts when autoApprove is true
        expect(screen.queryByText('Aprobar')).not.toBeInTheDocument();
        expect(screen.queryByText('Rechazar')).not.toBeInTheDocument();
      });
    });
  });

  describe('Roasts Approval (POST)', () => {
    it('should approve roast and update UI immediately', async () => {
      const user = userEvent.setup();
      const roastsData = await loadFixtureIfNeeded('roasts.json', () => 
        socialAPI.getRoasts(testAccount.id)
      );

      const pendingRoast = roastsData.data.roasts.find(r => r.status === 'pending');
      if (!pendingRoast) {
        throw new Error('No pending roast found in fixtures for testing');
      }

      const mockOnApprove = jest.fn(async () => {
        // Simulate real API call
        return await socialAPI.approveRoast(testAccount.id, pendingRoast.id);
      });

      const accountWithManualApproval = { 
        ...testAccount, 
        settings: { ...testAccount.settings, autoApprove: false } 
      };

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => accountWithManualApproval),
        roastsByAccount: jest.fn(() => roastsData.data.roasts),
        onApproveRoast: mockOnApprove,
        onRejectRoast: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={accountWithManualApproval}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      // Click approve button
      const approveButton = await screen.findByTestId(`approve-button-${pendingRoast.id}`);
      await user.click(approveButton);

      // Should show loading state briefly
      expect(screen.getByTestId(`approve-button-${pendingRoast.id}`))
        .toHaveAttribute('disabled');

      // Verify the API was called
      await waitFor(() => {
        expect(mockOnApprove).toHaveBeenCalledWith(testAccount.id, pendingRoast.id);
      });
    });

    it('should handle approval errors gracefully', async () => {
      const user = userEvent.setup();
      const roastsData = await loadFixtureIfNeeded('roasts.json', () => 
        socialAPI.getRoasts(testAccount.id)
      );

      const pendingRoast = roastsData.data.roasts.find(r => r.status === 'pending');

      const mockOnApprove = jest.fn(async () => {
        throw new Error('Backend approval failed');
      });

      const accountWithManualApproval = { 
        ...testAccount, 
        settings: { ...testAccount.settings, autoApprove: false } 
      };

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => accountWithManualApproval),
        roastsByAccount: jest.fn(() => roastsData.data.roasts),
        onApproveRoast: mockOnApprove,
        onRejectRoast: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={accountWithManualApproval}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      const approveButton = await screen.findByTestId(`approve-button-${pendingRoast.id}`);
      await user.click(approveButton);

      // Should show error state or toast notification
      await waitFor(() => {
        expect(screen.getByText(/error al aprobar/i)).toBeInTheDocument();
      });
    });
  });

  describe('Roasts Rejection (POST)', () => {
    it('should reject roast and update backend', async () => {
      const user = userEvent.setup();
      const roastsData = await loadFixtureIfNeeded('roasts.json', () => 
        socialAPI.getRoasts(testAccount.id)
      );

      const pendingRoast = roastsData.data.roasts.find(r => r.status === 'pending');
      if (!pendingRoast) {
        throw new Error('No pending roast found in fixtures for testing');
      }

      const mockOnReject = jest.fn(async () => {
        return await socialAPI.rejectRoast(testAccount.id, pendingRoast.id);
      });

      const accountWithManualApproval = { 
        ...testAccount, 
        settings: { ...testAccount.settings, autoApprove: false } 
      };

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => accountWithManualApproval),
        roastsByAccount: jest.fn(() => roastsData.data.roasts),
        onApproveRoast: jest.fn(),
        onRejectRoast: mockOnReject,
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={accountWithManualApproval}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      const rejectButton = await screen.findByTestId(`reject-button-${pendingRoast.id}`);
      await user.click(rejectButton);

      await waitFor(() => {
        expect(mockOnReject).toHaveBeenCalledWith(testAccount.id, pendingRoast.id);
      });
    });

    it('should handle concurrent approve/reject operations', async () => {
      const user = userEvent.setup();
      const roastsData = await loadFixtureIfNeeded('roasts.json', () => 
        socialAPI.getRoasts(testAccount.id)
      );

      const pendingRoasts = roastsData.data.roasts.filter(r => r.status === 'pending').slice(0, 2);
      
      if (pendingRoasts.length < 2) {
        throw new Error('Need at least 2 pending roasts for concurrent operations test');
      }

      const mockOnApprove = jest.fn(async (accountId, roastId) => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100));
        return await socialAPI.approveRoast(accountId, roastId);
      });

      const mockOnReject = jest.fn(async (accountId, roastId) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return await socialAPI.rejectRoast(accountId, roastId);
      });

      const accountWithManualApproval = { 
        ...testAccount, 
        settings: { ...testAccount.settings, autoApprove: false } 
      };

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => accountWithManualApproval),
        roastsByAccount: jest.fn(() => roastsData.data.roasts),
        onApproveRoast: mockOnApprove,
        onRejectRoast: mockOnReject,
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={accountWithManualApproval}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      // Click both buttons rapidly
      const approveButton = await screen.findByTestId(`approve-button-${pendingRoasts[0].id}`);
      const rejectButton = await screen.findByTestId(`reject-button-${pendingRoasts[1].id}`);

      await user.click(approveButton);
      await user.click(rejectButton);

      // Both operations should complete successfully
      await waitFor(() => {
        expect(mockOnApprove).toHaveBeenCalledWith(testAccount.id, pendingRoasts[0].id);
        expect(mockOnReject).toHaveBeenCalledWith(testAccount.id, pendingRoasts[1].id);
      });
    });
  });

  describe('Real API Response Validation', () => {
    it('should handle paginated roasts correctly', async () => {
      const firstPage = await socialAPI.getRoasts(testAccount.id, { limit: 2 });
      
      expect(firstPage).toHaveProperty('success', true);
      expect(firstPage.data).toHaveProperty('roasts');
      expect(firstPage.data).toHaveProperty('pagination');
      expect(Array.isArray(firstPage.data.roasts)).toBe(true);
      expect(firstPage.data.roasts.length).toBeLessThanOrEqual(2);

      if (firstPage.data.pagination.hasMore) {
        const secondPage = await socialAPI.getRoasts(testAccount.id, { 
          limit: 2,
          cursor: firstPage.data.pagination.nextCursor 
        });

        expect(secondPage.data.roasts.length).toBeGreaterThan(0);
        expect(secondPage.data.roasts[0].id).not.toBe(firstPage.data.roasts[0].id);
      }
    });

    it('should validate roast object schema from backend', async () => {
      const response = await socialAPI.getRoasts(testAccount.id, { limit: 1 });
      
      if (response.data.roasts.length > 0) {
        const roast = response.data.roasts[0];
        
        // Validate required fields
        expect(roast).toHaveProperty('id');
        expect(roast).toHaveProperty('original');
        expect(roast).toHaveProperty('roast');
        expect(roast).toHaveProperty('status');
        expect(roast).toHaveProperty('createdAt');
        expect(roast).toHaveProperty('tone');
        
        // Validate field types
        expect(typeof roast.id).toBe('string');
        expect(typeof roast.original).toBe('string');
        expect(typeof roast.roast).toBe('string');
        expect(['pending', 'approved', 'rejected']).toContain(roast.status);
        expect(new Date(roast.createdAt)).toBeInstanceOf(Date);
      }
    });
  });
});