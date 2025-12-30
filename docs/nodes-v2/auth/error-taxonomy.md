# Auth - Error Taxonomy V2

**Subnodo:** `auth/error-taxonomy`  
**Última actualización:** 2025-12-28  
**Owner:** ROA-405 (Auth Error Contract V2)

---

## 📋 Propósito (ROA-405)

Este subnodo documenta la **taxonomía estable de errores de Auth (V2)** y el **contrato backend → frontend**.

**Strong Concept:** Este nodo es el dueño único de `authErrorTaxonomy`.

**Objetivos:**

1. **Slugs estables:** Identificadores únicos (AUTH_*, AUTHZ_*, SESSION_*, TOKEN_*, ACCOUNT_*, POLICY_*)
2. **Contrato público:** Frontend resuelve por `slug` (NO por HTTP), backend devuelve solo `slug + retryable + request_id`
3. **No filtrado:** ❌ No mensajes técnicos, ❌ no PII, ❌ no errores crudos de Supabase
4. **Retryability explícito:** `retryable` definido por slug (no inferido por HTTP status)

---

## 🏗️ Implementación

**Archivo:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts`

### Tipos base (V2)

```typescript
interface AuthErrorData {
  slug: string; // estable (ej. AUTH_INVALID_CREDENTIALS)
  http_status: number;
  retryable: boolean;
  user_message_key: string; // i18n key (NO texto literal)
  category: 'auth' | 'authz' | 'session' | 'token' | 'account' | 'policy';
}

type PublicAuthErrorV2 = {
  slug: string;
  retryable: boolean;
};

type AuthErrorResponseV2 = {
  success: false;
  error: PublicAuthErrorV2;
  request_id: string;
};
```

### Clase AuthError

```typescript
class AuthError extends Error {
  slug: string;
  http_status: number;
  retryable: boolean;
  user_message_key: string;
  category: string;
  cause?: unknown;

  toPublicError(): PublicAuthErrorV2 {
    return {
      slug: this.slug,
      retryable: this.retryable
    };
  }
}
```

---

## 📚 Taxonomía de Errores (SSOT)

> **IMPORTANTE:** Esta taxonomía está definida en `apps/backend-v2/src/utils/authErrorTaxonomy.ts` como `AUTH_ERROR_TAXONOMY`.
> El backend **NO devuelve mensajes de usuario** — solo `slug` y `retryable`.

### 1. AUTH_* — Errores de Autenticación (401)

| Slug                       | HTTP | Retry? | user_message_key              |
| -------------------------- | ---- | ------ | ----------------------------- |
| `AUTH_INVALID_CREDENTIALS` | 401  | ❌     | auth.error.invalid_credentials |
| `AUTH_EMAIL_NOT_CONFIRMED` | 401  | ❌     | auth.error.email_not_confirmed |
| `AUTH_ACCOUNT_LOCKED`      | 401  | ❌     | auth.error.account_locked      |
| `AUTH_DISABLED`            | 401  | ✅     | auth.error.auth_disabled       |
| `AUTH_UNKNOWN`             | 500  | ❌     | auth.error.unknown             |

### 1.1 AUTH_EMAIL_* — Infra de emails de Auth (ROA-409)

| Slug                      | HTTP | Retry? | user_message_key                 |
| ------------------------- | ---- | ------ | -------------------------------- |
| `AUTH_EMAIL_DISABLED`     | 403  | ❌     | auth.error.email_disabled        |
| `AUTH_EMAIL_PROVIDER_ERROR` | 502 | ✅     | auth.error.email_provider_error  |
| `AUTH_EMAIL_RATE_LIMITED` | 429  | ✅     | auth.error.email_rate_limited    |
| `AUTH_EMAIL_SEND_FAILED`  | 500  | ❌     | auth.error.email_send_failed     |

### 2. AUTHZ_* — Errores de Autorización (403)

| Slug                             | HTTP | Retry? | user_message_key                  |
| -------------------------------- | ---- | ------ | --------------------------------- |
| `AUTHZ_INSUFFICIENT_PERMISSIONS` | 403  | ❌     | auth.error.insufficient_permissions |
| `AUTHZ_ROLE_NOT_ALLOWED`         | 403  | ❌     | auth.error.role_not_allowed         |
| `AUTHZ_MAGIC_LINK_NOT_ALLOWED`   | 403  | ❌     | auth.error.magic_link_not_allowed   |

### 3. SESSION_* — Errores de Sesión (401)

| Slug                          | HTTP | Retry? | user_message_key                   |
| ----------------------------- | ---- | ------ | ---------------------------------- |
| `SESSION_EXPIRED`             | 401  | ✅     | auth.error.session_expired         |
| `SESSION_INVALID`             | 401  | ❌     | auth.error.session_invalid         |
| `SESSION_REVOKED`             | 401  | ❌     | auth.error.session_revoked         |
| `SESSION_INACTIVITY_TIMEOUT`  | 401  | ✅     | auth.error.session_inactivity       |

### 4. TOKEN_* — Errores de Tokens (401)

| Slug              | HTTP | Retry? | user_message_key         |
| ----------------- | ---- | ------ | ------------------------ |
| `TOKEN_EXPIRED`   | 401  | ✅     | auth.error.token_expired |
| `TOKEN_INVALID`   | 401  | ❌     | auth.error.token_invalid |
| `TOKEN_MISSING`   | 401  | ❌     | auth.error.token_missing |
| `TOKEN_REVOKED`   | 401  | ❌     | auth.error.token_revoked |

### 5. ACCOUNT_* — Errores de Cuenta (404/409/403)

| Slug                            | HTTP | Retry? | user_message_key                     |
| ------------------------------- | ---- | ------ | ------------------------------------ |
| `ACCOUNT_NOT_FOUND`             | 404  | ❌     | auth.error.invalid_credentials (anti-enum) |
| `ACCOUNT_SUSPENDED`             | 403  | ❌     | auth.error.account_suspended          |
| `ACCOUNT_DELETED`               | 404  | ❌     | auth.error.account_deleted            |
| `ACCOUNT_EMAIL_ALREADY_EXISTS`  | 409  | ❌     | auth.error.email_already_exists       |

### 6. POLICY_* — Errores de Política (400/403/429/503)

| Slug                      | HTTP | Retry? | Delay (ms)  | user_message_key              |
| ------------------------- | ---- | ------ | ----------- | ----------------------------- |
| `POLICY_INVALID_REQUEST`  | 400  | ❌     | 0           | auth.error.invalid_request    |
| `POLICY_NOT_FOUND`        | 403  | ❌     | 0           | auth.error.not_found          |
| `POLICY_RATE_LIMITED`     | 429  | ✅     | 15×60×1000  | auth.error.rate_limited       |
| `POLICY_SERVICE_DISABLED` | 503  | ✅     | 60×60×1000  | auth.error.service_disabled   |

---

## 🔄 Mapeo de Errores Supabase

### Función: mapSupabaseError()

```typescript
export function mapSupabaseError(error: unknown): AuthError {
  const message = String(error?.message || '');

  // Email ya existe
  if (message.includes('already registered') || message.includes('duplicate')) {
    return new AuthError(AUTH_ERROR_CODES.ACCOUNT_EMAIL_ALREADY_EXISTS);
  }

  // Credenciales inválidas
  if (message.includes('Invalid login credentials') || message.includes('wrong password')) {
    return new AuthError(AUTH_ERROR_CODES.AUTH_INVALID_CREDENTIALS);
  }

  // Email no verificado
  if (message.includes('Email not confirmed')) {
    return new AuthError(AUTH_ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED);
  }

  // Token expirado
  if (message.includes('expired') || message.includes('JWT expired')) {
    return new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED);
  }

  // Token inválido
  if (message.includes('invalid') && message.includes('token')) {
    return new AuthError(AUTH_ERROR_CODES.TOKEN_INVALID);
  }

  // Sesión inválida
  if (message.includes('session')) {
    return new AuthError(AUTH_ERROR_CODES.SESSION_INVALID);
  }

  // Rate limit desde Supabase
  if (
    message.includes('Too many requests') ||
    message.includes('rate_limit') ||
    message.includes('over_request_rate_limit')
  ) {
    return new AuthError(AUTH_ERROR_CODES.POLICY_RATE_LIMITED);
  }

  // Fail-closed: fallback a AUTH_UNKNOWN (no exponer mensaje crudo)
  return new AuthError(AUTH_ERROR_CODES.AUTH_UNKNOWN, { cause: error });
}
```

### Función: mapPolicyResultToAuthError()

```typescript
export function mapPolicyResultToAuthError(
  result: PolicyCheckResult
): AuthError | null {
  if (result.allowed) return null;

  switch (result.reason) {
    case 'feature_disabled':
      return new AuthError(AUTH_ERROR_CODES.POLICY_SERVICE_DISABLED, {
        cause: { kind: 'policy', result }
      });

    case 'rate_limited':
      return new AuthError(AUTH_ERROR_CODES.POLICY_RATE_LIMITED, {
        cause: { kind: 'policy', result }
      });

    case 'validation_failed':
      return new AuthError(AUTH_ERROR_CODES.POLICY_INVALID_REQUEST, {
        cause: { kind: 'policy', result }
      });

    default:
      return new AuthError(AUTH_ERROR_CODES.POLICY_NOT_FOUND, {
        cause: { kind: 'policy', result }
      });
  }
}
```

---

## ♻️ Retryability Logic

### Función: isRetryableError()

```typescript
export function isRetryableError(slug: string): boolean {
  const entry = AUTH_ERROR_TAXONOMY.find((e) => e.slug === slug);
  return entry?.retryable ?? false;
}
```

### Función: getRetryDelay()

```typescript
export function getRetryDelay(slug: string): number {
  switch (slug) {
    case 'POLICY_RATE_LIMITED':
      return 15 * 60 * 1000; // 15 minutos
    case 'POLICY_SERVICE_DISABLED':
      return 60 * 60 * 1000; // 1 hora
    case 'POLICY_MAINTENANCE':
      return 24 * 60 * 60 * 1000; // 24 horas
    default:
      return 0; // No delay (usuario decide)
  }
}
```

---

## 📤 Respuesta Pública

### Función: sendAuthError()

```typescript
export function sendAuthError(
  req: Request,
  res: Response,
  error: unknown,
  logContext?: Record<string, unknown>
): Response {
  const authError = asAuthError(error);
  const requestId = getRequestId(req);

  // Logging estructurado (sin PII)
  logger.warn('auth.error.generated', {
    error_slug: authError.slug,
    http_status: authError.http_status,
    retryable: authError.retryable,
    request_id: requestId,
    ...logContext
  });

  // Retry-After header (si delay > 0)
  const delay = getRetryDelay(authError.slug);
  if (delay > 0) {
    res.setHeader('Retry-After', Math.ceil(delay / 1000));
  }

  // Respuesta pública (NO mensajes técnicos, NO PII)
  return res.status(authError.http_status).json({
    success: false,
    error: authError.toPublicError(),
    request_id: requestId
  });
}
```

### Ejemplo de Respuesta

```json
{
  "success": false,
  "error": {
    "slug": "AUTH_INVALID_CREDENTIALS",
    "retryable": false
  },
  "request_id": "req_1234567890abcdef"
}
```

```json
{
  "success": false,
  "error": {
    "slug": "POLICY_RATE_LIMITED",
    "retryable": true
  },
  "request_id": "req_fedcba0987654321"
}
```

---

## 🔐 Security Considerations

### 1. User Enumeration Prevention

**Problema:** Atacante puede determinar si un email existe.

**Solución V2:**

```typescript
// ✅ CORRECTO: Mismo slug para "email no existe" y "password incorrecta"
if (userNotFound || passwordIncorrect) {
  throw new AuthError(AUTH_ERROR_CODES.AUTH_INVALID_CREDENTIALS);
}

// ❌ INCORRECTO: Revelar si email existe
if (userNotFound) {
  throw new AuthError(AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND);
}
if (passwordIncorrect) {
  throw new AuthError(AUTH_ERROR_CODES.AUTH_INVALID_CREDENTIALS);
}
```

**Excepciones aceptables:**

- `ACCOUNT_EMAIL_ALREADY_EXISTS` en signup (necesario para UX)
- `ACCOUNT_SUSPENDED` (usuario ya autenticado previamente)

### 2. No Exponer Detalles Técnicos

```typescript
// ✅ CORRECTO: Solo slug + retryable + request_id al frontend
return {
  success: false,
  error: {
    slug: 'AUTH_INVALID_CREDENTIALS',
    retryable: false
  },
  request_id: 'req_123'
};

// ❌ INCORRECTO: Exponer mensajes crudos, stack traces, o PII
return {
  success: false,
  error: {
    message: error.message, // ❌ Puede contener detalles técnicos
    stack: error.stack, // ❌ NUNCA en producción
    email: user.email // ❌ PII
  }
};
```

### 3. Logging Sin PII

```typescript
// ✅ CORRECTO: Hash o prefijo para identificación
logger.warn('auth.error.generated', {
  error_slug: 'AUTH_INVALID_CREDENTIALS',
  emailHash: sha256(email), // Hash irreversible
  ipPrefix: ip.split('.').slice(0, 2).join('.') + '.x.x',
  request_id: 'req_123'
});

// ❌ INCORRECTO: Loggear PII en plain text
logger.warn('auth error', {
  email: user.email, // ❌ PII
  password: '***', // ❌ NUNCA loggear passwords
  ip: req.ip // ❌ Puede ser PII según GDPR
});
```

---

## 🧪 Testing

### Unit Tests

Ver: `apps/backend-v2/tests/unit/utils/authErrorTaxonomy.test.ts`

```typescript
describe('AuthError', () => {
  test('toPublicError() only exposes slug + retryable', () => {
    const error = new AuthError(AUTH_ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    const publicError = error.toPublicError();

    expect(publicError).toEqual({
      slug: 'AUTH_INVALID_CREDENTIALS',
      retryable: false
    });
    expect(publicError).not.toHaveProperty('http_status');
    expect(publicError).not.toHaveProperty('user_message_key');
  });

  test('mapSupabaseError() fail-closed to AUTH_UNKNOWN', () => {
    const unknownError = { message: 'Something weird happened' };
    const authError = mapSupabaseError(unknownError);

    expect(authError.slug).toBe('AUTH_UNKNOWN');
  });

  test('POLICY_RATE_LIMITED is retryable with 15min delay', () => {
    const error = new AuthError(AUTH_ERROR_CODES.POLICY_RATE_LIMITED);

    expect(isRetryableError(error.slug)).toBe(true);
    expect(getRetryDelay(error.slug)).toBe(15 * 60 * 1000);
  });
});
```

### Contract Tests (Backend → Frontend)

Ver: `apps/backend-v2/tests/flow/auth-http.endpoints.test.ts`

```typescript
describe('Auth Error Contract V2', () => {
  test('POST /auth/login with invalid credentials returns V2 contract', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'bad@example.com', password: 'wrong' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        slug: 'AUTH_INVALID_CREDENTIALS',
        retryable: false
      },
      request_id: expect.any(String)
    });
  });

  test('Rate limited request includes Retry-After header', async () => {
    // Trigger rate limit (5 failed attempts)
    for (let i = 0; i < 5; i++) {
      await request(app).post('/auth/login').send({ email: 'test@example.com', password: 'wrong' });
    }

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'wrong' });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      success: false,
      error: {
        slug: 'POLICY_RATE_LIMITED',
        retryable: true
      },
      request_id: expect.any(String)
    });
    expect(response.headers['retry-after']).toBe('900'); // 15 min = 900 sec
  });
});
```

---

## 📚 Referencias

### SSOT v2

- **Sección 12.4:** Rate Limiting (para `POLICY_RATE_LIMITED`)
- **Sección 2.1:** Billing states (para subscription errors)

### Related Subnodos

- [login-flows.md](./login-flows.md) - Donde se lanzan estos errores
- [rate-limiting.md](./rate-limiting.md) - `POLICY_RATE_LIMITED` detalle
- [session-management.md](./session-management.md) - `SESSION_*`, `TOKEN_*` detalle
- [security.md](./security.md) - User enumeration, timing attacks

### Implementación

- **authErrorTaxonomy.ts:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts` ⭐
- **authErrorResponse.ts:** `apps/backend-v2/src/utils/authErrorResponse.ts` ⭐
- **Auth Service:** `apps/backend-v2/src/services/authService.ts` (usa `mapSupabaseError`, `mapPolicyResultToAuthError`)
- **Auth Routes:** `apps/backend-v2/src/routes/auth.ts` (usa `sendAuthError`)
- **Request ID Middleware:** `apps/backend-v2/src/middleware/requestId.ts` (genera `request_id`)
- **Frontend API Client:** `frontend/src/lib/api.ts` (parsea contrato V2)
- **Frontend Error Handler:** `frontend/src/lib/auth/errorHandler.ts` (resuelve por `slug`)

---

**Última actualización:** 2025-12-28  
**Owner:** ROA-405 (Auth Error Contract V2)  
**Status:** ✅ Active (V2 contract implemented)
