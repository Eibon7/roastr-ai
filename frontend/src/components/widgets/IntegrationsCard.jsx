import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Link2, ExternalLink } from 'lucide-react';

export default function IntegrationsCard() {
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/integrations');
        if (res.ok) {
          setIntegrations(await res.json());
        }
      } catch (error) {
        console.error('Failed to fetch integrations:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const connected = integrations?.filter(i => i.status === 'connected') || [];
  const disconnected = integrations?.filter(i => i.status === 'disconnected') || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link2 className="h-5 w-5" />
            <span>Integrations</span>
          </div>
          <Badge variant="outline">
            {connected.length}/{integrations?.length || 0}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Connected */}
          {connected.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Connected
              </div>
              <div className="space-y-2">
                {connected.map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{integration.icon}</span>
                      <span className="text-sm font-medium">{integration.displayName}</span>
                    </div>
                    <Badge variant="success" className="text-xs">
                      Connected
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disconnected */}
          {disconnected.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Available
              </div>
              <div className="space-y-1">
                {disconnected.slice(0, 3).map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between p-1.5 rounded">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm opacity-60">{integration.icon}</span>
                      <span className="text-sm text-muted-foreground">{integration.displayName}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Available
                    </Badge>
                  </div>
                ))}
                {disconnected.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    +{disconnected.length - 3} more available
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t">
            <button className="flex items-center space-x-2 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" />
              <span>Manage integrations</span>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}