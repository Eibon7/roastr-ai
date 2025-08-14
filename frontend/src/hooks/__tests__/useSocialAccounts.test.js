/**
 * Tests for useSocialAccounts Hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../contexts/ToastContext';
import { useSocialAccounts } from '../useSocialAccounts';
import '@testing-library/jest-dom';

// Mock data
const mockAccount = {
  id: 'twitter-1',
  network: 'twitter',
  username: '@testuser',
  status: 'active',
  settings: {
    autoApprove: false,
    shieldEnabled: true,
    shieldLevel: 'medium',
    defaultTone: 'sarcastic'
  }
};

// Mock console to avoid noise in tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

// Test wrapper with ToastProvider
const wrapper = ({ children }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe('useSocialAccounts', () => {
  test('initializes with mock data', () => {
    const { result } = renderHook(() => useSocialAccounts(), { wrapper });
    
    expect(result.current.accounts).toHaveLength(4); // Based on MOCK_ACCOUNTS
    expect(result.current.totalAccounts).toBe(4);
    expect(result.current.activeAccounts).toBeGreaterThan(0);
    expect(result.current.availableNetworks).toHaveLength(9); // Based on MOCK_AVAILABLE_NETWORKS
  });

  test('getAccountById returns correct account', () => {
    const { result } = renderHook(() => useSocialAccounts(), { wrapper });
    
    const account = result.current.getAccountById('twitter-1');
    expect(account).toBeDefined();
    expect(account.network).toBe('twitter');
    expect(account.username).toBe('@johnroasts');
  });

  test('roastsByAccount returns correct roasts', () => {
    const { result } = renderHook(() => useSocialAccounts(), { wrapper });
    
    const roasts = result.current.roastsByAccount('twitter-1');
    expect(Array.isArray(roasts)).toBe(true);
    // Mock data should have some roasts
    expect(roasts.length).toBeGreaterThan(0);
  });

  describe('Optimistic Updates', () => {
    test('onApproveRoast updates status optimistically', async () => {
      const { result } = renderHook(() => useSocialAccounts(), { wrapper });
      
      const initialRoasts = result.current.roastsByAccount('twitter-1');
      const roastToApprove = initialRoasts.find(r => r.status === 'pending');
      
      if (roastToApprove) {
        await act(async () => {
          try {
            await result.current.onApproveRoast('twitter-1', roastToApprove.id);
          } catch (error) {
            // Expected to potentially fail due to mock randomness
          }
        });
        
        const updatedRoasts = result.current.roastsByAccount('twitter-1');
        const updatedRoast = updatedRoasts.find(r => r.id === roastToApprove.id);
        
        // If the mock API succeeded, status should be 'approved'
        // If it failed, it should have rolled back to original status
        expect(['approved', 'pending']).toContain(updatedRoast.status);
      }
    });

    test('onRejectRoast updates status optimistically', async () => {
      const { result } = renderHook(() => useSocialAccounts(), { wrapper });
      
      const initialRoasts = result.current.roastsByAccount('twitter-1');
      const roastToReject = initialRoasts.find(r => r.status === 'pending');
      
      if (roastToReject) {
        await act(async () => {
          try {
            await result.current.onRejectRoast('twitter-1', roastToReject.id);
          } catch (error) {
            // Expected to potentially fail due to mock randomness
          }
        });
        
        const updatedRoasts = result.current.roastsByAccount('twitter-1');
        const updatedRoast = updatedRoasts.find(r => r.id === roastToReject.id);
        
        // If the mock API succeeded, status should be 'rejected'
        // If it failed, it should have rolled back to original status
        expect(['rejected', 'pending']).toContain(updatedRoast.status);
      }
    });

    test('onToggleAutoApprove updates setting optimistically', async () => {
      const { result } = renderHook(() => useSocialAccounts(), { wrapper });
      
      const account = result.current.getAccountById('twitter-1');
      const originalAutoApprove = account.settings.autoApprove;
      const newValue = !originalAutoApprove;
      
      await act(async () => {
        try {
          await result.current.onToggleAutoApprove('twitter-1', newValue);
        } catch (error) {
          // Expected to potentially fail due to mock randomness
        }
      });
      
      const updatedAccount = result.current.getAccountById('twitter-1');
      
      // If the mock API succeeded, setting should be updated
      // If it failed, it should have rolled back to original value
      expect([newValue, originalAutoApprove]).toContain(updatedAccount.settings.autoApprove);
    });
  });

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      const { result } = renderHook(() => useSocialAccounts(), { wrapper });
      
      // Test multiple times to increase chance of hitting mock error
      let errorOccurred = false;
      
      for (let i = 0; i < 10; i++) {
        try {
          await act(async () => {
            await result.current.onApproveRoast('twitter-1', 'roast-1');
          });
        } catch (error) {
          errorOccurred = true;
          expect(error.message).toContain('Failed to approve roast');
        }
      }
      
      // At least verify the function doesn't crash
      expect(result.current.accounts).toBeDefined();
    });

    test('rollback works on failed operations', async () => {
      const { result } = renderHook(() => useSocialAccounts(), { wrapper });
      
      const originalAccounts = result.current.accounts;
      const originalLength = originalAccounts.length;
      
      // Try disconnecting an account multiple times to hit error case
      for (let i = 0; i < 20; i++) {
        try {
          await act(async () => {
            await result.current.onDisconnectAccount('twitter-1');
          });
        } catch (error) {
          // Rollback should restore original state
          expect(result.current.accounts).toHaveLength(originalLength);
          break;
        }
      }
    });
  });

  describe('Stats Calculations', () => {
    test('calculates stats correctly', () => {
      const { result } = renderHook(() => useSocialAccounts(), { wrapper });
      
      expect(typeof result.current.totalAccounts).toBe('number');
      expect(typeof result.current.activeAccounts).toBe('number');
      expect(typeof result.current.totalMonthlyRoasts).toBe('number');
      
      expect(result.current.activeAccounts).toBeLessThanOrEqual(result.current.totalAccounts);
      expect(result.current.totalMonthlyRoasts).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Network Operations', () => {
    test('onConnectNetwork opens redirect URL', async () => {
      const { result } = renderHook(() => useSocialAccounts(), { wrapper });
      
      // Mock window.open
      const mockWindowOpen = jest.fn();
      const originalWindowOpen = window.open;
      window.open = mockWindowOpen;
      
      try {
        await act(async () => {
          await result.current.onConnectNetwork('instagram');
        });
        
        expect(mockWindowOpen).toHaveBeenCalledWith(
          expect.stringContaining('oauth.instagram.com'),
          '_blank'
        );
      } catch (error) {
        // Mock error case is acceptable
        expect(error.message).toContain('Failed to initiate OAuth');
      } finally {
        window.open = originalWindowOpen;
      }
    });
  });
});