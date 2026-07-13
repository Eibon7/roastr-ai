import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAccounts, type Account } from "@/hooks/use-accounts";
import { Settings, RefreshCcw, Unlink, Pause, Play } from "lucide-react";
import { AccountConfigModal } from "./AccountConfigModal";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

type Props = {
  token: string | null;
  /** Set to "onboarding" when rendered from the onboarding wizard's
   * connect_accounts step, so the OAuth callback sends the user back to
   * /onboarding instead of /connect once they've connected an account. */
  returnTo?: "onboarding";
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  x: "X (Twitter)",
};

// Only these statuses count as "holding a slot" against the plan's
// accountsPerPlatform limit — mirrors the check in apps/api's OAuthService.
const SLOT_HOLDING_STATUSES = new Set(["active", "paused"]);

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Activa", className: "bg-green-500/20 text-green-700 dark:text-green-400" },
  paused: { label: "Pausada", className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
  revoked: { label: "Desconectada", className: "bg-gray-500/20 text-gray-600" },
  error: { label: "Token expirado", className: "bg-red-500/20 text-red-700 dark:text-red-400" },
};

function formatRetentionDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type AccountActionsProps = {
  account: Account;
  onReconnect: (platform: string) => void;
  onTogglePause: (account: Account) => void;
  togglingPause: boolean;
  onConfigRequest: (accountId: string) => void;
  onDisconnectRequest: (account: Account) => void;
};

function AccountActions({
  account,
  onReconnect,
  onTogglePause,
  togglingPause,
  onConfigRequest,
  onDisconnectRequest,
}: AccountActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      {account.status === "error" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onReconnect(account.platform)}
          aria-label="Reconectar cuenta"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Reconectar
        </Button>
      )}
      {(account.status === "active" || account.status === "paused") && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onTogglePause(account)}
          disabled={togglingPause}
          aria-label={account.status === "paused" ? "Reanudar cuenta" : "Pausar cuenta"}
        >
          {account.status === "paused" ? (
            <Play className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
        </Button>
      )}
      {account.status !== "revoked" && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onConfigRequest(account.id)}
            aria-label="Configurar cuenta"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onDisconnectRequest(account)}
            aria-label="Desconectar cuenta"
          >
            <Unlink className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}

export function ConnectedAccounts({ token, returnTo }: Props) {
  const { accounts, loading: isLoading, refetch: refetchAccounts } = useAccounts(token);
  const [configAccountId, setConfigAccountId] = useState<string | null>(null);
  const [disconnectAccount, setDisconnectAccount] = useState<Account | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [pauseError, setPauseError] = useState<string | null>(null);

  const handleConnect = async (platform: string) => {
    if (!token) return;
    const path = returnTo
      ? `/oauth/${platform}/authorize?returnTo=${returnTo}`
      : `/oauth/${platform}/authorize`;
    const { url } = await apiFetch<{ url: string }>(path, { token });
    window.location.href = url;
  };

  const handleDisconnect = async () => {
    if (!token || !disconnectAccount) return;
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      await apiFetch(`/accounts/${disconnectAccount.id}`, { token, method: "DELETE" });
      setDisconnectAccount(null);
      refetchAccounts();
    } catch (e) {
      setDisconnectError(e instanceof Error ? e.message : "Error al desconectar la cuenta");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleTogglePause = async (account: Account) => {
    if (!token) return;
    const nextPaused = account.status !== "paused";
    setPausingId(account.id);
    setPauseError(null);
    try {
      await apiFetch(`/accounts/${account.id}/pause`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ paused: nextPaused }),
      });
      refetchAccounts();
    } catch (e) {
      setPauseError(e instanceof Error ? e.message : "Error al pausar/reanudar la cuenta");
    } finally {
      setPausingId(null);
    }
  };

  const youtubeCount = accounts.filter(
    (a) => a.platform === "youtube" && SLOT_HOLDING_STATUSES.has(a.status),
  ).length;
  const xCount = accounts.filter(
    (a) => a.platform === "x" && SLOT_HOLDING_STATUSES.has(a.status),
  ).length;
  // Max accounts per platform is determined by the plan; for now we derive it
  // from the data: if any platform already has 2+ accounts the cap is at least 2.
  // This will be replaced by a plan-aware hook when billing context is available.
  const maxPerPlatform = 2;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {accounts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Cuentas conectadas</h2>
          {pauseError && (
            <Alert variant="destructive">
              <AlertDescription>{pauseError}</AlertDescription>
            </Alert>
          )}
        <Card className="overflow-hidden py-0">
          {/* Desktop: table layout */}
          <table className="hidden w-full text-sm sm:table">
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
                      <Badge className={badge.className}>{badge.label}</Badge>
                      {acc.status === "revoked" && acc.retention_until && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Datos retenidos hasta {formatRetentionDate(acc.retention_until)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AccountActions
                        account={acc}
                        onReconnect={handleConnect}
                        onTogglePause={handleTogglePause}
                        togglingPause={pausingId === acc.id}
                        onConfigRequest={setConfigAccountId}
                        onDisconnectRequest={setDisconnectAccount}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile: accordion layout */}
          <Accordion type="single" collapsible className="sm:hidden px-4">
            {accounts.map((acc) => {
              const badge = STATUS_BADGE[acc.status] ?? STATUS_BADGE.active;
              return (
                <AccordionItem key={acc.id} value={acc.id}>
                  <AccordionTrigger>
                    <div className="flex flex-1 items-center justify-between pr-2">
                      <span>{PLATFORM_LABELS[acc.platform] ?? acc.platform}</span>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {acc.platform === "x" ? `@${acc.username}` : acc.username}
                      </span>
                      <AccountActions
                        account={acc}
                        onReconnect={handleConnect}
                        onTogglePause={handleTogglePause}
                        togglingPause={pausingId === acc.id}
                        onConfigRequest={setConfigAccountId}
                        onDisconnectRequest={setDisconnectAccount}
                      />
                    </div>
                    {acc.status === "revoked" && acc.retention_until && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Datos retenidos hasta {formatRetentionDate(acc.retention_until)}
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
          </Card>
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

      <Dialog
        open={disconnectAccount !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDisconnectAccount(null);
            setDisconnectError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar cuenta</DialogTitle>
            <DialogDescription>
              {disconnectAccount &&
                `Se detendrá la ingestión y el Shield para ${
                  PLATFORM_LABELS[disconnectAccount.platform] ?? disconnectAccount.platform
                } (${disconnectAccount.username}). Los datos se conservarán 90 días por motivos legales antes de eliminarse definitivamente.`}
            </DialogDescription>
          </DialogHeader>

          {disconnectError && (
            <Alert variant="destructive">
              <AlertDescription>{disconnectError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDisconnectAccount(null)}
              disabled={disconnecting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? "Desconectando..." : "Desconectar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Conectar nueva cuenta</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium text-foreground">YouTube</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Conecta tu canal para proteger los comentarios.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">{youtubeCount}/{maxPerPlatform}</Badge>
            </CardContent>
            <CardFooter>
              <Button
                type="button"
                onClick={() => handleConnect("youtube")}
                disabled={!token || youtubeCount >= maxPerPlatform}
              >
                Conectar YouTube
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardContent className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium text-foreground">X (Twitter)</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Conecta tu cuenta para proteger tus menciones.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">{xCount}/{maxPerPlatform}</Badge>
            </CardContent>
            <CardFooter>
              <Button
                type="button"
                onClick={() => handleConnect("x")}
                disabled={!token || xCount >= maxPerPlatform}
              >
                Conectar X
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
