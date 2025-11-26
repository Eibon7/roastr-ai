/**
 * Plans API Module
 * 
 * Subscription plans endpoints
 * Issue #1059: Modular API structure
 */

import apiClient from './client';

/**
 * Get available plans
 * @returns {Promise<Object>} Available plans
 */
export const getPlans = async () => {
  return apiClient.get('/plan/available');
};

/**
 * Get current user plan
 * @returns {Promise<Object>} Current plan data
 */
export const getCurrentPlan = async () => {
  return apiClient.get('/plan/current');
};

/**
 * Update plan
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Updated plan
 */
export const updatePlan = async (planId) => {
  return apiClient.post('/plan/update', { plan_id: planId });
};

export default {
  getPlans,
  getCurrentPlan,
  updatePlan
};

