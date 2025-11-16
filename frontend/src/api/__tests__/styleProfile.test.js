/**
 * Style Profile API Tests
 * Issue #369 - SPEC 9 - Style Profile Extraction
 * 
 * Tests cover:
 * - Profile extraction API calls
 * - Error handling for different HTTP status codes
 * - Premium feature validation
 * - Profile management operations
 * - Request/response format validation
 */

import { jest } from '@jest/globals';
import styleProfileAPI from '../styleProfile';
import apiClient from '../client';

// Mock the API client
jest.mock('../client');

describe('styleProfileAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractStyleProfile', () => {
    const mockExtractResponse = {
      data: {
        profiles: [
          {
            lang: 'es',
            prompt: 'Eres un usuario casual...',
            sources: { twitter: 150, youtube: 100 },
            metadata: {
              totalItems: 250,
              dominantTone: 'casual',
              styleType: 'short'
            }
          }
        ],
        totalItems: 250,
        sources: { twitter: 150, youtube: 100 }
      }
    };

    it('should extract style profile successfully', async () => {
      apiClient.post.mockResolvedValue(mockExtractResponse);

      const result = await styleProfileAPI.extractStyleProfile(
        'org-123',
        'user-456',
        { platforms: ['twitter', 'youtube'] }
      );

      expect(apiClient.post).toHaveBeenCalledWith('/api/style-profile/extract', {
        organizationId: 'org-123',
        userId: 'user-456',
        platforms: ['twitter', 'youtube'],
        includeMetadata: true,
        maxItemsPerPlatform: 300
      });

      expect(result).toEqual({
        success: true,
        data: mockExtractResponse.data
      });
    });

    it('should use default options when not provided', async () => {
      apiClient.post.mockResolvedValue(mockExtractResponse);

      await styleProfileAPI.extractStyleProfile('org-123', 'user-456');

      expect(apiClient.post).toHaveBeenCalledWith('/api/style-profile/extract', {
        organizationId: 'org-123',
        userId: 'user-456',
        platforms: ['twitter', 'youtube'],
        includeMetadata: true,
        maxItemsPerPlatform: 300
      });
    });

    it('should handle premium feature required error (403)', async () => {
      const mockError = {
        response: { status: 403 }
      };
      apiClient.post.mockRejectedValue(mockError);

      await expect(styleProfileAPI.extractStyleProfile('org-123', 'user-456'))
        .rejects.toThrow('Esta función requiere un plan Premium. Actualiza tu plan para acceder.');
    });

    it('should handle bad request error (400)', async () => {
      const mockError = {
        response: { 
          status: 400,
          data: { message: 'Invalid organization ID' }
        }
      };
      apiClient.post.mockRejectedValue(mockError);

      await expect(styleProfileAPI.extractStyleProfile('org-123', 'user-456'))
        .rejects.toThrow('Invalid organization ID');
    });

    it('should handle rate limiting error (429)', async () => {
      const mockError = {
        response: { status: 429 }
      };
      apiClient.post.mockRejectedValue(mockError);

      await expect(styleProfileAPI.extractStyleProfile('org-123', 'user-456'))
        .rejects.toThrow('Límite de solicitudes excedido. Intenta de nuevo más tarde.');
    });

    it('should handle not found error (404)', async () => {
      const mockError = {
        response: { status: 404 }
      };
      apiClient.post.mockRejectedValue(mockError);

      await expect(styleProfileAPI.extractStyleProfile('org-123', 'user-456'))
        .rejects.toThrow('No se encontró suficiente contenido para generar el perfil');
    });

    it('should handle generic errors', async () => {
      const mockError = new Error('Network error');
      apiClient.post.mockRejectedValue(mockError);

      await expect(styleProfileAPI.extractStyleProfile('org-123', 'user-456'))
        .rejects.toThrow('Error al extraer el perfil de estilo. Intenta de nuevo.');
    });
  });

  describe('getUserProfiles', () => {
    const mockProfilesResponse = {
      data: {
        profiles: [
          {
            lang: 'es',
            prompt: 'Eres un usuario casual...',
            createdAt: '2025-01-20T10:00:00Z'
          }
        ]
      }
    };

    it('should get user profiles successfully', async () => {
      apiClient.get.mockResolvedValue(mockProfilesResponse);

      const result = await styleProfileAPI.getUserProfiles('org-123', 'user-456');

      expect(apiClient.get).toHaveBeenCalledWith('/api/style-profile/org-123/user-456');
      expect(result).toEqual({
        success: true,
        data: mockProfilesResponse.data.profiles
      });
    });

    it('should handle empty profiles response', async () => {
      apiClient.get.mockResolvedValue({ data: {} });

      const result = await styleProfileAPI.getUserProfiles('org-123', 'user-456');

      expect(result).toEqual({
        success: true,
        data: []
      });
    });

    it('should handle not found (404) as empty profiles', async () => {
      const mockError = {
        response: { status: 404 }
      };
      apiClient.get.mockRejectedValue(mockError);

      const result = await styleProfileAPI.getUserProfiles('org-123', 'user-456');

      expect(result).toEqual({
        success: true,
        data: []
      });
    });

    it('should handle permission denied error (403)', async () => {
      const mockError = {
        response: { status: 403 }
      };
      apiClient.get.mockRejectedValue(mockError);

      await expect(styleProfileAPI.getUserProfiles('org-123', 'user-456'))
        .rejects.toThrow('No tienes permisos para acceder a estos perfiles');
    });

    it('should handle generic errors', async () => {
      const mockError = new Error('Network error');
      apiClient.get.mockRejectedValue(mockError);

      await expect(styleProfileAPI.getUserProfiles('org-123', 'user-456'))
        .rejects.toThrow('Error al cargar los perfiles existentes');
    });
  });

  describe('deleteProfile', () => {
    it('should delete profile successfully', async () => {
      apiClient.delete.mockResolvedValue({});

      const result = await styleProfileAPI.deleteProfile('org-123', 'user-456', 'es');

      expect(apiClient.delete).toHaveBeenCalledWith('/api/style-profile/org-123/user-456/es');
      expect(result).toEqual({
        success: true,
        message: 'Perfil eliminado correctamente'
      });
    });

    it('should handle not found error (404)', async () => {
      const mockError = {
        response: { status: 404 }
      };
      apiClient.delete.mockRejectedValue(mockError);

      await expect(styleProfileAPI.deleteProfile('org-123', 'user-456', 'es'))
        .rejects.toThrow('El perfil no existe o ya fue eliminado');
    });

    it('should handle permission denied error (403)', async () => {
      const mockError = {
        response: { status: 403 }
      };
      apiClient.delete.mockRejectedValue(mockError);

      await expect(styleProfileAPI.deleteProfile('org-123', 'user-456', 'es'))
        .rejects.toThrow('No tienes permisos para eliminar este perfil');
    });
  });

  describe('updateProfile', () => {
    const mockUpdateResponse = {
      data: {
        lang: 'es',
        prompt: 'Updated prompt...',
        updatedAt: '2025-01-20T11:00:00Z'
      }
    };

    it('should update profile successfully', async () => {
      apiClient.patch.mockResolvedValue(mockUpdateResponse);

      const updates = { customPrompt: 'Updated prompt...' };
      const result = await styleProfileAPI.updateProfile('org-123', 'user-456', 'es', updates);

      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/style-profile/org-123/user-456/es',
        updates
      );
      expect(result).toEqual({
        success: true,
        data: mockUpdateResponse.data
      });
    });

    it('should handle not found error (404)', async () => {
      const mockError = {
        response: { status: 404 }
      };
      apiClient.patch.mockRejectedValue(mockError);

      await expect(styleProfileAPI.updateProfile('org-123', 'user-456', 'es', {}))
        .rejects.toThrow('El perfil no existe');
    });

    it('should handle bad request error (400)', async () => {
      const mockError = {
        response: { 
          status: 400,
          data: { message: 'Invalid update data' }
        }
      };
      apiClient.patch.mockRejectedValue(mockError);

      await expect(styleProfileAPI.updateProfile('org-123', 'user-456', 'es', {}))
        .rejects.toThrow('Invalid update data');
    });
  });

  describe('getAvailablePlatforms', () => {
    const mockPlatformsResponse = {
      data: {
        platforms: [
          { platform: 'twitter', contentCount: 150 },
          { platform: 'youtube', contentCount: 100 }
        ]
      }
    };

    it('should get available platforms successfully', async () => {
      apiClient.get.mockResolvedValue(mockPlatformsResponse);

      const result = await styleProfileAPI.getAvailablePlatforms('org-123', 'user-456');

      expect(apiClient.get).toHaveBeenCalledWith('/api/style-profile/org-123/user-456/platforms');
      expect(result).toEqual({
        success: true,
        data: mockPlatformsResponse.data.platforms
      });
    });

    it('should handle empty platforms response', async () => {
      apiClient.get.mockResolvedValue({ data: {} });

      const result = await styleProfileAPI.getAvailablePlatforms('org-123', 'user-456');

      expect(result).toEqual({
        success: true,
        data: []
      });
    });

    it('should handle permission denied error (403)', async () => {
      const mockError = {
        response: { status: 403 }
      };
      apiClient.get.mockRejectedValue(mockError);

      await expect(styleProfileAPI.getAvailablePlatforms('org-123', 'user-456'))
        .rejects.toThrow('No tienes permisos para acceder a esta información');
    });
  });

  describe('validatePremiumAccess', () => {
    it('should validate premium access successfully', async () => {
      const mockAccessResponse = {
        data: {
          hasAccess: true,
          plan: 'pro',
          reason: null
        }
      };
      apiClient.get.mockResolvedValue(mockAccessResponse);

      const result = await styleProfileAPI.validatePremiumAccess('org-123', 'user-456');

      expect(apiClient.get).toHaveBeenCalledWith('/api/style-profile/org-123/user-456/access');
      expect(result).toEqual({
        success: true,
        data: {
          canExtract: true,
          plan: 'pro',
          reason: null
        }
      });
    });

    it('should handle validation errors gracefully', async () => {
      const mockError = new Error('Network error');
      apiClient.get.mockRejectedValue(mockError);

      const result = await styleProfileAPI.validatePremiumAccess('org-123', 'user-456');

      expect(result).toEqual({
        success: false,
        data: {
          canExtract: false,
          plan: 'starter_trial',
          reason: 'La extracción de perfiles requiere un plan Premium'
        }
      });
    });
  });

  describe('getProfileStats', () => {
    const mockStatsResponse = {
      data: {
        totalProfiles: 2,
        languages: ['es', 'en'],
        lastUpdated: '2025-01-20T10:00:00Z',
        totalItemsAnalyzed: 500
      }
    };

    it('should get profile stats successfully', async () => {
      apiClient.get.mockResolvedValue(mockStatsResponse);

      const result = await styleProfileAPI.getProfileStats('org-123', 'user-456');

      expect(apiClient.get).toHaveBeenCalledWith('/api/style-profile/org-123/user-456/stats');
      expect(result).toEqual({
        success: true,
        data: mockStatsResponse.data
      });
    });

    it('should handle not found (404) with empty stats', async () => {
      const mockError = {
        response: { status: 404 }
      };
      apiClient.get.mockRejectedValue(mockError);

      const result = await styleProfileAPI.getProfileStats('org-123', 'user-456');

      expect(result).toEqual({
        success: true,
        data: {
          totalProfiles: 0,
          languages: [],
          lastUpdated: null,
          totalItemsAnalyzed: 0
        }
      });
    });

    it('should handle generic errors', async () => {
      const mockError = new Error('Network error');
      apiClient.get.mockRejectedValue(mockError);

      await expect(styleProfileAPI.getProfileStats('org-123', 'user-456'))
        .rejects.toThrow('Error al cargar las estadísticas del perfil');
    });
  });
});