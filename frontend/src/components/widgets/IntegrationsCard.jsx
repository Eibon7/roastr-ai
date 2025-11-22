import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Link2, ExternalLink } from 'lucide-react';
import { SkeletonLoader } from '../states/SkeletonLoader';
import { getIntegrations } from '../../api/integrations';
import { ErrorMessage } from '../states/ErrorMessage';
import { EmptyState } from '../states/EmptyState';

export default function IntegrationsCard() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      try {
        setError(null);
        const data = await getIntegrations();
        const list = data.integrations || data.data?.integrations || [];
        if (active) {
          setIntegrations(list);
        }
      } catch (fetchError) {
        console.error('Failed to fetch integrations:', fetchError);
        if (active) {
          setError('No pudimos obtener las integraciones. Revisa la conexión.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      active = false;
    };
  }, []);

  const connected = integrations.filter(i => i.status === 'connected');
  const disconnected = integrations.filter(i => i.status === 'disconnected');

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <SkeletonLoader rows={3} height={14} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && integrations.length === 0) {
    return (
      <ErrorMessage
        title="Error cargando integraciones"
        message={error}
        onRetry={() => {
          setLoading(true);
          setError(null);
          getIntegrations().then(data => setIntegrations(data.integrations || data.data?.integrations || [])).finally(() => setLoading(false));
        }}
      />
    );
  }

  if (!integrations.length) {
    return (
      <EmptyState
        title="Sin integraciones"
        description="Conecta una plataforma para empezar a generar estilo."
        actionLabel="Ver Connect"
        onAction={() => window.location.assign('/connect')}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link2 className="h-5 w-5" />
            <span>Integrations</span>
          </div>
          <Badge variant="outline">
            {connected.length}/{integrations.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
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

          <div className="pt-3 border-t">
            <button className="flex items-center space-x-2 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" />
              <span>Manage integrations</span>
            </button>
          </div>
        </div>
      </CardContent>
      {error && integrations.length > 0 && (
        <div className="p-3">
          <ErrorMessage title="Advertencia" message={error} variant="warning" />
        </div>
      )}
    </Card>
  );
}