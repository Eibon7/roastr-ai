import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { Wand2, Clock, RefreshCcw, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

const STATUS_BADGE: Record<RoastCandidate["status"], { label: string; className: string }> = {
  pending_review: { label: "Pendiente", className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
  approved: { label: "Aprobado", className: "bg-green-500/20 text-green-700 dark:text-green-400" },
  discarded: { label: "Descartado", className: "bg-red-500/20 text-red-600" },
  published: { label: "Publicado", className: "bg-blue-500/20 text-blue-700 dark:text-blue-400" },
};

function relativeTime(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

export function RoastReviewList() {
  const { session } = useAuth();
  const [candidates, setCandidates] = useState<RoastCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [discardError, setDiscardError] = useState<string | null>(null);

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

  async function handleDiscard(id: string) {
    if (!session?.access_token) return;
    setDiscardingId(id);
    setDiscardError(null);
    try {
      await apiFetch(`/roast/candidates/${id}/discard`, {
        token: session.access_token,
        method: "PATCH",
      });
      await fetchCandidates();
    } catch (e) {
      setDiscardError(e instanceof Error ? e.message : "Error descartando el roast");
    } finally {
      setDiscardingId(null);
    }
  }

  function DiscardButton({ candidate }: { candidate: RoastCandidate }) {
    if (candidate.status !== "pending_review") return null;
    const isDiscarding = discardingId === candidate.id;
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleDiscard(candidate.id)}
        disabled={isDiscarding}
        aria-label="Descartar roast"
      >
        {isDiscarding ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        Descartar
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-5 w-5 text-primary" />
            Roasts pendientes de revisión
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={fetchCandidates}
              disabled={loading}
              title="Refrescar"
              aria-label="Refrescar"
            >
              <RefreshCcw className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && (
          <div className="space-y-2" data-testid="roast-review-loading">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {discardError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{discardError}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && candidates.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <Wand2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No hay roasts pendientes de revisión.</p>
          </div>
        )}

        {!loading && !error && candidates.length > 0 && (
          <>
            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-lg border border-border sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plataforma</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tono</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Creado</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground"></th>
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
                          <Badge className={badge.className}>
                            {badge.label}
                            {c.has_validation_errors && <span className="ml-1 text-yellow-600">⚠</span>}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {relativeTime(c.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DiscardButton candidate={c} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: accordion */}
            <Accordion type="single" collapsible className="sm:hidden">
              {candidates.map((c) => {
                const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.pending_review;
                return (
                  <AccordionItem key={c.id} value={c.id}>
                    <AccordionTrigger>
                      <div className="flex flex-1 items-center justify-between gap-2 pr-2">
                        <span className="text-foreground">
                          {PLATFORM_LABELS[c.platform] ?? c.platform} · {TONE_LABELS[c.tone] ?? c.tone}
                        </span>
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <p className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {relativeTime(c.created_at)}
                        {c.has_validation_errors && <span className="ml-1 text-yellow-600">⚠ Avisos de validación</span>}
                      </p>
                      <DiscardButton candidate={c} />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </>
        )}
      </CardContent>
    </Card>
  );
}
