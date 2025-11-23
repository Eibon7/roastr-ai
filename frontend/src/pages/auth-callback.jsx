import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth callback error:', error);
          navigate('/login', {
            state: {
              error: 'Error durante la autenticación. Por favor intenta de nuevo.'
            }
          });
          return;
        }

        if (data.session) {
          // Successful authentication
          navigate('/dashboard', {
            state: {
              message: '¡Has iniciado sesión correctamente!'
            }
          });
        } else {
          // No session found
          navigate('/login');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login', {
          state: {
            error: 'Error durante la autenticación. Por favor intenta de nuevo.'
          }
        });
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Completando autenticación...
        </h2>
        <p className="text-gray-600 dark:text-gray-400">Por favor espera mientras te redirigimos</p>
      </div>
    </div>
  );
};

export default AuthCallback;
