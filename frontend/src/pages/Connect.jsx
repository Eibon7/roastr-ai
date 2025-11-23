import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import PageLayout from '../components/roastr/PageLayout';
import {
  CheckCircle,
  ExternalLink,
  Download,
  Loader2,
  AlertCircle,
  ArrowRight,
  Users
} from 'lucide-react';
import {
  getAvailablePlatforms,
  getIntegrationStatus,
  connectPlatform,
  importFollowers,
  getImportProgress
} from '../api/integrations';

export default function Connect() {
  const [platforms, setPlatforms] = useState([]);
  const [integrationStatus, setIntegrationStatus] = useState({});
  const [connecting, setConnecting] = useState(null);
  const [importing, setImporting] = useState(null);
  const [importProgress, setImportProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchPlatforms = useCallback(async () => {
    try {
      setError(null);
      const data = await getAvailablePlatforms();
      setPlatforms(data.platforms || []);
    } catch (error) {
      console.error('Failed to fetch platforms:', error);
      setError('No se pudieron cargar las plataformas disponibles');
    }
  }, []);

  const fetchIntegrationStatus = useCallback(async () => {
    try {
      setError(null);
      const data = await getIntegrationStatus();
      const statusMap = {};
      (data.integrations || []).forEach((integration) => {
        statusMap[integration.platform] = integration;
      });
      setIntegrationStatus(statusMap);
    } catch (error) {
      console.error('Failed to fetch integration status:', error);
      setError('No se pudo cargar el estado de integraciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms();
    fetchIntegrationStatus();
  }, [fetchPlatforms, fetchIntegrationStatus]);

  const handleConnect = async (platform) => {
    setConnecting(platform);
    setError(null);

    try {
      // TODO: Add credentials dialog for platform-specific auth
      const credentials = {};

      const data = await connectPlatform(platform, credentials);

      if (data.success) {
        // Update integration status
        await fetchIntegrationStatus();

        // Auto-start import after connection
        setTimeout(() => {
          handleImport(platform);
        }, 1000);
      }
    } catch (error) {
      console.error('Error connecting to platform:', error);
      setError(`No se pudo conectar a ${platform}: ${error.message}`);
    } finally {
      setConnecting(null);
    }
  };

  const handleImport = async (platform) => {
    setImporting(platform);
    setError(null);

    // Initialize progress tracking
    setImportProgress((prev) => ({
      ...prev,
      [platform]: { status: 'starting', imported: 0, total: 300 }
    }));

    try {
      const data = await importFollowers(platform);

      if (data.success && data.jobId) {
        // Poll for progress updates
        pollImportProgress(platform, data.jobId);
      }
    } catch (error) {
      console.error('Error importing from platform:', error);
      setError(`No se pudo importar desde ${platform}: ${error.message}`);
      setImportProgress((prev) => ({
        ...prev,
        [platform]: { status: 'error', error: error.message }
      }));
      setImporting(null);
    }
  };

  const pollImportProgress = async (platform, jobId) => {
    const pollInterval = setInterval(async () => {
      try {
        const data = await getImportProgress(jobId);

        setImportProgress((prev) => ({
          ...prev,
          [platform]: {
            status: data.status,
            imported: data.imported || 0,
            total: 300,
            progress: data.progress || 0
          }
        }));

        // Stop polling when completed or error
        if (data.status === 'completed' || data.status === 'error') {
          clearInterval(pollInterval);
          setImporting(null);

          // Update integration status
          if (data.status === 'completed') {
            setTimeout(fetchIntegrationStatus, 1000);
          }
        }
      } catch (error) {
        console.error('Error polling import progress:', error);
        clearInterval(pollInterval);
        setImporting(null);
        setImportProgress((prev) => ({
          ...prev,
          [platform]: { status: 'error', error: 'Progress check failed' }
        }));
      }
    }, 2000); // Poll every 2 seconds
  };

  const getConnectionStatus = (platform) => {
    const integration = integrationStatus[platform];
    return integration ? integration.status : 'disconnected';
  };

  const getImportedCount = (platform) => {
    const integration = integrationStatus[platform];
    return integration ? integration.importedCount : 0;
  };

  const canProceedToStyleProfile = () => {
    const connectedPlatforms = Object.values(integrationStatus).filter(
      (integration) => integration.status === 'connected' && integration.importedCount >= 50
    );
    return connectedPlatforms.length > 0;
  };

  const getConnectedPlatformsWithData = () => {
    return Object.values(integrationStatus).filter(
      (integration) => integration.status === 'connected' && integration.importedCount >= 50
    );
  };

  if (loading) {
    return (
      <PageLayout
        title="Connect Your Platforms"
        subtitle="Conecta tus cuentas de redes sociales para análisis de estilo"
      >
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando plataformas...</p>
        </div>
      </PageLayout>
    );
  }

  if (error && platforms.length === 0) {
    return (
      <PageLayout
        title="Connect Your Platforms"
        subtitle="Conecta tus cuentas de redes sociales para análisis de estilo"
      >
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <AlertCircle className="h-6 w-6 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Error al cargar</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <Button
                  onClick={() => {
                    setLoading(true);
                    fetchPlatforms();
                    fetchIntegrationStatus();
                  }}
                  className="mt-4"
                  variant="outline"
                >
                  Reintentar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Connect Your Platforms"
      subtitle="Conecta tus redes sociales e importa contenido para análisis"
      metrics={[{ label: 'Listas para análisis', value: getConnectedPlatformsWithData().length }]}
    >
      {/* Error Banner */}
      {error && platforms.length > 0 && (
        <Card className="bg-yellow-50 border-yellow-200 mb-4">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Overview */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Platform Connections</h3>
                <p className="text-sm text-muted-foreground">
                  Connect at least one platform and import 50+ items to generate your Style Profile
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {getConnectedPlatformsWithData().length}
              </div>
              <div className="text-sm text-muted-foreground">Ready for analysis</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platforms Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((platform) => {
          const status = getConnectionStatus(platform.name);
          const importedCount = getImportedCount(platform.name);
          const isConnected = status === 'connected';
          const progress = importProgress[platform.name];
          const isConnecting = connecting === platform.name;
          const isImporting = importing === platform.name || progress?.status === 'importing';

          return (
            <Card
              key={platform.name}
              className={`relative ${isConnected ? 'border-green-200 bg-green-50' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{platform.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{platform.displayName}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Up to {platform.maxImportLimit} items
                      </p>
                    </div>
                  </div>
                  {isConnected && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Description */}
                <p className="text-sm text-muted-foreground">{platform.description}</p>

                {/* Connection Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Connection:</span>
                  <Badge variant={isConnected ? 'success' : 'outline'}>
                    {isConnected ? 'Connected' : 'Not Connected'}
                  </Badge>
                </div>

                {/* Import Status */}
                {isConnected && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Imported:</span>
                      <span className="text-sm">{progress?.imported || importedCount} items</span>
                    </div>

                    {progress && progress.status === 'importing' && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(progress.imported / progress.total) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  {!isConnected ? (
                    <Button
                      onClick={() => handleConnect(platform.name)}
                      disabled={isConnecting}
                      className="w-full"
                      size="sm"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Connect
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleImport(platform.name)}
                      disabled={isImporting}
                      variant="outline"
                      className="w-full"
                      size="sm"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Import Content
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Error Display */}
                {progress?.status === 'error' && (
                  <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-2 rounded">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs">{progress.error}</span>
                  </div>
                )}

                {/* Success for sufficient data */}
                {importedCount >= 50 && (
                  <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-2 rounded">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-xs">Ready for Style Profile generation</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Next Steps */}
      {canProceedToStyleProfile() && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-2">Ready for Style Profile!</h3>
                <p className="text-muted-foreground">
                  You have {getConnectedPlatformsWithData().length} platform(s) with enough content.
                  Generate your personalized AI Style Profile now.
                </p>
              </div>
              <Button
                onClick={() => navigate('/style-profile/generate')}
                size="lg"
                className="bg-purple-600 hover:bg-purple-700"
              >
                Generate Style Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <span>Connection Help</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <p>
              <strong>Minimum Requirements:</strong>
            </p>
            <ul className="space-y-1 ml-4">
              <li>• At least 50 imported items from any platform for Style Profile generation</li>
              <li>• Multiple platforms provide better analysis quality</li>
              <li>• Import process may take 1-5 minutes depending on content volume</li>
            </ul>
          </div>
          <div className="text-sm space-y-2">
            <p>
              <strong>Supported Content Types:</strong>
            </p>
            <ul className="space-y-1 ml-4">
              <li>• Posts, comments, replies from the last 30 days</li>
              <li>• Multiple languages automatically detected</li>
              <li>• Text content only (images/videos not analyzed)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
