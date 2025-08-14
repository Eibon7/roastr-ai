/**
 * useSocialAccounts Hook
 * 
 * Manages social media accounts state with mock data and provides
 * all necessary mutators for the UI. Now with inline API functions.
 * Cache invalidation marker: build-7
 */

import { useState, useCallback, useMemo } from 'react';
import { useToast } from '../contexts/ToastContext';
import {
  MOCK_ACCOUNTS,
  MOCK_ROASTS,
  MOCK_INTERCEPTED,
  MOCK_AVAILABLE_NETWORKS
} from '../mocks/social';

// Inline API functions to avoid import issues
const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

const inlineAPI = {
  approveRoast: async (accountId, roastId) => {
    await delay(200);
    console.log('🔗 [MOCK] approveRoast called', { accountId, roastId });
    if (Math.random() <= 0.05) throw new Error('Failed to approve roast - network error');
    return { success: true };
  },
  
  rejectRoast: async (accountId, roastId) => {
    await delay(200);
    console.log('🔗 [MOCK] rejectRoast called', { accountId, roastId });
    if (Math.random() <= 0.05) throw new Error('Failed to reject roast - network error');
    return { success: true };
  },
  
  updateAccountSettings: async (accountId, settings) => {
    await delay(300);
    console.log('🔗 [MOCK] updateAccountSettings called', { accountId, settings });
    if (Math.random() <= 0.02) throw new Error('Failed to update account settings - server error');
    return { success: true };
  },
  
  updateShieldSettings: async (accountId, settings) => {
    await delay(200);
    console.log('🔗 [MOCK] updateShieldSettings called', { accountId, settings });
    if (Math.random() <= 0.02) throw new Error('Failed to update shield settings - server error');
    return { success: true };
  },
  
  connectNetwork: async (network) => {
    await delay(500);
    console.log('🔗 [MOCK] connectNetwork called', { network });
    const redirectUrl = `https://oauth.${network}.com/authorize`;
    return { success: true, redirectUrl };
  },
  
  disconnectAccount: async (accountId) => {
    await delay(300);
    console.log('🔗 [MOCK] disconnectAccount called', { accountId });
    if (Math.random() <= 0.01) throw new Error('Failed to disconnect account - server error');
    return { success: true };
  }
};

export const useSocialAccounts = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState(MOCK_ACCOUNTS);
  const [roastsData, setRoastsData] = useState(MOCK_ROASTS);
  const [interceptedData, setInterceptedData] = useState(MOCK_INTERCEPTED);

  // Getters
  const getAccountById = useCallback((id) => {
    return accounts.find(account => account.id === id);
  }, [accounts]);

  const roastsByAccount = useCallback((accountId) => {
    return roastsData[accountId] || [];
  }, [roastsData]);

  const interceptedByAccount = useCallback((accountId) => {
    return interceptedData[accountId] || [];
  }, [interceptedData]);

  // Get available networks with current connection count
  const availableNetworks = useMemo(() => {
    return MOCK_AVAILABLE_NETWORKS.map(network => ({
      ...network,
      connectedCount: accounts.filter(acc => acc.network === network.network).length
    }));
  }, [accounts]);

  // Mutators - With API integration and optimistic UI
  
  const onApproveRoast = useCallback(async (accountId, roastId) => {
    // Optimistic update
    const previousState = roastsData[accountId];
    setRoastsData(prev => ({
      ...prev,
      [accountId]: prev[accountId]?.map(roast =>
        roast.id === roastId ? { ...roast, status: 'approved' } : roast
      ) || []
    }));

    try {
      await inlineAPI.approveRoast(accountId, roastId);
      // Success - optimistic update was correct
    } catch (error) {
      // Rollback on error
      setRoastsData(prev => ({
        ...prev,
        [accountId]: previousState || []
      }));
      
      toast.error(`Error al aprobar roast: ${error.message}`);
      console.error('Failed to approve roast:', error);
      throw error;
    }
  }, [roastsData, toast]);

  const onRejectRoast = useCallback(async (accountId, roastId) => {
    // Optimistic update
    const previousState = roastsData[accountId];
    setRoastsData(prev => ({
      ...prev,
      [accountId]: prev[accountId]?.map(roast =>
        roast.id === roastId ? { ...roast, status: 'rejected' } : roast
      ) || []
    }));

    try {
      await inlineAPI.rejectRoast(accountId, roastId);
      // Success - optimistic update was correct
    } catch (error) {
      // Rollback on error
      setRoastsData(prev => ({
        ...prev,
        [accountId]: previousState || []
      }));
      
      toast.error(`Error al rechazar roast: ${error.message}`);
      console.error('Failed to reject roast:', error);
      throw error;
    }
  }, [roastsData, toast]);

  const onToggleAutoApprove = useCallback(async (accountId, nextValue) => {
    // Optimistic update
    const previousAccounts = accounts;
    setAccounts(prev => prev.map(account =>
      account.id === accountId
        ? { ...account, settings: { ...account.settings, autoApprove: nextValue } }
        : account
    ));

    try {
      await inlineAPI.updateAccountSettings(accountId, { autoApprove: nextValue });
    } catch (error) {
      // Rollback on error
      setAccounts(previousAccounts);
      toast.error(`Error al cambiar aprobación automática: ${error.message}`);
      console.error('Failed to update auto-approve setting:', error);
      throw error;
    }
  }, [accounts, toast]);

  const onToggleAccount = useCallback(async (accountId, nextStatus) => {
    // Optimistic update
    const previousAccounts = accounts;
    setAccounts(prev => prev.map(account =>
      account.id === accountId
        ? { ...account, status: nextStatus }
        : account
    ));

    try {
      await inlineAPI.updateAccountSettings(accountId, { active: nextStatus === 'active' });
    } catch (error) {
      // Rollback on error
      setAccounts(previousAccounts);
      toast.error(`Error al cambiar estado de cuenta: ${error.message}`);
      console.error('Failed to update account status:', error);
      throw error;
    }
  }, [accounts, toast]);

  const onChangeShieldLevel = useCallback(async (accountId, level) => {
    // Optimistic update
    const previousAccounts = accounts;
    setAccounts(prev => prev.map(account =>
      account.id === accountId
        ? { ...account, settings: { ...account.settings, shieldLevel: level } }
        : account
    ));

    try {
      await inlineAPI.updateShieldSettings(accountId, { threshold: level });
    } catch (error) {
      // Rollback on error
      setAccounts(previousAccounts);
      toast.error(`Error al cambiar nivel de Shield: ${error.message}`);
      console.error('Failed to update shield level:', error);
      throw error;
    }
  }, [accounts, toast]);

  const onToggleShield = useCallback(async (accountId, nextValue) => {
    // Optimistic update
    const previousAccounts = accounts;
    setAccounts(prev => prev.map(account =>
      account.id === accountId
        ? { ...account, settings: { ...account.settings, shieldEnabled: nextValue } }
        : account
    ));

    try {
      await inlineAPI.updateShieldSettings(accountId, { enabled: nextValue });
    } catch (error) {
      // Rollback on error
      setAccounts(previousAccounts);
      toast.error(`Error al activar/desactivar Shield: ${error.message}`);
      console.error('Failed to toggle shield:', error);
      throw error;
    }
  }, [accounts, toast]);

  const onChangeTone = useCallback(async (accountId, tone) => {
    // Optimistic update
    const previousAccounts = accounts;
    setAccounts(prev => prev.map(account =>
      account.id === accountId
        ? { ...account, settings: { ...account.settings, defaultTone: tone } }
        : account
    ));

    try {
      await inlineAPI.updateAccountSettings(accountId, { defaultTone: tone });
    } catch (error) {
      // Rollback on error
      setAccounts(previousAccounts);
      toast.error(`Error al cambiar tono predeterminado: ${error.message}`);
      console.error('Failed to update default tone:', error);
      throw error;
    }
  }, [accounts, toast]);

  const onConnectNetwork = useCallback(async (network) => {
    try {
      const result = await inlineAPI.connectNetwork(network);
      if (result.redirectUrl) {
        // In a real app, redirect to OAuth URL
        window.open(result.redirectUrl, '_blank');
      }
    } catch (error) {
      toast.error(`Error al conectar red social: ${error.message}`);
      console.error('Failed to initiate OAuth:', error);
      throw error;
    }
  }, [toast]);

  const onDisconnectAccount = useCallback(async (accountId) => {
    // Store previous state for rollback
    const previousAccounts = accounts;
    const previousRoastsData = roastsData;
    const previousInterceptedData = interceptedData;
    
    // Optimistic update - remove account and clean up associated data
    setAccounts(prev => prev.filter(account => account.id !== accountId));
    setRoastsData(prev => {
      const { [accountId]: removed, ...rest } = prev;
      return rest;
    });
    setInterceptedData(prev => {
      const { [accountId]: removed, ...rest } = prev;
      return rest;
    });

    try {
      await inlineAPI.disconnectAccount(accountId);
    } catch (error) {
      // Rollback on error
      setAccounts(previousAccounts);
      setRoastsData(previousRoastsData);
      setInterceptedData(previousInterceptedData);
      toast.error(`Error al desconectar cuenta: ${error.message}`);
      console.error('Failed to disconnect account:', error);
      throw error;
    }
  }, [accounts, roastsData, interceptedData, toast]);

  // Stats calculations
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter(acc => acc.status === 'active').length;
  const totalMonthlyRoasts = accounts.reduce((sum, acc) => sum + acc.monthlyRoasts, 0);

  return {
    // Data
    accounts,
    availableNetworks,
    
    // Getters
    getAccountById,
    roastsByAccount,
    interceptedByAccount,
    
    // Stats
    totalAccounts,
    activeAccounts,
    totalMonthlyRoasts,
    
    // Mutators (ready for backend)
    onApproveRoast,
    onRejectRoast,
    onToggleAutoApprove,
    onToggleAccount,
    onChangeShieldLevel,
    onToggleShield,
    onChangeTone,
    onConnectNetwork,
    onDisconnectAccount,
  };
};
