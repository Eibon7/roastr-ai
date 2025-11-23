import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthForm from '../components/AuthForm';
import MagicLinkForm from '../components/MagicLinkForm';
import ThemeToggle from '../components/ThemeToggle';
import { authHelpers } from '../lib/supabaseClient';

const LoginPage = () => {
  const [authMethod, setAuthMethod] = useState('password'); // 'password' or 'magic-link'
  const [alert, setAlert] = useState(null);
  const navigate = useNavigate();

  // Check if magic link is enabled from environment variable
  const isMagicLinkEnabled = process.env.REACT_APP_USE_MAGIC_LINK === 'true';

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        const session = await authHelpers.getCurrentSession();
        if (session) {
          navigate('/dashboard');
        }
      } catch (error) {
        console.log('No active session');
      }
    };

    checkAuth();
  }, [navigate]);

  const handleSuccess = (message, data) => {
    setAlert({
      type: 'success',
      message
    });

    // If login was successful and we have a session, redirect
    if (data?.session) {
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    }
  };

  const handleError = (message, error) => {
    setAlert({
      type: 'error',
      message
    });
    console.error('Auth error:', error);
  };

  const toggleAuthMethod = () => {
    setAuthMethod((prev) => (prev === 'password' ? 'magic-link' : 'password'));
    setAlert(null); // Clear any existing alerts
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo/Brand */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
            <svg
              className="h-8 w-8 text-primary-600 dark:text-primary-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Iniciar sesión en Roastr.ai
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            O{' '}
            <Link
              to="/register"
              className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
            >
              crea una cuenta nueva
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Alert */}
          {alert && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                alert.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  {alert.type === 'success' ? (
                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{alert.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Auth Form */}
          {authMethod === 'password' ? (
            <AuthForm
              mode="login"
              onSuccess={handleSuccess}
              onError={handleError}
              onToggleMethod={isMagicLinkEnabled ? toggleAuthMethod : null}
            />
          ) : (
            <MagicLinkForm
              mode="login"
              onSuccess={handleSuccess}
              onError={handleError}
              onToggleMethod={toggleAuthMethod}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          <p>
            Al continuar, aceptas nuestros{' '}
            <a
              href="/terms"
              className="text-primary-600 hover:text-primary-500 dark:text-primary-400"
            >
              Términos de Servicio
            </a>{' '}
            y{' '}
            <a
              href="/privacy"
              className="text-primary-600 hover:text-primary-500 dark:text-primary-400"
            >
              Política de Privacidad
            </a>
          </p>
        </div>
      </div>

      <ThemeToggle />
    </div>
  );
};

export default LoginPage;
