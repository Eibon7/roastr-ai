import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Send, Sparkles, Eye, Save } from 'lucide-react';

export default function Compose() {
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    if (!message.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/roast/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message })
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreview(data.roast);
      }
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!preview) return;
    
    setLoading(true);
    try {
      // In real implementation, this would send to selected platforms
      console.log('Sending roast:', preview);
      setMessage('');
      setPreview(null);
    } catch (error) {
      console.error('Failed to send roast:', error);
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

            <div className="flex space-x-2">
              <Button 
                onClick={handlePreview}
                disabled={!message.trim() || loading}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-2" />
                Generate Preview
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
                
                {/* Platform Selection */}
                <div>
                  <div className="text-sm font-medium mb-2">Send to platforms:</div>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm">🐦 Twitter</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">📘 Facebook</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">📷 Instagram</span>
                    </label>
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