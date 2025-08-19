/**
 * ToastContext - Simple toast notification system
 * Provides toast functionality throughout the app
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export { ToastContext };

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      type: 'info', // 'success', 'error', 'warning', 'info'
      duration: 4000, // 4 seconds default
      ...toast
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, newToast.duration);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (message, options) => addToast({ ...options, message, type: 'success' }),
    error: (message, options) => addToast({ ...options, message, type: 'error', duration: 6000 }),
    warning: (message, options) => addToast({ ...options, message, type: 'warning' }),
    info: (message, options) => addToast({ ...options, message, type: 'info' })
  };

  return (
    <ToastContext.Provider value={{ toast, toasts, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

// Toast Container Component
const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

// Individual Toast Component
const Toast = ({ toast, onRemove }) => {
  const { id, type, message } = toast;

  const baseClasses = "px-4 py-3 rounded-lg shadow-lg flex items-center justify-between max-w-sm animate-fade-in";
  const typeClasses = {
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white",
    warning: "bg-yellow-600 text-white",
    info: "bg-blue-600 text-white"
  };

  const icons = {
    success: "✓",
    error: "✗",
    warning: "⚠",
    info: "ℹ"
  };

  return (
    <div className={`${baseClasses} ${typeClasses[type]}`}>
      <div className="flex items-center space-x-2">
        <span className="font-bold">{icons[type]}</span>
        <span className="text-sm">{message}</span>
      </div>
      <button
        onClick={() => onRemove(id)}
        className="ml-3 text-lg opacity-70 hover:opacity-100 focus:outline-none"
        aria-label="Cerrar notificación"
      >
        ×
      </button>
    </div>
  );
};