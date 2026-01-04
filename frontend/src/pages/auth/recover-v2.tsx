/**
 * Password Recovery Request Page Component v2
 *
 * Modern password recovery request page aligned with backend v2 contract.
 * Users can request a password recovery email.
 * Uses shadcn/ui components with proper error handling and accessibility.
 *
 * Issue: ROA-380 - B2 Password Recovery Frontend UI (shadcn)
 * Issue: B3 - Password Recovery Analytics (B3-compliant events)
 * Contract: POST /api/v2/auth/password-recovery
 * Scope: ONLY request password recovery (no reset, no token handling)
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
// @ts-expect-error - auth.js is not typed
import { requestPasswordRecoveryV2 } from '@/lib/api/auth';

// Feature flag hook
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

// B3: Import password recovery analytics events
import {
  trackPasswordRecoveryRequested,
  trackPasswordRecoveryFailed
} from '@/lib/password-recovery-events';

// Form validation schema
const recoverySchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Formato de email inválido'),
});

type RecoveryFormData = z.infer<typeof recoverySchema>;

/**
 * RecoverPageV2 Component
 *
 * Features:
 * - Email input for password recovery request with validation
 * - Simple error handling (generic error message only)
 * - Loading states with disabled inputs
 * - Accessibility (labels, aria-invalid, focus management)
 * - Success state with anti-enumeration message
 * - B3: Password recovery analytics events (NO PII)
 * 
 * Scope: ONLY request password recovery. No reset, no token handling.
 */
export default function RecoverPageV2() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState('');

  // Check feature flag
  const isFeatureEnabled = useFeatureFlag('ENABLE_PASSWORD_RECOVERY_V2');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecoveryFormData>({
    resolver: zodResolver(recoverySchema),
  });

  /**
   * Handle form submission
   * POST to /api/v2/auth/password-recovery
   * Generic error handling only - no error_code interpretation
   * B3: Tracks password_recovery_requested and password_recovery_failed events
   */
  const onSubmit = async (data: RecoveryFormData) => {
    setIsSubmitting(true);
    setHasError(false);
    setSuccess(false);

    // B3: Track password recovery requested
    trackPasswordRecoveryRequested(isFeatureEnabled);

    try {
      const response = await requestPasswordRecoveryV2(data.email);
      
      // Backend always returns success with anti-enumeration message
      if (response.success) {
        setEmailSent(data.email);
        setSuccess(true);
      } else {
        // Should not happen, but handle just in case
        setHasError(true);
        
        // B3: Track failure
        trackPasswordRecoveryFailed(isFeatureEnabled, 'Response not success');
      }
    } catch (error) {
      // Generic error handling - no error_code interpretation
      setHasError(true);
      
      // B3: Track failure (normalize error message)
      const errorMessage = error instanceof Error ? error.message : 'Network or exception error';
      trackPasswordRecoveryFailed(isFeatureEnabled, errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Feature flag disabled
  if (!isFeatureEnabled) {
    return (
      <AuthLayout
        title="No Disponible"
        description="Esta funcionalidad no está disponible en este momento"
      >
        <Card>
          <CardHeader>
            <CardTitle>Recuperación de Contraseña No Disponible</CardTitle>
            <CardDescription>Esta funcionalidad está temporalmente deshabilitada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                La recuperación de contraseña no está disponible en este momento.
                Por favor, contacta al soporte si necesitas ayuda para acceder a tu cuenta.
              </AlertDescription>
            </Alert>
            <Button asChild className="w-full">
              <Link to="/login">Volver al inicio de sesión</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

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

            {/* Generic Error Display */}
            {hasError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription role="alert">
                  No hemos podido procesar la solicitud en este momento. Inténtalo más tarde.
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
