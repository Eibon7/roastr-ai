// Fixed case sensitivity issue with AccountsPage.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { Login, Register, ResetPassword } from './pages/auth';
import AuthCallback from './pages/auth-callback';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserDetail from './pages/admin/UserDetail';
import AdminUsersPage from './pages/admin/users';
import AdminLayout from './components/admin/AdminLayout';
import AdminMetrics from './pages/admin/AdminMetrics';
import AdminLogs from './pages/admin/AdminLogs';
import AdminSettings from './pages/admin/AdminSettings';
import SystemControlPanel from './pages/admin/SystemControlPanel';
import AppShell from './components/AppShell';
import Dashboard from './pages/dashboard';
import Compose from './pages/Compose';
import Integrations from './pages/Integrations';
import Billing from './pages/Billing';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import PlanPicker from './pages/PlanPicker';
import Connect from './pages/Connect';
import StyleProfile from './pages/StyleProfile';
import Configuration from './pages/Configuration';
import Approval from './pages/Approval';
import AccountsPage from './pages/AccountsPage';
import Pricing from './pages/Pricing';
import Shop from './pages/Shop';
import ProtectedRoute, { AdminRoute, AuthRoute, PublicRoute } from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <SidebarProvider>
          <div className="App">
          <Routes>
            {/* Public routes - redirect if already authenticated */}
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            {/* Protected routes with AppShell - require authentication */}
            <Route path="/" element={<AuthRoute><AppShell /></AuthRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="compose" element={<Compose />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="integrations/connect" element={<Connect />} />
              <Route path="configuration" element={<Configuration />} />
              <Route path="approval" element={<Approval />} />
              <Route path="billing" element={<Billing />} />
              <Route path="settings" element={<Settings />} />
              <Route path="logs" element={<Logs />} />
              <Route path="plans" element={<PlanPicker />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="style-profile" element={<StyleProfile />} />
              <Route path="style-profile/generate" element={<StyleProfile />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="profile" element={<Settings />} /> {/* Profile redirects to Settings for now */}
              <Route path="shop" element={<Shop />} />
            </Route>
            
            {/* Admin routes with AdminLayout - require admin permissions */}
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<Navigate to="/admin/users" replace />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="users/:userId" element={<UserDetail />} />
              <Route path="plans" element={<AdminPlans />} />
              <Route path="metrics" element={<AdminMetrics />} />
              <Route path="logs" element={<AdminLogs />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="system-control" element={<SystemControlPanel />} />
            </Route>
            
            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </div>
        </SidebarProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;