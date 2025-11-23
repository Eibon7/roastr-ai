/**
 * Guardian Agent - React Query Hooks
 * Phase 17: Governance Interface & Alerts
 */

import { useQuery, useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';
import {
  GuardianCase,
  GuardianCaseListParams,
  GuardianCaseListResponse
} from '../types/guardian.types';
import { fetchGuardianCases, approveCase, denyCase } from '../api/guardianApi';

// ============================================================
// Query Keys
// ============================================================

/**
 * Query key factory for Guardian cases
 */
export const guardianKeys = {
  all: ['guardian'] as const,
  cases: () => [...guardianKeys.all, 'cases'] as const,
  caseList: (params?: GuardianCaseListParams) => [...guardianKeys.cases(), params] as const,
  case: (caseId: string) => [...guardianKeys.cases(), caseId] as const
};

// ============================================================
// Query Hooks
// ============================================================

/**
 * Options for useGuardianCases hook
 */
export interface UseGuardianCasesOptions {
  /**
   * Auto-refetch interval in milliseconds
   * @default 60000 (60 seconds)
   * @example
   * // Critical alerts dashboard - faster refresh
   * { refetchInterval: 10000 } // 10 seconds
   *
   * // Archived cases - slower refresh
   * { refetchInterval: 300000 } // 5 minutes
   *
   * // Disable auto-refresh
   * { refetchInterval: false }
   */
  refetchInterval?: number | false;
}

/**
 * Fetch Guardian cases with filtering
 *
 * @example
 * ```tsx
 * // Default: 60-second auto-refresh
 * const { data, isLoading, error, refetch } = useGuardianCases({
 *   severity: 'CRITICAL',
 *   status: 'PENDING'
 * });
 *
 * // Custom refresh interval
 * const { data } = useGuardianCases(
 *   { severity: 'CRITICAL' },
 *   { refetchInterval: 10000 } // 10 seconds for critical alerts
 * );
 *
 * // Disable auto-refresh
 * const { data } = useGuardianCases(
 *   { status: 'APPROVED' },
 *   { refetchInterval: false } // No auto-refresh for archived
 * );
 * ```
 */
export function useGuardianCases(
  params?: GuardianCaseListParams,
  options?: UseGuardianCasesOptions
) {
  return useQuery<GuardianCaseListResponse, Error>({
    queryKey: guardianKeys.caseList(params),
    queryFn: () => fetchGuardianCases(params),
    staleTime: 30000, // 30 seconds - data considered fresh
    gcTime: 300000, // 5 minutes - cache time (formerly cacheTime in v4)
    refetchInterval: options?.refetchInterval ?? 60000, // Configurable, defaults to 60s
    refetchOnWindowFocus: true, // Refetch when window gains focus
    retry: 2, // Retry failed requests twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000) // Exponential backoff
  });
}

// ============================================================
// Mutation Hooks
// ============================================================

/**
 * Approve a Guardian case
 *
 * @example
 * ```tsx
 * const approveMutation = useApproveCase();
 *
 * const handleApprove = async (caseId: string) => {
 *   try {
 *     await approveMutation.mutateAsync({
 *       caseId,
 *       approver: 'Emilio Postigo'
 *     });
 *     console.log('Case approved!');
 *   } catch (error) {
 *     console.error('Failed to approve:', error);
 *   }
 * };
 * ```
 */
export function useApproveCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ caseId, approver }: { caseId: string; approver: string }) =>
      approveCase(caseId, approver),

    // Optimistic update
    onMutate: async ({ caseId, approver }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: guardianKeys.cases() });

      // Snapshot previous values
      const previousCases = queryClient.getQueriesData<GuardianCaseListResponse>({
        queryKey: guardianKeys.cases()
      });

      // Optimistically update all matching queries
      queryClient.setQueriesData<GuardianCaseListResponse>(
        { queryKey: guardianKeys.cases() },
        (old) => {
          if (!old) return old;

          return {
            ...old,
            cases: old.cases.map((c) =>
              c.case_id === caseId
                ? {
                    ...c,
                    approved_by: approver,
                    approved_at: new Date().toISOString(),
                    action: 'APPROVED' as const
                  }
                : c
            )
          };
        }
      );

      return { previousCases };
    },

    // On error, rollback
    onError: (error, variables, context) => {
      console.error('Failed to approve case:', error);

      if (context?.previousCases) {
        context.previousCases.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    // Always refetch after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: guardianKeys.cases() });
    },

    // On success callback
    onSuccess: (response, { caseId }) => {
      console.log(`Case ${caseId} approved by ${response.approved_by}`);
    }
  });
}

/**
 * Deny a Guardian case
 *
 * @example
 * ```tsx
 * const denyMutation = useDenyCase();
 *
 * const handleDeny = async (caseId: string) => {
 *   try {
 *     await denyMutation.mutateAsync({
 *       caseId,
 *       denier: 'Emilio Postigo',
 *       reason: 'Changes violate pricing policy'
 *     });
 *     console.log('Case denied!');
 *   } catch (error) {
 *     console.error('Failed to deny:', error);
 *   }
 * };
 * ```
 */
export function useDenyCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ caseId, denier, reason }: { caseId: string; denier: string; reason: string }) =>
      denyCase(caseId, denier, reason),

    // Optimistic update
    onMutate: async ({ caseId, denier, reason }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: guardianKeys.cases() });

      // Snapshot previous values
      const previousCases = queryClient.getQueriesData<GuardianCaseListResponse>({
        queryKey: guardianKeys.cases()
      });

      // Optimistically update all matching queries
      queryClient.setQueriesData<GuardianCaseListResponse>(
        { queryKey: guardianKeys.cases() },
        (old) => {
          if (!old) return old;

          return {
            ...old,
            cases: old.cases.map((c) =>
              c.case_id === caseId
                ? {
                    ...c,
                    denied_by: denier,
                    denied_at: new Date().toISOString(),
                    denial_reason: reason,
                    action: 'DENIED' as const
                  }
                : c
            )
          };
        }
      );

      return { previousCases };
    },

    // On error, rollback
    onError: (error, variables, context) => {
      console.error('Failed to deny case:', error);

      if (context?.previousCases) {
        context.previousCases.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    // Always refetch after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: guardianKeys.cases() });
    },

    // On success callback
    onSuccess: (response, { caseId }) => {
      console.log(`Case ${caseId} denied by ${response.denied_by}: ${response.denial_reason}`);
    }
  });
}

// ============================================================
// Utility Hooks
// ============================================================

/**
 * Prefetch Guardian cases (useful for hover effects, route preloading)
 *
 * @example
 * ```tsx
 * const prefetch = usePrefetchGuardianCases();
 *
 * <button onMouseEnter={() => prefetch({ severity: 'CRITICAL' })}>
 *   View Critical Cases
 * </button>
 * ```
 */
export function usePrefetchGuardianCases() {
  const queryClient = useQueryClient();

  return (params?: GuardianCaseListParams) => {
    queryClient.prefetchQuery({
      queryKey: guardianKeys.caseList(params),
      queryFn: () => fetchGuardianCases(params),
      staleTime: 30000
    });
  };
}

/**
 * Invalidate all Guardian queries (force refetch)
 *
 * @example
 * ```tsx
 * const invalidate = useInvalidateGuardianCases();
 *
 * <button onClick={invalidate}>
 *   Refresh Cases
 * </button>
 * ```
 */
export function useInvalidateGuardianCases() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: guardianKeys.cases() });
  };
}
