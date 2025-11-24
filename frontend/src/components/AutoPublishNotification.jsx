/**
 * Auto-Publish Notification Component - ROUND 4 Enhancement
 * Displays notification about auto-publishing status with proper cleanup
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';

const AutoPublishNotification = ({
  isAutoPublishEnabled,
  onToggle,
  currentStatus,
  lastPublished,
  className = '',
  style = {}
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [dismissedAt, setDismissedAt] = useState(null);

  // ROUND 4 FIX: Memoized configuration to ensure deterministic props
  const notificationConfig = useMemo(
    () => ({
      variants: {
        info: {
          icon: 'ℹ️',
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-200'
        },
        success: {
          icon: '✅',
          bgColor: 'bg-green-50',
          textColor: 'text-green-800',
          borderColor: 'border-green-200'
        },
        warning: {
          icon: '⚠️',
          bgColor: 'bg-yellow-50',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-200'
        },
        error: {
          icon: '❌',
          bgColor: 'bg-red-50',
          textColor: 'text-red-800',
          borderColor: 'border-red-200'
        }
      },
      autoHideDuration: 5000,
      reappearDelay: 30000
    }),
    []
  ); // Empty dependency array ensures this is created only once

  // ROUND 4 FIX: Determine notification variant based on status
  const notificationVariant = useMemo(() => {
    if (!isAutoPublishEnabled) return 'info';

    switch (currentStatus) {
      case 'publishing':
        return 'info';
      case 'published':
        return 'success';
      case 'failed':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'info';
    }
  }, [isAutoPublishEnabled, currentStatus]);

  // ROUND 4 FIX: Show notification with proper visibility logic
  useEffect(() => {
    // Don't show if recently dismissed
    if (dismissedAt && Date.now() - dismissedAt < notificationConfig.reappearDelay) {
      return;
    }

    // Show notification when auto-publish is enabled or status changes
    if (isAutoPublishEnabled || currentStatus) {
      setIsVisible(true);

      // ROUND 4 FIX: Auto-hide timer with cleanup
      const autoHideTimer = setTimeout(() => {
        setIsVisible(false);
      }, notificationConfig.autoHideDuration);

      return () => {
        clearTimeout(autoHideTimer);
      };
    }
  }, [
    isAutoPublishEnabled,
    currentStatus,
    dismissedAt,
    notificationConfig.autoHideDuration,
    notificationConfig.reappearDelay
  ]);

  // ROUND 4 FIX: Timer for countdown display with proper cleanup
  useEffect(() => {
    if (currentStatus === 'pending' && isVisible) {
      const updateTimer = () => {
        // Mock countdown - in real implementation, this would be based on actual publish time
        const now = Date.now();
        const publishTime = lastPublished ? new Date(lastPublished).getTime() + 60000 : now + 30000;
        const remaining = Math.max(0, publishTime - now);

        setTimeRemaining(remaining);

        if (remaining > 0) {
          const timeoutId = setTimeout(updateTimer, 1000);
          return () => clearTimeout(timeoutId);
        }
      };

      updateTimer();
    } else {
      setTimeRemaining(null);
    }
  }, [currentStatus, isVisible, lastPublished]);

  // ROUND 4 FIX: Handle dismiss with proper state management
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setDismissedAt(Date.now());
  }, []);

  // ROUND 4 FIX: Handle toggle with callback
  const handleToggle = useCallback(() => {
    if (onToggle) {
      onToggle(!isAutoPublishEnabled);
    }
  }, [isAutoPublishEnabled, onToggle]);

  // ROUND 4 FIX: Format time remaining
  const formatTimeRemaining = useCallback((ms) => {
    if (!ms) return '';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }, []);

  // ROUND 4 FIX: Memoized message based on status
  const message = useMemo(() => {
    if (!isAutoPublishEnabled) {
      return 'Auto-publish is disabled. Roasts require manual approval.';
    }

    switch (currentStatus) {
      case 'publishing':
        return 'Publishing roast automatically...';
      case 'published':
        return 'Roast published successfully!';
      case 'failed':
        return 'Auto-publish failed. Please try manual publishing.';
      case 'pending':
        return `Auto-publish scheduled${timeRemaining ? ` in ${formatTimeRemaining(timeRemaining)}` : ''}`;
      default:
        return 'Auto-publish is enabled. Approved roasts will be published automatically.';
    }
  }, [isAutoPublishEnabled, currentStatus, timeRemaining, formatTimeRemaining]);

  if (!isVisible) {
    return null;
  }

  const variant = notificationConfig.variants[notificationVariant];

  return (
    <div
      className={`
        ${variant.bgColor} 
        ${variant.textColor} 
        ${variant.borderColor} 
        border rounded-lg p-4 mb-4 transition-all duration-300 ease-in-out
        ${className}
      `}
      style={style}
      role="alert"
      aria-live="polite"
      data-testid="auto-publish-notification"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <span className="text-lg mr-2" role="img" aria-label={`${notificationVariant} icon`}>
            {variant.icon}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">{message}</p>
            {lastPublished && (
              <p className="text-xs mt-1 opacity-75">
                Last published: {new Date(lastPublished).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center ml-4">
          {/* Toggle button */}
          <button
            onClick={handleToggle}
            className={`
              text-xs px-3 py-1 rounded-full border transition-colors duration-200
              ${
                isAutoPublishEnabled
                  ? 'bg-white border-current hover:bg-opacity-90'
                  : 'bg-current text-white hover:bg-opacity-90'
              }
            `}
            aria-label={`${isAutoPublishEnabled ? 'Disable' : 'Enable'} auto-publish`}
            data-testid="toggle-auto-publish"
          >
            {isAutoPublishEnabled ? 'Disable' : 'Enable'}
          </button>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="ml-2 text-lg hover:bg-white hover:bg-opacity-20 rounded-full w-6 h-6 flex items-center justify-center transition-colors duration-200"
            aria-label="Dismiss notification"
            data-testid="dismiss-notification"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoPublishNotification;
