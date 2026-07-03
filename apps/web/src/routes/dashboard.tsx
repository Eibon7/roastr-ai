import { useAuth } from "@/contexts/auth-context";
import { UsageWidget } from "@/components/billing/UsageWidget";
import { ConnectedAccounts } from "@/components/accounts/ConnectedAccounts";
import { ShieldStatsWidget } from "@/components/dashboard/ShieldStatsWidget";
import { RecentThreatsWidget } from "@/components/dashboard/RecentThreatsWidget";
import { RoastReviewList } from "@/components/roast/RoastReviewList";

export function DashboardPage() {
  const { session } = useAuth();
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>

      {/* Primary Shield widgets */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <ShieldStatsWidget />
        <RecentThreatsWidget />
      </div>

      {/* Roasts awaiting review */}
      <RoastReviewList />

      <UsageWidget />

      <ConnectedAccounts token={session?.access_token ?? null} />
    </div>
  );
}
