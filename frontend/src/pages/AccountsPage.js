/**
 * AccountsPage Component
 *
 * Main social networks management page with connected accounts and network connection
 * Updated with red sidebar design
 */

import React, { useState } from 'react';
import { useSocialAccounts } from '../hooks/useSocialAccounts';
import AccountCard from '../components/AccountCard';
import AccountModal from '../components/AccountModal';
import NetworkConnectModal from '../components/NetworkConnectModal';
import { NETWORK_ICONS, NETWORK_COLORS } from '../mocks/social';

const AccountsPage = () => {
  const {
    accounts,
    availableNetworks,
    userData,
    getAccountById,
    roastsByAccount,
    interceptedByAccount,
    getConnectionLimits,
    totalAccounts,
    activeAccounts,
    totalMonthlyRoasts,
    onApproveRoast,
    onRejectRoast,
    onToggleAutoApprove,
    onToggleAccount,
    onChangeShieldLevel,
    onToggleShield,
    onChangeTone,
    onConnectNetwork,
    onDisconnectAccount,
  } = useSocialAccounts();

  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [connectModal, setConnectModal] = useState({ isOpen: false, network: null, networkName: null });

  const selectedAccount = selectedAccountId ? getAccountById(selectedAccountId) : null;

  const handleAccountClick = (accountId) => {
    setSelectedAccountId(accountId);
  };

  const handleCloseAccountModal = () => {
    setSelectedAccountId(null);
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
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Cuentas conectadas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAccounts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Cuentas activas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeAccounts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10m0 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v2m10 0v10a2 2 0 01-2 2H9a2 2 0 01-2-2V8" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Roasts este mes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatRoastCount(totalMonthlyRoasts)}</p>
              </div>
            </div>
          </div>
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
              {accounts.map(account => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onClick={() => handleAccountClick(account.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Connection Limits Info Section (Issue #366 CodeRabbit feedback) */}
        <div className="mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900 mb-1">
                  Límites de conexión por plan
                </h3>
                <div className="text-sm text-blue-800">
                  <p className="mb-2">
                    <strong>Tu plan actual ({userData?.plan || 'free'}):</strong> {getConnectionLimits().maxConnections} conexión{getConnectionLimits().maxConnections !== 1 ? 'es' : ''} por red social
                  </p>
                  <div className="text-xs space-y-1">
                    <p>• <strong>Plan Free:</strong> 1 conexión por red social</p>
                    <p>• <strong>Plan Pro y superiores:</strong> 2 conexiones por red social</p>
                  </div>
                  {getConnectionLimits().planTier === 'free' && (
                    <p className="text-xs mt-2 text-blue-700">
                      💡 Actualiza a Pro para conectar hasta 2 cuentas por red social
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Connect New Account Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Conectar otra cuenta
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {availableNetworks.map(({ network, name, connectedCount, canConnect, limitReached }) => {
              const networkIcon = NETWORK_ICONS[network] || '📱';
              const networkColor = NETWORK_COLORS[network] || 'bg-gray-600 text-white';
              const { maxConnections, planTier } = getConnectionLimits();

              return (
                <div key={network} className="relative">
                  <button
                    onClick={() => canConnect ? handleOpenConnectModal(network, name) : null}
                    disabled={!canConnect}
                    className={`group w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 transition-all ${
                      canConnect 
                        ? 'hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 cursor-pointer' 
                        : 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-700'
                    }`}
                    title={
                      !canConnect 
                        ? `Límite alcanzado: ${maxConnections} conexión${maxConnections !== 1 ? 'es' : ''} por red social (Plan ${planTier})` 
                        : `Conectar ${name}`
                    }
                  >
                    <div className={`w-12 h-12 mx-auto mb-3 rounded-lg ${networkColor} flex items-center justify-center text-2xl font-bold ${canConnect ? 'group-hover:scale-110' : ''} transition-transform`}>
                      {networkIcon}
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                      {name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {connectedCount}/{maxConnections} conectada{connectedCount !== 1 ? 's' : ''}
                    </p>
                    {!canConnect && (
                      <p className="text-xs text-red-500 dark:text-red-400">
                        Límite alcanzado
                      </p>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Account Modal */}
      {selectedAccount && (
        <AccountModal
          account={selectedAccount}
          roasts={roastsByAccount(selectedAccount.id)}
          intercepted={interceptedByAccount(selectedAccount.id)}
          onApproveRoast={onApproveRoast}
          onRejectRoast={onRejectRoast}
          onToggleAutoApprove={onToggleAutoApprove}
          onToggleAccount={onToggleAccount}
          onChangeShieldLevel={onChangeShieldLevel}
          onToggleShield={onToggleShield}
          onChangeTone={onChangeTone}
          onDisconnectAccount={onDisconnectAccount}
          onClose={handleCloseAccountModal}
        />
      )}

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