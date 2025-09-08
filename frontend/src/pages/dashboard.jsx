import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import {
  Twitter,
  Instagram,
  Youtube,
  Facebook,
  MessageCircle,
  Twitch,
  Users,
  PlayCircle,
  Plus,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  RefreshCw,
  Trash2,
  Send,
  Shield,
  Settings as SettingsIcon
} from 'lucide-react';
import AccountModal from '../components/AccountModal';

export default function Dashboard() {
  const [adminMode, setAdminMode] = useState(false);
  const [adminModeUser, setAdminModeUser] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [recentRoasts, setRecentRoasts] = useState([]);
  const [roastsLoading, setRoastsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Platform icons mapping
  const platformIcons = {
    twitter: Twitter,
    instagram: Instagram,
    youtube: Youtube,
    facebook: Facebook,
    discord: MessageCircle,
    twitch: Twitch,
    reddit: Users,
    tiktok: PlayCircle,
    bluesky: Twitter // Using Twitter icon as placeholder for Bluesky
  };

  // Platform display names
  const platformNames = {
    twitter: 'X (Twitter)',
    instagram: 'Instagram',
    youtube: 'YouTube',
    facebook: 'Facebook',
    discord: 'Discord',
    twitch: 'Twitch',
    reddit: 'Reddit',
    tiktok: 'TikTok',
    bluesky: 'Bluesky'
  };

  // Available platforms for connection
  const availablePlatforms = ['twitter', 'instagram', 'youtube', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'];

  // Check for admin mode on component mount - Issue #240
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const isAdminMode = urlParams.get('adminMode') === 'true';
    const sessionAdminMode = sessionStorage.getItem('adminMode') === 'true';
    const sessionAdminUser = sessionStorage.getItem('adminModeUser');

    if (isAdminMode || sessionAdminMode) {
      setAdminMode(true);
      if (sessionAdminUser) {
        try {
          setAdminModeUser(JSON.parse(sessionAdminUser));
        } catch (error) {
          console.error('Error parsing admin mode user:', error);
          setAdminModeUser(null);
        }
      }
    }
  }, [location]);

  // Fetch recent roasts
  const fetchRecentRoasts = async () => {
    try {
      setRoastsLoading(true);
      const response = await fetch('/api/user/roasts/recent?limit=10', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecentRoasts(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching recent roasts:', error);
    } finally {
      setRoastsLoading(false);
    }
  };

  // Fetch user accounts and usage data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch connected accounts
        const accountsRes = await fetch('/api/user/integrations', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          setAccounts(accountsData.data || []);
        }

        // Fetch usage data
        const usageRes = await fetch('/api/user/usage', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (usageRes.ok) {
          const usageData = await usageRes.json();
          setUsage(usageData.data || {});
        }

        // Fetch recent roasts
        await fetchRecentRoasts();

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleExitAdminMode = () => {
    // Clear admin mode from session storage
    sessionStorage.removeItem('adminMode');
    sessionStorage.removeItem('adminModeUser');
    setAdminMode(false);
    setAdminModeUser(null);
    
    // Navigate back to admin panel
    navigate('/admin/users');
  };

  const handleConnectPlatform = async (platform) => {
    try {
      setConnectingPlatform(platform);
      
      const response = await fetch('/api/user/integrations/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ platform })
      });

      if (response.ok) {
        // Refresh accounts data
        const accountsRes = await fetch('/api/user/integrations', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          setAccounts(accountsData.data || []);
        }
      } else {
        console.error('Failed to connect platform');
      }
    } catch (error) {
      console.error('Error connecting platform:', error);
    } finally {
      setConnectingPlatform(null);
    }
  };

  const getConnectedAccountsForPlatform = (platform) => {
    return accounts?.filter(account => account.platform === platform) || [];
  };

  const isPlatformAtLimit = (platform) => {
    return getConnectedAccountsForPlatform(platform).length >= 2;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge variant="success" className="text-xs">Activa</Badge>;
      case 'inactive':
        return <Badge variant="destructive" className="text-xs">Inactiva</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Desconocido</Badge>;
    }
  };

  const getTotalRoastsUsed = () => {
    if (!usage) return 0;
    return Object.values(usage.platformUsage || {}).reduce((total, platform) => total + (platform.roasts || 0), 0);
  };

  const getTotalRoastsLimit = () => {
    return usage?.limit || 5000; // Default limit
  };

  // Roast action handlers
  const handleEditRoast = async (roastId) => {
    // TODO: Implement edit roast functionality
    console.log('Edit roast:', roastId);
  };

  const handleRegenerateRoast = async (roastId) => {
    try {
      const response = await fetch(`/api/user/roasts/${roastId}/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchRecentRoasts(); // Refresh roasts
      }
    } catch (error) {
      console.error('Error regenerating roast:', error);
    }
  };

  const handleDiscardRoast = async (roastId) => {
    try {
      const response = await fetch(`/api/user/roasts/${roastId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        await fetchRecentRoasts(); // Refresh roasts
      }
    } catch (error) {
      console.error('Error discarding roast:', error);
    }
  };

  const handlePublishRoast = async (roastId) => {
    try {
      const response = await fetch(`/api/user/roasts/${roastId}/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchRecentRoasts(); // Refresh roasts
      }
    } catch (error) {
      console.error('Error publishing roast:', error);
    }
  };

  // Modal handlers for AccountModal
  const handleCloseModal = () => {
    setAccountModalOpen(false);
    setSelectedAccount(null);
  };

  const handleAccountAction = async (action, ...args) => {
    if (!selectedAccount) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/user/accounts/${selectedAccount.platform}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(args[0] || {})
      });

      if (response.ok) {
        // Refresh accounts data after successful action
        const accountsRes = await fetch('/api/user/integrations', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          setAccounts(accountsData.data || []);
        }
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
    }
  };

  const handleApproveRoast = async (accountId, roastId) => {
    return handleAccountAction(`roasts/${roastId}/approve`);
  };

  const handleRejectRoast = async (accountId, roastId) => {
    return handleAccountAction(`roasts/${roastId}/decline`);
  };

  const handleToggleAutoApprove = async (accountId, enabled) => {
    return handleAccountAction('settings', { autoApprove: enabled });
  };

  const handleToggleAccount = async (accountId, status) => {
    // For now, just a placeholder - would need backend implementation
    console.log('Toggle account status:', accountId, status);
  };

  const handleChangeShieldLevel = async (accountId, level) => {
    return handleAccountAction('settings', { shieldLevel: level });
  };

  const handleToggleShield = async (accountId, enabled) => {
    return handleAccountAction('settings', { shieldEnabled: enabled });
  };

  const handleChangeTone = async (accountId, tone) => {
    return handleAccountAction('settings', { defaultTone: tone });
  };

  const handleDisconnectAccount = async (accountId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/user/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirmation: 'DISCONNECT' })
      });

      if (response.ok) {
        // Refresh accounts data
        const accountsRes = await fetch('/api/user/integrations', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          setAccounts(accountsData.data || []);
        }
        
        handleCloseModal();
      }
    } catch (error) {
      console.error('Error disconnecting account:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <div className="text-right">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Mode Banner - Issue #240 */}
      {adminMode && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-400 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300">
                  Modo Administrador Activo
                </h3>
                <p className="mt-1 text-sm text-orange-700 dark:text-orange-400">
                  {adminModeUser ? (
                    <>
                      Viendo dashboard de: <strong>{adminModeUser.name || adminModeUser.email}</strong> ({adminModeUser.plan})
                    </>
                  ) : (
                    'Visualizando dashboard de usuario como administrador'
                  )}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={handleExitAdminMode}
                className="bg-orange-50 dark:bg-orange-900/20 rounded-md p-2 inline-flex items-center justify-center text-orange-400 hover:text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500 transition-colors"
              >
                <span className="sr-only">Salir del modo administrador</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="mt-3 flex">
            <button
              onClick={handleExitAdminMode}
              className="bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200 dark:hover:bg-orange-900/60 text-orange-800 dark:text-orange-300 px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              ← Volver al Panel de Admin
            </button>
          </div>
        </div>
      )}

      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Dashboard
          </h1>
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-sm text-muted-foreground">
              Dashboard > X > @handle_1
            </span>
          </div>
        </div>
      </div>

      {/* Dashboard Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Roasts this month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Roasts this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4000</div>
          </CardContent>
        </Card>

        {/* Engagement */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">248 Likes - 50 Shares</div>
          </CardContent>
        </Card>

        {/* Shield interceptions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Shield interceptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">800</div>
          </CardContent>
        </Card>
      </div>



      {/* Recent Roasts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Roasts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Mock roast data based on your design */}
            {[
              {
                id: 1,
                text: "Tu código es una basura",
                response: "Gracias por tu comentario, me encanta tu entusiasmo por la basura",
                status: "approved"
              },
              {
                id: 2,
                text: "Tu código es una basura",
                response: "Gracias por tu comentario, me encanta tu entusiasmo por la basura",
                status: "approved"
              },
              {
                id: 3,
                text: "Tu código es una basura",
                response: "Gracias por tu comentario, me encanta tu entusiasmo por la basura",
                status: "approved"
              },
              {
                id: 4,
                text: "Tu código es una basura",
                response: "Gracias por tu comentario, me encanta tu entusiasmo por la basura",
                status: "approved"
              }
            ].map((roast) => (
              <div key={roast.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground mb-1">{roast.text}</div>
                  <div className="text-sm">{roast.response}</div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <Button size="sm" variant="outline" className="bg-green-50 text-green-600 border-green-200">
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="bg-red-50 text-red-600 border-red-200">
                    <XCircle className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Shield Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Shield</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full justify-start">
            <Users className="h-4 w-4 mr-2" />
            Manage Shielded Comments
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}