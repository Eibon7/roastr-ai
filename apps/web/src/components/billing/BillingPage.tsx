import { useState } from "react";
import { UsageWidget } from "./UsageWidget";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PLAN_LIMITS, type Plan } from "@roastr/shared";

const PLANS = (Object.keys(PLAN_LIMITS) as Plan[]).map((id) => ({
  id,
  price: PLAN_LIMITS[id].priceEur,
  analysis: PLAN_LIMITS[id].analysisLimit,
  accounts: PLAN_LIMITS[id].accountsPerPlatform,
  trial: PLAN_LIMITS[id].trialDays,
}));

export function BillingPage() {
  const { session } = useAuth();
  // Bumping this remounts UsageWidget so it refetches after a cancellation.
  const [usageKey, setUsageKey] = useState(0);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = async () => {
    if (!session?.access_token) return;
    setCanceling(true);
    setCancelError(null);
    try {
      await apiFetch("/billing/cancel", { token: session.access_token, method: "POST" });
      setCancelDialogOpen(false);
      setUsageKey((k) => k + 1);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Error al cancelar la suscripción");
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing</h1>
        <p className="text-muted-foreground">
          Gestiona tu suscripción y límites de uso.
        </p>
      </div>

      <UsageWidget key={usageKey} />

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.id}>
            <CardContent>
              <h3 className="font-semibold capitalize text-foreground">
                {plan.id}
              </h3>
              <p className="text-2xl font-bold text-primary">€{plan.price}/mes</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>{plan.analysis.toLocaleString()} análisis/mes</li>
                <li>{plan.accounts} cuenta(s) por plataforma</li>
                <li>
                  {plan.trial ? `Trial ${plan.trial} días` : "Sin trial"}
                </li>
              </ul>
              <Button asChild className="mt-4 w-full">
                <a href="/onboarding">Cambiar plan</a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-input p-4">
        <div>
          <h3 className="font-medium text-foreground">Cancelar suscripción</h3>
          <p className="text-sm text-muted-foreground">
            Dejarás de tener acceso a las funciones de pago al final del periodo de facturación actual.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setCancelDialogOpen(true)}
          disabled={!session?.access_token}
        >
          Cancelar suscripción
        </Button>
      </div>

      <Dialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCancelDialogOpen(false);
            setCancelError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar suscripción</DialogTitle>
            <DialogDescription>
              Se cancelará tu suscripción al final del periodo de facturación actual. Podrás
              seguir usando el servicio hasta entonces.
            </DialogDescription>
          </DialogHeader>

          {cancelError && (
            <Alert variant="destructive">
              <AlertDescription>{cancelError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={canceling}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancel}
              disabled={canceling}
            >
              {canceling ? "Cancelando..." : "Confirmar cancelación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
