// Fixed case sensitivity issue with AccountsPage.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './pages/login';
import RegisterPage from './pages/register';
import ResetPasswordPage from './pages/reset-password';
import AuthCallback from './pages/auth-callback';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserDetail from './pages/admin/UserDetail';
import AdminUsersPage from './pages/admin/users';
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
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            {/* Protected routes with AppShell */}
            <Route path="/" element={<AppShell />}>
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
            </Route>
            
            {/* Admin routes (separate from AppShell) */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/user/:userId" element={<UserDetail />} />
            
            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;