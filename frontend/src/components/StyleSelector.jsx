import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Zap,
  Heart,
  Smile,
  Target,
  Brain,
  Crown,
  Flame,
  Coffee,
  Sparkles,
  Settings as SettingsIcon,
  Check,
  Info
} from 'lucide-react';
import { apiClient } from '../lib/api';

const StyleSelector = () => {
  const [selectedStyle, setSelectedStyle] = useState('sarcastic');
  const [customSettings, setCustomSettings] = useState({
    intensity: 3,
    humor_type: 'witty',
    creativity: 3,
    politeness: 2
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  // Load current style settings
  useEffect(() => {
    loadStyleSettings();
  }, []);

  const loadStyleSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/user/settings/style');
      
      if (response.data.success) {
        const { style, settings } = response.data.data;
        setSelectedStyle(style || 'sarcastic');
        if (settings) {
          setCustomSettings(settings);
        }
      }
    } catch (err) {
      console.error('Failed to load style settings:', err);
      // Don't show error for missing settings - use defaults
    } finally {
      setLoading(false);
    }
  };

  const updateStyle = async (style, settings = null) => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await apiClient.post('/user/settings/style', {
        style: style,
        settings: settings || customSettings
      });
      
      if (response.data.success) {
        setSelectedStyle(style);
        if (settings) {
          setCustomSettings(settings);
        }
        setSuccess('Estilo actualizado correctamente');
      }
    } catch (err) {
      console.error('Failed to update style:', err);
      setError('Error al actualizar el estilo');
    } finally {
      setSaving(false);
    }
  };

  const styleOptions = [
    {
      id: 'sarcastic',
      name: 'Sarcástico',
      icon: Flame,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      description: 'Respuestas con sarcasmo inteligente y mordaz',
      example: '"Tu comentario tiene menos sentido que un peine para calvos"',
      settings: {
        intensity: 4,
        humor_type: 'sarcastic',
        creativity: 3,
        politeness: 2
      },
      isDefault: true
    },
    {
      id: 'witty',
      name: 'Ingenioso',
      icon: Brain,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      description: 'Comentarios inteligentes y perspicaces con humor sofisticado',
      example: '"Interesante teoría. ¿Tienes alguna evidencia o solo vibes?"',
      settings: {
        intensity: 3,
        humor_type: 'witty',
        creativity: 4,
        politeness: 3
      }
    },
    {
      id: 'playful',
      name: 'Juguetón',
      icon: Smile,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      description: 'Tono divertido y ligero, perfecto para mantener buen ambiente',
      example: '"Creo que tu teclado tiene autocorrector de lógica averiado"',
      settings: {
        intensity: 2,
        humor_type: 'playful',
        creativity: 3,
        politeness: 4
      }
    },
    {
      id: 'direct',
      name: 'Directo',
      icon: Target,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      description: 'Comentarios claros y al punto, sin rodeos',
      example: '"Ese argumento no se sostiene. Aquí tienes los datos reales..."',
      settings: {
        intensity: 3,
        humor_type: 'dry',
        creativity: 2,
        politeness: 3
      }
    },
    {
      id: 'friendly',
      name: 'Amigable',
      icon: Heart,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      description: 'Respuestas constructivas manteniendo un tono positivo',
      example: '"Entiendo tu punto, pero tal vez podrías considerar esta perspectiva..."',
      settings: {
        intensity: 1,
        humor_type: 'gentle',
        creativity: 2,
        politeness: 5
      }
    },
    {
      id: 'custom',
      name: 'Personalizado',
      icon: SettingsIcon,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      description: 'Configura tu propio estilo con ajustes avanzados',
      example: 'Personalizable según tus preferencias específicas',
      settings: {
        intensity: 3,
        humor_type: 'custom',
        creativity: 3,
        politeness: 3
      }
    }
  ];

  const intensityLabels = {
    1: { label: 'Muy suave', color: 'text-green-600' },
    2: { label: 'Suave', color: 'text-green-500' },
    3: { label: 'Moderado', color: 'text-yellow-500' },
    4: { label: 'Intenso', color: 'text-orange-500' },
    5: { label: 'Muy intenso', color: 'text-red-500' }
  };

  const humorTypes = [
    { id: 'witty', name: 'Ingenioso', description: 'Humor inteligente y sofisticado' },
    { id: 'sarcastic', name: 'Sarcástico', description: 'Comentarios mordaces e irónicos' },
    { id: 'playful', name: 'Juguetón', description: 'Divertido y ligero' },
    { id: 'dry', name: 'Seco', description: 'Humor sutil y directo' },
    { id: 'gentle', name: 'Suave', description: 'Humor amable y constructivo' },
    { id: 'custom', name: 'Personalizado', description: 'Tu propio estilo único' }
  ];

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded"></div>
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
        <h3 className="text-lg font-medium text-gray-900">
          Estilo de Respuestas
        </h3>
      </div>

      {/* Description */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="mb-2">
              <strong>Personaliza tu voz digital:</strong> Elige el estilo que mejor represente 
              tu personalidad al responder comentarios. Cada estilo ajusta automáticamente 
              el tono, intensidad y tipo de humor de tus respuestas.
            </p>
            <p className="text-xs">
              💡 <strong>Tip:</strong> Puedes cambiar de estilo en cualquier momento según el contexto o tu estado de ánimo.
            </p>
          </div>
        </div>
      </div>

      {/* Style Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {styleOptions.map((style) => {
          const IconComponent = style.icon;
          const isSelected = selectedStyle === style.id;
          
          return (
            <div
              key={style.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                isSelected
                  ? `${style.borderColor} ${style.bgColor} ring-2 ring-opacity-20`
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              onClick={() => !saving && updateStyle(style.id, style.settings)}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className={`w-5 h-5 rounded-full border-2 mt-1 ${
                    isSelected
                      ? `${style.borderColor.replace('border-', 'border-')} ${style.color.replace('text-', 'bg-')}`
                      : 'border-gray-300'
                  }`}>
                    {isSelected && (
                      <div className="w-full h-full rounded-full bg-white scale-50 flex items-center justify-center">
                        <Check className="h-2 w-2 text-gray-600" />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <IconComponent className={`h-5 w-5 ${isSelected ? style.color : 'text-gray-400'}`} />
                    <h4 className="font-medium text-gray-900">
                      {style.name}
                      {style.isDefault && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Por defecto
                        </Badge>
                      )}
                    </h4>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">
                    {style.description}
                  </p>
                  
                  <div className="bg-gray-50 rounded p-2 mb-2">
                    <div className="text-xs text-gray-500 mb-1">Ejemplo:</div>
                    <div className="text-sm font-mono text-gray-800">
                      {style.example}
                    </div>
                  </div>

                  {/* Style characteristics */}
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-xs">
                      Intensidad: {style.settings.intensity}/5
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {humorTypes.find(h => h.id === style.settings.humor_type)?.name || style.settings.humor_type}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Advanced Settings for Custom Style */}
      {selectedStyle === 'custom' && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900">Configuración Avanzada</h4>
            <Button
              onClick={() => setShowAdvanced(!showAdvanced)}
              variant="ghost"
              size="sm"
            >
              {showAdvanced ? 'Ocultar' : 'Mostrar'} detalles
            </Button>
          </div>

          {showAdvanced && (
            <div className="space-y-4">
              {/* Intensity Slider */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Intensidad: <span className={intensityLabels[customSettings.intensity].color}>
                    {intensityLabels[customSettings.intensity].label}
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={customSettings.intensity}
                  onChange={(e) => setCustomSettings({
                    ...customSettings,
                    intensity: parseInt(e.target.value)
                  })}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Controla qué tan directas y contundentes serán las respuestas
                </div>
              </div>

              {/* Humor Type */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Tipo de humor
                </label>
                <select
                  value={customSettings.humor_type}
                  onChange={(e) => setCustomSettings({
                    ...customSettings,
                    humor_type: e.target.value
                  })}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                >
                  {humorTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Creativity Slider */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Creatividad: {customSettings.creativity}/5
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={customSettings.creativity}
                  onChange={(e) => setCustomSettings({
                    ...customSettings,
                    creativity: parseInt(e.target.value)
                  })}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Nivel de originalidad y creatividad en las respuestas
                </div>
              </div>

              {/* Politeness Slider */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Cortesía: {customSettings.politeness}/5
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={customSettings.politeness}
                  onChange={(e) => setCustomSettings({
                    ...customSettings,
                    politeness: parseInt(e.target.value)
                  })}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Qué tan educadas y respetuosas serán las respuestas
                </div>
              </div>

              {/* Save Custom Settings */}
              <div className="pt-3 border-t">
                <Button
                  onClick={() => updateStyle('custom', customSettings)}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Guardando...
                    </>
                  ) : (
                    'Guardar configuración personalizada'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saving Indicator */}
      {saving && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Guardando estilo...</span>
          </div>
        </div>
      )}

      {/* Current Style Summary */}
      {!loading && !saving && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-sm text-green-800">
            <div className="flex items-center space-x-2 mb-1">
              <Check className="h-4 w-4 text-green-600" />
              <span className="font-medium">Estilo activo: {styleOptions.find(s => s.id === selectedStyle)?.name}</span>
            </div>
            <p className="text-xs">
              Todas las respuestas futuras utilizarán este estilo. Los cambios se aplican inmediatamente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StyleSelector;