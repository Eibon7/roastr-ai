import { useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useShieldLogs } from "@/hooks/use-shield-logs";
import { AlertTriangle } from "lucide-react";

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YT",
  x: "X",
  instagram: "IG",
  tiktok: "TK",
  twitch: "TW",
  reddit: "RD",
};

function severityColor(score: number) {
  if (score >= 0.9) return "bg-red-500/20 text-red-700 dark:text-red-400";
  if (score >= 0.7) return "bg-orange-500/20 text-orange-700 dark:text-orange-400";
  return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
}

export function RecentThreatsWidget() {
  const { session } = useAuth();
  const { logs, loading, error } = useShieldLogs({ token: session?.access_token, limit: 50 });
  const threats = useMemo(
    () => [...logs].sort((a, b) => b.severity_score - a.severity_score).slice(0, 5),
    [logs],
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <h3 className="font-semibold text-sm text-foreground">Amenazas recientes</h3>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && threats.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin amenazas recientes</p>
      )}

      {!loading && !error && threats.length > 0 && (
        <ul className="space-y-2">
          {threats.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                  {PLATFORM_LABELS[t.platform] ?? t.platform.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {t.action_taken}
                </span>
              </div>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${severityColor(t.severity_score)}`}>
                {Math.round(t.severity_score * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
