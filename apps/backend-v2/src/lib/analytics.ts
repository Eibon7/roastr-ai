/**
 * Amplitude Analytics Integration - Backend v2
 *
 * This module handles Amplitude Analytics for backend services.
 * Ensures single initialization and provides type-safe event tracking.
 *
 * V2 Conventions:
 * - API key loaded from environment variables (AMPLITUDE_API_KEY)
 * - Events use snake_case naming (auth_login_success, roast_generated, etc.)
 * - Standard properties automatically injected (flow, env, source)
 * - Type-safe with TypeScript
 */

import * as amplitude from '@amplitude/analytics-node';

/**
 * Flag to ensure Amplitude is initialized only once
 */
let isInitialized = false;

/**
 * Standard properties that are automatically added to all events
 */
interface StandardProperties {
  flow?: string;
  env: string;
  source: 'backend-v2';
  app_version: string;
  request_id?: string;
}

/**
 * Event tracking parameters
 */
export interface TrackEventParams {
  userId?: string;
  deviceId?: string;
  event: string;
  properties?: Record<string, any>;
  context?: {
    flow?: string;
    request_id?: string;
    [key: string]: any;
  };
}

/**
 * Initialize Amplitude Analytics
 *
 * This function should be called once at application startup.
 * It configures Amplitude with the EU server zone for GDPR compliance.
 *
 * Configuration:
 * - API Key from env (AMPLITUDE_API_KEY)
 * - Server Zone: EU (GDPR compliance)
 *
 * @returns {boolean} - Returns true if initialization was successful
 */
export function initializeAmplitude(): boolean {
  // Prevent double initialization
  if (isInitialized) {
    console.warn('[Amplitude] Already initialized. Skipping duplicate initialization.');
    return false;
  }

  // Get API key from environment
  const apiKey = process.env.AMPLITUDE_API_KEY;

  if (!apiKey) {
    console.warn(
      '[Amplitude] Missing AMPLITUDE_API_KEY environment variable. Analytics will not be initialized.'
    );
    return false;
  }

  // Skip initialization in test environment
  if (process.env.NODE_ENV === 'test') {
    console.info('[Amplitude] Test environment detected. Analytics disabled.');
    return false;
  }

  try {
    // Initialize Amplitude with EU server zone
    amplitude.init(apiKey, {
      serverZone: 'EU' // GDPR compliant
    });

    isInitialized = true;
    console.info('[Amplitude] Backend v2 analytics initialized successfully');
    return true;
  } catch (error) {
    console.error('[Amplitude] Failed to initialize analytics:', error);
    return false;
  }
}

/**
 * Track an event with Amplitude
 *
 * Automatically enriches events with standard properties:
 * - env: Current environment (development, staging, production)
 * - source: Always "backend-v2"
 * - app_version: Application version
 * - flow: Business flow (auth, ingestion, analysis, roasting, etc.)
 * - request_id: Request trace ID (if provided)
 *
 * @param params - Event tracking parameters
 *
 * @example
 * ```typescript
 * trackEvent({
 *   userId: 'user_123',
 *   event: 'roast_generated',
 *   properties: {
 *     tone: 'canalla',
 *     platform: 'twitter',
 *     character_count: 280,
 *   },
 *   context: {
 *     flow: 'roasting',
 *     request_id: 'req_xyz',
 *   },
 * });
 * ```
 */
export function trackEvent({
  userId,
  deviceId,
  event,
  properties = {},
  context = {}
}: TrackEventParams): void {
  // Skip if not initialized (test environment or missing API key)
  if (!isInitialized) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[Amplitude] Not initialized. Skipping event:', event);
    }
    return;
  }

  try {
    // Build standard properties
    const standardProps: StandardProperties = {
      env: process.env.NODE_ENV || 'development',
      source: 'backend-v2',
      app_version: process.env.APP_VERSION || '2.0.0'
    };

    // Add flow if provided
    if (context.flow) {
      standardProps.flow = context.flow;
    }

    // Add request_id if provided
    if (context.request_id) {
      standardProps.request_id = context.request_id;
    }

    // Merge all properties
    const enrichedProperties = {
      ...properties,
      ...standardProps,
      ...context
    };

    // Track event with Amplitude
    amplitude.track(event, enrichedProperties, {
      user_id: userId,
      device_id: deviceId
    });
  } catch (error) {
    console.error('[Amplitude] Failed to track event:', event, error);
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
 * Flush all pending events
 *
 * Useful before application shutdown to ensure all events are sent.
 *
 * @returns {Promise<void>}
 */
export async function flushEvents(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  try {
    await amplitude.flush();
    console.info('[Amplitude] Events flushed successfully');
  } catch (error) {
    console.error('[Amplitude] Failed to flush events:', error);
  }
}
