/**
 * Password Reset Page Component
 *
 * Handles password reset after user clicks the recovery link in their email.
 * Extracts the reset token from URL query parameters and allows user to set a new password.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';
import { authApi } from '@/lib/api';

/**
 * ResetPasswordPage Component
 *
 * Provides:
 * - Token extraction from URL
 * - New password form with validation
 * - Password confirmation
 * - Success/error messaging
 * - Redirect to login after success
 */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Extract token from URL (Supabase redirects with access_token and type=recovery)
  const accessToken = searchParams.get('access_token');
  const type = searchParams.get('type');

  useEffect(() => {
    // Validate token presence
    if (!accessToken) {
      setTokenError('Token de recuperación no válido o faltante');
      return;
    }

    // Validate token type (should be 'recovery' for password reset)
    if (type && type !== 'recovery') {
      setTokenError('Tipo de token inválido');
      return;
    }
  }, [accessToken, type]);

  /**
   * Validates password strength
   * Matches backend requirements: minimum 8 characters
   */
  const validatePassword = (pwd: string): string | null => {
    if (!pwd) return 'La contraseña es requerida';
    if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    return null;
  };

  /**
   * Handles form submission for password reset
   *
   * @param e - Form submission event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (!accessToken) {
      setError('Token de recuperación no válido');
      return;
    }

    setLoading(true);

    try {
      // Call backend API to update password
      await authApi.updatePassword(accessToken, password);
      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      if (err?.status === 400) {
        setError(
          err?.message || 'El enlace de recuperación ha expirado. Por favor solicita uno nuevo.'
        );
      } else if (err?.status === 401) {
        setError('Token inválido o expirado. Por favor solicita un nuevo enlace de recuperación.');
      } else {
        setError('Error al actualizar la contraseña. Por favor inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Show error if token is missing or invalid
  if (tokenError || (!accessToken && !loading)) {
    return (
      <AuthLayout
        title="Recuperar Contraseña"
        description="Enlace de recuperación inválido"
      >
        <Card>
          <CardHeader>
            <CardTitle>Token Inválido</CardTitle>
            <CardDescription>El enlace de recuperación no es válido o ha expirado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive">
              {tokenError || 'El token de recuperación no es válido o ha expirado.'}
            </div>
            <Button asChild className="w-full">
              <Link to="/recover">Solicitar nuevo enlace de recuperación</Link>
            </Button>
            <div className="text-center text-sm">
              <Link to="/login" className="text-primary hover:underline">
                Volver al inicio de sesión
              </Link>
            </div>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  // Show success message
  if (success) {
    return (
      <AuthLayout
        title="Contraseña Actualizada"
        description="Tu contraseña ha sido actualizada exitosamente"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Contraseña Actualizada
            </CardTitle>
            <CardDescription>Tu contraseña ha sido actualizada correctamente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-800 dark:text-green-200">
              <p>Tu contraseña ha sido actualizada exitosamente.</p>
              <p className="mt-2">Serás redirigido al inicio de sesión en unos segundos...</p>
            </div>
            <Button asChild className="w-full">
              <Link to="/login">Ir al inicio de sesión</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Restablecer Contraseña"
      description="Ingresa tu nueva contraseña"
    >
      <Card>
        <CardHeader>
          <CardTitle>Restablecer Contraseña</CardTitle>
          <CardDescription>
            Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nueva Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirma tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Actualizar Contraseña
                </>
              )}
            </Button>

            <div className="text-center text-sm">
              <Link to="/login" className="text-primary hover:underline">
                Volver al inicio de sesión
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

