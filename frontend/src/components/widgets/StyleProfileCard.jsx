import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Wand2, 
  Crown, 
  Globe, 
  Calendar,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  Copy,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { createMockFetch } from '../../lib/mockMode';

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

export default function StyleProfileCard() {
  const [profileStatus, setProfileStatus] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState(null);
  const navigate = useNavigate();

  const fetchApi = createMockFetch();

  useEffect(() => {
    fetchProfileStatus();
    fetchProfileData();
  }, []);

  const fetchProfileStatus = async () => {
    try {
      const response = await fetchApi('/api/style-profile/status');
      if (response.ok) {
        const data = await response.json();
        setProfileStatus(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch profile status:', error);
    }
  };

  const fetchProfileData = async () => {
    try {
      const response = await fetchApi('/api/style-profile');
      if (response.ok) {
        const data = await response.json();
        if (data.data.available) {
          setProfileData(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrompt = async (prompt, lang) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(lang);
      setTimeout(() => setCopiedPrompt(null), 2000);
    } catch (error) {
      console.error('Failed to copy prompt:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getCardContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      );
    }

    // No access (not Creator+)
    if (!profileStatus?.hasAccess) {
      return (
        <div className="text-center py-6">
          <Crown className="h-12 w-12 mx-auto mb-3 text-purple-500" />
          <h3 className="font-semibold mb-2">Style Profile Available</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upgrade to Creator+ to generate your personalized AI style profile
          </p>
          <Button 
            onClick={() => navigate('/plans')}
            size="sm" 
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Crown className="h-3 w-3 mr-1" />
            Upgrade to Creator+
          </Button>
        </div>
      );
    }

    // Has access but no profile generated yet
    if (!profileData) {
      return (
        <div className="text-center py-6">
          <Wand2 className="h-12 w-12 mx-auto mb-3 text-blue-500" />
          <h3 className="font-semibold mb-2">Generate Style Profile</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your personalized AI roast style based on your social media content
          </p>
          <Button 
            onClick={() => navigate('/style-profile/generate')}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Wand2 className="h-3 w-3 mr-1" />
            Generate First Profile
          </Button>
        </div>
      );
    }

    // Profile exists - show summary
    return (
      <div className="space-y-4">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-green-600">Profile Ready</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {profileData.profiles.length} language{profileData.profiles.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-blue-600">{profileData.totalItems}</div>
            <div className="text-xs text-muted-foreground">Items</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-600">{profileData.profiles.length}</div>
            <div className="text-xs text-muted-foreground">Languages</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">{Object.keys(profileData.sources).length}</div>
            <div className="text-xs text-muted-foreground">Platforms</div>
          </div>
        </div>

        {/* Language Profiles Preview */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Available Profiles:</label>
          {profileData.profiles.slice(0, 2).map((profile) => (
            <div key={profile.lang} className="bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span>{LANGUAGE_FLAGS[profile.lang] || '🌐'}</span>
                  <span className="text-sm font-medium">
                    {LANGUAGE_NAMES[profile.lang] || profile.lang.toUpperCase()}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {profile.metadata.totalItems} items
                  </Badge>
                </div>
                <Button
                  onClick={() => handleCopyPrompt(profile.prompt, profile.lang)}
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                >
                  {copiedPrompt === profile.lang ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2">
                {profile.prompt.substring(0, 120)}...
              </div>
            </div>
          ))}
          
          {profileData.profiles.length > 2 && (
            <div className="text-center py-2">
              <span className="text-xs text-muted-foreground">
                +{profileData.profiles.length - 2} more language{profileData.profiles.length - 2 !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="pt-3 border-t space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Created {formatDate(profileData.createdAt)}</span>
            </div>
            <div className="flex items-center space-x-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>{Object.entries(profileData.sources).map(([platform, count]) => `${platform}: ${count}`).join(', ')}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          <Button 
            onClick={() => navigate('/style-profile')}
            size="sm" 
            variant="outline"
            className="flex-1"
          >
            View Full Profile
          </Button>
          <Button 
            onClick={() => navigate('/style-profile/generate')}
            size="sm"
            className="flex-1"
          >
            <ArrowRight className="h-3 w-3 mr-1" />
            Update
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-base">
          <Wand2 className="h-4 w-4 text-purple-600" />
          <span>Style Profile</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {getCardContent()}
      </CardContent>
    </Card>
  );
}