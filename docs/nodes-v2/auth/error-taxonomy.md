# Auth - Error Taxonomy

**Subnodo de:** `auth`  
**Última actualización:** 2026-01-01  
**Owner:** ROA-403 (ROA-405, ROA-372)

---

## 📋 Propósito

Define el sistema estructurado de códigos de error para autenticación (AuthError taxonomy v2).

**Strong Concept Owner:** `authErrorTaxonomy` ⭐

---

## 🏗️ Arquitectura

### Ubicación

**Archivo:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts` (475 líneas)

**Strong Concept:** Ningún otro nodo puede definir códigos de error de autenticación. Otros nodos pueden referenciar y usar `AuthError`.

---

## 📊 Categorías de Errores

### AUTH_* (401 - Errores de Autenticación)

- `AUTH_INVALID_CREDENTIALS` - Credenciales inválidas (anti-enumeration)
- `AUTH_EMAIL_NOT_CONFIRMED` - Email no verificado
- `AUTH_ACCOUNT_LOCKED` - Cuenta bloqueada (abuse detection)
- `AUTH_DISABLED` - Autenticación deshabilitada temporalmente
- `AUTH_EMAIL_DISABLED` - Emails deshabilitados (feature flag)
- `AUTH_EMAIL_PROVIDER_ERROR` - Error del proveedor de email (502)
- `AUTH_EMAIL_RATE_LIMITED` - Rate limit en emails (429)
- `AUTH_EMAIL_SEND_FAILED` - Fallo al enviar email (500)
- `AUTH_UNKNOWN` - Error desconocido (fail-closed)

### AUTHZ_* (403 - Errores de Autorización)

- `AUTHZ_INSUFFICIENT_PERMISSIONS` - Permisos insuficientes
- `AUTHZ_ROLE_NOT_ALLOWED` - Role no permitido
- `AUTHZ_MAGIC_LINK_NOT_ALLOWED` - Magic link no permitido (admin/superadmin)
- `AUTHZ_ADMIN_REQUIRED` - Requiere role admin

### SESSION_* (401 - Errores de Sesión)

- `SESSION_EXPIRED` - Sesión expirada (retryable: refresh token)
- `SESSION_INVALID` - Sesión inválida
- `SESSION_REVOKED` - Sesión revocada (logout)

### TOKEN_* (401 - Errores de Tokens)

- `TOKEN_EXPIRED` - Token expirado (retryable: refresh)
- `TOKEN_INVALID` - Token inválido
- `TOKEN_MISSING` - Token faltante
- `TOKEN_REVOKED` - Token revocado

### ACCOUNT_* (404/409 - Errores de Cuenta)

- `ACCOUNT_NOT_FOUND` - Cuenta no existe (404)
- `ACCOUNT_SUSPENDED` - Cuenta suspendida (403)
- `ACCOUNT_BANNED` - Cuenta baneada (403)
- `ACCOUNT_DELETED` - Cuenta eliminada (404)
- `ACCOUNT_EMAIL_ALREADY_EXISTS` - Email ya existe (409)
- `ACCOUNT_BLOCKED` - Cuenta bloqueada (403)

### POLICY_* (400/403/429 - Errores de Política)

- `POLICY_RATE_LIMITED` - Rate limit excedido (429)
- `POLICY_ABUSE_DETECTED` - Abuso detectado (403)
- `POLICY_BLOCKED` - Bloqueado por política (403)
- `POLICY_INVALID_REQUEST` - Request inválido (400)
- `POLICY_NOT_FOUND` - Recurso no encontrado (404)

---

## 🎯 Contrato Público

### Response Format (Backend → Frontend)

```typescript
{
  success: false,
  error: {
    slug: AuthErrorSlug;      // Slug estable (ej: "AUTH_INVALID_CREDENTIALS")
    retryable: boolean;        // true si se puede reintentar
  },
  request_id: string;          // UUID para correlación
}
```

**⚠️ CRÍTICO:**
- ❌ NUNCA devolver mensajes técnicos
- ❌ NUNCA incluir PII (emails, passwords, tokens completos)
- ✅ Frontend resuelve mensajes user-facing por `slug`
- ✅ HTTP status es auxiliar (frontend usa `slug` como fuente de verdad)

### Ejemplos

**Login con credenciales inválidas:**
```json
{
  "success": false,
  "error": {
    "slug": "AUTH_INVALID_CREDENTIALS",
    "retryable": false
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Rate limit excedido:**
```json
{
  "success": false,
  "error": {
    "slug": "POLICY_RATE_LIMITED",
    "retryable": true
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

**Token expirado (retryable con refresh):**
```json
{
  "success": false,
  "error": {
    "slug": "TOKEN_EXPIRED",
    "retryable": true
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440002"
}
```

---

## 🛠️ Uso en Backend

### Class AuthError

```typescript
import { AuthError, AUTH_ERROR_CODES } from '@/utils/authErrorTaxonomy';

// Throw error
throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);

// With cause
throw new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED, { cause: originalError });

// Check retryable
if (error instanceof AuthError && error.retryable) {
  // Suggest retry with exponential backoff
}
```

### Mapeo Supabase → AuthError

**Helper:** `mapSupabaseError(error)`

```typescript
const { error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  throw mapSupabaseError(error); // Converts to AuthError
}
```

**Mapeo automático:**
- "Invalid login credentials" → `AUTH_INVALID_CREDENTIALS`
- "Email not confirmed" → `AUTH_EMAIL_NOT_CONFIRMED`
- "Too many requests" → `POLICY_RATE_LIMITED`
- "JWT expired" → `TOKEN_EXPIRED`
- Unknown → `AUTH_UNKNOWN` (fail-closed)

---

## 🔍 Frontend Handling

### Resolución de Mensajes

```typescript
const AUTH_ERROR_MESSAGES: Record<AuthErrorSlug, string> = {
  AUTH_INVALID_CREDENTIALS: 'Email o contraseña incorrectos',
  AUTH_EMAIL_NOT_CONFIRMED: 'Verifica tu email antes de iniciar sesión',
  POLICY_RATE_LIMITED: 'Demasiados intentos. Intenta más tarde',
  TOKEN_EXPIRED: 'Tu sesión expiró. Iniciando sesión nuevamente...',
  // ... resto de mensajes
};

function handleAuthError(error: { slug: AuthErrorSlug, retryable: boolean }) {
  const message = AUTH_ERROR_MESSAGES[error.slug] || 'Error desconocido';
  
  if (error.retryable) {
    showToast(message, { type: 'warning', action: 'Reintentar' });
  } else {
    showToast(message, { type: 'error' });
  }
}
```

### Retry Logic

```typescript
async function loginWithRetry(email: string, password: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await authService.login(email, password);
    } catch (error) {
      if (error.error.slug === 'TOKEN_EXPIRED' && error.error.retryable) {
        // Auto-refresh token
        await authService.refreshSession();
        continue; // Retry
      }
      
      if (!error.error.retryable || attempt === maxRetries) {
        throw error; // No retry
      }
      
      // Exponential backoff
      await sleep(2 ** attempt * 1000);
    }
  }
}
```

---

## 📊 Observability

### Logs (Backend)

**Helper:** `sendAuthError(req, res, error, options)`

```typescript
// Automatically logs with sanitization
return sendAuthError(req, res, error, {
  log: { policy: 'login' },
  retryAfterSeconds: 900
});
```

**Log output:**
```json
{
  "level": "warn",
  "event": "auth_error",
  "slug": "AUTH_INVALID_CREDENTIALS",
  "http_status": 401,
  "retryable": false,
  "policy": "login",
  "request_id": "uuid-v4",
  "ip": "192.168.x.x" // PII truncated
}
```

### Métricas Prometheus

**Counter: `auth_errors_total`**
```
Labels:
  - slug (AUTH_INVALID_CREDENTIALS, TOKEN_EXPIRED, etc.)
  - retryable (true/false)
  - http_status (401, 403, 429, etc.)
```

---

## 📚 Referencias

- **Implementación:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts`
- **Tests:** `apps/backend-v2/tests/unit/utils/authErrorTaxonomy.test.ts`
- **Helper Response:** `apps/backend-v2/src/utils/authErrorResponse.ts`
- **SSOT v2:** No aplica (Strong Concept interno)

---

**Última actualización:** 2026-01-01  
**Owner:** ROA-403 (ROA-405, ROA-372)  
**Status:** ✅ Active
