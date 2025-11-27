/**
 * AccountsPage Component
 *
 * Multi-tenant social networks management with RLS validation
 * Migrated to shadcn/ui for consistency
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Link2, CheckCircle, Package, Info } from 'lucide-react';
import { useSocialAccounts } from '../hooks/useSocialAccounts';
import AccountCard from '../components/AccountCard';
import NetworkConnectModal from '../components/NetworkConnectModal';
import { NETWORK_ICONS, NETWORK_COLORS } from '../mocks/social';

const AccountsPage = () => {
  const navigate = useNavigate();
  const {
    accounts,
    availableNetworks,
    userData,
    getConnectionLimits,
    totalAccounts,
    activeAccounts,
    totalMonthlyRoasts,
    onConnectNetwork
  } = useSocialAccounts();

  const [connectModal, setConnectModal] = useState({
    isOpen: false,
    network: null,
    networkName: null
  });

  const handleAccountClick = (accountId) => {
    navigate(`/app/accounts/${accountId}`);
  };

  const handleOpenConnectModal = (network, networkName) => {
    setConnectModal({ isOpen: true, network, networkName });
  };

  const handleCloseConnectModal = () => {
    setConnectModal({ isOpen: false, network: null, networkName: null });
  };

  const handleConnect = (network) => {
    onConnectNetwork(network);
  };

  const formatRoastCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Content */}
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Cuentas conectadas
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestiona tus cuentas conectadas y configura tus roasts automáticos
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Link2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-muted-foreground">Cuentas conectadas</p>
                  <p className="text-2xl font-bold">{totalAccounts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-muted-foreground">Cuentas activas</p>
                  <p className="text-2xl font-bold">{activeAccounts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <Package className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-muted-foreground">Roasts este mes</p>
                  <p className="text-2xl font-bold">{formatRoastCount(totalMonthlyRoasts)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Connected Accounts Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Mis redes conectadas
          </h2>

          {accounts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">📱</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No tienes cuentas conectadas
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Conecta tu primera red social para empezar a generar roasts automáticos
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onClick={() => handleAccountClick(account.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Connection Limits Info Section */}
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <h3 className="text-sm font-medium mb-2">Límites de conexión por plan</h3>
            <div className="text-sm space-y-2">
              <p>
                <strong>Tu plan actual ({userData?.plan || 'starter_trial'}):</strong>{' '}
                {getConnectionLimits().maxConnectionsPerPlatform} cuenta
                {getConnectionLimits().maxConnectionsPerPlatform !== 1 ? 's' : ''} por plataforma
              </p>
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>
                  • <strong>Plan Starter Trial/Starter:</strong> 1 cuenta por plataforma
                </p>
                <p>
                  • <strong>Plan Pro y Plus:</strong> 2 cuentas por plataforma
                </p>
              </div>
              {(getConnectionLimits().planTier === 'starter_trial' ||
                getConnectionLimits().planTier === 'starter') && (
                <p className="text-xs mt-2">
                  💡 Actualiza a Pro para conectar hasta 2 cuentas por red social
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>

        {/* Connect New Account Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Conectar otra cuenta
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {availableNetworks.map(
              ({ network, name, connectedCount, canConnect, limitReached, totalConnections }) => {
                const networkIcon = NETWORK_ICONS[network] || '📱';
                const networkColor = NETWORK_COLORS[network] || 'bg-gray-600 text-white';
                const { maxConnections, planTier } = getConnectionLimits();

                return (
                  <Card key={network} className={`relative ${!canConnect ? 'opacity-50' : ''}`}>
                    <CardContent className="p-4">
                      <Button
                        onClick={() => (canConnect ? handleOpenConnectModal(network, name) : null)}
                        disabled={!canConnect}
                        variant="ghost"
                        className="w-full h-auto flex flex-col items-center p-0 hover:bg-transparent"
                        title={
                          !canConnect
                            ? `Límite alcanzado: máximo ${maxConnections} conexión${maxConnections !== 1 ? 'es' : ''} totales (Plan ${planTier})`
                            : `Conectar ${name}`
                        }
                      >
                        <div
                          className={`w-12 h-12 mx-auto mb-3 rounded-lg ${networkColor} flex items-center justify-center text-2xl font-bold transition-transform ${canConnect ? 'group-hover:scale-110' : ''}`}
                        >
                          {networkIcon}
                        </div>
                        <h3 className="font-medium text-sm mb-1">{name}</h3>
                        <Badge variant="secondary" className="text-xs mb-1">
                          {totalConnections}/{maxConnections}
                        </Badge>
                        {!canConnect && (
                          <Badge variant="destructive" className="text-xs">
                            Límite alcanzado
                          </Badge>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              }
            )}
          </div>
        </div>
      </div>

      {/* Connect Network Modal */}
      <NetworkConnectModal
        network={connectModal.network}
        networkName={connectModal.networkName}
        isOpen={connectModal.isOpen}
        onConnect={handleConnect}
        onClose={handleCloseConnectModal}
      />
    </div>
  );
};

export default AccountsPage;
