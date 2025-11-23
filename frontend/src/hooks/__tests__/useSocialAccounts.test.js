/**
 * useSocialAccounts Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useSocialAccounts } from '../useSocialAccounts';

// Mock console.log to avoid spam in tests
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

// Mock alert to avoid browser popup in tests
global.alert = jest.fn();

describe('useSocialAccounts Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      const twitterNetwork = result.current.availableNetworks.find((n) => n.network === 'twitter');
      const instagramNetwork = result.current.availableNetworks.find(
        (n) => n.network === 'instagram'
      );
      const facebookNetwork = result.current.availableNetworks.find(
        (n) => n.network === 'facebook'
      );

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
    it('onApproveRoast updates roast status to approved', () => {
      const { result } = renderHook(() => useSocialAccounts());

      act(() => {
        result.current.onApproveRoast('acc_tw_2', 'r3');
      });

      const roasts = result.current.roastsByAccount('acc_tw_2');
      const approvedRoast = roasts.find((r) => r.id === 'r3');
      expect(approvedRoast.status).toBe('approved');
      expect(console.log).toHaveBeenCalledWith('🔗 Backend call needed: approveRoast', {
        accountId: 'acc_tw_2',
        roastId: 'r3'
      });
    });

    it('onRejectRoast updates roast status to rejected', () => {
      const { result } = renderHook(() => useSocialAccounts());

      act(() => {
        result.current.onRejectRoast('acc_tw_2', 'r3');
      });

      const roasts = result.current.roastsByAccount('acc_tw_2');
      const rejectedRoast = roasts.find((r) => r.id === 'r3');
      expect(rejectedRoast.status).toBe('rejected');
      expect(console.log).toHaveBeenCalledWith('🔗 Backend call needed: rejectRoast', {
        accountId: 'acc_tw_2',
        roastId: 'r3'
      });
    });
  });

  describe('Account Settings Mutators', () => {
    it('onToggleAutoApprove updates autoApprove setting', () => {
      const { result } = renderHook(() => useSocialAccounts());

      act(() => {
        result.current.onToggleAutoApprove('acc_tw_2', true);
      });

      const account = result.current.getAccountById('acc_tw_2');
      expect(account.settings.autoApprove).toBe(true);
      expect(console.log).toHaveBeenCalledWith('🔗 Backend call needed: updateAccountSettings', {
        accountId: 'acc_tw_2',
        autoApprove: true
      });
    });

    it('onToggleAccount updates account status', () => {
      const { result } = renderHook(() => useSocialAccounts());

      act(() => {
        result.current.onToggleAccount('acc_tw_1', 'inactive');
      });

      const account = result.current.getAccountById('acc_tw_1');
      expect(account.status).toBe('inactive');
      expect(console.log).toHaveBeenCalledWith('🔗 Backend call needed: updateAccountStatus', {
        accountId: 'acc_tw_1',
        status: 'inactive'
      });
    });

    it('onChangeShieldLevel updates shield level', () => {
      const { result } = renderHook(() => useSocialAccounts());

      act(() => {
        result.current.onChangeShieldLevel('acc_tw_1', 100);
      });

      const account = result.current.getAccountById('acc_tw_1');
      expect(account.settings.shieldLevel).toBe(100);
      expect(console.log).toHaveBeenCalledWith('🔗 Backend call needed: updateShieldLevel', {
        accountId: 'acc_tw_1',
        shieldLevel: 100
      });
    });

    it('onToggleShield updates shield enabled status', () => {
      const { result } = renderHook(() => useSocialAccounts());

      act(() => {
        result.current.onToggleShield('acc_tw_1', false);
      });

      const account = result.current.getAccountById('acc_tw_1');
      expect(account.settings.shieldEnabled).toBe(false);
      expect(console.log).toHaveBeenCalledWith('🔗 Backend call needed: toggleShield', {
        accountId: 'acc_tw_1',
        shieldEnabled: false
      });
    });

    it('onChangeTone updates default tone', () => {
      const { result } = renderHook(() => useSocialAccounts());

      act(() => {
        result.current.onChangeTone('acc_tw_1', 'Sarcástico');
      });

      const account = result.current.getAccountById('acc_tw_1');
      expect(account.settings.defaultTone).toBe('Sarcástico');
      expect(console.log).toHaveBeenCalledWith('🔗 Backend call needed: updateDefaultTone', {
        accountId: 'acc_tw_1',
        defaultTone: 'Sarcástico'
      });
    });
  });

  describe('Account Connection Management', () => {
    it('onConnectNetwork shows OAuth placeholder', () => {
      const { result } = renderHook(() => useSocialAccounts());

      act(() => {
        result.current.onConnectNetwork('facebook');
      });

      expect(console.log).toHaveBeenCalledWith('🔗 Backend call needed: initiateOAuth', {
        network: 'facebook'
      });
      expect(global.alert).toHaveBeenCalledWith(
        'OAuth flow would open for facebook. Backend integration needed.'
      );
    });

    it('onDisconnectAccount removes account and associated data', () => {
      const { result } = renderHook(() => useSocialAccounts());

      const initialAccountCount = result.current.totalAccounts;
      const initialRoastCount = result.current.roastsByAccount('acc_tw_1').length;

      act(() => {
        result.current.onDisconnectAccount('acc_tw_1');
      });

      // Account should be removed
      expect(result.current.totalAccounts).toBe(initialAccountCount - 1);
      expect(result.current.getAccountById('acc_tw_1')).toBeUndefined();

      // Associated data should be cleaned up
      expect(result.current.roastsByAccount('acc_tw_1')).toHaveLength(0);
      expect(result.current.interceptedByAccount('acc_tw_1')).toHaveLength(0);

      expect(console.log).toHaveBeenCalledWith('🔗 Backend call needed: disconnectAccount', {
        accountId: 'acc_tw_1'
      });
    });
  });

  describe('Statistics Updates', () => {
    it('updates statistics when account status changes', () => {
      const { result } = renderHook(() => useSocialAccounts());

      const initialActiveCount = result.current.activeAccounts;

      // Make an active account inactive
      act(() => {
        result.current.onToggleAccount('acc_tw_1', 'inactive');
      });

      expect(result.current.activeAccounts).toBe(initialActiveCount - 1);
    });

    it('updates available networks count when account is disconnected', () => {
      const { result } = renderHook(() => useSocialAccounts());

      const initialTwitterCount = result.current.availableNetworks.find(
        (n) => n.network === 'twitter'
      ).connectedCount;

      // Disconnect a Twitter account
      act(() => {
        result.current.onDisconnectAccount('acc_tw_1');
      });

      const updatedTwitterCount = result.current.availableNetworks.find(
        (n) => n.network === 'twitter'
      ).connectedCount;
      expect(updatedTwitterCount).toBe(initialTwitterCount - 1);
    });
  });

  describe('Edge Cases', () => {
    it('handles mutators with non-existent account IDs gracefully', () => {
      const { result } = renderHook(() => useSocialAccounts());

      // These should not throw errors
      act(() => {
        result.current.onToggleAutoApprove('non_existent', true);
        result.current.onApproveRoast('non_existent', 'non_existent_roast');
      });

      // State should remain unchanged
      expect(result.current.accounts).toHaveLength(3);
    });

    it('handles empty roasts arrays correctly', () => {
      const { result } = renderHook(() => useSocialAccounts());

      const roasts = result.current.roastsByAccount('acc_ig_3');
      expect(roasts).toEqual([]);

      // Should not throw when trying to approve roast on empty array
      act(() => {
        result.current.onApproveRoast('acc_ig_3', 'non_existent_roast');
      });
    });
  });
});
