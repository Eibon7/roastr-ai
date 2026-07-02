import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export type BillingPlan = {
  id: string;
  name: string;
  price_monthly: number;
  features: string[];
  limits: {
    accounts_per_platform: number;
    shield_actions_per_month: number;
    roast_generations_per_month: number;
  };
};

export type BillingSubscription = {
  id: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "unpaid";
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan: BillingPlan;
};

export type BillingUsage = {
  shield_actions_used: number;
  shield_actions_limit: number;
  roast_generations_used: number;
  roast_generations_limit: number;
  accounts_connected: number;
  accounts_limit: number;
};

export type BillingData = {
  subscription: BillingSubscription | null;
  usage: BillingUsage | null;
};

export type UseBillingReturn = BillingData & {
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useBilling(token: string | null | undefined): UseBillingReturn {
  const [data, setData] = useState<BillingData>({ subscription: null, usage: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!token) {
      setData({ subscription: null, usage: null });
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch<BillingSubscription | null>("/billing/subscription", { token }).catch(() => null),
      apiFetch<BillingUsage | null>("/billing/usage", { token }).catch(() => null),
    ])
      .then(([subscription, usage]) => {
        if (ctrl.signal.aborted) return;
        setData({ subscription, usage });
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Error cargando billing");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [token, tick]);

  return { ...data, loading, error, refetch };
}
