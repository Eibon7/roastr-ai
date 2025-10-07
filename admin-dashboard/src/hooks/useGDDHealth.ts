import { useQuery } from '@tanstack/react-query';
import { fetchGDDHealth } from '@services/gddApi';

export function useGDDHealth() {
  return useQuery({
    queryKey: ['gdd-health'],
    queryFn: fetchGDDHealth,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 20000, // Consider data fresh for 20 seconds
  });
}
