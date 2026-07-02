import { useAuth } from "@/contexts/auth-context";
import { UsageWidget } from "@/components/billing/UsageWidget";
import { ConnectedAccounts } from "@/components/accounts/ConnectedAccounts";
import { ShieldStatsWidget } from "@/components/dashboard/ShieldStatsWidget";
import { RecentThreatsWidget } from "@/components/dashboard/RecentThreatsWidget";

export function DashboardPage() {
  const { session } = useAuth();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      {/* Primary Shield widgets */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <ShieldStatsWidget />
        <RecentThreatsWidget />
      </div>

      {/* Usage + Accounts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <UsageWidget />
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Cuentas conectadas</h2>
          <ConnectedAccounts token={session?.access_token ?? null} />
        </section>
      </div>
    </div>
  );
}
