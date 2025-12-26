# Login v2 - Backend Authentication

**Versión:** 2.0  
**Fecha:** 2025-12-26  
**Issue:** ROA-360  
**Estado:** ✅ Implementado

---

## 📋 Overview

Sistema de autenticación backend v2 usando Supabase Auth con soporte para:
- Email/password login
- Magic links
- Feature flags para habilitar/deshabilitar auth
- Rate limiting y abuse detection
- Error taxonomy normalizada

---

## 🔐 POST /api/v2/auth/login

Endpoint principal para autenticación con email y password.

### Request

**Endpoint:** `POST /api/v2/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Schema:**
- `email` (string, required): Email del usuario (case-insensitive)
- `password` (string, required): Contraseña (min 8 caracteres, debe incluir número, minúscula, mayúscula o símbolo)

### Response (Success)

**Status:** `200 OK`

```json
{
  "ok": true,
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "v1.MXcVrPUb_xyz...",
    "expires_in": 3600,
    "expires_at": 1735234567,
    "token_type": "bearer",
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "role": "user",
      "email_verified": true,
      "created_at": "2025-12-26T10:00:00Z",
      "metadata": {}
    }
  }
}
```

**Fields:**
- `access_token`: JWT token para autenticación (válido 1 hora)
- `refresh_token`: Token para renovar sesión
- `expires_in`: Segundos hasta expiración (3600 = 1 hora)
- `expires_at`: Unix timestamp de expiración (en segundos)
- `token_type`: Siempre "bearer"
- `user.role`: "user" | "admin" | "superadmin"
- `user.email_verified`: true si email confirmado

### Response (Error)

**Status:** `400`, `401`, `403`, `429`, `500`

```json
{
  "ok": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

---

## 🚨 Error Codes

### Autenticación (401)

| Code | Status | Message | Causa |
|------|--------|---------|-------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid email or password | Credenciales incorrectas |
| `AUTH_EMAIL_NOT_VERIFIED` | 401 | Email not verified | Email no verificado |
| `AUTH_ACCOUNT_LOCKED` | 401 | Account locked | Cuenta bloqueada por abuso |
| `AUTH_RATE_LIMIT_EXCEEDED` | 429 | Too many login attempts | Rate limit excedido |
| `AUTH_DISABLED` | 401 | Authentication is currently unavailable | Feature flag deshabilitado |

### Sesión (401)

| Code | Status | Message | Causa |
|------|--------|---------|-------|
| `SESSION_EXPIRED` | 401 | Session expired | Token expirado |
| `SESSION_INVALID` | 401 | Invalid session | Token inválido |
| `TOKEN_MISSING` | 401 | No authentication token provided | Header Authorization faltante |

### Cuenta (403/404)

| Code | Status | Message | Causa |
|------|--------|---------|-------|
| `ACCOUNT_NOT_FOUND` | 404 | Account not found | Usuario no existe |
| `ACCOUNT_SUSPENDED` | 403 | Account suspended | Cuenta suspendida |
| `EMAIL_ALREADY_EXISTS` | 400 | Email already exists | Email duplicado (signup) |

---

## 🎛️ Feature Flag Behavior

### `auth.login.enabled`

**Source:** `admin-controlled.yaml` o `admin_settings` table (Supabase)

**Default:** `true`

**Fallback:** `process.env.AUTH_LOGIN_ENABLED` (si SettingsLoader falla)

**Implementación:**
```typescript
// Check ejecutado al inicio de login(), antes de rate limiting
const settings = await loadSettings();
const loginEnabled = settings?.auth?.login?.enabled ?? true;

if (!loginEnabled) {
  throw new AuthError(
    AUTH_ERROR_CODES.AUTH_DISABLED,
    'Authentication is currently unavailable.'
  );
}
```

**Casos de uso:**
- Mantenimiento del sistema
- Incident response (deshabilitar logins durante ataque)
- Testing de frontend con auth deshabilitado

**Otros flags disponibles:**
- `auth.signup.enabled` (default: true)
- `auth.magic_link.enabled` (default: true)

---

## 🛡️ Rate Limiting

### Progressive Blocking Strategy

El sistema implementa rate limiting progresivo:

| Intento | Bloqueo |
|---------|---------|
| 1-5 | Ninguno |
| 6-10 | 15 minutos |
| 11-20 | 1 hora |
| 21-50 | 24 horas |
| 51+ | Permanente (requiere contacto con soporte) |

**Implementación:**
```typescript
const rateLimitResult = rateLimitService.recordAttempt('login', ip);
if (!rateLimitResult.allowed) {
  throw new AuthError(AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED, message);
}
```

**Configuración (hardcoded en v1, configurable en futuro):**
```typescript
const RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 intentos en 15min
  signup: { windowMs: 60 * 60 * 1000, max: 3 }, // 3 intentos en 1h
  magic_link: { windowMs: 60 * 60 * 1000, max: 5 } // 5 intentos en 1h
};
```

### Abuse Detection

Sistema complementario de detección de patrones de abuso:

**Patrones detectados:**
1. **Multi-IP**: Mismo email desde 3+ IPs en 1 hora
2. **Multi-Email**: Misma IP probando 5+ emails en 1 hora
3. **Burst Attack**: 10+ intentos en 1 minuto
4. **Slow Attack**: 20+ intentos en 30 minutos

**Respuesta:** Lanza `AUTH_ACCOUNT_LOCKED` con mensaje genérico (no expone patrón detectado)

---

## 🔗 Relación con A4 Contract

**A4 (Admin API)** y **Login v2** son sistemas complementarios:

| Aspecto | Login v2 (ROA-360) | A4 Admin API |
|---------|-------------------|--------------|
| **Propósito** | Autenticación de usuarios | Gestión administrativa |
| **Endpoints** | `/api/v2/auth/*` | `/api/v2/admin/*` |
| **Autenticación** | Genera tokens JWT | Requiere tokens JWT con role admin |
| **Rate Limiting** | Público (estricto) | Admin (permisivo) |
| **Feature Flags** | `auth.login.enabled` | `admin.api.enabled` |
| **Error Taxonomy** | `AUTH_*`, `SESSION_*` | `AUTHZ_*`, `ADMIN_*` |

**Flujo típico:**
1. Usuario hace login → `/api/v2/auth/login` (Login v2)
2. Recibe JWT con `role: "admin"`
3. Usa JWT para acceder → `/api/v2/admin/users` (A4)
4. A4 valida token con `requireAuth` + `requireRole('admin')`

**Middleware compartido:**
- `requireAuth` - Valida JWT (usado por ambos)
- `requireRole` - Valida roles admin (solo A4)
- `rateLimitByType` - Rate limiting (ambos, límites diferentes)

---

## 📊 Tests & Coverage

**Tests implementados:** 82 unit tests  
**Coverage:** 92%

**Archivos testeados:**
- `authService.test.ts` - Core auth logic
- `rateLimitService.test.ts` - Rate limiting (27 tests)
- `abuseDetectionService.test.ts` - Abuse patterns (15 tests)
- `authErrorTaxonomy.test.ts` - Error mapping

**Próximos pasos:**
- ✅ Unit tests completos
- ⏳ Integration tests (signup → login → logout)
- ⏳ E2E tests con Playwright

---

## 🔧 Configuration

### Environment Variables

**Required:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

**Optional:**
```bash
AUTH_LOGIN_ENABLED=true  # Fallback si SettingsLoader falla
NODE_ENV=production      # test | development | production
```

### SSOT Configuration

**File:** `apps/backend-v2/src/config/admin-controlled.yaml`

```yaml
auth:
  login:
    enabled: true
  signup:
    enabled: true
  magic_link:
    enabled: true
```

**Database:** `admin_settings` table (overrides YAML)

```sql
-- Runtime override (priority over YAML)
INSERT INTO admin_settings (key, value) 
VALUES ('auth.login.enabled', 'false');
```

---

## 🚀 Usage Examples

### Basic Login

```typescript
const response = await fetch('https://api.roastr.ai/v2/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!'
  })
});

const data = await response.json();

if (data.ok) {
  const { access_token, user } = data.session;
  // Store token, redirect to dashboard
} else {
  const { code, message } = data.error;
  // Handle error (show message to user)
}
```

### Handle Rate Limiting

```typescript
try {
  const data = await login(email, password);
} catch (error) {
  if (error.code === 'AUTH_RATE_LIMIT_EXCEEDED') {
    // Show "Too many attempts, try again in X minutes"
    const retryAfter = extractRetryTime(error.message);
    showError(`Try again in ${retryAfter} minutes`);
  } else if (error.code === 'AUTH_INVALID_CREDENTIALS') {
    // Show "Invalid email or password"
    showError('Invalid credentials');
  }
}
```

### Check Feature Flag (Admin)

```typescript
// Disable login during maintenance
await fetch('https://api.roastr.ai/v2/admin/settings', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    key: 'auth.login.enabled',
    value: false
  })
});

// All login attempts will now return AUTH_DISABLED
```

---

## 🔍 Security Considerations

### ✅ Implemented

1. **No credential logging** - Passwords nunca se loggean
2. **PII anonymization** - Emails/IPs se hashean en logs (GDPR compliant)
3. **Generic error messages** - No se exponen detalles internos
4. **Rate limiting** - Protección contra brute force
5. **Abuse detection** - Detección de patrones avanzados
6. **Password validation** - Min 8 chars, complejidad requerida
7. **Email verification** - Opcional (configurable en Supabase)
8. **Session expiry** - Tokens expiran en 1 hora

### ⚠️ Considerations

1. **Admin email enumeration** - Magic links retornan mensaje genérico para admins
2. **Token refresh** - Implementar refresh automático en frontend
3. **MFA** - No implementado aún (futuro)
4. **CORS** - Configurar origins permitidos en producción

---

## 📚 Related Documentation

- **SSOT v2:** `docs/SSOT-V2.md` - Single Source of Truth
- **Auth System:** `AUTH_SYSTEM.md` - Overview completo
- **A4 Contract:** `docs/contracts/admin-api-v2.md` - Admin API
- **Error Taxonomy:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts` - Códigos completos
- **Test Evidence:** `docs/test-evidence/ROA-360/summary.md` - Tests ejecutados

---

## 🐛 Troubleshooting

### Error: "Authentication is currently unavailable"

**Causa:** Feature flag `auth.login.enabled` está deshabilitado

**Solución:**
```bash
# Verificar configuración
cat apps/backend-v2/src/config/admin-controlled.yaml | grep -A 3 "auth:"

# O verificar env var
echo $AUTH_LOGIN_ENABLED
```

### Error: "Too many login attempts"

**Causa:** Rate limit excedido

**Solución:** Esperar el tiempo indicado en el mensaje o contactar soporte si bloqueado permanentemente

### Error: "Invalid session"

**Causa:** Token JWT expirado o inválido

**Solución:** Renovar token con `/api/v2/auth/refresh` usando refresh_token

---

**Última actualización:** 2025-12-26  
**Autor:** Backend v2 Team  
**Issue:** ROA-360

