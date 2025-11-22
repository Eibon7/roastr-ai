/**
 * Roast API Service
 * 
 * Handles roast generation and preview
 * Issue #910 - Connect dashboard to real backend
 */

import { apiClient } from '../lib/api';

/**
 * Preview a roast without saving
 * @param {string} commentText - Original comment text
 * @param {number} toxicityScore - Toxicity score (0-1)
 * @param {string} style - Roast style (flanders, balanceado, canalla)
 * @param {Object} options - Additional options
 * @returns {Promise<{roast: string, tokens_used: number, method: string}>}
 */
export async function previewRoast(commentText, toxicityScore, style, options = {}) {
  return apiClient.post('/roast/preview', {
    commentText,
    toxicityScore,
    style,
    ...options
  });
}

/**
 * Generate a roast and save it
 * @param {string} commentId - Comment ID
 * @param {Object} options - Generation options
 * @returns {Promise<{roast: string, roast_id: string, status: string}>}
 */
export async function generateRoast(commentId, options = {}) {
  return apiClient.post('/roast/generate', {
    commentId,
    ...options
  });
}

/**
 * Get roast history
 * @param {Object} filters - Filter options
 * @returns {Promise<{roasts: Array, total: number}>}
 */
export async function getRoastHistory(filters = {}) {
  const params = new URLSearchParams(filters);
  return apiClient.get(`/roast/history?${params}`);
}

/**
 * Approve a roast
 * @param {string} roastId - Roast ID
 * @returns {Promise<{success: boolean}>}
 */
export async function approveRoast(roastId) {
  return apiClient.post(`/roast/${roastId}/approve`, {});
}

/**
 * Reject a roast
 * @param {string} roastId - Roast ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<{success: boolean}>}
 */
export async function rejectRoast(roastId, reason) {
  return apiClient.post(`/roast/${roastId}/reject`, { reason });
}

/**
 * Generate a variant roast
 * @param {string} roastId - Original roast ID
 * @returns {Promise<{variant: string, variant_id: string}>}
 */
export async function generateVariant(roastId) {
  return apiClient.post(`/roast/${roastId}/variant`, {});
}

/**
 * Get roast statistics
 * @returns {Promise<{total_generated: number, approved: number, rejected: number}>}
 */
export async function getRoastStatistics() {
  return apiClient.get('/roast/statistics');
}

