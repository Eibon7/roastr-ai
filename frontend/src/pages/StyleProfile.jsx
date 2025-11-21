import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Wand2, 
  Copy, 
  Eye, 
  Crown, 
  Globe, 
  TrendingUp,
  Calendar,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { getIntegrationStatus } from '../api/integrations';
import ErrorBoundary from '../components/ErrorBoundary';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const LANGUAGE_FLAGS = {
  es: '🇪🇸',
  en: '🇺🇸',  
  pt: '🇧🇷',
  fr: '🇫🇷',
  it: '🇮🇹',
  de: '🇩🇪'
};

const LANGUAGE_NAMES = {
  es: 'Spanish',
  en: 'English',
  pt: 'Portuguese', 
  fr: 'French',
  it: 'Italian',
  de: 'German'
};

export default function StyleProfile() {
  const [profileData, setProfileData] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [integrationStatus, setIntegrationStatus] = useState([]);
  const [copiedPrompt, setCopiedPrompt] = useState(null);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const navigate = useNavigate();

  const checkAccess = useCallback(async () => {
    try {
      const response = await apiClient.get('/style-profile/status');
      const payload = response.data || response;
      const available = payload.available ?? payload.data?.available ?? false;
      const hasAccessFlag = payload.hasAccess ?? payload.data?.hasAccess ?? false;
      setHasAccess(available);

      if (!available && !hasAccessFlag) {
        setTimeout(() => navigate('/plans'), 100);
      }
    } catch (error) {
      // Error checking access
    }
  }, [navigate]);

  const fetchProfileData = useCallback(async () => {
    try {
      const response = await apiClient.get('/style-profile');
      const data = response.data || response;
      if (data.available ?? data.data?.available) {
        const profile = data.data || data;
        setProfileData(profile);
        setSelectedLanguage(profile.profiles?.[0]?.lang || null);
      }
    } catch (error) {
      // Error fetching profile data
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIntegrationStatus = useCallback(async () => {
    try {
      const data = await getIntegrationStatus();
      const integrations = data.integrations || data.data?.integrations || [];
      const connectedWithData = integrations.filter(
        integration => integration.status === 'connected' && integration.importedCount >= 50
      );
      setIntegrationStatus(connectedWithData);
    } catch (error) {
      // Error fetching integration status
    }
  }, []);

  useEffect(() => {
    checkAccess();
    fetchProfileData();
    fetchIntegrationStatus();
  }, [checkAccess, fetchProfileData, fetchIntegrationStatus]);

  const handleGenerateProfile = async () => {
    if (integrationStatus.length === 0) {
      setError('Please connect and import content from at least one platform first.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const platforms = integrationStatus.map(integration => integration.platform);
      const response = await apiClient.post('/style-profile/generate', {
        platforms,
        maxItemsPerPlatform: 300
      });

      const data = response.data || response;

      if (data.upgrade || data.requiresUpgrade) {
        setError('Style Profile generation requires Creator+ plan. Please upgrade your plan.');
        setTimeout(() => navigate('/plans'), 3000);
      } else if (data.success ?? true) {
        setProfileData(data);
        setSelectedLanguage(data.profiles?.[0]?.lang || null);
      } else {
        setError(`Generation failed: ${data.error || 'unknown error'}`);
      }
    } catch (error) {
      setError('Failed to generate style profile. Please check your connection and try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRetryGeneration = async () => {
    setRetrying(true);
    await handleGenerateProfile();
    setRetrying(false);
  };

  const clearError = () => {
    setError(null);
  };

  const handleCopyPrompt = async (prompt, lang) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(lang);
      setTimeout(() => setCopiedPrompt(null), 2000);
    } catch (error) {
      // Error copying prompt
    }
  };

  const handleDeleteProfile = async () => {
    try {
      await apiClient.delete('/style-profile');
      setProfileData(null);
      setSelectedLanguage(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      // Error deleting profile
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSelectedProfile = () => {
    if (!profileData || !selectedLanguage) return null;
    return profileData.profiles.find(p => p.lang === selectedLanguage);
  };

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="text-center p-8">
          <Crown className="h-16 w-16 mx-auto mb-4 text-purple-500" />
          <h2 className="text-2xl font-bold mb-2">Creator+ Required</h2>
          <p className="text-muted-foreground mb-6">
            Style Profile generation is only available with the Creator+ plan.
          </p>
          <Button onClick={() => navigate('/plans')} size="lg" className="bg-purple-600 hover:bg-purple-700">
            Upgrade to Creator+
          </Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading your style profile...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackMessage="Something went wrong with the Style Profile. Please refresh the page or try again later.">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-red-800 font-medium">Error</p>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </div>
                <div className="flex space-x-2">
                  {retrying ? (
                    <Button disabled size="sm" variant="outline" className="text-red-700 border-red-300">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Retrying...
                    </Button>
                  ) : (
                    <Button onClick={handleRetryGeneration} size="sm" variant="outline" className="text-red-700 border-red-300 hover:bg-red-100">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  )}
                  <Button onClick={clearError} size="sm" variant="outline" className="text-red-700 border-red-300 hover:bg-red-100">
                    <XCircle className="h-3 w-3 mr-1" />
                    Dismiss
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center justify-center space-x-2">
            <Wand2 className="h-8 w-8 text-purple-600" />
            <span>AI Style Profile</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Your personalized roast style based on your social media content
          </p>
        </div>

      {!profileData ? (
        /* No Profile Yet - Generation Interface */
        <div className="space-y-6">
          {/* Status Card */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <Wand2 className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">Generate Your Style Profile</h3>
                  <p className="text-muted-foreground mb-4">
                    Analyze your social media content to create a personalized AI roast style. 
                    We'll examine your tone, humor patterns, and language preferences across platforms.
                  </p>
                  
                  {integrationStatus.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">
                          {integrationStatus.length} platform(s) ready for analysis
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {integrationStatus.map(integration => (
                          <Badge key={integration.platform} variant="outline" className="text-xs">
                            {integration.displayName}: {integration.importedCount} items
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-orange-600">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">
                        Connect platforms and import content first
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4">
            {integrationStatus.length === 0 ? (
              <Button 
                onClick={() => navigate('/integrations/connect')}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Users className="h-4 w-4 mr-2" />
                Connect Platforms First
              </Button>
            ) : (
              <Button 
                onClick={handleGenerateProfile}
                disabled={generating}
                size="lg"
                className="bg-purple-600 hover:bg-purple-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Profile...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generate Style Profile
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Requirements Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Requirements & Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Minimum Requirements:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• At least 50 posts from any platform</li>
                    <li>• Content from last 30 days</li>
                    <li>• Creator+ plan subscription</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Analysis Features:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Multi-language detection</li>
                    <li>• Tone and humor analysis</li>
                    <li>• Writing pattern recognition</li>
                    <li>• Custom example generation</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Existing Profile - Display Interface */
        <div className="space-y-6">
          {/* Profile Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <CardTitle>Style Profile Ready</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    onClick={handleGenerateProfile}
                    disabled={generating}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                  <Button 
                    onClick={handleDeleteClick}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Created</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(profileData.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Items Analyzed</div>
                    <div className="text-xs text-muted-foreground">
                      {profileData.totalItems} posts
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Languages</div>
                    <div className="text-xs text-muted-foreground">
                      {profileData.profiles.length} detected
                    </div>
                  </div>
                </div>
              </div>

              {/* Platform Sources */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(profileData.sources).map(([platform, count]) => (
                  <Badge key={platform} variant="outline" className="text-xs">
                    {platform}: {count} items
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Language Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>Language Profiles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-6">
                {profileData.profiles.map((profile) => (
                  <Button
                    key={profile.lang}
                    onClick={() => setSelectedLanguage(profile.lang)}
                    variant={selectedLanguage === profile.lang ? 'default' : 'outline'}
                    size="sm"
                  >
                    <span className="mr-2">{LANGUAGE_FLAGS[profile.lang] || '🌐'}</span>
                    {LANGUAGE_NAMES[profile.lang] || profile.lang.toUpperCase()}
                  </Button>
                ))}
              </div>

              {/* Selected Language Profile */}
              {getSelectedProfile() && (
                <div className="space-y-6">
                  <Card className="border-purple-200">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <span>{LANGUAGE_FLAGS[selectedLanguage] || '🌐'}</span>
                        <span>{LANGUAGE_NAMES[selectedLanguage] || selectedLanguage.toUpperCase()} Style Profile</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Style Prompt */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">AI Prompt:</label>
                          <Button
                            onClick={() => handleCopyPrompt(getSelectedProfile().prompt, selectedLanguage)}
                            size="sm"
                            variant="outline"
                          >
                            {copiedPrompt === selectedLanguage ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-sm font-mono">
                          {getSelectedProfile().prompt}
                        </div>
                      </div>

                      {/* Examples */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">Style Examples:</label>
                        <div className="space-y-2">
                          {getSelectedProfile().examples.map((example, index) => (
                            <div key={index} className="bg-blue-50 p-3 rounded-lg text-sm">
                              "{example}"
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
                        <div>
                          <div className="text-xs text-muted-foreground">Content Analyzed</div>
                          <div className="font-medium">{getSelectedProfile().metadata.totalItems} items</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Avg Length</div>
                          <div className="font-medium">{getSelectedProfile().metadata.avgLength} chars</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Dominant Tone</div>
                          <div className="font-medium capitalize">{getSelectedProfile().metadata.dominantTone}</div>
                        </div>
                      </div>

                      {/* Platform Sources for this language */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Sources for {LANGUAGE_NAMES[selectedLanguage]}:</label>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(getSelectedProfile().sources).map(([platform, count]) => (
                            <Badge key={platform} variant="secondary" className="text-xs">
                              {platform}: {count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-green-100 p-3 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">Your Style Profile is Ready!</h3>
                  <p className="text-muted-foreground">
                    Your personalized AI style profile has been generated and saved. 
                    You can now use these prompts for generating roasts or view them anytime from your dashboard.
                  </p>
                </div>
                <Button onClick={() => navigate('/dashboard')} size="lg">
                  <Eye className="h-4 w-4 mr-2" />
                  View in Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={handleDeleteProfile}
        onCancel={handleDeleteCancel}
        title="Delete Style Profile"
        message="Are you sure you want to delete your style profile? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
      </div>
    </ErrorBoundary>
  );
}