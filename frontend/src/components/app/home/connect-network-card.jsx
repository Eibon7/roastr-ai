/**
 * Connect Network Card Component - Issue #1045
 *
 * Bloque de redes disponibles para conectar con OAuth
 * Endpoint: /api/accounts/connect/:platform
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Skeleton } from '../../ui/skeleton';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { platformIcons, platformNames, allPlatforms } from '../../../config/platforms';
import { apiClient } from '../../../lib/api';
import { getCurrentPlan } from '../../../api/plans';
import { normalizePlanId } from '../../../utils/planHelpers';
import { toast } from 'sonner';

// Límites por plan (cuentas máximas por plataforma)
const TIER_MAX_CONNECTIONS_PER_PLATFORM = {
  starter_trial: 1,
  starter: 1,
  pro: 2,
  plus: 2,
  custom: 2
};

export default function ConnectNetworkCard({ accounts = [], onAccountConnected }) {
  const [currentPlan, setCurrentPlan] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const planData = await getCurrentPlan();
        setCurrentPlan(planData || {});
      } catch (err) {
        console.error('Error fetching plan:', err);
        setCurrentPlan({ plan: 'starter_trial' });
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, []);

  const getConnectedCountForPlatform = (platform) => {
    return accounts.filter((acc) => acc.platform === platform).length;
  };

  const getMaxConnections = () => {
    const planId = normalizePlanId(currentPlan?.plan || 'starter_trial');
    return TIER_MAX_CONNECTIONS_PER_PLATFORM[planId] || 1;
  };

  const isPlatformAtLimit = (platform) => {
    const connected = getConnectedCountForPlatform(platform);
    const max = getMaxConnections();
    return connected >= max;
  };

  const handleConnect = async (platform) => {
    if (isPlatformAtLimit(platform)) {
      toast.error(`Has alcanzado el máximo de cuentas para ${platformNames[platform]}`);
      return;
    }

    try {
      setConnecting(platform);
      setError(null);

      // Iniciar OAuth flow
      const response = await apiClient.post(`/accounts/connect/${platform}`, {});

      if (response.success || response.data?.authUrl) {
        // Redirigir a OAuth URL
        const authUrl = response.data?.authUrl || response.authUrl;
        if (authUrl) {
          window.location.href = authUrl;
        } else {
          // Si no hay URL, asumir que la conexión fue directa
          toast.success(`Cuenta de ${platformNames[platform]} conectada correctamente`);
          if (onAccountConnected) {
            onAccountConnected();
          }
        }
      } else {
        throw new Error(response.error || 'Error al iniciar conexión');
      }
    } catch (err) {
      console.error('Error connecting platform:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Error al conectar';
      setError(errorMessage);
      toast.error(`Error al conectar ${platformNames[platform]}: ${errorMessage}`);
    } finally {
      setConnecting(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {allPlatforms.slice(0, 8).map((platform) => (
              <Skeleton key={platform} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxConnections = getMaxConnections();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Redes Disponibles</CardTitle>
        <p className="text-sm text-muted-foreground">
          Conecta tus cuentas de redes sociales para empezar
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {allPlatforms.map((platform) => {
            const PlatformIcon = platformIcons[platform] || platformIcons.twitter;
            const connected = getConnectedCountForPlatform(platform);
            const atLimit = isPlatformAtLimit(platform);
            const isConnecting = connecting === platform;

            return (
              <Button
                key={platform}
                variant={atLimit ? 'outline' : 'default'}
                disabled={atLimit || isConnecting}
                onClick={() => handleConnect(platform)}
                className="h-auto flex-col items-center justify-center p-4 space-y-2 relative"
              >
                {isConnecting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <PlatformIcon className="h-6 w-6" />
                    <span className="text-xs font-medium">{platformNames[platform]}</span>
                    <Badge variant={atLimit ? 'destructive' : 'secondary'} className="text-xs">
                      {connected}/{maxConnections}
                    </Badge>
                    {connected > 0 && (
                      <CheckCircle className="h-4 w-4 absolute top-1 right-1 text-green-500" />
                    )}
                  </>
                )}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
