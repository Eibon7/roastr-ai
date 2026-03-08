import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./contexts/auth-context";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./routes/login";
import { RegisterPage } from "./routes/register";
import { ConnectPage } from "./routes/connect";
import { DashboardPage } from "./routes/dashboard";
import { SettingsPage } from "./routes/settings";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { BillingRoute } from "./routes/billing";

function ProtectedWithLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
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
              path="/billing"
              element={<ProtectedWithLayout><BillingRoute /></ProtectedWithLayout>}
            />
            <Route
              path="/connect"
              element={<ProtectedWithLayout><ConnectPage /></ProtectedWithLayout>}
            />
            <Route
              path="/dashboard"
              element={<ProtectedWithLayout><DashboardPage /></ProtectedWithLayout>}
            />
            <Route
              path="/settings"
              element={<ProtectedWithLayout><SettingsPage /></ProtectedWithLayout>}
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
