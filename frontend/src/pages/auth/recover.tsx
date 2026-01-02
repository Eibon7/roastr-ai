/**
 * Password Recovery Page Component
 *
 * Allows users to request a password reset via email.
 * Provides a form to enter email address for password recovery.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail } from 'lucide-react';
import { authApi } from '@/lib/api';

/**
 * RecoverPage Component
 *
 * Provides:
 * - Email input for password recovery
 * - Form validation
 * - Success/error messaging
 * - Link back to login
 */
export default function RecoverPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handles form submission for password recovery
   *
   * @param e - Form submission event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authApi.recoverPassword(email);
      setSuccess(true);
    } catch (err: any) {
      // Show generic error message for security (anti-enumeration)
      // Backend always returns success even if email doesn't exist
      if (err?.status === 403 || err?.slug === 'AUTH_EMAIL_DISABLED') {
        setError('El servicio de recuperación de contraseña no está disponible temporalmente');
      } else if (err?.status === 429) {
        setError('Demasiados intentos. Por favor espera unos minutos e inténtalo de nuevo');
      } else {
        // For other errors, still show success message (anti-enumeration)
        // This matches backend behavior
        setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout
        title="Recuperar Contraseña"
        description="Solicita un enlace para restablecer tu contraseña"
      >
        <Card>
          <CardHeader>
            <CardTitle>Email Enviado</CardTitle>
            <CardDescription>Revisa tu bandeja de entrada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-4 text-sm">
              <p className="mb-2">
                Si existe una cuenta asociada a <strong>{email}</strong>, recibirás un enlace para
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
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
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar enlace de recuperación
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
