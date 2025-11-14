/**
 * React Query hook for fetching worker metrics
 * 
 * Part of Issue #713: Worker Monitoring Dashboard
 */

import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface WorkerMetrics {
  timestamp: string;
  workers: {
    total: number;
    healthy: number;
    unhealthy: number;
    status: string;
    details: Array<{
      type: string;
      status: string;
      processed: number;
      failed: number;
      uptime: number;
    }>;
  };
  queues: {
    totalDepth: number;
    totalProcessing: number;
    totalFailed: number;
    totalDLQ: number;
    byQueue: Record<string, {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      dlq: number;
      healthStatus: string;
      avgProcessingTime: number;
    }>;
  };
  jobs: {
    totalProcessed: number;
    totalFailed: number;
    currentProcessing: number;
    successRate: string;
  };
  performance: {
    uptime: number;
    averageProcessingTime: number;
  };
}

interface QueueStatus {
  timestamp: string;
  queues: Record<string, {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    dlq: number;
    healthStatus: string;
    avgProcessingTime: number;
    lastUpdated: string;
  }>;
  summary: {
    totalPending: number;
    totalProcessing: number;
    totalDLQ: number;
  };
}

interface WorkerTypeMetrics {
  workerType: string;
  timestamp: string;
  health: {
    status: string;
    workerType: string;
  };
  stats: {
    processedJobs: number;
    failedJobs: number;
    currentJobs: number;
    uptime: number;
    successRate: string;
  };
}

/**
 * Fetch worker metrics from API
 */
async function fetchWorkerMetrics(): Promise<WorkerMetrics> {
  const token = localStorage.getItem('authToken') || '';
  
  const response = await fetch(`${API_BASE_URL}/api/workers/metrics`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch worker metrics: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Fetch queue status from API
 */
async function fetchQueueStatus(): Promise<QueueStatus> {
  const token = localStorage.getItem('authToken') || '';
  
  const response = await fetch(`${API_BASE_URL}/api/workers/queues/status`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch queue status: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Fetch metrics for a specific worker type
 */
async function fetchWorkerTypeMetrics(workerType: string): Promise<WorkerTypeMetrics> {
  const token = localStorage.getItem('authToken') || '';
  
  const response = await fetch(`${API_BASE_URL}/api/workers/${workerType}/metrics`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch worker metrics: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Hook to fetch worker metrics
 * Refetches every 10 seconds for real-time updates
 */
export function useWorkerMetrics() {
  return useQuery<WorkerMetrics>({
    queryKey: ['workerMetrics'],
    queryFn: fetchWorkerMetrics,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });
}

/**
 * Hook to fetch queue status
 * Refetches every 10 seconds for real-time updates
 */
export function useQueueStatus() {
  return useQuery<QueueStatus>({
    queryKey: ['queueStatus'],
    queryFn: fetchQueueStatus,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });
}

/**
 * Hook to fetch metrics for a specific worker type
 */
export function useWorkerTypeMetrics(workerType: string) {
  return useQuery<WorkerTypeMetrics>({
    queryKey: ['workerTypeMetrics', workerType],
    queryFn: () => fetchWorkerTypeMetrics(workerType),
    refetchInterval: 10000,
    staleTime: 5000,
    enabled: !!workerType, // Only fetch if workerType is provided
  });
}


