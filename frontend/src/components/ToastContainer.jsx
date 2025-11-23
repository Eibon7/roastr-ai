/**
 * Toast Container Component - ROUND 4 Enhancement
 * Renders and manages toast notifications with full options support
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ToastAPI from './ToastAPI';

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  // ROUND 4 FIX: Subscribe to ToastAPI updates with cleanup
  useEffect(() => {
    const unsubscribe = ToastAPI.subscribe(setToasts);

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  // ROUND 4 FIX: Group toasts by position for proper rendering
  const groupedToasts = useMemo(() => {
    const groups = {};
    toasts.forEach((toast) => {
      const position = toast.position || 'top-right';
      if (!groups[position]) {
        groups[position] = [];
      }
      groups[position].push(toast);
    });
    return groups;
  }, [toasts]);

  // ROUND 4 FIX: Memoized position styles
  const getPositionStyles = useCallback((position) => {
    const base = {
      position: 'fixed',
      zIndex: 9999,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxHeight: '100vh',
      overflow: 'hidden'
    };

    switch (position) {
      case 'top-left':
        return { ...base, top: '16px', left: '16px' };
      case 'top-center':
        return { ...base, top: '16px', left: '50%', transform: 'translateX(-50%)' };
      case 'top-right':
        return { ...base, top: '16px', right: '16px' };
      case 'bottom-left':
        return { ...base, bottom: '16px', left: '16px', flexDirection: 'column-reverse' };
      case 'bottom-center':
        return {
          ...base,
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          flexDirection: 'column-reverse'
        };
      case 'bottom-right':
        return { ...base, bottom: '16px', right: '16px', flexDirection: 'column-reverse' };
      default:
        return { ...base, top: '16px', right: '16px' };
    }
  }, []);

  // Render function for individual toast
  const renderToast = useCallback((toast) => {
    return (
      <Toast
        key={toast.id}
        toast={toast}
        onDismiss={() => ToastAPI.dismiss(toast.id)}
        onPause={() => ToastAPI.pauseAutoHide(toast.id)}
        onResume={() => ToastAPI.resumeAutoHide(toast.id)}
      />
    );
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <>
      {Object.entries(groupedToasts).map(([position, positionToasts]) => (
        <div
          key={position}
          style={getPositionStyles(position)}
          data-testid={`toast-container-${position}`}
        >
          {positionToasts.map(renderToast)}
        </div>
      ))}
    </>
  );
};

/**
 * Individual Toast Component
 */
const Toast = React.memo(({ toast, onDismiss, onPause, onResume }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  // ROUND 4 FIX: Animation effect
  useEffect(() => {
    // Trigger enter animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // ROUND 4 FIX: Progress bar for auto-hide toasts
  useEffect(() => {
    if (!toast.showProgress || !toast.autoHide || toast.duration <= 0) {
      return;
    }

    const startTime = Date.now();
    const updateProgress = () => {
      if (toast.isPaused) return;

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(remaining);

      if (remaining > 0) {
        requestAnimationFrame(updateProgress);
      }
    };

    updateProgress();
  }, [toast.showProgress, toast.autoHide, toast.duration, toast.isPaused]);

  // ROUND 4 FIX: Handle mouse events for pause on hover
  const handleMouseEnter = useCallback(() => {
    if (toast.pauseOnHover && toast.autoHide) {
      onPause();
    }
  }, [toast.pauseOnHover, toast.autoHide, onPause]);

  const handleMouseLeave = useCallback(() => {
    if (toast.pauseOnHover && toast.autoHide && toast.isPaused) {
      onResume();
    }
  }, [toast.pauseOnHover, toast.autoHide, toast.isPaused, onResume]);

  // ROUND 4 FIX: Handle click to close
  const handleClick = useCallback(() => {
    if (toast.closeOnClick) {
      onDismiss();
    }
  }, [toast.closeOnClick, onDismiss]);

  // ROUND 4 FIX: Memoized styles based on toast options
  const toastStyles = useMemo(() => {
    const baseStyles = {
      pointerEvents: 'auto',
      maxWidth: `${toast.maxWidth}px`,
      minWidth: '300px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      padding: '16px',
      border: '1px solid #e1e5e9',
      transition: 'all 0.3s ease-in-out',
      transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(-20px) scale(0.95)',
      opacity: isVisible ? 1 : 0,
      cursor: toast.closeOnClick ? 'pointer' : 'default',
      ...toast.style
    };

    // ROUND 4 FIX: Type-specific styling
    switch (toast.type) {
      case 'success':
        baseStyles.borderLeftColor = '#10b981';
        baseStyles.borderLeftWidth = '4px';
        break;
      case 'error':
        baseStyles.borderLeftColor = '#ef4444';
        baseStyles.borderLeftWidth = '4px';
        break;
      case 'warning':
        baseStyles.borderLeftColor = '#f59e0b';
        baseStyles.borderLeftWidth = '4px';
        break;
      case 'info':
        baseStyles.borderLeftColor = '#3b82f6';
        baseStyles.borderLeftWidth = '4px';
        break;
      default:
        break;
    }

    return baseStyles;
  }, [toast, isVisible]);

  // ROUND 4 FIX: Render content based on type
  const renderContent = () => {
    if (React.isValidElement(toast.content)) {
      return toast.content;
    }

    if (typeof toast.content === 'object' && toast.content !== null) {
      return (
        <div>
          {toast.content.title && (
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{toast.content.title}</div>
          )}
          {toast.content.message && <div>{toast.content.message}</div>}
        </div>
      );
    }

    return <div>{String(toast.content)}</div>;
  };

  // ROUND 4 FIX: Render actions
  const renderActions = () => {
    if (!toast.actions || toast.actions.length === 0) {
      return null;
    }

    return (
      <div
        style={{
          marginTop: '12px',
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end'
        }}
      >
        {toast.actions.map((action, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
            disabled={action.disabled}
            className={action.className}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              backgroundColor: '#f9fafb',
              cursor: action.disabled ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              ...action.style
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div
      style={toastStyles}
      className={toast.className}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={toast.role}
      aria-live={toast.ariaLive}
      aria-atomic={toast.ariaAtomic}
      data-testid={`toast-${toast.id}`}
    >
      {/* Icon */}
      {toast.icon && <div style={{ marginBottom: '8px', fontSize: '20px' }}>{toast.icon}</div>}

      {/* Content */}
      <div style={{ flex: 1 }}>{renderContent()}</div>

      {/* Dismiss button */}
      {toast.dismissible && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#6b7280',
            padding: '4px',
            borderRadius: '4px'
          }}
          aria-label="Close notification"
        >
          ×
        </button>
      )}

      {/* Actions */}
      {renderActions()}

      {/* Progress bar */}
      {toast.showProgress && toast.autoHide && toast.duration > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '3px',
            backgroundColor: '#e5e7eb',
            width: '100%',
            borderRadius: '0 0 8px 8px'
          }}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: '#3b82f6',
              width: `${progress}%`,
              transition: 'width 0.1s linear',
              borderRadius: '0 0 8px 8px'
            }}
          />
        </div>
      )}
    </div>
  );
});

Toast.displayName = 'Toast';

export default ToastContainer;
