import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { ConnectedAccounts } from "@/components/accounts/ConnectedAccounts";

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "Error al conectar. Inténtalo de nuevo.",
  access_denied: "Acceso denegado. Por favor, acepta los permisos para continuar.",
};

function mapCallbackError(slug: string): string {
  return CALLBACK_ERROR_MESSAGES[slug] ?? "Error al conectar. Inténtalo de nuevo.";
}

export function ConnectPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ platform: string } | null>(null);

  useEffect(() => {
    const err = searchParams.get("error");
    const succ = searchParams.get("success");
    if (err) {
      setError(mapCallbackError(err));
      setSuccess(null);
    } else if (succ && (succ === "youtube" || succ === "x")) {
      setSuccess({ platform: succ });
      setError(null);
    } else {
      setError(null);
      setSuccess(null);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Cuentas conectadas</h1>

        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            Cuenta de {success.platform === "youtube" ? "YouTube" : "X"} conectada correctamente.
          </div>
        )}

        <ConnectedAccounts token={session?.access_token ?? null} />

        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="text-sm text-muted-foreground underline"
        >
          Volver al dashboard
        </button>
      </div>
    </div>
  );
}
