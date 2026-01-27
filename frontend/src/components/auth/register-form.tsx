import * as React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthForm } from '@/components/auth/auth-form';
import { EmailInput } from '@/components/auth/email-input';
import { PasswordInput } from '@/components/auth/password-input';
import { AuthButton } from '@/components/auth/auth-button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { setTokens } from '@/lib/auth/tokenStorage';

/**
 * Auth Error Messages (Backend v2 taxonomy)
 * Mapea error slugs del backend a mensajes UX claros
 * 
 * Contrato: Backend devuelve { success: false, error: { slug: 'AUTH_*', retryable: boolean } }
 */
const authErrorMessages: Record<string, string> = {
  // Auth errors
  'AUTH_INVALID_CREDENTIALS': 'El email o la contraseña no son correctos',
  'AUTH_EMAIL_NOT_CONFIRMED': 'Por favor verifica tu email antes de iniciar sesión',
  'AUTH_ACCOUNT_LOCKED': 'Cuenta bloqueada temporalmente. Intenta más tarde',
  'AUTH_DISABLED': 'El registro está temporalmente deshabilitado. Intenta más tarde',
  'AUTH_EMAIL_DISABLED': 'El registro por email está deshabilitado',
  'AUTH_EMAIL_PROVIDER_ERROR': 'Error al enviar el email. Intenta más tarde',
  'AUTH_EMAIL_RATE_LIMITED': 'Demasiadas solicitudes de email. Intenta más tarde',
  'AUTH_EMAIL_SEND_FAILED': 'No se pudo enviar el email. Inténtalo de nuevo',
  'AUTH_UNKNOWN': 'No se pudo crear la cuenta. Inténtalo de nuevo',
  
  // Account errors - Generic messages to prevent enumeration
  'ACCOUNT_EMAIL_ALREADY_EXISTS': 'No se pudo completar el registro. Inténtalo de nuevo',
  'ACCOUNT_NOT_FOUND': 'No se pudo completar el registro. Inténtalo de nuevo',
  'ACCOUNT_SUSPENDED': 'No se pudo completar el registro. Inténtalo de nuevo',
  'ACCOUNT_BANNED': 'No se pudo completar el registro. Inténtalo de nuevo',
  'ACCOUNT_DELETED': 'No se pudo completar el registro. Inténtalo de nuevo',
  'ACCOUNT_BLOCKED': 'No se pudo completar el registro. Inténtalo de nuevo',
  
  // Policy errors
  'POLICY_RATE_LIMITED': 'Demasiados intentos. Intenta en 15 minutos',
  'POLICY_ABUSE_DETECTED': 'Actividad sospechosa detectada. Contacta a soporte',
  'POLICY_BLOCKED': 'Acción bloqueada por políticas de seguridad',
  'POLICY_INVALID_REQUEST': 'Solicitud inválida. Verifica los datos e inténtalo de nuevo',
  'POLICY_NOT_FOUND': 'Recurso no encontrado',
  
  // Legacy fallbacks (por si acaso)
  'AUTH_EMAIL_TAKEN': 'No se pudo completar el registro. Inténtalo de nuevo',
  'AUTH_INVALID_EMAIL': 'Email inválido',
  'AUTH_WEAK_PASSWORD': 'La contraseña es muy débil',
  'AUTH_RATE_LIMIT_EXCEEDED': 'Demasiados intentos. Intenta más tarde',
  'AUTH_TERMS_NOT_ACCEPTED': 'Debes aceptar los términos y condiciones',
  'REGISTER_FAILED': 'No se pudo crear la cuenta. Inténtalo de nuevo'
};

/**
 * Obtiene mensaje de error UX a partir del error slug del backend
 * NUNCA expone detalles técnicos al usuario
 */
function getErrorMessage(errorSlug: string | undefined): string {
  if (!errorSlug) {
    return 'No se pudo crear la cuenta. Inténtalo de nuevo';
  }
  return authErrorMessages[errorSlug] || 'No se pudo crear la cuenta. Inténtalo de nuevo';
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

  // Validate email - delegate TLD validation to backend
  const validateEmail = (email: string): string => {
    if (!email) return 'El email es requerido';
    
    // Validación de formato básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'El email no es válido';
    
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

  // Handle onChange validation (reactive validation)
  const handleChange = (field: 'email' | 'password' | 'confirmPassword', value: string) => {
    // Update form data
    setFormData(prev => ({ ...prev, [field]: value }));

    // Validate immediately for email (P0 requirement: onChange validation)
    if (field === 'email') {
      const emailError = validateEmail(value);
      setFieldErrors(prev => ({ ...prev, email: emailError }));
    }

    // Validate confirmPassword reactively when it changes OR when password changes
    if (field === 'confirmPassword') {
      const confirmError = validateConfirmPassword(value, formData.password);
      setFieldErrors(prev => ({ ...prev, confirmPassword: confirmError }));
    }

    // If password changes, re-validate confirmPassword if it has content
    if (field === 'password' && formData.confirmPassword) {
      const confirmError = validateConfirmPassword(formData.confirmPassword, value);
      setFieldErrors(prev => ({ ...prev, confirmPassword: confirmError }));
    }

    // Clear general error when user fixes issues
    if (error === 'Por favor corrige los errores en el formulario') {
      setError(null);
    }
  };

  // Handle field blur validation
  const handleBlur = (field: 'email' | 'password' | 'confirmPassword') => {
    let errorMsg = '';
    switch (field) {
      case 'email':
        errorMsg = validateEmail(formData.email);
        break;
      case 'password':
        errorMsg = validatePassword(formData.password);
        break;
      case 'confirmPassword':
        errorMsg = validateConfirmPassword(formData.confirmPassword, formData.password);
        break;
    }
    setFieldErrors(prev => ({ ...prev, [field]: errorMsg }));
  };

  // Check if form is valid (for submit button)
  const isFormValid = React.useMemo(() => {
    return (
      formData.email &&
      !fieldErrors.email &&
      formData.password &&
      !fieldErrors.password &&
      formData.confirmPassword &&
      !fieldErrors.confirmPassword &&
      formData.termsAccepted
    );
  }, [formData, fieldErrors]);

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
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const endpoint = apiUrl ? `${apiUrl}/v2/auth/register` : '/api/v2/auth/register';
      
      const response = await fetch(endpoint, {
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

      // Parse response body
      const data = await response.json().catch(() => ({}));
      
      // Handle non-2xx responses
      if (!response.ok) {
        // Extract error slug from backend v2 response
        const errorSlug = data?.error?.slug || data?.error_code || 'AUTH_UNKNOWN';
        
        // Log only non-sensitive identifiers
        console.error('Register failed:', {
          status: response.status,
          errorSlug
        });
        
        // Mostrar mensaje UX claro
        setError(getErrorMessage(errorSlug));
        setIsLoading(false);
        return;
      }

      // Success path - log only generic success message
      console.log('Register succeeded');

      // Save tokens using tokenStorage
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
      // Network error or JSON parse error (real connection issues)
      console.error('Register network error');
      setError('Error de conexión. Verifica tu internet e inténtalo de nuevo');
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
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              />
              {fieldErrors.email && (
                <p id="email-error" className="text-sm text-destructive" role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <PasswordInput
                id="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : 'password-requirements'}
              />
              {fieldErrors.password && (
                <p id="password-error" className="text-sm text-destructive" role="alert">
                  {fieldErrors.password}
                </p>
              )}
              {/* Password requirements hint */}
              <div id="password-requirements" className="text-xs text-muted-foreground space-y-1">
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
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
                placeholder="Confirma tu contraseña"
              />
              {fieldErrors.confirmPassword && (
                <p id="confirm-password-error" className="text-sm text-destructive" role="alert">
                  {fieldErrors.confirmPassword}
                </p>
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

            {/* Submit Button - disabled if form invalid */}
            <AuthButton 
              type="submit" 
              className="w-full" 
              loading={isLoading}
              disabled={isLoading || !isFormValid}
            >
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

