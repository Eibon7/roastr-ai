/**
 * AccountModal Component
 * 
 * Modal for managing individual social media account settings, roasts, and shield
 */

import React, { useState, useCallback, useEffect } from 'react';
import ShieldInterceptedList from './ShieldInterceptedList';
import { NETWORK_ICONS, NETWORK_COLORS, TONE_EXAMPLES, SHIELD_LEVELS, TONE_OPTIONS } from '../mocks/social';

const AccountModal = ({
  account,
  roasts: initialRoasts,
  intercepted: initialIntercepted,
  onApproveRoast,
  onRejectRoast,
  onToggleAutoApprove,
  onToggleAccount,
  onChangeShieldLevel,
  onToggleShield,
  onChangeTone,
  onDisconnectAccount,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState('roasts');
  const [shieldExpanded, setShieldExpanded] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});
  const [accountDetails, setAccountDetails] = useState(null);
  const [roasts, setRoasts] = useState(initialRoasts || []);
  const [intercepted, setIntercepted] = useState(initialIntercepted || []);
  const [loading, setLoading] = useState(true);
  const [shieldLoading, setShieldLoading] = useState(false);

  const networkIcon = NETWORK_ICONS[account.network || account.platform] || '📱';
  const networkColor = NETWORK_COLORS[account.network || account.platform] || 'bg-gray-600 text-white';
  const isActive = account.status === 'active' || account.status === 'connected';

  // Fetch account details and roasts when modal opens
  useEffect(() => {
    const fetchAccountData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        // Fetch account details
        const detailsResponse = await fetch(`/api/user/accounts/${account.platform || account.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json();
          setAccountDetails(detailsData.data);
        }

        // Fetch recent roasts
        const roastsResponse = await fetch(`/api/user/accounts/${account.platform || account.id}/roasts?limit=10`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (roastsResponse.ok) {
          const roastsData = await roastsResponse.json();
          setRoasts(roastsData.data || []);
        }

        // Fetch real Shield intercepted events
        await fetchShieldEvents();

      } catch (error) {
        console.error('Error fetching account data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (account) {
      fetchAccountData();
    }
  }, [account]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRoastCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleAsyncAction = useCallback(async (actionKey, asyncAction, successMessage) => {
    setLoadingStates(prev => ({ ...prev, [actionKey]: true }));
    
    try {
      await asyncAction();
      // TODO: Show success toast with successMessage
    } catch (error) {
      // TODO: Show error toast
      console.error(`Action ${actionKey} failed:`, error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [actionKey]: false }));
    }
  }, []);

  const handleApproveRoast = useCallback((roastId) => {
    handleAsyncAction(
      `approve-${roastId}`,
      () => onApproveRoast(account.id, roastId),
      'Roast aprobado correctamente'
    );
  }, [account.id, onApproveRoast, handleAsyncAction]);

  const handleRejectRoast = useCallback((roastId) => {
    handleAsyncAction(
      `reject-${roastId}`,
      () => onRejectRoast(account.id, roastId),
      'Roast rechazado correctamente'
    );
  }, [account.id, onRejectRoast, handleAsyncAction]);

  // New roast action handlers
  const handleEditRoast = useCallback((roastId) => {
    handleAsyncAction(
      `edit-${roastId}`,
      () => {
        // TODO: Implement edit roast functionality
        console.log('Edit roast:', roastId);
      },
      'Roast editado correctamente'
    );
  }, [handleAsyncAction]);

  const handleRegenerateRoast = useCallback((roastId) => {
    handleAsyncAction(
      `regenerate-${roastId}`,
      async () => {
        const response = await fetch(`/api/user/roasts/${roastId}/regenerate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        if (!response.ok) throw new Error('Failed to regenerate roast');
      },
      'Roast regenerado correctamente'
    );
  }, [handleAsyncAction]);

  const handlePublishRoast = useCallback((roastId) => {
    handleAsyncAction(
      `publish-${roastId}`,
      async () => {
        const response = await fetch(`/api/user/roasts/${roastId}/publish`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        if (!response.ok) throw new Error('Failed to publish roast');
      },
      'Roast publicado correctamente'
    );
  }, [handleAsyncAction]);

  const handleDiscardRoast = useCallback((roastId) => {
    handleAsyncAction(
      `discard-${roastId}`,
      async () => {
        const response = await fetch(`/api/user/roasts/${roastId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (!response.ok) throw new Error('Failed to discard roast');
      },
      'Roast descartado correctamente'
    );
  }, [handleAsyncAction]);

  const handleDisconnect = () => {
    handleAsyncAction(
      'disconnect',
      async () => {
        await onDisconnectAccount(account.id);
        setShowDisconnectConfirm(false);
        onClose();
      },
      'Cuenta desconectada correctamente'
    );
  };

  // Fetch Shield events function
  const fetchShieldEvents = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Build query parameters safely using URLSearchParams
      const params = new URLSearchParams({
        timeRange: '30d',
        limit: '50'
      });

      // Check for platform value from multiple sources
      const platform = account.platform || account.network || accountDetails?.platform;
      
      // Only add platform parameter if a valid value exists
      if (platform && platform !== 'undefined') {
        params.append('platform', platform);
      }

      const shieldResponse = await fetch(`/api/shield/events?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (shieldResponse.ok) {
        const shieldData = await shieldResponse.json();
        setIntercepted(shieldData.data?.events || []);
      } else {
        console.warn('Failed to fetch shield events, using empty array');
        setIntercepted([]);
      }
    } catch (error) {
      console.error('Error fetching Shield events:', error);
      setIntercepted([]);
    }
  };

  // Refresh Shield events handler
  const handleRefreshShieldEvents = async () => {
    setShieldLoading(true);
    try {
      await fetchShieldEvents();
    } catch (error) {
      console.error('Failed to refresh Shield events:', error);
    } finally {
      setShieldLoading(false);
    }
  };

  // Shield revert action handler
  const handleRevertShieldAction = async (actionId, reason = '') => {
    const response = await fetch(`/api/shield/revert/${actionId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to revert Shield action');
    }

    return response.json();
  };

  const tabs = [
    { id: 'roasts', name: 'Últimos roasts', icon: '💬' },
    { id: 'shield', name: 'Shield', icon: '🛡️' },
    { id: 'settings', name: 'Settings', icon: '⚙️' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {loading ? (
          // Loading State
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] mb-4">
              <span className="sr-only">Cargando...</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400">Cargando datos de la cuenta...</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-lg ${networkColor} flex items-center justify-center text-2xl font-bold`}>
              {networkIcon}
            </div>
            
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {accountDetails?.handle || account.handle || account.username || `@${account.platform}_user`}
                </h2>
                
                {/* Status */}
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className={`text-sm font-medium ${isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                
                {/* Monthly Roasts */}
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {formatRoastCount(accountDetails?.monthlyRoasts || account.monthlyRoasts || 0)} roasts/mes
                </div>
              </div>
              
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                {account.platform === 'twitter' ? 'X / Twitter' : account.platform}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Cerrar modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Roasts Tab */}
          {activeTab === 'roasts' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Últimos roasts generados
              </h3>
              
              {roasts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 dark:text-gray-500 text-4xl mb-2">💬</div>
                  <p className="text-gray-500 dark:text-gray-400">
                    No hay roasts generados aún
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {roasts.map(roast => (
                    <div key={roast.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Original Comment */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                            Comentario original
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded border">
                            "{roast.original}"
                          </p>
                        </div>

                        {/* Generated Roast */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                            Roast generado
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 bg-primary-50 dark:bg-primary-900/20 p-3 rounded border border-primary-200 dark:border-primary-800">
                            "{roast.roast}"
                          </p>
                        </div>
                      </div>

                      {/* Actions and Status */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(roast.createdAt)}
                          </span>
                          
                          {/* Status Badge */}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            roast.status === 'approved' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' :
                            roast.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' :
                            'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                          }`}>
                            {roast.status === 'approved' ? 'Aprobado' : 
                             roast.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex space-x-2">
                          {/* Edit Button */}
                          <button
                            onClick={() => handleEditRoast(roast.id)}
                            disabled={loadingStates[`edit-${roast.id}`]}
                            className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50"
                            aria-label="Editar roast"
                          >
                            {loadingStates[`edit-${roast.id}`] ? '⏳' : '✏️'} Editar
                          </button>

                          {/* Regenerate Button */}
                          <button
                            onClick={() => handleRegenerateRoast(roast.id)}
                            disabled={loadingStates[`regenerate-${roast.id}`]}
                            className="px-3 py-1 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors disabled:opacity-50"
                            aria-label="Regenerar roast"
                          >
                            {loadingStates[`regenerate-${roast.id}`] ? '⏳' : '🔄'} Regenerar
                          </button>

                          {/* Publish Button - Only show if not published */}
                          {roast.status !== 'published' && (
                            <button
                              onClick={() => handlePublishRoast(roast.id)}
                              disabled={loadingStates[`publish-${roast.id}`]}
                              className="px-3 py-1 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors disabled:opacity-50"
                              aria-label="Publicar roast"
                            >
                              {loadingStates[`publish-${roast.id}`] ? '⏳' : '📤'} Publicar
                            </button>
                          )}

                          {/* Discard Button */}
                          <button
                            onClick={() => handleDiscardRoast(roast.id)}
                            disabled={loadingStates[`discard-${roast.id}`]}
                            className="px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                            aria-label="Descartar roast"
                          >
                            {loadingStates[`discard-${roast.id}`] ? '⏳' : '🗑️'} Descartar
                          </button>

                          {/* Approval Buttons - Only show if auto-approve is OFF and status is pending */}
                          {!(accountDetails?.settings?.autoApprove || false) && roast.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleRejectRoast(roast.id)}
                                disabled={loadingStates[`reject-${roast.id}`]}
                                className="px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                                aria-label="Rechazar roast"
                              >
                                {loadingStates[`reject-${roast.id}`] ? '⏳' : '❌'} Rechazar
                              </button>
                              <button
                                onClick={() => handleApproveRoast(roast.id)}
                                disabled={loadingStates[`approve-${roast.id}`]}
                                className="px-3 py-1 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors disabled:opacity-50"
                                aria-label="Aprobar roast"
                              >
                                {loadingStates[`approve-${roast.id}`] ? '⏳' : '✅'} Aprobar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Shield Tab */}
          {activeTab === 'shield' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Roastr Shield
                  </h3>
                  
                  {/* Shield Status */}
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${accountDetails?.settings?.shieldEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className={`text-sm font-medium ${
                      accountDetails?.settings?.shieldEnabled 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {accountDetails?.settings?.shieldEnabled ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Shield protege automáticamente tu cuenta interceptando comentarios tóxicos y tomando acciones preventivas.
                </p>
              </div>

              {/* Shield Stats */}
              {accountDetails?.settings?.shieldEnabled && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Estadísticas de protección
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {intercepted.length}
                      </div>
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        Interceptados
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {accountDetails?.settings?.shieldLevel || 50}%
                      </div>
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        Nivel actual
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {intercepted.filter(i => i.action === 'Reportar').length}
                      </div>
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        Reportados
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Intercepted Comments */}
              <div>
                <button
                  onClick={() => setShieldExpanded(!shieldExpanded)}
                  className="flex items-center justify-between w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  disabled={!(accountDetails?.settings?.shieldEnabled || false)}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">🛡️</span>
                    <div className="text-left">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Comentarios interceptados por Roastr Shield
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {intercepted.length} comentarios bloqueados
                      </p>
                    </div>
                  </div>
                  
                  {accountDetails?.settings?.shieldEnabled && (
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        shieldExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>

                {shieldExpanded && accountDetails?.settings?.shieldEnabled && (
                  <div className="mt-4">
                    <ShieldInterceptedList 
                      interceptedItems={intercepted}
                      onRevertAction={handleRevertShieldAction}
                      loading={loading || shieldLoading}
                      onRefresh={handleRefreshShieldEvents}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Configuración de cuenta
              </h3>

              {/* Auto Approval */}
              <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-medium text-gray-900 dark:text-white">
                      Aprobación automática
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Los roasts se publican automáticamente sin revisión manual
                    </p>
                  </div>
                  
                  <button
                    onClick={() => onToggleAutoApprove(account.platform || account.id, !(accountDetails?.settings?.autoApprove || false))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      accountDetails?.settings?.autoApprove ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        accountDetails?.settings?.autoApprove ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Shield Toggle */}
              <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-base font-medium text-gray-900 dark:text-white">
                      Roastr Shield
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Protección automática contra comentarios tóxicos
                    </p>
                  </div>
                  
                  <button
                    onClick={() => onToggleShield(account.platform || account.id, !(accountDetails?.settings?.shieldEnabled || false))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      accountDetails?.settings?.shieldEnabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        accountDetails?.settings?.shieldEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Shield Level Dropdown */}
                {accountDetails?.settings?.shieldEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nivel de protección
                    </label>
                    <select
                      value={accountDetails?.settings?.shieldLevel || 50}
                      onChange={(e) => onChangeShieldLevel(account.platform || account.id, parseInt(e.target.value))}
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {SHIELD_LEVELS.map(level => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Default Tone */}
              <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <div className="mb-4">
                  <label className="block text-base font-medium text-gray-900 dark:text-white mb-2">
                    Tono del roast por defecto
                  </label>
                  <select
                    value={accountDetails?.settings?.defaultTone || 'Balanceado'}
                    onChange={(e) => onChangeTone(account.platform || account.id, e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {TONE_OPTIONS.map(tone => (
                      <option key={tone} value={tone}>
                        {tone}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tone Preview */}
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                  <p className="text-sm text-purple-900 dark:text-purple-100 font-medium mb-1">
                    Ejemplo de roast {(accountDetails?.settings?.defaultTone || 'Balanceado').toLowerCase()}:
                  </p>
                  <p className="text-sm text-purple-700 dark:text-purple-300 italic">
                    {TONE_EXAMPLES[accountDetails?.settings?.defaultTone || 'Balanceado']}
                  </p>
                </div>
              </div>

              {/* Account Status Toggle */}
              <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-medium text-gray-900 dark:text-white">
                      Estado de la cuenta
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {isActive ? 'La cuenta está activa y generando roasts' : 'La cuenta está pausada'}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => onToggleAccount(accountDetails?.id || account.platform || account.id, isActive ? 'inactive' : 'active')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/40'
                        : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40'
                    }`}
                  >
                    {isActive ? 'Pausar cuenta' : 'Activar cuenta'}
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div>
                <h4 className="text-base font-medium text-red-600 dark:text-red-400 mb-4">
                  Zona de peligro
                </h4>
                
                {!showDisconnectConfirm ? (
                  <button
                    onClick={() => setShowDisconnectConfirm(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Desconectar cuenta
                  </button>
                ) : (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-sm text-red-800 dark:text-red-300 mb-4">
                      ¿Estás seguro? Esta acción eliminará permanentemente la conexión con {account.handle} 
                      y todos los datos asociados.
                    </p>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => setShowDisconnectConfirm(false)}
                        className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-transparent border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleDisconnect}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Confirmar desconexión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AccountModal;