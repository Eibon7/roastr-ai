import { useState, useEffect, useCallback } from 'react';
import { fetchGDDHealth, fetchGDDStatus, fetchGDDDrift } from '@services/gddApi';
import type { GDDHealthData, GDDStatusData, GDDDriftData } from '@types/gdd.types';

export interface GDDStats {
  health: number;
  drift: number;
  nodes: number;
  coverage: number;
  loading: boolean;
  error: string | null;
  lastUpdated: string;
  refresh: () => void;
}

export interface GDDRawData {
  health: GDDHealthData | null;
  status: GDDStatusData | null;
  drift: GDDDriftData | null;
}

/**
 * Exposes GDD health, status, and drift data alongside derived metrics and a refresh control for React components.
 *
 * @param autoRefresh - If `true`, polls the GDD endpoints every 30 seconds; if `false`, disables automatic polling.
 * @returns An object containing derived metrics (`health`, `drift`, `nodes`, `coverage`), state (`loading`, `error`, `lastUpdated`), a `refresh` function to re-fetch data, and `rawData` with the fetched `health`, `status`, and `drift` payloads.
 */
export function useGDDData(autoRefresh = true): GDDStats & { rawData: GDDRawData } {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const [healthData, setHealthData] = useState<GDDHealthData | null>(null);
  const [statusData, setStatusData] = useState<GDDStatusData | null>(null);
  const [driftData, setDriftData] = useState<GDDDriftData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all 3 JSON files in parallel
      const [health, status, drift] = await Promise.all([
        fetchGDDHealth(),
        fetchGDDStatus(),
        fetchGDDDrift()
      ]);

      setHealthData(health);
      setStatusData(status);
      setDriftData(drift);
      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour12: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch GDD data');
      console.error('Failed to fetch GDD data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // Calculate derived metrics
  const stats: GDDStats = {
    health: healthData?.average_score ?? 0,
    drift: driftData?.average_drift_risk ?? 0,
    nodes: healthData?.node_count ?? statusData?.nodes_validated ?? 0,
    coverage: calculateCoverage(healthData),
    loading,
    error,
    lastUpdated,
    refresh: fetchData
  };

  return {
    ...stats,
    rawData: {
      health: healthData,
      status: statusData,
      drift: driftData
    }
  };
}

/**
 * Compute the average `coverageEvidence` across all nodes and return it as a rounded integer.
 *
 * @param healthData - The GDD health payload containing a `nodes` map; may be `null`.
 * @returns The average `coverageEvidence` per node rounded to the nearest integer, or `0` if no node data is available.
 */
function calculateCoverage(healthData: GDDHealthData | null): number {
  if (!healthData || !healthData.nodes) return 0;

  const nodes = Object.values(healthData.nodes);
  if (nodes.length === 0) return 0;

  const totalCoverage = nodes.reduce((sum, node) => {
    return sum + (node.breakdown?.coverageEvidence ?? 0);
  }, 0);

  return Math.round(totalCoverage / nodes.length);
}