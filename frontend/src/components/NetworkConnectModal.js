/**
 * NetworkConnectModal Component
 *
 * Modal for connecting a new social media account with credentials
 */

import React, { useState } from 'react';
import { NETWORK_ICONS, NETWORK_COLORS } from '../mocks/social';

const NetworkConnectModal = ({ network, networkName, onConnect, onClose, isOpen }) => {
  const [step, setStep] = useState(1); // 1: credentials, 2: validation, 3: success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    apiKey: '',
    accessToken: ''
  });
  const [validationResult, setValidationResult] = useState(null);

  if (!isOpen) return null;

  const networkIcon = NETWORK_ICONS[network] || '📱';
  const networkColor = NETWORK_COLORS[network] || 'bg-gray-600 text-white';

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Step 1: Submit credentials and validate connection
      const response = await fetch('/api/user/integrations/connect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform: network,
          credentials: credentials
        })
      });

      const data = await response.json();

      if (response.ok) {
        setValidationResult(data);
        setStep(2);
      } else {
        setError(data.error || 'Error al conectar la cuenta');
      }
    } catch (err) {
      setError('Error de conexión. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateResponse = async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 2: Test if we can post from the connected account
      const response = await fetch('/api/user/integrations/test-response', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform: network,
          accountId: validationResult.accountId
        })
      });

      const data = await response.json();

      if (response.ok) {
        setStep(3);
        // Call the parent's onConnect with the successful connection data
        setTimeout(() => {
          onConnect(network, data);
          onClose();
        }, 2000);
      } else {
        setError(data.error || 'No se pudo validar la capacidad de respuesta');
      }
    } catch (err) {
      setError('Error al validar la cuenta. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
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
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg mx-4 shadow-xl">
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
                Paso {step} de 3
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
          {/* Step 1: Credentials */}
          {step === 1 && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Credenciales de {networkName}
                </h3>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Ingresa tus credenciales para conectar tu cuenta de {networkName}
                </p>
              </div>

              {network === 'twitter' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      API Key
                    </label>
                    <input
                      type="text"
                      value={credentials.apiKey}
                      onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="Tu API Key de Twitter"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Access Token
                    </label>
                    <input
                      type="text"
                      value={credentials.accessToken}
                      onChange={(e) => setCredentials(prev => ({ ...prev, accessToken: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="Tu Access Token de Twitter"
                      required
                    />
                  </div>
                </>
              )}

              {(network === 'instagram' || network === 'facebook') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Usuario
                    </label>
                    <input
                      type="text"
                      value={credentials.username}
                      onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="Tu nombre de usuario"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      value={credentials.password}
                      onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="Tu contraseña"
                      required
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 px-4 py-2 text-sm font-medium text-white ${networkColor.includes('gradient') ? networkColor : networkColor.replace('text-white', '')} hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50`}
                >
                  {loading ? 'Conectando...' : 'Conectar'}
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Validation */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                  ✅ Cuenta conectada exitosamente
                </h3>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Cuenta: @{validationResult?.username || 'usuario'}
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                  🧪 Validando capacidad de respuesta
                </h3>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Verificando que podemos responder desde tu cuenta...
                </p>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleValidateResponse}
                  disabled={loading}
                  className={`flex-1 px-4 py-2 text-sm font-medium text-white ${networkColor.includes('gradient') ? networkColor : networkColor.replace('text-white', '')} hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50`}
                >
                  {loading ? 'Validando...' : 'Validar respuesta'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="space-y-4 text-center">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="text-lg font-medium text-green-900 dark:text-green-100 mb-2">
                  ¡Cuenta conectada exitosamente!
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Tu cuenta de {networkName} está lista para usar con Roastr.
                  Puedes empezar a generar roasts automáticamente.
                </p>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cerrando automáticamente...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkConnectModal;