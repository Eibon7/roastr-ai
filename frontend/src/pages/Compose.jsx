import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Send, Sparkles, Eye, Save } from 'lucide-react';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useToast } from '../hooks/use-toast';

export default function Compose() {
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('twitter');
  const [styleProfile, setStyleProfile] = useState({});
  const { isEnabled } = useFeatureFlags();
  const [persona, setPersona] = useState('');
  const [tokensUsed, setTokensUsed] = useState(0);
  const [analysisRemaining, setAnalysisRemaining] = useState(null);
  const [roastsRemaining, setRoastsRemaining] = useState(null);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const handlePreview = async () => {
    if (!message.trim()) return;
    
    // Prevent concurrent requests
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get auth token - use consistent key
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError({
          type: 'auth',
          message: 'Please log in to generate roasts'
        });
        return;
      }
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch('/api/roast/preview', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          text: message,
          styleProfile: styleProfile,
          persona: persona || null,
          platform: selectedPlatform
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setPreview(data.roast || data.data?.roast);
        setTokensUsed(data.tokensUsed || data.data?.tokensUsed || 0);
        setAnalysisRemaining(data.analysisCountRemaining || data.data?.analysisCountRemaining);
        setRoastsRemaining(data.roastsRemaining || data.data?.roastsRemaining);
      } else {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Unknown server error' };
        }
        
        if (response.status === 401) {
          setError({
            type: 'auth',
            message: 'Session expired. Please log in again.'
          });
        } else if (response.status === 402) {
          setError({
            type: 'credits',
            message: errorData.details?.message || errorData.error || 'Insufficient credits'
          });
        } else if (response.status === 429) {
          setError({
            type: 'rate_limit',
            message: 'Too many requests. Please wait a moment and try again.'
          });
        } else if (response.status >= 500) {
          setError({
            type: 'server',
            message: 'Server error. Please try again later.'
          });
        } else {
          setError({
            type: 'general',
            message: errorData.error || errorData.message || 'Failed to generate preview'
          });
        }
      }
    } catch (error) {
      console.error('Failed to generate preview:', error);
      
      if (error.name === 'AbortError') {
        setError({
          type: 'timeout',
          message: 'Request timed out. Please try again.'
        });
      } else if (!navigator.onLine) {
        setError({
          type: 'offline',
          message: 'No internet connection. Please check your connection and try again.'
        });
      } else {
        setError({
          type: 'network',
          message: 'Network error. Please check your connection and try again.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!preview) return;
    
    // Prevent concurrent requests
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError({
          type: 'auth',
          message: 'Please log in to send roasts'
        });
        return;
      }
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      // Use the /generate endpoint to consume roast credits
      const response = await fetch('/api/roast/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          text: message,
          styleProfile: styleProfile,
          persona: persona || null,
          platform: selectedPlatform
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        
        // Update credits after successful roast generation
        setRoastsRemaining(data.data?.credits?.remaining || roastsRemaining - 1);
        
        // In real implementation, this would send to selected platforms
        console.log('Roast generated and sent:', data.data.roast);
        
        // Clear form
        setMessage('');
        setPreview(null);
        setPersona('');
        setError(null);
        
        // Show success message
        toast({
          title: 'Success!',
          description: 'Roast generated and ready to send!',
          variant: 'success'
        });
        
      } else {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Unknown server error' };
        }
        
        if (response.status === 401) {
          setError({
            type: 'auth',
            message: 'Session expired. Please log in again.'
          });
        } else if (response.status === 402) {
          setError({
            type: 'credits',
            message: errorData.details?.message || errorData.error || 'Insufficient roast credits'
          });
        } else if (response.status === 429) {
          setError({
            type: 'rate_limit',
            message: 'Too many requests. Please wait a moment and try again.'
          });
        } else if (response.status >= 500) {
          setError({
            type: 'server',
            message: 'Server error. Please try again later.'
          });
        } else {
          setError({
            type: 'general',
            message: errorData.error || errorData.message || 'Failed to generate final roast'
          });
        }
      }
    } catch (error) {
      console.error('Failed to send roast:', error);
      
      if (error.name === 'AbortError') {
        setError({
          type: 'timeout',
          message: 'Request timed out. Please try again.'
        });
      } else if (!navigator.onLine) {
        setError({
          type: 'offline',
          message: 'No internet connection. Please check your connection and try again.'
        });
      } else {
        setError({
          type: 'network',
          message: 'Network error. Please check your connection and try again.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compose Roast</h1>
        <p className="text-muted-foreground">
          Generate and send AI-powered roasts to your social media platforms
        </p>
        {/* Credit Display */}
        {(analysisRemaining !== null || roastsRemaining !== null) && (
          <div className="flex space-x-4 mt-2 text-sm text-muted-foreground">
            {analysisRemaining !== null && (
              <span>Análisis restantes: <Badge variant="outline">{analysisRemaining}</Badge></span>
            )}
            {roastsRemaining !== null && (
              <span>Roasts restantes: <Badge variant="outline">{roastsRemaining}</Badge></span>
            )}
            {tokensUsed > 0 && (
              <span>Tokens usados: <Badge variant="secondary">{tokensUsed}</Badge></span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5" />
              <span>Input Message</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error Display */}
            {error && (
              <div className={`p-3 rounded-md text-sm ${
                error.type === 'credits' 
                  ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                  : error.type === 'auth'
                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                  : error.type === 'rate_limit' || error.type === 'timeout'
                  ? 'bg-orange-50 text-orange-800 border border-orange-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {error.message}
                {error.type === 'credits' && (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" className="text-xs">
                      Actualizar Plan
                    </Button>
                  </div>
                )}
                {error.type === 'auth' && (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => window.location.href = '/login'}>
                      Iniciar Sesión
                    </Button>
                  </div>
                )}
                {(error.type === 'rate_limit' || error.type === 'timeout') && (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setError(null)}>
                      Reintentar
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-2">
                Message to roast
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter the message you want to generate a roast for..."
                className="w-full min-h-32 p-3 border border-input rounded-md bg-background"
                maxLength={500}
              />
              <div className="text-xs text-muted-foreground mt-1">
                {message.length}/500 characters
              </div>
            </div>

            {/* Platform Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Platform</label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full p-2 border border-input rounded-md bg-background text-sm"
              >
                <option value="twitter">🐦 Twitter</option>
                {isEnabled('ENABLE_FACEBOOK_UI') && <option value="facebook">📘 Facebook</option>}
                {isEnabled('ENABLE_INSTAGRAM_UI') && <option value="instagram">📷 Instagram</option>}
                <option value="youtube">📺 YouTube</option>
                <option value="tiktok">🎵 TikTok</option>
                <option value="reddit">🔴 Reddit</option>
                <option value="discord">💬 Discord</option>
                <option value="twitch">🎮 Twitch</option>
                <option value="bluesky">🦋 Bluesky</option>
              </select>
            </div>

            {/* Persona Input */}
            <div>
              <label htmlFor="persona" className="block text-sm font-medium mb-2">
                Persona (Optional)
              </label>
              <input
                id="persona"
                type="text"
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder="e.g., Sarcastic comedian, Tech reviewer, etc."
                className="w-full p-2 border border-input rounded-md bg-background text-sm"
                maxLength={100}
              />
            </div>

            <div className="flex space-x-2">
              <Button 
                onClick={handlePreview}
                disabled={!message.trim() || loading}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-2" />
                {loading ? 'Generating...' : 'Generate Preview'}
              </Button>
              <Button
                variant="outline"
                disabled={!message.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview & Send */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Send className="h-5 w-5" />
                <span>Roast Preview</span>
              </div>
              {preview && (
                <Badge variant="success" className="text-xs">
                  Ready to send
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : preview ? (
              <>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm font-medium mb-2">Generated Roast:</div>
                  <div className="text-foreground">{preview}</div>
                </div>
                
                {/* Platform and Metadata Display */}
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium mb-1">Target Platform:</div>
                    <Badge variant="outline" className="text-xs">
                      {selectedPlatform === 'twitter' && '🐦 Twitter'}
                      {selectedPlatform === 'facebook' && '📘 Facebook'}
                      {selectedPlatform === 'instagram' && '📷 Instagram'}
                      {selectedPlatform === 'youtube' && '📺 YouTube'}
                      {selectedPlatform === 'tiktok' && '🎵 TikTok'}
                      {selectedPlatform === 'reddit' && '🔴 Reddit'}
                      {selectedPlatform === 'discord' && '💬 Discord'}
                      {selectedPlatform === 'twitch' && '🎮 Twitch'}
                      {selectedPlatform === 'bluesky' && '🦋 Bluesky'}
                    </Badge>
                  </div>
                  
                  {persona && (
                    <div>
                      <div className="text-sm font-medium mb-1">Persona:</div>
                      <div className="text-sm text-muted-foreground">{persona}</div>
                    </div>
                  )}

                  <div className="flex space-x-4 text-xs text-muted-foreground">
                    {tokensUsed > 0 && <span>Tokens: {tokensUsed}</span>}
                    <span>Length: {preview.length} chars</span>
                  </div>
                </div>

                <Button
                  onClick={handleSend}
                  disabled={loading}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Roast
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <div className="text-sm">Generate a preview to see your roast</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Roasts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Roasts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="text-sm font-medium">Mock roast response #{i}</div>
                  <div className="text-xs text-muted-foreground">Sent 2 hours ago • Twitter</div>
                </div>
                <Badge variant="outline">Sent</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}