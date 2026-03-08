import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

type Usage = {
  plan: string;
  billing_state: string;
  analysis_limit: number;
  analysis_used: number;
  roasts_limit: number;
  roasts_used: number;
  current_period_end: string | null;
  trial_end: string | null;
};

export function UsageWidget() {
  const { session } = useAuth();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    apiFetch<Usage>("/billing/usage", { token: session.access_token })
      .then(setUsage)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  if (loading) {
    return (
      <div className="rounded-lg border border-input bg-card p-4">
        <p className="text-sm text-muted-foreground">Cargando uso...</p>
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className="rounded-lg border border-input bg-card p-4">
        <p className="text-sm text-destructive">{error ?? "Sin datos de uso"}</p>
      </div>
    );
  }

  const analysisRemaining = Math.max(0, usage.analysis_limit - usage.analysis_used);
  const analysisPct = usage.analysis_limit > 0
    ? Math.round((usage.analysis_used / usage.analysis_limit) * 100)
    : 0;
  const isPaymentRetry = usage.billing_state === "payment_retry";

  return (
    <div className="rounded-lg border border-input bg-card p-4">
      {isPaymentRetry && (
        <div className="mb-4 rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          Actualiza tu método de pago para evitar la interrupción del servicio.
        </div>
      )}
      <h3 className="font-semibold text-foreground">Uso del ciclo actual</h3>
      <p className="mt-1 text-sm text-muted-foreground capitalize">
        Plan {usage.plan} · {usage.billing_state}
      </p>
      <div className="mt-4 space-y-2">
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Análisis</span>
            <span>
              {usage.analysis_used.toLocaleString()} / {usage.analysis_limit.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, analysisPct)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {analysisRemaining.toLocaleString()} restantes
          </p>
        </div>
      </div>
      {usage.trial_end && (
        <p className="mt-3 text-xs text-muted-foreground">
          Trial hasta: {new Date(usage.trial_end).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
