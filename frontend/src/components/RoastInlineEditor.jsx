/**
 * Inline Roast Editor for SPEC 8 - Issue #364
 * Allows editing generated roasts with style validation
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Save, 
  X, 
  Edit3, 
  Sparkles,
  Eye,
  CreditCard
} from 'lucide-react';

export default function RoastInlineEditor({ 
  roast, 
  roastId, 
  platform = 'twitter',
  onSave, 
  onCancel,
  onValidate = null // Optional external validation callback
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(roast || '');
  const [validation, setValidation] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Character limits by platform (normalized platform names)
  const characterLimits = useMemo(() => ({
    twitter: 280,
    instagram: 2200,
    facebook: 63206,
    youtube: 10000,
    tiktok: 2200,
    linkedin: 3000,
    reddit: 10000,
    discord: 2000,
    bluesky: 300
  }), []);

  // Unicode-aware character counting for consistency with backend
  const getGraphemeLength = useCallback((text) => {
    if (!text || typeof text !== 'string') return 0;
    
    // Use Intl.Segmenter for accurate grapheme counting if available
    // Use undefined locale for better Unicode support as per CodeRabbit feedback
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      try {
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        return Array.from(segmenter.segment(text)).length;
      } catch (error) {
        // Fallback if Intl.Segmenter fails
      }
    }
    
    // Fallback to Array.from for basic Unicode support
    try {
      return Array.from(text).length;
    } catch (error) {
      // Final fallback to basic length
      return text.length;
    }
  }, []);

  // Platform normalization for consistency with backend
  const normalizePlatform = useCallback((platform) => {
    const platformMap = {
      'x': 'twitter',
      'x.com': 'twitter'
    };
    const normalized = platform?.toLowerCase()?.trim();
    return platformMap[normalized] || normalized || 'twitter';
  }, []);

  // UTF-8 byte length calculation for consistency with backend (CodeRabbit Round 4)
  const getByteLengthUtf8 = useCallback((text) => {
    if (!text || typeof text !== 'string') return 0;
    
    try {
      // Use TextEncoder for UTF-8 byte calculation in browser environment
      return new TextEncoder().encode(text).length;
    } catch (error) {
      // Fallback to estimated UTF-16 length * 2
      return text.length * 2;
    }
  }, []);

  const normalizedPlatform = normalizePlatform(platform);
  const currentLimit = characterLimits[normalizedPlatform] || 280;
  const graphemeLength = getGraphemeLength(editedText);
  const remainingChars = currentLimit - graphemeLength;

  // Handle text changes
  const handleTextChange = useCallback((e) => {
    const newText = e.target.value;
    setEditedText(newText);
    setHasUnsavedChanges(newText !== roast);
    
    // Clear previous validation if text changed significantly (deterministic clearing)
    if (validation) {
      const originalLength = validation.metadata?.textLength || 0;
      const newGraphemeLength = getGraphemeLength(newText);
      const lengthDiff = Math.abs(newGraphemeLength - originalLength);
      
      // Clear validation if text length changed by more than 5 characters
      if (lengthDiff > 5) {
        setValidation(null);
        setError(null); // Clear errors when text changes
      }
    }
  }, [roast, validation, getGraphemeLength]);

  // Validate edited text with backend
  const validateText = useCallback(async () => {
    if (!editedText.trim() || !roastId) return;
    
    setIsValidating(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/roast/${roastId}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: editedText,
          platform: normalizedPlatform
        })
      });

      if (response.ok) {
        const data = await response.json();
        setValidation(data.data.validation);
        
        // Call external validation callback if provided
        if (onValidate) {
          onValidate(data.data.validation, data.data.credits);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 402) {
          setError({
            type: 'credits',
            message: errorData.error || 'Insufficient credits for validation',
            details: errorData.details
          });
        } else if (response.status === 401) {
          setError({
            type: 'auth',
            message: 'Authentication required'
          });
        } else if (response.status === 404) {
          setError({
            type: 'notfound',
            message: 'Roast not found or access denied'
          });
        } else if (response.status === 400) {
          setError({
            type: 'validation',
            message: errorData.error || 'Invalid request'
          });
        } else {
          setError({
            type: 'server',
            message: errorData.error || `Server error (${response.status})`
          });
        }
      }
    } catch (err) {
      console.error('Validation error:', err);
      setError({
        type: 'network',
        message: 'Network error. Please check your connection.'
      });
    } finally {
      setIsValidating(false);
    }
  }, [editedText, roastId, normalizedPlatform, onValidate]);

  // Handle save
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(editedText, validation);
    }
    setIsEditing(false);
    setHasUnsavedChanges(false);
    setValidation(null);
  }, [editedText, validation, onSave]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setEditedText(roast || '');
    setIsEditing(false);
    setHasUnsavedChanges(false);
    setValidation(null);
    setError(null);
    
    if (onCancel) {
      onCancel();
    }
  }, [roast, onCancel]);

  // Get validation status color
  const getValidationColor = useCallback(() => {
    if (!validation) return 'muted';
    return validation.valid ? 'success' : 'destructive';
  }, [validation]);

  // Get character count color
  const getCharCountColor = useCallback(() => {
    if (remainingChars < 0) return 'text-red-500';
    if (remainingChars < 20) return 'text-yellow-500';
    return 'text-muted-foreground';
  }, [remainingChars]);

  if (!isEditing) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>Roast Generado</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {normalizedPlatform}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-1"
              >
                <Edit3 className="h-4 w-4" />
                <span>Editar</span>
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm whitespace-pre-wrap">{roast}</p>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>{getGraphemeLength(roast)} caracteres</span>
            <span>Límite: {currentLimit}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center space-x-2">
            <Edit3 className="h-5 w-5 text-primary" />
            <span>Editor de Roast</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {normalizedPlatform}
            </Badge>
            {validation && (
              <Badge variant={getValidationColor()} className="text-xs">
                {validation.valid ? (
                  <><CheckCircle className="h-3 w-3 mr-1" />Válido</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1" />Inválido</>
                )}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Text Editor */}
        <div className="space-y-2">
          <Textarea
            value={editedText}
            onChange={handleTextChange}
            placeholder="Edita tu roast aquí..."
            className="min-h-24 resize-none"
            maxLength={currentLimit + 100} // Allow slight overflow for warning
            aria-label={`Editar contenido del roast para ${normalizedPlatform}`}
            aria-describedby="char-count validation-status validation-errors"
            aria-invalid={validation && !validation.valid ? 'true' : 'false'}
            aria-required="true"
          />
          
          {/* Character Counter */}
          <div className="flex items-center justify-between text-xs">
            <span id="char-count" className={getCharCountColor()}>
              {graphemeLength} / {currentLimit} caracteres
              {remainingChars < 0 && (
                <span className="text-red-500 ml-1">
                  (¡{Math.abs(remainingChars)} sobre el límite!)
                </span>
              )}
            </span>
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="text-xs">
                Cambios sin guardar
              </Badge>
            )}
          </div>
        </div>

        {/* Validation Errors */}
        {validation && !validation.valid && validation.errors.length > 0 && (
          <Alert variant="destructive" id="validation-errors" role="alert" aria-live="polite">
            <XCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Problemas encontrados:</p>
                <ul className="list-disc list-inside space-y-1">
                  {validation.errors.map((error, index) => (
                    <li key={index} className="text-sm">{error.message}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Validation Warnings */}
        {validation && validation.warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Advertencias:</p>
                <ul className="list-disc list-inside space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <li key={index} className="text-sm">{warning.message}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Error Messages */}
        {error && (
          <Alert variant="destructive" id="validation-status" role="alert">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">
                  {error.type === 'credits' && 'Sin Créditos'}
                  {error.type === 'auth' && 'Error de Autenticación'}
                  {error.type === 'notfound' && 'Roast No Encontrado'}
                  {error.type === 'validation' && 'Error de Validación'}
                  {error.type === 'server' && 'Error del Servidor'}
                  {error.type === 'network' && 'Error de Red'}
                </p>
                <p className="text-sm">{error.message}</p>
                {error.type === 'credits' && (
                  <div className="flex items-center space-x-1 mt-2 text-xs">
                    <CreditCard className="h-3 w-3" />
                    <span>La validación consume 1 crédito por uso</span>
                    {error.details && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({error.details.remaining}/{error.details.limit} créditos restantes)
                      </span>
                    )}
                  </div>
                )}
                {error.type === 'notfound' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Verifica que el roast te pertenece y que tienes permisos para editarlo.
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={validateText}
              disabled={isValidating || !editedText.trim() || !hasUnsavedChanges}
              className="flex items-center space-x-1"
            >
              <Eye className="h-4 w-4" />
              <span>{isValidating ? 'Validando...' : 'Validar'}</span>
              <Badge variant="secondary" className="text-xs ml-1">1 crédito</Badge>
            </Button>
            
            {validation && validation.valid && (
              <div className="flex items-center space-x-1 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>¡Listo para guardar!</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="flex items-center space-x-1"
            >
              <X className="h-4 w-4" />
              <span>Cancelar</span>
            </Button>
            
            <Button
              size="sm"
              onClick={handleSave}
              disabled={
                !hasUnsavedChanges || 
                remainingChars < 0 || 
                (validation && !validation.valid) ||
                (!validation && hasUnsavedChanges) // Require validation before save
              }
              className="flex items-center space-x-1"
              aria-label={
                validation && !validation.valid 
                  ? "No se puede guardar: corrije los errores de validación"
                  : !validation && hasUnsavedChanges
                  ? "Valida los cambios antes de guardar"
                  : "Guardar cambios"
              }
            >
              <Save className="h-4 w-4" />
              <span>Guardar</span>
            </Button>
          </div>
        </div>

        {/* Helper Text */}
        <div className="text-xs text-muted-foreground">
          <p>💡 <strong>Tip:</strong> Debes validar tus cambios antes de poder guardar. La validación asegura que cumplan con las reglas de estilo de Roastr.</p>
          {(!validation && hasUnsavedChanges) && (
            <p className="mt-1 text-amber-600">
              ⚠️ <strong>Validación requerida:</strong> Haz clic en "Validar" para habilitar el botón "Guardar".
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}