import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Heart, Flame, Zap, Check, Info, Sparkles } from 'lucide-react';
import { apiClient } from '../lib/api';

/**
 * StyleSelector - Issue #872
 * Updated to use the new 3-tone system (Flanders, Balanceado, Canalla)
 * Removes obsolete humor_type and intensity_level configs (Issue #686)
 */
const StyleSelector = () => {
  const [selectedTone, setSelectedTone] = useState('balanceado');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Clear messages after delay
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Load current tone settings
  useEffect(() => {
    loadToneSettings();
  }, []);

  const loadToneSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/user/settings/style');

      if (response.data.success) {
        // Issue #872 Fix: Backend uses 'style' field, not 'tone'
        const { style: tone } = response.data.data;
        // Normalize to new 3-tone system
        const normalizedTone = normalizeTone(tone || 'balanceado');
        setSelectedTone(normalizedTone);
      }
    } catch (err) {
      console.error('Failed to load tone settings:', err);
      // Don't show error for missing settings - use defaults
    } finally {
      setLoading(false);
    }
  };

  // Normalize legacy tones to new 3-tone system
  const normalizeTone = (tone) => {
    const toneMap = {
      // New tones (ES)
      flanders: 'flanders',
      balanceado: 'balanceado',
      canalla: 'canalla',
      // New tones (EN aliases)
      light: 'flanders',
      balanced: 'balanceado',
      savage: 'canalla',
      // Legacy mapping (backward compat)
      subtle: 'flanders',
      sarcastic: 'balanceado',
      direct: 'canalla',
      witty: 'balanceado',
      playful: 'flanders',
      friendly: 'flanders'
    };
    return toneMap[tone] || 'balanceado';
  };

  const updateTone = async (tone) => {
    try {
      setSaving(true);
      setError(null);

      // Issue #872 Fix: Backend expects 'style' field, not 'tone'
      const response = await apiClient.post('/user/settings/style', {
        style: tone
      });

      if (response.data.success) {
        setSelectedTone(tone);
        setSuccess('Tono actualizado correctamente');
      }
    } catch (err) {
      console.error('Failed to update tone:', err);
      setError('Error al actualizar el tono');
    } finally {
      setSaving(false);
    }
  };

  // Issue #872: New 3-tone system
  const toneOptions = [
    {
      id: 'flanders',
      name: 'Flanders',
      nameEN: 'Light',
      icon: Heart,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      intensity: '2/5',
      description: 'Tono amable pero con ironía sutil',
      personality: 'Educado, irónico, elegante',
      example:
        '"Fascinante crítica. Imagino que tu experiencia en desarrollo de software es... extensa."',
      resources: ['Ironía marcada pero sutil', 'Double entendre', 'Understatement'],
      restrictions: ['NO insultos directos', 'NO vulgaridad', 'Mantener sofisticación']
    },
    {
      id: 'balanceado',
      name: 'Balanceado',
      nameEN: 'Balanced',
      icon: Zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      intensity: '3/5',
      description: 'Equilibrio entre ingenio y firmeza',
      personality: 'Equilibrado, ingenioso, directo',
      example:
        '"Vaya argumento interesante. Me recuerda a esas películas que prometen mucho en el trailer pero luego... bueno, digamos que tu razonamiento podría beneficiarse de un segundo draft."',
      resources: ['Sarcasmo marcado', 'Comparaciones inteligentes', 'Ironía directa'],
      restrictions: [
        'NO crueldad innecesaria',
        'NO ataques personales prohibidos',
        'Mantener ingenio'
      ],
      isDefault: true
    },
    {
      id: 'canalla',
      name: 'Canalla',
      nameEN: 'Savage',
      icon: Flame,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      intensity: '4/5',
      description: 'Directo y sin filtros, más picante',
      personality: 'Directo, sin filtros, contundente',
      example:
        '"Tu conocimiento es como el WiFi del aeropuerto: teóricamente existe, pero nadie lo encuentra. Y cuando lo encuentras, es tan lento que deseas no haberlo intentado."',
      resources: ['Hipérbole extrema', 'Comparaciones brutales', 'Sarcasmo cortante'],
      restrictions: ['NO discriminación', 'NO ataques físicos', 'Mantener ingenio']
    }
  ];

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-sm text-green-800">{success}</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center space-x-2">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-medium text-gray-900">Tono de Roasts</h3>
      </div>

      {/* Description */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="mb-2">
              <strong>Sistema de 3 Tonos:</strong> Elige el tono que mejor represente tu
              personalidad al roastear comentarios tóxicos. Cada tono tiene su propia intensidad,
              personalidad y restricciones de seguridad.
            </p>
            <p className="text-xs">
              💡 <strong>Tip:</strong> El tono Balanceado es el más versátil y recomendado para la
              mayoría de situaciones. Puedes cambiar de tono en cualquier momento.
            </p>
          </div>
        </div>
      </div>

      {/* Tone Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {toneOptions.map((tone) => {
          const IconComponent = tone.icon;
          const isSelected = selectedTone === tone.id;

          return (
            <div
              key={tone.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                isSelected
                  ? `${tone.borderColor} ${tone.bgColor} ring-2 ring-opacity-20`
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              onClick={() => !saving && updateTone(tone.id)}
            >
              <div className="space-y-3">
                {/* Header with Radio */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <IconComponent
                      className={`h-6 w-6 ${isSelected ? tone.color : 'text-gray-400'}`}
                    />
                    <div>
                      <h4 className="font-semibold text-gray-900">{tone.name}</h4>
                      <span className="text-xs text-gray-500">{tone.nameEN}</span>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected
                        ? `${tone.borderColor.replace('border-', 'border-')} ${tone.color.replace('text-', 'bg-')}`
                        : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>

                {/* Intensity Badge */}
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">
                    Intensidad: {tone.intensity}
                  </Badge>
                  {tone.isDefault && (
                    <Badge variant="outline" className="text-xs">
                      Por defecto
                    </Badge>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-gray-700 font-medium">{tone.description}</p>

                <p className="text-xs text-gray-600">
                  <strong>Personalidad:</strong> {tone.personality}
                </p>

                {/* Example */}
                <div className="bg-gray-50 rounded p-3 border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1 font-medium">Ejemplo:</div>
                  <div className="text-xs text-gray-800 italic">{tone.example}</div>
                </div>

                {/* Resources & Restrictions (Collapsible) */}
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                    Ver recursos y restricciones
                  </summary>
                  <div className="mt-2 space-y-2 pl-2">
                    <div>
                      <div className="font-medium text-green-700">✅ Recursos permitidos:</div>
                      <ul className="list-disc list-inside text-gray-600 space-y-1">
                        {tone.resources.map((resource, idx) => (
                          <li key={idx}>{resource}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-medium text-red-700">🚫 Restricciones:</div>
                      <ul className="list-disc list-inside text-gray-600 space-y-1">
                        {tone.restrictions.map((restriction, idx) => (
                          <li key={idx}>{restriction}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          );
        })}
      </div>

      {/* Saving Indicator */}
      {saving && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Guardando tono...</span>
          </div>
        </div>
      )}

      {/* Current Tone Summary */}
      {!loading && !saving && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-sm text-green-800">
            <div className="flex items-center space-x-2 mb-1">
              <Check className="h-4 w-4 text-green-600" />
              <span className="font-medium">
                Tono activo: {toneOptions.find((t) => t.id === selectedTone)?.name}(
                {toneOptions.find((t) => t.id === selectedTone)?.nameEN})
              </span>
            </div>
            <p className="text-xs">
              Todos los roasts futuros utilizarán este tono. Los cambios se aplican inmediatamente.
            </p>
          </div>
        </div>
      )}

      {/* Migration Notice (Issue #872) */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div className="text-xs text-yellow-800">
          <strong>📢 Actualización del sistema:</strong> Hemos simplificado los estilos de roast a 3
          tonos oficiales (Flanders, Balanceado, Canalla) eliminando configuraciones obsoletas
          (humor_type, intensity_level). Tus preferencias anteriores se han migrado automáticamente.
        </div>
      </div>
    </div>
  );
};

export default StyleSelector;
