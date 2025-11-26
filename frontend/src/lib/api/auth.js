/**
 * Auth API Module
 * 
 * Authentication endpoints: login, register, magic link, password reset, etc.
 * Issue #1059: Modular API structure
 */

import apiClient from './client';

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Login response with session and user data
 */
export const login = async (email, password) => {
  return apiClient.post('/auth/login', { email, password });
};

/**
 * Register new user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} name - User name
 * @returns {Promise<Object>} Registration response
 */
export const register = async (email, password, name) => {
  return apiClient.post('/auth/register', { email, password, name });
};

/**
 * Login with magic link
 * @param {string} email - User email
 * @returns {Promise<Object>} Magic link response
 */
export const loginWithMagicLink = async (email) => {
  return apiClient.post('/auth/magic-link', { email });
};

/**
 * Register with magic link
 * @param {string} email - User email
 * @param {string} name - User name
 * @returns {Promise<Object>} Magic link registration response
 */
export const registerWithMagicLink = async (email, name) => {
  return apiClient.post('/auth/signup/magic-link', { email, name });
};

/**
 * Logout current user
 * @returns {Promise<Object>} Logout response
 */
export const logout = async () => {
  return apiClient.post('/auth/logout');
};

/**
 * Get current user profile
 * @returns {Promise<Object>} User profile data
 */
export const getCurrentUser = async () => {
  return apiClient.get('/auth/me');
};

/**
 * Update user profile
 * @param {Object} data - Profile data to update
 * @returns {Promise<Object>} Updated profile
 */
export const updateProfile = async (data) => {
  return apiClient.put('/auth/profile', data);
};

/**
 * Request password reset
 * @param {string} email - User email
 * @returns {Promise<Object>} Reset password response
 */
export const resetPassword = async (email) => {
  return apiClient.post('/auth/reset-password', { email });
};

/**
 * Update password with reset token
 * @param {string} accessToken - Reset token
 * @param {string} password - New password
 * @returns {Promise<Object>} Update password response
 */
export const updatePassword = async (accessToken, password) => {
  return apiClient.post('/auth/update-password', { access_token: accessToken, password });
};

/**
 * Change email address
 * @param {string} newEmail - New email address
 * @returns {Promise<Object>} Change email response
 */
export const changeEmail = async (newEmail) => {
  return apiClient.post('/auth/change-email', { new_email: newEmail });
};

/**
 * Export user data (GDPR)
 * @returns {Promise<Object>} Exported user data
 */
export const exportData = async () => {
  return apiClient.post('/auth/export-data');
};

/**
 * Delete account
 * @returns {Promise<Object>} Account deletion response
 */
export const deleteAccount = async () => {
  return apiClient.post('/auth/delete-account');
};

/**
 * Cancel account deletion
 * @returns {Promise<Object>} Cancellation response
 */
export const cancelAccountDeletion = async () => {
  return apiClient.post('/auth/cancel-account-deletion');
};

export default {
  login,
  register,
  loginWithMagicLink,
  registerWithMagicLink,
  logout,
  getCurrentUser,
  updateProfile,
  resetPassword,
  updatePassword,
  changeEmail,
  exportData,
  deleteAccount,
  cancelAccountDeletion
};

