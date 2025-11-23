/**
 * Toast API Service - ROUND 4 Enhancement
 * Provides centralized toast notification management with full options passthrough
 */

import React from 'react';

class ToastAPI {
  constructor() {
    this.subscribers = new Set();
    this.nextId = 1;
    this.toasts = new Map();
    this.defaultOptions = {
      duration: 5000,
      position: 'top-right',
      type: 'info',
      dismissible: true,
      showProgress: true,
      autoHide: true,
      // ROUND 4 FIX: Additional options support
      pauseOnHover: true,
      closeOnClick: true,
      icon: null,
      actions: [],
      className: '',
      style: {},
      animation: 'slide',
      maxWidth: 400,
      // Accessibility options
      role: 'alert',
      ariaLive: 'polite',
      ariaAtomic: true
    };
  }

  /**
   * Subscribe to toast updates
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers
   */
  notify() {
    this.subscribers.forEach((callback) => {
      try {
        callback(Array.from(this.toasts.values()));
      } catch (error) {
        console.error('Toast subscriber error:', error);
      }
    });
  }

  /**
   * ROUND 4 FIX: Enhanced toast creation with full options passthrough
   */
  show(content, options = {}) {
    const id = this.nextId++;

    // ROUND 4 FIX: Merge all options, allowing full customization
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
      // Always override these critical options
      id,
      content: this.sanitizeContent(content),
      timestamp: Date.now(),
      visible: true
    };

    // ROUND 4 FIX: Validate and sanitize options
    const validatedOptions = this.validateOptions(mergedOptions);

    const toast = {
      ...validatedOptions,
      onDismiss: () => this.dismiss(id),
      onAction: (actionIndex) => this.handleAction(id, actionIndex)
    };

    this.toasts.set(id, toast);
    this.notify();

    // ROUND 4 FIX: Enhanced auto-hide with pause on hover support
    if (toast.autoHide && toast.duration > 0) {
      this.scheduleAutoHide(id, toast.duration);
    }

    return id;
  }

  /**
   * ROUND 4 FIX: Content sanitization and validation
   */
  sanitizeContent(content) {
    // Handle different content types
    if (typeof content === 'string') {
      return content.trim();
    }

    if (React.isValidElement(content)) {
      return content;
    }

    if (typeof content === 'object' && content !== null) {
      // Handle object content (e.g., for rich notifications)
      if (content.title || content.message) {
        return {
          title: content.title ? String(content.title).trim() : '',
          message: content.message ? String(content.message).trim() : '',
          ...content
        };
      }
    }

    // Fallback to string conversion
    return String(content).trim();
  }

  /**
   * ROUND 4 FIX: Comprehensive options validation
   */
  validateOptions(options) {
    const validated = { ...options };

    // Validate duration
    if (typeof validated.duration !== 'number' || validated.duration < 0) {
      validated.duration = this.defaultOptions.duration;
    }

    // Validate position
    const validPositions = [
      'top-left',
      'top-center',
      'top-right',
      'bottom-left',
      'bottom-center',
      'bottom-right'
    ];
    if (!validPositions.includes(validated.position)) {
      validated.position = this.defaultOptions.position;
    }

    // Validate type
    const validTypes = ['info', 'success', 'warning', 'error'];
    if (!validTypes.includes(validated.type)) {
      validated.type = this.defaultOptions.type;
    }

    // Validate boolean options
    ['dismissible', 'showProgress', 'autoHide', 'pauseOnHover', 'closeOnClick'].forEach((key) => {
      if (typeof validated[key] !== 'boolean') {
        validated[key] = this.defaultOptions[key];
      }
    });

    // Validate maxWidth
    if (typeof validated.maxWidth !== 'number' || validated.maxWidth < 100) {
      validated.maxWidth = this.defaultOptions.maxWidth;
    }

    // Validate actions array
    if (!Array.isArray(validated.actions)) {
      validated.actions = [];
    }

    // Validate and sanitize actions
    validated.actions = validated.actions
      .map((action) => {
        if (typeof action !== 'object' || !action.label) {
          return null;
        }
        return {
          label: String(action.label).trim(),
          onClick: typeof action.onClick === 'function' ? action.onClick : () => {},
          style: action.style || {},
          className: action.className || '',
          disabled: Boolean(action.disabled)
        };
      })
      .filter(Boolean);

    // Validate style object
    if (typeof validated.style !== 'object' || validated.style === null) {
      validated.style = {};
    }

    // Validate className
    if (typeof validated.className !== 'string') {
      validated.className = '';
    }

    return validated;
  }

  /**
   * ROUND 4 FIX: Enhanced auto-hide scheduling with pause support
   */
  scheduleAutoHide(id, duration) {
    const toast = this.toasts.get(id);
    if (!toast) return;

    // Clear existing timeout
    if (toast.autoHideTimeout) {
      clearTimeout(toast.autoHideTimeout);
    }

    const timeout = setTimeout(() => {
      this.dismiss(id);
    }, duration);

    // Store timeout reference for potential cancellation
    toast.autoHideTimeout = timeout;
    this.toasts.set(id, toast);
  }

  /**
   * ROUND 4 FIX: Pause auto-hide (for hover functionality)
   */
  pauseAutoHide(id) {
    const toast = this.toasts.get(id);
    if (!toast || !toast.autoHideTimeout) return;

    clearTimeout(toast.autoHideTimeout);
    toast.autoHideTimeout = null;
    toast.isPaused = true;
    this.toasts.set(id, toast);
  }

  /**
   * ROUND 4 FIX: Resume auto-hide (after hover ends)
   */
  resumeAutoHide(id, remainingDuration = null) {
    const toast = this.toasts.get(id);
    if (!toast || !toast.isPaused) return;

    toast.isPaused = false;
    const duration = remainingDuration || toast.duration;
    this.scheduleAutoHide(id, duration);
  }

  /**
   * Handle action button clicks
   */
  handleAction(toastId, actionIndex) {
    const toast = this.toasts.get(toastId);
    if (!toast || !toast.actions[actionIndex]) return;

    try {
      toast.actions[actionIndex].onClick(toastId);
    } catch (error) {
      console.error('Toast action error:', error);
    }

    // Dismiss toast after action unless specified otherwise
    if (!toast.actions[actionIndex].keepOpen) {
      this.dismiss(toastId);
    }
  }

  /**
   * Dismiss a specific toast
   */
  dismiss(id) {
    const toast = this.toasts.get(id);
    if (!toast) return;

    // Clear any auto-hide timeout
    if (toast.autoHideTimeout) {
      clearTimeout(toast.autoHideTimeout);
    }

    this.toasts.delete(id);
    this.notify();
  }

  /**
   * Dismiss all toasts
   */
  dismissAll() {
    // Clear all timeouts
    this.toasts.forEach((toast) => {
      if (toast.autoHideTimeout) {
        clearTimeout(toast.autoHideTimeout);
      }
    });

    this.toasts.clear();
    this.notify();
  }

  /**
   * Convenience methods for different toast types
   */
  success(content, options = {}) {
    return this.show(content, { ...options, type: 'success' });
  }

  error(content, options = {}) {
    return this.show(content, {
      ...options,
      type: 'error',
      duration: options.duration || 8000, // Longer duration for errors
      autoHide: options.autoHide !== false // Allow manual override
    });
  }

  warning(content, options = {}) {
    return this.show(content, { ...options, type: 'warning' });
  }

  info(content, options = {}) {
    return this.show(content, { ...options, type: 'info' });
  }

  /**
   * ROUND 4 FIX: Advanced toast with custom styling and actions
   */
  custom(content, options = {}) {
    return this.show(content, {
      ...options,
      type: 'custom',
      autoHide: false, // Custom toasts usually require manual dismissal
      duration: 0
    });
  }

  /**
   * Get current toasts (for debugging)
   */
  getToasts() {
    return Array.from(this.toasts.values());
  }

  /**
   * Get toast count
   */
  getCount() {
    return this.toasts.size;
  }

  /**
   * Update toast content or options
   */
  update(id, updates = {}) {
    const toast = this.toasts.get(id);
    if (!toast) return false;

    // Validate and merge updates
    const validatedUpdates = this.validateOptions({ ...toast, ...updates });

    this.toasts.set(id, validatedUpdates);
    this.notify();

    return true;
  }

  /**
   * ROUND 4 FIX: Cleanup method for proper memory management
   */
  cleanup() {
    // Clear all timeouts
    this.toasts.forEach((toast) => {
      if (toast.autoHideTimeout) {
        clearTimeout(toast.autoHideTimeout);
      }
    });

    // Clear all data
    this.toasts.clear();
    this.subscribers.clear();
    this.notify();
  }
}

// Export singleton instance
export default new ToastAPI();
