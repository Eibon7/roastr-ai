import React, { useState } from 'react';
import { authHelpers } from '../lib/supabaseClient';
import PasswordInput from './PasswordInput';
import { validatePassword } from '../utils/passwordValidator';

const AuthForm = ({ mode = 'login', onSuccess, onError, onToggleMethod }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);

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
      // Validate password for registration
      if (isRegister) {
        const passwordValidation = validatePassword(formData.password);
        if (!passwordValidation.isValid) {
          onError?.(passwordValidation.errors.join('. '), null);
          setIsLoading(false);
          return;
        }
      }

      let result;
      
      if (isLogin) {
        result = await authHelpers.signIn(formData.email, formData.password);
        onSuccess?.('Has iniciado sesión correctamente', result);
      } else if (isRegister) {
        result = await authHelpers.signUp(formData.email, formData.password, formData.name);
        onSuccess?.('Cuenta creada correctamente. Revisa tu email para confirmar tu cuenta.', result);
      }
    } catch (error) {
      let errorMessage = 'Ha ocurrido un error inesperado';
      
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Email o contraseña incorrectos';
      } else if (error.message.includes('User already registered')) {
        errorMessage = 'Este email ya está registrado. Intenta iniciar sesión.';
      } else if (error.message.includes('Password should be at least')) {
        errorMessage = 'La contraseña no cumple con los requisitos de seguridad';
      } else if (error.message.includes('Invalid email')) {
        errorMessage = 'Email inválido';
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
    
    // For registration, use robust password validation
    if (isRegister) {
      return isPasswordValid && formData.password.length >= 8;
    }
    
    // For login, minimum length check
    if (formData.password.length < 6) return false;
    
    return true;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
      </div>

      {/* Password field */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Contraseña
        </label>
        {isRegister ? (
          <PasswordInput
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            onValidationChange={setIsPasswordValid}
            placeholder="Mínimo 8 caracteres"
            required
          />
        ) : (
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Tu contraseña"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              )}
            </button>
          </div>
        )}
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
              Procesando...
            </div>
          ) : (
            isLogin ? 'Iniciar sesión' : 'Crear cuenta'
          )}
        </button>
      </div>

      {/* Additional links */}
      {isLogin && (
        <div className="text-center">
          <a 
            href="/reset-password" 
            className="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>
      )}

      {/* Magic link toggle */}
      {onToggleMethod && (
        <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onToggleMethod}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200"
          >
            ¿Prefieres {isLogin ? 'iniciar sesión' : 'registrarte'} con un enlace mágico?
          </button>
        </div>
      )}
    </form>
  );
};

export default AuthForm;