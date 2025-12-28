# Auth - Error Taxonomy

**Subnodo:** `auth/error-taxonomy`  
**Última actualización:** 2025-12-26  
**Owner:** ROA-364 (documenta ROA-372)

---

## 📋 Propósito (ROA-405)

Este subnodo documenta la **taxonomía estable de errores de Auth (V2)** y el **contrato backend → frontend**.

**Strong Concept:** Este nodo es el dueño único de `authErrorTaxonomy`.

**Objetivos:**

1. **Slugs estables:** Categorías claras (AUTH_*, AUTHZ_*, SESSION_*, TOKEN_*, ACCOUNT_*, POLICY_*)
2. **Contrato público:** Frontend resuelve por `slug` (NO por HTTP), backend devuelve solo `slug + retryable + request_id`
3. **No filtrado:** ❌ No mensajes técnicos, ❌ no PII, ❌ no errores crudos de Supabase
4. **Retryability explícito:** `retryable` definido por slug (no inferido)

---

## 🏗️ Implementación

**Archivo:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts`

### Tipos base (V2)

```typescript
type AuthErrorV2 = {
  slug: string; // estable (ej. AUTH_INVALID_CREDENTIALS)
  http_status: number;
  retryable: boolean;
  user_message_key: string; // i18n key (NO texto literal)
  category: 'auth' | 'authz' | 'session' | 'token' | 'account' | 'policy';
};

type PublicAuthErrorResponseV2 = {
  success: false;
  error: { slug: string; retryable: boolean };
  request_id: string;
};
```

---

## 📚 Categorías de Errores

> Nota ROA-405: en V2 el backend **no devuelve mensajes**. La UI debe resolver por `slug` y usar `user_message_key` para i18n.
> El copy final está fuera de alcance de esta tarea.

### 1. AUTH_* — Errores de Autenticación (401)

**Definición:** Credenciales inválidas, cuenta bloqueada, rate limit.

| Código                       | HTTP | Descripción                                | Retry? |
| ---------------------------- | ---- | ------------------------------------------ | ------ |
| `AUTH_INVALID_CREDENTIALS`   | 401  | Email o password incorrectos               | ❌     |
| `AUTH_EMAIL_NOT_VERIFIED`    | 401  | Email no verificado (si aplica)            | ❌     |
| `AUTH_ACCOUNT_LOCKED`        | 401  | Cuenta bloqueada por admin                 | ❌     |
| `AUTH_RATE_LIMIT_EXCEEDED`   | 429  | Demasiados intentos de login               | ✅     |
| `AUTH_DISABLED`              | 401  | Autenticación deshabilitada (maintenance)  | ✅     |

**User-facing messages:**

```typescript
AUTH_INVALID_CREDENTIALS   → "Invalid email or password"
AUTH_EMAIL_NOT_VERIFIED    → "Please verify your email before logging in"
AUTH_ACCOUNT_LOCKED        → "Your account has been locked. Contact support."
AUTH_RATE_LIMIT_EXCEEDED   → "Too many attempts. Please try again later."
AUTH_DISABLED              → "Authentication is temporarily unavailable. Try again soon."
```

**⚠️ User Enumeration Prevention:**
- `AUTH_INVALID_CREDENTIALS` usado para "email no existe" Y "password incorrecta"
- Timing attacks mitigados con delay constante

### 2. AUTHZ_* — Errores de Autorización (403)

**Definición:** Usuario autenticado pero sin permisos para la acción.

| Código                           | HTTP | Descripción                                | Retry? |
| -------------------------------- | ---- | ------------------------------------------ | ------ |
| `AUTHZ_INSUFFICIENT_PERMISSIONS` | 403  | Usuario no tiene permisos para esta acción | ❌     |
| `AUTHZ_ROLE_NOT_ALLOWED`         | 403  | Rol de usuario no permitido (ej: no admin) | ❌     |
| `AUTHZ_MAGIC_LINK_NOT_ALLOWED`   | 403  | Magic link deshabilitado para esta cuenta  | ❌     |

**User-facing messages:**

```typescript
AUTHZ_INSUFFICIENT_PERMISSIONS → "You don't have permission to perform this action"
AUTHZ_ROLE_NOT_ALLOWED         → "Admin access required"
AUTHZ_MAGIC_LINK_NOT_ALLOWED   → "Magic link login is not available for your account"
```

**Diferencia con AUTH_*:**
- `AUTH_*` → Usuario NO autenticado (credenciales inválidas)
- `AUTHZ_*` → Usuario SÍ autenticado pero sin permisos

### 3. SESSION_* — Errores de Sesión (401)

**Definición:** Sesión expirada, inválida o revocada.

| Código                      | HTTP | Descripción                                | Retry? |
| --------------------------- | ---- | ------------------------------------------ | ------ |
| `SESSION_EXPIRED`           | 401  | Sesión expirada (>1h sin refresh)          | ✅     |
| `SESSION_INVALID`           | 401  | Sesión malformada o corrupta               | ❌     |
| `SESSION_REVOKED`           | 401  | Sesión revocada (logout, admin suspension) | ❌     |
| `SESSION_INACTIVITY_TIMEOUT`| 401  | Inactividad >7 días (refresh_token expired)| ✅     |

**User-facing messages:**

```typescript
SESSION_EXPIRED            → "Your session has expired. Please log in again."
SESSION_INVALID            → "Invalid session. Please log in again."
SESSION_REVOKED            → "Your session was ended. Please log in again."
SESSION_INACTIVITY_TIMEOUT → "You've been logged out due to inactivity. Please log in again."
```

**Retry-able:**
- `SESSION_EXPIRED`, `SESSION_INACTIVITY_TIMEOUT` → Usuario puede relogin
- `SESSION_INVALID`, `SESSION_REVOKED` → Generalmente no retry-able

### 4. TOKEN_* — Errores de Tokens (401)

**Definición:** Tokens JWT o refresh inválidos, expirados, revocados.

| Código           | HTTP | Descripción                                | Retry? |
| ---------------- | ---- | ------------------------------------------ | ------ |
| `TOKEN_EXPIRED`  | 401  | Token JWT expirado                         | ✅     |
| `TOKEN_INVALID`  | 401  | Token malformado o con firma inválida     | ❌     |
| `TOKEN_MISSING`  | 401  | Token no proporcionado en request          | ❌     |
| `TOKEN_REVOKED`  | 401  | Token revocado manualmente                 | ❌     |

**User-facing messages:**

```typescript
TOKEN_EXPIRED  → "Your session has expired. Please log in again."
TOKEN_INVALID  → "Invalid authentication token. Please log in again."
TOKEN_MISSING  → "Authentication required. Please log in."
TOKEN_REVOKED  → "Your access has been revoked. Please log in again."
```

**Diferencia con SESSION_*:**
- `TOKEN_*` → Problema técnico con el token JWT
- `SESSION_*` → Problema conceptual con la sesión Supabase

### 5. ACCOUNT_* — Errores de Cuenta (404/409)

**Definición:** Cuenta no encontrada, suspendida, duplicada.

| Código                        | HTTP | Descripción                                | Retry? |
| ----------------------------- | ---- | ------------------------------------------ | ------ |
| `ACCOUNT_NOT_FOUND`           | 404  | Cuenta no existe                           | ❌     |
| `ACCOUNT_SUSPENDED`           | 403  | Cuenta suspendida por admin                | ❌     |
| `ACCOUNT_DELETED`             | 404  | Cuenta eliminada (GDPR)                    | ❌     |
| `ACCOUNT_EMAIL_ALREADY_EXISTS`| 409  | Email ya registrado (signup)               | ❌     |

**User-facing messages:**

```typescript
ACCOUNT_NOT_FOUND            → "Invalid email or password" // Same as INVALID_CREDENTIALS
ACCOUNT_SUSPENDED            → "Your account has been suspended. Contact support."
ACCOUNT_DELETED              → "This account no longer exists."
ACCOUNT_EMAIL_ALREADY_EXISTS → "An account with this email already exists."
```

**⚠️ User Enumeration Prevention:**
- `ACCOUNT_NOT_FOUND` usa mismo mensaje que `AUTH_INVALID_CREDENTIALS`
- Solo `ACCOUNT_EMAIL_ALREADY_EXISTS` revela existencia (pero solo en signup, aceptable)

---

## 🔄 Mapeo de Errores Supabase

### Función: mapSupabaseError()

```typescript
export function mapSupabaseError(error: any): AuthError {
  const message = error?.message || 'Unknown error';

  // Email ya existe
  if (message.includes('already registered') || message.includes('duplicate')) {
    return new AuthError(
      AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
      'An account with this email already exists',
      error
    );
  }

  // Credenciales inválidas
  if (message.includes('Invalid login credentials') || message.includes('wrong password')) {
    return new AuthError(
      AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      'Invalid email or password',
      error
    );
  }

  // Email no verificado
  if (message.includes('Email not confirmed')) {
    return new AuthError(
      AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED,
      'Please verify your email before logging in',
      error
    );
  }

  // Token expirado
  if (message.includes('expired') || message.includes('JWT expired')) {
    return new AuthError(
      AUTH_ERROR_CODES.TOKEN_EXPIRED,
      'Your session has expired. Please log in again',
      error
    );
  }

  // Token inválido
  if (message.includes('invalid') && message.includes('token')) {
    return new AuthError(
      AUTH_ERROR_CODES.TOKEN_INVALID,
      'Invalid authentication token',
      error
    );
  }

  // Sesión inválida
  if (message.includes('session')) {
    return new AuthError(
      AUTH_ERROR_CODES.SESSION_INVALID,
      'Invalid session',
      error
    );
  }

  // Rate limit from Supabase
  if (
    message.includes('Too many requests') ||
    message.includes('rate_limit') ||
    message.includes('over_request_rate_limit')
  ) {
    return new AuthError(
      AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      'Too many requests. Please try again later',
      error
    );
  }

  // Fallback genérico
  return new AuthError(
    AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    'Authentication failed',
    error
  );
}
```

### Uso en Auth Service

```typescript
// apps/backend-v2/src/services/authService.ts
import { mapSupabaseError } from '@/utils/authErrorTaxonomy';

async function loginWithPassword(email: string, password: string): Promise<Session> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      // Mapear error de Supabase a AuthError
      throw mapSupabaseError(error);
    }
    
    return data.session;
  } catch (error) {
    // Si ya es AuthError, re-throw
    if (error instanceof AuthError) {
      throw error;
    }
    
    // Si es otro error, mapear
    throw mapSupabaseError(error);
  }
}
```

---

## ♻️ Retryability Logic

### Función: isRetryableError()

```typescript
export function isRetryableError(error: AuthError): boolean {
  const retryableCodes: AuthErrorCode[] = [
    AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED,
    AUTH_ERROR_CODES.AUTH_DISABLED,
    AUTH_ERROR_CODES.SESSION_EXPIRED,
    AUTH_ERROR_CODES.SESSION_INACTIVITY_TIMEOUT,
    AUTH_ERROR_CODES.TOKEN_EXPIRED
  ];
  
  return retryableCodes.includes(error.code);
}
```

### Función: getRetryDelay()

```typescript
export function getRetryDelay(error: AuthError): number {
  switch (error.code) {
    case AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED:
      return 15 * 60 * 1000; // 15 minutos
    
    case AUTH_ERROR_CODES.AUTH_DISABLED:
      return 5 * 60 * 1000; // 5 minutos
    
    case AUTH_ERROR_CODES.SESSION_EXPIRED:
    case AUTH_ERROR_CODES.SESSION_INACTIVITY_TIMEOUT:
    case AUTH_ERROR_CODES.TOKEN_EXPIRED:
      return 0; // Inmediato (usuario puede relogin)
    
    default:
      return 0;
  }
}
```

### Uso en Frontend

```typescript
// Frontend: Retry automático con delay apropiado
async function retryableLogin(email: string, password: string, maxRetries = 3): Promise<Session> {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await loginWithPassword(email, password);
    } catch (error) {
      if (error instanceof AuthError && isRetryableError(error)) {
        const delay = getRetryDelay(error);
        
        if (delay > 0) {
          console.log(`[Auth] Retrying in ${delay / 1000}s...`);
          await sleep(delay);
          attempt++;
        } else {
          // Delay 0 → no retry automático, dejar que usuario reintente manualmente
          throw error;
        }
      } else {
        // Error no retry-able
        throw error;
      }
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

---

## 📊 Response Format

### Standard Error Response

```typescript
interface AuthErrorResponse {
  success: false;
  error: {
    code: AuthErrorCode;
    message: string;
    statusCode: number;
    details?: any;
    retryable?: boolean;
    retryAfter?: number; // Minutos
  };
}
```

### Ejemplo: PASSWORD INCORRECT

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "statusCode": 401,
    "retryable": false
  }
}
```

### Ejemplo: RATE LIMIT EXCEEDED

```json
{
  "success": false,
  "error": {
    "code": "AUTH_RATE_LIMIT_EXCEEDED",
    "message": "Too many login attempts. Please try again later.",
    "statusCode": 429,
    "retryable": true,
    "retryAfter": 15,
    "details": {
      "attempts": 5,
      "maxAttempts": 5,
      "windowMs": 900000,
      "blockExpiresAt": 1703000000
    }
  }
}
```

### Ejemplo: SESSION EXPIRED

```json
{
  "success": false,
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Your session has expired. Please log in again.",
    "statusCode": 401,
    "retryable": true,
    "retryAfter": 0
  }
}
```

---

## 🔐 Security Considerations

### 1. User Enumeration Prevention

**Problema:** Atacante puede determinar si un email existe.

**Solución:**

```typescript
// ✅ CORRECTO: Mismo mensaje para "email no existe" y "password incorrecta"
if (userNotFound || passwordIncorrect) {
  throw new AuthError(
    AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    'Invalid email or password'
  );
}

// ❌ INCORRECTO: Revela si email existe
if (userNotFound) {
  throw new AuthError(ACCOUNT_NOT_FOUND, 'Email not found');
}
if (passwordIncorrect) {
  throw new AuthError(INVALID_CREDENTIALS, 'Wrong password');
}
```

**Excepciones aceptables:**
- `ACCOUNT_EMAIL_ALREADY_EXISTS` en signup (necesario para UX)
- `ACCOUNT_SUSPENDED` (usuario ya autenticado previamente)

### 2. Timing Attacks Mitigation

```typescript
// Añadir delay constante para prevenir timing attacks
async function validateCredentials(email: string, password: string): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    const valid = await actualValidation(email, password);
    return valid;
  } finally {
    // Asegurar tiempo constante (ej: 100ms)
    const elapsed = Date.now() - startTime;
    const minTime = 100;
    if (elapsed < minTime) {
      await sleep(minTime - elapsed);
    }
  }
}
```

### 3. Error Details en Producción

```typescript
// En producción, NO exponer detalles técnicos
if (process.env.NODE_ENV === 'production') {
  delete error.details.stack;
  delete error.details.originalError;
}

// En dev, mostrar todo para debugging
if (process.env.NODE_ENV === 'development') {
  error.details = {
    ...error.details,
    stack: error.stack,
    originalError: error.cause
  };
}
```

---

## 🧪 Testing

### Unit Tests

```typescript
// tests/unit/utils/authErrorTaxonomy.test.ts
describe('AuthError', () => {
  test('AUTH_* codes map to 401', () => {
    const error = new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    expect(error.statusCode).toBe(401);
  });
  
  test('AUTHZ_* codes map to 403', () => {
    const error = new AuthError(AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    expect(error.statusCode).toBe(403);
  });
  
  test('ACCOUNT_EMAIL_ALREADY_EXISTS maps to 409', () => {
    const error = new AuthError(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS);
    expect(error.statusCode).toBe(409);
  });
});

describe('mapSupabaseError', () => {
  test('maps "already registered" to EMAIL_ALREADY_EXISTS', () => {
    const supabaseError = { message: 'User already registered' };
    const authError = mapSupabaseError(supabaseError);
    
    expect(authError.code).toBe(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS);
    expect(authError.statusCode).toBe(409);
  });
  
  test('maps "Invalid login credentials" to INVALID_CREDENTIALS', () => {
    const supabaseError = { message: 'Invalid login credentials' };
    const authError = mapSupabaseError(supabaseError);
    
    expect(authError.code).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    expect(authError.statusCode).toBe(401);
  });
});

describe('isRetryableError', () => {
  test('RATE_LIMIT_EXCEEDED is retryable', () => {
    const error = new AuthError(AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED);
    expect(isRetryableError(error)).toBe(true);
  });
  
  test('INVALID_CREDENTIALS is not retryable', () => {
    const error = new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    expect(isRetryableError(error)).toBe(false);
  });
});
```

---

## 📚 Referencias

### SSOT v2

- **Sección 12.4:** Rate Limiting (para AUTH_RATE_LIMIT_EXCEEDED)
- **Sección 2.1:** Billing states (para SUBSCRIPTION_REQUIRED)

### Related Subnodos

- [login-flows.md](./login-flows.md) - Donde se lanzan estos errores
- [rate-limiting.md](./rate-limiting.md) - AUTH_RATE_LIMIT_EXCEEDED detalle
- [session-management.md](./session-management.md) - SESSION_*, TOKEN_* detalle
- [security.md](./security.md) - User enumeration, timing attacks

### Implementación

- **authErrorTaxonomy.ts:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts` ⭐
- **Auth Service:** `apps/backend-v2/src/services/authService.ts` (usa mapSupabaseError)
- **Error Middleware:** `apps/backend-v2/src/middleware/errorHandler.ts` (maneja AuthError)

---

**Última actualización:** 2025-12-26  
**Owner:** ROA-364 (documenta ROA-372)  
**Status:** ✅ Active

