/**
 * GDD API Client
 * Fetches GDD system data from JSON files
 */

import type { GDDHealthData, GDDStatusData, GDDDriftData } from '@types/gdd.types';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Retrieve GDD health scores from the configured API base URL or the local `/gdd-health.json`.
 *
 * @returns The parsed GDD health data.
 * @throws Error if the HTTP request fails or the response is not OK.
 */
export async function fetchGDDHealth(): Promise<GDDHealthData> {
  const url = API_BASE ? `${API_BASE}/gdd-health.json` : '/gdd-health.json';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch health data: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Retrieve GDD status data from the configured API base or the local `/gdd-status.json`.
 *
 * @returns The parsed GDDStatusData object containing status information.
 * @throws Error when the HTTP request fails or the response has a non-OK status.
 */
export async function fetchGDDStatus(): Promise<GDDStatusData> {
  const url = API_BASE ? `${API_BASE}/gdd-status.json` : '/gdd-status.json';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch status data: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Retrieve GDD drift predictions from the configured API endpoint.
 *
 * @returns The parsed drift predictions as `GDDDriftData`.
 * @throws Error if the HTTP response has a non-ok status.
 */
export async function fetchGDDDrift(): Promise<GDDDriftData> {
  const url = API_BASE ? `${API_BASE}/gdd-drift.json` : '/gdd-drift.json';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch drift data: ${response.statusText}`);
  }
  return response.json();
}