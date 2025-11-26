/**
 * Metrics API Module
 *
 * Analytics and metrics endpoints
 * Issue #1059: Modular API structure
 */

import apiClient from './client';

/**
 * Get user metrics
 * @param {Object} params - Query parameters (startDate, endDate, etc.)
 * @returns {Promise<Object>} Metrics data
 */
export const getUserMetrics = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiClient.get(`/analytics/metrics${query ? `?${query}` : ''}`);
};

/**
 * Get admin metrics
 * @returns {Promise<Object>} Admin metrics
 */
export const getAdminMetrics = async () => {
  return apiClient.get('/admin/metrics');
};

export default {
  getUserMetrics,
  getAdminMetrics
};
