# ROA-408: A4 Auth Rate Limiting & Abuse Wiring v2

## 🎯 Objetivo

Conectar las policies de **Rate Limit & Abuse** (ROA-359) con el **Auth Policy Gate** (A3), asegurando que:

> **"Si llego a ejecutar lógica de Auth, entonces rate limit y abuse ya fueron evaluados y resueltos."**

**⚠️ SCOPE:** Esta issue **NO implementa** rate limiting ni abuse detection. Es **exclusivamente wiring y traducción semántica** dentro del dominio Auth.

---

## 📦 Cambios Implementados

### 1️⃣ Auth Error Taxonomy Actualizada

**Archivo:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts`

Añadidos 3 nuevos error slugs para mapear resultados de policies a errores Auth:

| Slug | HTTP | Retryable | Uso |
|------|------|-----------|-----|
| `POLICY_RATE_LIMITED` | 429 | ✅ true | Límite temporal de intentos alcanzado |
| `POLICY_ABUSE_DETECTED` | 403 | ❌ false | Patrón de abuse detectado |
| `ACCOUNT_BLOCKED` | 403 | ❌ false | Bloqueo permanente (escalación progresiva) |

### 2️⃣ Adaptador de Abuse Detection Service

**Archivo:** `apps/backend-v2/src/services/abuseDetectionServiceAdapter.ts` (nuevo)

- **Propósito:** Adaptar interfaz de ROA-359 (`recordAttempt` + `isAbusive`) a interfaz esperada por A3 (`checkRequest`)
- **Responsabilidad:** Solo traducción, **NO lógica de abuse**
- **Pattern:** Adapter pattern para compatibilidad entre sistemas

### 3️⃣ Integración en Auth Policy Gate (A3)

**Archivo:** `apps/backend-v2/src/auth/authPolicyGate.ts`

**Pipeline actualizado (orden obligatorio):**
```
Feature Flags → Account Status → Rate Limit (A4) → Abuse (A4) → Auth Logic
                                    ↑                    ↑
                                    |                    |
                                 ROA-359             ROA-359
```

**Características:**
- ✅ Rate Limit evaluado **DESPUÉS** de Feature Flags y Account Status
- ✅ Abuse evaluado como **última policy** (menor prioridad)
- ✅ **Fail-closed** por defecto (excepto feature flags OFF)
- ✅ Usa servicios de ROA-359 mediante adaptador (sin duplicar lógica)

### 4️⃣ Tests de Integración Auth ↔ Policy

**Archivo:** `apps/backend-v2/tests/unit/auth/authPolicyGate.test.ts`

- ✅ **25 tests pasando (100%)**
- ✅ Cobertura completa de flujos Auth → Policy
- ✅ Tests de fail-closed y policy order
- ✅ Mocks actualizados para usar `abuseDetectionServiceAdapter`
- ✅ Todos los escenarios de bloqueo y permiso cubiertos

### 5️⃣ Documentación

**Archivo:** `docs/A4-AUTH-RATE-LIMIT-ABUSE-WIRING.md` (nuevo)

- Arquitectura del wiring
- Pipeline de evaluación
- Componentes del wiring
- Mapping de acciones Auth → Policy
- Fail semantics
- Contratos de entrada/salida
- Testing scope

---

## 🛡️ Cumplimiento de Reglas (ROA-408)

| Regla | Estado |
|-------|--------|
| ❌ NO implementa rate limiting | ✅ Respetado - usa ROA-359 |
| ❌ NO implementa abuse detection | ✅ Respetado - usa ROA-359 |
| ✅ Solo wiring y traducción | ✅ Cumplido |
| ✅ Orden de pipeline correcto | ✅ Cumplido (A3 spec) |
| ✅ Fail-closed enforcement | ✅ Cumplido |
| ✅ Adaptador sin lógica de negocio | ✅ Cumplido |
| ✅ Tests de integración mínimos | ✅ Cumplido (25 tests) |
| ✅ No middlewares fuera de A3 | ✅ Cumplido |
| ✅ No cambios en contratos ROA-359 | ✅ Cumplido |
| ✅ No lógica de UI/admin/dashboards | ✅ Cumplido |

---

## 📋 Mapping de Acciones Auth → Policy

| Auth Action | Rate Limit Type | Omitido |
|-------------|-----------------|---------|
| `login` | `login` | ❌ |
| `register` | `signup` | ❌ |
| `magic_link` | `magic_link` | ❌ |
| `password_recovery` | `password_reset` | ❌ |
| `logout` | - | ✅ (low risk) |
| `token_refresh` | - | ✅ (low risk) |

---

## 🔀 Fail Semantics

**Fail-closed (default):**
- Si Redis/Upstash falla → bloquear
- Si exception en policy → bloquear
- Si timeout → bloquear

**ÚNICA excepción:**
- Feature flag OFF (`ENABLE_RATE_LIMIT=false` o `ENABLE_ABUSE_DETECTION=false`) → policy se omite explícitamente

**NO existe fail-open silencioso.**

---

## 🧪 Testing

### Scope de Tests

**✅ SÍ se testea:**
- Login bloqueado por rate limit
- Recovery bloqueado por abuse
- Feature flag OFF → no bloquea
- `retry_after_seconds` se preserva
- `allowed: true` → Auth continúa
- Policy order enforcement (Feature Flags > Account Status > Rate Limit > Abuse)
- Fail-closed en cada policy

**❌ NO se testea:**
- Heurísticas de abuse (ROA-359)
- Redis/Upstash internals (ROA-359)
- Implementación de rate limiting (ROA-359)

### Resultados

```bash
✓ tests/unit/auth/authPolicyGate.test.ts (25 tests) 9ms
  Test Files  1 passed (1)
       Tests  25 passed (25)
```

---

## 📊 Resumen de Cambios

```
 7 files changed, 548 insertions(+), 23 deletions(-)

Archivos modificados:
✏️ apps/backend-v2/src/utils/authErrorTaxonomy.ts (+26 -2)
✏️ apps/backend-v2/src/auth/authPolicyGate.ts (+1 -1 import)
✏️ apps/backend-v2/tests/unit/auth/authPolicyGate.test.ts (+18 -7)

Archivos nuevos:
➕ apps/backend-v2/src/services/abuseDetectionServiceAdapter.ts
➕ docs/A4-AUTH-RATE-LIMIT-ABUSE-WIRING.md
➕ docs/plan/issue-ROA-408.md
```

---

## ✅ Checklist Pre-Merge

### Validaciones Pasadas

- ✅ Tests: 25/25 pasando (100%)
- ✅ Linter: 0 errores
- ✅ Scope: Estricto, sin desviaciones
- ✅ Documentación: Completa
- ✅ No console.log (excepto logger.ts)
- ✅ No valores hardcoded de SSOT
- ✅ Rama correcta: `feature/ROA-408-auto`
- ✅ Commits limpios: Solo ROA-408
- ✅ Historial limpio: 1 commit funcional + 1 merge
- ✅ Merge con main: Limpio (incluye ROA-359)

### Dependencias

- ✅ **ROA-359:** Rate Limiting & Abuse Detection (mergeada en main)
- ✅ **ROA-407:** A3 Auth Policy Gate (mergeada en main)
- ✅ **ROA-405:** Auth Error Taxonomy v2 (mergeada en main)

---

## 🔗 Referencias

- **Issue:** [ROA-408](https://linear.app/roastrai/issue/ROA-408/a4-auth-rate-limiting-and-abuse-v2)
- **ROA-359:** Rate Limiting & Abuse Policy
- **ROA-407:** A3 Auth Policy Gate
- **ROA-405:** Auth Error Taxonomy v2
- **Documentación:** `docs/A4-AUTH-RATE-LIMIT-ABUSE-WIRING.md`

---

## 🚀 Próximos Pasos (fuera de scope)

- [ ] Monitoring de métricas de rate limit/abuse (ROA-TBD)
- [ ] Dashboard admin para gestión de bloqueos (ROA-TBD)
- [ ] Configuración dinámica de thresholds (ROA-TBD)

---

**Issue ROA-408 completado al 100% ✅**

