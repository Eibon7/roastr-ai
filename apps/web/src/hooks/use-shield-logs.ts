import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export type ShieldLog = {
  id: string;
  platform: string;
  action_taken: string;
  severity_score: number;
  created_at: string;
  content_preview?: string;
  offender_id?: string;
};

export type ShieldLogsResult = {
  logs: ShieldLog[];
  total: number;
};

export type UseShieldLogsOptions = {
  token: string | null | undefined;
  limit?: number;
  platform?: string;
  action?: string;
  minSeverity?: number;
  page?: number;
};

export type UseShieldLogsReturn = {
  logs: ShieldLog[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useShieldLogs({
  token,
  limit = 50,
  platform,
  action,
  minSeverity,
  page = 0,
}: UseShieldLogsOptions): UseShieldLogsReturn {
  const [logs, setLogs] = useState<ShieldLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!token) {
      setLogs([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
    if (platform) params.set("platform", platform);
    if (action) params.set("action", action);
    if (minSeverity !== undefined) params.set("min_severity", String(minSeverity));

    apiFetch<ShieldLogsResult>(`/shield/logs?${params.toString()}`, { token })
      .then((r) => {
        if (ctrl.signal.aborted) return;
        setLogs(r.logs);
        setTotal(r.total);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Error cargando logs");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [token, limit, platform, action, minSeverity, page, tick]);

  return { logs, total, loading, error, refetch };
}
