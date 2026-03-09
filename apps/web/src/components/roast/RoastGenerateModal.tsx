import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { Wand2, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";

const TONES = [
  { id: "flanders", label: "Flanders", description: "Amable e inofensivo" },
  { id: "balanceado", label: "Balanceado", description: "Profesional y directo" },
  { id: "canalla", label: "Canalla", description: "Sarcástico y sin filtros" },
] as const;

type Tone = (typeof TONES)[number]["id"];

type GenerateResult = {
  candidateId: string;
  generatedText: string;
  truncatedText: string;
  isValid: boolean;
  violations: Array<{ ruleId: string; message: string }>;
};

type Props = {
  commentId: string;
  commentText: string;
  severityScore: number;
  platform: string;
  accountId: string;
  onClose: () => void;
  onApproved: () => void;
};

export function RoastGenerateModal({
  commentId,
  commentText,
  severityScore,
  platform,
  accountId,
  onClose,
  onApproved,
}: Props) {
  const { session } = useAuth();
  const [tone, setTone] = useState<Tone>("balanceado");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function handleGenerate() {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch<GenerateResult>("/roast/generate", {
        token: session.access_token,
        method: "POST",
        body: JSON.stringify({ commentId, commentText, severityScore, platform, accountId, tone }),
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error generando roast");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!result || !session?.access_token) return;
    setActionLoading(true);
    try {
      await apiFetch(`/roast/candidates/${result.candidateId}/approve`, {
        token: session.access_token,
        method: "PATCH",
        body: JSON.stringify({ approvedText: result.truncatedText }),
      });
      onApproved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error aprobando roast");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDiscard() {
    if (!result || !session?.access_token) return;
    setActionLoading(true);
    try {
      await apiFetch(`/roast/candidates/${result.candidateId}/discard`, {
        token: session.access_token,
        method: "PATCH",
      });
      onApproved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error descartando roast");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Wand2 className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Generar Roast con IA</h2>
          <button
            onClick={onClose}
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Comment preview */}
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Comentario: </span>
            {commentText.slice(0, 120)}{commentText.length > 120 ? "…" : ""}
          </div>

          {/* Tone selector */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Tono</p>
            <div className="grid grid-cols-3 gap-2">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    tone === t.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  <p className="font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          {!result && (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {loading ? "Generando…" : "Generar roast"}
            </button>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              {result.violations.length > 0 && (
                <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
                  <p className="font-medium mb-1">Avisos de validación:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {result.violations.map((v) => (
                      <li key={v.ruleId}>{v.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-foreground whitespace-pre-wrap">
                {result.truncatedText}
              </div>

              <p className="text-xs text-muted-foreground">
                * Texto generado por IA. No almacenado. Revisa antes de publicar.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                  Aprobar y publicar
                </button>
                <button
                  onClick={handleDiscard}
                  disabled={actionLoading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Descartar
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  title="Regenerar"
                  className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  ↺
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
