/**
 * useSocialAccounts Hook
 * 
 * Manages social media accounts state with mock data and provides
 * all necessary mutators for the UI. Now integrated with API SDK.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  MOCK_ACCOUNTS,
  MOCK_ROASTS,
  MOCK_INTERCEPTED,
  MOCK_AVAILABLE_NETWORKS
} from '../mocks/social';
import socialAPI from '../api/social';

export const useSocialAccounts = () => {
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

  // Mock user data for plan calculations (Issue #366)
  const userData = { plan: 'starter_trial', isAdminMode: false };

  // Connection limits calculation (Issue #841: Per-platform limits)
  const getConnectionLimits = useCallback(() => {
    const { normalizePlanId } = require('../utils/planHelpers');
    const planTier = normalizePlanId((userData.isAdminMode ? (userData.adminModeUser?.plan || '') : (userData?.plan || '')).toLowerCase());
    const maxConnectionsPerPlatform = (planTier === 'starter_trial' || planTier === 'starter') ? 1 : 2;
    return { maxConnectionsPerPlatform, planTier };
  }, [userData]);

  // Get available networks with per-platform connection limits validation
  // Issue #841: Limits are now PER PLATFORM, not global
  const availableNetworks = useMemo(() => {
    const { maxConnectionsPerPlatform } = getConnectionLimits();
    const totalConnections = accounts.length; // Total count across all platforms (for display)
    
    return MOCK_AVAILABLE_NETWORKS.map(network => {
      const connectedCount = accounts.filter(acc => acc.network === network.network).length;
      // Per-platform limit check: count accounts for this specific platform
      const platformAccounts = accounts.filter(acc => acc.platform === network.id);
      const canConnect = platformAccounts.length < maxConnectionsPerPlatform;
      const limitReached = platformAccounts.length >= maxConnectionsPerPlatform;
      
      return {
        ...network,
        connectedCount,
        canConnect,
        maxConnections,
        limitReached,
        totalConnections // For display purposes
      };
    });
  }, [accounts, getConnectionLimits]);

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
      await socialAPI.approveRoast(accountId, roastId);
      // Success - optimistic update was correct
    } catch (error) {
      // Rollback on error
      setRoastsData(prev => ({
        ...prev,
        [accountId]: previousState || []
      }));
      
      // TODO: Show error toast
      console.error('Failed to approve roast:', error);
      throw error;
    }
  }, [roastsData]);

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
      await socialAPI.rejectRoast(accountId, roastId);
      // Success - optimistic update was correct
    } catch (error) {
      // Rollback on error
      setRoastsData(prev => ({
        ...prev,
        [accountId]: previousState || []
      }));
      
      // TODO: Show error toast
      console.error('Failed to reject roast:', error);
      throw error;
    }
  }, [roastsData]);

  const onToggleAutoApprove = useCallback(async (accountId, nextValue) => {
    // Optimistic update
    const previousAccounts = accounts;
    setAccounts(prev => prev.map(account =>
      account.id === accountId
        ? { ...account, settings: { ...account.settings, autoApprove: nextValue } }
        : account
    ));

    try {
      await socialAPI.updateAccountSettings(accountId, { autoApprove: nextValue });
    } catch (error) {
      // Rollback on error
      setAccounts(previousAccounts);
      console.error('Failed to update auto-approve setting:', error);
      throw error;
    }
  }, [accounts]);

  const onToggleAccount = useCallback(async (accountId, nextStatus) => {
    // Optimistic update
    const previousAccounts = accounts;
    setAccounts(prev => prev.map(account =>
      account.id === accountId
        ? { ...account, status: nextStatus }
        : account
    ));

    try {
      await socialAPI.updateAccountSettings(accountId, { active: nextStatus === 'active' });
    } catch (error) {
      // Rollback on error
      setAccounts(previousAccounts);
      console.error('Failed to update account status:', error);
      throw error;
    }
  }, [accounts]);

  const onChangeShieldLevel = useCallback(async (accountId, level) => {
    // Optimistic update
    const previousAccounts = accounts;
    setAccounts(prev => prev.map(account =>
      account.id === accountId
        ? { ...account, settings: { ...account.settings, shieldLevel: level } }
        : account
    ));

    try {
      await socialAPI.updateShieldSettings(accountId, { threshold: level });
    } catch (error) {
      // Rollback on error
      setAccounts(previousAccounts);
      console.error('Failed to update shield level:', error);
      throw error;
    }
  }, [accounts]);

  const onToggleShield = useCallback(async (accountId, nextValue) => {
    // Optimistic update
    const previousAccounts = accounts;
    setAccounts(prev => prev.map(account =>
      account.id === accountId
        ? { ...account, settings: { ...account.settings, shieldEnabled: nextValue } }
        : account
    ));

    try {
      await socialAPI.updateShieldSettings(accountId, { enabled: nextValue });
    } catch (error) {
      // Rollback on error
      setAccounts(previousAccounts);
      console.error('Failed to toggle shield:', error);
      throw error;
    }
  }, [accounts]);

  const onChangeTone = useCallback(async (accountId, tone) => {
    // Optimistic update
    const previousAccounts = accounts;
    setAccounts(prev => prev.map(account =>
      account.id === accountId
        ? { ...account, settings: { ...account.settings, defaultTone: tone } }
        : account
    ));

    try {
      await socialAPI.updateAccountSettings(accountId, { defaultTone: tone });
    } catch (error) {
      // Rollback on error
      setAccounts(previousAccounts);
      console.error('Failed to update default tone:', error);
      throw error;
    }
  }, [accounts]);

  const onConnectNetwork = useCallback(async (network) => {
    try {
      const result = await socialAPI.connectNetwork(network);
      if (result.redirectUrl) {
        // In a real app, redirect to OAuth URL
        window.open(result.redirectUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
      throw error;
    }
  }, []);

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
      await socialAPI.disconnectAccount(accountId);
    } catch (error) {
      // Rollback on error
      setAccounts(previousAccounts);
      setRoastsData(previousRoastsData);
      setInterceptedData(previousInterceptedData);
      console.error('Failed to disconnect account:', error);
      throw error;
    }
  }, [accounts, roastsData, interceptedData]);

  // Stats calculations
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter(acc => acc.status === 'active').length;
  const totalMonthlyRoasts = accounts.reduce((sum, acc) => sum + acc.monthlyRoasts, 0);

  return {
    // Data
    accounts,
    availableNetworks,
    userData,
    
    // Getters
    getAccountById,
    roastsByAccount,
    interceptedByAccount,
    getConnectionLimits,
    
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