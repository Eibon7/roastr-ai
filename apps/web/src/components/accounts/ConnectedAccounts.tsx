import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAccounts } from "@/hooks/use-accounts";
import { Settings } from "lucide-react";
import { AccountConfigModal } from "./AccountConfigModal";

type Props = { token: string | null };

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  x: "X (Twitter)",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Activa", className: "bg-green-500/20 text-green-700 dark:text-green-400" },
  paused: { label: "Pausada", className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
  inactive: { label: "Inactiva", className: "bg-red-500/20 text-red-700 dark:text-red-400" },
  revoked: { label: "Revocada", className: "bg-gray-500/20 text-gray-600" },
  error: { label: "Error", className: "bg-red-500/20 text-red-700" },
};

export function ConnectedAccounts({ token }: Props) {
  const { accounts, loading: isLoading, refetch: refetchAccounts } = useAccounts(token);

  const handleConnect = async (platform: "youtube" | "x") => {
    if (!token) return;
    const { url } = await apiFetch<{ url: string }>(`/oauth/${platform}/authorize`, {
      token,
    });
    window.location.href = url;
  };

  const youtubeCount = accounts.filter((a) => a.platform === "youtube").length;
  const xCount = accounts.filter((a) => a.platform === "x").length;
  // Max accounts per platform is determined by the plan; for now we derive it
  // from the data: if any platform already has 2+ accounts the cap is at least 2.
  // This will be replaced by a plan-aware hook when billing context is available.
  const maxPerPlatform = 2;
  const [configAccountId, setConfigAccountId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-input bg-card p-6">
        <p className="text-sm text-muted-foreground">Cargando cuentas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {accounts.length > 0 && (
        <div className="rounded-lg border border-input bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-input bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Plataforma</th>
                <th className="px-4 py-3 text-left font-medium">Usuario</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => {
                const badge = STATUS_BADGE[acc.status] ?? STATUS_BADGE.active;
                return (
                  <tr key={acc.id} className="border-b border-input/50 last:border-0">
                    <td className="px-4 py-3">
                      {PLATFORM_LABELS[acc.platform] ?? acc.platform}
                    </td>
                    <td className="px-4 py-3">
                      {acc.platform === "x" ? `@${acc.username}` : acc.username}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setConfigAccountId(acc.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Configurar cuenta"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {configAccountId && token && (
        <AccountConfigModal
          accountId={configAccountId}
          token={token}
          onClose={() => setConfigAccountId(null)}
          onSaved={() => {
            setConfigAccountId(null);
            refetchAccounts();
          }}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-input bg-card p-4">
          <h3 className="font-medium">YouTube</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Conecta tu canal de YouTube para proteger los comentarios.
          </p>
          <button
            type="button"
            onClick={() => handleConnect("youtube")}
            disabled={!token || youtubeCount >= maxPerPlatform}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Conectar YouTube ({youtubeCount}/{maxPerPlatform})
          </button>
        </div>
        <div className="rounded-lg border border-input bg-card p-4">
          <h3 className="font-medium">X (Twitter)</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Conecta tu cuenta de X para proteger tus menciones.
          </p>
          <button
            type="button"
            onClick={() => handleConnect("x")}
            disabled={!token || xCount >= maxPerPlatform}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Conectar X ({xCount}/{maxPerPlatform})
          </button>
        </div>
      </div>
    </div>
  );
}
