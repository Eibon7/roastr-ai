import { ReactNode } from 'react';
import { MainNav } from './main-nav';
import { MobileNav } from './mobile-nav';
import { ThemeToggle } from './theme-toggle';

interface AdminShellProps {
  children: ReactNode;
}

/**
 * AdminShell - Layout principal para panel de administración
 *
 * Incluye:
 * - Sidebar con navegación (desktop)
 * - Sheet/Drawer móvil (mobile)
 * - Topbar con theme toggle
 * - Responsive en todos los breakpoints
 */
export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar - Desktop only */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card">
        <div className="p-6">
          <h1 className="text-2xl font-bold">Roastr.AI</h1>
          <p className="text-sm text-muted-foreground">Admin Dashboard</p>
        </div>
        <MainNav />
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="border-b bg-card">
          <div className="flex h-16 items-center gap-4 px-6">
            {/* Mobile menu */}
            <MobileNav />

            {/* Spacer */}
            <div className="flex-1" />

            {/* Theme toggle */}
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
