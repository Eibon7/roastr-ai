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
    getAccountById,
    roastsByAccount,
    interceptedByAccount,
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
      {/* Red Sidebar with Icons Only - Matching Main App Design */}
      <div className="fixed left-0 top-0 w-20 h-full z-10" style={{ backgroundColor: '#D11A1A' }}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-20 border-b border-red-500 border-opacity-30">
            <div className="flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6">
            <div className="space-y-3 px-3">
              {/* Dashboard */}
              <a
                href="/dashboard"
                className="flex items-center justify-center w-14 h-14 rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition-colors group"
                title="Dashboard"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </a>

              {/* Compose */}
              <a
                href="/compose"
                className="flex items-center justify-center w-14 h-14 rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition-colors group"
                title="Compose"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </a>

              {/* Integrations */}
              <a
                href="/integrations"
                className="flex items-center justify-center w-14 h-14 rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition-colors group"
                title="Integrations"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </a>

              {/* Accounts - Active State */}
              <a
                href="/accounts"
                className="flex items-center justify-center w-14 h-14 rounded-lg bg-white bg-opacity-20 text-white transition-colors group"
                title="Accounts"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </a>

              {/* Settings */}
              <a
                href="/settings"
                className="flex items-center justify-center w-14 h-14 rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition-colors group"
                title="Settings"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </a>
            </div>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-20 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Mis Redes Sociales
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

        {/* Connect New Account Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Conectar otra cuenta
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {availableNetworks.map(({ network, name, connectedCount }) => {
              const networkIcon = NETWORK_ICONS[network] || '📱';
              const networkColor = NETWORK_COLORS[network] || 'bg-gray-600 text-white';

              return (
                <button
                  key={network}
                  onClick={() => handleOpenConnectModal(network, name)}
                  className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition-all"
                >
                  <div className={`w-12 h-12 mx-auto mb-3 rounded-lg ${networkColor} flex items-center justify-center text-2xl font-bold group-hover:scale-110 transition-transform`}>
                    {networkIcon}
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                    {name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {connectedCount} conectada{connectedCount !== 1 ? 's' : ''}
                  </p>
                </button>
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