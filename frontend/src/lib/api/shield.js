/**
 * Shield API Module
 *
 * Shield moderation endpoints
 * Issue #1059: Modular API structure
 */

import apiClient from './client';

/**
 * Get Shield settings
 * @returns {Promise<Object>} Shield settings
 */
export const getShieldSettings = async () => {
  return apiClient.get('/shield/settings');
};

/**
 * Update Shield settings
 * @param {Object} data - Shield settings
 * @returns {Promise<Object>} Updated settings
 */
export const updateShieldSettings = async (data) => {
  return apiClient.put('/shield/settings', data);
};

/**
 * Get Shield actions history
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Shield actions
 */
export const getShieldActions = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiClient.get(`/shield/actions${query ? `?${query}` : ''}`);
};

export default {
  getShieldSettings,
  updateShieldSettings,
  getShieldActions
};
