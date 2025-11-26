/**
 * Auth Guard
 * 
 * Protects routes that require authentication
 * Issue #1063: Route guards reorganization
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * AuthGuard Component
 * 
 * Protects routes that require authentication.
 * Redirects to /login if user is not authenticated.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Children to render if authenticated
 * @param {string} props.redirectTo - Redirect path if not authenticated (default: '/login')
 * @returns {React.ReactNode}
 */
export const AuthGuard = ({ children, redirectTo = '/login' }) => {
  const { isAuthenticated, loading } = useAuth();
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
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // User is authenticated, render children
  return <>{children}</>;
};

export default AuthGuard;

