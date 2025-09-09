import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Send, Sparkles, Eye, Save } from 'lucide-react';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

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

  const handlePreview = async () => {
    if (!message.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get auth token (assuming you have auth context)
      const token = localStorage.getItem('authToken');
      
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
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreview(data.roast);
        setTokensUsed(data.tokensUsed);
        setAnalysisRemaining(data.analysisCountRemaining);
        setRoastsRemaining(data.roastsRemaining);
      } else {
        const errorData = await response.json();
        if (response.status === 402) {
          // Insufficient credits
          setError({
            type: 'credits',
            message: errorData.details?.message || 'Insufficient credits'
          });
        } else {
          setError({
            type: 'general',
            message: errorData.error || 'Failed to generate preview'
          });
        }
      }
    } catch (error) {
      console.error('Failed to generate preview:', error);
      setError({
        type: 'network',
        message: 'Network error. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!preview) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      
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
        })
      });
      
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
        alert('Roast generated and ready to send!');
        
      } else {
        const errorData = await response.json();
        if (response.status === 402) {
          setError({
            type: 'credits',
            message: errorData.details?.message || 'Insufficient roast credits'
          });
        } else {
          setError({
            type: 'general',
            message: errorData.error || 'Failed to generate final roast'
          });
        }
      }
    } catch (error) {
      console.error('Failed to send roast:', error);
      setError({
        type: 'network',
        message: 'Network error. Please try again.'
      });
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