import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AGGRESSIVENESS_OPTIONS = [
  { value: 0.9, label: "90% — Más permisivo" },
  { value: 0.95, label: "95% — Equilibrado" },
  { value: 0.98, label: "98% — Estricto" },
  { value: 1, label: "100% — Máximo" },
] as const;

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
  // loadError: blocks save (config could not be fetched)
  const [loadError, setLoadError] = useState<string | null>(null);
  // saveError: shown below the form but does NOT disable the Save button
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ shieldAggressiveness: number }>(
      `/shield/accounts/${accountId}/config`,
      { token },
    )
      .then((c) => setAggressiveness(c.shieldAggressiveness))
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Error al cargar configuración"))
      .finally(() => setLoading(false));
  }, [accountId, token]);

  const handleSave = async () => {
    if (aggressiveness === null) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch(`/shield/accounts/${accountId}/config`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ shieldAggressiveness: aggressiveness }),
      });
      onSaved();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configuración del Shield</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="aggressiveness" className="mb-2">
                Agresividad del Shield
              </Label>
              <select
                id="aggressiveness"
                value={aggressiveness ?? ""}
                onChange={(e) =>
                  setAggressiveness(Number(e.target.value) as 0.9 | 0.95 | 0.98 | 1)
                }
                disabled={aggressiveness === null}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
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

            {loadError && (
              <Alert variant="destructive">
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            )}

            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || aggressiveness === null || loadError !== null}
              >
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
