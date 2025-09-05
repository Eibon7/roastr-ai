import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Settings,
  User,
  Info,
  Eye,
  EyeOff,
  Save,
  Copy,
  Check,
  Sun,
  Moon,
  Monitor,
  Palette,
  Shield,
  AlertCircle,
  Clock,
  X
} from 'lucide-react';
import { apiClient } from '../lib/api';
import TransparencySettings from './TransparencySettings';
import SensitiveDataModal from './ui/SensitiveDataModal';
import { detectSensitiveData, generateWarningMessage, isClipboardClearingSupported, clearClipboard } from '../utils/sensitiveDataDetector';

const AjustesSettings = ({ user, onNotification }) => {
  // Roastr Persona state
  const [roastrPersona, setRoastrPersona] = useState({
    loQueMeDefine: '',
    loQueNoTolero: '',
    loQueMeDaIgual: '',
    isVisible: false,
    isIntoleranceVisible: false,
    isToleranceVisible: false,
    isLoading: true,
    isSaving: false,
    showForm: false,
    showIntoleranceForm: false,
    showToleranceForm: false
  });

  // Theme state
  const [themeSettings, setThemeSettings] = useState({
    theme: 'system',
    options: [],
    isLoading: true,
    isSaving: false
  });

  // Copy state for bio text
  const [copyState, setCopyState] = useState({
    copied: false,
    bioText: '',
    showSensitiveModal: false,
    pendingCopyData: null,
    showWarning: false,
    warningMessage: '',
    clearingClipboard: false
  });

  // Refs for timeout cleanup
  const warningTimeoutRef = useRef(null);
  const clipboardClearTimeoutRef = useRef(null);
  const copyStateTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup all timeouts on unmount
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      if (clipboardClearTimeoutRef.current) {
        clearTimeout(clipboardClearTimeoutRef.current);
      }
      if (copyStateTimeoutRef.current) {
        clearTimeout(copyStateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadAjustesData();
  }, []);

  const loadAjustesData = async () => {
    try {
      // Load Roastr Persona data
      try {
        const roastrPersonaResult = await apiClient.get('/user/roastr-persona');
        if (roastrPersonaResult?.data?.success) {
          setRoastrPersona(prev => ({
            ...prev,
            loQueMeDefine: roastrPersonaResult.data.data?.loQueMeDefine || '',
            loQueNoTolero: roastrPersonaResult.data.data?.loQueNoTolero || '',
            loQueMeDaIgual: roastrPersonaResult.data.data?.loQueMeDaIgual || '',
            isVisible: roastrPersonaResult.data.data?.isVisible || false,
            isIntoleranceVisible: roastrPersonaResult.data.data?.isIntoleranceVisible || false,
            isToleranceVisible: roastrPersonaResult.data.data?.isToleranceVisible || false,
            isLoading: false
          }));
        } else {
          // Handle success: false case
          setRoastrPersona(prev => ({
            ...prev,
            loQueMeDefine: '',
            loQueNoTolero: '',
            loQueMeDaIgual: '',
            isVisible: false,
            isIntoleranceVisible: false,
            isToleranceVisible: false,
            isLoading: false
          }));
        }
      } catch (roastrError) {
        console.error('Failed to load roastr persona:', roastrError);
        setRoastrPersona(prev => ({ ...prev, isLoading: false }));
      }

      // Load theme settings
      try {
        const themeResult = await apiClient.get('/user/settings/theme');
        if (themeResult?.data?.success) {
          setThemeSettings(prev => ({
            ...prev,
            theme: themeResult.data.data?.theme,
            options: themeResult.data.data?.options,
            isLoading: false
          }));
        } else {
          // Handle success: false case
          setThemeSettings(prev => ({
            ...prev,
            theme: 'system',
            options: [],
            isLoading: false
          }));
        }
      } catch (themeError) {
        console.error('Failed to load theme settings:', themeError);
        setThemeSettings(prev => ({ ...prev, isLoading: false }));
      }

      // Load transparency bio text
      try {
        const transparencyResult = await apiClient.get('/user/settings/transparency-mode');
        if (transparencyResult?.data?.success && transparencyResult.data.data?.bio_text) {
          setCopyState(prev => ({
            ...prev,
            bioText: transparencyResult.data.data.bio_text
          }));
        }
      } catch (transparencyError) {
        console.error('Failed to load transparency settings:', transparencyError);
        // Don't show notification for transparency error as it's not critical
        // The transparency section will handle its own error state
      }

    } catch (error) {
      console.error('Failed to load ajustes data:', error);
      onNotification?.('Error al cargar la configuración', 'error');
      setRoastrPersona(prev => ({ ...prev, isLoading: false }));
      setThemeSettings(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleRoastrPersonaSave = async (field, value, visibility) => {
    const trimmedValue = value.trim();

    try {
      setRoastrPersona(prev => ({ ...prev, isSaving: true }));

      const payload = {};
      if (field === 'identity') {
        payload.loQueMeDefine = trimmedValue || null;
        payload.isVisible = visibility;
      } else if (field === 'intolerance') {
        payload.loQueNoTolero = trimmedValue || null;
        payload.isIntoleranceVisible = visibility;
      } else if (field === 'tolerance') {
        payload.loQueMeDaIgual = trimmedValue || null;
        payload.isToleranceVisible = visibility;
      }

      const result = await apiClient.post('/user/roastr-persona', payload);

      if (result?.data?.success) {
        setRoastrPersona(prev => ({
          ...prev,
          [field === 'identity' ? 'loQueMeDefine' :
           field === 'intolerance' ? 'loQueNoTolero' : 'loQueMeDaIgual']: trimmedValue,
          [field === 'identity' ? 'isVisible' :
           field === 'intolerance' ? 'isIntoleranceVisible' : 'isToleranceVisible']: visibility,
          showForm: field === 'identity' ? false : prev.showForm,
          showIntoleranceForm: field === 'intolerance' ? false : prev.showIntoleranceForm,
          showToleranceForm: field === 'tolerance' ? false : prev.showToleranceForm,
          isSaving: false
        }));
        onNotification?.('Roastr Persona actualizada correctamente', 'success');
      } else {
        setRoastrPersona(prev => ({ ...prev, isSaving: false }));
        onNotification?.(result?.data?.error || 'Error al guardar Roastr Persona', 'error');
      }
    } catch (error) {
      console.error('Failed to save Roastr Persona:', error);
      onNotification?.('Error al guardar Roastr Persona', 'error');
      setRoastrPersona(prev => ({ ...prev, isSaving: false }));
    }
  };

  const handleThemeChange = async (newTheme) => {
    try {
      setThemeSettings(prev => ({ ...prev, isSaving: true }));

      const resp = await apiClient.patch('/user/settings/theme', { theme: newTheme });

      if (resp?.data?.success) {
        setThemeSettings(prev => ({
          ...prev,
          theme: newTheme,
          isSaving: false
        }));

        // Apply theme immediately to the UI
        applyThemeToUI(newTheme);

        onNotification?.('Tema actualizado correctamente', 'success');
      } else {
        onNotification?.(resp?.data?.error || 'Error al actualizar el tema', 'error');
        setThemeSettings(prev => ({ ...prev, isSaving: false }));
      }
    } catch (error) {
      console.error('Failed to update theme:', error);
      onNotification?.('Error al actualizar el tema', 'error');
      setThemeSettings(prev => ({ ...prev, isSaving: false }));
    }
  };

  const applyThemeToUI = (theme) => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;

    // Remove existing theme classes
    html.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark');

    if (theme === 'light') {
      html.classList.add('light');
      body.classList.add('light');
      html.style.colorScheme = 'light';
    } else if (theme === 'dark') {
      html.classList.add('dark');
      body.classList.add('dark');
      html.style.colorScheme = 'dark';
    } else if (theme === 'system') {
      const isDarkMode = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDarkMode) {
        html.classList.add('dark');
        body.classList.add('dark');
        html.style.colorScheme = 'dark';
      } else {
        html.classList.add('light');
        body.classList.add('light');
        html.style.colorScheme = 'light';
      }
    }
  };

  const handleCopyBioText = async () => {
    try {
      // Detect sensitive data in the bio text
      const detection = detectSensitiveData(copyState.bioText, {
        checkPersonaFlag: true,
        isPersonaSensitive: true, // Bio text is considered persona data
        strictMode: false
      });

      // If sensitive data is detected, show confirmation modal
      if (detection.isSensitive) {
        setCopyState(prev => ({
          ...prev,
          showSensitiveModal: true,
          pendingCopyData: {
            text: copyState.bioText,
            detection
          }
        }));
        return;
      }

      // If not sensitive, proceed with copy
      await performClipboardCopy(copyState.bioText, detection);
    } catch (error) {
      console.error('Failed to initiate copy operation:', error);
      onNotification?.('Error al iniciar la operación de copiado', 'error');
    }
  };

  const performClipboardCopy = async (textToCopy, detection) => {
    try {
      // Check if modern clipboard API is available and optionally check permissions
      if (navigator.clipboard && navigator.clipboard.writeText) {
        // Optionally check clipboard-write permission for clearer user messages
        if (navigator.permissions) {
          try {
            const permission = await navigator.permissions.query({ name: 'clipboard-write' });
            if (permission.state === 'denied') {
              onNotification?.('Permisos de portapapeles denegados. Intentando método alternativo…', 'warning');
              await performFallbackCopy(textToCopy, detection);
              return;
            }
          } catch (permError) {
            // Permission API not supported, continue with clipboard attempt
          }
        }

        await navigator.clipboard.writeText(textToCopy);
        handleSuccessfulCopy(detection);
      } else {
        // Fallback for older browsers with improved accessibility
        await performFallbackCopy(textToCopy, detection);
      }
    } catch (error) {
      console.error('Failed to copy bio text:', error);

      // Handle specific clipboard API errors
      if (error.name === 'NotAllowedError') {
        onNotification?.('Permisos de portapapeles denegados. Intenta copiar manualmente.', 'error');
      } else if (error.name === 'SecurityError') {
        onNotification?.('Error de seguridad al acceder al portapapeles. Intenta copiar manualmente.', 'error');
      } else if (error.name === 'AbortError') {
        onNotification?.('Operación de copiado cancelada.', 'error');
      } else {
        onNotification?.('Error al copiar el texto', 'error');
      }
    }
  };

  const performFallbackCopy = async (textToCopy, detection) => {
    const activeElement = document.activeElement;
    const selection = window.getSelection();
    const selectedRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    const textarea = document.createElement('textarea');
    textarea.value = textToCopy;
    textarea.readOnly = true;
    textarea.setAttribute('aria-hidden', 'true');
    textarea.setAttribute('tabindex', '-1');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';

    document.body.appendChild(textarea);

    try {
      textarea.select();
      const successful = document.execCommand('copy');
      if (successful) {
        handleSuccessfulCopy(detection);
        return true;
      } else {
        throw new Error('execCommand failed');
      }
    } catch (execError) {
      console.error('execCommand copy failed:', execError);
      onNotification?.('La función de copiar no está disponible en este navegador', 'error');
      return false;
    } finally {
      // Restore focus and selection
      document.body.removeChild(textarea);
      if (activeElement && activeElement.focus) {
        activeElement.focus();
      }
      if (selectedRange && selection) {
        selection.removeAllRanges();
        selection.addRange(selectedRange);
      }
    }
  };

  const handleSuccessfulCopy = (detection) => {
    setCopyState(prev => ({ ...prev, copied: true }));
    onNotification?.('Texto copiado al portapapeles', 'success');

    // Show warning if sensitive data was detected
    if (detection.isSensitive) {
      const warningMessage = generateWarningMessage(detection);
      setCopyState(prev => ({
        ...prev,
        showWarning: true,
        warningMessage
      }));

      // Auto-hide warning after 8 seconds
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      warningTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setCopyState(prev => ({ ...prev, showWarning: false, warningMessage: '' }));
        }
      }, 8000);

      // Offer clipboard clearing after 30 seconds if supported
      if (isClipboardClearingSupported()) {
        if (clipboardClearTimeoutRef.current) {
          clearTimeout(clipboardClearTimeoutRef.current);
        }
        clipboardClearTimeoutRef.current = setTimeout(async () => {
          if (isMountedRef.current) {
            setCopyState(prev => ({ ...prev, clearingClipboard: true }));
            try {
              await clearClipboard();
              if (isMountedRef.current) {
                setCopyState(prev => ({ ...prev, clearingClipboard: false }));
              }
            } catch (error) {
              console.error('Error clearing clipboard:', error);
              if (isMountedRef.current) {
                setCopyState(prev => ({ ...prev, clearingClipboard: false }));
              }
            }
          }
        }, 30000);
      }
    }

    // Reset copied state after 2 seconds
    if (copyStateTimeoutRef.current) {
      clearTimeout(copyStateTimeoutRef.current);
    }
    copyStateTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setCopyState(prev => ({ ...prev, copied: false }));
      }
    }, 2000);
  };

  const handleSensitiveModalConfirm = () => {
    if (copyState.pendingCopyData) {
      performClipboardCopy(
        copyState.pendingCopyData.text,
        copyState.pendingCopyData.detection
      );
    }
    setCopyState(prev => ({
      ...prev,
      showSensitiveModal: false,
      pendingCopyData: null
    }));
  };

  const handleSensitiveModalClose = () => {
    setCopyState(prev => ({
      ...prev,
      showSensitiveModal: false,
      pendingCopyData: null
    }));
  };

  const handleClearClipboard = async () => {
    try {
      const success = await clearClipboard();
      if (success) {
        onNotification?.('Portapapeles limpiado', 'success');
        setCopyState(prev => ({ ...prev, showWarning: false, warningMessage: '' }));
      } else {
        onNotification?.('No se pudo limpiar el portapapeles', 'error');
        // Only clear warnings on success - keep them visible if clearing failed
      }
    } catch (error) {
      console.error('Error clearing clipboard:', error);
      onNotification?.('No se pudo limpiar el portapapeles', 'error');
      // Keep warnings visible if clearing failed due to exception
    }
  };

  const getThemeIcon = (themeValue) => {
    switch (themeValue) {
      case 'light': return <Sun className="h-4 w-4" />;
      case 'dark': return <Moon className="h-4 w-4" />;
      case 'system': return <Monitor className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  if (roastrPersona.isLoading || themeSettings.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Ajustes</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
              role="status"
              aria-busy="true"
              aria-label="Cargando"
            ></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <span>Ajustes</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Roastr Persona Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <h4 className="text-md font-medium">Roastr Persona</h4>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p>
                  Define tu personalidad para roasts más precisos. Estos campos están cifrados 
                  y solo tú puedes verlos. Ayudan a personalizar las respuestas según tu identidad.
                </p>
              </div>
            </div>
          </div>

          {/* Lo que me define */}
          <RoastrPersonaField
            label="Lo que me define"
            placeholder="Ej: Soy desarrollador, me gusta el café, odio las reuniones innecesarias..."
            value={roastrPersona.loQueMeDefine}
            isVisible={roastrPersona.isVisible}
            showForm={roastrPersona.showForm}
            isSaving={roastrPersona.isSaving}
            onSave={(value, visibility) => handleRoastrPersonaSave('identity', value, visibility)}
            onToggleForm={() => setRoastrPersona(prev => ({ 
              ...prev, 
              showForm: !prev.showForm,
              showIntoleranceForm: false,
              showToleranceForm: false
            }))}
            maxLength={300}
          />

          {/* Lo que no tolero */}
          <RoastrPersonaField
            label="Lo que no tolero"
            placeholder="Ej: Comentarios sobre mi apariencia, bromas sobre mi familia..."
            value={roastrPersona.loQueNoTolero}
            isVisible={roastrPersona.isIntoleranceVisible}
            showForm={roastrPersona.showIntoleranceForm}
            isSaving={roastrPersona.isSaving}
            onSave={(value, visibility) => handleRoastrPersonaSave('intolerance', value, visibility)}
            onToggleForm={() => setRoastrPersona(prev => ({ 
              ...prev, 
              showIntoleranceForm: !prev.showIntoleranceForm,
              showForm: false,
              showToleranceForm: false
            }))}
            maxLength={300}
            variant="intolerance"
          />

          {/* Lo que me da igual */}
          <RoastrPersonaField
            label="Lo que me da igual"
            placeholder="Ej: Bromas sobre mi edad, comentarios sobre mis gustos musicales..."
            value={roastrPersona.loQueMeDaIgual}
            isVisible={roastrPersona.isToleranceVisible}
            showForm={roastrPersona.showToleranceForm}
            isSaving={roastrPersona.isSaving}
            onSave={(value, visibility) => handleRoastrPersonaSave('tolerance', value, visibility)}
            onToggleForm={() => setRoastrPersona(prev => ({ 
              ...prev, 
              showToleranceForm: !prev.showToleranceForm,
              showForm: false,
              showIntoleranceForm: false
            }))}
            maxLength={300}
            variant="tolerance"
          />
        </div>

        {/* Transparencia Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <h4 className="text-md font-medium">Transparencia</h4>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p>
                  Por cumplimiento de políticas, puedes elegir cómo identificar que algunas 
                  respuestas son generadas por IA. No es obligatorio, sino una opción de personalización.
                </p>
              </div>
            </div>
          </div>

          <TransparencySettings />

          {copyState.bioText && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Texto sugerido para tu bio</div>
                  <div className="text-sm text-gray-600 mt-1">
                    "{copyState.bioText}"
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {copyState.clearingClipboard && (
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1 animate-spin" />
                      Limpiando...
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyBioText}
                    disabled={copyState.copied || copyState.clearingClipboard}
                  >
                    {copyState.copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Warning message for sensitive data */}
              {copyState.showWarning && copyState.warningMessage && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-amber-800">
                        {copyState.warningMessage}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isClipboardClearingSupported() && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearClipboard}
                          className="text-xs h-6 px-2"
                        >
                          Limpiar portapapeles
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCopyState(prev => ({ ...prev, showWarning: false, warningMessage: '' }))}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Estilo de la interfaz Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Palette className="h-4 w-4" />
            <h4 className="text-md font-medium">Estilo de la interfaz</h4>
          </div>
          
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              Elige el tema de la interfaz que prefieras
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {themeSettings.options.map((option) => (
                <div
                  key={option.value}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    themeSettings.theme === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${themeSettings.isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !themeSettings.isSaving && handleThemeChange(option.value)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        themeSettings.theme === option.value
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                      }`}>
                        {themeSettings.theme === option.value && (
                          <div className="w-full h-full rounded-full bg-white scale-50"></div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        {getThemeIcon(option.value)}
                        <span className="font-medium">{option.label}</span>
                        {option.isDefault && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            Por defecto
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {option.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Sensitive Data Confirmation Modal */}
    <SensitiveDataModal
      isOpen={copyState.showSensitiveModal}
      onClose={handleSensitiveModalClose}
      onConfirm={handleSensitiveModalConfirm}
      detection={copyState.pendingCopyData?.detection}
      textPreview={copyState.pendingCopyData?.text}
    />
    </>
  );
};

// Component for Roastr Persona fields
const RoastrPersonaField = ({ 
  label, 
  placeholder, 
  value, 
  isVisible, 
  showForm, 
  isSaving, 
  onSave, 
  onToggleForm, 
  maxLength,
  variant = 'default'
}) => {
  const [fieldValue, setFieldValue] = useState(value);
  const [fieldVisibility, setFieldVisibility] = useState(isVisible);

  useEffect(() => {
    setFieldValue(value);
    setFieldVisibility(isVisible);
  }, [value, isVisible]);

  const handleSave = () => {
    onSave(fieldValue, fieldVisibility);
  };

  // CodeRabbit: Check if there are actual changes to prevent unnecessary saves
  const hasChanges = fieldValue !== value || fieldVisibility !== isVisible;

  const getVariantColor = () => {
    switch (variant) {
      case 'intolerance': return 'text-red-600';
      case 'tolerance': return 'text-green-600';
      default: return 'text-blue-600';
    }
  };

  const getVariantIcon = () => {
    switch (variant) {
      case 'intolerance': return <AlertCircle className="h-4 w-4" />;
      case 'tolerance': return <Check className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`flex items-center space-x-2 ${getVariantColor()}`}>
          {getVariantIcon()}
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex items-center space-x-2">
          {value && (
            <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
              Configurado
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleForm}
            disabled={isSaving}
          >
            {showForm ? 'Cancelar' : (value ? 'Editar' : 'Configurar')}
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="space-y-3">
          <Textarea
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className="min-h-[100px]"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFieldVisibility(!fieldVisibility)}
                disabled={isSaving}
              >
                {fieldVisibility ? (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Visible
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Privado
                  </>
                )}
              </Button>
              <span className="text-xs text-gray-500">
                {fieldValue.length}/{maxLength}
              </span>
            </div>
            <Button
              onClick={handleSave}
              disabled={
                isSaving ||
                (((fieldValue ?? '').trim() === (value ?? '').trim()) &&
                 fieldVisibility === isVisible)
              }
              size="sm"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {!showForm && value && (
        <div className="text-sm text-gray-600 bg-gray-50 rounded p-3">
          {value}
        </div>
      )}
    </div>
  );
};

export default AjustesSettings;
