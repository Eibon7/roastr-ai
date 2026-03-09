import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Settings } from "lucide-react";
import { AccountConfigModal } from "./AccountConfigModal";

type Account = {
  id: string;
  platform: string;
  username: string;
  status: string;
  integration_health: string;
  shield_aggressiveness?: number;
};

type BillingUsage = {
  plan: string;
};

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [planTier, setPlanTier] = useState<string>("");

  const loadAccounts = useCallback(async (signal?: AbortSignal) => {
    if (!token) {
      setAccounts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiFetch<Account[]>("/accounts", { token, signal });
      if (signal?.aborted) return;
      setAccounts(data);
      setAccountsError(null);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setAccountsError(e instanceof Error ? e.message : "Error al cargar cuentas");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    void loadAccounts(controller.signal);
    return () => controller.abort();
  }, [loadAccounts]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    apiFetch<BillingUsage>("/billing/usage", { token, signal: controller.signal })
      .then((d) => {
        if (!controller.signal.aborted) setPlanTier(d.plan ?? "starter");
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        console.error("Failed to load billing usage", e);
        // Preserve existing planTier rather than downgrading on transient errors
      });
    return () => controller.abort();
  }, [token]);

  const handleConnect = async (platform: "youtube" | "x") => {
    if (!token) return;
    try {
      const { url } = await apiFetch<{ url: string }>(`/oauth/${platform}/authorize`, { token });
      window.location.href = url;
    } catch (e) {
      setAccountsError(e instanceof Error ? e.message : "Error al iniciar OAuth");
    }
  };

  const youtubeCount = accounts.filter((a) => a.platform === "youtube").length;
  const xCount = accounts.filter((a) => a.platform === "x").length;
  const maxPerPlatform = (planTier === "pro" || planTier === "plus") ? 2 : 1;
  const [configAccountId, setConfigAccountId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-input bg-card p-6">
        <p className="text-sm text-muted-foreground">Cargando cuentas...</p>
      </div>
    );
  }

  if (accountsError) {
    return (
      <div className="rounded-lg border border-input bg-card p-6">
        <p className="text-sm text-destructive">{accountsError}</p>
        <button
          type="button"
          onClick={() => void loadAccounts()}
          className="mt-2 text-sm text-primary underline"
        >
          Reintentar
        </button>
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
            void loadAccounts();
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
            onClick={() => void handleConnect("youtube")}
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
            onClick={() => void handleConnect("x")}
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
