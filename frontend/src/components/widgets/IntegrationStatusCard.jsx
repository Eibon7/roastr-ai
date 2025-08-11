/**
 * IntegrationStatusCard.jsx - Real-time integration status display
 * Shows connection status, user info, and management actions
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Settings,
  ExternalLink,
  Loader2,
  Zap
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { useToast } from '../../hooks/use-toast';

// Platform configurations
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
  tiktok: {
    name: 'TikTok',
    icon: '🎵',
    color: '#000000',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200'
  },
  linkedin: {
    name: 'LinkedIn',
    icon: '💼',
    color: '#0077B5',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  facebook: {
    name: 'Facebook',
    icon: '👥',
    color: '#1877F2',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  bluesky: {
    name: 'Bluesky',
    icon: '🦋',
    color: '#0085ff',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200'
  }
};

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
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const { toast } = useToast();

  const platform = connection.platform;
  const config = PLATFORM_CONFIG[platform] || {
    name: platform?.charAt(0).toUpperCase() + platform?.slice(1),
    icon: '📱',
    color: '#6B7280',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200'
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Handle actions with loading states
  const handleAction = async (action, actionName) => {
    try {
      setActionLoading(actionName);
      await action(platform);
    } catch (error) {
      console.error(`${actionName} error:`, error);
      toast({
        title: `${actionName} Failed`,
        description: error.message || `Failed to ${actionName.toLowerCase()}`,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Get status configuration
  const getStatusConfig = () => {
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

    return statusMap[connection.status] || statusMap.disconnected;
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  // Format date helpers
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Compact view for dashboard widgets
  if (compact) {
    return (
      <div className={`flex items-center justify-between p-3 rounded-lg border ${statusConfig.borderColor} ${statusConfig.bgColor}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white">
            <span className="text-lg">{config.icon}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{config.name}</span>
              <Badge variant={statusConfig.variant} className="text-xs">
                {statusConfig.text}
              </Badge>
            </div>
            {connection.user_info && (
              <div className="text-xs text-muted-foreground">
                {connection.user_info.name || connection.user_info.username}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
          {showActions && connection.connected && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {connection.status === 'expired' && (
                  <DropdownMenuItem onClick={() => handleAction(onRefresh, 'Refresh')}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Tokens
                  </DropdownMenuItem>
                )}
                {onConfigure && (
                  <DropdownMenuItem onClick={() => onConfigure(platform)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Configure
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleAction(onDisconnect, 'Disconnect')}
                  className="text-destructive"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    );
  }

  // Full card view
  return (
    <Card className={`${statusConfig.borderColor} ${connection.connected ? 'shadow-sm' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="flex items-center justify-center w-12 h-12 rounded-full"
              style={{ backgroundColor: config.color + '20' }}
            >
              <span className="text-2xl">{config.icon}</span>
            </div>
            <div>
              <CardTitle className="text-lg">{config.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={statusConfig.variant}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.text}
                </Badge>
              </div>
            </div>
          </div>

          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {connection.status === 'expired' && (
                  <DropdownMenuItem 
                    onClick={() => handleAction(onRefresh, 'Refresh')}
                    disabled={actionLoading === 'Refresh'}
                  >
                    {actionLoading === 'Refresh' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Refresh Tokens
                  </DropdownMenuItem>
                )}
                {onConfigure && (
                  <DropdownMenuItem onClick={() => onConfigure(platform)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Configure
                  </DropdownMenuItem>
                )}
                {connection.connected && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleAction(onDisconnect, 'Disconnect')}
                      disabled={actionLoading === 'Disconnect'}
                      className="text-destructive"
                    >
                      {actionLoading === 'Disconnect' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Disconnect
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Connection Details */}
        {connection.connected && connection.user_info ? (
          <div className="space-y-3">
            {/* User Info */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Avatar className="w-8 h-8">
                <AvatarImage 
                  src={connection.user_info.profile_image_url || connection.user_info.avatar} 
                  alt={connection.user_info.name}
                />
                <AvatarFallback>
                  {(connection.user_info.name || connection.user_info.username || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {connection.user_info.name || connection.user_info.display_name || 'Connected User'}
                </div>
                {connection.user_info.username && (
                  <div className="text-xs text-muted-foreground truncate">
                    @{connection.user_info.username}
                  </div>
                )}
              </div>
            </div>

            {/* Connection Stats */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground">Connected</div>
                <div className="font-medium">{formatDate(connection.connectedAt)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Last Active</div>
                <div className="font-medium">{formatRelativeTime(connection.lastRefreshed || connection.connectedAt)}</div>
              </div>
            </div>

            {/* Token Expiry Warning */}
            {connection.expires_at && Date.now() > (connection.expires_at - (60 * 60 * 1000)) && (
              <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                <Clock className="w-3 h-3 text-orange-600" />
                <span className="text-orange-800">
                  Token expires {formatRelativeTime(connection.expires_at)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className={`text-4xl mb-2 ${statusConfig.color}`}>
              <StatusIcon className="w-8 h-8 mx-auto" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {statusConfig.description}
            </p>
            
            {showActions && !connection.connected && (
              <Button 
                onClick={() => handleAction(onConnect, 'Connect')}
                disabled={actionLoading === 'Connect'}
                className="w-full"
                size="sm"
              >
                {actionLoading === 'Connect' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                {actionLoading === 'Connect' ? 'Connecting...' : 'Connect Account'}
              </Button>
            )}
          </div>
        )}

        {/* Quick Actions */}
        {showActions && connection.connected && (
          <div className="flex gap-2 mt-4">
            {connection.status === 'expired' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleAction(onRefresh, 'Refresh')}
                disabled={actionLoading === 'Refresh'}
                className="flex-1"
              >
                {actionLoading === 'Refresh' ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                Refresh
              </Button>
            )}
            
            {connection.status === 'connected' && (
              <Button variant="outline" size="sm" className="flex-1">
                <Zap className="w-4 h-4 mr-1" />
                Active
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default IntegrationStatusCard;