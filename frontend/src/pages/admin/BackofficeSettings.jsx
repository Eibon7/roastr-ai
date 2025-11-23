/**
 * Backoffice Settings Page
 * Issue #371: SPEC 15 — Backoffice (MVP): thresholds globales, flags y soporte básico
 *
 * Provides admin interface for:
 * - Global Shield thresholds configuration
 * - Feature flags management (shop_enabled, roast_versions, review_queue)
 * - Platform API healthcheck
 * - Audit logs export
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Download, RefreshCw, Settings, Shield, Activity } from 'lucide-react';
import adminApi from '../services/adminApi';

const BackofficeSettings = () => {
  const [loading, setLoading] = useState(false);
  const [globalThresholds, setGlobalThresholds] = useState({
    tau_roast_lower: 0.25,
    tau_shield: 0.7,
    tau_critical: 0.9,
    aggressiveness: 95
  });
  const [featureFlags, setFeatureFlags] = useState({
    shop_enabled: false,
    roast_versions: false,
    review_queue: false
  });
  const [healthStatus, setHealthStatus] = useState(null);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load global thresholds
      const thresholdsResponse = await adminApi.get('/backoffice/thresholds');
      if (thresholdsResponse.data.success) {
        setGlobalThresholds(thresholdsResponse.data.data.thresholds);
      }

      // Load feature flags
      const flagsResponse = await adminApi.get('/feature-flags');
      if (flagsResponse.data.success) {
        const backofficeFlags = flagsResponse.data.data.flags.filter(
          (f) => f.category === 'backoffice'
        );
        const flagsObj = {};
        backofficeFlags.forEach((flag) => {
          flagsObj[flag.flag_key] = flag.is_enabled;
        });
        setFeatureFlags(flagsObj);
      }

      // Load latest healthcheck status
      const healthResponse = await adminApi.get('/backoffice/healthcheck/status');
      if (healthResponse.data.success) {
        setHealthStatus(healthResponse.data.data);
      }
    } catch (error) {
      console.error('Error loading backoffice data:', error);
      setAlerts([{ type: 'error', message: 'Failed to load backoffice data' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleThresholdUpdate = async () => {
    setLoading(true);
    try {
      const response = await adminApi.put('/backoffice/thresholds', globalThresholds);
      if (response.data.success) {
        setAlerts([{ type: 'success', message: 'Global thresholds updated successfully' }]);
      }
    } catch (error) {
      console.error('Error updating thresholds:', error);
      setAlerts([{ type: 'error', message: 'Failed to update global thresholds' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFeatureFlagToggle = async (flagKey) => {
    try {
      const newValue = !featureFlags[flagKey];
      const response = await adminApi.put(`/feature-flags/${flagKey}`, {
        is_enabled: newValue
      });

      if (response.data.success) {
        setFeatureFlags((prev) => ({ ...prev, [flagKey]: newValue }));
        setAlerts([
          {
            type: 'success',
            message: `Feature flag ${flagKey} ${newValue ? 'enabled' : 'disabled'}`
          }
        ]);
      }
    } catch (error) {
      console.error('Error updating feature flag:', error);
      setAlerts([{ type: 'error', message: `Failed to update ${flagKey} flag` }]);
    }
  };

  const runHealthcheck = async () => {
    setLoading(true);
    try {
      const response = await adminApi.post('/backoffice/healthcheck', {
        platforms: ['twitter', 'youtube', 'discord', 'twitch']
      });

      if (response.data.success) {
        setHealthStatus(response.data.data);
        setAlerts([{ type: 'success', message: 'Healthcheck completed successfully' }]);
      }
    } catch (error) {
      console.error('Error running healthcheck:', error);
      setAlerts([{ type: 'error', message: 'Failed to run healthcheck' }]);
    } finally {
      setLoading(false);
    }
  };

  const exportAuditLogs = async (format) => {
    try {
      const response = await adminApi.get(`/backoffice/audit/export?format=${format}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      });

      if (format === 'csv') {
        // Handle CSV download
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `roastr-audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Handle JSON download
        const blob = new Blob([JSON.stringify(response.data, null, 2)], {
          type: 'application/json'
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `roastr-audit-logs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }

      setAlerts([{ type: 'success', message: `Audit logs exported as ${format.toUpperCase()}` }]);
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      setAlerts([{ type: 'error', message: 'Failed to export audit logs' }]);
    }
  };

  const getAggressivenessColor = (level) => {
    switch (level) {
      case 90:
        return 'bg-green-100 text-green-800';
      case 95:
        return 'bg-blue-100 text-blue-800';
      case 98:
        return 'bg-orange-100 text-orange-800';
      case 100:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthStatusColor = (status) => {
    switch (status) {
      case 'OK':
        return 'bg-green-100 text-green-800';
      case 'FAIL':
        return 'bg-red-100 text-red-800';
      case 'PARTIAL':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Backoffice Settings</h1>
          <p className="text-sm text-gray-600">
            Manage global thresholds, feature flags, and system monitoring
          </p>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {alerts.map((alert, index) => (
        <Alert
          key={index}
          className={
            alert.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
          }
        >
          <AlertTitle>{alert.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      ))}

      <Tabs defaultValue="thresholds" className="space-y-4">
        <TabsList>
          <TabsTrigger value="thresholds">
            <Shield className="h-4 w-4 mr-2" />
            Global Thresholds
          </TabsTrigger>
          <TabsTrigger value="flags">
            <Settings className="h-4 w-4 mr-2" />
            Feature Flags
          </TabsTrigger>
          <TabsTrigger value="healthcheck">
            <Activity className="h-4 w-4 mr-2" />
            Healthcheck
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Download className="h-4 w-4 mr-2" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* Global Thresholds Tab */}
        <TabsContent value="thresholds">
          <Card>
            <CardHeader>
              <CardTitle>Global Shield Thresholds</CardTitle>
              <CardDescription>
                Configure system-wide Shield thresholds that apply to all organizations by default
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Aggressiveness Level */}
              <div className="space-y-2">
                <Label htmlFor="aggressiveness">Aggressiveness Level</Label>
                <div className="flex items-center space-x-4">
                  <select
                    id="aggressiveness"
                    value={globalThresholds.aggressiveness}
                    onChange={(e) =>
                      setGlobalThresholds((prev) => ({
                        ...prev,
                        aggressiveness: parseInt(e.target.value)
                      }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                  >
                    <option value={90}>90% - Lenient (More tolerant approach)</option>
                    <option value={95}>95% - Balanced (Default approach)</option>
                    <option value={98}>98% - Strict (Stricter moderation)</option>
                    <option value={100}>100% - Maximum (Lowest tolerance)</option>
                  </select>
                  <Badge className={getAggressivenessColor(globalThresholds.aggressiveness)}>
                    {globalThresholds.aggressiveness}%
                  </Badge>
                </div>
              </div>

              {/* Individual Thresholds */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tau_roast_lower">τ Roast Lower</Label>
                  <Input
                    id="tau_roast_lower"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={globalThresholds.tau_roast_lower}
                    onChange={(e) =>
                      setGlobalThresholds((prev) => ({
                        ...prev,
                        tau_roast_lower: parseFloat(e.target.value)
                      }))
                    }
                  />
                  <p className="text-xs text-gray-500">Lower threshold for roast generation</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tau_shield">τ Shield</Label>
                  <Input
                    id="tau_shield"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={globalThresholds.tau_shield}
                    onChange={(e) =>
                      setGlobalThresholds((prev) => ({
                        ...prev,
                        tau_shield: parseFloat(e.target.value)
                      }))
                    }
                  />
                  <p className="text-xs text-gray-500">Shield activation threshold</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tau_critical">τ Critical</Label>
                  <Input
                    id="tau_critical"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={globalThresholds.tau_critical}
                    onChange={(e) =>
                      setGlobalThresholds((prev) => ({
                        ...prev,
                        tau_critical: parseFloat(e.target.value)
                      }))
                    }
                  />
                  <p className="text-xs text-gray-500">Critical threshold for immediate action</p>
                </div>
              </div>

              <Button onClick={handleThresholdUpdate} disabled={loading}>
                Update Global Thresholds
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Flags Tab */}
        <TabsContent value="flags">
          <Card>
            <CardHeader>
              <CardTitle>Backoffice Feature Flags</CardTitle>
              <CardDescription>Control system-wide feature availability</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Shop Feature</Label>
                    <p className="text-sm text-gray-500">Enable/disable the shop functionality</p>
                  </div>
                  <Switch
                    checked={featureFlags.shop_enabled}
                    onCheckedChange={() => handleFeatureFlagToggle('shop_enabled')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Multiple Roast Versions</Label>
                    <p className="text-sm text-gray-500">
                      Enable generation of multiple roast versions
                    </p>
                  </div>
                  <Switch
                    checked={featureFlags.roast_versions}
                    onCheckedChange={() => handleFeatureFlagToggle('roast_versions')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Review Queue</Label>
                    <p className="text-sm text-gray-500">
                      Enable manual review queue for sensitive content
                    </p>
                  </div>
                  <Switch
                    checked={featureFlags.review_queue}
                    onCheckedChange={() => handleFeatureFlagToggle('review_queue')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Healthcheck Tab */}
        <TabsContent value="healthcheck">
          <Card>
            <CardHeader>
              <CardTitle>Platform API Healthcheck</CardTitle>
              <CardDescription>Monitor the status of integrated platform APIs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium">Overall Status</h3>
                  {healthStatus && (
                    <p className="text-sm text-gray-500">
                      Last checked:{' '}
                      {new Date(
                        healthStatus.created_at || healthStatus.checked_at
                      ).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {healthStatus && (
                    <Badge className={getHealthStatusColor(healthStatus.overall_status)}>
                      {healthStatus.overall_status || 'UNKNOWN'}
                    </Badge>
                  )}
                  <Button onClick={runHealthcheck} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Run Check
                  </Button>
                </div>
              </div>

              {healthStatus && healthStatus.results && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(healthStatus.results).map(([platform, result]) => (
                    <div key={platform} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium capitalize">{platform}</h4>
                        <Badge className={getHealthStatusColor(result.status)}>
                          {result.status}
                        </Badge>
                      </div>
                      {result.error && <p className="text-sm text-red-600 mb-1">{result.error}</p>}
                      <p className="text-xs text-gray-500">
                        Response time: {result.response_time_ms}ms
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs Export</CardTitle>
              <CardDescription>
                Export admin activity logs for auditing and compliance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-4">
                <Button onClick={() => exportAuditLogs('csv')} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export as CSV
                </Button>
                <Button onClick={() => exportAuditLogs('json')} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export as JSON
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                Exports will include the last 30 days of admin actions including feature flag
                changes, threshold updates, and system configuration modifications.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BackofficeSettings;
