/**
 * Tones API Module
 *
 * Roast tones configuration endpoints
 * Issue #1059: Modular API structure
 */

import apiClient from './client';

/**
 * Get available tones
 * @returns {Promise<Object>} Available tones
 */
export const getTones = async () => {
  return apiClient.get('/admin/roast-tones');
};

/**
 * Update tone configuration
 * @param {string} toneId - Tone ID
 * @param {Object} data - Tone configuration
 * @returns {Promise<Object>} Updated tone
 */
export const updateTone = async (toneId, data) => {
  return apiClient.put(`/admin/roast-tones/${toneId}`, data);
};

export default {
  getTones,
  updateTone
};
