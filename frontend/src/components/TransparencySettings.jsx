import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Copy, Check, Info } from 'lucide-react';
import { apiClient } from '../lib/api';

const TransparencySettings = () => {
  const [transparencyMode, setTransparencyMode] = useState('bio');
  const [options, setOptions] = useState([]);
  const [bioText, setBioText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  // Load transparency settings on component mount
  useEffect(() => {
    loadTransparencySettings();
  }, []);

  const loadTransparencySettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/user/settings/transparency-mode');
      
      if (response.data.success) {
        const { transparency_mode, bio_text, options: settingOptions } = response.data.data;
        setTransparencyMode(transparency_mode);
        setBioText(bio_text || '');
        setOptions(settingOptions || []);
      }
    } catch (err) {
      console.error('Failed to load transparency settings:', err);
      setError('Error al cargar configuración de transparencia');
    } finally {
      setLoading(false);
    }
  };

  const updateTransparencyMode = async (newMode) => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await apiClient.patch('/user/settings/transparency-mode', {
        mode: newMode
      });
      
      if (response.data.success) {
        setTransparencyMode(newMode);
        setBioText(response.data.data.bio_text || '');
        
        // Show success notification
        if (window.showNotification) {
          window.showNotification('Configuración actualizada exitosamente', 'success');
        }
      }
    } catch (err) {
      console.error('Failed to update transparency mode:', err);
      setError('Error al actualizar configuración');
    } finally {
      setSaving(false);
    }
  };

  const copyBioText = async () => {
    try {
      await navigator.clipboard.writeText(bioText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      if (window.showNotification) {
        window.showNotification('Texto copiado al portapapeles', 'success');
      }
    } catch (err) {
      console.error('Failed to copy bio text:', err);
      setError('Error al copiar texto');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="space-y-3">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Transparency Mode Options */}
      <div className="space-y-3">
        {options.map((option) => (
          <div
            key={option.value}
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              transparencyMode === option.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => updateTransparencyMode(option.value)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="transparency_mode"
                      value={option.value}
                      checked={transparencyMode === option.value}
                      onChange={() => updateTransparencyMode(option.value)}
                      className="text-blue-600"
                    />
                    <span className="font-medium">{option.label}</span>
                    {option.is_default && (
                      <Badge variant="outline" className="text-xs">
                        Por defecto
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-600 mt-1 ml-6">
                  {option.description}
                </div>
              </div>
              
              {saving && transparencyMode === option.value && (
                <div className="text-sm text-blue-600">Guardando...</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bio Text Copy Section */}
      {transparencyMode === 'bio' && bioText && (
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
          <div className="flex items-start space-x-2 mb-3">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <strong>Copia este texto a tu biografía:</strong>
            </div>
          </div>
          
          <div className="bg-white border border-blue-300 rounded p-3 mb-3">
            <div className="text-sm font-mono text-gray-800 break-words">
              {bioText}
            </div>
          </div>
          
          <Button
            onClick={copyBioText}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            disabled={saving}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                ¡Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copiar texto
              </>
            )}
          </Button>
        </div>
      )}

      {/* Preview Section */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-medium mb-2">Vista previa:</div>
        <div className="bg-gray-50 border rounded p-3">
          <div className="text-sm text-gray-800">
            "Tu comentario tiene menos creatividad que una calculadora rota."
            {transparencyMode === 'signature' && (
              <div className="mt-2 text-xs text-gray-600 border-t pt-2">
                — Generado por Roastr.AI
              </div>
            )}
            {transparencyMode === 'creative' && (
              <div className="mt-2 text-xs text-gray-600 border-t pt-2">
                0% humano, 100% devastador
              </div>
            )}
          </div>
        </div>
        
        {transparencyMode === 'bio' && (
          <div className="text-xs text-gray-500 mt-2">
            💡 Con el modo "Aviso en Bio", tus roasts no incluyen disclaimer automático
          </div>
        )}
      </div>
    </div>
  );
};

export default TransparencySettings;