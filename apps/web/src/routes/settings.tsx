import { useState } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import {
  Settings,
  User,
  Palette,
  Lock,
  Sun,
  Moon,
  Monitor,
  Check,
  Loader2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";

type Tab = "perfil" | "preferencias" | "seguridad";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "preferencias", label: "Preferencias", icon: Palette },
  { id: "seguridad", label: "Seguridad", icon: Lock },
];

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

// ─── Tab Perfil ──────────────────────────────────────────────────────────────

function PerfilTab() {
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">Información de perfil</h2>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Email</label>
          <p className="mt-1 text-sm text-foreground">{user?.email ?? "—"}</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">ID de usuario</label>
          <p className="mt-1 font-mono text-xs text-muted-foreground truncate">{user?.id ?? "—"}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Para cambiar tu email contacta con{" "}
        <a href="mailto:support@roastr.ai" className="text-primary underline">
          support@roastr.ai
        </a>
        .
      </p>
    </div>
  );
}

// ─── Tab Preferencias ────────────────────────────────────────────────────────

function PreferenciasTab() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Tema de la interfaz</h2>
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const isActive = theme === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={[
                  "flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
                {isActive && <Check className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab Seguridad ───────────────────────────────────────────────────────────

function SeguridadTab() {
  const { session } = useAuth();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  const [deleteMode, setDeleteMode] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "loading" | "error">("idle");
  const [deleteMsg, setDeleteMsg] = useState("");

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirm) { setStatus("error"); setMessage("Las contraseñas no coinciden."); return; }
    if (newPw.length < 8) { setStatus("error"); setMessage("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    setStatus("loading");
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
      );
      const { error } = await client.auth.updateUser({ password: newPw });
      if (error) throw error;
      setStatus("ok");
      setMessage("Contraseña actualizada correctamente.");
      setCurrentPw(""); setNewPw(""); setConfirm("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Error al cambiar la contraseña.");
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteStatus("loading");
    try {
      await apiFetch("/auth/account", {
        method: "DELETE",
        token: session?.access_token ?? undefined,
        body: JSON.stringify({ password: deletePw }),
      });
      window.location.href = "/login";
    } catch (err) {
      setDeleteStatus("error");
      setDeleteMsg(err instanceof Error ? err.message : "Error al eliminar la cuenta.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Cambiar contraseña */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Cambiar contraseña</h2>
        <form onSubmit={handleChangePassword} className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Contraseña nueva</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              placeholder="Mínimo 8 caracteres"
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Confirmar contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              placeholder="Repite la contraseña"
              required
            />
          </div>
          {status === "error" && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />{message}
            </div>
          )}
          {status === "ok" && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <Check className="h-3.5 w-3.5" />{message}
            </div>
          )}
          <button
            type="submit"
            disabled={status === "loading"}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Actualizar contraseña
          </button>
        </form>
      </div>

      {/* Eliminar cuenta */}
      <div>
        <h2 className="text-base font-semibold text-destructive mb-3">Zona de peligro</h2>
        {!deleteMode ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Eliminar tu cuenta borrará todos tus datos permanentemente. Esta acción no se puede deshacer.
            </p>
            <button
              onClick={() => setDeleteMode(true)}
              className="flex items-center gap-2 rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar cuenta
            </button>
          </div>
        ) : (
          <form onSubmit={handleDeleteAccount} className="rounded-lg border border-destructive bg-destructive/5 p-4 space-y-3">
            <p className="text-sm font-medium text-destructive">¿Confirmas que quieres eliminar tu cuenta?</p>
            <div>
              <label className="text-xs text-muted-foreground">Introduce tu contraseña para confirmar</label>
              <input
                type="password"
                value={deletePw}
                onChange={(e) => setDeletePw(e.target.value)}
                className="mt-1 w-full rounded-md border border-destructive/50 bg-background px-3 py-2 text-sm text-foreground"
                required
              />
            </div>
            {deleteStatus === "error" && (
              <p className="text-xs text-destructive">{deleteMsg}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={deleteStatus === "loading"}
                className="flex items-center gap-2 rounded-md bg-destructive px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {deleteStatus === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirmar eliminación
              </button>
              <button type="button" onClick={() => setDeleteMode(false)} className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Links legales */}
      <div className="flex gap-4 text-xs text-muted-foreground border-t border-border pt-3">
        <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
        <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
      </div>
    </div>
  );
}

// ─── Settings Page ───────────────────────────────────────────────────────────

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("perfil");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Ajustes</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={[
              "flex items-center gap-1.5 px-3 py-2 text-sm transition-colors -mb-px border-b-2",
              activeTab === id
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "perfil" && <PerfilTab />}
        {activeTab === "preferencias" && <PreferenciasTab />}
        {activeTab === "seguridad" && <SeguridadTab />}
      </div>
    </div>
  );
}
