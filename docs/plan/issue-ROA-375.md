# Plan de Implementación - ROA-375

**Issue:** ROA-375 - B2: Register Frontend UI (shadcn)  
**Fecha:** 2025-12-27  
**Owner:** Frontend Dev  
**Worktree:** `/Users/emiliopostigo/roastr-ai-worktrees/ROA-375`  
**Rama:** `feature/ROA-375-auto`

---

## 📋 Contexto

El backend de registro ya está implementado (ROA-374):
- Endpoint: `POST /api/v2/auth/register`
- Validación: Email, password (min 8 chars), términos aceptados
- Respuesta: `{ user, session }` o AuthError taxonomy

Necesitamos implementar la UI frontend usando shadcn/ui con:
- Formulario de registro (email, password, términos)
- Validación en tiempo real
- Manejo de errores con AuthError taxonomy
- Tema claro/oscuro/sistema
- Responsive (móvil, tablet, desktop)

---

## 🎯 Estado Actual

### Backend (✅ Completo)
- ✅ Endpoint `/api/v2/auth/register` funcional
- ✅ AuthError taxonomy implementada
- ✅ Rate limiting configurado (SSOT v2, sección 12.4)
- ✅ Validación de email único
- ✅ Tests pasando

### Frontend (❌ Pendiente)
- ❌ No existe página de registro en frontend-v2
- ❌ No hay componentes de formulario reutilizables
- ❌ No hay integración con backend de auth v2

---

## 🚀 Pasos de Implementación

### FASE 1: Generación de UI con shadcn/ui ⏳

**Comando MCP:**
```bash
/cui Create a register page with email, password fields, terms checkbox, and submit button
```

**Componentes esperados:**
- Card container con logo
- Input para email con validación
- Input para password con requisitos visibles
- Checkbox para aceptar términos
- Button para submit
- Link a página de login
- Alert para mostrar errores

**Ubicación:**
```
apps/frontend-v2/
  app/
    register/
      page.tsx           # Página principal de registro
  components/
    auth/
      RegisterForm.tsx   # Formulario de registro (generado por shadcn MCP)
```

### FASE 2: Integración con Backend ⏳

**Tareas:**
1. Crear hook `useRegister` para manejar llamada a API:
   ```typescript
   // hooks/useRegister.ts
   export function useRegister() {
     return useMutation({
       mutationFn: async (data: { email, password, terms_accepted }) => {
         const response = await fetch('/api/v2/auth/register', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(data)
         });
         
         if (!response.ok) {
           const error = await response.json();
           throw new Error(error.error_code || 'REGISTER_FAILED');
         }
         
         return response.json();
       }
     });
   }
   ```

2. Conectar `RegisterForm` con `useRegister`
3. Manejar estados: loading, success, error
4. Guardar tokens en localStorage al éxito
5. Redirect a `/dashboard` después de registro exitoso

### FASE 3: Validación de Formulario ⏳

**Usar `react-hook-form` + `zod`:**

```typescript
// lib/validations/auth.ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe incluir mayúscula')
    .regex(/[0-9]/, 'Debe incluir número'),
  terms_accepted: z.boolean()
    .refine(val => val === true, 'Debes aceptar los términos')
});
```

**Validación en tiempo real:**
- Email: validar formato al blur
- Password: mostrar requisitos en tiempo real
- Términos: deshabilitar submit si no aceptado

### FASE 4: Manejo de Errores ⏳

**Mapear AuthError taxonomy a mensajes user-friendly:**

```typescript
// lib/auth/errorMessages.ts
export const authErrorMessages: Record<string, string> = {
  'AUTH_EMAIL_TAKEN': 'Este email ya está registrado',
  'AUTH_INVALID_EMAIL': 'Email inválido',
  'AUTH_WEAK_PASSWORD': 'La contraseña es muy débil',
  'RATE_LIMIT_EXCEEDED': 'Demasiados intentos. Espera 15 minutos',
  // ... más códigos según authErrorTaxonomy.ts
};

export function getErrorMessage(errorCode: string): string {
  return authErrorMessages[errorCode] || 'Error al registrar. Inténtalo de nuevo';
}
```

**Mostrar errores:**
- Alert banner arriba del formulario
- Mensajes inline en campos con error
- Deshabilitar submit durante rate limit

### FASE 5: Tema y Responsive ⏳

**Tema:**
- Usar `ThemeProvider` de shadcn
- Default: `theme="system"`
- Probar en claro y oscuro manualmente

**Responsive:**
- Móvil (375px): Card full-width, inputs apilados
- Tablet (768px): Card centrado, max-width 500px
- Desktop (1920px): Card centrado, max-width 500px

**Breakpoints:**
```css
/* Tailwind config ya tiene: */
sm: '640px'
md: '768px'
lg: '1024px'
xl: '1280px'
2xl: '1536px'
```

### FASE 6: Tests E2E ⏳

**Playwright tests:**

```typescript
// tests/e2e/auth/register.spec.ts
test('successful registration', async ({ page }) => {
  await page.goto('/register');
  
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'SecurePass123');
  await page.check('[name="terms_accepted"]');
  await page.click('button[type="submit"]');
  
  await page.waitForURL('/dashboard');
  expect(page.url()).toContain('/dashboard');
});

test('shows validation errors', async ({ page }) => {
  await page.goto('/register');
  
  await page.click('button[type="submit"]');
  
  await expect(page.locator('text=Email inválido')).toBeVisible();
  await expect(page.locator('text=Mínimo 8 caracteres')).toBeVisible();
});

test('handles email already taken error', async ({ page }) => {
  // Mock API response con AUTH_EMAIL_TAKEN
  await page.route('/api/v2/auth/register', route => {
    route.fulfill({
      status: 409,
      body: JSON.stringify({ error_code: 'AUTH_EMAIL_TAKEN' })
    });
  });
  
  await page.goto('/register');
  await page.fill('[name="email"]', 'existing@example.com');
  await page.fill('[name="password"]', 'SecurePass123');
  await page.check('[name="terms_accepted"]');
  await page.click('button[type="submit"]');
  
  await expect(page.locator('text=Este email ya está registrado')).toBeVisible();
});

test('responsive: mobile view', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/register');
  
  // Card debe ser full-width en móvil
  const card = page.locator('[data-testid="register-card"]');
  const box = await card.boundingBox();
  expect(box.width).toBeGreaterThan(350);
});

test('theme: light and dark modes', async ({ page }) => {
  await page.goto('/register');
  
  // Probar tema claro
  await page.emulateMedia({ colorScheme: 'light' });
  // Verificar contraste adecuado
  
  // Probar tema oscuro
  await page.emulateMedia({ colorScheme: 'dark' });
  // Verificar contraste adecuado
});
```

**Capturas de evidencia:**
- `docs/test-evidence/ROA-375/register-desktop-light.png`
- `docs/test-evidence/ROA-375/register-desktop-dark.png`
- `docs/test-evidence/ROA-375/register-mobile.png`
- `docs/test-evidence/ROA-375/register-error-state.png`

---

## 📦 Archivos Afectados

### Nuevos archivos:
```
apps/frontend-v2/
  app/register/page.tsx
  components/auth/RegisterForm.tsx
  hooks/useRegister.ts
  lib/validations/auth.ts
  lib/auth/errorMessages.ts

tests/e2e/auth/register.spec.ts
docs/test-evidence/ROA-375/
docs/plan/issue-ROA-375.md (este archivo)
```

### Archivos modificados:
```
docs/nodes-v2/auth/overview.md          # Añadir referencia a UI de registro
docs/nodes-v2/09-panel-usuario.md      # Añadir flujo de registro
```

---

## 🔗 Dependencias

### Nodos GDD:
- `auth` - Para endpoint y AuthError taxonomy
- `frontend-user-app` - Para integración con app de usuario

### Backend:
- ✅ `POST /api/v2/auth/register` (ROA-374)
- ✅ AuthError taxonomy (`apps/backend-v2/src/utils/authErrorTaxonomy.ts`)

### Frontend:
- shadcn/ui components (via MCP)
- react-hook-form (ya instalado)
- zod (ya instalado)
- @tanstack/react-query (ya instalado)

---

## ✅ Validación

### Pre-Commit:
```bash
# 1. Tests pasando
npm run test:e2e -- register.spec.ts

# 2. Build exitoso
cd apps/frontend-v2 && npm run build

# 3. Linter limpio
npm run lint

# 4. Validar nodos GDD
node scripts/validate-v2-doc-paths.js --ci
node scripts/validate-ssot-health.js --ci
```

### Criterios de Aceptación:
- [ ] Formulario de registro funcional
- [ ] Validación en tiempo real (email, password, términos)
- [ ] Manejo de errores con AuthError taxonomy
- [ ] Registro exitoso → redirect a `/dashboard`
- [ ] Email duplicado → error user-friendly
- [ ] Rate limit → mensaje claro de espera
- [ ] Tema claro/oscuro funcionando
- [ ] Responsive en 375px, 768px, 1920px
- [ ] Tests E2E pasando (5 tests mínimo)
- [ ] Evidencia visual generada

---

## 🚧 Riesgos y Mitigaciones

### Riesgo 1: shadcn MCP no genera estructura exacta
**Mitigación:** Customizar componentes generados manualmente

### Riesgo 2: Rate limiting muy agresivo en testing
**Mitigación:** Usar mocks en E2E, no llamadas reales a backend

### Riesgo 3: AuthError codes no coinciden con frontend
**Mitigación:** Leer `authErrorTaxonomy.ts` antes de implementar `errorMessages.ts`

---

## 📊 Estimación

- **FASE 1 (UI shadcn):** 30min
- **FASE 2 (Integración):** 45min
- **FASE 3 (Validación):** 30min
- **FASE 4 (Errores):** 30min
- **FASE 5 (Tema/Responsive):** 20min
- **FASE 6 (Tests):** 1h
- **Total:** ~3.5 horas

---

## 🎯 Agentes Relevantes

- **FrontendDev** - Implementación UI y hooks
- **TestEngineer** - Tests E2E con Playwright
- **UIDesigner** - Verificación de tema y responsive

---

**Autor:** Orchestrator  
**Última actualización:** 2025-12-27  
**Status:** ✅ Plan aprobado, continuando con implementación

