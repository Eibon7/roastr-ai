import { useQuery } from '@tanstack/react-query';
import { fetchGDDStatus } from '@services/gddApi';

/**
 * Provides a React Query hook that fetches and keeps the GDD service status up to date.
 *
 * The query polls the service every 30 seconds and treats fetched data as fresh for 20 seconds.
 *
 * @returns The query result object containing the fetched GDD status data and React Query state (e.g., `data`, `status`, `error`, `isFetching`).
 */
export function useGDDStatus() {
  return useQuery({
    queryKey: ['gdd-status'],
    queryFn: fetchGDDStatus,
    refetchInterval: 30000,
    staleTime: 20000,
  });
}