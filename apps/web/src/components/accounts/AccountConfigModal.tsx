import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { X } from "lucide-react";

const AGGRESSIVENESS_OPTIONS = [
  { value: 0.9, label: "90% — Más permisivo" },
  { value: 0.95, label: "95% — Equilibrado" },
  { value: 0.98, label: "98% — Estricto" },
  { value: 1, label: "100% — Máximo" },
] as const;

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Props = {
  accountId: string;
  token: string;
  onClose: () => void;
  onSaved: () => void;
};

export function AccountConfigModal({
  accountId,
  token,
  onClose,
  onSaved,
}: Props) {
  const [aggressiveness, setAggressiveness] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    apiFetch<{ shieldAggressiveness: number }>(
      `/shield/accounts/${accountId}/config`,
      { token },
    )
      .then((c) => setAggressiveness(c.shieldAggressiveness))
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar configuración"))
      .finally(() => setLoading(false));
  }, [accountId, token]);

  // Trap focus inside dialog and restore on unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    if (dialog) {
      const firstFocusable = dialog.querySelector<HTMLElement>(FOCUSABLE);
      firstFocusable?.focus();
    }
    return () => {
      (previousFocusRef.current as HTMLElement | null)?.focus();
    };
  }, []);

  // Keyboard: Escape closes, Tab cycles focus within dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    if (aggressiveness === null) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/shield/accounts/${accountId}/config`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ shieldAggressiveness: aggressiveness }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="config-modal-title"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-lg border border-input bg-card p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="config-modal-title" className="text-lg font-semibold">
            Configuración del Shield
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="aggressiveness"
                className="mb-2 block text-sm font-medium"
              >
                Agresividad del Shield
              </label>
              <select
                id="aggressiveness"
                value={aggressiveness ?? ""}
                onChange={(e) =>
                  setAggressiveness(Number(e.target.value) as 0.9 | 0.95 | 0.98 | 1)
                }
                disabled={aggressiveness === null}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                {AGGRESSIVENESS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Mayor agresividad = actúa antes ante comentarios tóxicos.
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || aggressiveness === null || error !== null}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
