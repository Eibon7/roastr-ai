import { useAuth } from "@/contexts/auth-context";
import { UsageWidget } from "@/components/billing/UsageWidget";
import { ShieldFeed } from "@/components/shield/ShieldFeed";
import { ConnectedAccounts } from "@/components/accounts/ConnectedAccounts";

export function DashboardPage() {
  const { session } = useAuth();
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <UsageWidget />
        <section>
          <h2 className="mb-3 text-lg font-semibold">Cuentas conectadas</h2>
          <ConnectedAccounts token={session?.access_token ?? null} />
        </section>
        <ShieldFeed />
      </div>
    </div>
  );
}
