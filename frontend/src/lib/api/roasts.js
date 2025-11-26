/**
 * Roasts API Module
 * 
 * Roast generation and management endpoints
 * Issue #1059: Modular API structure
 */

import apiClient from './client';

/**
 * Generate roast preview
 * @param {Object} data - Roast generation data
 * @returns {Promise<Object>} Roast preview
 */
export const previewRoast = async (data) => {
  return apiClient.post('/roast/preview', data);
};

/**
 * Generate and publish roast
 * @param {Object} data - Roast generation data
 * @returns {Promise<Object>} Published roast
 */
export const publishRoast = async (data) => {
  return apiClient.post('/roast/publish', data);
};

/**
 * Get roast history
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Roast history
 */
export const getRoastHistory = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiClient.get(`/roast/history${query ? `?${query}` : ''}`);
};

export default {
  previewRoast,
  publishRoast,
  getRoastHistory
};

