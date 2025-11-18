import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { useToast } from '../hooks/use-toast';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  Shield, 
  Target,
  Palette,
  Volume2,
  Hash
} from 'lucide-react';

const PLATFORMS = [
  { id: 'twitter', name: 'Twitter', color: 'bg-blue-500' },
  { id: 'youtube', name: 'YouTube', color: 'bg-red-500' },
  { id: 'bluesky', name: 'Bluesky', color: 'bg-sky-500' },
  { id: 'instagram', name: 'Instagram', color: 'bg-pink-500' },
  { id: 'facebook', name: 'Facebook', color: 'bg-blue-600' },
  { id: 'discord', name: 'Discord', color: 'bg-indigo-500' },
  { id: 'twitch', name: 'Twitch', color: 'bg-purple-500' },
  { id: 'reddit', name: 'Reddit', color: 'bg-orange-500' },
  { id: 'tiktok', name: 'TikTok', color: 'bg-black' }
];

const TONES = [
  { value: 'sarcastic', label: 'Sarcastic', description: 'Sharp wit with attitude' },
  { value: 'ironic', label: 'Ironic', description: 'Subtle and clever' },
  { value: 'absurd', label: 'Absurd', description: 'Wildly creative and unexpected' }
];

const HUMOR_TYPES = [
  { value: 'witty', label: 'Witty', description: 'Quick and clever' },
  { value: 'clever', label: 'Clever', description: 'Thoughtful and sharp' },
  { value: 'playful', label: 'Playful', description: 'Light and fun' }
];

function ConfigurationCard({ platform, config, onSave, loading }) {
  const [localConfig, setLocalConfig] = useState(config);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(platform.id, localConfig);
      toast({
        title: "Configuration saved",
        description: `${platform.name} settings updated successfully`,
      });
    } catch (error) {
      toast({
        title: "Error saving configuration",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (field, value) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayChange = (field, value) => {
    const words = value.split(',').map(w => w.trim()).filter(w => w.length > 0);
    setLocalConfig(prev => ({ ...prev, [field]: words }));
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${platform.color}`} />
            <CardTitle className="text-lg">{platform.name}</CardTitle>
            <Badge variant={localConfig.enabled ? "default" : "secondary"}>
              {localConfig.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <Switch
            checked={localConfig.enabled}
            onCheckedChange={(checked) => handleToggle('enabled', checked)}
            disabled={loading}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {localConfig.enabled && (
          <>
            {/* Tone Configuration */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Tone</label>
              </div>
              <Select
                value={localConfig.tone}
                onValueChange={(value) => handleToggle('tone', value)}
              >
                {TONES.map(tone => (
                  <option key={tone.value} value={tone.value}>
                    {tone.label} - {tone.description}
                  </option>
                ))}
              </Select>
            </div>

            {/* Humor Type */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Humor Style</label>
              </div>
              <Select
                value={localConfig.humor_type}
                onValueChange={(value) => handleToggle('humor_type', value)}
              >
                {HUMOR_TYPES.map(humor => (
                  <option key={humor.value} value={humor.value}>
                    {humor.label} - {humor.description}
                  </option>
                ))}
              </Select>
            </div>

            {/* Response Frequency */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Response Frequency</label>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={localConfig.response_frequency}
                  onChange={(e) => handleToggle('response_frequency', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <Badge variant="outline">
                  {Math.round(localConfig.response_frequency * 100)}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Percentage of comments that will receive a roast response
              </p>
            </div>

            {/* Trigger Words */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Trigger Words</label>
              </div>
              <Input
                placeholder="roast, burn, insult"
                value={localConfig.trigger_words?.join(', ') || ''}
                onChange={(e) => handleArrayChange('trigger_words', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated words that trigger roast responses
              </p>
            </div>

            <Separator />

            {/* Shield Configuration */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Shield Mode</label>
                </div>
                <Switch
                  checked={localConfig.shield_enabled}
                  onCheckedChange={(checked) => handleToggle('shield_enabled', checked)}
                />
              </div>
              
              {localConfig.shield_enabled && (
                <div className="pl-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto Actions</span>
                    <Switch
                      checked={localConfig.shield_config?.auto_actions || false}
                      onCheckedChange={(checked) => 
                        handleToggle('shield_config', {
                          ...localConfig.shield_config,
                          auto_actions: checked
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Mute Users</span>
                    <Switch
                      checked={localConfig.shield_config?.mute_enabled || false}
                      onCheckedChange={(checked) => 
                        handleToggle('shield_config', {
                          ...localConfig.shield_config,
                          mute_enabled: checked
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Block Users</span>
                    <Switch
                      checked={localConfig.shield_config?.block_enabled || false}
                      onCheckedChange={(checked) => 
                        handleToggle('shield_config', {
                          ...localConfig.shield_config,
                          block_enabled: checked
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Report Users</span>
                    <Switch
                      checked={localConfig.shield_config?.report_enabled || false}
                      onCheckedChange={(checked) => 
                        handleToggle('shield_config', {
                          ...localConfig.shield_config,
                          report_enabled: checked
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <Button 
          onClick={handleSave} 
          disabled={saving || loading}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Configuration() {
  const [configurations, setConfigurations] = useState({});
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      const response = await fetch('/api/config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to load configurations');
      
      const data = await response.json();
      setConfigurations(data.data.platforms);
    } catch (error) {
      toast({
        title: "Error loading configurations",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async (platform, config) => {
    const response = await fetch(`/api/config/${platform}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save configuration');
    }

    // Update local state
    setConfigurations(prev => ({
      ...prev,
      [platform]: config
    }));
  };

  const reloadConfiguration = async () => {
    setReloading(true);
    try {
      const response = await fetch('/api/config/reload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to reload configuration');

      toast({
        title: "Configuration reloaded",
        description: "System configuration has been hot-reloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error reloading configuration",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setReloading(false);
    }
  };

  const enabledPlatforms = PLATFORMS.filter(p => configurations[p.id]?.enabled);
  const disabledPlatforms = PLATFORMS.filter(p => !configurations[p.id]?.enabled);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center space-x-2">
            <Settings className="h-6 w-6" />
            <span>Platform Configuration</span>
          </h1>
          <p className="text-muted-foreground">
            Configure tone, humor, frequency, and shield settings for each platform
          </p>
        </div>
        <Button onClick={reloadConfiguration} disabled={reloading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${reloading ? 'animate-spin' : ''}`} />
          Hot Reload Config
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {enabledPlatforms.length}
            </div>
            <p className="text-sm text-muted-foreground">Platforms Enabled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-500">
              {disabledPlatforms.length}
            </div>
            <p className="text-sm text-muted-foreground">Platforms Disabled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {Object.values(configurations).filter(c => c.shield_enabled).length}
            </div>
            <p className="text-sm text-muted-foreground">Shield Mode Active</p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Configurations */}
      <Tabs defaultValue="enabled" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="enabled">
            Enabled Platforms ({enabledPlatforms.length})
          </TabsTrigger>
          <TabsTrigger value="disabled">
            Disabled Platforms ({disabledPlatforms.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="enabled" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {enabledPlatforms.map(platform => (
              <ConfigurationCard
                key={platform.id}
                platform={platform}
                config={configurations[platform.id] || {}}
                onSave={saveConfiguration}
                loading={loading}
              />
            ))}
            {enabledPlatforms.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No platforms enabled</h3>
                <p className="text-muted-foreground">
                  Enable platforms in the "Disabled Platforms" tab to start configuring them.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="disabled" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {disabledPlatforms.map(platform => (
              <ConfigurationCard
                key={platform.id}
                platform={platform}
                config={configurations[platform.id] || { enabled: false }}
                onSave={saveConfiguration}
                loading={loading}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}