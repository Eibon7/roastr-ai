/**
 * Login Page Component
 *
 * Authentication page that allows users to log in with email/password
 * or use demo mode for testing without backend.
 *
 * V2-ready: This tracking implementation serves as an example for the Auth: Login flow.
 * It will be refined within the full Auth flow migration.
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { Loader2, Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

/**
 * LoginPage Component
 *
 * Provides:
 * - Email/password authentication form
 * - Demo mode for testing without backend
 * - Error handling and loading states
 * - Automatic redirect if already authenticated
 * - Redirect to originally requested page after login
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/app';

  if (isAuthenticated) {
    navigate(from, { replace: true });
    return null;
  }

  /**
   * Handles form submission for email/password login
   *
   * @param e - Form submission event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      
      // Track successful login (V2 convention: snake_case + helper)
      trackEvent('auth_login_success', {
        method: 'email_password',
        redirect_to: from
      }, {
        flow: 'auth'
      });
      
      // Redirect to the page user was trying to access, or /app
      navigate(from, { replace: true });
    } catch (err) {
      // Track failed login attempt (V2 convention: snake_case + helper)
      trackEvent('auth_login_failed', {
        method: 'email_password',
        error: err instanceof Error ? err.message : 'Unknown error'
      }, {
        flow: 'auth'
      });
      
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles demo mode login (no backend required)
   *
   * Creates a demo admin user in localStorage and redirects to admin dashboard.
   * Useful for testing UI without backend infrastructure.
   */
  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      // Simular login demo sin backend
      const demoUser = {
        id: 'demo-1',
        email: 'admin@demo.roastr.ai',
        name: 'Admin Demo',
        is_admin: true,
        organization_id: 'demo-org-1',
        plan: 'plus'
      };

      // Guardar en localStorage como si fuera un login real
      localStorage.setItem('auth_token', 'demo-token-' + Date.now());
      localStorage.setItem('user', JSON.stringify(demoUser));

      // Simular delay de red
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Track demo login (V2 convention: snake_case + helper)
      trackEvent('auth_login_success', {
        method: 'demo_mode',
        user_type: 'demo_admin',
        redirect_to: '/admin/dashboard'
      }, {
        flow: 'auth'
      });

      // Forzar recarga para que el AuthContext detecte el usuario
      window.location.href = '/admin/dashboard';
    } catch {
      setError('Error al iniciar sesión en modo demo');
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Iniciar Sesión" description="Ingresa a tu cuenta de Roastr.ai">
      <Card>
        <CardHeader>
          <CardTitle>Iniciar Sesión</CardTitle>
          <CardDescription>Ingresa tu email y contraseña para acceder a tu cuenta</CardDescription>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">O</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleDemoLogin}
              disabled={loading}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Modo Demo (Sin Backend)
            </Button>

            <div className="text-center text-sm">
              <Link to="/recover" className="text-primary hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
