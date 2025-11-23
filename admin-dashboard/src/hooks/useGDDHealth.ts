import { useQuery } from '@tanstack/react-query';
import { fetchGDDHealth } from '@services/gddApi';

/**
 * Provides a React Query hook for fetching and caching GDD health data.
 *
 * @returns The React Query result object for the 'gdd-health' query, containing `data`, `status`, `error`, and control methods such as `refetch`.
 */
export function useGDDHealth() {
  return useQuery({
    queryKey: ['gdd-health'],
    queryFn: fetchGDDHealth,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 20000 // Consider data fresh for 20 seconds
  });
}
