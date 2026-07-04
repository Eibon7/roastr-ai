import { type ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/auth-context";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
  Zap,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/shield", label: "Shield", icon: <ShieldCheck className="h-4 w-4" /> },
  { to: "/accounts", label: "Accounts", icon: <Users className="h-4 w-4" /> },
  { to: "/billing", label: "Billing", icon: <CreditCard className="h-4 w-4" /> },
  { to: "/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

type ThemeValue = "light" | "dark" | "system";

const THEME_OPTIONS: { value: ThemeValue; icon: ReactNode; label: string }[] = [
  { value: "light", icon: <Sun className="h-3.5 w-3.5" />, label: "Claro" },
  { value: "dark", icon: <Moon className="h-3.5 w-3.5" />, label: "Oscuro" },
  { value: "system", icon: <Monitor className="h-3.5 w-3.5" />, label: "Sistema" },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current = (theme ?? "system") as ThemeValue;
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Tema de la interfaz">
      {THEME_OPTIONS.map(({ value, icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          title={label}
          aria-label={`Tema ${label}`}
          aria-pressed={current === value}
          className={[
            "flex h-7 flex-1 items-center justify-center rounded-md transition-colors",
            current === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

type Props = {
  children: ReactNode;
};

export function AppLayout({ children }: Props) {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
    );
    await client.auth.signOut();
    navigate("/login");
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "?";

  const sidebar = (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-5 font-bold text-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" />
        </span>
        <span className="text-base tracking-tight">Roastr</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  ].join(" ")
                }
              >
                {icon}
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </div>
          <span className="truncate text-xs text-muted-foreground">
            {user?.email ?? ""}
          </span>
        </div>
        <div className="space-y-1.5">
          <span className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Tema
          </span>
          <ThemeToggle />
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:shrink-0">{sidebar}</div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex h-full w-56 shrink-0">{sidebar}</div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-3 border-b border-border px-4 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-foreground">Roastr</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
