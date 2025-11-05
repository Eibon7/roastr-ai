/**
 * RoastingToggle Component
 * Issue #596 - Roasting Control (Enable/Disable with Worker Sync)
 *
 * Global toggle to enable/disable roasting feature for the user
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { InfoTooltip } from './ui/InfoTooltip';
import { Flame, Power, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import axios from 'axios';

const RoastingToggle = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [roastingEnabled, setRoastingEnabled] = useState(true);
  const [disabledAt, setDisabledAt] = useState(null);
  const [disabledReason, setDisabledReason] = useState(null);
  const [stats, setStats] = useState({
    pending_jobs: 0,
    roasts_today: 0
  });

  useEffect(() => {
    if (user) {
      loadRoastingStatus();
      loadStats();
    }
  }, [user]);

  const loadRoastingStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/roasting/status');

      if (response.data.success) {
        const { roasting_enabled, roasting_disabled_at, roasting_disabled_reason } = response.data.data;
        setRoastingEnabled(roasting_enabled ?? true);
        setDisabledAt(roasting_disabled_at);
        setDisabledReason(roasting_disabled_reason);
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
    try {
      const response = await axios.get('/api/roasting/stats');

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error loading roasting stats:', error);
    }
  };

  const handleToggle = async (enabled) => {
    try {
      setToggling(true);

      const response = await axios.post('/api/roasting/toggle', {
        enabled,
        reason: enabled ? null : 'user_request'
      });

      if (response.data.success) {
        setRoastingEnabled(enabled);
        setDisabledAt(response.data.data.roasting_disabled_at);
        setDisabledReason(response.data.data.roasting_disabled_reason);

        // Reload stats after toggle
        await loadStats();

        toast({
          title: enabled ? 'Roasting Enabled' : 'Roasting Disabled',
          description: enabled
            ? 'Roast generation is now active'
            : 'Roast generation has been paused',
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('Error toggling roasting:', error);

      // Revert optimistic update
      setRoastingEnabled(!enabled);

      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to toggle roasting',
        variant: 'destructive'
      });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Roasting Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5" />
              Roasting Control
            </CardTitle>
            <CardDescription>
              Enable or disable roast generation globally
            </CardDescription>
          </div>
          <Badge variant={roastingEnabled ? 'default' : 'secondary'} className="text-sm">
            {roastingEnabled ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </>
            ) : (
              <>
                <Power className="h-3 w-3 mr-1" />
                Paused
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="roasting-toggle" className="font-medium">
                Enable Roasting
              </Label>
              <InfoTooltip content="When disabled, all roast generation will be paused. Pending jobs will remain in queue." />
            </div>
            <p className="text-sm text-muted-foreground">
              {roastingEnabled
                ? 'Roasts are being generated for toxic comments'
                : 'Roast generation is currently paused'}
            </p>
          </div>
          <Switch
            id="roasting-toggle"
            checked={roastingEnabled}
            onCheckedChange={handleToggle}
            disabled={toggling}
          />
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold">{stats.pending_jobs}</div>
            <div className="text-sm text-muted-foreground">Pending Jobs</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold">{stats.roasts_today}</div>
            <div className="text-sm text-muted-foreground">Roasts Today</div>
          </div>
        </div>

        {/* Status Information */}
        {!roastingEnabled && disabledAt && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Roasting was disabled</p>
                <p className="text-sm text-muted-foreground">
                  Since: {new Date(disabledAt).toLocaleString()}
                </p>
                {disabledReason && (
                  <p className="text-sm text-muted-foreground">
                    Reason: {disabledReason}
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {roastingEnabled && stats.pending_jobs > 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <p className="text-sm">
                {stats.pending_jobs} {stats.pending_jobs === 1 ? 'job' : 'jobs'} in queue will be processed
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Warning about disabling */}
        {roastingEnabled && (
          <div className="text-xs text-muted-foreground">
            <p>
              <strong>Note:</strong> Disabling roasting will pause generation immediately.
              Jobs already in queue will remain there until re-enabled.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RoastingToggle;
