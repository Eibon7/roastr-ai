import * as React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthForm } from '@/components/auth/auth-form';
import { EmailInput } from '@/components/auth/email-input';
import { PasswordInput } from '@/components/auth/password-input';
import { AuthButton } from '@/components/auth/auth-button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { setTokens } from '@/lib/auth/tokenStorage';

// Auth Error Messages (from authErrorTaxonomy)
const authErrorMessages: Record<string, string> = {
  'AUTH_EMAIL_TAKEN': 'Este email ya está registrado',
  'AUTH_INVALID_EMAIL': 'Email inválido',
  'AUTH_WEAK_PASSWORD': 'La contraseña es muy débil. Debe tener al menos 8 caracteres, una minúscula, una mayúscula y un número',
  'AUTH_RATE_LIMIT_EXCEEDED': 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo',
  'AUTH_TERMS_NOT_ACCEPTED': 'Debes aceptar los términos y condiciones',
  'REGISTER_FAILED': 'Error al registrar. Inténtalo de nuevo'
};

function getErrorMessage(errorCode: string): string {
  return authErrorMessages[errorCode] || 'Error al registrar. Inténtalo de nuevo';
}

export interface RegisterFormProps {
  /**
   * Callback when registration is successful
   */
  onSuccess?: (data: { user: any; session: any }) => void;
  /**
   * Optional custom error message
   */
  customError?: string | null;
}

/**
 * RegisterForm Component
 *
 * Complete registration form with validation
 */
export function RegisterForm({ onSuccess, customError }: RegisterFormProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(customError || null);
  
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false
  });

  const [fieldErrors, setFieldErrors] = React.useState({
    email: '',
    password: '',
    confirmPassword: '',
    terms: ''
  });

  // Validate email
  const validateEmail = (email: string): string => {
    if (!email) return 'El email es requerido';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Email inválido';
    return '';
  };

  // Validate password (match backend requirements from PR #979)
  const validatePassword = (password: string): string => {
    if (!password) return 'La contraseña es requerida';
    if (password.length < 8) return 'Mínimo 8 caracteres';
    if (!/[a-z]/.test(password)) return 'Debe incluir al menos una minúscula';
    if (!/[A-Z]/.test(password)) return 'Debe incluir al menos una mayúscula';
    if (!/[0-9]/.test(password)) return 'Debe incluir al menos un número';
    return '';
  };

  // Validate confirm password (required by ROA-375)
  const validateConfirmPassword = (confirmPassword: string, password: string): string => {
    if (!confirmPassword) return 'Debes confirmar tu contraseña';
    if (confirmPassword !== password) return 'Las contraseñas no coinciden';
    return '';
  };

  // Handle field blur validation
  const handleBlur = (field: 'email' | 'password' | 'confirmPassword') => {
    let error = '';
    switch (field) {
      case 'email':
        error = validateEmail(formData.email);
        break;
      case 'password':
        error = validatePassword(formData.password);
        break;
      case 'confirmPassword':
        error = validateConfirmPassword(formData.confirmPassword, formData.password);
        break;
    }
    setFieldErrors(prev => ({ ...prev, [field]: error }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate all fields
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    const confirmPasswordError = validateConfirmPassword(formData.confirmPassword, formData.password);
    const termsError = !formData.termsAccepted ? 'Debes aceptar los términos y condiciones' : '';

    setFieldErrors({
      email: emailError,
      password: passwordError,
      confirmPassword: confirmPasswordError,
      terms: termsError
    });

    // If any error, stop
    if (emailError || passwordError || confirmPasswordError || termsError) {
      setError('Por favor corrige los errores en el formulario');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/v2/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          terms_accepted: formData.termsAccepted
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorCode = data.error_code || 'REGISTER_FAILED';
        setError(getErrorMessage(errorCode));
        setIsLoading(false);
        return;
      }

      // Success - save tokens using tokenStorage
      if (data.session?.access_token && data.session?.refresh_token) {
        setTokens(data.session.access_token, data.session.refresh_token);
      }

      // Call success callback or redirect
      setIsLoading(false);
      if (onSuccess) {
        onSuccess(data);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Error de conexión. Inténtalo de nuevo');
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto" data-testid="register-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Crear cuenta</CardTitle>
        <CardDescription className="text-center">
          Ingresa tus datos para crear tu cuenta en Roastr.AI
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm onSubmit={handleSubmit} error={error} loading={isLoading}>
          <div className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <EmailInput
                id="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                onBlur={() => handleBlur('email')}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.email}
              />
              {fieldErrors.email && (
                <p className="text-sm text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <PasswordInput
                id="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                onBlur={() => handleBlur('password')}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.password}
              />
              {fieldErrors.password && (
                <p className="text-sm text-destructive">{fieldErrors.password}</p>
              )}
              {/* Password requirements hint */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>La contraseña debe contener:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li 
                    data-testid="requirement-length"
                    className={formData.password.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}
                  >
                    Mínimo 8 caracteres
                  </li>
                  <li 
                    data-testid="requirement-lowercase"
                    className={/[a-z]/.test(formData.password) ? 'text-green-600 dark:text-green-400' : ''}
                  >
                    Una letra minúscula
                  </li>
                  <li 
                    data-testid="requirement-uppercase"
                    className={/[A-Z]/.test(formData.password) ? 'text-green-600 dark:text-green-400' : ''}
                  >
                    Una letra mayúscula
                  </li>
                  <li 
                    data-testid="requirement-number"
                    className={/[0-9]/.test(formData.password) ? 'text-green-600 dark:text-green-400' : ''}
                  >
                    Un número
                  </li>
                </ul>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <PasswordInput
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                onBlur={() => handleBlur('confirmPassword')}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.confirmPassword}
                placeholder="Confirma tu contraseña"
              />
              {fieldErrors.confirmPassword && (
                <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={formData.termsAccepted}
                onCheckedChange={(checked) => {
                  setFormData(prev => ({ ...prev, termsAccepted: checked === true }));
                  setFieldErrors(prev => ({ ...prev, terms: '' }));
                }}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.terms}
              />
              <div className="space-y-1">
                <Label
                  htmlFor="terms"
                  className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Acepto los{' '}
                  <Link to="/terms" className="underline hover:text-primary" target="_blank">
                    términos y condiciones
                  </Link>
                  {' '}y la{' '}
                  <Link to="/privacy" className="underline hover:text-primary" target="_blank">
                    política de privacidad
                  </Link>
                </Label>
                {fieldErrors.terms && (
                  <p className="text-sm text-destructive">{fieldErrors.terms}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <AuthButton type="submit" className="w-full" loading={isLoading}>
              Crear cuenta
            </AuthButton>
          </div>
        </AuthForm>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-center text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="underline hover:text-primary font-medium">
            Inicia sesión
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}

