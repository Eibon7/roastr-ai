/**
 * NetworkConnectModal Component
 * 
 * Modal for connecting a new social media account
 */

import React from 'react';
import { NETWORK_ICONS, NETWORK_COLORS } from '../mocks/social';

const NetworkConnectModal = ({ network, networkName, onConnect, onClose, isOpen }) => {
  if (!isOpen) return null;

  const networkIcon = NETWORK_ICONS[network] || '📱';
  const networkColor = NETWORK_COLORS[network] || 'bg-gray-600 text-white';

  const handleConnect = () => {
    onConnect(network);
    onClose();
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

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-lg ${networkColor} flex items-center justify-center text-xl font-bold`}>
              {networkIcon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Conectar {networkName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Autoriza el acceso a tu cuenta
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

        {/* Content */}
        <div className="mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              ¿Qué permisos necesitamos?
            </h3>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Leer comentarios en tus publicaciones</li>
              <li>• Responder a comentarios (roasts)</li>
              <li>• Acceso básico al perfil público</li>
            </ul>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Serás redirigido a {networkName} para autorizar la conexión. 
            Podrás desconectar tu cuenta en cualquier momento.
          </p>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConnect}
            className={`flex-1 px-4 py-2 text-sm font-medium text-white ${networkColor.includes('gradient') ? networkColor : networkColor.replace('text-white', '')} hover:opacity-90 rounded-lg transition-opacity`}
          >
            Conectar
          </button>
        </div>
      </div>
    </div>
  );
};

export default NetworkConnectModal;