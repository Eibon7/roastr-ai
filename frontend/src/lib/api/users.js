/**
 * Users API Module
 *
 * User management endpoints
 * Issue #1059: Modular API structure
 */

import apiClient from './client';

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User data
 */
export const getUser = async (userId) => {
  return apiClient.get(`/user/${userId}`);
};

/**
 * Update user
 * @param {string} userId - User ID
 * @param {Object} data - User data to update
 * @returns {Promise<Object>} Updated user data
 */
export const updateUser = async (userId, data) => {
  return apiClient.put(`/user/${userId}`, data);
};

/**
 * Get user credits status
 * @returns {Promise<Object>} Credit status
 */
export const getCreditsStatus = async () => {
  return apiClient.get('/user/credits/status');
};

/**
 * Get user credits history
 * @param {Object} params - Query parameters (limit, offset, etc.)
 * @returns {Promise<Object>} Credits history
 */
export const getCreditsHistory = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiClient.get(`/user/credits/history${query ? `?${query}` : ''}`);
};

export default {
  getUser,
  updateUser,
  getCreditsStatus,
  getCreditsHistory
};
