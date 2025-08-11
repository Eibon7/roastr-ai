# OAuth Mock System Guide

This guide covers the comprehensive OAuth mock system for testing social media integrations without real API credentials.

## Table of Contents

1. [Overview](#overview)
2. [Supported Platforms](#supported-platforms)
3. [Mock Architecture](#mock-architecture)
4. [API Endpoints](#api-endpoints)
5. [Frontend Integration](#frontend-integration)
6. [Testing](#testing)
7. [Configuration](#configuration)
8. [Platform-Specific Details](#platform-specific-details)
9. [Troubleshooting](#troubleshooting)

## Overview

The OAuth Mock System provides a complete simulation of OAuth 2.0 flows for 7 major social media platforms. This enables:

- **Full end-to-end testing** without real API credentials
- **Predictable responses** for automated testing
- **Development environment** setup without external dependencies
- **CI/CD pipeline** testing with 100% reliability

### Key Features

- ✅ **Complete OAuth 2.0 flow simulation**
- ✅ **7 major platform support**
- ✅ **Realistic user data generation**
- ✅ **Token lifecycle management**
- ✅ **Connection status tracking**
- ✅ **Error scenario testing**
- ✅ **Feature flag controlled**

## Supported Platforms

| Platform | OAuth Type | Scopes Supported | Mock User Data |
|----------|------------|------------------|----------------|
| Twitter/X | OAuth 1.0a | read, write, offline.access | Profile, metrics, tweets |
| Instagram | OAuth 2.0 | instagram_basic, content_publish | Profile, media count |
| YouTube | OAuth 2.0 | youtube.readonly, youtube.upload | Channel info, statistics |
| TikTok | OAuth 2.0 | user.info.basic, video.list | Profile, videos |
| LinkedIn | OAuth 2.0 | r_liteprofile, w_member_social | Profile, connections |
| Facebook | OAuth 2.0 | public_profile, pages_manage_posts | Profile, pages |
| Bluesky | AT Protocol | read, write | Profile, posts |

## Mock Architecture

### System Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   OAuth Mock    │    │   Mock Store    │
│   Connection    │◄──►│   Provider      │◄──►│   In-Memory     │
│   Wizard        │    │   Factory       │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │              ┌─────────────────┐
         └─────────────►│   State         │
                        │   Management    │
                        └─────────────────┘
```

### Core Components

**OAuthProvider (Base Class)**
- Handles OAuth flow simulation
- Generates mock tokens and user data
- Manages state validation
- Provides platform-specific configurations

**OAuthProviderFactory**
- Creates platform-specific provider instances
- Manages provider lifecycle
- Validates platform support
- Provides unified interface

**MockConnectionStore**
- Stores connection states per user/platform
- Manages token expiration
- Tracks connection metadata
- Provides connection queries

## API Endpoints

### Connection Management

#### Initiate Connection
```http
POST /api/integrations/{platform}/connect
Authorization: Bearer <user-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://mock-oauth.roastr.ai/twitter/authorize?client_id=mock_twitter_client&state=encoded-state",
    "state": "base64url-encoded-state",
    "platform": "twitter",
    "requirements": {
      "permissions": ["Read tweets", "Write tweets", "Access profile"],
      "notes": "Requires Twitter Developer account approval",
      "estimatedTime": "5-10 minutes"
    },
    "redirectUri": "http://localhost:3000/api/auth/twitter/callback",
    "mock": true
  }
}
```

#### OAuth Callback
```http
GET /api/auth/{platform}/callback?code=mock_code&state=encoded-state
```

**Success Response (Redirect):**
```
Location: /connections?success=true&platform=twitter&connected=true
```

**Error Response (Redirect):**
```
Location: /connections?error=Invalid%20state%20parameter&platform=twitter
```

#### Get All Connections
```http
GET /api/integrations/connections
Authorization: Bearer <user-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connections": [
      {
        "platform": "twitter",
        "connected": true,
        "status": "connected",
        "connectedAt": 1642784400000,
        "lastRefreshed": null,
        "expires_at": 1642788000000,
        "user_info": {
          "id": "mock_twitter_user_1642784400123",
          "username": "mock_twitter_user",
          "name": "Mock Twitter User",
          "profile_image_url": "https://via.placeholder.com/400x400",
          "verified": false,
          "public_metrics": {
            "followers_count": 1234,
            "following_count": 567,
            "tweet_count": 890
          }
        },
        "requirements": {
          "permissions": ["Read tweets", "Write tweets", "Access profile"],
          "notes": "Requires Twitter Developer account approval",
          "estimatedTime": "5-10 minutes"
        }
      }
    ],
    "totalConnected": 1,
    "totalPlatforms": 7,
    "mockMode": true
  }
}
```

#### Refresh Tokens
```http
POST /api/integrations/{platform}/refresh
Authorization: Bearer <user-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Tokens refreshed successfully for twitter",
    "platform": "twitter",
    "expires_at": 1642791600000,
    "refreshed": true
  }
}
```

#### Disconnect Platform
```http
POST /api/integrations/{platform}/disconnect
Authorization: Bearer <user-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Successfully disconnected from twitter",
    "platform": "twitter",
    "disconnected": true
  }
}
```

### Platform Information

#### Get Available Platforms
```http
GET /api/integrations/platforms
```

**Response:**
```json
{
  "success": true,
  "data": {
    "platforms": [
      {
        "platform": "twitter",
        "name": "Twitter",
        "enabled": true,
        "mockMode": true,
        "requirements": {
          "permissions": ["Read tweets", "Write tweets", "Access profile"],
          "notes": "Requires Twitter Developer account approval",
          "estimatedTime": "5-10 minutes"
        },
        "scopes": ["read", "write", "offline.access"]
      }
    ],
    "mockMode": true,
    "totalPlatforms": 7,
    "enabledPlatforms": 7
  }
}
```

### Mock Management (Testing)

#### Reset Connections
```http
POST /api/integrations/mock/reset
Authorization: Bearer <user-token>
Content-Type: application/json

{
  "platform": "twitter"  // Optional: reset specific platform
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Reset connection for twitter",
    "platform": "twitter"
  }
}
```

## Frontend Integration

### React Connection Wizard

```jsx
import React, { useState } from 'react';
import { useToast } from '../hooks/use-toast';

const ConnectionWizard = ({ platform, onSuccess }) => {
  const [connecting, setConnecting] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const { toast } = useToast();

  const handleConnect = async () => {
    try {
      setConnecting(true);
      
      // Initiate connection
      const response = await fetch(`/api/integrations/${platform}/connect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        if (data.data.mock) {
          // Handle mock OAuth flow
          setWizardStep(2);
          await simulateMockFlow(data.data);
        } else {
          // Redirect to real OAuth
          window.location.href = data.data.authUrl;
        }
      }
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setConnecting(false);
    }
  };

  const simulateMockFlow = async (authData) => {
    // Simulate OAuth processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate callback
    const mockCode = 'mock_auth_code_' + Date.now();
    const callbackUrl = `/api/auth/${platform}/callback?code=${mockCode}&state=${authData.state}`;
    
    // In real implementation, this would be handled by redirect
    setWizardStep(3);
    onSuccess?.();
  };

  return (
    <div className="connection-wizard">
      {wizardStep === 1 && (
        <div>
          <h3>Connect to {platform}</h3>
          <button onClick={handleConnect} disabled={connecting}>
            {connecting ? 'Connecting...' : 'Connect Account'}
          </button>
        </div>
      )}
      
      {wizardStep === 2 && (
        <div>
          <h3>Processing...</h3>
          <p>Completing authorization...</p>
        </div>
      )}
      
      {wizardStep === 3 && (
        <div>
          <h3>Success!</h3>
          <p>Your {platform} account is now connected</p>
        </div>
      )}
    </div>
  );
};
```

### Connection Status Display

```jsx
import React from 'react';

const PlatformStatusCard = ({ connection, onConnect, onDisconnect }) => {
  const getStatusBadge = (status) => {
    const badges = {
      connected: { color: 'green', text: 'Connected' },
      expired: { color: 'orange', text: 'Token Expired' },
      disconnected: { color: 'gray', text: 'Not Connected' }
    };
    return badges[status] || badges.disconnected;
  };

  const badge = getStatusBadge(connection.status);

  return (
    <div className="platform-card">
      <div className="platform-header">
        <h4>{connection.platform}</h4>
        <span className={`badge badge-${badge.color}`}>
          {badge.text}
        </span>
      </div>
      
      {connection.connected && connection.user_info && (
        <div className="user-info">
          <img 
            src={connection.user_info.profile_image_url} 
            alt={connection.user_info.name}
            className="avatar"
          />
          <div>
            <p className="name">{connection.user_info.name}</p>
            <p className="username">@{connection.user_info.username}</p>
          </div>
        </div>
      )}
      
      <div className="actions">
        {connection.connected ? (
          <button onClick={() => onDisconnect(connection.platform)}>
            Disconnect
          </button>
        ) : (
          <button onClick={() => onConnect(connection.platform)}>
            Connect
          </button>
        )}
      </div>
    </div>
  );
};
```

## Testing

### Integration Tests

```javascript
describe('OAuth Mock Integration', () => {
  it('should complete full connection flow', async () => {
    // 1. Initiate connection
    const connectResponse = await request(app)
      .post('/api/integrations/twitter/connect')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(connectResponse.status).toBe(200);
    const { state, authUrl } = connectResponse.body.data;
    
    // 2. Simulate OAuth callback
    const mockCode = 'mock_auth_code_' + Date.now();
    const callbackResponse = await request(app)
      .get(`/api/auth/twitter/callback?code=${mockCode}&state=${state}`);
    
    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toContain('success=true');
    
    // 3. Verify connection status
    const statusResponse = await request(app)
      .get('/api/integrations/connections')
      .set('Authorization', `Bearer ${authToken}`);
    
    const twitterConnection = statusResponse.body.data.connections
      .find(conn => conn.platform === 'twitter');
    
    expect(twitterConnection.connected).toBe(true);
    expect(twitterConnection.user_info).toBeDefined();
  });

  it('should handle token refresh', async () => {
    // Setup connected account first
    await setupConnectedAccount('twitter');
    
    // Test refresh
    const refreshResponse = await request(app)
      .post('/api/integrations/twitter/refresh')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.data.refreshed).toBe(true);
  });

  it('should validate state parameter', async () => {
    const invalidState = 'invalid-state-parameter';
    
    const response = await request(app)
      .get(`/api/auth/twitter/callback?code=test&state=${invalidState}`);
    
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('error=');
  });
});
```

### Frontend Tests

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Connect from '../pages/Connect';

describe('Connect Page', () => {
  beforeEach(() => {
    // Mock fetch for API calls
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/api/integrations/platforms')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { platforms: mockPlatforms, mockMode: true }
          })
        });
      }
    });
  });

  it('should display mock mode alert', async () => {
    render(<Connect />);
    
    await waitFor(() => {
      expect(screen.getByText('Mock mode is enabled')).toBeInTheDocument();
    });
  });

  it('should handle mock connection flow', async () => {
    render(<Connect />);
    
    // Wait for platforms to load
    await waitFor(() => {
      expect(screen.getByText('Twitter')).toBeInTheDocument();
    });
    
    // Click connect
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);
    
    // Should show wizard dialog
    await waitFor(() => {
      expect(screen.getByText('Connect to twitter')).toBeInTheDocument();
    });
  });
});
```

## Configuration

### Environment Variables

**Required for Mock Mode:**
```bash
# Enable OAuth mock system
ENABLE_OAUTH_MOCK=true

# Mock mode for development
ENABLE_MOCK_MODE=true

# Debug OAuth flows (optional)
DEBUG_OAUTH=false
```

**Individual Platform Control:**
```bash
# Set to true when real credentials are available
ENABLE_TWITTER_OAUTH=false
ENABLE_INSTAGRAM_OAUTH=false
ENABLE_YOUTUBE_OAUTH=false
ENABLE_TIKTOK_OAUTH=false
ENABLE_LINKEDIN_OAUTH=false
ENABLE_FACEBOOK_OAUTH=false
ENABLE_BLUESKY_OAUTH=false
```

**Frontend Configuration:**
```bash
# React app environment
REACT_APP_ENABLE_MOCK_MODE=true
REACT_APP_ENABLE_OAUTH_CONNECTIONS=true
```

### Feature Flag Control

```javascript
const { flags } = require('./src/config/flags');

// Check if should use mock OAuth
if (flags.shouldUseMockOAuth()) {
  // Use mock provider
  return this.getMockAuthUrl(state, redirectUri);
} else {
  // Use real OAuth provider
  return this.getRealAuthUrl(state, redirectUri);
}

// Individual platform check
if (flags.isEnabled('ENABLE_TWITTER_OAUTH')) {
  // Twitter OAuth is configured for real use
} else {
  // Fall back to mock mode
}
```

### Mock Data Customization

```javascript
// Customize mock user data per platform
const mockUsers = {
  twitter: {
    id: `mock_twitter_user_${Date.now()}`,
    username: 'mock_twitter_user',
    name: 'Mock Twitter User',
    profile_image_url: 'https://via.placeholder.com/400x400',
    verified: false,
    public_metrics: {
      followers_count: Math.floor(Math.random() * 10000),
      following_count: Math.floor(Math.random() * 1000),
      tweet_count: Math.floor(Math.random() * 5000)
    }
  },
  // ... other platforms
};
```

## Platform-Specific Details

### Twitter/X Mock

**OAuth Flow**: OAuth 1.0a simulation
**Mock Endpoints**: 
- Authorization: `https://mock-oauth.roastr.ai/twitter/authorize`
- Token Exchange: Internal mock handler

**Mock User Data:**
```json
{
  "id": "mock_twitter_user_1642784400123",
  "username": "mock_twitter_user",
  "name": "Mock Twitter User",
  "profile_image_url": "https://via.placeholder.com/400x400",
  "verified": false,
  "public_metrics": {
    "followers_count": 1234,
    "following_count": 567,
    "tweet_count": 890
  }
}
```

### Instagram Mock

**OAuth Flow**: OAuth 2.0 simulation
**Mock Scopes**: `instagram_basic`, `instagram_content_publish`

**Mock User Data:**
```json
{
  "id": "mock_instagram_user_1642784400123",
  "username": "mock_instagram_user",
  "account_type": "PERSONAL",
  "media_count": 456
}
```

### YouTube Mock

**OAuth Flow**: Google OAuth 2.0 simulation
**Mock Scopes**: `youtube.readonly`, `youtube.upload`

**Mock User Data:**
```json
{
  "id": "mock_youtube_user_1642784400123",
  "snippet": {
    "title": "Mock YouTube Channel",
    "description": "A mock YouTube channel for testing",
    "thumbnails": {
      "default": { "url": "https://via.placeholder.com/88x88" }
    }
  },
  "statistics": {
    "viewCount": "12345",
    "subscriberCount": "678",
    "videoCount": "90"
  }
}
```

### TikTok Mock

**OAuth Flow**: TikTok OAuth 2.0 simulation
**Mock Scopes**: `user.info.basic`, `video.list`

**Mock User Data:**
```json
{
  "open_id": "mock_tiktok_user_1642784400123",
  "union_id": "mock_tiktok_union_1642784400123",
  "display_name": "Mock TikTok User",
  "avatar_url": "https://via.placeholder.com/400x400"
}
```

### LinkedIn Mock

**OAuth Flow**: LinkedIn OAuth 2.0 simulation
**Mock Scopes**: `r_liteprofile`, `w_member_social`

**Mock User Data:**
```json
{
  "id": "mock_linkedin_user_1642784400123",
  "localizedFirstName": "Mock",
  "localizedLastName": "LinkedIn User",
  "profilePicture": {
    "displayImage~": {
      "elements": [
        {
          "identifiers": [
            { "identifier": "https://via.placeholder.com/400x400" }
          ]
        }
      ]
    }
  }
}
```

### Facebook Mock

**OAuth Flow**: Facebook OAuth 2.0 simulation  
**Mock Scopes**: `public_profile`, `pages_manage_posts`

**Mock User Data:**
```json
{
  "id": "mock_facebook_user_1642784400123",
  "name": "Mock Facebook User",
  "email": "mock@facebook.example.com",
  "picture": {
    "data": { "url": "https://via.placeholder.com/400x400" }
  }
}
```

### Bluesky Mock

**OAuth Flow**: AT Protocol simulation
**Mock Scopes**: `read`, `write`

**Mock User Data:**
```json
{
  "did": "did:mock:bluesky:1642784400123",
  "handle": "mock.bluesky.social",
  "displayName": "Mock Bluesky User",
  "avatar": "https://via.placeholder.com/400x400"
}
```

## Troubleshooting

### Common Issues

**1. Mock Mode Not Working**

Check environment variables:
```bash
echo $ENABLE_OAUTH_MOCK
echo $ENABLE_MOCK_MODE
```

Verify flags are loaded:
```javascript
const { flags } = require('./src/config/flags');
console.log('OAuth Mock Enabled:', flags.shouldUseMockOAuth());
```

**2. State Parameter Validation Errors**

State parameters expire after 10 minutes. For debugging:
```javascript
// Add debug logging
if (flags.isEnabled('DEBUG_OAUTH')) {
  console.log('State validation:', { state, parsed: parseState(state) });
}
```

**3. Connection Not Persisting**

Check mock store:
```javascript
// Debug connection storage
console.log('Mock Store Contents:', mockStore.getUserConnections(userId));
```

**4. Frontend Not Showing Mock Mode**

Verify React environment variables:
```javascript
console.log('React Mock Mode:', process.env.REACT_APP_ENABLE_MOCK_MODE);
```

### Debug Mode

Enable comprehensive OAuth debugging:

```bash
# Backend debugging
DEBUG_OAUTH=true npm start

# Frontend debugging  
REACT_APP_DEBUG_OAUTH=true npm start
```

**Debug Output Examples:**
```
OAuth: Mock connection initiated for user123:twitter
OAuth: State generated - userId: user123, platform: twitter
OAuth: Callback received - code: mock_code_123, state: valid
OAuth: Connection stored successfully
OAuth: Token refresh requested for twitter
```

### Testing Scenarios

**Test State Expiration:**
```javascript
// Generate expired state
const expiredState = generateState('user123', 'twitter');
// Wait 11 minutes
const result = parseState(expiredState); // Should throw error
```

**Test Platform Validation:**
```javascript
// Test unsupported platform
const response = await request(app)
  .post('/api/integrations/unsupported-platform/connect')
  .set('Authorization', `Bearer ${token}`);

expect(response.status).toBe(400);
```

**Test Connection Limits:**
```javascript
// Test already connected
await connectPlatform('twitter');
const secondConnect = await connectPlatform('twitter');
expect(secondConnect.body.data.status).toBe('already_connected');
```

## Migration to Real OAuth

When ready to use real OAuth credentials:

1. **Set up platform applications**:
   - Twitter: Create app at developer.twitter.com
   - Instagram: Set up Facebook app with Instagram Basic Display
   - YouTube: Configure Google Cloud Console project
   - etc.

2. **Update environment variables**:
   ```bash
   # Disable mock mode
   ENABLE_OAUTH_MOCK=false
   
   # Enable specific platforms
   ENABLE_TWITTER_OAUTH=true
   
   # Add real credentials
   TWITTER_CLIENT_ID=real_client_id
   TWITTER_CLIENT_SECRET=real_client_secret
   ```

3. **Implement real OAuth providers**:
   ```javascript
   class TwitterOAuthProvider extends OAuthProvider {
     async getAuthorizationUrl(state, redirectUri) {
       if (flags.isEnabled('ENABLE_TWITTER_OAUTH')) {
         // Use real Twitter OAuth
         return this.getRealTwitterAuthUrl(state, redirectUri);
       }
       return super.getAuthorizationUrl(state, redirectUri);
     }
   }
   ```

4. **Test gradually**:
   - Start with one platform
   - Keep mock mode as fallback
   - Monitor error rates
   - Gradually migrate all platforms

The mock system provides a robust foundation for OAuth development and testing, enabling teams to build reliable social media integrations with confidence.