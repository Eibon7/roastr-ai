import { useAuth } from "@/contexts/auth-context";
import { ConnectedAccounts } from "@/components/accounts/ConnectedAccounts";
import { Users } from "lucide-react";

export function AccountsPage() {
  const { session } = useAuth();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Cuentas</h1>
          <p className="text-sm text-muted-foreground">
            Conecta y gestiona las cuentas que Shield protege automáticamente.
          </p>
        </div>
      </div>

      <ConnectedAccounts token={session?.access_token ?? null} />
    </div>
  );
}
