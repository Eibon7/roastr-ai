/**
 * Social Networks API SDK
 * 
 * Mock implementation ready for backend integration
 * Replace internal implementations with actual API calls when backend is ready
 */

import { MOCK_ROASTS, MOCK_ACCOUNTS, MOCK_INTERCEPTED } from '../mocks/social';

// Types
export interface Roast {
  id: string;
  original: string;
  roast: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface InterceptedItem {
  id: string;
  category: string;
  action: string;
  preview: string;
  originalHidden: string;
  createdAt: string;
}

export interface Account {
  id: string;
  network: string;
  handle: string;
  status: 'active' | 'inactive';
  monthlyRoasts: number;
  settings: {
    autoApprove: boolean;
    shieldEnabled: boolean;
    shieldLevel: number;
    defaultTone: string;
  };
}

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
  };
}

// Mock delay for realistic behavior
const delay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

// Roasts API
export const getRoasts = async (
  accountId: string, 
  params: PaginationParams = {}
): Promise<PaginatedResponse<Roast>> => {
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

export const approveRoast = async (
  accountId: string, 
  roastId: string
): Promise<{ success: boolean }> => {
  await delay(200);
  
  console.log('🔗 [MOCK] approveRoast called', { accountId, roastId });
  
  // Simulate success/failure (95% success rate)
  const success = Math.random() > 0.05;
  
  if (!success) {
    throw new Error('Failed to approve roast - network error');
  }
  
  return { success: true };
};

export const rejectRoast = async (
  accountId: string, 
  roastId: string
): Promise<{ success: boolean }> => {
  await delay(200);
  
  console.log('🔗 [MOCK] rejectRoast called', { accountId, roastId });
  
  // Simulate success/failure (95% success rate)
  const success = Math.random() > 0.05;
  
  if (!success) {
    throw new Error('Failed to reject roast - network error');
  }
  
  return { success: true };
};

// Shield API
export const getShieldIntercepted = async (
  accountId: string, 
  params: PaginationParams = {}
): Promise<PaginatedResponse<InterceptedItem>> => {
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

export const updateShieldSettings = async (
  accountId: string, 
  settings: { enabled?: boolean; threshold?: number }
): Promise<{ success: boolean }> => {
  await delay(200);
  
  console.log('🔗 [MOCK] updateShieldSettings called', { accountId, settings });
  
  // Simulate success/failure (98% success rate)
  const success = Math.random() > 0.02;
  
  if (!success) {
    throw new Error('Failed to update shield settings - server error');
  }
  
  return { success: true };
};

// Account Settings API
export const updateAccountSettings = async (
  accountId: string, 
  settings: { 
    active?: boolean; 
    autoApprove?: boolean; 
    defaultTone?: string 
  }
): Promise<{ success: boolean }> => {
  await delay(300);
  
  console.log('🔗 [MOCK] updateAccountSettings called', { accountId, settings });
  
  // Simulate success/failure (98% success rate)  
  const success = Math.random() > 0.02;
  
  if (!success) {
    throw new Error('Failed to update account settings - server error');
  }
  
  return { success: true };
};

// Connection API
export const connectNetwork = async (network: string): Promise<{ 
  success: boolean; 
  redirectUrl?: string 
}> => {
  await delay(500);
  
  console.log('🔗 [MOCK] connectNetwork called', { network });
  
  // Simulate OAuth redirect URL
  const redirectUrl = `https://oauth.${network}.com/authorize?client_id=mock&redirect_uri=http://localhost:3000/auth/callback&state=${network}`;
  
  return { 
    success: true, 
    redirectUrl 
  };
};

export const disconnectAccount = async (accountId: string): Promise<{ success: boolean }> => {
  await delay(300);
  
  console.log('🔗 [MOCK] disconnectAccount called', { accountId });
  
  // Simulate success/failure (99% success rate)
  const success = Math.random() > 0.01;
  
  if (!success) {
    throw new Error('Failed to disconnect account - server error');
  }
  
  return { success: true };
};

// Utility functions for real API integration
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  return `${baseUrl}/api${endpoint}`;
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Mock mode check
export const isMockMode = (): boolean => {
  return process.env.REACT_APP_ENABLE_MOCK_MODE === 'true' || 
         process.env.NODE_ENV === 'test';
};

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