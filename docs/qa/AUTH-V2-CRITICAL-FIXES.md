# Auth v2 - Critical Fixes Summary

**Fecha:** 2026-01-30
**Status:** ✅ COMPLETADO - 2 BLOCKERS P0 RESUELTOS
**PR:** #1309

---

## 🚨 PROBLEMA 1: NO SE PODÍAN CREAR USUARIOS (BLOCKER P0)

### Síntoma

```
❌ "No se pudo crear la cuenta. Inténtalo de nuevo"
❌ Backend devolvía 500 AUTH_EMAIL_SEND_FAILED
❌ SIN REGISTROS = SIN PRODUCTO
```

### Causa Raíz

**Backend bloqueaba TODO el registro** si las variables de entorno de email no estaban configuradas:

```typescript
// apps/backend-v2/src/services/authEmailService.ts (línea 59-67)
function assertAuthEmailEnvOrThrow(): void {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new AuthError(AUTH_ERROR_CODES.AUTH_EMAIL_SEND_FAILED);
  }
}
```

Este check se ejecutaba **ANTES** de crear el usuario en Supabase, bloqueando completamente el registro.

### Fix Implementado

**Archivo:** `apps/backend-v2/src/services/authService.ts`

**Cambio:** Email infrastructure check ahora es **best-effort** (no bloqueante)

```typescript
// ANTES (BLOQUEANTE)
const { provider } = await assertAuthEmailInfrastructureEnabled('register', ...);
// Si falla → 500 error → NO se crea usuario

// DESPUÉS (BEST-EFFORT)
let emailInfraAvailable = false;
try {
  const { provider } = await assertAuthEmailInfrastructureEnabled('register', ...);
  emailInfraAvailable = true;
} catch (emailError) {
  // Email infra no disponible, pero NO bloquear registro
  logger.warn('auth.register.email_infrastructure_unavailable', {
    message: 'User will be created but email may not be sent'
  });
}

// Usuario SE CREA IGUAL (línea 142+)
const { data, error } = await supabase.auth.signUp({ ... });
```

### Impacto

| Antes | Después |
|-------|---------|
| ❌ Sin `RESEND_API_KEY` → 500 error | ✅ Sin `RESEND_API_KEY` → Usuario se crea |
| ❌ NO se crea usuario | ✅ Usuario creado, email no llega (esperado) |
| ❌ NO hay producto | ✅ HAY PRODUCTO (usuarios pueden registrarse) |

### Logs Generados

**Si email infra falla:**
```json
{
  "level": "warn",
  "message": "auth.register.email_infrastructure_unavailable",
  "email": "use***@domain.com",
  "error_slug": "AUTH_EMAIL_SEND_FAILED"
}

{
  "level": "warn",
  "message": "auth.register.user_created_without_email",
  "email": "use***@domain.com"
}
```

### Filosofía

**Email es NICE TO HAVE, no BLOCKER.**

- ✅ Usuario debe poder registrarse SIEMPRE
- ✅ Email de verificación es opcional
- ✅ Usuario puede ser verificado manualmente si es necesario
- ✅ Producto funcional incluso sin email configurado

---

## 🌓 PROBLEMA 2: TEMA NO AUTOMÁTICO (BLOCKER UX)

### Síntoma

```
❌ Sistema en dark mode → Register page en light mode
❌ "Me está deslumbrando (estoy a oscuras)"
```

### Causa Raíz

**Register page NO usaba AuthLayout** (a diferencia de login-v2):

```tsx
// frontend/src/pages/auth/register.tsx (ANTES)
export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <RegisterForm />
    </div>
  );
}
```

Problemas:
1. ❌ No usa `AuthLayout` (login-v2 sí lo usa)
2. ❌ `bg-background` requiere tema aplicado al HTML
3. ❌ Tema no se aplica hasta después del render inicial
4. ❌ Inconsistencia con login page

### Fix Implementado

**Archivos modificados:**
- `frontend/src/pages/auth/register.tsx`
- `frontend/src/components/auth/register-form.tsx`

**1. RegisterPage ahora usa AuthLayout:**

```tsx
// DESPUÉS
import { AuthLayout } from '@/components/layout/auth-layout';

export default function RegisterPage() {
  return (
    <AuthLayout 
      title="Roastr.ai" 
      description="Crea tu cuenta para empezar"
    >
      <RegisterForm />
    </AuthLayout>
  );
}
```

**2. RegisterForm simplificado (sin Card wrapper):**

```tsx
// ANTES
return (
  <Card className="w-full max-w-md mx-auto">
    <CardHeader>...</CardHeader>
    <CardContent>
      <form>...</form>
    </CardContent>
  </Card>
);

// DESPUÉS
return (
  <div className="space-y-4">
    <div className="text-center">
      <h2>Crear cuenta</h2>
      <p>Ingresa tus datos...</p>
    </div>
    <form>...</form>
  </div>
);
```

AuthLayout ya provee el Card wrapper (línea 30):
```tsx
<div className="bg-card rounded-lg border p-6 shadow-sm">
  {children}
</div>
```

### Impacto

| Antes | Después |
|-------|---------|
| ❌ Sistema dark → Register light | ✅ Sistema dark → Register dark |
| ❌ Sistema light → Register light | ✅ Sistema light → Register light |
| ❌ Inconsistente con login | ✅ Consistente con login |
| ❌ Usuario deslumbrado | ✅ Respeta preferencia del sistema |

### Cómo Funciona el Tema

**ThemeProvider en App.tsx:**
```tsx
<ThemeProvider 
  defaultTheme="system"        // ✅ Usa preferencia del sistema por defecto
  enableSystem                  // ✅ Habilita detección de prefers-color-scheme
  storageKey="roastr-theme"    // ✅ Persiste en localStorage
>
  {/* app */}
</ThemeProvider>
```

**AuthLayout aplica tema correctamente:**
```tsx
<div className="min-h-screen bg-background">
  {/* bg-background ahora respeta tema del HTML */}
</div>
```

**HTML con clase correcta:**
```html
<!-- Dark mode -->
<html class="dark">
  <body class="bg-background">  <!-- Se aplica dark theme -->

<!-- Light mode -->
<html class="light">
  <body class="bg-background">  <!-- Se aplica light theme -->
```

---

## 📊 Resumen de Cambios

### Commits

1. **Backend - Email best-effort (P0):**
   ```
   f309e13c - fix(auth-v2): CRITICAL - Allow user registration even if email fails
   ```

2. **Frontend - Theme fix (P0):**
   ```
   4ad045de - fix(theme): Register page now respects system theme preference
   ```

### Archivos Modificados

**Backend (1 archivo):**
- `apps/backend-v2/src/services/authService.ts` (+65, -41 líneas)

**Frontend (2 archivos):**
- `frontend/src/pages/auth/register.tsx` (+10, -8 líneas)
- `frontend/src/components/auth/register-form.tsx` (+10, -10 líneas)

---

## ✅ Validación

### Pre-Deploy Checklist

- [x] ✅ Backend: Email best-effort implementado
- [x] ✅ Backend: Logs de warning añadidos
- [x] ✅ Frontend: Register usa AuthLayout
- [x] ✅ Frontend: Imports limpiados
- [x] ✅ Commits pushed a branch
- [x] ✅ PR actualizada

### Post-Deploy Tests

**Test 1: Registro SIN email config**
```bash
# Precondición: RESEND_API_KEY no configurada en Railway

1. Ir a staging.roastr.ai/register
2. Crear cuenta con email + password válidos
3. Click "Crear cuenta"

Resultado esperado:
✅ Usuario SE CREA en Supabase
✅ Frontend: "Registro exitoso" o redirección
⚠️ Email NO llega (esperado)
⚠️ Logs backend: "email_infrastructure_unavailable"

Resultado ANTERIOR:
❌ 500 error
❌ "No se pudo crear la cuenta"
❌ Usuario NO se crea
```

**Test 2: Tema automático**
```bash
# Precondición: Sistema operativo en dark mode

1. Ir a staging.roastr.ai/register
2. Verificar tema visual

Resultado esperado:
✅ Página en DARK MODE (fondo oscuro)
✅ Texto legible en dark mode
✅ Consistente con login page

Resultado ANTERIOR:
❌ Página en LIGHT MODE (fondo blanco)
❌ "Deslumbrante" con sistema en dark
```

**Test 3: Tema automático (light)**
```bash
# Precondición: Sistema operativo en light mode

1. Ir a staging.roastr.ai/register
2. Verificar tema visual

Resultado esperado:
✅ Página en LIGHT MODE (fondo claro)
✅ Texto legible en light mode
```

---

## 🚀 Deploy Instructions

**Backend (Railway):**
```bash
# 1. Merge PR a main
gh pr merge 1309 --squash

# 2. Railway auto-deploys backend
# 3. Verificar logs: NO debe haber "email_infrastructure_unavailable" si RESEND_API_KEY está configurada
```

**Frontend (Vercel):**
```bash
# 1. Vercel auto-deploys frontend con merge a main
# 2. Verificar: https://roastr-frontend-staging.vercel.app/register
# 3. Cambiar sistema a dark mode → Verificar página dark
# 4. Cambiar sistema a light mode → Verificar página light
```

---

## 🔗 Referencias

- **Issue:** ROA-532
- **PR:** #1309
- **Backend service:** `apps/backend-v2/src/services/authService.ts`
- **Email service:** `apps/backend-v2/src/services/authEmailService.ts`
- **Frontend register page:** `frontend/src/pages/auth/register.tsx`
- **Frontend register form:** `frontend/src/components/auth/register-form.tsx`

---

## 🎉 Status Final

**AMBOS BLOCKERS RESUELTOS:**

1. ✅ **P0 - Registro bloqueado:** RESUELTO
   - Usuario se crea incluso sin email config
   - Producto funcional

2. ✅ **P0 - Tema no automático:** RESUELTO
   - Register respeta preferencia del sistema
   - Consistente con login
   - No más "deslumbramiento"

**Listo para:**
- ✅ Merge a main
- ✅ Deploy a staging
- ✅ Validación con QA

---

**Preparado por:** Debug Agent
**Última actualización:** 2026-01-30 20:30 UTC
**Commits:** f309e13c, 4ad045de
