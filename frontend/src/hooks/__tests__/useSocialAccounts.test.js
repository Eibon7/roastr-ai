/**
 * useSocialAccounts Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useSocialAccounts } from '../useSocialAccounts';
import socialAPI from '../../api/index.js';

// Mock the social API
jest.mock('../../api/index.js', () => ({
  __esModule: true,
  default: {
    approveRoast: jest.fn(() => Promise.resolve({ success: true })),
    rejectRoast: jest.fn(() => Promise.resolve({ success: true })),
    updateAccountSettings: jest.fn(() => Promise.resolve({ success: true })),
    updateShieldSettings: jest.fn(() => Promise.resolve({ success: true })),
    connectNetwork: jest.fn(() => Promise.resolve({ success: true, redirectUrl: 'https://oauth.example.com' })),
    disconnectAccount: jest.fn(() => Promise.resolve({ success: true })),
  }
}));

// Mock console.log to avoid spam in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Mock alert to avoid browser popup in tests
global.alert = jest.fn();

describe('useSocialAccounts Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the mock implementation
    socialAPI.connectNetwork.mockResolvedValue({ success: true, redirectUrl: 'https://oauth.example.com' });
  });

  describe('Initial State', () => {
    it('provides initial mock accounts', () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      expect(result.current.accounts).toHaveLength(3);
      expect(result.current.accounts[0].network).toBe('twitter');
      expect(result.current.accounts[1].network).toBe('twitter');
      expect(result.current.accounts[2].network).toBe('instagram');
    });

    it('calculates correct statistics', () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      expect(result.current.totalAccounts).toBe(3);
      expect(result.current.activeAccounts).toBe(2); // acc_tw_1 and acc_tw_2 are active
      expect(result.current.totalMonthlyRoasts).toBe(4326); // 4000 + 300 + 26
    });

    it('provides available networks with connection counts', () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      const twitterNetwork = result.current.availableNetworks.find(n => n.network === 'twitter');
      const instagramNetwork = result.current.availableNetworks.find(n => n.network === 'instagram');
      const facebookNetwork = result.current.availableNetworks.find(n => n.network === 'facebook');
      
      expect(twitterNetwork.connectedCount).toBe(2);
      expect(instagramNetwork.connectedCount).toBe(1);
      expect(facebookNetwork.connectedCount).toBe(0);
    });
  });

  describe('Data Getters', () => {
    it('getAccountById returns correct account', () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      const account = result.current.getAccountById('acc_tw_1');
      expect(account.handle).toBe('@handle_1');
      expect(account.network).toBe('twitter');
    });

    it('getAccountById returns undefined for non-existent account', () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      const account = result.current.getAccountById('non_existent');
      expect(account).toBeUndefined();
    });

    it('roastsByAccount returns correct roasts', () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      const roasts = result.current.roastsByAccount('acc_tw_1');
      expect(roasts).toHaveLength(3);
      expect(roasts[0].original).toBe('Tu código es una basura');
    });

    it('roastsByAccount returns empty array for account with no roasts', () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      const roasts = result.current.roastsByAccount('acc_ig_3');
      expect(roasts).toHaveLength(0);
    });

    it('interceptedByAccount returns correct intercepted items', () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      const intercepted = result.current.interceptedByAccount('acc_tw_1');
      expect(intercepted).toHaveLength(2);
      expect(intercepted[0].category).toBe('Insultos graves');
    });
  });

  describe('Roast Management Mutators', () => {
    it('onApproveRoast updates roast status to approved', async () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      await act(async () => {
        await result.current.onApproveRoast('acc_tw_2', 'r3');
      });
      
      const roasts = result.current.roastsByAccount('acc_tw_2');
      const approvedRoast = roasts.find(r => r.id === 'r3');
      expect(approvedRoast.status).toBe('approved');
      expect(socialAPI.approveRoast).toHaveBeenCalledWith('acc_tw_2', 'r3');
    });

    it('onRejectRoast updates roast status to rejected', async () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      await act(async () => {
        await result.current.onRejectRoast('acc_tw_2', 'r3');
      });
      
      const roasts = result.current.roastsByAccount('acc_tw_2');
      const rejectedRoast = roasts.find(r => r.id === 'r3');
      expect(rejectedRoast.status).toBe('rejected');
      expect(socialAPI.rejectRoast).toHaveBeenCalledWith('acc_tw_2', 'r3');
    });
  });

  describe('Account Settings Mutators', () => {
    it('onToggleAutoApprove updates autoApprove setting', async () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      await act(async () => {
        await result.current.onToggleAutoApprove('acc_tw_2', true);
      });
      
      const account = result.current.getAccountById('acc_tw_2');
      expect(account.settings.autoApprove).toBe(true);
      expect(socialAPI.updateAccountSettings).toHaveBeenCalledWith('acc_tw_2', { autoApprove: true });
    });

    it('onToggleAccount updates account status', async () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      await act(async () => {
        await result.current.onToggleAccount('acc_tw_1', 'inactive');
      });
      
      const account = result.current.getAccountById('acc_tw_1');
      expect(account.status).toBe('inactive');
      expect(socialAPI.updateAccountSettings).toHaveBeenCalledWith('acc_tw_1', { active: false });
    });

    it('onChangeShieldLevel updates shield level', async () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      await act(async () => {
        await result.current.onChangeShieldLevel('acc_tw_1', 100);
      });
      
      const account = result.current.getAccountById('acc_tw_1');
      expect(account.settings.shieldLevel).toBe(100);
      expect(socialAPI.updateShieldSettings).toHaveBeenCalledWith('acc_tw_1', { threshold: 100 });
    });

    it('onToggleShield updates shield enabled status', async () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      await act(async () => {
        await result.current.onToggleShield('acc_tw_1', false);
      });
      
      const account = result.current.getAccountById('acc_tw_1');
      expect(account.settings.shieldEnabled).toBe(false);
      expect(socialAPI.updateShieldSettings).toHaveBeenCalledWith('acc_tw_1', { enabled: false });
    });

    it('onChangeTone updates default tone', async () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      await act(async () => {
        await result.current.onChangeTone('acc_tw_1', 'Sarcástico');
      });
      
      const account = result.current.getAccountById('acc_tw_1');
      expect(account.settings.defaultTone).toBe('Sarcástico');
      expect(socialAPI.updateAccountSettings).toHaveBeenCalledWith('acc_tw_1', { defaultTone: 'Sarcástico' });
    });
  });

  describe('Account Connection Management', () => {
    it('onConnectNetwork initiates OAuth flow', async () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      // Mock window.open
      global.window.open = jest.fn();
      
      await act(async () => {
        await result.current.onConnectNetwork('facebook');
      });
      
      expect(socialAPI.connectNetwork).toHaveBeenCalledWith('facebook');
      expect(global.window.open).toHaveBeenCalledWith('https://oauth.example.com', '_blank');
    });

    it('onDisconnectAccount removes account and associated data', async () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      const initialAccountCount = result.current.totalAccounts;
      const initialRoastCount = result.current.roastsByAccount('acc_tw_1').length;
      
      await act(async () => {
        await result.current.onDisconnectAccount('acc_tw_1');
      });
      
      // Account should be removed
      expect(result.current.totalAccounts).toBe(initialAccountCount - 1);
      expect(result.current.getAccountById('acc_tw_1')).toBeUndefined();
      
      // Associated data should be cleaned up
      expect(result.current.roastsByAccount('acc_tw_1')).toHaveLength(0);
      expect(result.current.interceptedByAccount('acc_tw_1')).toHaveLength(0);
      
      expect(socialAPI.disconnectAccount).toHaveBeenCalledWith('acc_tw_1');
    });
  });

  describe('Statistics Updates', () => {
    it('updates statistics when account status changes', async () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      const initialActiveCount = result.current.activeAccounts;
      
      // Make an active account inactive
      await act(async () => {
        await result.current.onToggleAccount('acc_tw_1', 'inactive');
      });
      
      expect(result.current.activeAccounts).toBe(initialActiveCount - 1);
    });

    it('updates available networks count when account is disconnected', async () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      const initialTwitterCount = result.current.availableNetworks.find(n => n.network === 'twitter').connectedCount;
      
      // Disconnect a Twitter account
      await act(async () => {
        await result.current.onDisconnectAccount('acc_tw_1');
      });
      
      const updatedTwitterCount = result.current.availableNetworks.find(n => n.network === 'twitter').connectedCount;
      expect(updatedTwitterCount).toBe(initialTwitterCount - 1);
    });
  });

  describe('Edge Cases', () => {
    it('handles mutators with non-existent account IDs gracefully', async () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      // These should not throw errors
      await act(async () => {
        await result.current.onToggleAutoApprove('non_existent', true);
        await result.current.onApproveRoast('non_existent', 'non_existent_roast');
      });
      
      // State should remain unchanged
      expect(result.current.accounts).toHaveLength(3);
    });

    it('handles empty roasts arrays correctly', async () => {
      const { result } = renderHook(() => useSocialAccounts());
      
      const roasts = result.current.roastsByAccount('acc_ig_3');
      expect(roasts).toEqual([]);
      
      // Should not throw when trying to approve roast on empty array
      await act(async () => {
        await result.current.onApproveRoast('acc_ig_3', 'non_existent_roast');
      });
    });
  });
});
