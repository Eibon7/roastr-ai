# A4: Auth Rate Limiting & Abuse Wiring (ROA-408)

**⚠️ Este documento describe solo el wiring. La lógica de rate limit y abuse viene de ROA-359.**

## 🎯 Propósito

Conectar las policies de Rate Limit & Abuse (ROA-359) con el Auth Policy Gate (A3), asegurando que:

> "Si llego a ejecutar lógica de Auth, entonces rate limit y abuse ya fueron evaluados y resueltos."

## 🔗 Arquitectura del Wiring

### Pipeline de Evaluación (dentro de A3)

```
Feature Flags → Account Status → Rate Limit → Abuse → Auth Logic
                                    ↑            ↑
                                    |            |
                              ROA-359        ROA-359
```

**Orden obligatorio:**
1. Feature Flags (más alta prioridad)
2. Account Status
3. **Rate Limit** (A4 - wiring ROA-408)
4. **Abuse** (A4 - wiring ROA-408)
5. Auth Logic (solo si todos pasaron)

## 📦 Componentes del Wiring

### 1. Auth Error Taxonomy (A1)

**Archivo:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts`

Nuevos errores agregados:

| Slug | HTTP | Retryable | Uso |
|------|------|-----------|-----|
| `POLICY_RATE_LIMITED` | 429 | ✅ true | Temporary rate limit hit |
| `POLICY_ABUSE_DETECTED` | 403 | ❌ false | Abuse pattern detected |
| `ACCOUNT_BLOCKED` | 403 | ❌ false | Permanent block (after progressive escalation) |

### 2. Abuse Detection Service Adapter

**Archivo:** `apps/backend-v2/src/services/abuseDetectionServiceAdapter.ts`

**Propósito:** Adaptar interfaz de ROA-359 (`recordAttempt` + `isAbusive`) a interfaz esperada por A3 (`checkRequest`).

**Responsabilidad:** Solo traducción, NO lógica de abuse.

```typescript
// Interfaz esperada por authPolicyGate
interface AbuseCheckRequest {
  ip: string;
  email?: string;
  userId?: string;
  action: AuthAction;
  userAgent?: string;
}

// Adaptador:
abuseDetectionServiceAdapter.checkRequest(request) → boolean
```

### 3. Auth Policy Gate (A3)

**Archivo:** `apps/backend-v2/src/auth/authPolicyGate.ts`

**Cambios:**
- Import de `abuseDetectionServiceAdapter` (reemplaza `abuseDetectionService`)
- Método `checkAbuse` usa adaptador
- Método `checkRateLimit` usa `rateLimitService` de ROA-359

## 🔀 Mapping de Acciones

Auth Action → Rate Limit Type:

| Auth Action | Rate Limit Type |
|-------------|-----------------|
| `login` | `login` |
| `register` | `signup` |
| `magic_link` | `magic_link` |
| `password_recovery` | `password_reset` |
| `logout` | (omitido) |
| `token_refresh` | (omitido) |

## 🛡️ Fail Semantics

**Fail-closed (default):**
- Si Redis/Upstash falla → bloquear
- Si exception en policy → bloquear
- Si timeout → bloquear

**ÚNICA excepción:**
- Feature flag OFF (`ENABLE_RATE_LIMIT=false` o `ENABLE_ABUSE_DETECTION=false`) → policy se omite explícitamente

**NO existe fail-open silencioso.**

## 🚩 Feature Flags (ROA-408 CRITICAL)

**Respetando AC6:**

| Feature Flag | Comportamiento OFF | Comportamiento ON |
|-------------|-------------------|-------------------|
| `ENABLE_RATE_LIMIT` | Policy omitida (no evalúa) | Rate limit se enforce |
| `ENABLE_ABUSE_DETECTION` | Policy omitida (no evalúa) | Abuse detection se enforce |

**Implementación:**

En `authPolicyGate.ts`:

```typescript
private async checkRateLimit(context: AuthPolicyContext): Promise<AuthPolicyResult> {
  // Check if rate limiting is enabled (ROA-408 requirement)
  const settings = await loadSettings();
  if (!settings?.feature_flags?.ENABLE_RATE_LIMIT) {
    return { allowed: true, retryable: false };
  }
  // ... rest of rate limit logic
}

private async checkAbuse(context: AuthPolicyContext): Promise<AuthPolicyResult> {
  // Check if abuse detection is enabled (ROA-408 requirement)
  const settings = await loadSettings();
  if (!settings?.feature_flags?.ENABLE_ABUSE_DETECTION) {
    return { allowed: true, retryable: false };
  }
  // ... rest of abuse detection logic
}
```

**⚠️ CRITICAL:** Si feature flag es ON y policy falla (error interno), se aplica fail-closed (bloquea).

## 📋 Contrato de Policy Result

**Input (desde Auth):**
```typescript
{
  action: 'login' | 'register' | ...
  ip: string
  email?: string
  userId?: string
  auth_type: 'password' | 'magic_link' | 'oauth'
}
```

**Output (hacia Auth):**
```typescript
{
  allowed: boolean
  policy?: 'rate_limit' | 'abuse'
  reason?: string
  retryable: boolean
  retryAfterSeconds?: number  // solo para rate limit
}
```

## 🧪 Testing

**Scope:** Integration tests Auth ↔ Policy

**NO se testea:**
- ❌ Heurísticas de abuse (ROA-359)
- ❌ Redis/Upstash internals (ROA-359)

**SÍ se testea:**
- ✅ Login bloqueado por rate limit
- ✅ Recovery bloqueado por abuse
- ✅ Feature flag OFF → no bloquea (CRÍTICO ROA-408)
- ✅ Feature flag ON → policy se enforcea (CRÍTICO ROA-408)
- ✅ `retry_after_seconds` se preserva
- ✅ `allowed: true` → Auth continúa
- ✅ Policy order enforcement
- ✅ Fail-closed en cada policy

**Tests añadidos (29 total):**
- 4 tests de feature flags (`ENABLE_RATE_LIMIT`, `ENABLE_ABUSE_DETECTION`)
- 10 tests de fail semantics
- 15 tests existentes de policy order y contracts

## 📖 Referencias

- **ROA-359:** Implementación de rate limit & abuse
- **A3:** Auth Policy Gate
- **A1:** Auth Error Taxonomy
- **A4:** Este wiring (ROA-408)

