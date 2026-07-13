import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export const ONBOARDING_STATES = [
  "welcome",
  "select_plan",
  "payment",
  "persona_setup",
  "connect_accounts",
  "done",
] as const;

export type OnboardingState = (typeof ONBOARDING_STATES)[number];

export function isOnboardingState(value: unknown): value is OnboardingState {
  return (ONBOARDING_STATES as readonly string[]).includes(value as string);
}

export type UseOnboardingStateReturn = {
  state: OnboardingState | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useOnboardingState(token: string | null | undefined): UseOnboardingStateReturn {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!token) {
      setState(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    apiFetch<{ state: OnboardingState }>("/auth/onboarding", { token })
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setState(data.state);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Error cargando el estado del onboarding");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [token, tick]);

  return { state, loading, error, refetch };
}

export async function persistOnboardingState(
  token: string,
  state: OnboardingState,
): Promise<void> {
  await apiFetch<{ state: OnboardingState }>("/auth/onboarding", {
    token,
    method: "POST",
    body: JSON.stringify({ state }),
  });
}
