import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export type Account = {
  id: string;
  platform: string;
  username: string;
  status: string;
  integration_health: string;
  shield_aggressiveness?: number;
};

export type UseAccountsReturn = {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useAccounts(token: string | null | undefined): UseAccountsReturn {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!token) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    apiFetch<Account[]>("/accounts", { token })
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setAccounts(data);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Error cargando cuentas");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [token, tick]);

  return { accounts, loading, error, refetch };
}
