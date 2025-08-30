import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Settings as SettingsIcon, User, Shield, Bell, Palette, Save, Mail, Download, AlertTriangle, CheckCircle, XCircle, Circle, Check, X, Heart, Eye, EyeOff } from 'lucide-react';
import { apiClient } from '../lib/api';
import { authHelpers } from '../lib/supabaseClient';
import EnhancedPasswordInput from '../components/EnhancedPasswordInput';
import AjustesSettings from '../components/AjustesSettings';
import TransparencySettings from '../components/TransparencySettings';
import { validatePassword, getPasswordStrength, getPasswordStrengthLabel, getPasswordStrengthColor } from '../utils/passwordValidator';

// Password requirement component for visual feedback (legacy support)
const PasswordRequirement = ({ met, text }) => (
  <div className="flex items-center space-x-2">
    {met ? (
      <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
    ) : (
      <Circle className="w-3 h-3 text-gray-400 flex-shrink-0" />
    )}
    <span className={`text-xs ${met ? 'text-green-600' : 'text-gray-500'}`}>
      {text}
    </span>
  </div>
);

export default function Settings() {
  const [settings, setSettings] = useState({
    roastTone: 'balanced',
    responseFrequency: 'normal',
    toxicityThreshold: 'medium',
    notifications: {
      email: true,
      mentions: true,
      responses: false,
      billing: true
    },
    shieldEnabled: true,
    darkMode: false
  });
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Account management state
  const [emailForm, setEmailForm] = useState({
    currentEmail: '',
    newEmail: '',
    isSubmitting: false,
    showForm: false
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    isSubmitting: false,
    showForm: false,
    validation: {
      isValid: false,
      errors: [],
      strength: 0
    }
  });
  const [notifications, setNotifications] = useState([]);

  // Password reset state (Issue #258)
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);

  // Data export state (Issue #258)
  const [showDataExportModal, setShowDataExportModal] = useState(false);
  const [dataExportLoading, setDataExportLoading] = useState(false);

  // Data export rate limiting state
  const [lastDataExportAttempt, setLastDataExportAttempt] = useState(0);
  const DATA_EXPORT_COOLDOWN_MS = 300000; // 5 minutes

  // Password reset rate limiting state
  const [lastPasswordResetAttempt, setLastPasswordResetAttempt] = useState(0);
  const RESET_COOLDOWN_MS = 60000; // 60 seconds

  // Roastr Persona state
  const [roastrPersona, setRoastrPersona] = useState({
    loQueMeDefine: '',
    isVisible: false,
    hasContent: false,
    isLoading: true,
    isSaving: false,
    showForm: false,
    // Intolerance fields
    loQueNoTolero: '',
    isIntoleranceVisible: false,
    hasIntoleranceContent: false,
    showIntoleranceForm: false,
    // Tolerance fields (lo que me da igual)
    loQueMeDaIgual: '',
    isToleranceVisible: false,
    hasToleranceContent: false,
    showToleranceForm: false
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const session = await authHelpers.getCurrentSession();
        if (session?.access_token) {
          const userData = await authHelpers.getUserFromAPI(session.access_token);
          setUser(userData);
          
          setEmailForm(prev => ({
            ...prev,
            currentEmail: userData.email || ''
          }));
        } else {
          throw new Error('No valid session found');
        }
        
        // In real implementation, load user settings from API
        
        // Load Roastr Persona data
        try {
          const roastrPersonaResult = await apiClient.get('/user/roastr-persona');
          if (roastrPersonaResult.success) {
            setRoastrPersona(prev => ({
              ...prev,
              loQueMeDefine: roastrPersonaResult.data.loQueMeDefine || '',
              isVisible: roastrPersonaResult.data.isVisible || false,
              hasContent: roastrPersonaResult.data.hasContent || false,
              // Intolerance fields
              loQueNoTolero: roastrPersonaResult.data.loQueNoTolero || '',
              isIntoleranceVisible: roastrPersonaResult.data.isIntoleranceVisible || false,
              hasIntoleranceContent: roastrPersonaResult.data.hasIntoleranceContent || false,
              // Tolerance fields (lo que me da igual)
              loQueMeDaIgual: roastrPersonaResult.data.loQueMeDaIgual || '',
              isToleranceVisible: roastrPersonaResult.data.isToleranceVisible || false,
              hasToleranceContent: roastrPersonaResult.data.hasToleranceContent || false,
              isLoading: false
            }));
          }
        } catch (roastrPersonaError) {
          console.error('Failed to load Roastr Persona:', roastrPersonaError);
          setRoastrPersona(prev => ({ ...prev, isLoading: false }));
        }

        // Initialize rate limiting state from localStorage
        const storedDataExportAttempt = localStorage.getItem('lastDataExportAttempt');
        if (storedDataExportAttempt) {
          setLastDataExportAttempt(parseInt(storedDataExportAttempt, 10));
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        addNotification('Error al cargar datos del usuario', 'error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // In real implementation, save settings to API
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Settings saved:', settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (path, value) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      
      return newSettings;
    });
  };

  // Notification management
  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    const notification = { id, message, type };
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Email change handling
  const handleEmailChange = async (e) => {
    e.preventDefault();
    
    if (!emailForm.newEmail || emailForm.newEmail === emailForm.currentEmail) {
      addNotification('Introduce un email diferente al actual', 'error');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailForm.newEmail)) {
      addNotification('Formato de email inválido', 'error');
      return;
    }

    try {
      setEmailForm(prev => ({ ...prev, isSubmitting: true }));
      
      const result = await apiClient.post('/auth/change-email', {
        currentEmail: emailForm.currentEmail,
        newEmail: emailForm.newEmail
      });

      if (result.success) {
        addNotification(result.message, 'success');
        setEmailForm(prev => ({
          ...prev,
          showForm: false,
          newEmail: ''
        }));
      } else {
        addNotification(result.error || 'Error al cambiar email', 'error');
      }
      
    } catch (error) {
      console.error('Email change error:', error);
      addNotification(error.message || 'Error al cambiar email', 'error');
    } finally {
      setEmailForm(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Enhanced password validation (Issue #133) - Using centralized validator
  const validatePasswordStrength = (password) => {
    const validation = validatePassword(password);
    if (!validation.isValid) {
      return { valid: false, message: validation.errors.join('. ') };
    }
    return { valid: true };
  };

  // Get password criteria status based on centralized validation
  const getPasswordCriteria = (password) => {
    return {
      length: password.length >= 8,
      noSpaces: !/\s/.test(password) || password.length === 0,
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      uppercaseOrSpecial: /[A-Z]/.test(password) || /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
      different: password !== passwordForm.currentPassword && password.length > 0
    };
  };

  // Validate password in real-time (legacy support with new validation)
  const validateNewPassword = (password) => {
    const validation = validatePassword(password);
    const strength = getPasswordStrength(password);
    
    setPasswordForm(prev => ({
      ...prev,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        strength: strength
      }
    }));
    
    return validation;
  };

  // Password change handling with enhanced validation (Issue #89 + #133)
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      addNotification('Todos los campos de contraseña son obligatorios', 'error');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addNotification('Las nuevas contraseñas no coinciden', 'error');
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      addNotification('La nueva contraseña debe ser diferente a la actual', 'error');
      return;
    }

    // Enhanced password strength validation
    const validation = validatePasswordStrength(passwordForm.newPassword);
    if (!validation.valid) {
      addNotification(validation.message, 'error');
      return;
    }

    try {
      setPasswordForm(prev => ({ ...prev, isSubmitting: true }));
      
      const result = await apiClient.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      if (result.success) {
        addNotification('Contraseña cambiada exitosamente. Por favor usa tu nueva contraseña en futuros inicios de sesión.', 'success');
        setPasswordForm(prev => ({
          ...prev,
          showForm: false,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
      } else {
        // Check if this is a rate limit error (Issue #133)
        if (result.code === 'PASSWORD_CHANGE_RATE_LIMITED') {
          addNotification(
            `Por seguridad, los cambios de contraseña están temporalmente bloqueados. Por favor intenta nuevamente en ${result.retryAfter || 60} minutos.`,
            'error'
          );
        } else if (result.code === 'PASSWORD_RECENTLY_USED') {
          addNotification(
            'No puedes reutilizar una contraseña reciente. Por favor elige una contraseña diferente.',
            'error'
          );
        } else {
          addNotification(result.error || 'Error al cambiar contraseña', 'error');
        }
      }
      
    } catch (error) {
      console.error('Password change error:', error);
      // Check for rate limit error in catch block
      if (error.response?.status === 429) {
        const retryAfter = error.response?.data?.retryAfter || 60;
        addNotification(
          `Has alcanzado el límite de intentos de cambio de contraseña. Por favor espera ${retryAfter} minutos antes de intentar nuevamente.`,
          'error'
        );
      } else {
        addNotification(error.message || 'Error al cambiar contraseña', 'error');
      }
    } finally {
      setPasswordForm(prev => ({ ...prev, isSubmitting: false }));
    }
  };



  // Password reset handling (Issue #258)
  const handlePasswordReset = async () => {
    // Check rate limiting first
    const now = Date.now();
    if (now - lastPasswordResetAttempt < RESET_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((RESET_COOLDOWN_MS - (now - lastPasswordResetAttempt)) / 1000);
      addNotification(`Por favor espera ${remainingSeconds} segundos antes de solicitar otro enlace de cambio de contraseña`, 'warning');
      return;
    }

    // Guard: Verify user and email exist before making API call
    if (!user || !user.email) {
      addNotification('No se pudo obtener tu dirección de email. Por favor, recarga la página e inténtalo de nuevo.', 'error');
      return;
    }

    try {
      setPasswordResetLoading(true);

      const result = await apiClient.post('/auth/reset-password', {
        email: user.email
      });

      if (result.success) {
        // Only set cooldown after successful API request
        setLastPasswordResetAttempt(now);
        addNotification('Se ha enviado un enlace de cambio de contraseña a tu email', 'success');
      } else {
        throw new Error(result.error || 'Error al enviar el enlace de cambio de contraseña');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      addNotification('Error al enviar el enlace de cambio de contraseña', 'error');
    } finally {
      setPasswordResetLoading(false);
    }
  };

  // Data export request handling (Issue #258)
  const handleDataExportRequest = async () => {
    // Check client-side rate limiting
    const now = Date.now();
    const timeSinceLastAttempt = now - lastDataExportAttempt;

    if (timeSinceLastAttempt < DATA_EXPORT_COOLDOWN_MS) {
      const remainingTime = Math.ceil((DATA_EXPORT_COOLDOWN_MS - timeSinceLastAttempt) / 60000);
      addNotification(`Debes esperar ${remainingTime} minuto(s) antes de solicitar otra exportación`, 'warning');
      return;
    }

    try {
      setDataExportLoading(true);
      setLastDataExportAttempt(now);

      // Store timestamp in localStorage for persistence
      localStorage.setItem('lastDataExportAttempt', now.toString());

      const result = await apiClient.post('/user/data-export');

      if (result.success) {
        addNotification('Se ha enviado un enlace de descarga a tu email', 'success');
        setShowDataExportModal(false);
      } else {
        throw new Error(result.error || 'Error al solicitar la exportación de datos');
      }
    } catch (error) {
      console.error('Data export request error:', error);

      // Handle rate limiting response from server
      if (error.response?.status === 429) {
        addNotification('Has alcanzado el límite de solicitudes. Inténtalo más tarde.', 'warning');
      } else {
        addNotification('Error al solicitar la exportación de datos', 'error');
      }
    } finally {
      setDataExportLoading(false);
    }
  };

  // Roastr Persona handlers
  const handleSaveRoastrPersona = async (fieldType = 'identity') => {
    const isIdentity = fieldType === 'identity';
    const isIntolerance = fieldType === 'intolerance';
    const isTolerance = fieldType === 'tolerance';
    
    let text;
    if (isIdentity) {
      text = roastrPersona.loQueMeDefine;
    } else if (isIntolerance) {
      text = roastrPersona.loQueNoTolero;
    } else if (isTolerance) {
      text = roastrPersona.loQueMeDaIgual;
    }
    
    if (text.length > 300) {
      addNotification('El texto no puede exceder los 300 caracteres', 'error');
      return;
    }

    try {
      setRoastrPersona(prev => ({ ...prev, isSaving: true }));
      
      const payload = {};
      if (isIdentity) {
        payload.loQueMeDefine = text.trim() || null;
        payload.isVisible = roastrPersona.isVisible;
      } else if (isIntolerance) {
        payload.loQueNoTolero = text.trim() || null;
        payload.isIntoleranceVisible = roastrPersona.isIntoleranceVisible;
      } else if (isTolerance) {
        payload.loQueMeDaIgual = text.trim() || null;
        payload.isToleranceVisible = roastrPersona.isToleranceVisible;
      }
      
      const result = await apiClient.post('/user/roastr-persona', payload);

      if (result.success) {
        setRoastrPersona(prev => ({
          ...prev,
          hasContent: !!result.data.hasContent,
          hasIntoleranceContent: !!result.data.hasIntoleranceContent,
          hasToleranceContent: !!result.data.hasToleranceContent,
          showForm: isIdentity ? false : prev.showForm,
          showIntoleranceForm: isIntolerance ? false : prev.showIntoleranceForm,
          showToleranceForm: isTolerance ? false : prev.showToleranceForm
        }));
        
        let successMessage;
        if (isIdentity) {
          successMessage = 'Definición personal actualizada correctamente';
        } else if (isIntolerance) {
          successMessage = 'Preferencias de contenido actualizadas correctamente';
        } else if (isTolerance) {
          successMessage = 'Tolerancias personales actualizadas correctamente';
        }
        
        addNotification(successMessage, 'success');
      } else {
        // Check if the error is due to security rejection
        const errorMessage = result.error || 'Error al guardar Roastr Persona';
        const isSecurityRejection = result.rejectedForSecurity === true;
        
        addNotification(errorMessage, 'error');
        
        // If it's a security rejection, also clear the field to prevent confusion
        if (isSecurityRejection) {
          if (isIdentity) {
            setRoastrPersona(prev => ({ ...prev, loQueMeDefine: '' }));
          } else if (isIntolerance) {
            setRoastrPersona(prev => ({ ...prev, loQueNoTolero: '' }));
          } else if (isTolerance) {
            setRoastrPersona(prev => ({ ...prev, loQueMeDaIgual: '' }));
          }
        }
      }
      
    } catch (error) {
      console.error('Roastr Persona save error:', error);
      const errorMessage = error.message || 'Error al guardar Roastr Persona';
      
      // Check if it's a security-related error from the response
      if (error.response?.data?.rejectedForSecurity) {
        const securityMessage = error.response.data.error || errorMessage;
        addNotification(securityMessage, 'error');
        
        // Clear the field that was rejected
        if (isIdentity) {
          setRoastrPersona(prev => ({ ...prev, loQueMeDefine: '' }));
        } else if (isIntolerance) {
          setRoastrPersona(prev => ({ ...prev, loQueNoTolero: '' }));
        } else if (isTolerance) {
          setRoastrPersona(prev => ({ ...prev, loQueMeDaIgual: '' }));
        }
      } else {
        addNotification(errorMessage, 'error');
      }
    } finally {
      setRoastrPersona(prev => ({ ...prev, isSaving: false }));
    }
  };

  const handleDeleteRoastrPersona = async (fieldType = 'all') => {
    const confirmMessages = {
      'identity': '¿Estás seguro de que quieres eliminar tu definición personal? Esta acción no se puede deshacer.',
      'intolerance': '¿Estás seguro de que quieres eliminar tus preferencias de contenido? Esta acción no se puede deshacer.',
      'tolerance': '¿Estás seguro de que quieres eliminar tus tolerancias personales? Esta acción no se puede deshacer.',
      'all': '¿Estás seguro de que quieres eliminar completamente tu Roastr Persona? Esta acción no se puede deshacer.'
    };

    if (!window.confirm(confirmMessages[fieldType])) {
      return;
    }

    try {
      setRoastrPersona(prev => ({ ...prev, isSaving: true }));
      
      const result = await apiClient.delete(`/user/roastr-persona?field=${fieldType}`);

      if (result.success) {
        setRoastrPersona(prev => {
          const updates = { ...prev };
          
          if (fieldType === 'identity' || fieldType === 'all') {
            updates.loQueMeDefine = '';
            updates.isVisible = false;
            updates.hasContent = false;
            updates.showForm = false;
          }
          
          if (fieldType === 'intolerance' || fieldType === 'all') {
            updates.loQueNoTolero = '';
            updates.isIntoleranceVisible = false;
            updates.hasIntoleranceContent = false;
            updates.showIntoleranceForm = false;
          }
          
          if (fieldType === 'tolerance' || fieldType === 'all') {
            updates.loQueMeDaIgual = '';
            updates.isToleranceVisible = false;
            updates.hasToleranceContent = false;
            updates.showToleranceForm = false;
          }
          
          return updates;
        });
        
        const successMessages = {
          'identity': 'Definición personal eliminada',
          'intolerance': 'Preferencias de contenido eliminadas',
          'tolerance': 'Tolerancias personales eliminadas',
          'all': 'Roastr Persona eliminada completamente'
        };
        
        addNotification(successMessages[fieldType], 'success');
      } else {
        addNotification(result.error || 'Error al eliminar Roastr Persona', 'error');
      }
      
    } catch (error) {
      console.error('Roastr Persona delete error:', error);
      addNotification(error.message || 'Error al eliminar Roastr Persona', 'error');
    } finally {
      setRoastrPersona(prev => ({ ...prev, isSaving: false }));
    }
  };

  // Account deletion component
  const AccountDeletionButton = ({ user, onDeleteRequested, onError }) => {
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmEmail, setConfirmEmail] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    
    const handleDeleteRequest = async () => {
      if (!confirmEmail || confirmEmail !== user?.email) {
        onError('Debes introducir tu email para confirmar la eliminación');
        return;
      }

      try {
        setIsDeleting(true);
        
        const result = await apiClient.post('/auth/delete-account', {
          confirmEmail: confirmEmail
        });

        if (result.success) {
          onDeleteRequested(result.message);
          setShowConfirmDialog(false);
          setConfirmEmail('');
          
          // Refresh user data to show deletion status
          const session = await authHelpers.getCurrentSession();
          if (session?.access_token) {
            const userData = await authHelpers.getUserFromAPI(session.access_token);
            setUser(userData);
          }
        } else {
          onError(result.error || 'Error al programar eliminación de cuenta');
        }
      } catch (error) {
        onError(error.message || 'Error al programar eliminación de cuenta');
      } finally {
        setIsDeleting(false);
      }
    };

    const handleCancelDeletion = async () => {
      try {
        setIsDeleting(true);
        
        const result = await apiClient.post('/auth/cancel-account-deletion');

        if (result.success) {
          addNotification(result.message, 'success');
          
          // Refresh user data
          const session = await authHelpers.getCurrentSession();
          if (session?.access_token) {
            const userData = await authHelpers.getUserFromAPI(session.access_token);
            setUser(userData);
          }
        } else {
          onError(result.error || 'Error al cancelar eliminación');
        }
      } catch (error) {
        onError(error.message || 'Error al cancelar eliminación');
      } finally {
        setIsDeleting(false);
      }
    };

    // Check if account deletion is already scheduled
    const isDeletionScheduled = user?.deletion_scheduled_at;
    const deletionDate = isDeletionScheduled ? new Date(user.deletion_scheduled_at) : null;
    const isGracePeriodActive = deletionDate && deletionDate.getTime() > Date.now();

    if (isDeletionScheduled && isGracePeriodActive) {
      const daysRemaining = Math.ceil((deletionDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      
      return (
        <div className="space-y-3">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex">
              <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 mr-3" />
              <div>
                <div className="font-medium text-orange-800">Eliminación programada</div>
                <div className="text-sm text-orange-700 mt-1">
                  Tu cuenta se eliminará automáticamente en <strong>{daysRemaining} días</strong> 
                  ({deletionDate.toLocaleDateString('es-ES')}).
                </div>
              </div>
            </div>
          </div>
          <Button 
            variant="outline"
            size="sm" 
            onClick={handleCancelDeletion}
            disabled={isDeleting}
          >
            {isDeleting ? 'Cancelando...' : 'Cancelar eliminación'}
          </Button>
        </div>
      );
    }

    return (
      <>
        <Button 
          variant="destructive" 
          size="sm"
          onClick={() => setShowConfirmDialog(true)}
        >
          Delete Account
        </Button>

        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Confirmar eliminación de cuenta
              </h3>
              
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex">
                    <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 mr-3" />
                    <div>
                      <div className="text-sm text-red-800">
                        Esta acción programará la eliminación de tu cuenta en 30 días. 
                        Durante este período podrás cancelar la eliminación.
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Para confirmar, escribe tu email: <strong>{user?.email}</strong>
                  </label>
                  <Input
                    type="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder={user?.email}
                    className="w-full"
                  />
                </div>

                <div className="flex space-x-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowConfirmDialog(false);
                      setConfirmEmail('');
                    }}
                    disabled={isDeleting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteRequest}
                    disabled={isDeleting || confirmEmail !== user?.email}
                  >
                    {isDeleting ? 'Programando...' : 'Programar eliminación'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 ${
              notification.type === 'success' 
                ? 'bg-green-100 text-green-800 border-green-200' 
                : notification.type === 'error'
                ? 'bg-red-100 text-red-800 border-red-200'
                : 'bg-blue-100 text-blue-800 border-blue-200'
            } border`}
          >
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium">{notification.message}</p>
              <button
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                className="ml-2 text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Customize your roast bot behavior and preferences
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Profile</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              {emailForm.showForm ? (
                <form onSubmit={handleEmailChange} className="space-y-3">
                  <Input 
                    type="email" 
                    value={emailForm.currentEmail} 
                    disabled
                    className="bg-muted"
                  />
                  <Input
                    type="email"
                    value={emailForm.newEmail}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, newEmail: e.target.value }))}
                    placeholder="nuevo@email.com"
                    required
                  />
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex">
                      <Mail className="w-4 h-4 text-blue-400 mt-0.5 mr-2" />
                      <p className="text-xs text-blue-800">
                        Recibirás un email de confirmación en tu nueva dirección para completar el cambio.
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      type="submit" 
                      size="sm" 
                      disabled={emailForm.isSubmitting || !emailForm.newEmail}
                    >
                      {emailForm.isSubmitting ? 'Enviando...' : 'Cambiar email'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setEmailForm(prev => ({ ...prev, showForm: false, newEmail: '' }));
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <div>
                  <Input 
                    type="email" 
                    value={user?.email || ''} 
                    disabled
                    className="bg-muted mb-2"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {user?.email_confirmed ? (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                          <span className="text-xs text-green-600">Verificado</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2" />
                          <span className="text-xs text-yellow-600">Pendiente de verificación</span>
                        </>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEmailForm(prev => ({ ...prev, showForm: true }))}
                    >
                      Cambiar
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Plan</label>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="capitalize">
                  {user?.plan || 'free'}
                </Badge>
                <Button variant="link" size="sm">
                  Upgrade Plan
                </Button>
              </div>
            </div>
          </div>

          {/* Password Change Section - Issue #258 */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium mb-2">Contraseña</label>
            <div>
              <Input
                type="password"
                value="••••••••••••"
                disabled
                className="bg-muted mb-2"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handlePasswordReset}
                disabled={passwordResetLoading}
              >
                {passwordResetLoading ? 'Enviando...' : 'Cambiar contraseña'}
              </Button>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                <div className="flex">
                  <Mail className="w-4 h-4 text-blue-400 mt-0.5 mr-2" />
                  <p className="text-xs text-blue-800">
                    Al hacer clic en "Cambiar contraseña", recibirás un email con un enlace seguro para restablecer tu contraseña.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Data Export Section - Issue #258 */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium mb-2">Descargar mis datos</label>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Descarga una copia de todos tus datos personales almacenados en Roastr (cumplimiento RGPD).
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDataExportModal(true)}
                className="flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Solicitar descarga</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Transparency Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="h-5 w-5" />
            <span>Transparencia de IA</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-800 mb-2">
              <strong>¿Por qué es necesario?</strong>
            </div>
            <div className="text-sm text-blue-700">
              Por cumplimiento de las políticas de OpenAI y redes sociales, necesitamos identificar que algunas respuestas son generadas por IA.
              Elige la opción que mejor se adapte a tu estilo.
            </div>
          </div>
          
          <TransparencySettings />
        </CardContent>
      </Card>

      {/* Roastr Persona */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Heart className="h-5 w-5" />
            <span>Roastr Persona - Lo que me define</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-800 mb-2">
              <strong>¿Qué es esto?</strong>
            </div>
            <div className="text-sm text-blue-700">
              Define aspectos esenciales de tu identidad (ej: "mujer trans", "vegano", "gamer", "político de izquierdas") 
              para que Roastr pueda personalizar la detección de comentarios ofensivos dirigidos específicamente hacia ti.
            </div>
          </div>

          {roastrPersona.isLoading ? (
            <div className="text-center py-4">
              <div className="text-muted-foreground">Cargando...</div>
            </div>
          ) : (
            <>
              {roastrPersona.showForm ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Lo que me define (máx. 300 caracteres)
                    </label>
                    <textarea
                      value={roastrPersona.loQueMeDefine}
                      onChange={(e) => setRoastrPersona(prev => ({ ...prev, loQueMeDefine: e.target.value }))}
                      placeholder="Escribe temas o aspectos que forman parte de quién eres (ej: mujer trans, vegano, gamer, político de izquierdas)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={4}
                      maxLength={300}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <div className="text-xs text-muted-foreground">
                        {roastrPersona.loQueMeDefine.length}/300 caracteres
                      </div>
                      <div className={`text-xs ${roastrPersona.loQueMeDefine.length > 300 ? 'text-red-500' : 'text-green-500'}`}>
                        {roastrPersona.loQueMeDefine.length <= 300 ? '✓' : '⚠ Excede el límite'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="flex items-center">
                        <EyeOff className="w-4 h-4 text-orange-500 mr-2" />
                      </div>
                      <div className="text-sm text-orange-800">
                        <div className="font-medium mb-1">Privacidad garantizada</div>
                        <div>
                          • Esta información nunca se muestra públicamente<br/>
                          • Solo se usa para mejorar la detección de ataques personales<br/>
                          • Se almacena de forma cifrada en nuestra base de datos<br/>
                          • Puedes eliminarla en cualquier momento
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <Button 
                      onClick={() => handleSaveRoastrPersona('identity')}
                      disabled={roastrPersona.isSaving || roastrPersona.loQueMeDefine.length > 300}
                      size="sm"
                    >
                      {roastrPersona.isSaving ? 'Guardando...' : 'Guardar'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setRoastrPersona(prev => ({ ...prev, showForm: false }))}
                      disabled={roastrPersona.isSaving}
                    >
                      Cancelar
                    </Button>
                    {roastrPersona.hasContent && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteRoastrPersona('identity')}
                        disabled={roastrPersona.isSaving}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {roastrPersona.hasContent ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                        <div>
                          <div className="font-medium text-green-800">Definición personal configurada</div>
                          <div className="text-sm text-green-700 mt-1">
                            Has definido aspectos de tu identidad para una detección más personalizada.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <Circle className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <div className="font-medium text-gray-800">Sin definición personal</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Configura tu identidad para mejorar la detección de ataques personales.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setRoastrPersona(prev => ({ ...prev, showForm: true }))}
                    >
                      {roastrPersona.hasContent ? 'Editar' : 'Configurar'}
                    </Button>
                    {roastrPersona.hasContent && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteRoastrPersona('identity')}
                        disabled={roastrPersona.isSaving}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Roastr Persona - Lo que no tolero */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-red-500" />
            <span>Roastr Persona - Lo que no tolero</span>
            <Badge variant="outline" className="text-red-600 border-red-200">Bloqueo Automático</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-800 mb-2">
              <strong>🚫 Protección automática</strong>
            </div>
            <div className="text-sm text-red-700">
              Define palabras, temas o ataques que nunca quieres ver en tus comentarios. 
              Cualquier comentario que coincida con estos términos será <strong>bloqueado automáticamente</strong> 
              sin pasar por el sistema de roasts.
            </div>
          </div>

          {roastrPersona.isLoading ? (
            <div className="text-center py-4">
              <div className="text-muted-foreground">Cargando...</div>
            </div>
          ) : (
            <>
              {roastrPersona.showIntoleranceForm ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Lo que no tolero (máx. 300 caracteres)
                    </label>
                    <textarea
                      value={roastrPersona.loQueNoTolero}
                      onChange={(e) => setRoastrPersona(prev => ({ ...prev, loQueNoTolero: e.target.value }))}
                      placeholder="Escribe palabras, temas o ataques que nunca quieres ver (ej: insultos raciales, comentarios sobre peso, odio hacia veganos)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                      rows={4}
                      maxLength={300}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <div className="text-xs text-muted-foreground">
                        {roastrPersona.loQueNoTolero.length}/300 caracteres
                      </div>
                      <div className={`text-xs ${roastrPersona.loQueNoTolero.length > 300 ? 'text-red-500' : 'text-green-500'}`}>
                        {roastrPersona.loQueNoTolero.length <= 300 ? '✓' : '⚠ Excede el límite'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="flex items-center">
                        <EyeOff className="w-4 h-4 text-orange-500 mr-2" />
                      </div>
                      <div className="text-sm text-orange-800">
                        <div className="font-medium mb-1">Máxima privacidad y seguridad</div>
                        <div>
                          • Esta información nunca se muestra públicamente<br/>
                          • Se usa para bloqueo automático e inmediato de contenido<br/>
                          • Se almacena de forma cifrada en nuestra base de datos<br/>
                          • Los comentarios coincidentes nunca llegan a tu bandeja<br/>
                          • Puedes eliminarla en cualquier momento
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="flex items-center">
                        <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
                      </div>
                      <div className="text-sm text-red-800">
                        <div className="font-medium mb-1">🛡️ Funcionamiento del bloqueo automático</div>
                        <div>
                          • Los comentarios se analizan <strong>antes</strong> de cualquier procesamiento<br/>
                          • Las coincidencias activan bloqueo inmediato (prioridad máxima)<br/>
                          • No se generan roasts para contenido bloqueado<br/>
                          • Sistema más potente que Shield (actúa primero)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <Button 
                      onClick={() => handleSaveRoastrPersona('intolerance')}
                      disabled={roastrPersona.isSaving || roastrPersona.loQueNoTolero.length > 300}
                      size="sm"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {roastrPersona.isSaving ? 'Guardando...' : 'Guardar Protección'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setRoastrPersona(prev => ({ ...prev, showIntoleranceForm: false }))}
                      disabled={roastrPersona.isSaving}
                    >
                      Cancelar
                    </Button>
                    {roastrPersona.hasIntoleranceContent && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteRoastrPersona('intolerance')}
                        disabled={roastrPersona.isSaving}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {roastrPersona.hasIntoleranceContent ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                        <div>
                          <div className="font-medium text-green-800">Protección automática activada</div>
                          <div className="text-sm text-green-700 mt-1">
                            Has configurado contenido que será bloqueado automáticamente antes de llegar a tu bandeja.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <Circle className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <div className="font-medium text-gray-800">Sin protección automática</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Configura contenido que nunca quieres ver para máxima protección.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setRoastrPersona(prev => ({ ...prev, showIntoleranceForm: true }))}
                      className="border-red-200 text-red-700 hover:bg-red-50"
                    >
                      {roastrPersona.hasIntoleranceContent ? 'Editar Protección' : 'Configurar Protección'}
                    </Button>
                    {roastrPersona.hasIntoleranceContent && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteRoastrPersona('intolerance')}
                        disabled={roastrPersona.isSaving}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Roastr Persona - Lo que me da igual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Circle className="h-5 w-5 text-blue-500" />
            <span>Roastr Persona - Lo que me da igual</span>
            <Badge variant="outline" className="text-blue-600 border-blue-200">Reducir Falsos Positivos</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-800 mb-2">
              <strong>Personaliza tu experiencia</strong>
            </div>
            <div className="text-sm text-blue-700">
              Especifica temas o comentarios que otros podrían considerar ofensivos, pero que para ti son inofensivos 
              (ej: "bromas sobre calvos", "insultos genéricos como tonto"). Esto evita que se bloqueen o roasteen 
              comentarios que realmente no te molestan.
            </div>
            <div className="text-xs text-blue-600 mt-2 font-medium">
              ⚠️ Importante: Si algo aparece tanto en "Lo que no tolero" como aquí, siempre se priorizará el bloqueo por seguridad.
            </div>
          </div>

          {roastrPersona.isLoading ? (
            <div className="text-center py-4">
              <div className="text-muted-foreground">Cargando...</div>
            </div>
          ) : (
            <>
              {roastrPersona.showToleranceForm ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Lo que me da igual (máx. 300 caracteres)
                    </label>
                    <textarea
                      value={roastrPersona.loQueMeDaIgual}
                      onChange={(e) => setRoastrPersona(prev => ({ ...prev, loQueMeDaIgual: e.target.value }))}
                      placeholder="Escribe temas que otros considerarían ofensivos, pero que para ti no lo son (ej: bromas sobre calvos, insultos genéricos como tonto)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={4}
                      maxLength={300}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <div className="text-xs text-muted-foreground">
                        {roastrPersona.loQueMeDaIgual.length}/300 caracteres
                      </div>
                      <div className={`text-xs ${roastrPersona.loQueMeDaIgual.length > 300 ? 'text-red-500' : 'text-green-500'}`}>
                        {roastrPersona.loQueMeDaIgual.length <= 300 ? '✓' : '⚠ Excede el límite'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="toleranceVisible"
                      checked={roastrPersona.isToleranceVisible}
                      onChange={(e) => setRoastrPersona(prev => ({ ...prev, isToleranceVisible: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="toleranceVisible" className="text-sm text-muted-foreground">
                      Hacer visible en mi perfil (recomendado: mantener privado)
                    </label>
                  </div>

                  <div className="flex justify-between items-center">
                    <Button
                      variant="outline"
                      onClick={() => setRoastrPersona(prev => ({ 
                        ...prev, 
                        showToleranceForm: false,
                        loQueMeDaIgual: prev.hasToleranceContent ? prev.loQueMeDaIgual : ''
                      }))}
                      disabled={roastrPersona.isSaving}
                      size="sm"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => handleSaveRoastrPersona('tolerance')}
                      disabled={roastrPersona.isSaving || roastrPersona.loQueMeDaIgual.length > 300}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {roastrPersona.isSaving ? 'Guardando...' : 'Guardar Tolerancias'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {roastrPersona.hasToleranceContent ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-green-800">
                            ✅ Tolerancias personales definidas
                          </div>
                          <div className="text-sm text-green-700">
                            Has configurado temas que consideras inofensivos para ti
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => setRoastrPersona(prev => ({ ...prev, showToleranceForm: true }))}
                            disabled={roastrPersona.isSaving}
                            size="sm"
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleDeleteRoastrPersona('tolerance')}
                            disabled={roastrPersona.isSaving}
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Circle className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Define tus tolerancias personales
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                        Especifica qué comentarios o temas consideras inofensivos para ti, 
                        aunque otros los consideren ofensivos. Esto reduce los falsos positivos.
                      </p>
                      <Button
                        onClick={() => setRoastrPersona(prev => ({ ...prev, showToleranceForm: true }))}
                        disabled={roastrPersona.isSaving}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Definir Tolerancias
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Roast Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SettingsIcon className="h-5 w-5" />
            <span>Roast Behavior</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Roast Tone</label>
              <Select 
                value={settings.roastTone} 
                onValueChange={(value) => updateSetting('roastTone', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gentle">Gentle</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="savage">Savage</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground mt-1">
                Controls how aggressive your roasts are
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Response Frequency</label>
              <Select 
                value={settings.responseFrequency} 
                onValueChange={(value) => updateSetting('responseFrequency', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (30%)</SelectItem>
                  <SelectItem value="normal">Normal (60%)</SelectItem>
                  <SelectItem value="high">High (90%)</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground mt-1">
                How often to respond to mentions
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Toxicity Threshold</label>
            <Select 
              value={settings.toxicityThreshold} 
              onValueChange={(value) => updateSetting('toxicityThreshold', value)}
            >
              <SelectTrigger className="md:w-1/2">
                <SelectValue placeholder="Select threshold" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (Block only severe)</SelectItem>
                <SelectItem value="medium">Medium (Balanced filtering)</SelectItem>
                <SelectItem value="high">High (Block most toxic)</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground mt-1">
              Minimum toxicity level before blocking responses
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shield Protection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Shield Protection</span>
            </div>
            {user?.plan === 'free' && (
              <Badge variant="outline">Pro Feature</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Enable Shield</div>
              <div className="text-sm text-muted-foreground">
                Automatically block, mute, or report toxic accounts
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.shieldEnabled && user?.plan !== 'free'}
                onChange={(e) => updateSetting('shieldEnabled', e.target.checked)}
                disabled={user?.plan === 'free'}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${
                settings.shieldEnabled && user?.plan !== 'free' 
                  ? 'bg-primary' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                  settings.shieldEnabled && user?.plan !== 'free' 
                    ? 'translate-x-5' 
                    : 'translate-x-0.5'
                } mt-0.5`} />
              </div>
            </label>
          </div>

          {user?.plan === 'free' && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm">
                <strong>Upgrade to Pro</strong> to enable Shield protection and automatically protect against toxic interactions.
              </div>
              <Button variant="outline" size="sm" className="mt-2">
                Upgrade Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notifications</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              { key: 'email', label: 'Email Notifications', description: 'General updates and alerts' },
              { key: 'mentions', label: 'New Mentions', description: 'When someone mentions you' },
              { key: 'responses', label: 'Response Sent', description: 'When bot responds to someone' },
              { key: 'billing', label: 'Billing Updates', description: 'Payment and subscription changes' }
            ].map((notification) => (
              <div key={notification.key} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{notification.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {notification.description}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications[notification.key]}
                    onChange={(e) => updateSetting(`notifications.${notification.key}`, e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors ${
                    settings.notifications[notification.key] 
                      ? 'bg-primary' 
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                      settings.notifications[notification.key] 
                        ? 'translate-x-5' 
                        : 'translate-x-0.5'
                    } mt-0.5`} />
                  </div>
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Palette className="h-5 w-5" />
            <span>Appearance</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Dark Mode</div>
              <div className="text-sm text-muted-foreground">
                Switch between light and dark themes
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) => updateSetting('darkMode', e.target.checked)}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${
                settings.darkMode 
                  ? 'bg-primary' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                  settings.darkMode 
                    ? 'translate-x-5' 
                    : 'translate-x-0.5'
                } mt-0.5`} />
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>Data Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-blue-600 mb-2">Export Your Data</div>
                <div className="text-sm text-muted-foreground">
                  Download all your personal data in JSON format (GDPR compliance)
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowDataExportModal(true)}>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ajustes Section */}
      <AjustesSettings
        user={user}
        onNotification={addNotification}
      />

      {/* Danger Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span>Danger Zone</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="font-medium text-red-600 mb-2">Delete Account</div>
            <div className="text-sm text-muted-foreground mb-3">
              Permanently delete your account and all associated data. This action cannot be undone.
            </div>
            <AccountDeletionButton 
              user={user}
              onDeleteRequested={() => addNotification('Eliminación de cuenta programada. Tienes 30 días para cancelar.', 'success')}
              onError={(error) => addNotification(error, 'error')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Export Modal - Issue #258 */}
      {showDataExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Descargar mis datos
            </h3>
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex">
                  <Mail className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                      Recibirás un correo con un enlace para descargar tus datos de Roastr
                    </p>
                    <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• El enlace será válido por 24 horas</li>
                      <li>• El archivo incluirá todos tus datos personales</li>
                      <li>• Formato: ZIP con archivos JSON y CSV</li>
                      <li>• Cumplimiento RGPD - Artículo 15</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="flex">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    Por seguridad, el enlace de descarga expirará automáticamente en 24 horas.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <Button
                onClick={handleDataExportRequest}
                disabled={dataExportLoading}
                className="flex-1"
              >
                {dataExportLoading ? 'Procesando...' : 'Solicitar descarga'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDataExportModal(false)}
                disabled={dataExportLoading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}