/**
 * Billing API Module
 * 
 * Billing and subscription endpoints
 * Issue #1059: Modular API structure
 */

import apiClient from './client';

/**
 * Get billing information
 * @returns {Promise<Object>} Billing data
 */
export const getBilling = async () => {
  return apiClient.get('/billing');
};

/**
 * Get subscription details
 * @returns {Promise<Object>} Subscription data
 */
export const getSubscription = async () => {
  return apiClient.get('/billing/subscription');
};

/**
 * Update payment method
 * @param {Object} data - Payment method data
 * @returns {Promise<Object>} Updated payment method
 */
export const updatePaymentMethod = async (data) => {
  return apiClient.put('/billing/payment-method', data);
};

/**
 * Get billing history
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Billing history
 */
export const getBillingHistory = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiClient.get(`/billing/history${query ? `?${query}` : ''}`);
};

export default {
  getBilling,
  getSubscription,
  updatePaymentMethod,
  getBillingHistory
};

