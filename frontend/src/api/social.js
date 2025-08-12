/**
 * Social Networks API SDK
 * 
 * Hybrid implementation with mock mode switch
 * Set REACT_APP_ENABLE_MOCK_MODE=false to use real API calls
 */

import { MOCK_ROASTS, MOCK_INTERCEPTED } from '../mocks/social';

// Mock delay for realistic behavior
const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

// Roasts API
export const getRoasts = async (accountId, params = {}) => {
  if (isMockMode()) {
    // MOCK IMPLEMENTATION
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
  }
  
  // REAL API IMPLEMENTATION
  /* 
  const url = buildApiUrl(`/social/accounts/${accountId}/roasts`);
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.cursor) queryParams.append('cursor', params.cursor);
  
  const response = await fetch(`${url}?${queryParams}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch roasts: ${response.statusText}`);
  }
  
  return response.json();
  */
  
  throw new Error('Real API not implemented yet - set REACT_APP_ENABLE_MOCK_MODE=true');
};

export const approveRoast = async (accountId, roastId) => {
  if (isMockMode()) {
    // MOCK IMPLEMENTATION
    await delay(200);
    
    console.log('🔗 [MOCK] approveRoast called', { accountId, roastId });
    
    // Simulate success/failure (95% success rate)
    const success = Math.random() > 0.05;
    
    if (!success) {
      throw new Error('Failed to approve roast - network error');
    }
    
    return { success: true };
  }
  
  // REAL API IMPLEMENTATION
  /*
  const response = await fetch(buildApiUrl(`/social/accounts/${accountId}/roasts/${roastId}/approve`), {
    method: 'POST',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    throw new Error(`Failed to approve roast: ${response.statusText}`);
  }
  
  return response.json();
  */
  
  throw new Error('Real API not implemented yet - set REACT_APP_ENABLE_MOCK_MODE=true');
};

export const rejectRoast = async (accountId, roastId) => {
  if (isMockMode()) {
    // MOCK IMPLEMENTATION
    await delay(200);
    
    console.log('🔗 [MOCK] rejectRoast called', { accountId, roastId });
    
    // Simulate success/failure (95% success rate)
    const success = Math.random() > 0.05;
    
    if (!success) {
      throw new Error('Failed to reject roast - network error');
    }
    
    return { success: true };
  }
  
  // REAL API IMPLEMENTATION
  /*
  const response = await fetch(buildApiUrl(`/social/accounts/${accountId}/roasts/${roastId}/reject`), {
    method: 'POST',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    throw new Error(`Failed to reject roast: ${response.statusText}`);
  }
  
  return response.json();
  */
  
  throw new Error('Real API not implemented yet - set REACT_APP_ENABLE_MOCK_MODE=true');
};

// Shield API
export const getShieldIntercepted = async (accountId, params = {}) => {
  if (isMockMode()) {
    // MOCK IMPLEMENTATION
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
  }
  
  // REAL API IMPLEMENTATION
  /*
  const url = buildApiUrl(`/social/accounts/${accountId}/shield/intercepted`);
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.cursor) queryParams.append('cursor', params.cursor);
  
  const response = await fetch(`${url}?${queryParams}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch intercepted items: ${response.statusText}`);
  }
  
  return response.json();
  */
  
  throw new Error('Real API not implemented yet - set REACT_APP_ENABLE_MOCK_MODE=true');
};

export const updateShieldSettings = async (accountId, settings) => {
  if (isMockMode()) {
    // MOCK IMPLEMENTATION
    await delay(200);
    
    console.log('🔗 [MOCK] updateShieldSettings called', { accountId, settings });
    
    // Simulate success/failure (98% success rate)
    const success = Math.random() > 0.02;
    
    if (!success) {
      throw new Error('Failed to update shield settings - server error');
    }
    
    return { success: true };
  }
  
  // REAL API IMPLEMENTATION
  /*
  const response = await fetch(buildApiUrl(`/social/accounts/${accountId}/shield/settings`), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(settings)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update shield settings: ${response.statusText}`);
  }
  
  return response.json();
  */
  
  throw new Error('Real API not implemented yet - set REACT_APP_ENABLE_MOCK_MODE=true');
};

// Account Settings API
export const updateAccountSettings = async (accountId, settings) => {
  if (isMockMode()) {
    // MOCK IMPLEMENTATION
    await delay(300);
    
    console.log('🔗 [MOCK] updateAccountSettings called', { accountId, settings });
    
    // Simulate success/failure (98% success rate)  
    const success = Math.random() > 0.02;
    
    if (!success) {
      throw new Error('Failed to update account settings - server error');
    }
    
    return { success: true };
  }
  
  // REAL API IMPLEMENTATION
  /*
  const response = await fetch(buildApiUrl(`/social/accounts/${accountId}/settings`), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(settings)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update account settings: ${response.statusText}`);
  }
  
  return response.json();
  */
  
  throw new Error('Real API not implemented yet - set REACT_APP_ENABLE_MOCK_MODE=true');
};

// Connection API
export const connectNetwork = async (network) => {
  if (isMockMode()) {
    // MOCK IMPLEMENTATION
    await delay(500);
    
    console.log('🔗 [MOCK] connectNetwork called', { network });
    
    // Simulate OAuth redirect URL
    const redirectUrl = `https://oauth.${network}.com/authorize?client_id=mock&redirect_uri=http://localhost:3000/auth/callback&state=${network}`;
    
    return { 
      success: true, 
      redirectUrl 
    };
  }
  
  // REAL API IMPLEMENTATION
  /*
  const response = await fetch(buildApiUrl(`/social/networks/${network}/connect`), {
    method: 'POST',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    throw new Error(`Failed to connect ${network}: ${response.statusText}`);
  }
  
  return response.json();
  */
  
  throw new Error('Real API not implemented yet - set REACT_APP_ENABLE_MOCK_MODE=true');
};

export const disconnectAccount = async (accountId) => {
  if (isMockMode()) {
    // MOCK IMPLEMENTATION
    await delay(300);
    
    console.log('🔗 [MOCK] disconnectAccount called', { accountId });
    
    // Simulate success/failure (99% success rate)
    const success = Math.random() > 0.01;
    
    if (!success) {
      throw new Error('Failed to disconnect account - server error');
    }
    
    return { success: true };
  }
  
  // REAL API IMPLEMENTATION
  /*
  const response = await fetch(buildApiUrl(`/social/accounts/${accountId}`), {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    throw new Error(`Failed to disconnect account: ${response.statusText}`);
  }
  
  return response.json();
  */
  
  throw new Error('Real API not implemented yet - set REACT_APP_ENABLE_MOCK_MODE=true');
};

// Utility functions for real API integration
export const buildApiUrl = (endpoint) => {
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  return `${baseUrl}/api${endpoint}`;
};

export const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Mock mode check
export const isMockMode = () => {
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