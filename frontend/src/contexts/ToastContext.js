/**
 * ToastContext - Enhanced toast notification system with full options passthrough
 * CodeRabbit Review #3275183530 - Full options support with XSS prevention
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const ToastContext = createContext();

export { ToastContext };

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

/**
 * Sanitize content to prevent XSS attacks
 */
const sanitizeContent = (content) => {
  if (typeof content !== 'string') {
    return String(content || '');
  }
  
  // Basic HTML entity encoding to prevent XSS
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map()); // Track timers for cleanup

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const addToast = useCallback((options) => {
    const id = Date.now() + Math.random();
    
    // Enhanced options with full passthrough support
    const newToast = {
      id,
      type: 'info', // 'success', 'error', 'warning', 'info'
      duration: 4000, // 4 seconds default
      position: 'top-right', // Default position
      dismissible: true, // Can be dismissed
      icon: null, // Custom icon
      action: null, // Action button with callback
      content: '', // Toast content (sanitized)
      title: null, // Optional title
      // Merge all provided options
      ...options
    };

    // Sanitize content for security
    if (newToast.content) {
      newToast.content = sanitizeContent(newToast.content);
    }
    if (newToast.title) {
      newToast.title = sanitizeContent(newToast.title);
    }
    if (newToast.message) {
      newToast.content = sanitizeContent(newToast.message);
      delete newToast.message; // Normalize to content
    }

    setToasts(prev => [...prev, newToast]);

    // Auto-remove after duration with proper cleanup
    if (newToast.duration > 0) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        timersRef.current.delete(id);
      }, newToast.duration);
      
      timersRef.current.set(id, timer);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    
    // Clear associated timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  // Enhanced toast API with full options passthrough
  const toast = {
    // Standard methods with enhanced options support
    success: (content, options = {}) => addToast({ 
      ...options, 
      content, 
      type: 'success',
      icon: options.icon || '✓',
      duration: options.duration || 4000
    }),
    
    error: (content, options = {}) => addToast({ 
      ...options, 
      content, 
      type: 'error',
      icon: options.icon || '✗',
      duration: options.duration || 6000
    }),
    
    warning: (content, options = {}) => addToast({ 
      ...options, 
      content, 
      type: 'warning',
      icon: options.icon || '⚠',
      duration: options.duration || 5000
    }),
    
    info: (content, options = {}) => addToast({ 
      ...options, 
      content, 
      type: 'info',
      icon: options.icon || 'ℹ',
      duration: options.duration || 4000
    }),

    // Generic show method with full options passthrough
    show: (options) => {
      if (typeof options === 'string') {
        return addToast({ content: options });
      }
      return addToast(options);
    },

    // Action toast with callback support
    action: (content, actionLabel, actionCallback, options = {}) => addToast({
      ...options,
      content,
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

// Enhanced Toast Container Component with positioning support
const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  // Group toasts by position
  const toastsByPosition = toasts.reduce((acc, toast) => {
    const position = toast.position || 'top-right';
    if (!acc[position]) acc[position] = [];
    acc[position].push(toast);
    return acc;
  }, {});

  const positionClasses = {
    'top-right': 'fixed top-4 right-4 z-50 space-y-2',
    'top-left': 'fixed top-4 left-4 z-50 space-y-2',
    'bottom-right': 'fixed bottom-4 right-4 z-50 space-y-2',
    'bottom-left': 'fixed bottom-4 left-4 z-50 space-y-2',
    'top-center': 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50 space-y-2',
    'bottom-center': 'fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 space-y-2'
  };

  return (
    <>
      {Object.entries(toastsByPosition).map(([position, positionToasts]) => (
        <div key={position} className={positionClasses[position] || positionClasses['top-right']}>
          {positionToasts.map(toast => (
            <Toast key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </div>
      ))}
    </>
  );
};

// Enhanced Individual Toast Component with full options support
const Toast = ({ toast, onRemove }) => {
  const { 
    id, 
    type, 
    content, 
    title, 
    icon, 
    action, 
    dismissible = true,
    customStyles 
  } = toast;

  const baseClasses = "px-4 py-3 rounded-lg shadow-lg flex items-center justify-between max-w-sm animate-fade-in";
  const typeClasses = {
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white",
    warning: "bg-yellow-600 text-white",
    info: "bg-blue-600 text-white"
  };

  const defaultIcons = {
    success: "✓",
    error: "✗",
    warning: "⚠",
    info: "ℹ"
  };

  const displayIcon = icon || defaultIcons[type] || defaultIcons.info;
  const finalClasses = customStyles ? `${baseClasses} ${customStyles}` : `${baseClasses} ${typeClasses[type]}`;

  const handleActionClick = () => {
    if (action && typeof action.callback === 'function') {
      try {
        action.callback();
      } catch (error) {
        console.error('Toast action callback error:', error);
      }
    }
  };

  return (
    <div className={finalClasses} role="alert" aria-live="polite">
      <div className="flex items-start space-x-2 flex-1">
        {displayIcon && (
          <span className="font-bold text-lg flex-shrink-0" aria-hidden="true">
            {displayIcon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <div className="font-semibold text-sm mb-1" dangerouslySetInnerHTML={{ __html: title }} />
          )}
          <div className="text-sm" dangerouslySetInnerHTML={{ __html: content }} />
          {action && (
            <button
              type="button"
              onClick={handleActionClick}
              className="mt-2 text-sm underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white focus:ring-opacity-50"
              aria-label={`Action: ${action.label}`}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
      
      {dismissible && (
        <button
          type="button"
          onClick={() => onRemove(id)}
          className="ml-3 text-lg opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white focus:ring-opacity-50 flex-shrink-0"
          aria-label="Cerrar notificación"
        >
          ×
        </button>
      )}
    </div>
  );
};