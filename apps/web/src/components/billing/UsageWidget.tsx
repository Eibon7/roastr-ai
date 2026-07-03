import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

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
    let disposed = false;
    const controller = new AbortController();
    setUsage(null);
    setError(null);
    setLoading(true);

    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    apiFetch<Usage>("/billing/usage", { token: session.access_token, signal: controller.signal })
      .then((next) => { if (!disposed) setUsage(next); })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        if (!disposed) setError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => { if (!disposed) setLoading(false); });

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [session?.access_token]);

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !usage) {
    return (
      <Card>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error ?? "Sin datos de uso"}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const analysisRemaining = Math.max(0, usage.analysis_limit - usage.analysis_used);
  const analysisPct = usage.analysis_limit > 0
    ? Math.round((usage.analysis_used / usage.analysis_limit) * 100)
    : 0;
  const isPaymentRetry = usage.billing_state === "payment_retry";

  return (
    <Card>
      <CardContent>
        {isPaymentRetry && (
          <Alert className="mb-4 border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <AlertDescription>
              Actualiza tu método de pago para evitar la interrupción del servicio.
            </AlertDescription>
          </Alert>
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
            <Progress value={Math.min(100, analysisPct)} className="mt-1" />
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
      </CardContent>
    </Card>
  );
}
