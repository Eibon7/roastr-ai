# Frontend Dashboard Guide

This guide covers the React-based dashboard components for social media connections, style profile management, and OAuth integration wizards.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Library](#component-library)
3. [Connection Wizard](#connection-wizard)
4. [Integration Status Cards](#integration-status-cards)  
5. [Style Profile Dashboard](#style-profile-dashboard)
6. [State Management](#state-management)
7. [API Integration](#api-integration)
8. [Testing](#testing)
9. [Styling & Theming](#styling--theming)
10. [Accessibility](#accessibility)

## Architecture Overview

The frontend is built with **React 19.1.1** and **shadcn/ui** components, providing a modern, accessible, and highly customizable user interface.

### Tech Stack

```
React 19.1.1
├── shadcn/ui (Component Library)
├── Tailwind CSS (Styling)
├── Lucide React (Icons)
├── React Router (Navigation)
├── React Testing Library (Testing)
└── Jest (Test Runner)
```

### Component Hierarchy

```
src/
├── pages/
│   ├── Connect.jsx              # Main connection wizard page
│   └── StyleProfile.jsx         # Style profile management
├── components/
│   ├── ui/                      # shadcn/ui base components
│   │   ├── card.jsx
│   │   ├── button.jsx
│   │   ├── badge.jsx
│   │   ├── dialog.jsx
│   │   └── ...
│   └── widgets/
│       └── IntegrationStatusCard.jsx  # Platform connection status
├── hooks/
│   └── use-toast.js             # Toast notifications
└── __tests__/
    ├── connect-wizard.test.jsx   # Connection wizard tests
    └── integration-status-card.test.jsx
```

## Component Library

### Base UI Components (shadcn/ui)

The dashboard uses shadcn/ui for consistent, accessible components:

```jsx
// Card Component
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Platform Status</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

```jsx
// Button Component
import { Button } from '../components/ui/button';

<Button variant="outline" size="sm" onClick={handleClick}>
  Connect Account
</Button>

// Variants: default, destructive, outline, secondary, ghost, link
// Sizes: default, sm, lg, icon
```

```jsx
// Badge Component  
import { Badge } from '../components/ui/badge';

<Badge variant="default">Connected</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="secondary">Token Expired</Badge>
<Badge variant="outline">Not Connected</Badge>
```

```jsx
// Dialog Component
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

<Dialog open={showDialog} onOpenChange={setShowDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Connect to Platform</DialogTitle>
      <DialogDescription>
        Follow the steps to connect your account
      </DialogDescription>
    </DialogHeader>
    {/* Dialog content */}
  </DialogContent>
</Dialog>
```

### Progress Components

```jsx
import { Progress } from '../components/ui/progress';

// Connection progress indicator
<Progress value={progress} className="h-2" />
```

### Alert Components

```jsx
import { Alert, AlertDescription } from '../components/ui/alert';

<Alert>
  <AlertTriangle className="h-4 w-4" />
  <AlertDescription>
    You need to connect at least one social media account.
  </AlertDescription>
</Alert>
```

## Connection Wizard

### Main Connect Page (`Connect.jsx`)

The primary interface for managing social media connections:

```jsx
import React, { useState, useEffect } from 'react';
import IntegrationStatusCard from '../components/widgets/IntegrationStatusCard';

const Connect = () => {
  const [connections, setConnections] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mockMode, setMockMode] = useState(false);

  // Load connections and platforms
  const loadData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      
      const [connectionsRes, platformsRes] = await Promise.all([
        fetch('/api/integrations/connections', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/integrations/platforms', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (connectionsRes.ok && platformsRes.ok) {
        const connectionsData = await connectionsRes.json();
        const platformsData = await platformsRes.json();
        
        setConnections(connectionsData.data.connections);
        setPlatforms(platformsData.data.platforms);
        setMockMode(connectionsData.data.mockMode);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load connection data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header with progress */}
      <ConnectionProgress connections={connections} platforms={platforms} />
      
      {/* Mock mode alert */}
      {mockMode && <MockModeAlert />}
      
      {/* Platform grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {connections.map((connection) => (
          <IntegrationStatusCard
            key={connection.platform}
            connection={connection}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onRefresh={handleRefresh}
          />
        ))}
      </div>
      
      {/* Mock OAuth wizard dialog */}
      <MockOAuthWizard />
      
      {/* Help section */}
      <HelpSection />
    </div>
  );
};
```

### Connection Progress Component

```jsx
const ConnectionProgress = ({ connections, platforms }) => {
  const connectedCount = connections.filter(c => c.connected).length;
  const totalCount = platforms.length;
  const progress = totalCount > 0 ? (connectedCount / totalCount) * 100 : 0;

  return (
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
  );
};
```

### Mock OAuth Wizard

The wizard provides a step-by-step OAuth simulation in mock mode:

```jsx
const MockOAuthWizard = ({ platform, authData, onComplete }) => {
  const [wizardStep, setWizardStep] = useState(1);

  const simulateMockCallback = async () => {
    setWizardStep(2); // Processing
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update connections
    await loadData();
    
    setWizardStep(3); // Success
    
    // Auto-close after success
    setTimeout(() => {
      onComplete();
    }, 2000);
  };

  return (
    <Dialog open={showWizard} onOpenChange={setShowWizard}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlatformIcon platform={platform} />
            Connect to {platform}
          </DialogTitle>
          <DialogDescription>
            {mockMode ? 'Simulating OAuth connection flow' : 'Follow the authorization steps'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {wizardStep === 1 && (
            <AuthorizeStep onContinue={simulateMockCallback} />
          )}
          
          {wizardStep === 2 && (
            <ProcessingStep />
          )}
          
          {wizardStep === 3 && (
            <SuccessStep platform={platform} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

### Wizard Steps

```jsx
// Step 1: Authorization
const AuthorizeStep = ({ onContinue }) => (
  <div className="space-y-4">
    <div className="text-center">
      <div className="text-6xl mb-4">🔐</div>
      <h3 className="text-lg font-semibold mb-2">Authorize Access</h3>
      <p className="text-sm text-muted-foreground mb-4">
        You'll be redirected to authorize access to your account.
      </p>
    </div>
    
    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription>
        This is a simulated OAuth flow for testing purposes.
      </AlertDescription>
    </Alert>

    <Button onClick={onContinue} className="w-full">
      Continue to Authorization
    </Button>
  </div>
);

// Step 2: Processing  
const ProcessingStep = () => (
  <div className="space-y-4 text-center">
    <div className="text-6xl mb-4">⏳</div>
    <h3 className="text-lg font-semibold mb-2">Processing...</h3>
    <p className="text-sm text-muted-foreground">
      Completing the authorization process
    </p>
    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
  </div>
);

// Step 3: Success
const SuccessStep = ({ platform }) => (
  <div className="space-y-4 text-center">
    <div className="text-6xl mb-4">✅</div>
    <h3 className="text-lg font-semibold mb-2">Successfully Connected!</h3>
    <p className="text-sm text-muted-foreground">
      Your {platform} account is now connected
    </p>
  </div>
);
```

## Integration Status Cards

### Component Structure

```jsx
const IntegrationStatusCard = ({ 
  connection, 
  onConnect, 
  onDisconnect, 
  onRefresh, 
  onConfigure,
  compact = false,
  showActions = true 
}) => {
  const [actionLoading, setActionLoading] = useState(null);
  
  // Platform configuration
  const config = PLATFORM_CONFIG[connection.platform] || defaultConfig;
  
  // Status configuration
  const statusConfig = getStatusConfig(connection.status);
  
  return (
    <Card className={`${statusConfig.borderColor} ${connection.connected ? 'shadow-sm' : ''}`}>
      {/* Card header with platform info and status */}
      <CardHeader>
        <PlatformHeader 
          config={config} 
          connection={connection}
          statusConfig={statusConfig}
        />
      </CardHeader>
      
      <CardContent>
        {connection.connected ? (
          <ConnectedContent connection={connection} />
        ) : (
          <DisconnectedContent 
            statusConfig={statusConfig}
            onConnect={onConnect}
            loading={actionLoading === 'Connect'}
          />
        )}
        
        {/* Action buttons */}
        <ActionButtons 
          connection={connection}
          onRefresh={onRefresh}
          onDisconnect={onDisconnect}
          actionLoading={actionLoading}
        />
      </CardContent>
    </Card>
  );
};
```

### Platform Configuration

```jsx
const PLATFORM_CONFIG = {
  twitter: {
    name: 'Twitter/X',
    icon: '𝕏',
    color: '#1DA1F2',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  instagram: {
    name: 'Instagram',
    icon: '📷',
    color: '#E4405F', 
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200'
  },
  youtube: {
    name: 'YouTube',
    icon: '📺',
    color: '#FF0000',
    bgColor: 'bg-red-50', 
    borderColor: 'border-red-200'
  },
  // ... other platforms
};
```

### Status Configuration

```jsx
const getStatusConfig = (status) => {
  const statusMap = {
    connected: {
      variant: 'default',
      icon: CheckCircle,
      text: 'Connected',
      description: 'Account is connected and active',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    expired: {
      variant: 'secondary', 
      icon: Clock,
      text: 'Token Expired',
      description: 'Authentication token needs refresh',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },
    error: {
      variant: 'destructive',
      icon: AlertTriangle, 
      text: 'Error',
      description: 'Connection error - check logs',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    disconnected: {
      variant: 'outline',
      icon: XCircle,
      text: 'Not Connected', 
      description: 'Account not connected',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    }
  };

  return statusMap[status] || statusMap.disconnected;
};
```

### Compact Mode

For dashboard widgets and sidebar displays:

```jsx
{compact ? (
  <div className={`flex items-center justify-between p-3 rounded-lg border ${statusConfig.borderColor}`}>
    <div className="flex items-center gap-3">
      <PlatformIcon config={config} />
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{config.name}</span>
          <Badge variant={statusConfig.variant} className="text-xs">
            {statusConfig.text}
          </Badge>
        </div>
        {connection.user_info && (
          <div className="text-xs text-muted-foreground">
            {connection.user_info.name}
          </div>
        )}
      </div>
    </div>
    
    <QuickActions connection={connection} />
  </div>
) : (
  <FullCard connection={connection} />
)}
```

## Style Profile Dashboard

### Main Style Profile Page

```jsx
const StyleProfile = () => {
  const [profile, setProfile] = useState(null);
  const [connections, setConnections] = useState([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Check requirements
  const connectedPlatforms = connections.filter(conn => conn.connected);
  const hasConnections = connectedPlatforms.length > 0;
  const meetsRequirements = hasConnections && hasAccess;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <PageHeader />
      
      {/* Connection requirement check */}
      {!hasConnections && <ConnectionRequirement />}
      
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Connections sidebar */}
        <div className="lg:col-span-1">
          <ConnectionsSidebar 
            connections={connections}
            onConnect={handleConnect}
          />
        </div>
        
        {/* Main content */}
        <div className="lg:col-span-2">
          {!profile ? (
            <GenerateProfileCard 
              requirements={meetsRequirements}
              onGenerate={generateProfile}
              generating={generating}
            />
          ) : (
            <ProfileDashboard 
              profile={profile}
              onRegenerate={() => setProfile(null)}
              onDelete={deleteProfile}
            />
          )}
        </div>
      </div>
      
      {/* Preview dialog */}
      <ProfilePreviewDialog />
    </div>
  );
};
```

### Profile Generation Card

```jsx
const GenerateProfileCard = ({ requirements, onGenerate, generating }) => (
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
          Analyze your writing style across connected social media platforms.
        </p>

        {/* Requirements checklist */}
        <RequirementsChecklist requirements={requirements} />

        <Button
          onClick={onGenerate}
          disabled={!requirements.met || generating}
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
      </div>
    </CardContent>
  </Card>
);
```

### Profile Overview Dashboard

```jsx
const ProfileDashboard = ({ profile, onRegenerate, onDelete }) => (
  <div className="space-y-6">
    {/* Overview stats */}
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
          <ProfileActions 
            onRegenerate={onRegenerate}
            onDelete={onDelete}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ProfileStats profile={profile} />
      </CardContent>
    </Card>
    
    {/* Language profiles */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="w-5 h-5" />
          Language Profiles
        </CardTitle>
      </CardHeader>
      <CardContent>
        <LanguageProfiles 
          profiles={profile.profiles}
          onPreview={handlePreview}
        />
      </CardContent>
    </Card>
  </div>
);
```

### Language Profile Cards

```jsx
const LanguageProfiles = ({ profiles, onPreview }) => (
  <div className="grid gap-4 md:grid-cols-2">
    {profiles.map((langProfile) => (
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
            onClick={() => onPreview(langProfile.lang)}
          >
            <Eye className="w-4 h-4 mr-1" />
            Preview
          </Button>
        </div>
        
        <LanguageProfileStats metadata={langProfile.metadata} />
      </div>
    ))}
  </div>
);
```

## State Management

### Local State Management

Using React hooks for component-level state:

```jsx
const useConnections = () => {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      
      const response = await fetch('/api/integrations/connections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load connections');
      
      const data = await response.json();
      setConnections(data.data.connections);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { connections, loading, error, loadConnections };
};
```

### Authentication State

```jsx
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      validateToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const validateToken = async (token) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData.data);
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    } catch (error) {
      console.error('Token validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, setUser };
};
```

### Toast Notifications

```jsx
const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(({ title, description, variant = 'default' }) => {
    const id = Date.now();
    const newToast = { id, title, description, variant };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  return { toast, toasts };
};
```

## API Integration

### Fetch Wrapper

```jsx
const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...(refreshToken && { 'X-Refresh-Token': refreshToken }),
        ...options.headers
      },
      ...options
    };

    const response = await fetch(`/api${endpoint}`, config);
    
    // Handle token refresh
    const newToken = response.headers.get('X-New-Access-Token');
    const newRefreshToken = response.headers.get('X-New-Refresh-Token');
    
    if (newToken) {
      localStorage.setItem('access_token', newToken);
      localStorage.setItem('refresh_token', newRefreshToken);
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  },

  // Convenience methods
  get: (endpoint) => api.request(endpoint),
  post: (endpoint, data) => api.request(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  put: (endpoint, data) => api.request(endpoint, {
    method: 'PUT', 
    body: JSON.stringify(data)
  }),
  delete: (endpoint) => api.request(endpoint, { method: 'DELETE' })
};
```

### API Hooks

```jsx
const useApiCall = (endpoint, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.request(endpoint, options);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, options]);

  useEffect(() => {
    if (options.immediate !== false) {
      execute();
    }
  }, [execute, options.immediate]);

  return { data, loading, error, refetch: execute };
};
```

## Testing

### Component Testing Setup

```jsx
// Test utilities
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

const TestWrapper = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

// Mock implementations
const mockToast = jest.fn();
jest.mock('../hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

global.fetch = jest.fn();
```

### Integration Status Card Tests

```jsx
describe('IntegrationStatusCard', () => {
  it('should render connected state with user info', () => {
    const mockConnection = {
      platform: 'twitter',
      connected: true,
      status: 'connected',
      user_info: {
        name: 'Test User',
        username: 'testuser',
        profile_image_url: 'https://example.com/avatar.jpg'
      }
    };

    render(
      <IntegrationStatusCard
        connection={mockConnection}
        onConnect={jest.fn()}
        onDisconnect={jest.fn()}
        onRefresh={jest.fn()}
      />
    );

    expect(screen.getByText('Twitter/X')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('@testuser')).toBeInTheDocument();
  });

  it('should handle connect action', async () => {
    const mockOnConnect = jest.fn();
    const user = userEvent.setup();

    render(
      <IntegrationStatusCard
        connection={mockDisconnectedConnection}
        onConnect={mockOnConnect}
        onDisconnect={jest.fn()}
        onRefresh={jest.fn()}
      />
    );

    const connectButton = screen.getByText('Connect Account');
    await user.click(connectButton);

    expect(mockOnConnect).toHaveBeenCalledWith('twitter');
  });
});
```

### Connection Wizard Tests

```jsx
describe('Connect Page', () => {
  it('should display mock mode alert when enabled', async () => {
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { connections: [], mockMode: true }
        })
      })
    );

    render(<TestWrapper><Connect /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText('Mock mode is enabled')).toBeInTheDocument();
    });
  });

  it('should handle OAuth wizard flow', async () => {
    const user = userEvent.setup();

    render(<TestWrapper><Connect /></TestWrapper>);

    // Wait for page load
    await waitFor(() => {
      expect(screen.getByText('Connect Your Social Media')).toBeInTheDocument();
    });

    // Find and click connect button
    const connectButton = screen.getByText('Connect');
    await user.click(connectButton);

    // Should show wizard dialog
    await waitFor(() => {
      expect(screen.getByText('Authorize Access')).toBeInTheDocument();
    });
  });
});
```

## Styling & Theming

### Tailwind Configuration

```js
// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // Platform-specific colors
        twitter: "#1DA1F2",
        instagram: "#E4405F", 
        youtube: "#FF0000",
        facebook: "#1877F2",
        // ... other platforms
      }
    }
  },
  plugins: [],
}
```

### CSS Custom Properties

```css
/* globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --border: 214.3 31.8% 91.4%;
    --radius: 0.5rem;
  }
  
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark theme variables */
  }
}
```

### Platform-Specific Styling

```jsx
// Platform color utilities
const getPlatformStyles = (platform) => {
  const styles = {
    twitter: 'border-blue-200 bg-blue-50',
    instagram: 'border-pink-200 bg-pink-50',
    youtube: 'border-red-200 bg-red-50',
    facebook: 'border-blue-200 bg-blue-50',
    // ... other platforms
  };
  
  return styles[platform] || 'border-gray-200 bg-gray-50';
};

// Usage in components
<Card className={`${getPlatformStyles(platform)} transition-colors`}>
```

## Accessibility

### ARIA Labels and Roles

```jsx
// Button accessibility
<Button 
  aria-label={`Connect to ${platform}`}
  aria-describedby={`${platform}-description`}
  onClick={handleConnect}
>
  Connect Account
</Button>

// Status indicators
<div 
  role="status" 
  aria-live="polite"
  aria-label={`${platform} connection status: ${status}`}
>
  <Badge variant={statusVariant}>{statusText}</Badge>
</div>
```

### Keyboard Navigation

```jsx
// Focus management
const ConnectDialog = ({ onClose }) => {
  const firstButtonRef = useRef();

  useEffect(() => {
    // Focus first interactive element when dialog opens
    firstButtonRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div onKeyDown={handleKeyDown} role="dialog" aria-modal="true">
      <Button ref={firstButtonRef}>Continue</Button>
    </div>
  );
};
```

### Screen Reader Support

```jsx
// Live regions for dynamic updates
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {connecting && `Connecting to ${platform}...`}
  {connected && `Successfully connected to ${platform}`}
  {error && `Failed to connect to ${platform}: ${error}`}
</div>

// Descriptive text for complex UI
<div id="connection-help" className="sr-only">
  This card shows the connection status for {platform}. 
  Use the Connect button to link your account, or Disconnect to remove the connection.
</div>
```

### Color Contrast and Visual Indicators

```jsx
// Status indicators with multiple visual cues
const StatusBadge = ({ status, platform }) => {
  const icons = {
    connected: CheckCircle,
    expired: Clock,
    error: AlertTriangle,
    disconnected: XCircle
  };
  
  const Icon = icons[status];
  
  return (
    <Badge 
      variant={getVariant(status)}
      className="flex items-center gap-1"
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      <span>{getStatusText(status)}</span>
    </Badge>
  );
};
```

### Focus Management

```jsx
// Trap focus within modals
const useFocusTrap = (isActive) => {
  const containerRef = useRef();

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);

  return containerRef;
};
```

This comprehensive frontend dashboard provides a modern, accessible, and highly functional interface for managing social media connections and style profiles, with robust testing coverage and excellent user experience across all interaction patterns.