/**
 * Main App Component
 *
 * Root component of the Roastr.ai frontend application.
 * Sets up routing, theme, authentication, and all global providers.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/lib/theme-provider';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/sonner';

// Guards
import { AuthGuard } from '@/lib/guards/auth-guard';
import { AdminGuard } from '@/lib/guards/admin-guard';

// Layouts
import { AdminShell } from '@/components/layout/admin-shell';
import { AppShell } from '@/components/layout/app-shell';

// Pages
import LoginPage from '@/pages/auth/login';
import AdminDashboardPage from '@/pages/admin/dashboard';
import AdminUsersPage from '@/pages/admin/users';
import FeatureFlagsPage from '@/pages/admin/config/feature-flags';
import PlansPage from '@/pages/admin/config/plans';
import TonesPage from '@/pages/admin/config/tones';
import MetricsPage from '@/pages/admin/metrics';
import AppHomePage from '@/pages/app/home';
import NotFound from '@/pages/NotFound';

/**
 * App Component
 *
 * Main application entry point with:
 * - Theme provider (light/dark/system)
 * - Authentication context
 * - React Router setup
 * - Protected routes with guards
 * - Toast notifications
 */
function App() {
  return (
    <ThemeProvider
      defaultTheme="system"
      storageKey="roastr-theme"
      disableTransitionOnChange={true}
    >
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/app" replace />} />

            {/* Auth routes (public) */}
            <Route path="/login" element={<LoginPage />} />

            {/* App routes (user routes) - Protected with AuthGuard */}
            <Route
              path="/app/*"
              element={
                <AuthGuard>
                  <AppShell>
                    <Routes>
                      <Route index element={<AppHomePage />} />
                      <Route
                        path="accounts"
                        element={<div className="p-8">Accounts Page (Coming Soon)</div>}
                      />
                      <Route
                        path="settings"
                        element={<div className="p-8">Settings Page (Coming Soon)</div>}
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppShell>
                </AuthGuard>
              }
            />

            {/* Admin routes - Protected with AdminGuard */}
            <Route
              path="/admin/*"
              element={
                <AdminGuard>
                  <AdminShell>
                    <Routes>
                      <Route index element={<AdminDashboardPage />} />
                      <Route path="users" element={<AdminUsersPage />} />
                      <Route path="metrics" element={<MetricsPage />} />
                      <Route path="config/plans" element={<PlansPage />} />
                      <Route path="config/feature-flags" element={<FeatureFlagsPage />} />
                      <Route path="config/tones" element={<TonesPage />} />
                      <Route
                        path="logs"
                        element={<div className="p-8">Logs Page (Coming Soon)</div>}
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AdminShell>
                </AdminGuard>
              }
            />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
