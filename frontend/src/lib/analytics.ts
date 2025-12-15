/**
 * Amplitude Analytics Integration (V2-ready)
 *
 * This module handles the initialization and configuration of Amplitude Analytics.
 * It ensures Amplitude is initialized only once during the application lifecycle.
 *
 * V2 Conventions:
 * - API key loaded from environment variables (VITE_AMPLITUDE_API_KEY)
 * - Events use snake_case naming (auth_login_success, cta_click, etc.)
 * - Autocapture enabled everywhere (including auth screens for friction diagnostics)
 * - Session replay enabled (autocapture does NOT capture input VALUES, only events)
 *
 * Security Note:
 * - Autocapture tracks user interactions (clicks, form submissions) but NOT input values
 * - This is GDPR compliant and safe for auth screens
 * - Sensitive data (passwords, emails) are NOT captured
 */

import * as amplitude from '@amplitude/unified';

/**
 * Flag to ensure Amplitude is initialized only once
 */
let isInitialized = false;

/**
 * Initialize Amplitude Analytics
 *
 * This function should be called once at the root of the client application.
 * It configures Amplitude with the EU server zone and enables autocapture.
 *
 * Configuration:
 * - API Key from env (VITE_AMPLITUDE_API_KEY)
 * - Server Zone: EU (GDPR compliance)
 * - Autocapture: Enabled everywhere (including auth screens)
 * - Session Replay: Enabled (safe because autocapture doesn't capture input values)
 *
 * @returns {boolean} - Returns true if initialization was successful, false if already initialized or missing API key
 */
export function initializeAmplitude(): boolean {
  // Prevent double initialization
  if (isInitialized) {
    console.warn('[Amplitude] Already initialized. Skipping duplicate initialization.');
    return false;
  }

  // Skip initialization in test environment (mirrors backend pattern)
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    console.info('[Amplitude] Test environment detected. Analytics disabled.');
    return false;
  }

  // Get API key from environment
  const apiKey = import.meta.env.VITE_AMPLITUDE_API_KEY;

  if (!apiKey) {
    console.warn(
      '[Amplitude] Missing VITE_AMPLITUDE_API_KEY environment variable. Analytics will not be initialized.'
    );
    return false;
  }

  try {
    // Initialize Amplitude with analytics + session replay
    // Autocapture is safe: tracks events (clicks, submissions) but NOT input values
    amplitude.initAll(apiKey, {
      serverZone: 'EU', // EU server zone for GDPR compliance
      analytics: {
        autocapture: true, // Automatically capture user interactions (NOT input values)
      },
    });

    isInitialized = true;
    console.info('[Amplitude] Analytics initialized successfully');
    return true;
  } catch (error) {
    console.error('[Amplitude] Failed to initialize analytics:', error);
    return false;
  }
}

/**
 * Check if Amplitude has been initialized
 *
 * @returns {boolean} - Returns true if Amplitude is initialized
 */
export function isAmplitudeInitialized(): boolean {
  return isInitialized;
}

/**
 * Track an event with automatic enrichment of standard properties
 *
 * This helper provides consistency with backend tracking and ensures
 * all events include standard properties for filtering and analysis.
 *
 * Standard properties:
 * - flow: Business flow (auth, billing, content, etc.)
 * - source: Always 'frontend'
 * - env: Current environment (development, production)
 * - app_version: App version from package.json or env
 *
 * @param event - Event name in snake_case (e.g., 'auth_login_success')
 * @param properties - Custom event properties
 * @param context - Context information (flow, userId)
 *
 * @example
 * trackEvent('auth_login_success', {
 *   method: 'email_password',
 *   redirect_to: '/dashboard',
 * }, {
 *   flow: 'auth',
 *   userId: 'user-123',
 * });
 */
export function trackEvent(
  event: string,
  properties: Record<string, any> = {},
  context: { flow?: string; userId?: string } = {}
): void {
  if (!isInitialized) {
    console.warn(`[Amplitude] Not initialized. Skipping event: ${event}`);
    return;
  }

  const enrichedProperties = {
    ...properties,
    flow: context.flow || 'unknown', // Default flow if not provided
    source: 'frontend',
    env: import.meta.env.MODE || 'development',
    app_version: import.meta.env.VITE_APP_VERSION || '2.0.0',
  };

  try {
    if (context.userId) {
      // Set user ID if provided
      amplitude.setUserId(context.userId);
    }
    amplitude.track(event, enrichedProperties);
  } catch (error) {
    console.error(`[Amplitude] Failed to track event "${event}":`, error);
  }
}

/**
 * Export the amplitude instance for advanced use cases
 *
 * This allows direct access to Amplitude's SDK methods if needed,
 * but prefer using the trackEvent helper for consistency.
 */
export { amplitude };

