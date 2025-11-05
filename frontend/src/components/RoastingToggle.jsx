/**
 * RoastingToggle Component (Issue #596)
 * Global enable/disable toggle for roasting feature
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Alert } from './ui/alert';
import { Zap, ZapOff, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import apiClient from '../api/apiClient';

const RoastingToggle = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roastingEnabled, setRoastingEnabled] = useState(true);
  const [stats, setStats] = useState({ pending_jobs: 0, roasts_today: 0 });
  const [disabledInfo, setDisabledInfo] = useState(null);

  useEffect(() => {
    loadRoastingStatus();
    loadStats();
  }, [user]);

  const loadRoastingStatus = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await apiClient.get('/roasting/status');

      if (response.data.success) {
        setRoastingEnabled(response.data.data.roasting_enabled);
        if (!response.data.data.roasting_enabled) {
          setDisabledInfo({
            disabledAt: response.data.data.roasting_disabled_at,
            reason: response.data.data.roasting_disabled_reason
          });
        }
      }
    } catch (error) {
      console.error('Error loading roasting status:', error);
      toast({
        title: 'Error',
        description: 'Failed to load roasting status',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user) return;

    try {
      const response = await apiClient.get('/roasting/stats');

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error loading roasting stats:', error);
    }
  };

  const handleToggle = async (enabled) => {
    if (!user) return;

    try {
      setSaving(true);
      const response = await apiClient.post('/roasting/toggle', {
        enabled,
        reason: enabled ? undefined : 'user_toggle'
      });

      if (response.data.success) {
        setRoastingEnabled(enabled);
        if (!enabled) {
          setDisabledInfo({
            disabledAt: response.data.data.roasting_disabled_at,
            reason: response.data.data.roasting_disabled_reason
          });
        } else {
          setDisabledInfo(null);
        }

        toast({
          title: 'Success',
          description: `Roasting ${enabled ? 'enabled' : 'disabled'} successfully`,
          variant: 'default'
        });

        // Reload stats after toggle
        loadStats();
      }
    } catch (error) {
      console.error('Error toggling roasting:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle roasting status',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Roasting Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {roastingEnabled ? <Zap className="w-5 h-5 text-orange-500" /> : <ZapOff className="w-5 h-5 text-gray-400" />}
          Roasting Control
        </CardTitle>
        <CardDescription>
          Enable or disable automatic roast generation for all incoming comments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex-1">
            <Label htmlFor="roasting-toggle" className="text-base font-medium">
              {roastingEnabled ? 'Roasting Enabled' : 'Roasting Disabled'}
            </Label>
            <p className="text-sm text-gray-500 mt-1">
              {roastingEnabled
                ? 'New comments will be automatically roasted'
                : 'Roast generation is paused'}
            </p>
          </div>
          <Switch
            id="roasting-toggle"
            checked={roastingEnabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge variant={roastingEnabled ? 'default' : 'secondary'}>
            {roastingEnabled ? 'Active' : 'Paused'}
          </Badge>
          {!roastingEnabled && disabledInfo && (
            <span className="text-sm text-gray-500">
              Disabled {new Date(disabledInfo.disabledAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold text-orange-500">{stats.pending_jobs}</div>
            <div className="text-sm text-gray-500">Pending Jobs</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold text-green-500">{stats.roasts_today}</div>
            <div className="text-sm text-gray-500">Roasts Today</div>
          </div>
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="w-4 h-4" />
          <div className="ml-2 text-sm">
            <strong>Note:</strong> Disabling roasting will pause new roast generation but won't affect pending jobs.
            Enable it again anytime to resume.
          </div>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default RoastingToggle;
