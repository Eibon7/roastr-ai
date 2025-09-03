import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook para manejar la redirección post-login según el rol del usuario
 * - Admin: redirige a /admin (backoffice)
 * - Usuario normal: redirige a /dashboard (Home)
 */
export const usePostLoginRedirect = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, userData, loading } = useAuth();

  useEffect(() => {
    // No hacer nada si aún está cargando
    if (loading) return;

    // Solo redirigir si el usuario está autenticado
    if (isAuthenticated && userData) {
      if (isAdmin) {
        // Development-only logging
        if (process.env.NODE_ENV === 'development') {
          console.log('Redirecting admin user to backoffice');
        }
        navigate('/admin');
      } else {
        // Development-only logging
        if (process.env.NODE_ENV === 'development') {
          console.log('Redirecting normal user to dashboard');
        }
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, isAdmin, userData, loading, navigate]);

  return {
    isRedirecting: isAuthenticated && !loading,
    targetRoute: isAuthenticated ? (isAdmin ? '/admin' : '/dashboard') : null
  };
};

export default usePostLoginRedirect;
