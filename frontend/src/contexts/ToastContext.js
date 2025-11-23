/**
 * ToastContext - Enhanced toast notification system with security features
 * Provides toast functionality throughout the app with XSS prevention and memory leak protection
 * Enhanced for CodeRabbit Round 5 - Auto-Approval Flow Issue #405
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

export { ToastContext };

// XSS Prevention: Sanitize content by converting to text
const sanitizeContent = (content) => {
  if (typeof content !== 'string') return String(content || '');
  return content.replace(/[<>'"&]/g, (char) => {
    const entities = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' };
    return entities[char] || char;
  });
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map()); // Memory leak prevention

  const addToast = useCallback((options) => {
    // Enhanced options handling with full passthrough
    if (typeof options === 'string') {
      options = { content: options };
    }

    const id = Date.now() + Math.random();
    const newToast = {
      id,
      type: 'info',
      duration: 4000,
      position: 'top-right', // top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
      dismissible: true,
      icon: null,
      action: null,
      className: '',
      ...options,
      // Ensure content is sanitized for security
      content: sanitizeContent(options.content || options.message || ''),
      message: sanitizeContent(options.content || options.message || '') // Backward compatibility
    };

    setToasts((prev) => [...prev, newToast]);

    // Enhanced timer management with cleanup
    if (newToast.duration > 0) {
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timersRef.current.delete(id);
      }, newToast.duration);

      timersRef.current.set(id, timer);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    // Clear any pending timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Enhanced toast API with full options passthrough
  const toast = {
    show: (options) => {
      if (typeof options === 'string') {
        return addToast({ content: options });
      }
      return addToast(options);
    },
    success: (content, options = {}) =>
      addToast({
        ...options,
        content: sanitizeContent(content),
        type: 'success'
      }),
    error: (content, options = {}) =>
      addToast({
        ...options,
        content: sanitizeContent(content),
        type: 'error',
        duration: options.duration || 6000
      }),
    warning: (content, options = {}) =>
      addToast({
        ...options,
        content: sanitizeContent(content),
        type: 'warning'
      }),
    info: (content, options = {}) =>
      addToast({
        ...options,
        content: sanitizeContent(content),
        type: 'info'
      }),
    action: (content, actionLabel, actionCallback, options = {}) =>
      addToast({
        ...options,
        content: sanitizeContent(content),
        type: options.type || 'info',
        action: {
          label: sanitizeContent(actionLabel),
          callback: actionCallback
        },
        duration: options.duration || 8000 // Longer duration for action toasts
      })
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
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

// Enhanced Toast Component with full options support
const Toast = ({ toast, onRemove }) => {
  const {
    id,
    type,
    content,
    message, // Backward compatibility
    icon,
    action,
    className,
    dismissible = true
  } = toast;

  const displayContent = content || message; // Use content first, fallback to message

  const baseClasses =
    'px-4 py-3 rounded-lg shadow-lg flex items-center justify-between max-w-sm animate-fade-in';
  const typeClasses = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-yellow-600 text-white',
    info: 'bg-blue-600 text-white'
  };

  const defaultIcons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  };

  const displayIcon = icon || defaultIcons[type];

  const handleActionClick = (e) => {
    e.stopPropagation();
    if (action && typeof action.callback === 'function') {
      try {
        action.callback();
      } catch (error) {
        console.error('Toast action callback error:', error);
      }
    }
  };

  return (
    <div
      className={`${baseClasses} ${typeClasses[type]} ${className || ''}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center space-x-2 flex-1">
        {displayIcon && (
          <span className="font-bold" aria-hidden="true">
            {displayIcon}
          </span>
        )}
        <span className="text-sm flex-1">{displayContent}</span>
        {action && (
          <button
            onClick={handleActionClick}
            className="ml-2 px-2 py-1 text-xs bg-white bg-opacity-20 rounded hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
            aria-label={`Acción: ${action.label}`}
          >
            {action.label}
          </button>
        )}
      </div>
      {dismissible && (
        <button
          onClick={() => onRemove(id)}
          className="ml-3 text-lg opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 rounded"
          aria-label="Cerrar notificación"
        >
          ×
        </button>
      )}
    </div>
  );
};
