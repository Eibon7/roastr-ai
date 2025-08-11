/**
 * Connect.jsx - Social Media Connection Wizard
 * Step-by-step platform connection interface with mock mode support
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Separator } from '../components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Info,
  Shield,
  Loader2
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

// Platform icons (you can replace with actual icons)
const PlatformIcons = {
  twitter: '𝕏',
  instagram: '📷',
  youtube: '📺',
  tiktok: '🎵',
  linkedin: '💼',
  facebook: '👥',
  bluesky: '🦋'
};

const Connect = () => {
  const [connections, setConnections] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [mockMode, setMockMode] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const { toast } = useToast();

  // Load connections and platforms
  const loadData = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const [connectionsRes, platformsRes] = await Promise.all([
        fetch('/api/integrations/connections', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/integrations/platforms', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!connectionsRes.ok || !platformsRes.ok) {
        throw new Error('Failed to load data');
      }

      const connectionsData = await connectionsRes.json();
      const platformsData = await platformsRes.json();

      if (connectionsData.success && platformsData.success) {
        setConnections(connectionsData.data.connections);
        setPlatforms(platformsData.data.platforms);
        setMockMode(connectionsData.data.mockMode);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load connection data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle platform connection
  const handleConnect = async (platform) => {
    try {
      setConnecting(platform);
      const token = localStorage.getItem('access_token');

      const response = await fetch(`/api/integrations/${platform}/connect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Connection failed');
      }

      if (data.success) {
        if (data.data.status === 'already_connected') {
          toast({
            title: 'Already Connected',
            description: `You're already connected to ${platform}`,
            variant: 'default',
          });
        } else {
          // Handle OAuth flow
          if (mockMode) {
            // Mock OAuth - simulate popup
            handleMockOAuth(platform, data.data);
          } else {
            // Real OAuth - redirect to authorization URL
            window.location.href = data.data.authUrl;
          }
        }
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: 'Connection Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setConnecting(null);
    }
  };

  // Handle mock OAuth flow
  const handleMockOAuth = (platform, authData) => {
    setSelectedPlatform({ platform, authData });
    setShowWizard(true);
    setWizardStep(1);
  };

  // Simulate OAuth callback for mock mode
  const simulateMockCallback = async () => {
    try {
      setWizardStep(2);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate callback URL with mock parameters
      const mockCode = 'mock_auth_code_' + Date.now();
      const state = selectedPlatform.authData.state;
      
      // Call the callback endpoint
      const callbackUrl = `/api/auth/${selectedPlatform.platform}/callback?code=${mockCode}&state=${state}`;
      
      // In mock mode, we'll simulate this by directly updating our connections
      await loadData();
      
      setWizardStep(3);
      
      toast({
        title: 'Connected Successfully',
        description: `Successfully connected to ${selectedPlatform.platform}`,
        variant: 'default',
      });

      // Close wizard after a moment
      setTimeout(() => {
        setShowWizard(false);
        setSelectedPlatform(null);
        setWizardStep(1);
      }, 2000);

    } catch (error) {
      console.error('Mock OAuth error:', error);
      toast({
        title: 'Connection Failed',
        description: error.message,
        variant: 'destructive',
      });
      setShowWizard(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async (platform) => {
    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch(`/api/integrations/${platform}/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Disconnect failed');
      }

      toast({
        title: 'Disconnected',
        description: `Successfully disconnected from ${platform}`,
        variant: 'default',
      });

      // Reload connections
      await loadData();
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: 'Disconnect Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Handle token refresh
  const handleRefresh = async (platform) => {
    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch(`/api/integrations/${platform}/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Refresh failed');
      }

      toast({
        title: 'Tokens Refreshed',
        description: `Successfully refreshed ${platform} tokens`,
        variant: 'default',
      });

      // Reload connections
      await loadData();
    } catch (error) {
      console.error('Refresh error:', error);
      toast({
        title: 'Refresh Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Get connection status component
  const getStatusBadge = (connection) => {
    const statusConfig = {
      connected: { variant: 'default', icon: CheckCircle, text: 'Connected' },
      expired: { variant: 'secondary', icon: Clock, text: 'Token Expired' },
      error: { variant: 'destructive', icon: XCircle, text: 'Error' },
      disconnected: { variant: 'outline', icon: XCircle, text: 'Not Connected' }
    };

    const config = statusConfig[connection.status] || statusConfig.disconnected;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  // Calculate connection progress
  const connectedCount = connections.filter(c => c.connected).length;
  const totalCount = platforms.length;
  const progress = totalCount > 0 ? (connectedCount / totalCount) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Connect Your Social Media</h1>
        <p className="text-muted-foreground mb-4">
          Connect your social media accounts to start generating AI-powered style profiles
        </p>

        {mockMode && (
          <Alert className="mb-4">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Mock mode is enabled. All connections are simulated for testing purposes.
            </AlertDescription>
          </Alert>
        )}

        {/* Progress Overview */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Connection Progress</h3>
                <p className="text-sm text-muted-foreground">
                  {connectedCount} of {totalCount} platforms connected
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{Math.round(progress)}%</div>
                <div className="text-sm text-muted-foreground">Complete</div>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Platform Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {connections.map((connection) => {
          const platform = platforms.find(p => p.platform === connection.platform);
          const isConnecting = connecting === connection.platform;
          
          return (
            <Card key={connection.platform} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {PlatformIcons[connection.platform] || '📱'}
                    </div>
                    <div>
                      <CardTitle className="capitalize">{connection.platform}</CardTitle>
                      <CardDescription>
                        {platform?.requirements?.estimatedTime || '3-5 minutes'}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(connection)}
                </div>
              </CardHeader>

              <CardContent>
                {/* Connection Details */}
                {connection.connected && connection.user_info && (
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="font-medium">Connected Account</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {connection.user_info.name || connection.user_info.username || 'Connected User'}
                    </p>
                    {connection.connectedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Connected {new Date(connection.connectedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Requirements */}
                {platform?.requirements && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2">Required Permissions:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {platform.requirements.permissions.map((permission, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                          {permission}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {connection.connected ? (
                    <>
                      {connection.status === 'expired' && (
                        <Button
                          size="sm"
                          onClick={() => handleRefresh(connection.platform)}
                          className="flex items-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Refresh
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(connection.platform)}
                        className="flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => handleConnect(connection.platform)}
                      disabled={isConnecting}
                      className="flex items-center gap-2"
                    >
                      {isConnecting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ExternalLink className="w-4 h-4" />
                      )}
                      {isConnecting ? 'Connecting...' : 'Connect'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Mock OAuth Wizard Dialog */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="text-2xl">
                {selectedPlatform && PlatformIcons[selectedPlatform.platform]}
              </div>
              Connect to {selectedPlatform?.platform}
            </DialogTitle>
            <DialogDescription>
              {mockMode ? 'Simulating OAuth connection flow' : 'Follow the authorization steps'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-6xl mb-4">🔐</div>
                  <h3 className="text-lg font-semibold mb-2">Authorize Access</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    You'll be redirected to {selectedPlatform?.platform} to authorize access to your account.
                  </p>
                </div>
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This is a simulated OAuth flow for testing purposes. In production, you'd be redirected to the actual platform.
                  </AlertDescription>
                </Alert>

                <Button onClick={simulateMockCallback} className="w-full">
                  Continue to Authorization
                </Button>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4 text-center">
                <div className="text-6xl mb-4">⏳</div>
                <h3 className="text-lg font-semibold mb-2">Processing...</h3>
                <p className="text-sm text-muted-foreground">
                  Completing the authorization process
                </p>
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-lg font-semibold mb-2">Successfully Connected!</h3>
                <p className="text-sm text-muted-foreground">
                  Your {selectedPlatform?.platform} account is now connected
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Help Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Need Help?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">Why Connect Social Media?</h4>
              <p className="text-sm text-muted-foreground">
                Connecting your accounts allows our AI to analyze your writing style 
                and generate personalized content that matches your voice.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Privacy & Security</h4>
              <p className="text-sm text-muted-foreground">
                We only read your public posts to analyze writing patterns. 
                We never post without your explicit permission.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Connect;