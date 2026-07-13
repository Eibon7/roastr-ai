import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X } from "lucide-react";

export const MAX_PERSONA_FIELD_LENGTH = 200;

export type PersonaProfile = {
  identities: string[];
  redLines: string[];
  tolerances: string[];
};

const EMPTY_PROFILE: PersonaProfile = { identities: [], redLines: [], tolerances: [] };

const FIELDS: Array<{ key: keyof PersonaProfile; label: string; helper: string; placeholder: string }> = [
  {
    key: "identities",
    label: "Lo que me define",
    helper: "Identidades personales",
    placeholder: "p. ej. madre, ingeniera, gamer",
  },
  {
    key: "redLines",
    label: "Lo que no tolero",
    helper: "Líneas rojas",
    placeholder: "p. ej. comentarios racistas",
  },
  {
    key: "tolerances",
    label: "Lo que me da igual",
    helper: "Tolerancias",
    placeholder: "p. ej. bromas sobre mi edad",
  },
];

type Props = {
  token: string;
  onSaved?: (profile: PersonaProfile) => void;
  submitLabel?: string;
};

/**
 * Roastr Persona form: 3 fields (identities/redLines/tolerances), each a list
 * of short entries (≤200 chars, enforced client-side and by the backend).
 * Reused by the onboarding wizard's persona_setup step and /settings/persona.
 */
export function PersonaForm({ token, onSaved, submitLabel = "Guardar" }: Props) {
  const [profile, setProfile] = useState<PersonaProfile>(EMPTY_PROFILE);
  const [drafts, setDrafts] = useState<Record<keyof PersonaProfile, string>>({
    identities: "",
    redLines: "",
    tolerances: "",
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<PersonaProfile>("/persona", { token })
      .then(setProfile)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Error al cargar tu Persona"))
      .finally(() => setLoading(false));
  }, [token]);

  function addEntry(field: keyof PersonaProfile) {
    const value = drafts[field].trim();
    if (!value || value.length > MAX_PERSONA_FIELD_LENGTH) return;
    setProfile((p) => ({ ...p, [field]: [...p[field], value] }));
    setDrafts((d) => ({ ...d, [field]: "" }));
  }

  function removeEntry(field: keyof PersonaProfile, index: number) {
    setProfile((p) => ({ ...p, [field]: p[field].filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await apiFetch<PersonaProfile>("/persona", {
        method: "PUT",
        token,
        body: JSON.stringify(profile),
      });
      setProfile(saved);
      onSaved?.(saved);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al guardar tu Persona");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {FIELDS.map(({ key, label, helper, placeholder }) => {
        const draft = drafts[key];
        const overLimit = draft.length > MAX_PERSONA_FIELD_LENGTH;
        return (
          <div key={key} className="space-y-2">
            <Label htmlFor={`persona-${key}`}>{label}</Label>
            <p className="text-xs text-muted-foreground">{helper}</p>

            {profile[key].length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile[key].map((entry, i) => (
                  <Badge key={`${key}-${i}-${entry}`} variant="outline" className="gap-1 py-1">
                    {entry}
                    <button
                      type="button"
                      onClick={() => removeEntry(key, i)}
                      aria-label={`Eliminar "${entry}" de ${label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                id={`persona-${key}`}
                value={draft}
                placeholder={placeholder}
                maxLength={MAX_PERSONA_FIELD_LENGTH}
                onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEntry(key);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => addEntry(key)}
                disabled={!draft.trim() || overLimit}
              >
                Añadir
              </Button>
            </div>
            {overLimit && (
              <p className="text-xs text-destructive">
                Máximo {MAX_PERSONA_FIELD_LENGTH} caracteres.
              </p>
            )}
          </div>
        );
      })}

      {saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      <Button type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Guardando..." : submitLabel}
      </Button>
    </div>
  );
}
