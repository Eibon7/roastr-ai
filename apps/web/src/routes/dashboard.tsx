import { UsageWidget } from "@/components/billing/UsageWidget";

export function DashboardPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Shield overview — coming soon</p>
        <UsageWidget />
      </div>
    </div>
  );
}
