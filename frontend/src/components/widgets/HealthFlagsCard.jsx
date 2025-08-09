import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Activity, AlertCircle, CheckCircle } from 'lucide-react';

export default function HealthFlagsCard() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          setHealth(await res.json());
        }
      } catch (error) {
        console.error('Failed to fetch health data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  const services = health?.services || {};
  const flags = health?.flags || {};

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'ok':
        return 'success';
      case 'degraded':
        return 'warning';
      default:
        return 'destructive';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>System Health</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Services Status */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Services
            </div>
            <div className="space-y-2">
              {Object.entries(services).map(([service, status]) => (
                <div key={service} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(status)}
                    <span className="text-sm capitalize">{service}</span>
                  </div>
                  <Badge variant={getStatusVariant(status)} className="text-xs">
                    {status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Feature Flags */}
          <div className="pt-3 border-t">
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Features
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">RQC System</span>
                <Badge variant={flags.rqc ? 'success' : 'outline'} className="text-xs">
                  {flags.rqc ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Shield Protection</span>
                <Badge variant={flags.shield ? 'success' : 'outline'} className="text-xs">
                  {flags.shield ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Mock Mode</span>
                <Badge variant={flags.mockMode ? 'warning' : 'outline'} className="text-xs">
                  {flags.mockMode ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div className="pt-2 text-xs text-muted-foreground text-center">
            Last updated: {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : 'Unknown'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}