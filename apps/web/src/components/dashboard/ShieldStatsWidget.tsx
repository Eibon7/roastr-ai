import { useAuth } from "@/contexts/auth-context";
import { useShieldLogs } from "@/hooks/use-shield-logs";
import { EyeOff, Flag, Ban, Shield, TrendingUp } from "lucide-react";
import type { ShieldLog } from "@/hooks/use-shield-logs";

type ActionCount = { label: string; count: number; icon: React.ComponentType<{ className?: string }>; color: string };

export function ShieldStatsWidget() {
  const { session } = useAuth();
  const { logs, loading, error } = useShieldLogs({ token: session?.access_token, limit: 200 });

  const now = Date.now();
  const todayCutoff = now - 86_400_000;
  const weekCutoff = now - 7 * 86_400_000;

  const today = logs.filter((l) => new Date(l.created_at).getTime() > todayCutoff);
  const week = logs.filter((l) => new Date(l.created_at).getTime() > weekCutoff);

  function countAction(arr: ShieldLog[], action: string) {
    return arr.filter((l) => l.action_taken === action).length;
  }

  const actions: ActionCount[] = [
    { label: "Ocultados", count: countAction(week, "hide"), icon: EyeOff, color: "text-yellow-600 dark:text-yellow-400" },
    { label: "Bloqueados", count: countAction(week, "block"), icon: Ban, color: "text-red-600 dark:text-red-400" },
    { label: "Reportados", count: countAction(week, "report"), icon: Flag, color: "text-orange-600 dark:text-orange-400" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Shield Activity</h3>
        </div>
        <span className="text-xs text-muted-foreground">{week.length} esta semana</span>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {actions.map(({ label, count, icon: Icon, color }) => (
              <div key={label} className="text-center">
                <div className="flex justify-center mb-1">
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className="text-xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t border-border pt-2 mt-1">
            <TrendingUp className="h-3 w-3" />
            <span>{today.length} acciones hoy</span>
          </div>
        </>
      )}
    </div>
  );
}
