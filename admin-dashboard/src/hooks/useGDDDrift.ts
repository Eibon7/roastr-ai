import { useQuery } from '@tanstack/react-query';
import { fetchGDDDrift } from '@services/gddApi';

export function useGDDDrift() {
  return useQuery({
    queryKey: ['gdd-drift'],
    queryFn: fetchGDDDrift,
    refetchInterval: 30000,
    staleTime: 20000,
  });
}
