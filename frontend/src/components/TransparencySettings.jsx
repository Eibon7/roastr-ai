import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Copy, Check, Info, Shield } from 'lucide-react';
import { apiClient } from '../lib/api';

const TransparencySettings = () => {
  const [explanation, setExplanation] = useState(null);
  const [bioText, setBioText] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  // Load transparency settings on component mount
  useEffect(() => {
    loadTransparencySettings();
  }, []);

  const loadTransparencySettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/user/settings/transparency-explanation');
      
      if (response.data.success) {
        const { explanation: explanationData, bioText: bioTextData, stats: statsData } = response.data.data;
        setExplanation(explanationData);
        setBioText(bioTextData || '');
        setStats(statsData || null);
      }
    } catch (err) {
      console.error('Failed to load transparency settings:', err);
      setError('Error al cargar información de transparencia');
    } finally {
      setLoading(false);
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
        <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center space-x-2">
        <Shield className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-medium text-gray-900">
          {explanation?.title || 'Transparencia en las respuestas'}
        </h3>
      </div>

      {/* Unified System Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p>{explanation?.description}</p>
          </div>
        </div>
      </div>

      {/* Bio Recommendation Section */}
      {bioText && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-medium mb-3 text-gray-900">
            💡 Recomendación adicional para tu biografía:
          </div>
          
          <div className="bg-gray-50 border border-gray-300 rounded p-3 mb-3">
            <div className="text-sm font-mono text-gray-800 break-words">
              {bioText}
            </div>
          </div>
          
          <Button
            onClick={copyBioText}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                ¡Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                {explanation?.buttonText || 'Copiar texto'}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Statistics Section */}
      {stats && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-medium mb-3 text-gray-900">
            📊 Estadísticas de disclaimers (últimas 24h):
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <div className="text-green-800 font-medium">Firmas cortas</div>
              <div className="text-2xl font-bold text-green-600">{stats.shortSignatureUsage}%</div>
              <div className="text-xs text-green-600">Para ahorrar espacio</div>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded p-3">
              <div className="text-purple-800 font-medium">Disclaimers creativos</div>
              <div className="text-2xl font-bold text-purple-600">{stats.creativeDisclaimerUsage}%</div>
              <div className="text-xs text-purple-600">Para variedad y branding</div>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-gray-500">
            Total de respuestas: {stats.totalDisclaimers}
          </div>
        </div>
      )}

      {/* Preview Section */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-medium mb-3 text-gray-900">Vista previa de respuestas:</div>
        
        <div className="space-y-3">
          {/* Short signature example */}
          <div className="bg-gray-50 border rounded p-3">
            <div className="text-sm text-gray-800">
              "Tu comentario tiene menos creatividad que una calculadora rota."
              <div className="mt-2 text-xs text-gray-600 border-t pt-2">
                — Roastr.AI
              </div>
            </div>
            <div className="text-xs text-green-600 mt-1">
              ✓ Firma corta (70% de las respuestas)
            </div>
          </div>
          
          {/* Creative disclaimer example */}
          <div className="bg-gray-50 border rounded p-3">
            <div className="text-sm text-gray-800">
              "Tu comentario tiene menos creatividad que una calculadora rota."
              <div className="mt-2 text-xs text-gray-600 border-t pt-2">
                0% humano, 100% devastador
              </div>
            </div>
            <div className="text-xs text-purple-600 mt-1">
              ✓ Disclaimer creativo (30% de las respuestas)
            </div>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 mt-3">
          ℹ️ Todas las respuestas automáticas incluyen ahora un aviso de IA. El sistema rota automáticamente entre firmas cortas y disclaimers creativos.
        </div>
      </div>
    </div>
  );
};

export default TransparencySettings;