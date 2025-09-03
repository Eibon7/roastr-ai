import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook para manejar la redirección post-login según el rol del usuario
 * - Admin: redirige a /admin (backoffice)
 * - Usuario normal: redirige a /dashboard (Home)
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
      const target = isAdmin ? '/admin' : '/dashboard';
      if (pathname !== target) {
        if (process.env.NODE_ENV === 'development') {
          console.log(
            isAdmin
              ? 'Redirecting admin user to backoffice'
              : 'Redirecting normal user to dashboard'
          );
        }
        navigate(target, { replace: true });
      }
    }
  }, [isAuthenticated, isAdmin, userData, loading, navigate, pathname]);

  return {
    isRedirecting: isAuthenticated && !loading && !!userData,
    targetRoute: isAuthenticated ? (isAdmin ? '/admin' : '/dashboard') : null
  };
};

export default usePostLoginRedirect;
