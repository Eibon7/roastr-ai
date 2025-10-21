import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Slider,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Divider,
  Grid,
  Chip,
  TextField
} from '@mui/material';
import { Security, Settings, Save, Refresh } from '@mui/icons-material';

/**
 * Shield Settings configuration interface.
 *
 * Defines the structure for Shield automated moderation configuration including
 * global settings, toxicity thresholds, and platform-specific overrides.
 *
 * @interface ShieldSettings
 */
interface ShieldSettings {
  enabled: boolean;
  autoActions: boolean;
  reincidenceThreshold: number;
  thresholds: {
    critical: number;
    high: number;
    moderate: number;
    corrective: number;
  };
  platforms: {
    [key: string]: {
      enabled: boolean;
      customThresholds: boolean;
      thresholds?: {
        critical: number;
        high: number;
        moderate: number;
        corrective: number;
      };
    };
  };
}

/**
 * Supported social media platforms for Shield moderation.
 *
 * Each platform includes an ID (used internally), display name, and brand color
 * for UI rendering.
 *
 * @constant
 * @type {Array<{id: string, name: string, color: string}>}
 */
const PLATFORMS = [
  { id: 'twitter', name: 'Twitter/X', color: '#1DA1F2' },
  { id: 'youtube', name: 'YouTube', color: '#FF0000' },
  { id: 'discord', name: 'Discord', color: '#5865F2' },
  { id: 'instagram', name: 'Instagram', color: '#E4405F' },
  { id: 'facebook', name: 'Facebook', color: '#1877F2' },
  { id: 'twitch', name: 'Twitch', color: '#9146FF' },
  { id: 'reddit', name: 'Reddit', color: '#FF4500' },
  { id: 'tiktok', name: 'TikTok', color: '#000000' },
  { id: 'bluesky', name: 'Bluesky', color: '#0085FF' }
];

/**
 * Default Shield configuration settings.
 *
 * Applied when no saved settings exist or after reset operation. Includes:
 * - Shield enabled globally
 * - Manual action approval (autoActions: false)
 * - 2-offense reincidence threshold
 * - Industry-standard toxicity thresholds
 * - All platforms enabled with global thresholds
 *
 * @constant
 * @type {ShieldSettings}
 */
const DEFAULT_SETTINGS: ShieldSettings = {
  enabled: true,
  autoActions: false,
  reincidenceThreshold: 2,
  thresholds: {
    critical: 0.98,
    high: 0.95,
    moderate: 0.90,
    corrective: 0.85
  },
  platforms: PLATFORMS.reduce((acc, p) => ({
    ...acc,
    [p.id]: { enabled: true, customThresholds: false }
  }), {})
};

/**
 * Shield Settings page component.
 *
 * Admin dashboard page for configuring Shield automated moderation system.
 * Allows administrators to:
 * - Enable/disable Shield globally and per-platform
 * - Configure toxicity thresholds (Critical, High, Moderate, Corrective)
 * - Set auto-execution preferences
 * - Adjust reincidence thresholds
 * - Apply platform-specific overrides
 *
 * Settings are persisted via API (or localStorage in demo mode).
 *
 * @component
 * @returns {JSX.Element} Shield Settings dashboard UI
 *
 * @example
 * // Route configuration
 * <Route path="/shield/settings" element={<ShieldSettings />} />
 */
export default function ShieldSettings() {
  const [settings, setSettings] = useState<ShieldSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    // Load settings from API implementation
    setLoading(true);
    try {
      // API call here
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  /**
   * Loads Shield settings from backend API.
   *
   * In production, fetches from /api/shield/settings endpoint.
   * In demo mode, loads from localStorage for persistence across sessions.
   *
   * @async
   * @function loadSettings
   * @returns {Promise<void>}
   * @throws {Error} If API call fails (error is logged but not re-thrown)
   */
  const loadSettings = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/shield/settings');
      // const data = await response.json();
      // setSettings(data);

      // Placeholder: Load from localStorage for demo
      const savedSettings = localStorage.getItem('shieldSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Saves current Shield settings to backend API.
   *
   * In production, sends PUT request to /api/shield/settings with current settings.
   * In demo mode, persists to localStorage. Shows success alert for 3 seconds after save.
   *
   * @async
   * @function handleSave
   * @returns {Promise<void>}
   * @throws {Error} If API call fails (error is logged but not re-thrown)
   */
  const handleSave = async () => {
    setLoading(true);
    setSaved(false);
    try {
      // TODO: Replace with actual API call
      // await fetch('/api/shield/settings', {
      //   method: 'PUT',
      //   body: JSON.stringify(settings)
      // });

      // Placeholder: Save to localStorage for demo
      localStorage.setItem('shieldSettings', JSON.stringify(settings));

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resets Shield settings to default values.
   *
   * Discards all custom configuration and reverts to DEFAULT_SETTINGS.
   * Does not persist changes until user explicitly saves.
   *
   * @function handleReset
   * @returns {void}
   */
  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  /**
   * Updates a specific toxicity threshold value.
   *
   * Modifies one of the four global toxicity thresholds (critical, high, moderate, corrective)
   * while preserving other settings. Changes are not persisted until user saves.
   *
   * @function updateThreshold
   * @param {keyof typeof settings.thresholds} key - Threshold level to update
   * @param {number} value - New threshold value (0.00-1.00)
   * @returns {void}
   *
   * @example
   * updateThreshold('critical', 0.98);  // Set critical threshold to 0.98
   */
  const updateThreshold = (key: keyof typeof settings.thresholds, value: number) => {
    setSettings({
      ...settings,
      thresholds: {
        ...settings.thresholds,
        [key]: value
      }
    });
  };

  /**
   * Updates platform-specific Shield configuration.
   *
   * Modifies settings for a specific social media platform (enabled status,
   * custom thresholds, etc.) while preserving other platform settings.
   * Changes are not persisted until user saves.
   *
   * @function updatePlatform
   * @param {string} platformId - Platform identifier (e.g., 'twitter', 'youtube')
   * @param {Partial<typeof settings.platforms[string]>} updates - Partial settings to update
   * @returns {void}
   *
   * @example
   * updatePlatform('twitter', { enabled: false });  // Disable Shield for Twitter
   * updatePlatform('discord', { customThresholds: true });  // Enable custom thresholds for Discord
   */
  const updatePlatform = (platformId: string, updates: Partial<typeof settings.platforms[string]>) => {
    setSettings({
      ...settings,
      platforms: {
        ...settings.platforms,
        [platformId]: {
          ...settings.platforms[platformId],
          ...updates
        }
      }
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Security sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" fontWeight="bold">
              Shield Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure automated moderation thresholds and actions
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleReset}
            disabled={loading}
          >
            Reset
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
            disabled={loading}
          >
            Save Changes
          </Button>
        </Box>
      </Box>

      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Shield settings saved successfully
        </Alert>
      )}

      {/* Global Settings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Settings /> Global Settings
          </Typography>
          <Divider sx={{ my: 2 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enabled}
                    onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  />
                }
                label="Enable Shield Protection"
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                Activate automated content moderation across all platforms
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoActions}
                    onChange={(e) => setSettings({ ...settings, autoActions: e.target.checked })}
                    disabled={!settings.enabled}
                  />
                }
                label="Auto-Execute Actions"
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                Automatically execute moderation actions without manual approval
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography gutterBottom>
                Reincidence Threshold: {settings.reincidenceThreshold} offenses
              </Typography>
              <Slider
                value={settings.reincidenceThreshold}
                onChange={(_, value) => setSettings({ ...settings, reincidenceThreshold: value as number })}
                min={1}
                max={5}
                marks
                valueLabelDisplay="auto"
                disabled={!settings.enabled}
              />
              <Typography variant="caption" color="text.secondary">
                Number of violations before user is flagged as repeat offender
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Toxicity Thresholds */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Toxicity Thresholds
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary" paragraph>
            Configure the toxicity score thresholds for different severity levels (0.00 - 1.00)
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography gutterBottom>
                  Critical (≥{settings.thresholds.critical.toFixed(2)})
                  <Chip label="Block + Report" size="small" color="error" sx={{ ml: 2 }} />
                </Typography>
                <Slider
                  value={settings.thresholds.critical}
                  onChange={(_, value) => updateThreshold('critical', value as number)}
                  min={0.85}
                  max={1.0}
                  step={0.01}
                  valueLabelDisplay="auto"
                  disabled={!settings.enabled}
                  sx={{ color: 'error.main' }}
                />
                <Typography variant="caption" color="text.secondary">
                  Immediate severe action required
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography gutterBottom>
                  High (≥{settings.thresholds.high.toFixed(2)})
                  <Chip label="Mute/Timeout" size="small" color="warning" sx={{ ml: 2 }} />
                </Typography>
                <Slider
                  value={settings.thresholds.high}
                  onChange={(_, value) => updateThreshold('high', value as number)}
                  min={0.80}
                  max={0.98}
                  step={0.01}
                  valueLabelDisplay="auto"
                  disabled={!settings.enabled}
                  sx={{ color: 'warning.main' }}
                />
                <Typography variant="caption" color="text.secondary">
                  Moderate Shield action needed
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography gutterBottom>
                  Moderate (≥{settings.thresholds.moderate.toFixed(2)})
                  <Chip label="Monitor + Roast" size="small" color="info" sx={{ ml: 2 }} />
                </Typography>
                <Slider
                  value={settings.thresholds.moderate}
                  onChange={(_, value) => updateThreshold('moderate', value as number)}
                  min={0.70}
                  max={0.95}
                  step={0.01}
                  valueLabelDisplay="auto"
                  disabled={!settings.enabled}
                  sx={{ color: 'info.main' }}
                />
                <Typography variant="caption" color="text.secondary">
                  Roastable content with monitoring
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography gutterBottom>
                  Corrective (≥{settings.thresholds.corrective.toFixed(2)})
                  <Chip label="First Strike" size="small" color="success" sx={{ ml: 2 }} />
                </Typography>
                <Slider
                  value={settings.thresholds.corrective}
                  onChange={(_, value) => updateThreshold('corrective', value as number)}
                  min={0.60}
                  max={0.90}
                  step={0.01}
                  valueLabelDisplay="auto"
                  disabled={!settings.enabled}
                  sx={{ color: 'success.main' }}
                />
                <Typography variant="caption" color="text.secondary">
                  First-time offenders get corrective message
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Platform-Specific Settings */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Platform-Specific Settings
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary" paragraph>
            Enable Shield protection and configure custom thresholds per platform
          </Typography>

          <Grid container spacing={2}>
            {PLATFORMS.map((platform) => (
              <Grid item xs={12} md={6} lg={4} key={platform.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {platform.name}
                      </Typography>
                      <Switch
                        checked={settings.platforms[platform.id]?.enabled ?? true}
                        onChange={(e) => updatePlatform(platform.id, { enabled: e.target.checked })}
                        disabled={!settings.enabled}
                        size="small"
                      />
                    </Box>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.platforms[platform.id]?.customThresholds ?? false}
                          onChange={(e) => updatePlatform(platform.id, { customThresholds: e.target.checked })}
                          disabled={!settings.enabled || !settings.platforms[platform.id]?.enabled}
                          size="small"
                        />
                      }
                      label="Custom Thresholds"
                    />

                    {settings.platforms[platform.id]?.customThresholds && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Platform-specific thresholds (TODO: Implement)
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
