/**
 * Password Recovery Page Component v2
 *
 * Modern password recovery page aligned with backend v2 contract.
 * Uses shadcn/ui components with proper error handling and accessibility.
 *
 * Issue: ROA-380 - B2 Password Recovery Frontend UI (shadcn)
 * Contract: POST /api/v2/auth/password-recovery
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
// @ts-ignore - auth.js is not typed
import { requestPasswordRecoveryV2 } from '@/lib/api/auth';

// Form validation schema
const recoverySchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Formato de email inválido'),
});

type RecoveryFormData = z.infer<typeof recoverySchema>;

/**
 * Error code to user message mapping
 * Only shows messages based on error_code from backend, never raw messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  POLICY_INVALID_REQUEST: 'Por favor ingresa un email válido',
  POLICY_RATE_LIMITED: 'Demasiados intentos. Por favor espera antes de intentar nuevamente',
  AUTH_EMAIL_DISABLED: 'La recuperación de contraseña no está disponible temporalmente',
  AUTH_DISABLED: 'La recuperación de contraseña no está disponible temporalmente',
  AUTH_EMAIL_SEND_FAILED: 'Error al enviar el email. Por favor intenta más tarde',
  AUTH_EMAIL_PROVIDER_ERROR: 'Error del proveedor de email. Por favor intenta más tarde',
  AUTH_UNKNOWN: 'Algo ha fallado. Inténtalo más tarde',
};

/**
 * Get user-friendly error message from error_code
 * Exported for testing purposes
 */
export function getErrorMessage(errorCode: string | undefined): string {
  if (!errorCode) {
    return ERROR_MESSAGES.AUTH_UNKNOWN;
  }
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.AUTH_UNKNOWN;
}

/**
 * RecoverPageV2 Component
 *
 * Features:
 * - Email input for password recovery with validation
 * - Contract-first error handling (error_code based)
 * - Loading states with disabled inputs
 * - Accessibility (labels, aria-invalid, focus management)
 * - Success state with anti-enumeration message
 */
export default function RecoverPageV2() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecoveryFormData>({
    resolver: zodResolver(recoverySchema),
  });

  /**
   * Handle form submission
   * POST to /api/v2/auth/password-recovery with error_code handling
   */
  const onSubmit = async (data: RecoveryFormData) => {
    setIsSubmitting(true);
    setErrorCode(undefined);
    setSuccess(false);

    try {
      const response = await requestPasswordRecoveryV2(data.email);
      
      // Backend always returns success with anti-enumeration message
      if (response.success) {
        setEmailSent(data.email);
        setSuccess(true);
      } else {
        // Should not happen, but handle just in case
        throw new Error('Unexpected response format');
      }
    } catch (error: any) {
      // Extract error_code from backend response
      // The API client may throw Error, but we need to extract error.slug from response data
      // Try multiple error structures to be compatible with different error formats
      const code = 
        error?.error?.slug || 
        error?.response_data?.error?.slug || 
        error?.response?.data?.error?.slug ||
        error?.error_code;
      setErrorCode(code);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (success) {
    return (
      <AuthLayout
        title="Email Enviado"
        description="Revisa tu bandeja de entrada"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Email Enviado
            </CardTitle>
            <CardDescription>Revisa tu bandeja de entrada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-4 text-sm">
              <p className="mb-2">
                Si existe una cuenta asociada a <strong>{emailSent}</strong>, recibirás un enlace para
                restablecer tu contraseña.
              </p>
              <p className="text-muted-foreground">
                El enlace expirará en 1 hora. Si no recibes el email, verifica tu carpeta de spam.
              </p>
            </div>
            <Button asChild className="w-full">
              <Link to="/login">Volver al inicio de sesión</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Recuperar Contraseña"
      description="Solicita un enlace para restablecer tu contraseña"
    >
      <Card>
        <CardHeader>
          <CardTitle>Recuperar Contraseña</CardTitle>
          <CardDescription>
            Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña
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
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                  Enviar enlace de recuperación
                </>
              )}
            </Button>

            {/* Back to Login Link */}
            <div className="text-center text-sm">
              <Link
                to="/login"
                className="text-primary hover:underline"
                tabIndex={isSubmitting ? -1 : 0}
              >
                Volver al inicio de sesión
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

