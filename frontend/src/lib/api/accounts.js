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

export default {
  getAccount,
  updateAccount
};
