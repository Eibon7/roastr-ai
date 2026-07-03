import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAccounts } from "@/hooks/use-accounts";
import { Settings } from "lucide-react";
import { AccountConfigModal } from "./AccountConfigModal";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

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
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setConfigAccountId(acc.id)}
                        aria-label="Configurar cuenta"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setConfigAccountId(acc.id)}
                        aria-label="Configurar cuenta"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
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
