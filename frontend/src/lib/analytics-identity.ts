/**
 * Amplitude Analytics - Identity Sync Module (ROA-356)
 *
 * Provides identity synchronization functions for Amplitude Analytics.
 * These functions handle user identification, property setting, and session cleanup.
 *
 * Features:
 * - setUserId: Set user ID in Amplitude after login
 * - setUserProperties: Set user properties (plan, role, etc.)
 * - reset: Clear user identity on logout
 * - No-op in test environment
 *
 * V2 Conventions:
 * - All properties use snake_case naming
 * - No PII (email, tokens) in properties
 * - Values from backend/session (no hardcoded values)
 * - GDPR compliant
 */

import * as amplitude from '@amplitude/analytics-browser';

let isInitialized = false;

/**
 * Initialize Amplitude Analytics
 *
 * This function initializes Amplitude with EU server zone for GDPR compliance.
 * Should be called once at application startup.
 *
 * @returns {boolean} - Returns true if initialization was successful
 */
export function initializeAmplitude(): boolean {
  // Don't initialize in test environment
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    return false;
  }

  // Prevent double initialization
  if (isInitialized) {
    console.warn('[Amplitude] Already initialized');
    return false;
  }

  const apiKey = import.meta.env.VITE_AMPLITUDE_API_KEY;

  if (!apiKey) {
    console.warn('[Amplitude] Missing API key. Analytics disabled.');
    return false;
  }

  try {
    amplitude.init(apiKey, undefined, {
      defaultTracking: {
        sessions: true,
        pageViews: true,
        formInteractions: true,
        fileDownloads: true
      },
      serverZone: 'EU' // GDPR compliance
    });

    isInitialized = true;
    console.info('[Amplitude] Initialized successfully');
    return true;
  } catch (error) {
    console.error('[Amplitude] Initialization failed:', error);
    return false;
  }
}

/**
 * Set user ID in Amplitude
 * Called once per session after successful login
 *
 * @param userId - User ID from authentication (undefined to clear)
 */
export function setUserId(userId: string | undefined): void {
  // No-op in test environment
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    return;
  }

  // Auto-initialize if needed
  if (!isInitialized) {
    initializeAmplitude();
  }

  try {
    amplitude.setUserId(userId);
  } catch (error) {
    console.error('[Amplitude] Failed to set user ID:', error);
  }
}

/**
 * User properties interface for Amplitude
 * All properties use snake_case as per V2 convention
 */
export interface UserProperties {
  plan?: string;
  role?: string;
  has_roastr_persona?: boolean;
  is_admin?: boolean;
  is_trial?: boolean;
  auth_provider?: string;
  locale?: string;
}

/**
 * Set user properties in Amplitude
 * Called after setUserId with user metadata
 *
 * Rules:
 * - No PII (email, tokens)
 * - snake_case naming
 * - Values from backend/session only
 *
 * @param properties - User properties object
 */
export function setUserProperties(properties: UserProperties): void {
  // No-op in test environment
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    return;
  }

  // Auto-initialize if needed
  if (!isInitialized) {
    initializeAmplitude();
  }

  try {
    const identify = new amplitude.Identify();
    Object.entries(properties).forEach(([key, value]) => {
      if (value !== undefined) {
        identify.set(key, value);
      }
    });
    amplitude.identify(identify);
  } catch (error) {
    console.error('[Amplitude] Failed to set user properties:', error);
  }
}

/**
 * Reset user identity in Amplitude
 * Called on logout to clear user session
 *
 * This ensures:
 * - No session contamination
 * - GDPR compliance
 * - Clean state for next user
 */
export function reset(): void {
  // No-op in test environment
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    return;
  }

  try {
    amplitude.setUserId(undefined);
    amplitude.reset();
  } catch (error) {
    console.error('[Amplitude] Failed to reset:', error);
  }
}

/**
 * Check if Amplitude is initialized
 * @internal
 */
export function isAmplitudeInitialized(): boolean {
  return isInitialized;
}

// Auto-initialize on module load (if not in test)
if (import.meta.env.MODE !== 'test' && !import.meta.env.VITEST) {
  initializeAmplitude();
}

