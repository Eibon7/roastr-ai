/**
 * Usage API Service
 *
 * Handles usage tracking, limits, and cost control
 * Issue #910 - Connect dashboard to real backend
 */

import { apiClient } from '../lib/api';

/**
 * Get current usage statistics
 * @returns {Promise<{roasts: Object, analysis: Object, reset_date: string}>}
 */
export async function getCurrentUsage() {
  return apiClient.get('/usage');
}

/**
 * Get usage history for a date range
 * @param {string} startDate - Start date (ISO format)
 * @param {string} endDate - End date (ISO format)
 * @returns {Promise<{history: Array, total: Object}>}
 */
export async function getUsageHistory(startDate, endDate) {
  const params = new URLSearchParams({ startDate, endDate });
  return apiClient.get(`/usage/history?${params}`);
}

/**
 * Get monthly usage summary
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Promise<{roasts_used: number, analysis_used: number, total_cost_cents: number}>}
 */
export async function getMonthlyUsage(month, year) {
  return apiClient.get(`/usage/monthly?month=${month}&year=${year}`);
}

/**
 * Get usage breakdown by resource type
 * @returns {Promise<{by_resource: Array, total_cost: number}>}
 */
export async function getUsageBreakdown() {
  return apiClient.get('/usage/breakdown');
}

/**
 * Get cost optimization recommendations
 * @returns {Promise<{recommendations: Array}>}
 */
export async function getOptimizationRecommendations() {
  return apiClient.get('/usage/recommendations');
}
