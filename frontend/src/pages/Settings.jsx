import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Settings as SettingsIcon, User, Shield, Bell, Palette, Save, Mail, Download, AlertTriangle } from 'lucide-react';
import { apiClient } from '../lib/api';
import { authHelpers } from '../lib/supabaseClient';

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
  const [notifications, setNotifications] = useState([]);

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

  // Data export handling
  const handleDataExport = async () => {
    try {
      addNotification('Preparando exportación de datos...', 'info');
      
      // This would call a data export endpoint
      const result = await apiClient.get('/auth/export-data');
      
      if (result.success) {
        // Create and download file
        const dataStr = JSON.stringify(result.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `roastr-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        addNotification('Datos exportados correctamente', 'success');
      } else {
        addNotification('Error al exportar datos', 'error');
      }
      
    } catch (error) {
      console.error('Data export error:', error);
      addNotification('La exportación de datos estará disponible próximamente', 'info');
    }
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
              <Button variant="outline" size="sm" onClick={handleDataExport}>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => {
                if (window.confirm('¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer.')) {
                  if (window.confirm('Esta acción eliminará permanentemente todos tus datos. ¿Continuar?')) {
                    addNotification('La eliminación de cuenta estará disponible próximamente', 'info');
                  }
                }
              }}
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}