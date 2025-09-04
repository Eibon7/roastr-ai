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
            {adminMode && adminModeUser ? `Dashboard de ${adminModeUser.name || adminModeUser.email}` : 'Cuentas conectadas'}
          </h1>
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-2xl font-semibold">
              {getTotalRoastsUsed().toLocaleString()} / {getTotalRoastsLimit().toLocaleString()}
            </span>
            <span className="text-muted-foreground">roasts utilizados</span>
          </div>
        </div>
      </div>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Mis cuentas conectadas</span>
            <Badge variant="outline">
              {accounts?.length || 0} conectadas
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts && accounts.length > 0 ? (
            accounts.map((account) => {
              const IconComponent = platformIcons[account.platform] || AlertCircle;
              const platformUsage = usage?.platformUsage?.[account.platform] || {};
              
              return (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedAccount(account);
                    setAccountModalOpen(true);
                  }}
                >
                  <div className="flex items-center space-x-4">
                    <IconComponent className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium">{platformNames[account.platform]}</h3>
                        {getStatusIcon(account.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        @{account.username || account.handle || 'usuario'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-2 mb-1">
                      {getStatusBadge(account.status)}
                      {account.shield_enabled && (
                        <Badge variant="outline" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Shield
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {platformUsage.roasts || 0} / {platformUsage.limit || 1000} roasts
                    </p>
                    <div className="flex items-center space-x-1 mt-1">
                      <SettingsIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {account.tone || 'sarcastic'} • {account.auto_approve ? 'Auto' : 'Manual'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No hay cuentas conectadas</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Conecta tus redes sociales para empezar a usar Roastr
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connect New Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Conectar otras cuentas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {availablePlatforms.map((platform) => {
              const IconComponent = platformIcons[platform];
              const isAtLimit = isPlatformAtLimit(platform);
              const isConnecting = connectingPlatform === platform;
              
              return (
                <Button
                  key={platform}
                  variant="outline"
                  className="flex items-center space-x-2 h-auto p-4"
                  disabled={isAtLimit || isConnecting}
                  onClick={() => handleConnectPlatform(platform)}
                  title={isAtLimit ? "Límite alcanzado (máximo 2 cuentas por plataforma)" : ""}
                >
                  <IconComponent className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium text-xs">
                      {platformNames[platform]}
                    </div>
                    {isAtLimit ? (
                      <div className="text-xs text-muted-foreground">
                        Límite alcanzado
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        {getConnectedAccountsForPlatform(platform).length}/2 conectadas
                      </div>
                    )}
                  </div>
                  {isConnecting && (
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  )}
                </Button>
              );
            })}
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <button className="flex items-center space-x-2 text-sm text-primary hover:underline">
              <ExternalLink className="h-4 w-4" />
              <span>Ver todas las integraciones disponibles</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Roasts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Últimos roasts</span>
            </div>
            <Badge variant="outline">
              {recentRoasts.length} recientes
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {roastsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-8 w-8 rounded" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentRoasts.length > 0 ? (
            <div className="space-y-4">
              {recentRoasts.map((roast) => {
                const IconComponent = platformIcons[roast.platform] || AlertCircle;

                return (
                  <div
                    key={roast.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <IconComponent className="h-8 w-8 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium truncate">{platformNames[roast.platform]}</h4>
                          <Badge
                            variant={roast.status === 'published' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {roast.status === 'published' ? 'Publicado' :
                             roast.status === 'pending' ? 'Pendiente' : 'Borrador'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {roast.content || 'Sin contenido'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(roast.created_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditRoast(roast.id)}
                        title="Editar roast"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerateRoast(roast.id)}
                        title="Regenerar roast"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      {roast.status !== 'published' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePublishRoast(roast.id)}
                          title="Publicar roast"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDiscardRoast(roast.id)}
                        title="Descartar roast"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No hay roasts recientes</h3>
              <p className="text-sm text-muted-foreground">
                Los roasts aparecerán aquí cuando empieces a usar Roastr
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Modal */}
      {accountModalOpen && selectedAccount && (
        <AccountModal
          account={selectedAccount}
          roasts={[]} // Will be fetched by the modal
          intercepted={[]} // Mock Shield data
          onApproveRoast={handleApproveRoast}
          onRejectRoast={handleRejectRoast}
          onToggleAutoApprove={handleToggleAutoApprove}
          onToggleAccount={handleToggleAccount}
          onChangeShieldLevel={handleChangeShieldLevel}
          onToggleShield={handleToggleShield}
          onChangeTone={handleChangeTone}
          onDisconnectAccount={handleDisconnectAccount}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}