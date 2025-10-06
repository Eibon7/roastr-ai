/**
 * GDD API Client
 * Fetches GDD system data from JSON files
 */

import type { GDDHealthData, GDDStatusData, GDDDriftData } from '@types/gdd.types';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Fetch GDD health scores
 */
export async function fetchGDDHealth(): Promise<GDDHealthData> {
  const response = await fetch(`${API_BASE}/gdd-health.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch health data: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch GDD validation status
 */
export async function fetchGDDStatus(): Promise<GDDStatusData> {
  const response = await fetch(`${API_BASE}/gdd-status.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch status data: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch GDD drift predictions
 */
export async function fetchGDDDrift(): Promise<GDDDriftData> {
  const response = await fetch(`${API_BASE}/gdd-drift.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch drift data: ${response.statusText}`);
  }
  return response.json();
}
