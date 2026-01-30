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
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
// @ts-expect-error - client.js is a JS module without types
import apiClient from '@/lib/api/client';
import { setTokens } from '@/lib/auth/tokenStorage';

// Form validation schema - delegate TLD validation to backend
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('El email no es válido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Error code to user message mapping
 * Mapea error slugs del backend v2 a mensajes UX claros
 * Backend contract: { success: false, error: { slug: 'AUTH_*', retryable: boolean } }
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Auth errors
  'AUTH_INVALID_CREDENTIALS': 'El email o la contraseña no son correctos',
  'AUTH_EMAIL_NOT_FOUND': 'El email o la contraseña no son correctos', // Anti-enumeration
  'AUTH_PASSWORD_INCORRECT': 'El email o la contraseña no son correctos', // Anti-enumeration
  'AUTH_EMAIL_NOT_CONFIRMED': 'Por favor verifica tu email antes de iniciar sesión',
  'AUTH_ACCOUNT_LOCKED': 'Cuenta bloqueada temporalmente debido a múltiples intentos fallidos',
  'AUTH_DISABLED': 'Login no disponible temporalmente',
  
  // Account errors
  'ACCOUNT_NOT_FOUND': 'El email o la contraseña no son correctos', // Anti-enumeration
  'ACCOUNT_SUSPENDED': 'Cuenta suspendida. Por favor contacta a soporte',
  'ACCOUNT_BANNED': 'Cuenta bloqueada. Por favor contacta a soporte',
  'ACCOUNT_DELETED': 'Cuenta eliminada',
  'ACCOUNT_BLOCKED': 'Cuenta bloqueada. Contacta a soporte',
  
  // Policy errors
  'POLICY_RATE_LIMITED': 'Demasiados intentos de inicio de sesión. Intenta más tarde',
  'POLICY_ABUSE_DETECTED': 'Actividad sospechosa detectada. Contacta a soporte',
  'POLICY_BLOCKED': 'Acción bloqueada por políticas de seguridad',
  'POLICY_INVALID_REQUEST': 'Solicitud inválida. Verifica los datos',
  
  // Service errors
  'AUTH_SERVICE_UNAVAILABLE': 'Servicio de autenticación temporalmente no disponible',
  'AUTH_UNKNOWN': 'Algo ha fallado. Inténtalo más tarde',
  
  // Network errors
  'NETWORK_ERROR': 'Error de conexión. Verifica tu internet e inténtalo de nuevo',
  'AUTH_SESSION_EXPIRED': 'Tu sesión ha expirado. Por favor inicia sesión de nuevo',
  'AUTH_FORBIDDEN': 'No tienes permiso para realizar esta acción',
  
  // Legacy fallbacks
  'AUTH_TOO_MANY_LOGIN_ATTEMPTS': 'Demasiados intentos de inicio de sesión. Intenta más tarde',
  'AUTH_RATE_LIMIT_EXCEEDED': 'Demasiadas solicitudes. Intenta más tarde',
  'AUTH_EMAIL_NOT_VERIFIED': 'Por favor verifica tu dirección de email',
};

/**
 * Get user-friendly error message from error slug
 * NUNCA expone detalles técnicos al usuario
 * Exported for testing purposes
 */
export function getErrorMessage(errorSlug: string | undefined): string {
  if (!errorSlug) {
    return ERROR_MESSAGES.AUTH_UNKNOWN;
  }
  return ERROR_MESSAGES[errorSlug] || ERROR_MESSAGES.AUTH_UNKNOWN;
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

    // #region agent log
    if (process.env.NODE_ENV === 'development') {
      try { fetch('http://127.0.0.1:7242/ingest/a097a380-d709-4058-88f6-38ea3b24d552',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login-v2.tsx:126',message:'Login attempt started',data:{email:data.email,hasPassword:!!data.password},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B,C,F'})}).catch(()=>{}); } catch { /* ignore */ }
    }
    // #endregion

    try {
      // Use centralized apiClient for CSRF, mock mode, and interceptors
      const responseData = await apiClient.post('/v2/auth/login', {
        email: data.email,
        password: data.password
      });

      // #region agent log
      if (process.env.NODE_ENV === 'development') {
        try { fetch('http://127.0.0.1:7242/ingest/a097a380-d709-4058-88f6-38ea3b24d552',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login-v2.tsx:133',message:'Login API success',data:{hasSession:!!responseData.session,hasAccessToken:!!responseData.session?.access_token,responseKeys:Object.keys(responseData||{})},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{}); } catch { /* ignore */ }
      }
      // #endregion

      // Success path - log only generic success message
      console.log('Login succeeded');
      
      // Save tokens securely if present
      if (responseData.session?.access_token && responseData.session?.refresh_token) {
        setTokens(responseData.session.access_token, responseData.session.refresh_token);
      }
      
      // Redirect on success
      navigate(from, { replace: true });
    } catch (error: any) {
      // #region agent log
      if (process.env.NODE_ENV === 'development') {
        try { fetch('http://127.0.0.1:7242/ingest/a097a380-d709-4058-88f6-38ea3b24d552',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login-v2.tsx:148',message:'Login API error caught',data:{errorType:typeof error,hasError:!!error,hasErrorProp:'error' in error,hasStatusProp:'status' in error,errorKeys:error?Object.keys(error):[],errorSlugPath1:error?.error?.slug,errorSlugPath2:error?.error_code,errorSlugPath3:error?.response?.data?.error?.slug,errorMessage:error?.message,fullError:JSON.stringify(error).substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B,C,F'})}).catch(()=>{}); } catch { /* ignore */ }
      }
      // #endregion
      
      // Extract error slug from apiClient error
      const errorSlug = error?.error?.slug || error?.error_code || error?.response?.data?.error?.slug || 'AUTH_UNKNOWN';
      
      // #region agent log
      if (process.env.NODE_ENV === 'development') {
        try { fetch('http://127.0.0.1:7242/ingest/a097a380-d709-4058-88f6-38ea3b24d552',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login-v2.tsx:152',message:'Extracted error slug',data:{errorSlug,willShowMessage:getErrorMessage(errorSlug)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{}); } catch { /* ignore */ }
      }
      // #endregion
      
      // Log only non-sensitive identifiers
      console.error('Login failed:', { errorSlug });
      
      // Show UX error message
      setErrorCode(errorSlug);
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
              <PasswordInput
                id="password"
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

            {/* Register CTA */}
            <div className="text-sm text-center text-muted-foreground">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="font-medium text-primary hover:underline">
                Crear cuenta
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
