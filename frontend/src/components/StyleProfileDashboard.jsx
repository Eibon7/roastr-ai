/**
 * StyleProfileDashboard Component
 * 
 * Main dashboard for Style Profile feature showing user's communication patterns
 * Issue #369 - SPEC 9 - Style Profile Extraction
 * 
 * Features:
 * - Multi-language profile display
 * - Platform distribution charts
 * - Tone analysis visualization
 * - Premium feature gating
 * - Real-time profile extraction
 */

import React, { useState, useEffect } from 'react';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import StyleAnalysisChart from './StyleAnalysisChart';
import PlatformDistributionChart from './PlatformDistributionChart';
import ToneAnalysisDisplay from './ToneAnalysisDisplay';
import styleProfileAPI from '../api/styleProfile';
import { isPremiumPlan } from '../utils/planHelpers';

const StyleProfileDashboard = ({ userId, organizationId, userPlan = 'starter_trial' }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState(['twitter', 'youtube']);
  
  const { flags } = useFeatureFlags();
  const isFeatureEnabled = flags.isEnabled('ENABLE_STYLE_PROFILE');
  const isPremiumUser = isPremiumPlan(userPlan);

  // Available platforms for profile extraction
  const availablePlatforms = [
    { id: 'twitter', name: 'Twitter', icon: '🐦' },
    { id: 'youtube', name: 'YouTube', icon: '📺' },
    { id: 'instagram', name: 'Instagram', icon: '📷' },
    { id: 'facebook', name: 'Facebook', icon: '📘' },
    { id: 'discord', name: 'Discord', icon: '💬' },
    { id: 'reddit', name: 'Reddit', icon: '🔶' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵' },
    { id: 'twitch', name: 'Twitch', icon: '🎮' },
    { id: 'bluesky', name: 'Bluesky', icon: '🦋' }
  ];

  // Load existing profiles on component mount
  useEffect(() => {
    if (!isFeatureEnabled || !isPremiumUser) return;
    
    loadProfiles();
  }, [isFeatureEnabled, isPremiumUser, organizationId, userId]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const response = await styleProfileAPI.getUserProfiles(organizationId, userId);
      setProfiles(response.data || []);
    } catch (err) {
      setError('No se pudieron cargar los perfiles existentes');
      console.error('Failed to load style profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractProfile = async () => {
    if (!isPremiumUser || selectedPlatforms.length === 0) return;

    try {
      setExtracting(true);
      setError(null);
      
      const response = await styleProfileAPI.extractStyleProfile(organizationId, userId, {
        platforms: selectedPlatforms,
        includeMetadata: true
      });
      
      setProfiles(response.data.profiles || []);
      
      // Show success message
      console.log(`✅ Perfil extraído exitosamente para ${response.data.totalItems} elementos`);
    } catch (err) {
      setError(err.message || 'Error al extraer el perfil de estilo');
      console.error('Style profile extraction failed:', err);
    } finally {
      setExtracting(false);
    }
  };

  const handlePlatformToggle = (platformId) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };

  // Feature gate checks
  if (!isFeatureEnabled) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="text-yellow-600 text-xl">⚠️</div>
          <div>
            <h3 className="text-lg font-medium text-yellow-800">
              Función en desarrollo
            </h3>
            <p className="text-yellow-700">
              La extracción de perfiles de estilo estará disponible próximamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isPremiumUser) {
    return (
      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="text-blue-600 text-xl">🔒</div>
          <div>
            <h3 className="text-lg font-medium text-blue-800">
              Función Premium
            </h3>
            <p className="text-blue-700 mb-3">
              La extracción de perfiles de estilo está disponible para usuarios Pro y superiores.
            </p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Actualizar a Pro
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            🎭 Perfil de Estilo
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Analiza tu estilo de comunicación en redes sociales
          </p>
        </div>
        
        {profiles.length > 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Última actualización: {new Date(profiles[0]?.createdAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Platform Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Seleccionar plataformas para análisis
        </h3>
        
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3 mb-6">
          {availablePlatforms.map(platform => (
            <button
              key={platform.id}
              onClick={() => handlePlatformToggle(platform.id)}
              className={`p-3 rounded-lg border transition-all ${
                selectedPlatforms.includes(platform.id)
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="text-xl mb-1">{platform.icon}</div>
              <div className="text-xs font-medium">{platform.name}</div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {selectedPlatforms.length} plataforma{selectedPlatforms.length !== 1 ? 's' : ''} seleccionada{selectedPlatforms.length !== 1 ? 's' : ''}
          </div>
          
          <button
            onClick={handleExtractProfile}
            disabled={extracting || selectedPlatforms.length === 0}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              extracting || selectedPlatforms.length === 0
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {extracting ? 'Extrayendo perfil...' : 'Extraer perfil de estilo'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="text-red-600 text-xl">❌</div>
            <div>
              <h4 className="font-medium text-red-800">Error</h4>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Cargando perfiles...</p>
          </div>
        </div>
      )}

      {/* Profiles Display */}
      {!loading && profiles.length > 0 && (
        <div className="space-y-6">
          {profiles.map((profile, index) => (
            <div key={`${profile.lang}-${index}`} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  📝 Perfil en {profile.lang.toUpperCase()}
                </h3>
                <div className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                  {profile.metadata.totalItems} elementos analizados
                </div>
              </div>

              {/* Style Prompt */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  🎯 Prompt de estilo personalizado
                </h4>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                  {profile.prompt}
                </p>
              </div>

              {/* Analysis Components */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StyleAnalysisChart 
                  metadata={profile.metadata}
                  language={profile.lang}
                />
                <PlatformDistributionChart 
                  sources={profile.sources}
                  language={profile.lang}
                />
              </div>

              <ToneAnalysisDisplay 
                metadata={profile.metadata}
                examples={profile.examples}
                language={profile.lang}
              />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && profiles.length === 0 && !error && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎭</div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            Sin perfiles de estilo
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Selecciona las plataformas y extrae tu primer perfil de estilo personalizado
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            💡 Necesitas al menos 50 elementos por idioma para generar un perfil
          </p>
        </div>
      )}
    </div>
  );
};

export default StyleProfileDashboard;