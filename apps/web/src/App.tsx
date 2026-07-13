import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./contexts/auth-context";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { RequireOnboarding } from "./components/auth/RequireOnboarding";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./routes/login";
import { RegisterPage } from "./routes/register";
import { ConnectPage } from "./routes/connect";
import { DashboardPage } from "./routes/dashboard";
import { SettingsPage } from "./routes/settings";
import { PersonaSettingsPage } from "./routes/persona";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { BillingRoute } from "./routes/billing";
import { ShieldPage } from "./routes/shield";
import { AccountsPage } from "./routes/accounts";
import { PrivacyPage } from "./routes/privacy";
import { TermsPage } from "./routes/terms";

function ProtectedWithLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <RequireOnboarding>
        <AppLayout>{children}</AppLayout>
      </RequireOnboarding>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/onboarding"
              element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>}
            />
            <Route
              path="/shield"
              element={<ProtectedWithLayout><ShieldPage /></ProtectedWithLayout>}
            />
            <Route
              path="/billing"
              element={<ProtectedWithLayout><BillingRoute /></ProtectedWithLayout>}
            />
            <Route
              path="/accounts"
              element={<ProtectedWithLayout><AccountsPage /></ProtectedWithLayout>}
            />
            <Route
              path="/connect"
              // Deliberately NOT wrapped in RequireOnboarding: the wizard's
              // connect_accounts step navigates here while onboarding state
              // is still "connect_accounts" (not "done"), so gating this
              // route on onboarding completion would bounce the user
              // straight back to /onboarding, unable to ever connect an
              // account mid-wizard.
              element={<ProtectedRoute><AppLayout><ConnectPage /></AppLayout></ProtectedRoute>}
            />
            <Route
              path="/dashboard"
              element={<ProtectedWithLayout><DashboardPage /></ProtectedWithLayout>}
            />
            <Route
              path="/settings"
              element={<ProtectedWithLayout><SettingsPage /></ProtectedWithLayout>}
            />
            <Route
              path="/settings/persona"
              element={<ProtectedWithLayout><PersonaSettingsPage /></ProtectedWithLayout>}
            />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
