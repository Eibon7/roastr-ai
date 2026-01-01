# Auth - Security

**Subnodo de:** `auth`  
**Última actualización:** 2026-01-01  
**Owner:** ROA-403

---

## 📋 Propósito

Define las características de seguridad implementadas en el sistema de autenticación v2.

---

## 🔐 JWT Validation

### Verificación en Cada Request

**Middleware:** `requireAuth` (apps/backend-v2/src/middleware/auth.ts)

**Validaciones automáticas (Supabase):**
- ✅ Firma JWT válida (verificación criptográfica)
- ✅ Token no expirado (`exp` claim)
- ✅ Token no revocado (check en Supabase DB)
- ✅ Usuario existe y está activo

**Enforcement:**
- Todos los endpoints protegidos DEBEN usar `requireAuth`
- Extracción segura de `userId` del token
- Adjunta `req.user` con shape validado

---

## 🛡️ Anti-Enumeration

### Respuestas Homogéneas

**Regla:** NUNCA revelar si un email/usuario existe o no.

**Implementación:**

#### Register
```typescript
// Respuesta SIEMPRE igual (incluso si email ya existe)
return res.json({ success: true });
```

#### Magic Link
```typescript
// Respuesta SIEMPRE igual (incluso si email no existe o es admin)
return res.json({
  success: true,
  message: "If this email exists, a magic link has been sent"
});
```

#### Password Recovery
```typescript
// Respuesta SIEMPRE igual
return res.json({
  success: true,
  message: "If this email exists, a password recovery link has been sent"
});
```

**Beneficio:** Previene user enumeration attacks.

---

## 🔒 State Parameter (OAuth)

**Status:** ⚠️ Preparado pero no implementado (OAuth pendiente)

### Propósito

Prevenir CSRF attacks en OAuth flows.

### Implementación Esperada

**Generación (initiation):**
```typescript
const state = crypto.randomBytes(32).toString('hex');

await redis.set(`oauth:state:${state}`, userId, {
  EX: 600 // TTL 10 minutos
});

return redirectToOAuthProvider({
  state,
  redirect_uri: process.env.SUPABASE_REDIRECT_URL
});
```

**Validación (callback):**
```typescript
const { state } = req.query;

const storedUserId = await redis.get(`oauth:state:${state}`);

if (!storedUserId) {
  throw new AuthError(AUTH_ERROR_CODES.TOKEN_INVALID); // State expired or invalid
}

await redis.del(`oauth:state:${state}`); // Single-use
```

**TTL:** 10 minutos (suficiente para flujo OAuth normal, previene replay attacks)

---

## 🧹 Request Sanitization

### Input Validation

**Email sanitization:**
```typescript
function normalizeEmail(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
}
```

**Password validation:**
- Mínimo 8 caracteres
- Máximo 128 caracteres (prevenir DoS)
- NO stripped (preservar espacios si usuario los quiere)

**Injection prevention:**
- Parameterized queries en DB (Supabase ORM)
- No eval() ni Function() con user input
- No concatenación de SQL strings

---

## 🙈 Error Messages Genéricos

### Anti-Information Leakage

**Regla:** Mensajes de error NUNCA deben revelar detalles internos.

**❌ MAL:**
```json
{
  "error": "User with email user@example.com not found in database table 'users'"
}
```

**✅ BIEN:**
```json
{
  "success": false,
  "error": {
    "slug": "AUTH_INVALID_CREDENTIALS",
    "retryable": false
  }
}
```

**Implementación:**
- AuthError taxonomy mapea a slugs genéricos
- Detalles técnicos solo en logs backend (no expuestos a cliente)

---

## 🔐 RLS Enforcement (Database-Level)

### Row Level Security

**Propósito:** Aislamiento multi-tenant a nivel de base de datos.

**Implementación (Supabase):**

```sql
-- Política RLS en tabla profiles
CREATE POLICY "Users can only access their own profile"
ON profiles
FOR ALL
USING (auth.uid() = user_id);

-- Política RLS en tabla roasts
CREATE POLICY "Users can only access their own roasts"
ON roasts
FOR ALL
USING (auth.uid() = user_id);
```

**Enforcement automático:**
- Supabase Auth provee `auth.uid()` en queries
- RLS policies se aplican automáticamente (no bypasseable desde código)
- Incluso service role queries pueden usar RLS (configuración)

**Testing:**
```sql
-- Intentar acceder a datos de otro usuario (DEBE fallar)
SELECT * FROM profiles WHERE user_id = 'otro-usuario-uuid';
-- Result: 0 rows (RLS blocked)
```

---

## 🚫 Security Headers

### Content Security Policy

**⚠️ Configurado en frontend, NO en backend API.**

Backend API es stateless (JSON-only), no sirve HTML.

### Recommended Frontend Headers

```typescript
// Next.js middleware o Vercel config
{
  headers: [
    {
      key: 'X-Frame-Options',
      value: 'DENY'
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff'
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin'
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=()'
    }
  ]
}
```

---

## 🔍 PII Protection

### Logging Sanitization

**Helper:** `truncateEmailForLog(email)`

**Implementación:**
```typescript
export function truncateEmailForLog(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain) return '***';
  
  const visibleChars = Math.min(3, localPart.length);
  const truncated = localPart.substring(0, visibleChars) + '***';
  
  return `${truncated}@${domain}`;
}
```

**Ejemplo:**
- `john.doe@example.com` → `joh***@example.com`
- `a@example.com` → `a***@example.com`

**Aplicación:**
- Todos los logs que incluyen emails DEBEN usar `truncateEmailForLog`
- Passwords NUNCA se loguean (ni truncados)
- Tokens solo últimos 4 caracteres: `...xyz`

### IP Anonymization

**Logging seguro:**
```typescript
const ipPrefix = ip.split('.').slice(0, 2).join('.') + '.x.x';
// 192.168.1.1 → 192.168.x.x
```

**GDPR compliance:** No almacenar IPs completas en logs persistentes.

---

## 🧪 Testing Security

### Unit Tests

**Ubicación:** `apps/backend-v2/tests/unit/`

**Test cases:**
- ✅ JWT validation con token inválido → 401
- ✅ JWT validation con token expirado → 401
- ✅ Anti-enumeration: register con email existente → 200 (no 409)
- ✅ Anti-enumeration: magic link con email no existente → 200
- ✅ Role validation: admin intenta magic link → respuesta homogénea
- ✅ Input sanitization: control characters removidos
- ✅ SQL injection attempts → sanitized/blocked

### Flow Tests

**Ubicación:** `apps/backend-v2/tests/flow/`

**Scenario: SQL Injection Attempt**
```typescript
it('should sanitize SQL injection in email', async () => {
  const maliciousEmail = "'; DROP TABLE users; --@example.com";
  
  const res = await request(app)
    .post('/api/v2/auth/login')
    .send({ email: maliciousEmail, password: 'password' });
  
  // Should fail auth (sanitized), NOT execute SQL
  expect(res.status).toBe(401);
  
  // Verify users table still exists
  const { data } = await supabase.from('users').select('count');
  expect(data).toBeDefined();
});
```

---

## 📚 Security Best Practices

### Checklist

- [x] JWT validation en todos los endpoints protegidos
- [x] Anti-enumeration en register, magic link, password recovery
- [x] State parameter con TTL en OAuth (preparado, no implementado)
- [x] Input sanitization (control characters, length limits)
- [x] Error messages genéricos (slugs, no detalles técnicos)
- [x] RLS policies en tablas multi-tenant
- [x] PII truncation en logs (emails, IPs)
- [x] NUNCA loguear passwords o tokens completos
- [x] Rate limiting + abuse detection
- [x] HTTPS-only en producción (redirect automático)

### Auditorías Periódicas

**Recomendación:** Audit security cada trimestre.

**Checklist de auditoría:**
1. Revisar logs por intentos de injection
2. Verificar rate limit effectiveness (métricas Prometheus)
3. Revisar abuse detection patterns (false positives/negatives)
4. Verificar RLS policies actualizadas
5. Penetration testing (externa o interna)
6. Dependency scan (npm audit, Snyk)

---

## 📚 Referencias

- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **JWT Best Practices:** https://datatracker.ietf.org/doc/html/rfc8725
- **Supabase RLS:** https://supabase.com/docs/guides/auth/row-level-security
- **GDPR Compliance:** `docs/nodes-v2/12-gdpr-legal.md`

---

**Última actualización:** 2026-01-01  
**Owner:** ROA-403  
**Status:** ✅ Active
