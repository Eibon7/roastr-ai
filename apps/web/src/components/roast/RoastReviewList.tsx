import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { Wand2, Clock, RefreshCcw } from "lucide-react";

type RoastCandidate = {
  id: string;
  platform: string;
  tone: string;
  status: "pending_review" | "approved" | "discarded" | "published";
  has_validation_errors: boolean;
  created_at: string;
  account_id: string;
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  x: "X (Twitter)",
  instagram: "Instagram",
  tiktok: "TikTok",
  twitch: "Twitch",
};

const TONE_LABELS: Record<string, string> = {
  flanders: "Flanders",
  balanceado: "Balanceado",
  canalla: "Canalla",
  personal: "Personal",
};

const STATUS_BADGE = {
  pending_review: { label: "Pendiente", className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
  approved: { label: "Aprobado", className: "bg-green-500/20 text-green-700 dark:text-green-400" },
  discarded: { label: "Descartado", className: "bg-red-500/20 text-red-600" },
  published: { label: "Publicado", className: "bg-blue-500/20 text-blue-700 dark:text-blue-400" },
} as const;

type Props = {
  onGenerateNew?: () => void;
};

export function RoastReviewList({ onGenerateNew }: Props) {
  const { session } = useAuth();
  const [candidates, setCandidates] = useState<RoastCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCandidates = useCallback(async () => {
    if (!session?.access_token) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ candidates: RoastCandidate[] }>("/roast/candidates", {
        token: session.access_token,
      });
      setCandidates(data.candidates);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando candidatos");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  function relativeTime(isoDate: string) {
    const diff = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60) return `hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    return `hace ${Math.floor(hours / 24)}d`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Roasts pendientes de revisión</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCandidates}
            disabled={loading}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted"
            title="Refrescar"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {onGenerateNew && (
            <button
              onClick={onGenerateNew}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Wand2 className="h-3 w-3" />
              Generar nuevo
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!loading && candidates.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <Wand2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No hay roasts pendientes de revisión.</p>
          {onGenerateNew && (
            <button
              onClick={onGenerateNew}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Generar uno nuevo →
            </button>
          )}
        </div>
      )}

      {candidates.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plataforma</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tono</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Creado</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.pending_review;
                return (
                  <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-foreground">
                      {PLATFORM_LABELS[c.platform] ?? c.platform}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {TONE_LABELS[c.tone] ?? c.tone}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                        {c.has_validation_errors && (
                          <span className="ml-1 text-yellow-600">⚠</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {relativeTime(c.created_at)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
