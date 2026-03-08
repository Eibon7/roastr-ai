import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./contexts/auth-context";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { LoginPage } from "./routes/login";
import { RegisterPage } from "./routes/register";
import { DashboardPage } from "./routes/dashboard";
import { SettingsPage } from "./routes/settings";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { BillingRoute } from "./routes/billing";

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute><BillingRoute /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
