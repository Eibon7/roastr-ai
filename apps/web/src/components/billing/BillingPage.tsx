import { UsageWidget } from "./UsageWidget";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PLANS = [
  { id: "starter", price: 5, analysis: 1000, accounts: 1, trial: 30 },
  { id: "pro", price: 15, analysis: 10000, accounts: 2, trial: 7 },
  { id: "plus", price: 50, analysis: 100000, accounts: 2, trial: null },
] as const;

export function BillingPage() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="text-muted-foreground">
          Gestiona tu suscripción y límites de uso.
        </p>
      </div>

      <UsageWidget />

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
    </div>
  );
}
