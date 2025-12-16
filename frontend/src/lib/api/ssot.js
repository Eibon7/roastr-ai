/**
 * SSOT API Module
 *
 * Public SSOT endpoints for frontend v2
 * Issue ROA-267: Crear endpoints públicos de SSOT para frontend v2
 *
 * These endpoints are PUBLIC (no authentication required)
 */

/**
 * Public API client for SSOT endpoints (no auth required)
 * Uses fetch directly since these endpoints don't require authentication
 */
const baseURL = process.env.REACT_APP_API_URL || '/api';

async function publicRequest(endpoint) {
  const url = endpoint.startsWith('http') ? endpoint : `${baseURL}${endpoint}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Get valid plan IDs, trial configuration, limits, and capabilities
 * Source: SSOT-V2.md section 1
 * @returns {Promise<Object>} Plans data
 */
export const getPlans = async () => {
  return publicRequest('/ssot/plans');
};

/**
 * Get monthly functional limits by plan
 * Source: SSOT-V2.md section 1.3
 * @returns {Promise<Object>} Plan limits
 */
export const getLimits = async () => {
  return publicRequest('/ssot/limits');
};

/**
 * Get valid feature flags and their semantics
 * Source: SSOT-V2.md section 3
 * @returns {Promise<Object>} Feature flags data
 */
export const getFeatures = async () => {
  return publicRequest('/ssot/features');
};

/**
 * Get valid roast tones
 * Source: SSOT-V2.md section 6.1
 * @returns {Promise<Object>} Tones data
 */
export const getTones = async () => {
  return publicRequest('/ssot/tones');
};

/**
 * Get valid subscription states
 * Source: SSOT-V2.md section 2.2
 * @returns {Promise<Object>} Subscription states data
 */
export const getSubscriptionStates = async () => {
  return publicRequest('/ssot/subscription-states');
};

/**
 * Get supported and planned platforms
 * Source: SSOT-V2.md section 7
 * @returns {Promise<Object>} Platforms data
 */
export const getPlatforms = async () => {
  return publicRequest('/ssot/platforms');
};

/**
 * Get all SSOT data in a single response (convenience endpoint)
 * @returns {Promise<Object>} Complete SSOT data
 */
export const getAll = async () => {
  return publicRequest('/ssot/all');
};

export default {
  getPlans,
  getLimits,
  getFeatures,
  getTones,
  getSubscriptionStates,
  getPlatforms,
  getAll
};

