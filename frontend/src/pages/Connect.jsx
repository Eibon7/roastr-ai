import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  CheckCircle, 
  ExternalLink, 
  Download, 
  Loader2, 
  AlertCircle,
  ArrowRight,
  Users
} from 'lucide-react';
import { createMockFetch } from '../lib/mockMode';

export default function Connect() {
  const [platforms, setPlatforms] = useState([]);
  const [integrationStatus, setIntegrationStatus] = useState({});
  const [connecting, setConnecting] = useState(null);
  const [importing, setImporting] = useState(null);
  const [importProgress, setImportProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchApi = createMockFetch();

  useEffect(() => {
    fetchPlatforms();
    fetchIntegrationStatus();
  }, []);

  const fetchPlatforms = async () => {
    try {
      const response = await fetchApi('/api/integrations/platforms');
      if (response.ok) {
        const data = await response.json();
        setPlatforms(data.data.platforms);
      }
    } catch (error) {
      console.error('Failed to fetch platforms:', error);
    }
  };

  const fetchIntegrationStatus = async () => {
    try {
      const response = await fetchApi('/api/integrations/status');
      if (response.ok) {
        const data = await response.json();
        const statusMap = {};
        data.data.integrations.forEach(integration => {
          statusMap[integration.platform] = integration;
        });
        setIntegrationStatus(statusMap);
      }
    } catch (error) {
      console.error('Failed to fetch integration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform) => {
    setConnecting(platform);

    try {
      const response = await fetchApi('/api/integrations/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platform })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Connected to', platform, ':', data.data.message);
        
        // Update integration status
        await fetchIntegrationStatus();
        
        // Auto-start import after connection
        setTimeout(() => {
          handleImport(platform);
        }, 1000);
      } else {
        const error = await response.json();
        console.error('Connection failed:', error.error);
      }
    } catch (error) {
      console.error('Error connecting to platform:', error);
    } finally {
      setConnecting(null);
    }
  };

  const handleImport = async (platform) => {
    setImporting(platform);
    
    // Initialize progress tracking
    setImportProgress(prev => ({
      ...prev,
      [platform]: { status: 'starting', imported: 0, total: 300 }
    }));

    try {
      const response = await fetchApi('/api/integrations/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platform, limit: 300 })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Import started for', platform, ':', data.data.message);
        
        // Simulate progress updates
        simulateImportProgress(platform, data.data.imported);
        
      } else {
        const error = await response.json();
        console.error('Import failed:', error.error);
        setImportProgress(prev => ({
          ...prev,
          [platform]: { status: 'error', error: error.error }
        }));
      }
    } catch (error) {
      console.error('Error importing from platform:', error);
      setImportProgress(prev => ({
        ...prev,
        [platform]: { status: 'error', error: 'Import failed' }
      }));
    } finally {
      setImporting(null);
    }
  };

  const simulateImportProgress = (platform, totalItems) => {
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 50;
      
      if (currentProgress >= totalItems) {
        setImportProgress(prev => ({
          ...prev,
          [platform]: { 
            status: 'completed', 
            imported: totalItems, 
            total: totalItems 
          }
        }));
        clearInterval(interval);
        
        // Update integration status to reflect import completion
        setTimeout(fetchIntegrationStatus, 1000);
      } else {
        setImportProgress(prev => ({
          ...prev,
          [platform]: { 
            status: 'importing', 
            imported: Math.floor(currentProgress), 
            total: totalItems 
          }
        }));
      }
    }, 500);
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
    const connectedPlatforms = Object.values(integrationStatus)
      .filter(integration => integration.status === 'connected' && integration.importedCount >= 50);
    return connectedPlatforms.length > 0;
  };

  const getConnectedPlatformsWithData = () => {
    return Object.values(integrationStatus)
      .filter(integration => integration.status === 'connected' && integration.importedCount >= 50);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading platforms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Connect Your Platforms</h1>
        <p className="text-muted-foreground text-lg">
          Connect your social media accounts and import your content for style analysis
        </p>
      </div>

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
                  {isConnected && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Description */}
                <p className="text-sm text-muted-foreground">
                  {platform.description}
                </p>

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
                      <span className="text-sm">
                        {progress?.imported || importedCount} items
                      </span>
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
            <p><strong>Minimum Requirements:</strong></p>
            <ul className="space-y-1 ml-4">
              <li>• At least 50 imported items from any platform for Style Profile generation</li>
              <li>• Multiple platforms provide better analysis quality</li>
              <li>• Import process may take 1-5 minutes depending on content volume</li>
            </ul>
          </div>
          <div className="text-sm space-y-2">
            <p><strong>Supported Content Types:</strong></p>
            <ul className="space-y-1 ml-4">
              <li>• Posts, comments, replies from the last 30 days</li>
              <li>• Multiple languages automatically detected</li>
              <li>• Text content only (images/videos not analyzed)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}