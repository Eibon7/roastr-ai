/**
 * Admin Guard
 * 
 * Protects routes that require admin permissions
 * Issue #1063: Route guards reorganization
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * AdminGuard Component
 * 
 * Protects routes that require admin permissions.
 * Redirects to /app if user is not admin, or /login if not authenticated.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Children to render if admin
 * @param {string} props.redirectTo - Redirect path if not admin (default: '/app')
 * @returns {React.ReactNode}
 */
export const AdminGuard = ({ children, redirectTo }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect to /app if not admin
  if (!isAdmin) {
    const defaultRedirect = redirectTo || '/app';
    return <Navigate to={defaultRedirect} replace />;
  }

  // User is admin, render children
  return <>{children}</>;
};

export default AdminGuard;

