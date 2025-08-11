import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Settings as SettingsIcon, User, Shield, Bell, Palette, Save } from 'lucide-react';

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

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/user');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          // In real implementation, load user settings
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
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
              <Input 
                type="email" 
                value={user?.email || ''} 
                disabled
                className="bg-muted"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Email cannot be changed
              </div>
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

      {/* Danger Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="font-medium text-red-600 mb-2">Delete Account</div>
            <div className="text-sm text-muted-foreground mb-3">
              Permanently delete your account and all associated data. This action cannot be undone.
            </div>
            <Button variant="destructive" size="sm">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}