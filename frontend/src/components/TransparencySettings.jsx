import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Copy, Check, Info, Shield, Settings } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useI18n } from '../hooks/useI18n';

const TransparencySettings = () => {
  const { t } = useI18n();
  const [currentMode, setCurrentMode] = useState('bio');
  const [bioText, setBioText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load transparency settings on component mount
  useEffect(() => {
    loadTransparencySettings();
  }, []);

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

  const loadTransparencySettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/user/settings/transparency-mode');
      
      if (response.data.success) {
        const { transparency_mode, bio_text } = response.data.data;
        setCurrentMode(transparency_mode || 'bio');
        setBioText(bio_text || '');
      }
    } catch (err) {
      console.error('Failed to load transparency settings:', err);
      setError('Error al cargar la configuración de transparencia');
    } finally {
      setLoading(false);
    }
  };

  const updateTransparencyMode = async (mode) => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await apiClient.patch('/user/settings/transparency-mode', {
        mode: mode
      });
      
      if (response.data.success) {
        setCurrentMode(mode);
        setBioText(response.data.data.bio_text || '');
        setSuccess('Configuración de transparencia actualizada correctamente');
      }
    } catch (err) {
      console.error('Failed to update transparency mode:', err);
      setError('Error al actualizar la configuración de transparencia');
    } finally {
      setSaving(false);
    }
  };

  const copyBioText = async () => {
    try {
      await navigator.clipboard.writeText(bioText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setSuccess('Texto copiado al portapapeles');
    } catch (err) {
      console.error('Failed to copy bio text:', err);
      setError('Error al copiar el texto');
    }
  };

  const transparencyOptions = [
    {
      value: 'bio',
      title: 'Aviso en Bio (recomendado)',
      description: 'Añades el texto sugerido en tu bio. Los roasts no incluyen ningún aviso adicional.',
      isDefault: true,
      icon: '📝'
    },
    {
      value: 'signature',
      title: 'Firma clásica',
      description: 'Cada roast termina con "— Generado por Roastr.AI".',
      isDefault: false,
      icon: '✍️'
    },
    {
      value: 'creative',
      title: 'Disclaimers creativos',
      description: 'Cada roast termina con un disclaimer aleatorio divertido del pool predefinido.',
      isDefault: false,
      icon: '🎭'
    }
  ];

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
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
        <Shield className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-medium text-gray-900">
          Transparencia de IA
        </h3>
      </div>

      {/* Description */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p>
              Por cumplimiento de las políticas de OpenAI y redes sociales, puedes elegir cómo 
              identificar que algunas respuestas son generadas por Roastr. No es una obligación 
              pesada, sino una opción de personalización.
            </p>
          </div>
        </div>
      </div>

      {/* Transparency Mode Options */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-900 flex items-center space-x-2">
          <Settings className="h-4 w-4" />
          <span>Opciones de transparencia</span>
        </h4>
        
        <div className="space-y-3">
          {transparencyOptions.map((option) => (
            <div
              key={option.value}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                currentMode === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => !saving && updateTransparencyMode(option.value)}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className={`w-4 h-4 rounded-full border-2 mt-1 ${
                    currentMode === option.value
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {currentMode === option.value && (
                      <div className="w-full h-full rounded-full bg-white scale-50"></div>
                    )}
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{option.icon}</span>
                    <h5 className="font-medium text-gray-900">
                      {option.title}
                      {option.isDefault && (
                        <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                          Por defecto
                        </span>
                      )}
                    </h5>
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-1">
                    {option.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {saving && (
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Guardando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Bio Text Section - Only show when bio mode is selected */}
      {currentMode === 'bio' && bioText && (
        <div className="border border-gray-200 rounded-lg p-4 bg-yellow-50">
          <div className="text-sm font-medium mb-3 text-gray-900 flex items-center space-x-2">
            <span>📝</span>
            <span>Texto recomendado para tu bio</span>
          </div>
          
          <div className="bg-white border border-gray-300 rounded p-3 mb-3">
            <div className="text-sm font-mono text-gray-800 break-words">
              {bioText}
            </div>
          </div>
          
          <Button
            onClick={copyBioText}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            disabled={!bioText}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-600" />
                ¡Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copiar texto
              </>
            )}
          </Button>
          
          <div className="mt-3 text-xs text-gray-600">
            <p>💡 <strong>Tip:</strong> Copia este texto y añádelo a tu biografía de Twitter, Instagram, etc.</p>
          </div>
        </div>
      )}

      {/* Preview Examples */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-3 text-gray-900">
          Vista previa de respuestas
        </h4>
        
        <div className="space-y-3">
          {/* Bio mode example */}
          {currentMode === 'bio' && (
            <div className="bg-gray-50 border rounded p-3">
              <div className="text-sm text-gray-800">
                "Tu comentario tiene menos creatividad que una calculadora rota."
              </div>
              <div className="text-xs text-blue-600 mt-2 flex items-center space-x-1">
                <span>📝</span>
                <span>Modo Bio: Sin modificación en el roast</span>
              </div>
            </div>
          )}
          
          {/* Signature mode example */}
          {currentMode === 'signature' && (
            <div className="bg-gray-50 border rounded p-3">
              <div className="text-sm text-gray-800">
                "Tu comentario tiene menos creatividad que una calculadora rota."
                <div className="mt-2 text-xs text-gray-600 border-t pt-2">
                  — Generado por Roastr.AI
                </div>
              </div>
              <div className="text-xs text-green-600 mt-1 flex items-center space-x-1">
                <span>✍️</span>
                <span>Firma clásica añadida</span>
              </div>
            </div>
          )}
          
          {/* Creative mode example */}
          {currentMode === 'creative' && (
            <div className="bg-gray-50 border rounded p-3">
              <div className="text-sm text-gray-800">
                "Tu comentario tiene menos creatividad que una calculadora rota."
                <div className="mt-2 text-xs text-gray-600 border-t pt-2">
                  Este roast fue generado por IA. Tranquilo: ningún humano perdió tiempo en ti.
                </div>
              </div>
              <div className="text-xs text-purple-600 mt-1 flex items-center space-x-1">
                <span>🎭</span>
                <span>Disclaimer creativo aleatorio</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-500 mt-3">
          ℹ️ Los cambios se aplican inmediatamente a todas las respuestas generadas.
        </div>
      </div>
    </div>
  );
};

export default TransparencySettings;