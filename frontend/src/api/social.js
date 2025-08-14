// Social Networks API SDK
// 
// Mock implementation ready for backend integration
// Replace internal implementations with actual API calls

import { MOCK_ROASTS, MOCK_ACCOUNTS, MOCK_INTERCEPTED } from '../mocks/social';

// Roasts API
export const getRoasts = async (
  accountId,
  params = {}
) => {
  await delay(300);
  console.log('🔗 [MOCK] getRoasts called', { accountId, params });

  const roasts = MOCK_ROASTS[accountId] || [];
  const limit = params.limit || 10;
  const startIndex = params.cursor ? parseInt(params.cursor) : 0;
  const endIndex = startIndex + limit;

  const pageData = roasts.slice(startIndex, endIndex);
  const hasMore = endIndex < roasts.length;

  return {
    data: pageData,
    pagination: {
      hasMore,
      nextCursor: hasMore ? endIndex.toString() : undefined
    }
  };
};

export const approveRoast = async (accountId, roastId) => {
  await delay(200);
  console.log('🔗 [MOCK] approveRoast called', { accountId, roastId });

  if (Math.random() <= 0.05) throw new Error('Failed to approve roast - network error');

  return { success: true };
};

export const rejectRoast = async (accountId, roastId) => {
  await delay(200);
  console.log('🔗 [MOCK] rejectRoast called', { accountId, roastId });

  if (Math.random() <= 0.05) throw new Error('Failed to reject roast - network error');

  return { success: true };
};

// Shield API
export const getShieldIntercepted = async (accountId, params = {}) => {
  await delay(300);
  console.log('🔗 [MOCK] getShieldIntercepted called', { accountId, params });

  const intercepted = MOCK_INTERCEPTED[accountId] || [];
  const limit = params.limit || 10;
  const startIndex = params.cursor ? parseInt(params.cursor) : 0;
  const endIndex = startIndex + limit;

  const pageData = intercepted.slice(startIndex, endIndex);
  const hasMore = endIndex < intercepted.length;

  return {
    data: pageData,
    pagination: {
      hasMore,
      nextCursor: hasMore ? endIndex.toString() : undefined
    }
  };
};

export const updateShieldSettings = async (accountId, settings) => {
  await delay(200);
  console.log('🔗 [MOCK] updateShieldSettings called', { accountId, settings });

  if (Math.random() <= 0.02) throw new Error('Failed to update shield settings - server error');

  return { success: true };
};

// Account Settings API
export const updateAccountSettings = async (accountId, settings) => {
  await delay(300);
  console.log('🔗 [MOCK] updateAccountSettings called', { accountId, settings });

  if (Math.random() <= 0.02) throw new Error('Failed to update account settings - server error');

  return { success: true };
};

// Connection API
export const connectNetwork = async (network) => {
  await delay(500);
  console.log('🔗 [MOCK] connectNetwork called', { network });

  const redirectUrl = `https://oauth.${network}.com/authorize`;

  return {
    success: true,
    redirectUrl
  };
};

export const disconnectAccount = async (accountId) => {
  await delay(300);
  console.log('🔗 [MOCK] disconnectAccount called', { accountId });

  if (Math.random() <= 0.01) throw new Error('Failed to disconnect account - server error');

  return { success: true };
};

// Utility functions
export const buildApiUrl = (endpoint) => {
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
  return `${baseUrl}/api${endpoint}`;
};

export const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

export const isMockMode = () => {
  return process.env.REACT_APP_ENABLE_MOCK_MODE === 'true' || process.env.NODE_ENV === 'test';
};

const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

export default {
  getRoasts,
  approveRoast,
  rejectRoast,
  getShieldIntercepted,
  updateShieldSettings,
  updateAccountSettings,
  connectNetwork,
  disconnectAccount,
  isMockMode,
  buildApiUrl,
  getAuthHeaders
};
