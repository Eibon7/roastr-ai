/**
 * Accounts API Module
 *
 * Account management endpoints
 * Issue #1059: Modular API structure
 */

import apiClient from './client';

/**
 * Get account information
 * @returns {Promise<Object>} Account data
 */
export const getAccount = async () => {
  return apiClient.get('/user/account');
};

/**
 * Update account settings
 * @param {Object} data - Account settings
 * @returns {Promise<Object>} Updated account
 */
export const updateAccount = async (data) => {
  return apiClient.put('/user/account', data);
};

/**
 * Get account by ID
 * @param {string} accountId - Account identifier
 * @returns {Promise<Object>} Account data
 */
export const getAccountById = async (accountId) => {
  const response = await apiClient.get(`/user/accounts/${accountId}`);
  return response.data || response;
};

/**
 * Get account roasts
 * @param {string} accountId - Account identifier
 * @param {Object} params - Query parameters (limit, offset)
 * @returns {Promise<Object>} Roasts data
 */
export const getAccountRoasts = async (accountId, params = {}) => {
  const query = new URLSearchParams(params).toString();
  const response = await apiClient.get(`/user/accounts/${accountId}/roasts${query ? `?${query}` : ''}`);
  return response.data || response;
};

export default {
  getAccount,
  updateAccount,
  getAccountById,
  getAccountRoasts
};
