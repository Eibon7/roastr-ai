/**
 * Plans API Service
 * 
 * Handles subscription plans and billing
 * Issue #910 - Connect dashboard to real backend
 */

import { apiClient } from '../lib/api';

/**
 * Get current user's plan
 * @returns {Promise<{plan_id: string, plan_limits: Object, subscription_status: string}>}
 */
export async function getCurrentPlan() {
  return apiClient.get('/plan/current');
}

/**
 * Get all available plans
 * @returns {Promise<{plans: Array}>}
 */
export async function getAvailablePlans() {
  return apiClient.get('/plans');
}

/**
 * Upgrade to a new plan
 * @param {string} planId - Plan ID (free, starter, pro, plus)
 * @returns {Promise<{success: boolean, subscription: Object}>}
 */
export async function upgradePlan(planId) {
  return apiClient.post('/plan/upgrade', { planId });
}

/**
 * Downgrade to a lower plan
 * @param {string} planId - Plan ID
 * @returns {Promise<{success: boolean, subscription: Object}>}
 */
export async function downgradePlan(planId) {
  return apiClient.post('/plan/downgrade', { planId });
}

/**
 * Cancel subscription
 * @returns {Promise<{success: boolean, cancel_at_period_end: boolean}>}
 */
export async function cancelSubscription() {
  return apiClient.post('/plan/cancel', {});
}

/**
 * Get billing history
 * @returns {Promise<{invoices: Array}>}
 */
export async function getBillingHistory() {
  return apiClient.get('/billing/history');
}

/**
 * Get upcoming invoice preview
 * @returns {Promise<{amount_due: number, period_start: string, period_end: string}>}
 */
export async function getUpcomingInvoice() {
  return apiClient.get('/billing/upcoming');
}

