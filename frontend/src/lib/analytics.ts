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
 * Export the amplitude instance for custom tracking
 *
 * This allows other parts of the application to use Amplitude's
 * tracking methods (e.g., amplitude.track(), amplitude.identify())
 */
export { amplitude };

