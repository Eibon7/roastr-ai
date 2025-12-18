# Auth UI Base Components

Componentes base reutilizables para flujos de autenticación construidos sobre shadcn/ui.

## Componentes Disponibles

### PasswordInput

Input de contraseña con toggle de visibilidad.

```tsx
import { PasswordInput } from '@/components/auth';

<PasswordInput
  id="password"
  placeholder="Enter your password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  showToggle={true} // default: true
/>
```

### EmailInput

Input de email con validación visual.

```tsx
import { EmailInput } from '@/components/auth';

<EmailInput
  id="email"
  placeholder="tu@email.com"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  hasError={!!emailError}
/>
```

### AuthButton

Botón especializado para acciones de autenticación con loading state.

```tsx
import { AuthButton } from '@/components/auth';

<AuthButton
  type="submit"
  loading={isSubmitting}
  loadingText="Iniciando sesión..."
>
  Iniciar Sesión
</AuthButton>
```

### AuthForm

Formulario base para autenticación con manejo de errores.

```tsx
import { AuthForm, EmailInput, PasswordInput, AuthButton } from '@/components/auth';

<AuthForm
  onSubmit={handleSubmit}
  error={error}
  loading={isLoading}
>
  <div className="space-y-4">
    <EmailInput ... />
    <PasswordInput ... />
    <AuthButton type="submit" loading={isLoading}>
      Iniciar Sesión
    </AuthButton>
  </div>
</AuthForm>
```

### MagicLinkForm

Formulario completo para magic links.

```tsx
import { MagicLinkForm } from '@/components/auth';

<MagicLinkForm
  email={email}
  onEmailChange={setEmail}
  onSubmit={handleSubmit}
  loading={isLoading}
  error={error}
  successMessage={successMessage}
  emailLabel="Email"
  emailPlaceholder="tu@email.com"
  buttonText="Enviar enlace mágico"
/>
```

## Ejemplo Completo: Login Page

```tsx
import { useState } from 'react';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AuthForm, EmailInput, PasswordInput, AuthButton } from '@/components/auth';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Iniciar Sesión">
      <Card>
        <CardHeader>
          <CardTitle>Iniciar Sesión</CardTitle>
          <CardDescription>Ingresa tu email y contraseña</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm onSubmit={handleSubmit} error={error} loading={loading}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <EmailInput
                id="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                hasError={!!error}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <AuthButton type="submit" loading={loading} loadingText="Iniciando sesión...">
              Iniciar Sesión
            </AuthButton>
          </AuthForm>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
```

## Características

- ✅ Construidos sobre shadcn/ui
- ✅ Soporte para tema claro/oscuro/sistema
- ✅ Accesibilidad (a11y) integrada
- ✅ TypeScript con tipos completos
- ✅ Tests unitarios incluidos
- ✅ Consistentes con el design system de Roastr.ai

