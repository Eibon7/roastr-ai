/**
 * Feature Flags API Module
 *
 * Feature flags management endpoints
 * Issue #1059: Modular API structure
 */

import apiClient from './client';

/**
 * Get all feature flags
 * @returns {Promise<Object>} Feature flags data
 */
export const getFeatureFlags = async () => {
  return apiClient.get('/admin/feature-flags');
};

/**
 * Update feature flag
 * @param {string} flagName - Flag name
 * @param {boolean} enabled - Flag state
 * @returns {Promise<Object>} Updated flag
 */
export const updateFeatureFlag = async (flagName, enabled) => {
  return apiClient.put(`/admin/feature-flags/${flagName}`, { enabled });
};

export default {
  getFeatureFlags,
  updateFeatureFlag
};
