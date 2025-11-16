import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { 
  User, 
  Settings as SettingsIcon, 
  CreditCard, 
  Download, 
  Trash2, 
  Eye, 
  EyeOff, 
  Shield,
  Brain,
  Target,
  Zap,
  Crown,
  AlertTriangle,
  Loader2,
  Check
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import AjustesSettings from '../components/AjustesSettings';
import { useNavigate } from 'react-router-dom';
import { isFeatureEnabled } from '../utils/featureFlags';
import { getTierLimits, validateConnectionLimit, getConnectionWarning } from '../utils/tierLimits';
import { normalizePlanId, getPlanDisplayName, getPlanBadgeColor } from '../utils/planHelpers';

const Settings = () => {
  const { userData: user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('account');
  const notificationTimeoutRef = useRef(null);
  // Granular loading states for independent operations
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [billingInfo, setBillingInfo] = useState(null);
  const [activeNotification, setActiveNotification] = useState(null);
  
  // Connection limits and Shield UI states
  const [connections, setConnections] = useState([]);
  const [shieldSettings, setShieldSettings] = useState(null);
  const [shieldExpanded, setShieldExpanded] = useState(false);
  
  // Account tab states
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleNotification = (message, type = 'success') => {
    setActiveNotification({ message, type, id: Date.now() });
    
    // Clear any existing timeout
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    
    // Auto-hide after 5 seconds with proper cleanup
    notificationTimeoutRef.current = setTimeout(() => {
      setActiveNotification(null);
    }, 5000);
  };

  const dismissNotification = () => {
    // Clear timeout when manually dismissing
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = null;
    }
    setActiveNotification(null);
  };

  useEffect(() => {
    loadBillingInfo();
    loadConnections();
    loadShieldSettings();
    
    // Cleanup timeout on unmount
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  const loadBillingInfo = async () => {
    try {
      const billing = await apiClient.get('/billing/info');
      setBillingInfo(billing.data);
    } catch (error) {
      console.warn('Could not load billing info:', error);
    }
  };

  const loadConnections = async () => {
    try {
      const response = await apiClient.get('/user/connections');
      setConnections(response.data?.connections || []);
    } catch (error) {
      console.warn('Could not load connections:', error);
    }
  };

  const loadShieldSettings = async () => {
    try {
      const response = await apiClient.get('/shield/settings');
      setShieldSettings(response.data);
    } catch (error) {
      console.warn('Could not load Shield settings:', error);
    }
  };

  const validatePassword = (password) => {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('At least 8 characters');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('One uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('One lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('One number');
    }
    
    if (!/[!@#$%^&*()_+\-=[\]{}|;':".,<>?`~]/.test(password)) {
      errors.push('One special character');
    }
    
    return errors;
  };

  const getPasswordStrength = (password) => {
    const errors = validatePassword(password);
    const score = 5 - errors.length;
    
    if (score <= 1) return { strength: 'weak', color: 'bg-red-500', text: 'Weak' };
    if (score <= 3) return { strength: 'medium', color: 'bg-yellow-500', text: 'Medium' };
    return { strength: 'strong', color: 'bg-green-500', text: 'Strong' };
  };

  // Enhanced button validation state
  const isPasswordFormValid = () => {
    return passwords.current.trim() && 
           passwords.new.trim() && 
           passwords.confirm.trim() &&
           passwords.new === passwords.confirm &&
           validatePassword(passwords.new).length === 0 &&
           passwords.current !== passwords.new;
  };

  const handlePasswordChange = async () => {
    // Pre-validate current password
    if (!passwords.current.trim()) {
      handleNotification('Current password is required', 'error');
      return;
    }
    
    // Pre-validate new password
    const validationErrors = validatePassword(passwords.new);
    if (validationErrors.length > 0) {
      handleNotification(`Password must contain: ${validationErrors.join(', ')}`, 'error');
      return;
    }
    
    // Check password confirmation
    if (passwords.new !== passwords.confirm) {
      handleNotification('New passwords do not match', 'error');
      return;
    }
    
    // Check if new password is different from current
    if (passwords.current === passwords.new) {
      handleNotification('New password must be different from current password', 'error');
      return;
    }

    try {
      setPasswordLoading(true);
      await apiClient.post('/auth/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.new
      });
      
      setPasswords({ current: '', new: '', confirm: '' });
      handleNotification('Password changed successfully', 'success');
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to change password';
      handleNotification(errorMessage, 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDataExport = async () => {
    try {
      setExportLoading(true);
      await apiClient.post('/auth/export-data');
      handleNotification('Data export initiated. You will receive an email when ready.', 'success');
    } catch (error) {
      handleNotification('Failed to initiate data export', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const handleAccountDeletion = async () => {
    if (deleteConfirmText !== 'DELETE') {
      handleNotification('Please type DELETE to confirm', 'error');
      return;
    }

    try {
      setDeleteLoading(true);
      await apiClient.post('/auth/delete-account');
      handleNotification('Account deletion initiated', 'success');
      // Navigate to logout or landing page
      navigate('/');
    } catch (error) {
      handleNotification('Failed to delete account', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getPlanColor = (plan) => {
    return getPlanBadgeColor(plan);
  };

  const getPlanIcon = (plan) => {
    const normalized = normalizePlanId(plan);
    switch (normalized) {
      case 'starter_trial': return <Zap className="w-4 h-4" />;
      case 'starter': return <Zap className="w-4 h-4" />;
      case 'pro': return <Target className="w-4 h-4" />;
      case 'plus': return <Crown className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  if ((passwordLoading || exportLoading || deleteLoading) && !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Notification - Enhanced accessibility */}
      {activeNotification && (
        <div 
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border ${
            activeNotification.type === 'error' 
              ? 'bg-red-50 border-red-200 text-red-800' 
              : activeNotification.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-green-50 border-green-200 text-green-800'
          }`}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{activeNotification.message}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={dismissNotification}
              className="ml-2 h-4 w-4 p-0"
              aria-label="Close notification"
            >
              ×
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account, preferences, and billing</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="adjustments" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Adjustments
          </TabsTrigger>
          <TabsTrigger value="connections" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Billing
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Account Information
              </CardTitle>
              <CardDescription>
                Manage your account details and security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Display */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-sm text-gray-500">
                  Email changes require contacting support
                </p>
              </div>

              {/* Password Change */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Change Password</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showPasswords.current ? "text" : "password"}
                      value={passwords.current}
                      onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                      placeholder="Enter current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                      aria-label={showPasswords.current ? "Hide current password" : "Show current password"}
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPasswords.new ? "text" : "password"}
                      value={passwords.new}
                      onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                      placeholder="Enter new password"
                      aria-describedby={validatePassword(passwords.new).length > 0 ? "password-requirements" : undefined}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      aria-label={showPasswords.new ? "Hide new password" : "Show new password"}
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  {/* Password Strength Indicator */}
                  {passwords.new && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Password strength:</span>
                        <span className={`text-sm font-medium ${
                          getPasswordStrength(passwords.new).strength === 'weak' ? 'text-red-600' :
                          getPasswordStrength(passwords.new).strength === 'medium' ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {getPasswordStrength(passwords.new).text}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrength(passwords.new).color}`}
                          style={{ 
                            width: `${getPasswordStrength(passwords.new).strength === 'weak' ? '33' : 
                                     getPasswordStrength(passwords.new).strength === 'medium' ? '66' : '100'}%` 
                          }}
                        />
                      </div>
                      {validatePassword(passwords.new).length > 0 && (
                        <ul id="password-requirements" className="text-sm text-gray-600">
                          {validatePassword(passwords.new).map((error, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <span className="text-red-500">•</span>
                              {error}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwords.confirm}
                      onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                      placeholder="Confirm new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      aria-label={showPasswords.confirm ? "Hide confirmation password" : "Show confirmation password"}
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <Button 
                  onClick={handlePasswordChange}
                  disabled={passwordLoading || !isPasswordFormValid()}
                  className="w-full sm:w-auto"
                >
                  {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* GDPR Data Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Data Export
              </CardTitle>
              <CardDescription>
                Download all your data in compliance with GDPR
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleDataExport} disabled={exportLoading} variant="outline">
                {exportLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Request Data Export
              </Button>
              <p className="text-sm text-gray-500 mt-2">
                You'll receive an email with a download link when your data is ready
              </p>
            </CardContent>
          </Card>

          {/* GDPR Transparency (Issue #366) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Transparencia GDPR
              </CardTitle>
              <CardDescription>
                Información sobre el tratamiento automatizado de contenido
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">
                        Generación Automática de Contenido
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Los roasts autopublicados llevan firma de IA para cumplir con la normativa de transparencia digital.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>
                    De acuerdo con el RGPD y las normativas de transparencia digital, 
                    todos los contenidos generados automáticamente por IA incluyen 
                    marcadores identificativos apropiados.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Deletion */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Delete Account
              </CardTitle>
              <CardDescription>
                Permanently delete your account and all associated data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showDeleteConfirm ? (
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Delete Account
                </Button>
              ) : (
                <div className="space-y-4 p-4 border border-red-200 rounded-lg bg-red-50">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ This action cannot be undone. All your data will be permanently deleted.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="delete-confirm">Type "DELETE" to confirm:</Label>
                    <Input
                      id="delete-confirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive" 
                      onClick={handleAccountDeletion}
                      disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
                    >
                      {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Delete Forever
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Adjustments Tab - Use existing AjustesSettings component */}
        <TabsContent value="adjustments" className="space-y-6">
          <AjustesSettings 
            user={user} 
            onNotification={handleNotification}
          />
        </TabsContent>

        {/* Connections Tab - Network Connection Limits & Shield */}
        <TabsContent value="connections" className="space-y-6">
          {/* Network Connection Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Límites de Conexión de Red
              </CardTitle>
              <CardDescription>
                Gestiona las conexiones de tus redes sociales según tu plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const currentPlan = normalizePlanId(user?.plan || 'starter_trial');
                const tierLimits = getTierLimits(currentPlan);
                const connectionValidation = validateConnectionLimit(connections.length, currentPlan);
                const warning = getConnectionWarning(connections.length, currentPlan);
                
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium text-sm text-gray-600">Plan Actual</h4>
                        <div className="flex items-center gap-2 mt-1">
                          {getPlanIcon(currentPlan)}
                          <span className="text-lg font-semibold capitalize">{currentPlan}</span>
                        </div>
                      </div>
                      
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium text-sm text-gray-600">Conexiones Activas</h4>
                        <p className="text-2xl font-bold">
                          {connections.length}
                          <span className="text-sm text-gray-500 font-normal">
                            /{tierLimits.social_connections}
                          </span>
                        </p>
                      </div>
                      
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium text-sm text-gray-600">Estado</h4>
                        <Badge className={connectionValidation.allowed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {connectionValidation.allowed ? 'Disponible' : 'Límite alcanzado'}
                        </Badge>
                      </div>
                    </div>

                    {warning && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-amber-900">Advertencia de Límite</h4>
                            <p className="text-sm text-amber-700 mt-1">{warning}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!connectionValidation.allowed && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-red-900">Límite Alcanzado</h4>
                            <p className="text-sm text-red-700 mt-1">
                              {connectionValidation.message}
                            </p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-2"
                              onClick={() => navigate('/pricing')}
                            >
                              Actualizar Plan
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="font-medium">Conexiones Configuradas</h4>
                      {connections.length > 0 ? (
                        <div className="space-y-2">
                          {connections.map((connection, index) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-sm font-medium text-blue-800">
                                    {connection.platform?.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium capitalize">{connection.platform}</p>
                                  <p className="text-sm text-gray-500">
                                    {connection.enabled ? 'Activa' : 'Inactiva'}
                                  </p>
                                </div>
                              </div>
                              <Badge className={connection.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                {connection.enabled ? 'Conectada' : 'Pausada'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600">No hay conexiones configuradas</p>
                          <Button 
                            variant="outline" 
                            className="mt-2"
                            onClick={() => navigate('/integrations')}
                          >
                            Configurar Conexiones
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Shield Configuration - Collapsible Section (Feature Flagged) */}
          {isFeatureEnabled('ENABLE_SHIELD_UI') && getTierLimits(normalizePlanId(user?.plan || 'starter_trial')).shield_enabled && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    <div>
                      <CardTitle>Configuración Shield</CardTitle>
                      <CardDescription>
                        Sistema de moderación automática para contenido tóxico
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShieldExpanded(!shieldExpanded)}
                    className="flex items-center gap-2"
                  >
                    {shieldExpanded ? 'Colapsar' : 'Expandir'}
                    <div className={`transform transition-transform ${shieldExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </div>
                  </Button>
                </div>
              </CardHeader>
              
              {shieldExpanded && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium text-sm text-gray-600">Estado Shield</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`w-3 h-3 rounded-full ${shieldSettings?.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="font-semibold">
                          {shieldSettings?.enabled ? 'Activado' : 'Desactivado'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium text-sm text-gray-600">Nivel de Agresividad</h4>
                      <p className="text-lg font-semibold">
                        {shieldSettings?.aggressiveness || 95}%
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900 dark:text-blue-100">
                          Shield Automático
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          Shield monitorea automáticamente el contenido tóxico y toma acciones preventivas 
                          según el nivel de agresividad configurado.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => navigate('/shield/settings')}
                    >
                      Configuración Avanzada
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate('/shield/logs')}
                    >
                      Ver Logs
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Plan Restriction Notice for Shield */}
          {isFeatureEnabled('ENABLE_SHIELD_UI') && !getTierLimits(normalizePlanId(user?.plan || 'starter_trial')).shield_enabled && (
            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <Crown className="w-5 h-5" />
                  Shield Disponible en Planes Premium
                </CardTitle>
                <CardDescription>
                  Actualiza tu plan para acceder a la moderación automática Shield
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Shield className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-amber-900">¿Qué es Shield?</h4>
                        <p className="text-sm text-amber-700 mt-1">
                          Shield es nuestro sistema de moderación automática que detecta y gestiona 
                          contenido tóxico en tiempo real, manteniendo tus redes sociales seguras.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Button onClick={() => navigate('/pricing')} className="w-full">
                    Ver Planes Premium
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Current Plan
              </CardTitle>
              <CardDescription>
                Your subscription and usage overview
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {billingInfo ? (
                <>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getPlanIcon(user?.plan || 'starter_trial')}
                      <div>
                        <h3 className="font-semibold capitalize">{getPlanDisplayName(user?.plan || 'starter_trial')} Plan</h3>
                        <p className="text-sm text-gray-600">
                          {(() => {
                            const plan = normalizePlanId(user?.plan || 'starter_trial');
                            return plan === 'starter_trial' ? 'Free Trial' : plan === 'starter' ? '€5/month' : plan === 'pro' ? '€15/month' : plan === 'plus' ? '€50/month' : 'Custom';
                          })()}
                        </p>
                      </div>
                    </div>
                    <Badge className={getPlanColor(user?.plan || 'starter_trial')}>
                      Active
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium text-sm text-gray-600">Roasts Generated</h4>
                      <p className="text-2xl font-bold">
                        {billingInfo?.usage?.roastsUsed ?? 0}
                        <span className="text-sm text-gray-500 font-normal">
                          /{billingInfo?.limits?.roastsPerMonth ?? (() => {
                            const plan = normalizePlanId(user?.plan || 'starter_trial');
                            return plan === 'starter_trial' || plan === 'starter' ? '5' : plan === 'pro' ? '1000' : plan === 'plus' ? '5000' : '∞';
                          })()}
                        </span>
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{
                            width: `${billingInfo?.usage?.roastsUsed && billingInfo?.limits?.roastsPerMonth ? 
                              Math.min((billingInfo.usage.roastsUsed / billingInfo.limits.roastsPerMonth) * 100, 100) : 0}%`
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium text-sm text-gray-600">API Calls</h4>
                      <p className="text-2xl font-bold">
                        {billingInfo?.usage?.apiCalls ?? 0}
                        <span className="text-sm text-gray-500 font-normal">
                          /{billingInfo?.limits?.apiCallsPerMonth ?? (() => {
                            const plan = normalizePlanId(user?.plan || 'starter_trial');
                            return plan === 'starter_trial' || plan === 'starter' ? '10' : plan === 'pro' ? '1000' : plan === 'plus' ? '5000' : '∞';
                          })()}
                        </span>
                      </p>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium text-sm text-gray-600">This Month</h4>
                      <p className="text-2xl font-bold">
                        €{(() => {
                          const plan = normalizePlanId(user?.plan || 'starter_trial');
                          return plan === 'starter_trial' ? '0.00' : plan === 'starter' ? '5.00' : plan === 'pro' ? '15.00' : plan === 'plus' ? '50.00' : '0.00';
                        })()}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => navigate('/billing')}>
                      View Full Billing
                    </Button>
                    {normalizePlanId(user?.plan || 'starter_trial') === 'starter_trial' && (
                      <Button className="flex-1" onClick={() => navigate('/pricing')}>
                        Upgrade Plan
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Loading billing information...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Plan Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Available Plans</CardTitle>
              <CardDescription>
                Choose the plan that fits your needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { name: 'Free', price: '€0', features: ['5 roasts/day', 'Basic AI'] },
                  { name: 'Starter', price: '€5', features: ['50 roasts/day', 'Enhanced AI', '2 platforms'] },
                  { name: 'Pro', price: '€15', features: ['200 roasts/day', 'Premium AI', '5 platforms'] },
                  { name: 'Plus', price: '€50', features: ['Unlimited roasts', 'Custom AI', 'All platforms'] }
                ].map((plan) => (
                  <div 
                    key={plan.name} 
                    className={`p-4 border rounded-lg ${
                      normalizePlanId(user?.plan || 'starter_trial') === plan.name.toLowerCase() 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200'
                    }`}
                  >
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="text-2xl font-bold text-blue-600">{plan.price}</p>
                    <ul className="text-sm text-gray-600 mt-2 space-y-1">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <Check className="w-3 h-3 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {(user?.plan?.toLowerCase() || 'free') === plan.name.toLowerCase() ? (
                      <Badge className="mt-2 w-full justify-center">Current</Badge>
                    ) : (
                      <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => navigate('/pricing')}>
                        {plan.name === 'Free' ? 'Downgrade' : 'Upgrade'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

Settings.displayName = 'Settings';

export default Settings;