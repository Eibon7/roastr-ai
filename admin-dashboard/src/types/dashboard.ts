/**
 * Shared TypeScript types for GDD Admin Dashboard
 *
 * @module dashboard
 * @description Common interfaces used across dashboard components
 */

/**
 * Health statistics for the GDD system
 */
export interface HealthStats {
  /** Overall system health score (0-100) */
  health: number;
  /** Drift risk percentage (0-100) */
  drift: number;
  /** Total number of validated nodes */
  nodes: number;
  /** Code coverage percentage (0-100) */
  coverage: number;
}

/**
 * Activity event logged by the system
 */
export interface ActivityEvent {
  /** ISO 8601 timestamp or relative time string */
  timestamp: string;
  /** Description of the event */
  event: string;
}
