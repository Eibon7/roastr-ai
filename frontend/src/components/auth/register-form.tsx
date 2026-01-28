import * as React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { setTokens } from '@/lib/auth/tokenStorage';
// @ts-expect-error - client.js is a JS module without types
import apiClient from '@/lib/api/client';

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
  
  // Network errors
  'NETWORK_ERROR': 'Error de conexión. Verifica tu internet e inténtalo de nuevo',
  'AUTH_SESSION_EXPIRED': 'Tu sesión ha expirado. Por favor inicia sesión de nuevo',
  'AUTH_FORBIDDEN': 'No tienes permiso para realizar esta acción',
  
  // Legacy fallbacks
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

/**
 * Zod schema for registration form
 * Validates email format, password requirements, and terms acceptance
 * Password rules match backend: min 8, lowercase, digit, no whitespace, uppercase OR symbol
 */
const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('El email no es válido'),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[a-z]/, 'Debe incluir al menos una minúscula')
    .regex(/[0-9]/, 'Debe incluir al menos un número')
    .regex(/^\S*$/, 'No debe contener espacios')
    .refine(
      (val) => /[A-Z]/.test(val) || /[^A-Za-z0-9\s]/.test(val),
      'Debe incluir al menos una mayúscula o un símbolo'
    ),
  confirmPassword: z
    .string()
    .min(1, 'Debes confirmar tu contraseña'),
  termsAccepted: z
    .boolean()
    .refine((val) => val === true, 'Debes aceptar los términos y condiciones')
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword']
});

type RegisterFormData = z.infer<typeof registerSchema>;

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
 * Complete registration form with react-hook-form + Zod validation
 * Uses centralized apiClient for CSRF, mock mode, and interceptors
 */
export function RegisterForm({ onSuccess, customError }: RegisterFormProps) {
  const navigate = useNavigate();
  const [backendError, setBackendError] = React.useState<string | null>(customError || null);
  
  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      termsAccepted: false
    }
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- watch() is safe for UI feedback only
  const password = watch('password');

  /**
   * Handle form submission with apiClient
   */
  const onSubmit = async (data: RegisterFormData) => {
    setBackendError(null);

    try {
      // Use centralized apiClient for CSRF, mock mode, and interceptors
      const responseData = await apiClient.post('/v2/auth/register', {
        email: data.email,
        password: data.password,
        terms_accepted: data.termsAccepted
      });

      // Success path - log only generic success message
      console.log('Register succeeded');

      // Save tokens using tokenStorage
      if (responseData.session?.access_token && responseData.session?.refresh_token) {
        setTokens(responseData.session.access_token, responseData.session.refresh_token);
      }

      // Call success callback or redirect
      if (onSuccess) {
        onSuccess(responseData);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      // Extract error slug from apiClient error
      const errorSlug = err?.error?.slug || err?.error_code || err?.response?.data?.error?.slug || 'AUTH_UNKNOWN';
      
      // Log only non-sensitive identifiers
      console.error('Register failed:', { errorSlug });
      
      // Show UX error message
      setBackendError(getErrorMessage(errorSlug));
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" className="text-sm text-destructive" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : 'password-requirements'}
              {...register('password')}
            />
            {errors.password && (
              <p id="password-error" className="text-sm text-destructive" role="alert">
                {errors.password.message}
              </p>
            )}
            {/* Password requirements hint */}
            <div id="password-requirements" className="text-xs text-muted-foreground space-y-1">
              <p>La contraseña debe contener:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li 
                  data-testid="requirement-length"
                  className={password && password.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}
                >
                  Mínimo 8 caracteres
                </li>
                <li 
                  data-testid="requirement-lowercase"
                  className={password && /[a-z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}
                >
                  Una letra minúscula
                </li>
                <li 
                  data-testid="requirement-number"
                  className={password && /[0-9]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}
                >
                  Un número
                </li>
                <li 
                  data-testid="requirement-no-whitespace"
                  className={password && /^\S*$/.test(password) ? 'text-green-600 dark:text-green-400' : ''}
                >
                  Sin espacios
                </li>
                <li 
                  data-testid="requirement-uppercase-or-symbol"
                  className={password && (/[A-Z]/.test(password) || /[^A-Za-z0-9\s]/.test(password)) ? 'text-green-600 dark:text-green-400' : ''}
                >
                  Una letra mayúscula o un símbolo
                </li>
              </ul>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Confirma tu contraseña"
              disabled={isSubmitting}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p id="confirm-password-error" className="text-sm text-destructive" role="alert">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start space-x-2">
            <Controller
              name="termsAccepted"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="terms"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.termsAccepted}
                />
              )}
            />
            <div className="space-y-1">
              <Label
                htmlFor="terms"
                className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Acepto los{' '}
                <Link to="/terms" className="underline hover:text-primary" target="_blank" rel="noreferrer">
                  términos y condiciones
                </Link>
                {' '}y la{' '}
                <Link to="/privacy" className="underline hover:text-primary" target="_blank" rel="noreferrer">
                  política de privacidad
                </Link>
              </Label>
              {errors.termsAccepted && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.termsAccepted.message}
                </p>
              )}
            </div>
          </div>

          {/* Backend Error Display */}
          {backendError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription role="alert">
                {backendError}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Creando cuenta...
              </>
            ) : (
              'Crear cuenta'
            )}
          </Button>
        </form>
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
