import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook para manejar la redirección post-login según el rol del usuario
 * - Admin: redirige a /admin/users (backoffice)
 * - Usuario normal: redirige a /app (aplicación principal)
 *
 * Issue #1058: Actualizado para redirigir según AC de EPIC 1057
 */
export const usePostLoginRedirect = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAuthenticated, isAdmin, userData, loading } = useAuth();

  useEffect(() => {
    // No hacer nada si aún está cargando
    if (loading) return;

    // Solo redirigir si el usuario está autenticado
    if (isAuthenticated && userData) {
      // Issue #1058: Admin → /admin/users, User → /app
      const target = isAdmin ? '/admin/users' : '/app';
      // Fix BLOCKER 1: Remove /login guard - authenticated users should always redirect
      if (pathname !== target) {
        if (process.env.NODE_ENV === 'development') {
          console.log(
            isAdmin ? 'Redirecting admin user to /admin/users' : 'Redirecting normal user to /app'
          );
        }
        navigate(target, { replace: true });
      }
    }
  }, [isAuthenticated, isAdmin, userData, loading, navigate, pathname]);

  return {
    isRedirecting: isAuthenticated && !loading && !!userData,
    targetRoute: isAuthenticated ? (isAdmin ? '/admin/users' : '/app') : null
  };
};

export default usePostLoginRedirect;
