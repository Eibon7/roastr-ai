/**
 * Integrations API Service
 *
 * Handles platform integrations (Twitter, YouTube, etc.)
 * Issue #910 - Connect dashboard to real backend
 */

import { apiClient } from '../lib/api';

/**
 * Get all integrations for the current user
 * @returns {Promise<{integrations: Array}>}
 */
export async function getIntegrations() {
  return apiClient.get('/integrations');
}

/**
 * Get integration status (connected platforms)
 * @returns {Promise<{integrations: Array}>}
 */
export async function getIntegrationStatus() {
  return apiClient.get('/integrations/status');
}

/**
 * Get available platforms to connect
 * @returns {Promise<{platforms: Array}>}
 */
export async function getAvailablePlatforms() {
  return apiClient.get('/integrations/platforms');
}

/**
 * Connect a new platform
 * @param {string} platform - Platform name (twitter, youtube, discord, etc.)
 * @param {Object} credentials - Platform-specific credentials
 * @returns {Promise<{success: boolean, integration: Object}>}
 */
export async function connectPlatform(platform, credentials) {
  return apiClient.post('/integrations/connect', {
    platform,
    credentials
  });
}

/**
 * Disconnect a platform integration
 * @param {string} integrationId - Integration ID
 * @returns {Promise<{success: boolean}>}
 */
export async function disconnectPlatform(integrationId) {
  return apiClient.delete(`/integrations/${integrationId}`);
}

/**
 * Update integration settings
 * @param {string} integrationId - Integration ID
 * @param {Object} settings - Settings to update
 * @returns {Promise<{success: boolean, integration: Object}>}
 */
export async function updateIntegrationSettings(integrationId, settings) {
  return apiClient.patch(`/integrations/${integrationId}`, settings);
}

/**
 * Test integration connection
 * @param {string} integrationId - Integration ID
 * @returns {Promise<{success: boolean, status: string}>}
 */
export async function testIntegrationConnection(integrationId) {
  return apiClient.post(`/integrations/${integrationId}/test`, {});
}

/**
 * Import followers from a platform
 * @param {string} platform - Platform name
 * @returns {Promise<{success: boolean, jobId: string}>}
 */
export async function importFollowers(platform) {
  return apiClient.post('/integrations/import', { platform });
}

/**
 * Get import progress
 * @param {string} jobId - Import job ID
 * @returns {Promise<{progress: number, status: string, imported: number}>}
 */
export async function getImportProgress(jobId) {
  return apiClient.get(`/integrations/import/${jobId}/progress`);
}
