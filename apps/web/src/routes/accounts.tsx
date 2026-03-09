import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { ConnectedAccounts } from "@/components/accounts/ConnectedAccounts";
import { Users, Plus, Youtube, Twitter } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

function ConnectButton({ platform, label, icon: Icon }: {
  platform: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const { session } = useAuth();

  function handleConnect() {
    if (!session?.access_token) return;
    window.location.href = `${API_BASE}/oauth/${platform}/authorize?token=${session.access_token}`;
  }

  return (
    <button
      onClick={handleConnect}
      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Icon className="h-4 w-4" />
      Conectar {label}
    </button>
  );
}

export function AccountsPage() {
  const { session } = useAuth();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Cuentas</h1>
        </div>
      </div>

      {/* Conectar nueva cuenta */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Conectar nueva cuenta</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <ConnectButton platform="youtube" label="YouTube" icon={Youtube} />
          <ConnectButton platform="x" label="X (Twitter)" icon={Twitter} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Conecta tus cuentas para que Shield monitorice y gestione comentarios automáticamente.
        </p>
      </div>

      {/* Lista de cuentas conectadas con config de shield */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Cuentas conectadas</h2>
        <ConnectedAccounts token={session?.access_token ?? null} />
      </div>
    </div>
  );
}
