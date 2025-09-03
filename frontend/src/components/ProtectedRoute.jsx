import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute Component
 * 
 * Protege rutas basándose en autenticación y roles de usuario
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Componentes hijos a renderizar si está autorizado
 * @param {boolean} props.requireAuth - Si requiere autenticación (default: true)
 * @param {boolean} props.requireAdmin - Si requiere permisos de admin (default: false)
 * @param {string} props.redirectTo - Ruta de redirección si no está autorizado
 */
const ProtectedRoute = ({ 
  children, 
  requireAuth = true, 
  requireAdmin = false,
  redirectTo = null 
}) => {
  const { isAuthenticated, isAdmin, loading, userData } = useAuth();
  const location = useLocation();

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Si requiere autenticación y no está autenticado
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si requiere admin y no es admin
  if (requireAdmin && !isAdmin) {
    const defaultRedirect = isAuthenticated ? '/dashboard' : '/login';
    return <Navigate to={redirectTo || defaultRedirect} replace />;
  }

  // Si está autorizado, renderizar los hijos
  return children;
};

/**
 * AdminRoute Component
 * 
 * Componente específico para rutas de admin
 */
export const AdminRoute = ({ children }) => {
  return (
    <ProtectedRoute requireAuth={true} requireAdmin={true}>
      {children}
    </ProtectedRoute>
  );
};

/**
 * AuthRoute Component
 * 
 * Componente para rutas que requieren solo autenticación
 */
export const AuthRoute = ({ children }) => {
  return (
    <ProtectedRoute requireAuth={true} requireAdmin={false}>
      {children}
    </ProtectedRoute>
  );
};

/**
 * PublicRoute Component
 * 
 * Componente para rutas públicas que redirigen si ya está autenticado
 */
export const PublicRoute = ({ children, redirectTo = '/dashboard' }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Si está autenticado, redirigir según el rol
  if (isAuthenticated) {
    const targetRoute = isAdmin ? '/admin' : redirectTo;
    return <Navigate to={targetRoute} replace />;
  }

  // Si no está autenticado, mostrar la ruta pública
  return children;
};

export default ProtectedRoute;
