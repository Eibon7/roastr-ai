import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ShieldCheck,
  EyeOff,
  Flag,
  Ban,
  AlertTriangle,
  MessageSquare,
  Filter,
  ChevronDown,
} from "lucide-react";

type ShieldLog = {
  id: string;
  platform: string;
  action_taken: string;
  severity_score: number;
  platform_fallback: boolean;
  created_at: string;
};

type LogsResponse = { logs: ShieldLog[]; total: number };

const PAGE_SIZE = 25;

const ACTION_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  hide: { label: "Oculto", icon: EyeOff, color: "text-yellow-600 dark:text-yellow-400" },
  block: { label: "Bloqueado", icon: Ban, color: "text-red-600 dark:text-red-400" },
  report: { label: "Reportado", icon: Flag, color: "text-orange-600 dark:text-orange-400" },
  strike1: { label: "Strike 1", icon: MessageSquare, color: "text-blue-600 dark:text-blue-400" },
  strike1_silent: { label: "Strike silencioso", icon: AlertTriangle, color: "text-purple-600 dark:text-purple-400" },
  none: { label: "Sin acción", icon: ShieldCheck, color: "text-muted-foreground" },
};

const PLATFORMS = ["youtube", "x", "instagram", "tiktok", "twitch", "reddit"];
const ACTIONS = ["hide", "block", "report", "strike1", "none"];
const SEVERITIES = [
  { label: "Todas", value: "" },
  { label: "Alta (≥90%)", value: "high" },
  { label: "Media (70-89%)", value: "medium" },
  { label: "Baja (<70%)", value: "low" },
];

function severityBadgeClass(score: number) {
  if (score >= 0.9) return "bg-red-500/20 text-red-700 dark:text-red-400";
  if (score >= 0.7) return "bg-orange-500/20 text-orange-700 dark:text-orange-400";
  return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
}

function matchesSeverity(score: number, filter: string) {
  if (!filter) return true;
  if (filter === "high") return score >= 0.9;
  if (filter === "medium") return score >= 0.7 && score < 0.9;
  return score < 0.7;
}

export function ShieldPage() {
  const { session } = useAuth();

  const [allLogs, setAllLogs] = useState<ShieldLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const [platform, setPlatform] = useState("");
  const [action, setAction] = useState("");
  const [severity, setSeverity] = useState("");

  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(
    async (newOffset: number, replace: boolean) => {
      if (!session?.access_token) return;
      if (replace) setLoading(true); else setLoadingMore(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(newOffset) });
        if (platform) params.set("platform", platform);
        if (action) params.set("action_taken", action);
        const data = await apiFetch<LogsResponse>(`/shield/logs?${params}`, {
          token: session.access_token,
        });
        setTotal(data.total);
        setAllLogs((prev) => replace ? data.logs : [...prev, ...data.logs]);
        setOffset(newOffset + data.logs.length);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (replace) setLoading(false); else setLoadingMore(false);
      }
    },
    [session?.access_token, platform, action],
  );

  useEffect(() => {
    setOffset(0);
    setAllLogs([]);
    fetchLogs(0, true);
  }, [fetchLogs]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore && !loading && offset < total) {
          fetchLogs(offset, false);
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchLogs, loadingMore, loading, offset, total]);

  const filtered = allLogs.filter((l) => matchesSeverity(l.severity_score, severity));

  const stats = {
    total: allLogs.length,
    blocks: allLogs.filter((l) => l.action_taken === "block").length,
    hides: allLogs.filter((l) => l.action_taken === "hide").length,
    reports: allLogs.filter((l) => l.action_taken === "report").length,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Shield Activity</h1>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total acciones", value: stats.total, icon: ShieldCheck, color: "text-primary" },
          { label: "Bloqueados", value: stats.blocks, icon: Ban, color: "text-red-600 dark:text-red-400" },
          { label: "Ocultados", value: stats.hides, icon: EyeOff, color: "text-yellow-600 dark:text-yellow-400" },
          { label: "Reportados", value: stats.reports, icon: Flag, color: "text-orange-600 dark:text-orange-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
        <select
          aria-label="Filtro de plataforma"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="">Todas las plataformas</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
        <select
          aria-label="Filtro de acción"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="">Todas las acciones</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_CONFIG[a]?.label ?? a}</option>
          ))}
        </select>
        <select
          aria-label="Filtro de severidad"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
        >
          {SEVERITIES.map(({ label, value }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">
          {total > 0 ? `${total} registros` : ""}
        </span>
      </div>

      {/* Feed */}
      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <ShieldCheck className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">Sin actividad registrada</p>
          </CardContent>
        </Card>
      )}

      {!loading && filtered.length > 0 && (
        <>
          {/* Mobile: accordion (table -> accordion pattern, docs/09-frontend.md §9.1) */}
          <Accordion type="single" collapsible className="lg:hidden">
            {filtered.map((log) => {
              const cfg = ACTION_CONFIG[log.action_taken] ?? ACTION_CONFIG.none;
              const Icon = cfg.icon;
              return (
                <AccordionItem key={log.id} value={log.id} className="rounded-lg border border-border bg-card px-4 mb-2 last:mb-0">
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium uppercase text-muted-foreground">
                            {log.platform}
                          </span>
                          <span className="text-sm text-foreground">{cfg.label}</span>
                        </div>
                      </div>
                      <Badge className={severityBadgeClass(log.severity_score)} variant="outline">
                        {Math.round(log.severity_score * 100)}%
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">Plataforma</dt>
                      <dd className="text-foreground">{log.platform}</dd>
                      <dt className="text-muted-foreground">Acción</dt>
                      <dd className="text-foreground">{cfg.label}</dd>
                      <dt className="text-muted-foreground">Severidad</dt>
                      <dd className="text-foreground">{Math.round(log.severity_score * 100)}%</dd>
                      <dt className="text-muted-foreground">Fallback</dt>
                      <dd className="text-foreground">{log.platform_fallback ? "Sí" : "No"}</dd>
                      <dt className="text-muted-foreground">Fecha</dt>
                      <dd className="text-foreground">{new Date(log.created_at).toLocaleString()}</dd>
                    </dl>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {/* Desktop: full list/table */}
          <ul className="hidden space-y-2 lg:block">
            {filtered.map((log) => {
              const cfg = ACTION_CONFIG[log.action_taken] ?? ACTION_CONFIG.none;
              const Icon = cfg.icon;
              return (
                <li
                  key={log.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {log.platform}
                      </span>
                      <span className="text-sm text-foreground">{cfg.label}</span>
                      {log.platform_fallback && (
                        <Badge variant="secondary" className="px-1 text-xs">fallback</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge className={severityBadgeClass(log.severity_score)} variant="outline">
                    {Math.round(log.severity_score * 100)}%
                  </Badge>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Infinite scroll loader */}
      <div ref={loaderRef} className="flex justify-center py-4">
        {loadingMore && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ChevronDown className="h-4 w-4 animate-bounce" />
            Cargando más...
          </div>
        )}
      </div>
    </div>
  );
}
