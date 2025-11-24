import React, { useState, useEffect, useRef } from 'react';

const SuspensionModal = ({
  isOpen,
  onClose,
  onConfirm,
  user,
  action, // 'suspend' or 'unsuspend'
  isLoading = false
}) => {
  const [reason, setReason] = useState('');
  const [showReasonField, setShowReasonField] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const reasonInputRef = useRef(null);
  const submitButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen && action === 'suspend') {
      setShowReasonField(true);
      setReason('');
      setIsAnimating(true);
      // Focus on reason field after animation
      setTimeout(() => {
        if (reasonInputRef.current) {
          reasonInputRef.current.focus();
        }
      }, 150);
    } else {
      setShowReasonField(false);
      setReason('');
      setIsAnimating(true);
      // Focus on submit button for unsuspend
      setTimeout(() => {
        if (submitButtonRef.current && action === 'unsuspend') {
          submitButtonRef.current.focus();
        }
      }, 150);
    }
  }, [isOpen, action]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen || isLoading) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Enter':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSubmit(e);
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isLoading, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(reason.trim());
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const isSuspend = action === 'suspend';
  const actionText = isSuspend ? 'Suspender' : 'Reactivar';
  const actionColor = isSuspend ? 'red' : 'green';

  return (
    <div
      className={`fixed inset-0 bg-black transition-all duration-300 flex items-center justify-center z-50 p-4 ${
        isOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'
      }`}
      onClick={handleBackdropClick}
      style={{ backdropFilter: isOpen ? 'blur(4px)' : 'none' }}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full transform transition-all duration-300 ${
          isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isSuspend ? 'bg-red-100 dark:bg-red-900/20' : 'bg-green-100 dark:bg-green-900/20'
              }`}
            >
              <span className="text-2xl">{isSuspend ? '🚫' : '✅'}</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {actionText} Usuario
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {isSuspend
                ? `¿Estás seguro de que quieres suspender la cuenta de ${user?.name || user?.email}? El usuario no podrá acceder al sistema hasta que se reactive su cuenta.`
                : `¿Estás seguro de que quieres reactivar la cuenta de ${user?.name || user?.email}? El usuario recuperará el acceso completo al sistema.`}
            </p>

            {showReasonField && (
              <div className="space-y-2">
                <label
                  htmlFor="suspension-reason"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Razón de la suspensión (opcional)
                </label>
                <textarea
                  ref={reasonInputRef}
                  id="suspension-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none transition-all duration-200 focus:scale-105"
                  rows={3}
                  placeholder="Ej: Violación de términos de servicio, comportamiento inapropiado..."
                  maxLength={500}
                  disabled={isLoading}
                  aria-describedby="reason-help"
                />
                <div className="flex justify-between items-center">
                  <p id="reason-help" className="text-xs text-gray-500 dark:text-gray-400">
                    Presiona Ctrl+Enter para enviar rápidamente
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {reason.length}/500 caracteres
                  </p>
                </div>
              </div>
            )}

            {user?.suspended && action === 'unsuspend' && user?.suspended_reason && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Razón de suspensión actual:</strong> {user.suspended_reason}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 focus:ring-2 focus:ring-gray-500 focus:outline-none"
              aria-label="Cancelar acción (Presiona Escape)"
            >
              Cancelar
            </button>
            <button
              ref={submitButtonRef}
              type="submit"
              disabled={isLoading}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 hover:scale-105 focus:outline-none ${
                actionColor === 'red'
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500'
                  : 'bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-500'
              }`}
              aria-label={`${actionText} usuario (Presiona Ctrl+Enter)`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Procesando...</span>
                </>
              ) : (
                <span>{actionText}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SuspensionModal;
