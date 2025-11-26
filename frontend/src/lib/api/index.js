/**
 * API Module Index
 *
 * Centralized export for all API modules
 * Issue #1059: Modular API structure
 */

import apiClient from './client';
import * as authApi from './auth';
import * as usersApi from './users';
import * as featureFlagsApi from './feature-flags';
import * as plansApi from './plans';
import * as tonesApi from './tones';
import * as metricsApi from './metrics';
import * as accountsApi from './accounts';
import * as roastsApi from './roasts';
import * as shieldApi from './shield';
import * as billingApi from './billing';

// Export client for direct access
export { apiClient, default as client } from './client';

// Export all API modules
export {
  authApi,
  usersApi,
  featureFlagsApi,
  plansApi,
  tonesApi,
  metricsApi,
  accountsApi,
  roastsApi,
  shieldApi,
  billingApi
};

// Re-export convenience methods from client
export const { get, post, put, patch, delete: del } = apiClient;

// Default export: main API client
export default apiClient;
