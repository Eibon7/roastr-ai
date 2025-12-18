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

## Decisiones de Diseño

### Input Genérico

**Decisión:** No se expone un componente `AuthInput` genérico por separado.

**Razón:** Los componentes especializados (`EmailInput`, `PasswordInput`) son suficientes para los casos de uso de autenticación. Cada uno tiene atributos específicos (autoComplete, tipo, toggle de visibilidad) que serían difíciles de unificar en un componente genérico sin perder funcionalidad o añadir complejidad innecesaria.

**Uso:** Para casos específicos de autenticación, usa `EmailInput` o `PasswordInput`. Para otros casos de uso fuera de auth, usa directamente `<Input />` de shadcn/ui.

### Error Display (AuthError)

**Decisión:** El display de errores está integrado en `AuthForm`, no es un componente standalone.

**Razón:** Los errores de autenticación son siempre contextuales al formulario completo, no a campos individuales. Integrarlo en `AuthForm` proporciona una estructura consistente y simplifica el uso.

**Uso:** Para mostrar errores en formularios de autenticación:
```tsx
<AuthForm error={errorMessage} onSubmit={handleSubmit}>
  {/* campos del formulario */}
</AuthForm>
```

Para errores de campos individuales, usa `hasError` prop en `EmailInput` y `PasswordInput`.

### Accesibilidad

Todos los componentes implementan:
- `aria-invalid` en inputs cuando hay error (WCAG 2.1)
- `role="alert"` en mensajes de error
- Labels asociados correctamente con inputs
- Navegación por teclado completa
- Estados de focus visibles

## Visual Validation (DEV)

Los componentes han sido verificados visualmente en un entorno de preview local
(`/dev/auth-ui-preview`) para confirmar:

- ✅ Uso exclusivo de shadcn/ui (Input, Button, Label, Card)
- ✅ Estados de error correctos (border-destructive, aria-invalid)
- ✅ Estados de loading correctos (spinner Loader2, disabled state)
- ✅ Estados de focus visibles (keyboard navigation)
- ✅ Labels correctamente asociados (htmlFor/id)
- ✅ Sin CSS custom ni HTML nativo
- ✅ Funcionamiento correcto en light/dark/system theme

**Nota:** Esta ruta es solo para desarrollo (`/dev/auth-ui-preview`) y no forma parte del producto final. 
Solo está disponible cuando `import.meta.env.DEV === true`.

Para acceder al preview:
```bash
cd frontend
npm run dev
# Navega a: http://localhost:5173/dev/auth-ui-preview
```

