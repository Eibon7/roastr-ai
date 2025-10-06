import { useQuery } from '@tanstack/react-query';
import { fetchGDDDrift } from '@services/gddApi';

/**
 * Provides a React Query hook that fetches GDD drift data.
 *
 * The hook automatically refetches every 30 seconds and treats fetched data as fresh for 20 seconds.
 *
 * @returns The React Query result object for the GDD drift request (includes `data`, `status`, `error`, and utility methods such as `refetch`).
 */
export function useGDDDrift() {
  return useQuery({
    queryKey: ['gdd-drift'],
    queryFn: fetchGDDDrift,
    refetchInterval: 30000,
    staleTime: 20000,
  });
}