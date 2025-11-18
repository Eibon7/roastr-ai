import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import PageLayout from '../components/roastr/PageLayout';
import { Link2, ExternalLink, Settings, CheckCircle, AlertCircle } from 'lucide-react';

export default function Integrations() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIntegrations() {
      try {
        const response = await fetch('/api/integrations');
        if (response.ok) {
          const data = await response.json();
          setIntegrations(data);
        }
      } catch (error) {
        console.error('Failed to fetch integrations:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchIntegrations();
  }, []);

  const handleConnect = (integrationName) => {
    // In real implementation, this would redirect to OAuth flow
  };

  const handleDisconnect = (integrationName) => {
    // In real implementation, this would revoke the connection
  };

  const connected = integrations.filter(i => i.status === 'connected');
  const available = integrations.filter(i => i.status === 'disconnected');

  if (loading) {
    return (
      <PageLayout 
        title="Integrations"
        subtitle="Conecta tus redes sociales para automatizar respuestas"
      >
        <p className="text-muted-foreground">Cargando integraciones...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Integrations"
      subtitle="Conecta tus redes sociales para automatizar respuestas"
      metrics={[{ label: 'Conectadas', value: `${connected.length}/${integrations.length}` }]}
    >

      {/* Connected Integrations */}
      {connected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Connected Platforms</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connected.map((integration) => (
                <div
                  key={integration.name}
                  className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{integration.icon}</span>
                      <div>
                        <div className="font-medium">{integration.displayName}</div>
                        <div className="text-sm text-muted-foreground">
                          Connected as @{integration.username || 'username'}
                        </div>
                      </div>
                    </div>
                    <Badge variant="success" className="text-xs">
                      Active
                    </Badge>
                  </div>
                  
                  <div className="mt-4 flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(integration.name)}
                    >
                      Disconnect
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-1" />
                      Settings
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Link2 className="h-5 w-5" />
            <span>Available Platforms</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {available.map((integration) => (
              <div
                key={integration.name}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl opacity-60">{integration.icon}</span>
                    <div>
                      <div className="font-medium">{integration.displayName}</div>
                      <div className="text-sm text-muted-foreground">
                        {integration.description || 'Connect your account'}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Available
                  </Badge>
                </div>
                
                <div className="mt-4">
                  <Button
                    onClick={() => handleConnect(integration.name)}
                    className="w-full"
                    size="sm"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect
                  </Button>
                </div>

                {/* Features list */}
                <div className="mt-3 text-xs text-muted-foreground">
                  <div>• Auto-reply to mentions</div>
                  <div>• Toxicity detection</div>
                  <div>• Custom response rules</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integration Stats */}
      {connected.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <div className="text-xs text-muted-foreground">This month</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Blocked Toxic</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">89</div>
              <div className="text-xs text-muted-foreground">Shield actions</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">98.5%</div>
              <div className="text-xs text-muted-foreground">Delivery rate</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <span>Integration Help</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <strong>Need help connecting a platform?</strong>
          </div>
          <div className="text-sm text-muted-foreground space-y-2">
            <div>• Make sure you have admin access to your social media accounts</div>
            <div>• Some platforms require approval for automated posting</div>
            <div>• Check your platform's API limits and restrictions</div>
          </div>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            View Documentation
          </Button>
        </CardContent>
      </Card>
    </PageLayout>
  );
}