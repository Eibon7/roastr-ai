# QA Fixes Auth v2 (Frontend + Error Mapping) - Revisión 3

**Issue:** [ROA-532](https://linear.app/roastrai/issue/ROA-532/manual-testing)  
**Fecha:** 2026-01-27  
**Estado:** ✅ Fixes Implementados

---

## Contexto

Durante QA manual de Auth v2 en staging (Frontend: Vercel staging.roastr.ai, Backend: Railway api-staging.roastr.ai) se detectaron problemas críticos de validación, mapeo de errores y navegación.

---

## Problemas Resueltos

### ✅ 1. Registro Falla - Error Mapping

**Problema:**

- Al crear cuenta aparecía "Error al registrar. Inténtalo de nuevo"
- No se enviaba email
- Backend devolvía error no mapeado

**Solución:**

- **Archivo:** `frontend/src/components/auth/register-form.tsx`
- Actualizado mapeo de errores para usar **backend v2 taxonomy (error slugs)**
- Añadido manejo correcto de `data?.error?.slug` de backend v2
- Logs seguros: Solo identificadores no sensibles (status, errorSlug)
- Mensajes UX con anti-enumeration:
  - Errores de cuenta → "No se pudo completar el registro. Inténtalo de nuevo" (genérico)
  - `AUTH_UNKNOWN` → "No se pudo crear la cuenta. Inténtalo de nuevo"
  - `POLICY_RATE_LIMITED` → "Demasiados intentos. Intenta en 15 minutos"

**Contrato Backend v2:**

```json
// Error response
{
  "success": false,
  "error": {
    "slug": "AUTH_INVALID_CREDENTIALS",
    "retryable": false
  },
  "request_id": "uuid"
}
```

**Frontend extrae y mapea:**

```typescript
const errorSlug = data?.error?.slug || data?.error_code || 'AUTH_UNKNOWN';
setError(getErrorMessage(errorSlug));
// getErrorMessage() devuelve mensajes genéricos anti-enumeration
```

---

### ✅ 2. Validación de Email Deficiente

**Problema:**

- Emails inválidos producían "load failed"
- No había validación en tiempo real

**Solución:**

- **Archivos:**
  - `frontend/src/components/auth/register-form.tsx`
  - `frontend/src/pages/auth/login-v2.tsx`
- Validación básica de formato en frontend, TLD delegado a backend:
  ```typescript
  // Validación de formato básico (frontend)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'El email no es válido';
  // Backend valida TLD correctamente (acepta .gov.uk, .co.uk, etc)
  ```
- Submit bloqueado si formato inválido
- Backend devuelve error si TLD no válido

---

### ✅ 3. Validación de Contraseña / Confirmación

**Problema:**

- Si las contraseñas no coinciden:
  - El error no desaparece al corregir
  - El mensaje global no se limpia

**Solución:**

- **Archivo:** `frontend/src/components/auth/register-form.tsx`
- Migración a react-hook-form + Zod para validación declarativa:

  ```typescript
  // Zod schema con refine para confirmPassword
  const registerSchema = z
    .object({
      email: z.string().min(1).email(),
      password: z
        .string()
        .min(8)
        .regex(/[a-z]/)
        .regex(/[0-9]/)
        .regex(/^\S*$/)
        .refine(
          (val) => /[A-Z]/.test(val) || /[^A-Za-z0-9\s]/.test(val),
          'Debe incluir al menos una mayúscula o un símbolo'
        ),
      confirmPassword: z.string().min(1),
      termsAccepted: z.boolean().refine((val) => val === true)
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Las contraseñas no coinciden',
      path: ['confirmPassword']
    });

  // RHF maneja validación automáticamente
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(registerSchema)
  });
  ```

- Validación reactiva automática con RHF
- Errores se limpian cuando el usuario corrige inputs (manejado por RHF)
- Errores por campo via `formState.errors` (NO useState manual)

---

### ✅ 4. Mensajes de Error Claros

**Problema:**

- Login incorrecto mostraba mensajes técnicos o genéricos pobres

**Solución:**

- **Archivos:**
  - `frontend/src/pages/auth/login-v2.tsx`
  - `frontend/src/components/auth/register-form.tsx`
- Mensajes UX mejorados (anti-enumeration mantenido):
  - ❌ **Antes:** "Invalid credentials"
  - ✅ **Ahora:** "El email o la contraseña no son correctos"
  - ❌ **Antes:** "Error al registrar"
  - ✅ **Ahora:** "No se pudo crear la cuenta. Inténtalo de nuevo"
  - ❌ **Antes:** "Rate limit exceeded"
  - ✅ **Ahora:** "Demasiados intentos. Intenta en 15 minutos"

- NO expone detalles internos
- Anti-enumeration respetado (email no encontrado = credenciales incorrectas)

---

### ✅ 5. Navegación Login ↔ Registro

**Problema:**

- No había botón claro para ir de login → registro

**Solución:**

- **Archivo:** `frontend/src/pages/auth/login-v2.tsx`
- Añadido CTA de registro:

  ```tsx
  <div className="text-sm text-center text-muted-foreground">
    ¿No tienes cuenta?{' '}
    <Link to="/register" className="font-medium text-primary hover:underline">
      Crear cuenta
    </Link>
  </div>
  ```

- **Archivo:** `frontend/src/components/auth/register-form.tsx` (ya existía)
- CTA de login ya presente:
  ```tsx
  <div className="text-sm text-center text-muted-foreground">
    ¿Ya tienes cuenta?{' '}
    <Link to="/login" className="underline hover:text-primary font-medium">
      Inicia sesión
    </Link>
  </div>
  ```

---

### ✅ 6. Tema (Claro / Oscuro / Sistema)

**Problema:**

- La UI no respeta la configuración del usuario

**Solución:**

- **Verificado:** Ya funcionaba correctamente
- **Archivos:**
  - `frontend/src/lib/theme-provider.tsx` - ThemeProvider con next-themes
  - `frontend/src/App.tsx` - ThemeProvider con `defaultTheme="system"`
  - `frontend/src/components/layout/theme-toggle.tsx` - Toggle funcionando
- **Configuración:**
  ```tsx
  <ThemeProvider
    defaultTheme="system"
    storageKey="roastr-theme"
    enableSystem={true}
  >
  ```
- Respeta `prefers-color-scheme` del sistema
- Persistencia en localStorage con key `roastr-theme`

---

## Cambios Técnicos

### Archivos Modificados

1. **`frontend/src/components/auth/register-form.tsx`**
   - Mapeo completo de errores backend v2 (slugs) con anti-enumeration
   - Validación de email: formato básico (TLD delegado a backend)
   - Validación reactiva de confirmPassword
   - Logs seguros: Solo status y errorSlug (NO tokens/PII)
   - Extracción de `data?.error?.slug` del backend

2. **`frontend/src/pages/auth/login-v2.tsx`**
   - Mapeo completo de errores backend v2 (slugs)
   - Validación de email: formato básico (TLD delegado a backend)
   - CTA de registro añadido
   - Uso de apiClient centralizado (CSRF, mock mode, interceptors)
   - Token storage seguro con setTokens()
   - Logs seguros: Solo errorSlug (NO tokens/PII)

3. **`frontend/src/lib/api/auth.js`**
   - Añadido `loginV2()` para endpoint v2
   - Actualizado `register()` para endpoint v2
   - Exportado `loginV2` en default export

4. **`frontend/src/lib/api/client.js`**
   - Añadidos endpoints v2 a `publicEndpoints`:
     - `/v2/auth/login`
     - `/v2/auth/register`

---

## Reglas Respetadas

✅ **NO tocar backend** - Solo lectura de responses  
✅ **NO cambiar contratos de API** - Respetados 100%  
✅ **NO añadir librerías nuevas** - Usado zod existente  
✅ **NO tocar infra** - Cero cambios  
✅ **NO cambiar feature flags** - Cero cambios  
✅ **Anti-enumeration mantenido** - Email no encontrado = credenciales incorrectas

---

## Testing Manual Pendiente

**Antes de cerrar ROA-532, verificar:**

1. **Registro:**
   - [ ] Email válido (gmail.com) → Success
   - [ ] Email inválido (.con) → Backend devuelve error (frontend acepta formato básico)
   - [ ] Contraseñas no coinciden → Error reactivo que se limpia al corregir
   - [ ] Email ya registrado → "No se pudo completar el registro..." (anti-enumeration)
   - [ ] Email de confirmación enviado correctamente

2. **Login:**
   - [ ] Credenciales correctas → Redirect a `/app`
   - [ ] Credenciales incorrectas → "El email o la contraseña no son correctos"
   - [ ] Email inválido (.con) → Backend devuelve error (frontend acepta formato básico)
   - [ ] Rate limit → "Demasiados intentos. Intenta en 15 minutos"

3. **Navegación:**
   - [ ] Login → "Crear cuenta" funciona
   - [ ] Registro → "Inicia sesión" funciona

4. **Tema:**
   - [ ] Sistema claro → UI claro
   - [ ] Sistema oscuro → UI oscuro
   - [ ] Toggle manual funciona
   - [ ] Persistencia funciona (reload página)

5. **Logs (Consola):**
   - [ ] Register failed → Log con `status`, `errorSlug` (NO data completo)
   - [ ] Login failed → Log con `errorSlug` (NO data completo)
   - [ ] Success → Log "Register succeeded" / "Login succeeded" (NO tokens)

---

## Próximos Pasos

1. **QA Manual en Staging:**
   - Verificar checklist anterior
   - Documentar capturas de pantalla si hay issues

2. **Si QA Pasa:**
   - Cerrar ROA-532
   - Merge a main
   - Deploy a producción

3. **Si QA Falla:**
   - Documentar issues específicos
   - Nueva revisión 4/x

---

## Referencias

- **Issue:** [ROA-532](https://linear.app/roastrai/issue/ROA-532/manual-testing)
- **Backend v2 Taxonomy:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts`
- **Frontend Theme:** `frontend/src/lib/theme-provider.tsx`
- **Zod Validation:** Ya presente en `package.json`

---

**Estado Final:** ✅ Todos los problemas de QA resueltos. Pendiente testing manual en staging.
