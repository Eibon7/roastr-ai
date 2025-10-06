import { useQuery } from '@tanstack/react-query';
import { fetchGDDStatus } from '@services/gddApi';

export function useGDDStatus() {
  return useQuery({
    queryKey: ['gdd-status'],
    queryFn: fetchGDDStatus,
    refetchInterval: 30000,
    staleTime: 20000,
  });
}
