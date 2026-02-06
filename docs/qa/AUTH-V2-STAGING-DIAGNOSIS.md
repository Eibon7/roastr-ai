# Auth v2 Staging Diagnosis & Fixes

**Fecha:** 2026-01-30
**Issue:** Errores persistentes en Auth v2 STAGING
**Status:** 🔍 DIAGNOSIS IN PROGRESS

---

## 🎯 Síntomas Reportados

1. ❌ **Registro:** "Error al registrar. Inténtalo de nuevo"
2. ❌ **No llega email** de bienvenida
3. ❌ **Login:** "Load failed" en lugar de mensaje claro
4. ❌ **Validaciones:** Errores no se limpian correctamente

---

## 🔍 Análisis del Código Actual

### Backend (`apps/backend-v2/src/routes/auth.ts`)

**Endpoints verificados:**

#### POST /v2/auth/register (líneas 41-193)

**Contrato de respuesta:**
```typescript
// Success (línea 158):
{ success: true }

// Error (línea 191):
sendAuthError(req, res, error, { log: { policy: 'register' } })
// → Devuelve:
{
  success: false,
  error: { slug: 'AUTH_*', retryable: boolean },
  request_id: 'uuid'
}
```

**Validaciones:**
- ✅ Email: líneas 48-70 (formato, normalización, regex)
- ✅ Password: líneas 54-76 (min 8, max 128)
- ✅ Feature flag: línea 80 (`auth_enable_register`)
- ✅ Policy gate: líneas 99-128 (rate limit, abuse detection)

**Flujo:**
1. Validación de input → `POLICY_INVALID_REQUEST` si falla
2. Feature flag check → `AUTH_DISABLED` si OFF
3. Policy gate → `POLICY_RATE_LIMITED` / `AUTH_DISABLED` si bloqueado
4. `authService.register()` → Puede lanzar AuthError
5. Anti-enumeration: SIEMPRE `{ success: true }` (incluso si email existe)

#### POST /v2/auth/login (líneas 232-313)

**Contrato de respuesta:**
```typescript
// Success (línea 305):
{
  session: { access_token, refresh_token, ... },
  message: 'Login successful'
}

// Error (línea 311):
sendAuthError(req, res, error, { log: { policy: 'login' } })
```

**Validaciones:**
- ✅ Email/password required: líneas 240-244
- ✅ Feature flag: línea 247 (`auth_enable_login`)
- ✅ Policy gate: líneas 266-293

### Frontend (`frontend/src/components/auth/register-form.tsx`)

**Error handling (líneas 206-227):**

```typescript
catch (err: any) {
  // Extrae slug de múltiples posibles ubicaciones
  const errorSlug = err?.error?.slug || 
                    err?.error_code || 
                    err?.response?.data?.error?.slug || 
                    'AUTH_UNKNOWN';
  
  // Mapea slug a mensaje UX
  setBackendError(getErrorMessage(errorSlug));
}
```

**Mapeo de errores (líneas 24-63):**
- ✅ 29 error slugs mapeados
- ✅ Mensajes UX claros (no técnicos)
- ✅ Anti-enumeration mantenido (genéricos para account errors)

### API Client (`frontend/src/lib/api/client.js`)

**Error wrapping (líneas 355-368):**

```javascript
if (!response.ok) {
  const errorObject = {
    status: response.status,
    error: responseData.error || { slug: responseData.error_code || 'AUTH_UNKNOWN' },
    response: { data: responseData }
  };
  throw errorObject;
}
```

**Estructura correcta:** ✅
- `error.slug` está disponible
- Status code correcto
- Response data preservada

---

## 🚨 Posibles Causas del Problema

### Hipótesis A: Feature Flags Deshabilitados

**Evidencia:**
- Backend valida `auth_enable_register` (línea 80)
- Backend valida `auth_enable_login` (línea 247)
- Si OFF → lanza `AuthError(AUTH_ERROR_CODES.AUTH_DISABLED)`

**Impacto:**
- Register → "El registro está temporalmente deshabilitado"
- Login → "El servicio de autenticación está temporalmente deshabilitado"

**Verificación necesaria:**
```bash
# Verificar feature flags en Railway backend
# Archivo: apps/backend-v2/src/config/admin-controlled.yaml
grep -A 10 "feature_flags" apps/backend-v2/src/config/admin-controlled.yaml
```

**Fix si confirma:**
```yaml
feature_flags:
  auth_enable_login: true
  auth_enable_register: true
  auth_enable_emails: true
  auth_enable_session_refresh: true
```

### Hipótesis B: authService.register() Falla Silenciosamente

**Evidencia:**
- Backend usa `await authService.register()` (línea 134)
- Si Supabase/Resend falla → lanza error
- Error capturado en catch block (línea 159)
- `sendAuthError()` devuelve slug apropiado

**Posibles errores:**
1. `AUTH_EMAIL_SEND_FAILED` - Resend no pudo enviar email
2. `AUTH_EMAIL_PROVIDER_ERROR` - Resend API error
3. `ACCOUNT_EMAIL_ALREADY_EXISTS` - Email ya existe (pero anti-enum debería ocultarlo)
4. `AUTH_UNKNOWN` - Error no mapeado de Supabase

**Verificación necesaria:**
- Revisar logs de Railway backend
- Buscar: "Register endpoint error", "auth.error.generated"

### Hipótesis C: Response Content-Type Incorrecto

**Evidencia:**
- apiClient espera `application/json` (línea 344)
- Si backend devuelve `text/plain` → `responseData` es string
- Frontend intenta acceder a `responseData.error` → undefined
- `errorSlug` termina siendo `'AUTH_UNKNOWN'`

**Debug logs existentes:**
- Línea 350 de client.js ya captura este caso
- Mensaje: "Response was TEXT not JSON"

**Fix si confirma:**
- Backend DEBE devolver siempre `Content-Type: application/json`
- Verificar que `sendAuthError()` usa `res.json()` correctamente (línea 55-59 de authErrorResponse.ts)

### Hipótesis D: CORS / Network Issues

**Evidencia:**
- Frontend en Vercel (https://staging.roastr.ai)
- Backend en Railway (https://api-staging.roastr.ai)
- Si CORS falla → fetch lanza network error
- apiClient wrapper → `NETWORK_ERROR` slug (líneas 399-413)

**Verificación necesaria:**
- Browser DevTools Network tab
- Buscar: preflight OPTIONS, CORS errors
- Status code 0 = network/CORS failure

### Hipótesis E: Validación Frontend Interfiere

**Evidencia:**
- Zod schema valida antes de submit (líneas 81-105)
- Si validación falla → NO se llama a backend
- Pero usuario ve error de validación, NO "Error al registrar"

**Descartada:** Los síntomas no coinciden (usuario ve error genérico, no error de validación)

---

## 🔧 Plan de Fixes (Por Prioridad)

### Fix 1: Validar Feature Flags (P0 - BLOCKER)

**Archivo:** `apps/backend-v2/src/config/admin-controlled.yaml`

**Verificar:**
```yaml
feature_flags:
  auth_enable_login: true          # DEBE estar en true
  auth_enable_register: true       # DEBE estar en true
  auth_enable_emails: true         # DEBE estar en true
  auth_enable_session_refresh: true
```

**Si están en false:** Cambiar a true + restart backend Railway

### Fix 2: Mejorar Error Messages Frontend (P0)

**Problema actual:**
- "Error al registrar. Inténtalo de nuevo" es el mensaje para `AUTH_UNKNOWN`
- Muy genérico, no ayuda a QA a debuggear

**Fix:** Añadir mensajes más específicos

**Archivo:** `frontend/src/components/auth/register-form.tsx`

```typescript
const authErrorMessages: Record<string, string> = {
  // ... existing ...
  
  // Mejoras para debugging QA
  'AUTH_DISABLED': 'El servicio de registro está temporalmente deshabilitado. Verifica feature flags en backend.',
  'AUTH_EMAIL_PROVIDER_ERROR': 'Error al conectar con el servicio de email. Verifica configuración de Resend en backend.',
  'AUTH_EMAIL_SEND_FAILED': 'No se pudo enviar el email de bienvenida. Verifica Resend API key y dominio verificado.',
  'POLICY_INVALID_REQUEST': 'Datos inválidos. Verifica que email y password cumplan requisitos.',
  'POLICY_NOT_FOUND': 'Endpoint no encontrado. Verifica que backend esté desplegado correctamente.',
  
  // Fallback mejorado
  'AUTH_UNKNOWN': 'Error desconocido al registrar. Revisa logs de backend para más detalles. (slug: AUTH_UNKNOWN)'
};
```

### Fix 3: Añadir Error Slug Visible en DEV (P1)

**Para QA:** Mostrar error slug en development mode

**Archivo:** `frontend/src/components/auth/register-form.tsx`

```typescript
// Línea ~226, después de setBackendError
if (import.meta.env.DEV) {
  console.error('Register error details:', {
    slug: errorSlug,
    status: err?.status,
    retryable: err?.error?.retryable,
    request_id: err?.request_id,
    fullError: err
  });
}

// En el UI, añadir debug info si está en dev
{backendError && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>
      {backendError}
      {import.meta.env.DEV && errorSlug && (
        <div className="mt-2 text-xs font-mono opacity-70">
          Debug: {errorSlug}
        </div>
      )}
    </AlertDescription>
  </Alert>
)}
```

### Fix 4: Validaciones Reactivas (P1)

**Problema:** Errores no desaparecen cuando usuario corrige

**Archivo:** `frontend/src/components/auth/register-form.tsx`

**Fix:**
```typescript
// Limpiar backend error cuando usuario empieza a tipear
React.useEffect(() => {
  if (backendError) {
    setBackendError(null);
  }
}, [watch('email'), watch('password'), watch('confirmPassword')]);
```

### Fix 5: Login "Load failed" Fix (P0)

**Archivo:** `frontend/src/pages/auth/login-v2.tsx`

**Problema:** Probablemente mismo issue que register (error slug no se extrae correctamente)

**Verificar líneas de error handling:**
- ¿Existe `getErrorMessage()` similar?
- ¿Mapea correctamente `AUTH_INVALID_CREDENTIALS`?
- ¿Muestra "Load failed" por defecto?

**Fix:** Asegurar extracción correcta de slug y mapeo de mensajes

---

## 🧪 Validación Post-Fix

### Checklist de Verificación

**Backend:**
- [ ] Feature flags enabled en admin-controlled.yaml
- [ ] Backend reiniciado (Railway)
- [ ] Logs de backend NO muestran "AUTH_DISABLED"
- [ ] Endpoint `/v2/auth/health` retorna 200 OK

**Frontend:**
- [ ] Registro con email nuevo → Success o error claro (NO "Error al registrar")
- [ ] Login con credenciales incorrectas → "El email o la contraseña no son correctos" (NO "Load failed")
- [ ] Email de validación → Llega a bandeja de entrada
- [ ] Validaciones → Errores desaparecen cuando usuario corrige

**Network:**
- [ ] DevTools Network tab → Requests a `/v2/auth/register` retornan JSON
- [ ] Status code apropiado (200 success, 401/400/429 errors)
- [ ] Response body tiene `{ success: false, error: { slug, retryable } }`
- [ ] NO hay CORS errors

---

## 📝 Próximos Pasos

1. ✅ **Validar feature flags** en Railway backend
2. ✅ **Implementar fixes P0** (error messages + slug visibility)
3. ✅ **Deploy + test** en staging
4. ✅ **Documentar resultados** en este archivo
5. ✅ **Crear PR** con fixes

---

**Status:** READY FOR IMPLEMENTATION
**Owner:** Debug Agent
**Blocker:** Feature flags verification pending
