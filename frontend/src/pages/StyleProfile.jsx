/**
 * StyleProfile.jsx - AI Style Profile Management
 * Requires connected social media accounts to generate style profiles
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Brain,
  Wand2,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Languages,
  BarChart3,
  Eye,
  Trash2,
  RefreshCw,
  Link as LinkIcon
} from 'lucide-react';
import IntegrationStatusCard from '../components/widgets/IntegrationStatusCard';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const StyleProfile = () => {
  const [profile, setProfile] = useState(null);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load profile status and connections
  const loadData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        navigate('/auth.html');
        return;
      }

      const [statusRes, connectionsRes] = await Promise.all([
        fetch('/api/style-profile/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/integrations/connections', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!statusRes.ok || !connectionsRes.ok) {
        throw new Error('Failed to load data');
      }

      const statusData = await statusRes.json();
      const connectionsData = await connectionsRes.json();

      if (statusData.success) {
        setHasAccess(statusData.data.hasAccess);
        
        if (statusData.data.available && statusData.data.profile) {
          setProfile(statusData.data.profile);
        }
      }

      if (connectionsData.success) {
        setConnections(connectionsData.data.connections);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load style profile data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Load full profile data
  const loadProfile = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/style-profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const data = await response.json();
      if (data.success && data.data.available) {
        setProfile(data.data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // Generate style profile
  const generateProfile = async () => {
    try {
      setGenerating(true);
      const token = localStorage.getItem('access_token');
      
      const connectedPlatforms = connections
        .filter(conn => conn.connected)
        .map(conn => conn.platform);

      if (connectedPlatforms.length === 0) {
        throw new Error('No connected platforms available');
      }

      const response = await fetch('/api/style-profile/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platforms: connectedPlatforms,
          maxItemsPerPlatform: 300
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();
      if (data.success) {
        setProfile(data.data);
        toast({
          title: 'Style Profile Generated',
          description: `Successfully analyzed ${data.data.totalItems} items across ${data.data.profiles.length} languages`,
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  // Delete profile
  const deleteProfile = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/style-profile', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to delete profile');
      }

      setProfile(null);
      toast({
        title: 'Profile Deleted',
        description: 'Style profile has been deleted successfully',
        variant: 'default',
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Preview language profile
  const previewLanguage = async (language) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/style-profile/preview/${language}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to load preview');
      }

      const data = await response.json();
      if (data.success) {
        setPreviewData(data.data);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast({
        title: 'Preview Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Connection handlers
  const handleConnect = (platform) => {
    navigate('/connect');
  };

  const handleDisconnect = async (platform) => {
    // Implementation handled in IntegrationStatusCard
    await loadData();
  };

  const handleRefresh = async (platform) => {
    // Implementation handled in IntegrationStatusCard
    await loadData();
  };

  // Check requirements
  const connectedPlatforms = connections.filter(conn => conn.connected);
  const hasConnections = connectedPlatforms.length > 0;
  const minConnectionsRequired = 1;
  const meetsRequirements = hasConnections && hasAccess;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Access denied
  if (!hasAccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Style Profile is a Creator+ feature. Please upgrade your plan to access this functionality.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Brain className="w-8 h-8 text-purple-600" />
          AI Style Profile
        </h1>
        <p className="text-muted-foreground">
          Generate personalized writing style profiles from your social media content
        </p>
      </div>

      {/* Connection Requirement Check */}
      {!hasConnections && (
        <Alert className="mb-6">
          <LinkIcon className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>You need to connect at least one social media account to generate a style profile.</span>
            <Button onClick={() => navigate('/connect')} size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              Connect Accounts
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Connections Status */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Connected Accounts</span>
                <Badge variant={hasConnections ? 'default' : 'outline'}>
                  {connectedPlatforms.length} connected
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {connections.map((connection) => (
                <IntegrationStatusCard
                  key={connection.platform}
                  connection={connection}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  onRefresh={handleRefresh}
                  compact={true}
                />
              ))}
              
              {connections.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    No social media accounts configured
                  </p>
                  <Button onClick={() => navigate('/connect')} size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Setup Connections
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2">
          {!profile ? (
            // Generate Profile Card
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5" />
                  Generate Your Style Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Analyze your writing style across connected social media platforms to create 
                    a personalized AI profile that matches your voice and tone.
                  </p>

                  {/* Requirements Checklist */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {hasAccess ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-sm">Creator+ Plan Required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasConnections ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-sm">
                        Social Media Connected ({connectedPlatforms.length}/{minConnectionsRequired} minimum)
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={generateProfile}
                    disabled={!meetsRequirements || generating}
                    className="w-full"
                    size="lg"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating Profile...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Generate Style Profile
                      </>
                    )}
                  </Button>

                  {!meetsRequirements && (
                    <p className="text-sm text-muted-foreground text-center">
                      {!hasAccess 
                        ? "Upgrade to Creator+ to unlock style profiles"
                        : "Connect at least one social media account to continue"
                      }
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            // Profile Dashboard
            <div className="space-y-6">
              {/* Profile Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-purple-600" />
                        Your Style Profile
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Generated from {profile.totalItems} items across {profile.profiles?.length} languages
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={loadProfile}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                      </Button>
                      <Button variant="outline" onClick={() => setProfile(null)}>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Regenerate
                      </Button>
                      <Button variant="outline" onClick={deleteProfile}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{profile.profiles?.length || 0}</div>
                      <div className="text-sm text-muted-foreground">Languages</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{profile.totalItems || 0}</div>
                      <div className="text-sm text-muted-foreground">Items Analyzed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{Object.keys(profile.sources || {}).length}</div>
                      <div className="text-sm text-muted-foreground">Platforms</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Language Profiles */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Languages className="w-5 h-5" />
                    Language Profiles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {profile.profiles?.map((langProfile) => (
                      <div key={langProfile.lang} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold capitalize">{langProfile.lang}</h4>
                            <p className="text-sm text-muted-foreground">
                              {langProfile.metadata.totalItems} items analyzed
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => previewLanguage(langProfile.lang)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Preview
                          </Button>
                        </div>
                        
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span>Style:</span>
                            <Badge variant="outline">{langProfile.metadata.styleType}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Tone:</span>
                            <Badge variant="outline">{langProfile.metadata.dominantTone}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Avg Length:</span>
                            <span>{langProfile.metadata.avgLength} chars</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Style Profile Preview - {previewData?.language}
            </DialogTitle>
            <DialogDescription>
              AI-generated writing style analysis and examples
            </DialogDescription>
          </DialogHeader>
          
          {previewData && (
            <div className="space-y-4">
              <Tabs defaultValue="prompt" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="prompt">AI Prompt</TabsTrigger>
                  <TabsTrigger value="examples">Examples</TabsTrigger>
                  <TabsTrigger value="metadata">Analysis</TabsTrigger>
                </TabsList>
                
                <TabsContent value="prompt" className="space-y-2">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">
                      {previewData.preview.prompt}
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="examples" className="space-y-2">
                  {previewData.preview.examples?.map((example, index) => (
                    <div key={index} className="p-3 border rounded">
                      <p className="text-sm">{example}</p>
                    </div>
                  ))}
                </TabsContent>
                
                <TabsContent value="metadata" className="space-y-2">
                  <div className="grid gap-3 text-sm">
                    <div className="flex justify-between">
                      <span>Items Analyzed:</span>
                      <span>{previewData.preview.metadata.totalItems}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Average Length:</span>
                      <span>{previewData.preview.metadata.avgLength} chars</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dominant Tone:</span>
                      <Badge variant="outline">{previewData.preview.metadata.dominantTone}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Style Type:</span>
                      <Badge variant="outline">{previewData.preview.metadata.styleType}</Badge>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StyleProfile;