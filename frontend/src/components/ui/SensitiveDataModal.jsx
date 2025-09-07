import React from 'react';
import { AlertTriangle, Copy, X, Shield } from 'lucide-react';
import { Button } from './button';

/**
 * Modal for confirming clipboard operations with potentially sensitive data
 */
const SensitiveDataModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  detection, 
  textPreview 
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // Truncate text preview for display
  const truncatedPreview = textPreview && textPreview.length > 100
    ? textPreview.substring(0, 100) + '...'
    : textPreview;

  // Safe access to suggestions with null check
  const suggestions = detection?.suggestions ?? [];

  // Safe access to confidence with type check and clamping
  const confidence = typeof detection?.confidence === 'number' ? detection.confidence : 0;
  const clampedConfidence = Math.max(0, Math.min(1, confidence));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Información Sensible Detectada
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Warning message */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <Shield className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">
                  Se ha detectado información que podría ser sensible
                </p>
                {suggestions.length > 0 && (
                  <ul className="list-disc list-inside space-y-1">
                    {suggestions.slice(0, 2).map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Text preview */}
          {truncatedPreview && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-sm text-gray-600 mb-1 font-medium">
                Texto a copiar:
              </p>
              <p className="text-sm text-gray-800 italic">
                "{truncatedPreview}"
              </p>
            </div>
          )}

          {/* Confidence indicator */}
          {clampedConfidence > 0.7 && (
            <div className="text-xs text-gray-500 flex items-center space-x-1">
              <span>Nivel de confianza: Alto</span>
              <div className="w-12 h-1 bg-red-200 rounded">
                <div
                  className="h-1 bg-red-500 rounded"
                  style={{ width: `${clampedConfidence * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Warning text */}
          <div className="text-sm text-gray-600">
            <p>
              ¿Estás seguro de que quieres copiar este contenido al portapapeles? 
              Asegúrate de no pegarlo en lugares públicos o no seguros.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 p-4 border-t bg-gray-50">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="text-gray-600"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar de todas formas
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SensitiveDataModal;
