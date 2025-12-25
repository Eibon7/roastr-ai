/**
 * Login Page Component v2
 *
 * Modern authentication page aligned with backend v2 contract.
 * Uses shadcn/ui components with proper error handling and accessibility.
 *
 * Issue: ROA-361 - B2. Login Frontend UI (shadcn)
 * Contract: POST /api/v2/auth/login
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';

// Form validation schema
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Formato de email inválido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Error code to user message mapping
 * Only shows messages based on error_code from backend, never raw messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'Email o contraseña incorrectos',
  AUTH_EMAIL_NOT_FOUND: 'Email o contraseña incorrectos', // Anti-enumeration
  AUTH_PASSWORD_INCORRECT: 'Email o contraseña incorrectos', // Anti-enumeration
  AUTH_ACCOUNT_LOCKED: 'Cuenta bloqueada temporalmente debido a múltiples intentos fallidos',
  AUTH_ACCOUNT_DISABLED: 'Cuenta deshabilitada. Por favor contacta a soporte',
  AUTH_EMAIL_NOT_VERIFIED: 'Por favor verifica tu dirección de email',
  AUTH_TOO_MANY_LOGIN_ATTEMPTS: 'Demasiados intentos de inicio de sesión. Intenta más tarde',
  AUTH_RATE_LIMIT_EXCEEDED: 'Demasiadas solicitudes. Intenta más tarde',
  AUTH_SERVICE_UNAVAILABLE: 'Servicio de autenticación temporalmente no disponible',
  AUTH_DISABLED: 'Login no disponible temporalmente',
  AUTH_UNKNOWN_ERROR: 'Algo ha fallado. Inténtalo más tarde',
};

/**
 * Get user-friendly error message from error_code
 */
function getErrorMessage(errorCode: string | undefined): string {
  if (!errorCode) {
    return ERROR_MESSAGES.AUTH_UNKNOWN_ERROR;
  }
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.AUTH_UNKNOWN_ERROR;
}

/**
 * LoginPageV2 Component
 *
 * Features:
 * - Email/password authentication form with validation
 * - Contract-first error handling (error_code based)
 * - Loading states with disabled inputs
 * - Accessibility (labels, aria-invalid, focus management)
 * - No backend logic duplication
 */
export default function LoginPageV2() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Redirect destination after login
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/app';

  /**
   * Handle form submission
   * POST to /api/v2/auth/login with error_code handling
   */
  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setErrorCode(undefined);

    try {
      // TODO: Replace with actual v2 API call when backend is ready
      // const response = await api.auth.loginV2(data.email, data.password);
      
      // Temporary mock for development
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Mock response based on credentials
      if (data.email === 'test@roastr.ai' && data.password === 'password') {
        // Success - redirect handled by auth context
        navigate(from, { replace: true });
      } else {
        // Mock error response
        throw {
          error_code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid credentials'
        };
      }
    } catch (error: any) {
      // Extract error_code from backend response
      const code = error?.error_code || error?.response?.data?.error_code;
      setErrorCode(code);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Iniciar Sesión v2" description="Accede a tu cuenta de Roastr.ai">
      <Card>
        <CardHeader>
          <CardTitle>Iniciar Sesión</CardTitle>
          <CardDescription>
            Ingresa tu email y contraseña para acceder a tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Email Field */}
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

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <Link
                  to="/recover"
                  className="text-sm text-muted-foreground hover:text-primary"
                  tabIndex={isSubmitting ? -1 : 0}
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                disabled={isSubmitting}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" className="text-sm text-destructive" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Backend Error Display */}
            {errorCode && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription role="alert">
                  {getErrorMessage(errorCode)}
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
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
