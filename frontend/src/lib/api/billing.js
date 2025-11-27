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
 * Get comprehensive billing info (usage, payment method, subscription status)
 * Issue #1056: Complete billing information
 * @returns {Promise<Object>} Billing info with usage, limits, payment method, dates
 */
export const getBillingInfo = async () => {
  return apiClient.get('/billing/info');
};

/**
 * Cancel subscription
 * Issue #1056: Cancel subscription functionality
 * @param {boolean} immediately - Cancel immediately or at period end
 * @returns {Promise<Object>} Cancellation result
 */
export const cancelSubscription = async (immediately = false) => {
  return apiClient.post('/billing/cancel', { immediately });
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
  getBillingHistory,
  getBillingInfo,
  cancelSubscription
};
