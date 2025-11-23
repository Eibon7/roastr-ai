/**
 * StyleProfileDashboard Component Tests
 * Issue #369 - SPEC 9 - Style Profile Extraction
 *
 * Tests cover:
 * - Feature flag gating
 * - Premium user validation
 * - Profile extraction workflow
 * - Platform selection
 * - Error handling
 * - Loading states
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import StyleProfileDashboard from '../StyleProfileDashboard';
import useFeatureFlags from '../../hooks/useFeatureFlags';
import styleProfileAPI from '../../api/styleProfile';

// Mock the dependencies
jest.mock('../../hooks/useFeatureFlags');
jest.mock('../../api/styleProfile');
jest.mock('../StyleAnalysisChart', () => {
  return function MockStyleAnalysisChart({ metadata, language }) {
    return <div data-testid="style-analysis-chart">Style Analysis Chart - {language}</div>;
  };
});
jest.mock('../PlatformDistributionChart', () => {
  return function MockPlatformDistributionChart({ sources, language }) {
    return (
      <div data-testid="platform-distribution-chart">Platform Distribution Chart - {language}</div>
    );
  };
});
jest.mock('../ToneAnalysisDisplay', () => {
  return function MockToneAnalysisDisplay({ metadata, examples, language }) {
    return <div data-testid="tone-analysis-display">Tone Analysis Display - {language}</div>;
  };
});

const defaultProps = {
  userId: 'test-user-123',
  organizationId: 'test-org-456',
  userPlan: 'pro'
};

const mockProfile = {
  lang: 'es',
  prompt: 'Eres un usuario casual y relajado que prefiere mensajes concisos.',
  sources: { twitter: 150, youtube: 100 },
  createdAt: '2025-01-20T10:00:00Z',
  metadata: {
    totalItems: 250,
    avgLength: 75,
    dominantTone: 'casual',
    styleType: 'short',
    emojiUsage: 1.2,
    questionRate: 15,
    exclamationRate: 25
  },
  examples: ['Ejemplo de respuesta casual', 'Otro ejemplo divertido']
};

const mockFlags = {
  isEnabled: jest.fn(),
  areEnabled: jest.fn(),
  anyEnabled: jest.fn(),
  getEnabledFlags: jest.fn()
};

describe('StyleProfileDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default flag setup
    mockFlags.isEnabled.mockImplementation((flag) => {
      if (flag === 'ENABLE_STYLE_PROFILE') return true;
      return false;
    });

    useFeatureFlags.mockReturnValue({
      flags: mockFlags,
      loading: false,
      error: null
    });

    // Default API mocks
    styleProfileAPI.getUserProfiles.mockResolvedValue({
      success: true,
      data: []
    });

    styleProfileAPI.extractStyleProfile.mockResolvedValue({
      success: true,
      data: {
        profiles: [mockProfile],
        totalItems: 250,
        sources: { twitter: 150, youtube: 100 }
      }
    });
  });

  describe('Feature Flag Gating', () => {
    it('should show feature disabled message when ENABLE_STYLE_PROFILE is false', () => {
      mockFlags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_STYLE_PROFILE') return false;
        return false;
      });

      render(<StyleProfileDashboard {...defaultProps} />);

      expect(screen.getByText('Función en desarrollo')).toBeInTheDocument();
      expect(
        screen.getByText('La extracción de perfiles de estilo estará disponible próximamente.')
      ).toBeInTheDocument();
    });

    it('should show premium upgrade prompt for starter_trial users', () => {
      render(<StyleProfileDashboard {...defaultProps} userPlan="starter_trial" />);

      expect(screen.getByText('Función Premium')).toBeInTheDocument();
      expect(
        screen.getByText(
          'La extracción de perfiles de estilo está disponible para usuarios Pro y superiores.'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('Actualizar a Pro')).toBeInTheDocument();
    });

    it('should allow premium users to access the feature', () => {
      render(<StyleProfileDashboard {...defaultProps} userPlan="pro" />);

      expect(screen.getByText('🎭 Perfil de Estilo')).toBeInTheDocument();
      expect(screen.getByText('Seleccionar plataformas para análisis')).toBeInTheDocument();
    });
  });

  describe('Platform Selection', () => {
    beforeEach(() => {
      render(<StyleProfileDashboard {...defaultProps} />);
    });

    it('should display all available platforms', () => {
      const platforms = [
        'Twitter',
        'YouTube',
        'Instagram',
        'Facebook',
        'Discord',
        'Reddit',
        'TikTok',
        'Twitch',
        'Bluesky'
      ];

      platforms.forEach((platform) => {
        expect(screen.getByText(platform)).toBeInTheDocument();
      });
    });

    it('should start with Twitter and YouTube selected by default', () => {
      expect(screen.getByText('2 plataformas seleccionadas')).toBeInTheDocument();
    });

    it('should allow toggling platform selection', () => {
      const instagramButton = screen.getByText('Instagram').closest('button');

      fireEvent.click(instagramButton);

      expect(screen.getByText('3 plataformas seleccionadas')).toBeInTheDocument();
    });

    it('should disable extract button when no platforms selected', () => {
      // Deselect both default platforms
      const twitterButton = screen.getByText('Twitter').closest('button');
      const youtubeButton = screen.getByText('YouTube').closest('button');

      fireEvent.click(twitterButton);
      fireEvent.click(youtubeButton);

      expect(screen.getByText('0 plataformas seleccionadas')).toBeInTheDocument();

      const extractButton = screen.getByRole('button', { name: /extraer perfil/i });
      expect(extractButton).toBeDisabled();
    });
  });

  describe('Profile Extraction', () => {
    beforeEach(() => {
      render(<StyleProfileDashboard {...defaultProps} />);
    });

    it('should extract profile when button is clicked', async () => {
      const extractButton = screen.getByRole('button', { name: /extraer perfil/i });

      fireEvent.click(extractButton);

      expect(extractButton).toHaveTextContent('Extrayendo perfil...');
      expect(extractButton).toBeDisabled();

      await waitFor(() => {
        expect(styleProfileAPI.extractStyleProfile).toHaveBeenCalledWith(
          'test-org-456',
          'test-user-123',
          {
            platforms: ['twitter', 'youtube'],
            includeMetadata: true
          }
        );
      });
    });

    it('should display extracted profile after successful extraction', async () => {
      const extractButton = screen.getByRole('button', { name: /extraer perfil/i });

      fireEvent.click(extractButton);

      await waitFor(() => {
        expect(screen.getByText('📝 Perfil en ES')).toBeInTheDocument();
        expect(screen.getByText('250 elementos analizados')).toBeInTheDocument();
        expect(screen.getByText('🎯 Prompt de estilo personalizado')).toBeInTheDocument();
      });

      expect(screen.getByTestId('style-analysis-chart')).toBeInTheDocument();
      expect(screen.getByTestId('platform-distribution-chart')).toBeInTheDocument();
      expect(screen.getByTestId('tone-analysis-display')).toBeInTheDocument();
    });

    it('should handle extraction errors gracefully', async () => {
      const errorMessage = 'Insufficient content to generate profile';
      styleProfileAPI.extractStyleProfile.mockRejectedValue(new Error(errorMessage));

      const extractButton = screen.getByRole('button', { name: /extraer perfil/i });

      fireEvent.click(extractButton);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });
  });

  describe('Profile Loading', () => {
    it('should load existing profiles on mount', async () => {
      styleProfileAPI.getUserProfiles.mockResolvedValue({
        success: true,
        data: [mockProfile]
      });

      render(<StyleProfileDashboard {...defaultProps} />);

      await waitFor(() => {
        expect(styleProfileAPI.getUserProfiles).toHaveBeenCalledWith(
          'test-org-456',
          'test-user-123'
        );
      });

      await waitFor(() => {
        expect(screen.getByText('📝 Perfil en ES')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching profiles', () => {
      styleProfileAPI.getUserProfiles.mockImplementation(() => new Promise(() => {}));

      render(<StyleProfileDashboard {...defaultProps} />);

      expect(screen.getByText('Cargando perfiles...')).toBeInTheDocument();
    });

    it('should handle profile loading errors', async () => {
      styleProfileAPI.getUserProfiles.mockRejectedValue(new Error('Network error'));

      render(<StyleProfileDashboard {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('No se pudieron cargar los perfiles existentes')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no profiles exist', async () => {
      render(<StyleProfileDashboard {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Sin perfiles de estilo')).toBeInTheDocument();
        expect(
          screen.getByText(
            'Selecciona las plataformas y extrae tu primer perfil de estilo personalizado'
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText('💡 Necesitas al menos 50 elementos por idioma para generar un perfil')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Premium Feature Validation', () => {
    const premiumPlans = ['pro', 'plus', 'custom'];
    const nonPremiumPlans = ['starter_trial', 'starter'];

    premiumPlans.forEach((plan) => {
      it(`should allow access for ${plan} users`, () => {
        render(<StyleProfileDashboard {...defaultProps} userPlan={plan} />);

        expect(screen.queryByText('Función Premium')).not.toBeInTheDocument();
        expect(screen.getByText('🎭 Perfil de Estilo')).toBeInTheDocument();
      });
    });

    nonPremiumPlans.forEach((plan) => {
      it(`should show premium prompt for ${plan} users`, () => {
        render(<StyleProfileDashboard {...defaultProps} userPlan={plan} />);

        expect(screen.getByText('Función Premium')).toBeInTheDocument();
        expect(screen.queryByText('🎭 Perfil de Estilo')).not.toBeInTheDocument();
      });
    });
  });

  describe('Last Updated Display', () => {
    it('should show last updated date when profiles exist', async () => {
      styleProfileAPI.getUserProfiles.mockResolvedValue({
        success: true,
        data: [mockProfile]
      });

      render(<StyleProfileDashboard {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/última actualización/i)).toBeInTheDocument();
      });
    });

    it('should not show last updated when no profiles exist', () => {
      render(<StyleProfileDashboard {...defaultProps} />);

      expect(screen.queryByText(/última actualización/i)).not.toBeInTheDocument();
    });
  });
});
