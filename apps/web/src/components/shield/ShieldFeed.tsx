import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import {
  Shield,
  EyeOff,
  Flag,
  Ban,
  AlertTriangle,
  MessageSquare,
  Filter,
} from "lucide-react";

type ShieldLog = {
  id: string;
  platform: string;
  action_taken: string;
  severity_score: number;
  platform_fallback: boolean;
  created_at: string;
};

type ShieldLogsResponse = {
  logs: ShieldLog[];
  total: number;
};

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  hide: EyeOff,
  report: Flag,
  block: Ban,
  strike1: MessageSquare,
  strike1_silent: AlertTriangle,
  none: Shield,
};

const ACTION_LABELS: Record<string, string> = {
  hide: "Ocultado",
  report: "Reportado",
  block: "Bloqueado",
  strike1: "Strike 1",
  strike1_silent: "Strike 1 (silencioso)",
  none: "Sin acción",
};

const PLATFORMS = ["youtube", "x", "instagram", "tiktok", "facebook", "twitch", "reddit"];

export function ShieldFeed() {
  const { session } = useAuth();
  const [logs, setLogs] = useState<ShieldLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");

  useEffect(() => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams();
    if (platformFilter) params.set("platform", platformFilter);
    if (actionFilter) params.set("action_taken", actionFilter);
    params.set("limit", "30");
    const qs = params.toString();
    apiFetch<ShieldLogsResponse>(`/shield/logs${qs ? `?${qs}` : ""}`, {
      token: session.access_token,
    })
      .then((res) => {
        setLogs(res.logs);
        setTotal(res.total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [session?.access_token, platformFilter, actionFilter]);

  if (loading) {
    return (
      <div className="rounded-lg border border-input bg-card p-6">
        <p className="text-sm text-muted-foreground">Cargando actividad del Shield...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-input bg-card p-6">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-input bg-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Shield className="h-5 w-5" />
          Actividad del Shield
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">Todas las plataformas</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">Todas las acciones</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay actividad reciente. El Shield registrará acciones cuando proteja tus comentarios.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {total} registro{total !== 1 ? "s" : ""} (últimos 30)
          </p>
          <ul className="space-y-2">
            {logs.map((log) => {
              const ActionIcon = ACTION_ICONS[log.action_taken] ?? Shield;
              return (
                <li
                  key={log.id}
                  className="flex items-center gap-4 rounded-md border border-input bg-muted/30 px-4 py-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <ActionIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {ACTION_LABELS[log.action_taken] ?? log.action_taken}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {log.platform} · Severidad {(log.severity_score * 100).toFixed(0)}%
                      {log.platform_fallback && " · Fallback de plataforma"}
                    </p>
                  </div>
                  <time
                    className="shrink-0 text-xs text-muted-foreground"
                    dateTime={log.created_at}
                  >
                    {new Date(log.created_at).toLocaleString()}
                  </time>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
