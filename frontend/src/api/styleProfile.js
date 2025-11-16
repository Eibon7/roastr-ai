/**
 * Style Profile API Client
 * 
 * Handles all API calls related to Style Profile extraction and management
 * Issue #369 - SPEC 9 - Style Profile Extraction
 * 
 * Features:
 * - Profile extraction from multiple platforms
 * - Profile retrieval and management
 * - Error handling and retry logic
 * - Premium feature validation
 */

import apiClient from './client';

const styleProfileAPI = {
  /**
   * Extract style profile from user's social media content
   * @param {string} organizationId - Organization identifier
   * @param {string} userId - User identifier
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Extracted profile data
   */
  async extractStyleProfile(organizationId, userId, options = {}) {
    const {
      platforms = ['twitter', 'youtube'],
      includeMetadata = true,
      maxItemsPerPlatform = 300
    } = options;

    try {
      const response = await apiClient.post('/api/style-profile/extract', {
        organizationId,
        userId,
        platforms,
        includeMetadata,
        maxItemsPerPlatform
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Style profile extraction failed:', error);
      
      // Handle specific error cases
      if (error.response?.status === 403) {
        throw new Error('Esta función requiere un plan Premium. Actualiza tu plan para acceder.');
      }
      
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.message || 'Datos de solicitud inválidos');
      }
      
      if (error.response?.status === 429) {
        throw new Error('Límite de solicitudes excedido. Intenta de nuevo más tarde.');
      }
      
      if (error.response?.status === 404) {
        throw new Error('No se encontró suficiente contenido para generar el perfil');
      }
      
      throw new Error('Error al extraer el perfil de estilo. Intenta de nuevo.');
    }
  },

  /**
   * Get user's existing style profiles
   * @param {string} organizationId - Organization identifier
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} User's style profiles
   */
  async getUserProfiles(organizationId, userId) {
    try {
      const response = await apiClient.get(`/api/style-profile/${organizationId}/${userId}`);
      
      return {
        success: true,
        data: response.data.profiles || []
      };
    } catch (error) {
      console.error('Failed to fetch user profiles:', error);
      
      if (error.response?.status === 404) {
        return {
          success: true,
          data: []
        };
      }
      
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para acceder a estos perfiles');
      }
      
      throw new Error('Error al cargar los perfiles existentes');
    }
  },

  /**
   * Delete a specific style profile
   * @param {string} organizationId - Organization identifier
   * @param {string} userId - User identifier
   * @param {string} language - Profile language to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteProfile(organizationId, userId, language) {
    try {
      await apiClient.delete(`/api/style-profile/${organizationId}/${userId}/${language}`);
      
      return {
        success: true,
        message: 'Perfil eliminado correctamente'
      };
    } catch (error) {
      console.error('Failed to delete profile:', error);
      
      if (error.response?.status === 404) {
        throw new Error('El perfil no existe o ya fue eliminado');
      }
      
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para eliminar este perfil');
      }
      
      throw new Error('Error al eliminar el perfil');
    }
  },

  /**
   * Update profile settings
   * @param {string} organizationId - Organization identifier
   * @param {string} userId - User identifier
   * @param {string} language - Profile language
   * @param {Object} updates - Profile updates
   * @returns {Promise<Object>} Update result
   */
  async updateProfile(organizationId, userId, language, updates) {
    try {
      const response = await apiClient.patch(
        `/api/style-profile/${organizationId}/${userId}/${language}`,
        updates
      );
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Failed to update profile:', error);
      
      if (error.response?.status === 404) {
        throw new Error('El perfil no existe');
      }
      
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para actualizar este perfil');
      }
      
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.message || 'Datos de actualización inválidos');
      }
      
      throw new Error('Error al actualizar el perfil');
    }
  },

  /**
   * Get available platforms for profile extraction
   * @param {string} organizationId - Organization identifier
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Available platforms with content counts
   */
  async getAvailablePlatforms(organizationId, userId) {
    try {
      const response = await apiClient.get(`/api/style-profile/${organizationId}/${userId}/platforms`);
      
      return {
        success: true,
        data: response.data.platforms || []
      };
    } catch (error) {
      console.error('Failed to fetch available platforms:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para acceder a esta información');
      }
      
      throw new Error('Error al cargar las plataformas disponibles');
    }
  },

  /**
   * Check if user can extract style profiles (premium feature validation)
   * @param {string} organizationId - Organization identifier
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Validation result
   */
  async validatePremiumAccess(organizationId, userId) {
    try {
      const response = await apiClient.get(`/api/style-profile/${organizationId}/${userId}/access`);
      
      return {
        success: true,
        data: {
          canExtract: response.data.hasAccess,
          plan: response.data.plan,
          reason: response.data.reason
        }
      };
    } catch (error) {
      console.error('Failed to validate premium access:', error);
      
      return {
        success: false,
        data: {
          canExtract: false,
          plan: 'starter_trial',
          reason: 'La extracción de perfiles requiere un plan Premium'
        }
      };
    }
  },

  /**
   * Get style profile statistics and insights
   * @param {string} organizationId - Organization identifier
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Profile statistics
   */
  async getProfileStats(organizationId, userId) {
    try {
      const response = await apiClient.get(`/api/style-profile/${organizationId}/${userId}/stats`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Failed to fetch profile stats:', error);
      
      if (error.response?.status === 404) {
        return {
          success: true,
          data: {
            totalProfiles: 0,
            languages: [],
            lastUpdated: null,
            totalItemsAnalyzed: 0
          }
        };
      }
      
      throw new Error('Error al cargar las estadísticas del perfil');
    }
  }
};

export default styleProfileAPI;