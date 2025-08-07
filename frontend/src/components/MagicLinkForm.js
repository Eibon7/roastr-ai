import React, { useState } from 'react';
import { authHelpers } from '../lib/supabaseClient';

const MagicLinkForm = ({ mode = 'login', onSuccess, onError, onToggleMethod }) => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const isLogin = mode === 'login';
  const isRegister = mode === 'register';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let result;
      
      if (isLogin) {
        result = await authHelpers.signInWithMagicLink(formData.email);
        setEmailSent(true);
        onSuccess?.('Te hemos enviado un enlace mágico a tu correo electrónico. Revisa tu bandeja de entrada.', result);
      } else if (isRegister) {
        result = await authHelpers.signUpWithMagicLink(formData.email, formData.name);
        setEmailSent(true);
        onSuccess?.('Te hemos enviado un enlace mágico para crear tu cuenta. Revisa tu bandeja de entrada.', result);
      }
    } catch (error) {
      let errorMessage = 'Ha ocurrido un error inesperado';
      
      if (error.message.includes('Invalid email')) {
        errorMessage = 'Email inválido';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Este email no ha sido confirmado. Revisa tu correo electrónico.';
      } else if (error.message.includes('Too many requests')) {
        errorMessage = 'Demasiadas solicitudes. Por favor espera unos minutos antes de intentar de nuevo.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      onError?.(errorMessage, error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(formData.email)) return false;
    if (isRegister && formData.name.trim().length < 2) return false;
    
    return true;
  };

  const handleResendEmail = async () => {
    setIsLoading(true);
    try {
      if (isLogin) {
        await authHelpers.signInWithMagicLink(formData.email);
      } else {
        await authHelpers.signUpWithMagicLink(formData.email, formData.name);
      }
      onSuccess?.('Enlace mágico reenviado correctamente.');
    } catch (error) {
      onError?.('No se pudo reenviar el enlace mágico. Inténtalo de nuevo.', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="text-center space-y-6">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-800">
          <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            ¡Revisa tu correo electrónico!
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Te hemos enviado un enlace mágico a <strong>{formData.email}</strong>. 
            Haz clic en el enlace para {isLogin ? 'iniciar sesión' : 'crear tu cuenta'}.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            El enlace expira en 60 minutos. Si no encuentras el correo, revisa tu carpeta de spam.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleResendEmail}
            disabled={isLoading}
            className="text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium disabled:opacity-50 transition-colors duration-200"
          >
            {isLoading ? 'Reenviando...' : 'Reenviar enlace mágico'}
          </button>
          
          <div>
            <button
              onClick={() => setEmailSent(false)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm transition-colors duration-200"
            >
              ← Usar otro email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary-100 dark:bg-primary-900 mb-4">
          <svg className="h-8 w-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {isLogin ? 'Iniciar sesión' : 'Crear cuenta'} con enlace mágico
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Te enviaremos un enlace seguro a tu correo electrónico para {isLogin ? 'iniciar sesión' : 'crear tu cuenta'} sin contraseña.
        </p>
      </div>

      {/* Name field for register */}
      {isRegister && (
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nombre completo
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Tu nombre completo"
          />
        </div>
      )}

      {/* Email field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="tu@email.com"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Te enviaremos un enlace de acceso único a este correo
        </p>
      </div>

      {/* Submit button */}
      <div>
        <button
          type="submit"
          disabled={isLoading || !validateForm()}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isLoading ? (
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Enviando...
            </div>
          ) : (
            `Enviar enlace mágico`
          )}
        </button>
      </div>

      {/* Method toggle */}
      {onToggleMethod && (
        <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onToggleMethod}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200"
          >
            ¿Prefieres usar email y contraseña?
          </button>
        </div>
      )}
    </form>
  );
};

export default MagicLinkForm;