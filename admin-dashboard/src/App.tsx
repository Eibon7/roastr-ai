import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { AdminShell } from '@/components/layout/admin-shell';
import GDDDashboard from '@pages/GDDDashboard';
import ShieldSettings from '@pages/ShieldSettings';
import ShieldValidation from '@pages/ShieldValidation';
import WorkersDashboard from '@pages/Workers';
import AdminUsers from '@pages/AdminUsers';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000 // 30 seconds
    }
  }
});

/**
 * Application root component that configures React Query, theming, accessibility, and routes for the admin dashboard.
 *
 * @returns The root React element for the admin dashboard application.
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <Router>
          <AdminShell>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<GDDDashboard />} />
              <Route path="/shield/settings" element={<ShieldSettings />} />
              <Route path="/shield/validation" element={<ShieldValidation />} />
              <Route path="/admin/workers" element={<WorkersDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AdminShell>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
