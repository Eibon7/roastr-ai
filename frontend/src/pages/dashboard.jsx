import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import AnalysisUsageCard from '../components/widgets/AnalysisUsageCard';
import RoastUsageCard from '../components/widgets/RoastUsageCard';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useSidebar } from '../contexts/SidebarContext';
import {
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
import RoastInlineEditor from '../components/RoastInlineEditor';
import { platformIcons, platformNames, allPlatforms, getPlatformIcon, getPlatformName } from '../config/platforms';
import { normalizePlanId } from '../utils/planHelpers';

export default function Dashboard() {
  const [adminMode, setAdminMode] = useState(false);
  const [adminModeUser, setAdminModeUser] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectingPlatform, setConnectingPlatform] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [recentRoasts, setRecentRoasts] = useState([]);
  const [roastsLoading, setRoastsLoading] = useState(false);
  const [editingRoastId, setEditingRoastId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [shieldExpanded, setShieldExpanded] = useState(false);
  const [shieldData, setShieldData] = useState(null);
  const [shieldLoading, setShieldLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isEnabled, loading: flagsLoading } = useFeatureFlags();
  const { isSidebarVisible } = useSidebar();

  // Available platforms for connection (filtered by feature flags)
  const availablePlatforms = React.useMemo(() => {
    if (flagsLoading) return allPlatforms; // avoid flicker while resolving flags
    return allPlatforms.filter((platform) => {
      if (platform === 'facebook' && !isEnabled('ENABLE_FACEBOOK_UI')) return false;
      if (platform === 'instagram' && !isEnabled('ENABLE_INSTAGRAM_UI')) return false;
      return true;
    });
  }, [flagsLoading, isEnabled]);

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
      setError('No se pudieron cargar los roasts recientes. Por favor, actualiza la página.');
    } finally {
      setRoastsLoading(false);
    }
  };

  // Fetch Shield intercepted items (Issue #366)
  const fetchShieldData = async () => {
    try {
      setShieldLoading(true);
      const response = await fetch('/api/shield/intercepted?limit=5', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setShieldData(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching Shield data:', error);
      // Don't fail the entire dashboard if Shield fails
    } finally {
      setShieldLoading(false);
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

        // Fetch analytics summary (Issue #366)
        try {
          setAnalyticsLoading(true);
          const analyticsRes = await fetch('/api/analytics/summary', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (analyticsRes.ok) {
            const analyticsData = await analyticsRes.json();
            setAnalytics(analyticsData.data || {});
          }
        } catch (analyticsError) {
          console.error('Error fetching analytics:', analyticsError);
          // Don't fail the entire dashboard if analytics fails
        } finally {
          setAnalyticsLoading(false);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('No se pudo cargar el panel. Por favor, actualiza la página.');
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
        // Show success message
        setConnectionStatus({
          type: 'success',
          message: `${getPlatformName(platform)} conectado exitosamente`
        });
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => setConnectionStatus(null), 5000);
        
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
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || 'Error al conectar la plataforma';
        
        setConnectionStatus({
          type: 'error',
          message: `Error al conectar ${getPlatformName(platform)}: ${errorMessage}`
        });
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => setConnectionStatus(null), 5000);
        
        console.error('Failed to connect platform:', errorData);
      }
    } catch (error) {
      console.error('Error connecting platform:', error);
      
      setConnectionStatus({
        type: 'error',
        message: `Error de conexión con ${getPlatformName(platform)}. Por favor, intenta de nuevo.`
      });
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => setConnectionStatus(null), 5000);
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

  // Per-platform connection limits by tier (Issue #841: Changed from global to per-platform)
  const TIER_MAX_CONNECTIONS_PER_PLATFORM = {
    starter_trial: 1,
    starter: 1,
    pro: 2,
    plus: 2,
    custom: 2
  };

  // Compute per-platform connection limits using useMemo for performance
  // Issue #841: Limits are now PER PLATFORM, not global
  const { planTier, maxConnectionsPerPlatform, isAtPlatformLimit, platformConnectionText, platformTooltipText } = useMemo(() => {
    // Determine plan tier - fallback to 'starter_trial' if data is loading
    const tier = normalizePlanId((adminModeUser?.plan || usage?.plan || 'starter_trial').toLowerCase());
    const maxPerPlatform = TIER_MAX_CONNECTIONS_PER_PLATFORM[tier] ?? 1; // Fallback for unknown tiers
    
    // Check if any platform is at limit (per-platform enforcement)
    const platformsAtLimit = allPlatforms.filter(platform => {
      const platformAccounts = getConnectedAccountsForPlatform(platform);
      return platformAccounts.length >= maxPerPlatform;
    });
    
    const atPlatformLimit = platformsAtLimit.length > 0;
    
    // Handle loading state gracefully without blocking UI
    const isDataLoading = !adminModeUser && !usage;
    
    return {
      planTier: tier,
      maxConnectionsPerPlatform: maxPerPlatform,
      isAtPlatformLimit: atPlatformLimit,
      platformConnectionText: isDataLoading 
        ? 'Cargando límites del plan...' 
        : `${maxPerPlatform} cuenta${maxPerPlatform !== 1 ? 's' : ''} por plataforma`,
      platformTooltipText: isDataLoading
        ? 'Cargando información del plan...'
        : atPlatformLimit
          ? (tier === 'starter_trial' || tier === 'starter'
              ? 'Mejora a Pro para conectar más cuentas por plataforma' 
              : 'Has alcanzado el límite de tu plan para alguna plataforma')
          : `Puedes conectar hasta ${maxPerPlatform} cuenta${maxPerPlatform !== 1 ? 's' : ''} por plataforma`
    };
  }, [adminModeUser, usage, accounts]);

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

  const totalRoastsUsed = useMemo(() => {
    if (!usage) return 0;
    return Object.values(usage.platformUsage || {}).reduce((total, platform) => total + (platform.roasts || 0), 0);
  }, [usage]);

  const getTotalRoastsLimit = () => {
    return usage?.limit || 5000; // Default limit
  };

  // Roast action handlers
  const handleEditRoast = async (roastId) => {
    setEditingRoastId(editingRoastId === roastId ? null : roastId);
  };

  const handleSaveEditedRoast = async (roastId, editedText, validation) => {
    if (!validation || validation.valid !== true) {
      setConnectionStatus({ type: 'error', message: 'Valida el contenido antes de guardar' });
      setTimeout(() => setConnectionStatus(null), 3000);
      return;
    }
    try {
      const response = await fetch(`/api/user/roasts/${roastId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: editedText,
          validation: validation
        })
      });

      if (response.ok) {
        await fetchRecentRoasts(); // Refresh roasts
        setEditingRoastId(null);
        
        // Show success message
        setConnectionStatus({
          type: 'success',
          message: 'Roast actualizado exitosamente'
        });
        setTimeout(() => setConnectionStatus(null), 3000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setConnectionStatus({
          type: 'error',
          message: errorData.error || 'Error al guardar el roast'
        });
        setTimeout(() => setConnectionStatus(null), 5000);
      }
    } catch (error) {
      console.error('Error saving edited roast:', error);
      setConnectionStatus({
        type: 'error',
        message: 'Error de conexión al guardar'
      });
      setTimeout(() => setConnectionStatus(null), 5000);
    }
  };

  const handleCancelEditRoast = () => {
    setEditingRoastId(null);
  };

  const handleValidationResult = (validation, credits) => {
    // Update usage data with new credit info if provided
    if (credits && usage) {
      setUsage(prev => ({
        ...prev,
        roastsRemaining: credits.remaining,
        roastsLimit: credits.limit
      }));
    }
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
        // Show success message
        setConnectionStatus({
          type: 'success',
          message: 'Cuenta desconectada exitosamente'
        });
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => setConnectionStatus(null), 5000);
        
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
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || 'Error al desconectar la cuenta';
        
        setConnectionStatus({
          type: 'error',
          message: `Error al desconectar: ${errorMessage}`
        });
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => setConnectionStatus(null), 5000);
      }
    } catch (error) {
      console.error('Error disconnecting account:', error);
      
      setConnectionStatus({
        type: 'error',
        message: 'Error de conexión al desconectar. Por favor, intenta de nuevo.'
      });
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => setConnectionStatus(null), 5000);
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

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-400">
                  {error}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={() => setError(null)}
                className="bg-red-50 dark:bg-red-900/20 text-red-400 hover:text-red-500 focus:outline-none focus:text-red-500 transition ease-in-out duration-150"
              >
                <span className="sr-only">Cerrar</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status */}
      {connectionStatus && (
        <div className={`border-l-4 p-4 mb-6 ${
          connectionStatus.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-400'
            : 'bg-red-50 dark:bg-red-900/20 border-red-400'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {connectionStatus.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm ${
                  connectionStatus.type === 'success'
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400'
                }`}>
                  {connectionStatus.message}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={() => setConnectionStatus(null)}
                className={`${connectionStatus.type === 'success' ? 'text-green-400 hover:text-green-500' : 'text-red-400 hover:text-red-500'} focus:outline-none transition ease-in-out duration-150`}
              >
                <span className="sr-only">Cerrar</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {adminMode && adminModeUser ? `Dashboard de ${adminModeUser.name || adminModeUser.email}` : 'Dashboard'}
          </h1>
        </div>
      </div>

      {/* Usage Cards */}
      <div className={`flex gap-6 mb-8 ${isSidebarVisible ? 'flex-row' : 'flex-col'}`}>
        <AnalysisUsageCard user={adminModeUser || { plan: 'pro' }} />
        <RoastUsageCard user={adminModeUser || { plan: 'pro' }} />
      </div>

      {/* Analytics Metrics (Issue #366) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              Análisis completados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-bold text-green-600">
                {analytics?.completed_analyses ?? 0}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Total de análisis de toxicidad procesados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Send className="h-5 w-5 text-blue-500 mr-2" />
              Roasts enviados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-bold text-blue-600">
                {analytics?.sent_roasts ?? 0}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Total de roasts generados y publicados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Shield Section (Issue #366) */}
      {isEnabled('ENABLE_SHIELD_UI') && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShieldExpanded(!shieldExpanded)}
            >
              <div className="flex items-center">
                <Shield className="h-5 w-5 text-orange-500 mr-2" />
                Shield - Protección Automática
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-orange-600">
                  {shieldData?.length || 0} interceptados
                </Badge>
                <button className="p-1 hover:bg-gray-100 rounded">
                  {shieldExpanded ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
              </div>
            </CardTitle>
          </CardHeader>
          
          {shieldExpanded && (
            <CardContent>
              {shieldLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : shieldData && shieldData.length > 0 ? (
                <div className="space-y-4">
                  {shieldData.map((item, index) => (
                    <div key={index} className="border-l-4 border-orange-400 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-r-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant="secondary" className="text-xs">
                              {item.platform || 'Twitter'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {item.timestamp || 'Hace 1 hora'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                            {item.content || 'Comentario tóxico interceptado por Shield'}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>Toxicidad: {item.toxicity_score || '85%'}</span>
                            <span>Acción: {item.action || 'Bloqueado'}</span>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" className="text-green-600">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        if (!shieldLoading) fetchShieldData();
                      }}
                      disabled={shieldLoading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${shieldLoading ? 'animate-spin' : ''}`} />
                      Actualizar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">Shield está activo</h3>
                  <p className="text-sm text-muted-foreground">
                    No hay comentarios tóxicos interceptados recientemente
                  </p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

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
              const IconComponent = getPlatformIcon(account.platform);
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
                        <h3 className="font-medium">{getPlatformName(account.platform)}</h3>
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
          {/* Global Connection Limits Status */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {platformConnectionText}
                </span>
                {isAtPlatformLimit && (
                  <span 
                    aria-label="Advertencia: Límite global de conexiones alcanzado" 
                    role="img"
                    className="text-amber-500"
                  >
                    ⚠️
                  </span>
                )}
              </div>
              <Badge variant={isAtPlatformLimit ? "destructive" : "outline"} className="text-xs">
                Plan {planTier}
              </Badge>
            </div>
            {isAtPlatformLimit && (
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                {platformTooltipText}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {availablePlatforms.map((platform) => {
              const IconComponent = getPlatformIcon(platform);
              const isPlatformLimit = isPlatformAtLimit(platform);
              const isConnecting = connectingPlatform === platform;
              const isDisabled = isAtPlatformLimit || isPlatformLimit || isConnecting;
              
              // Determine disable reason for accessibility
              const disableReason = isAtPlatformLimit 
                ? "Límite por plataforma alcanzado para tu plan"
                : isPlatformLimit 
                  ? "Límite alcanzado (máximo 2 cuentas por plataforma)"
                  : "";
              
              return (
                <Button
                  key={platform}
                  variant="outline"
                  className="flex items-center space-x-2 h-auto p-4"
                  disabled={isDisabled}
                  aria-disabled={isDisabled}
                  data-testid={`connect-${platform}-button`}
                  onClick={() => handleConnectPlatform(platform)}
                  title={isDisabled ? disableReason : `Conectar cuenta de ${getPlatformName(platform)}`}
                >
                  <IconComponent className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium text-xs">
                      {getPlatformName(platform)}
                    </div>
                    {isAtPlatformLimit ? (
                      <div className="text-xs text-muted-foreground flex items-center space-x-1">
                        <span>Límite global</span>
                        <span 
                          aria-label="Límite global alcanzado" 
                          role="img"
                          className="text-amber-500"
                        >
                          ⚠️
                        </span>
                      </div>
                    ) : isPlatformLimit ? (
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
                    <div 
                      className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"
                      aria-label="Conectando..."
                    />
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
                const IconComponent = getPlatformIcon(roast.platform);
                const isEditing = editingRoastId === roast.id;

                return (
                  <div key={roast.id} className="space-y-4">
                    {/* Regular Roast Display */}
                    {!isEditing && (
                      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center space-x-4 flex-1">
                          <IconComponent className="h-8 w-8 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium truncate">{getPlatformName(roast.platform)}</h4>
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
                            aria-label="Editar roast"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRoast(roast.id)}
                            title="Editar roast"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            aria-label="Regenerar roast"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRegenerateRoast(roast.id)}
                            title="Regenerar roast"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          {roast.status !== 'published' && (
                            <Button
                              aria-label="Publicar roast"
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePublishRoast(roast.id)}
                              title="Publicar roast"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            aria-label="Descartar roast"
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
                    )}

                    {/* Inline Editor */}
                    {isEditing && (
                      <RoastInlineEditor
                        roast={roast.content}
                        roastId={roast.id}
                        platform={roast.platform}
                        onSave={(editedText, validation) => handleSaveEditedRoast(roast.id, editedText, validation)}
                        onCancel={handleCancelEditRoast}
                        onValidate={handleValidationResult}
                      />
                    )}
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