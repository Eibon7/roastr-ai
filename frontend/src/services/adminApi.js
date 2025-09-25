/**
 * Admin API Service
 * Issue #294: Kill Switch global y panel de control de feature flags para administradores
 * 
 * Handles all admin-related API calls including feature flags and kill switch
 */

import { apiClient } from './apiClient';

class AdminApiService {
  /**
   * Get all feature flags
   */
  async getFeatureFlags(category = null) {
    const params = category ? { category } : {};
    const response = await apiClient.get('/admin/feature-flags', { params });
    return response.data;
  }

  /**
   * Update a specific feature flag
   */
  async updateFeatureFlag(flagKey, updates) {
    const response = await apiClient.put(`/admin/feature-flags/${encodeURIComponent(flagKey)}`, updates);
    return response.data;
  }

  /**
   * Toggle the global kill switch
   */
  async toggleKillSwitch(enabled, reason = null) {
    const response = await apiClient.post('/admin/kill-switch', {
      enabled,
      reason
    });
    return response.data;
  }

  /**
   * Get audit logs for admin actions
   */
  async getAuditLogs(filters = {}) {
    const {
      limit = 50,
      offset = 0,
      action_type,
      resource_type,
      admin_user_id,
      start_date,
      end_date
    } = filters;

    const params = {
      limit,
      offset,
      ...(action_type && { action_type }),
      ...(resource_type && { resource_type }),
      ...(admin_user_id && { admin_user_id }),
      ...(start_date && { start_date }),
      ...(end_date && { end_date })
    };

    const response = await apiClient.get('/admin/audit-logs', { params });
    return response.data;
  }

  /**
   * Get system status and health metrics
   */
  async getSystemStatus() {
    const response = await apiClient.get('/admin/system-status');
    return response.data;
  }

  /**
   * Get autopost queue status
   */
  async getAutopostQueueStatus() {
    const response = await apiClient.get('/admin/autopost-queue-status');
    return response.data;
  }

  /**
   * Bulk update feature flags
   */
  async bulkUpdateFeatureFlags(updates) {
    const response = await apiClient.post('/admin/feature-flags/bulk-update', {
      updates
    });
    return response.data;
  }

  /**
   * Create a new feature flag
   */
  async createFeatureFlag(flagData) {
    const response = await apiClient.post('/admin/feature-flags', flagData);
    return response.data;
  }

  /**
   * Delete a feature flag
   */
  async deleteFeatureFlag(flagKey) {
    const response = await apiClient.delete(`/admin/feature-flags/${encodeURIComponent(flagKey)}`);
    return response.data;
  }

  /**
   * Get feature flag usage analytics
   */
  async getFeatureFlagAnalytics(flagKey, timeRange = '7d') {
    const response = await apiClient.get(`/admin/feature-flags/${encodeURIComponent(flagKey)}/analytics`, {
      params: { timeRange }
    });
    return response.data;
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(filters = {}, format = 'csv') {
    const params = { ...filters, format };
    const response = await apiClient.get('/admin/audit-logs/export', {
      params,
      responseType: 'blob'
    });
    return response.data;
  }

  /**
   * Get admin dashboard metrics
   */
  async getDashboardMetrics() {
    const response = await apiClient.get('/admin/dashboard-metrics');
    return response.data;
  }

  /**
   * Test feature flag configuration
   */
  async testFeatureFlag(flagKey, testValue) {
    const response = await apiClient.post(`/admin/feature-flags/${encodeURIComponent(flagKey)}/test`, {
      test_value: testValue
    });
    return response.data;
  }

  /**
   * Get feature flag dependencies
   */
  async getFeatureFlagDependencies(flagKey) {
    const response = await apiClient.get(`/admin/feature-flags/${encodeURIComponent(flagKey)}/dependencies`);
    return response.data;
  }

  /**
   * Schedule feature flag toggle
   */
  async scheduleFeatureFlagToggle(flagKey, scheduledTime, enabled, reason = null) {
    const response = await apiClient.post(`/admin/feature-flags/${encodeURIComponent(flagKey)}/schedule`, {
      scheduled_time: scheduledTime,
      enabled,
      reason
    });
    return response.data;
  }

  /**
   * Get scheduled feature flag changes
   */
  async getScheduledChanges() {
    const response = await apiClient.get('/admin/feature-flags/scheduled');
    return response.data;
  }

  /**
   * Cancel scheduled feature flag change
   */
  async cancelScheduledChange(scheduleId) {
    const response = await apiClient.delete(`/admin/feature-flags/scheduled/${encodeURIComponent(scheduleId)}`);
    return response.data;
  }

  /**
   * Get real-time system alerts
   */
  async getSystemAlerts() {
    const response = await apiClient.get('/admin/system-alerts');
    return response.data;
  }

  /**
   * Acknowledge system alert
   */
  async acknowledgeAlert(alertId) {
    const response = await apiClient.post(`/admin/system-alerts/${encodeURIComponent(alertId)}/acknowledge`);
    return response.data;
  }

  /**
   * Get autopost performance metrics
   */
  async getAutopostMetrics(timeRange = '24h') {
    const response = await apiClient.get('/admin/autopost-metrics', {
      params: { timeRange }
    });
    return response.data;
  }

  /**
   * Force refresh feature flag cache
   */
  async refreshFeatureFlagCache() {
    const response = await apiClient.post('/admin/feature-flags/refresh-cache');
    return response.data;
  }

  /**
   * Get feature flag rollout status
   */
  async getFeatureFlagRollout(flagKey) {
    const response = await apiClient.get(`/admin/feature-flags/${encodeURIComponent(flagKey)}/rollout`);
    return response.data;
  }

  /**
   * Update feature flag rollout percentage
   */
  async updateFeatureFlagRollout(flagKey, percentage, targetGroups = []) {
    const response = await apiClient.put(`/admin/feature-flags/${encodeURIComponent(flagKey)}/rollout`, {
      percentage,
      target_groups: targetGroups
    });
    return response.data;
  }

  /**
   * Get emergency contacts for kill switch notifications
   */
  async getEmergencyContacts() {
    const response = await apiClient.get('/admin/emergency-contacts');
    return response.data;
  }

  /**
   * Update emergency contacts
   */
  async updateEmergencyContacts(contacts) {
    const response = await apiClient.put('/admin/emergency-contacts', {
      contacts
    });
    return response.data;
  }

  /**
   * Send test alert to emergency contacts
   */
  async sendTestAlert(message) {
    const response = await apiClient.post('/admin/emergency-contacts/test', {
      message
    });
    return response.data;
  }

  /**
   * Get kill switch activation history
   */
  async getKillSwitchHistory(limit = 50) {
    const response = await apiClient.get('/admin/kill-switch/history', {
      params: { limit }
    });
    return response.data;
  }

  /**
   * Get platform-specific autopost status
   */
  async getPlatformAutopostStatus() {
    const response = await apiClient.get('/admin/platform-autopost-status');
    return response.data;
  }

  /**
   * Update platform-specific autopost settings
   */
  async updatePlatformAutopostSettings(platform, enabled) {
    const response = await apiClient.put(`/admin/platform-autopost/${encodeURIComponent(platform)}`, {
      enabled
    });
    return response.data;
  }

  // ============================================================================
  // BACKOFFICE SETTINGS - Issue #371: SPEC 15
  // ============================================================================

  /**
   * Get global Shield thresholds
   */
  async getGlobalThresholds() {
    const response = await apiClient.get('/admin/backoffice/thresholds');
    return response.data;
  }

  /**
   * Update global Shield thresholds
   */
  async updateGlobalThresholds(thresholds) {
    const response = await apiClient.put('/admin/backoffice/thresholds', thresholds);
    return response.data;
  }

  /**
   * Run platform API healthcheck
   */
  async runHealthcheck(platforms = []) {
    const response = await apiClient.post('/admin/backoffice/healthcheck', { platforms });
    return response.data;
  }

  /**
   * Get latest healthcheck status
   */
  async getHealthcheckStatus() {
    const response = await apiClient.get('/admin/backoffice/healthcheck/status');
    return response.data;
  }

  /**
   * Export audit logs as CSV or JSON
   */
  async exportBackofficeAuditLogs(options = {}) {
    const { format = 'csv', days = 30, ...filters } = options;
    const response = await apiClient.get('/admin/backoffice/audit/export', {
      params: { format, days, ...filters },
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    return response;
  }
}

// Export singleton instance
export const adminApi = new AdminApiService();
export default adminApi;
