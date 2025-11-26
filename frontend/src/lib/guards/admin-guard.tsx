import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth-context';
import { Loader2 } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * AdminGuard - Protects routes that require admin role
 * Redirects to /app if user is not admin
 * Inherits from AuthGuard (user must be authenticated first)
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // User not authenticated, redirect to login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    // User authenticated but not admin, redirect to app
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
