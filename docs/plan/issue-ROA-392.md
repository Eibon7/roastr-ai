# Plan de Implementación: ROA-392 - Rate Limit Policy Global v2

**Fecha:** 2025-01-07  
**Issue:** ROA-392  
**Título:** Rate Limit Policy Global v2  
**Prioridad:** P1  
**Tipo:** backend, docs, ci, analysis

---

## Estado Actual

Actualmente existen múltiples implementaciones dispersas de rate limiting:

1. **Auth Rate Limiting** (ROA-359):
   - `src/middleware/authRateLimiterV2.js`
   - Configuración hardcoded en SSOT v2 (sección 12.4)
   - Soporta password, magic_link, oauth, password_reset

2. **Ingestion Rate Limiting** (ROA-388):
   - `src/services/ingestion/policies/RateLimitPolicy.js`
   - Configuración hardcoded en SSOT v2 (sección 12.6)
   - Soporta global, perUser, perAccount

3. **Otros Rate Limiters** (Legacy):
   - `src/middleware/roastRateLimiter.js`
   - `src/middleware/roastrPersonaRateLimiter.js`
   - `src/middleware/passwordChangeRateLimiter.js`
   - `src/middleware/notificationRateLimiter.js`
   - `src/middleware/gdprRateLimiter.js`
   - `src/middleware/adminRateLimiter.js`
   - `src/middleware/rateLimiter.js` (genérico)

**Problemas identificados:**
- ❌ Configuraciones hardcoded (no cargadas desde SSOT dinámicamente)
- ❌ Implementaciones inconsistentes (algunos usan Redis, otros memoria)
- ❌ No hay política global unificada
- ❌ No hay gobernanza centralizada desde SSOT
- ❌ No hay feature flags para habilitar/deshabilitar rate limiting por scope

---

## Objetivos (ROA-392)

1. **Crear RateLimitPolicyGlobal v2**:
   - Política centralizada que carga configuración desde SSOT
   - Soporta múltiples scopes (auth, ingestion, roast, persona, notifications, gdpr, admin)
   - Hot-reload desde SettingsLoader v2
   - Fail-safe (bloquea si Redis falla)
   - Feature flags para habilitar/deshabilitar por scope

2. **Actualizar SSOT v2**:
   - Consolidar todas las configuraciones de rate limits en una sección unificada
   - Definir estructura `RateLimitPolicyConfig`
   - Añadir feature flags para control granular

3. **Migrar implementaciones existentes**:
   - Auth Rate Limiting → usar RateLimitPolicyGlobal
   - Ingestion Rate Limiting → usar RateLimitPolicyGlobal
   - Otros rate limiters → consolidar o deprecar

4. **Documentación**:
   - Actualizar nodo `14-infraestructura.md`
   - Crear subnodo `rate-limits.md`
   - Actualizar SSOT v2 con configuración global

5. **Tests**:
   - Unit tests para RateLimitPolicyGlobal
   - Integration tests con Redis
   - E2E tests para verificar feature flags

---

## Pasos de Implementación

### Paso 1: Actualizar SSOT v2 (docs/SSOT-V2.md)

**Acción:** Añadir sección `## 8.1 Rate Limiting Global v2 (ROA-392)`

**Contenido:**

```typescript
type RateLimitScope = 
  | 'auth'
  | 'ingestion' 
  | 'roast'
  | 'persona'
  | 'notifications'
  | 'gdpr'
  | 'admin'
  | 'global';

type RateLimitConfig = {
  max: number;              // Max requests in window
  windowMs: number;         // Window in milliseconds
  blockDurationMs?: number; // Optional progressive block duration
  enabled?: boolean;        // Default true
};

type RateLimitPolicyConfig = {
  global: RateLimitConfig;  // Global rate limit (all requests)
  auth: {
    password: RateLimitConfig;
    magic_link: RateLimitConfig;
    oauth: RateLimitConfig;
    password_reset: RateLimitConfig;
  };
  ingestion: {
    global: RateLimitConfig;
    perUser: RateLimitConfig;
    perAccount: RateLimitConfig;
  };
  roast: RateLimitConfig;
  persona: RateLimitConfig;
  notifications: RateLimitConfig;
  gdpr: RateLimitConfig;
  admin: RateLimitConfig;
  progressiveBlockDurations: number[]; // [15min, 1h, 24h, null]
};
```

**Valores por defecto:**

```typescript
const DEFAULT_RATE_LIMIT_POLICY: RateLimitPolicyConfig = {
  global: {
    max: 10000,
    windowMs: 3600000, // 1 hour
    enabled: true
  },
  auth: {
    password: {
      max: 5,
      windowMs: 900000, // 15 min
      blockDurationMs: 900000,
      enabled: true
    },
    magic_link: {
      max: 3,
      windowMs: 3600000, // 1 hour
      blockDurationMs: 3600000,
      enabled: true
    },
    oauth: {
      max: 10,
      windowMs: 900000, // 15 min
      blockDurationMs: 900000,
      enabled: true
    },
    password_reset: {
      max: 3,
      windowMs: 3600000, // 1 hour
      blockDurationMs: 3600000,
      enabled: true
    }
  },
  ingestion: {
    global: {
      max: 1000,
      windowMs: 3600000, // 1 hour
      enabled: true
    },
    perUser: {
      max: 100,
      windowMs: 3600000, // 1 hour
      enabled: true
    },
    perAccount: {
      max: 50,
      windowMs: 3600000, // 1 hour
      enabled: true
    }
  },
  roast: {
    max: 10,
    windowMs: 60000, // 1 min
    enabled: true
  },
  persona: {
    max: 3,
    windowMs: 3600000, // 1 hour
    enabled: true
  },
  notifications: {
    max: 10,
    windowMs: 60000, // 1 min
    enabled: true
  },
  gdpr: {
    max: 5,
    windowMs: 3600000, // 1 hour
    enabled: true
  },
  admin: {
    max: 100,
    windowMs: 60000, // 1 min
    enabled: true
  },
  progressiveBlockDurations: [
    900000,   // 15 min (1st infraction)
    3600000,  // 1 hour (2nd infraction)
    86400000, // 24 hours (3rd infraction)
    null      // Permanent (4th+ infraction)
  ]
};
```

**Feature Flags:**

```typescript
type RateLimitFeatureFlags = 
  | 'enable_rate_limit_global'
  | 'enable_rate_limit_auth'
  | 'enable_rate_limit_ingestion'
  | 'enable_rate_limit_roast'
  | 'enable_rate_limit_persona'
  | 'enable_rate_limit_notifications'
  | 'enable_rate_limit_gdpr'
  | 'enable_rate_limit_admin';
```

**Archivos afectados:**
- `docs/SSOT-V2.md` (nueva sección 8.1)

### Paso 2: Crear RateLimitPolicyGlobal v2

**Acción:** Crear servicio central de rate limiting

**Archivo:** `src/services/rateLimitPolicyGlobal.js`

**Funcionalidad:**
- Carga configuración desde SettingsLoader v2
- Soporta múltiples scopes (auth, ingestion, roast, etc.)
- Hot-reload con cache de 1 minuto
- Sliding window algorithm con Redis
- Fail-safe (bloquea si Redis falla)
- Feature flags para habilitar/deshabilitar por scope
- Logging estructurado
- Métricas de observabilidad

**Interfaz:**

```javascript
class RateLimitPolicyGlobal {
  async checkRateLimit(scope, key, metadata = {});
  async incrementRateLimit(scope, key, metadata = {});
  async getRateLimitStatus(scope, key);
  async clearRateLimit(scope, key);
  async getConfig(scope);
  _reloadConfig();
}
```

**Archivos afectados:**
- `src/services/rateLimitPolicyGlobal.js` (nuevo)

### Paso 3: Migrar Auth Rate Limiting

**Acción:** Refactorizar `authRateLimiterV2.js` para usar `RateLimitPolicyGlobal`

**Cambios:**
- Eliminar configuración hardcoded
- Usar `RateLimitPolicyGlobal` con scope `auth`
- Mantener compatibilidad con código existente
- Tests actualizados

**Archivos afectados:**
- `src/middleware/authRateLimiterV2.js` (refactor)

### Paso 4: Migrar Ingestion Rate Limiting

**Acción:** Refactorizar `RateLimitPolicy.js` para usar `RateLimitPolicyGlobal`

**Cambios:**
- Eliminar configuración hardcoded
- Usar `RateLimitPolicyGlobal` con scope `ingestion`
- Mantener interfaz `PolicyResult`
- Tests actualizados

**Archivos afectados:**
- `src/services/ingestion/policies/RateLimitPolicy.js` (refactor)

### Paso 5: Consolidar otros Rate Limiters

**Acción:** Refactorizar o deprecar rate limiters legacy

**Opción A (Migrar):**
- `roastRateLimiter.js` → usar RateLimitPolicyGlobal con scope `roast`
- `roastrPersonaRateLimiter.js` → usar RateLimitPolicyGlobal con scope `persona`
- `notificationRateLimiter.js` → usar RateLimitPolicyGlobal con scope `notifications`
- `gdprRateLimiter.js` → usar RateLimitPolicyGlobal con scope `gdpr`
- `adminRateLimiter.js` → usar RateLimitPolicyGlobal con scope `admin`

**Opción B (Deprecar):**
- Marcar como legacy si no se usan en rutas v2
- Crear issue de seguimiento para eliminar

**Archivos afectados:**
- `src/middleware/roastRateLimiter.js` (refactor o deprecar)
- `src/middleware/roastrPersonaRateLimiter.js` (refactor o deprecar)
- `src/middleware/notificationRateLimiter.js` (refactor o deprecar)
- `src/middleware/gdprRateLimiter.js` (refactor o deprecar)
- `src/middleware/adminRateLimiter.js` (refactor o deprecar)
- `src/middleware/passwordChangeRateLimiter.js` (refactor o deprecar)

### Paso 6: Actualizar SettingsLoader v2

**Acción:** Añadir carga de configuración de rate limits desde SSOT

**Cambios:**
- Añadir método `loadRateLimitPolicy()`
- Cache de 1 minuto
- Fallback a defaults si SSOT no disponible
- Validación de configuración

**Archivos afectados:**
- `src/services/settingsLoaderV2.js` (nuevo método)

### Paso 7: Documentación

**Acción:** Actualizar nodos GDD

**Archivos:**
- `docs/nodes-v2/14-infraestructura.md` (actualizar sección rate-limits)
- `docs/nodes-v2/infraestructura/rate-limits.md` (nuevo subnodo)

**Contenido subnodo:**
- Descripción de RateLimitPolicyGlobal v2
- Configuración desde SSOT
- Scopes soportados
- Feature flags
- Algoritmo sliding window
- Fail-safe behavior
- Ejemplos de uso
- Tests coverage

### Paso 8: Tests

**Unit Tests:**
- ✅ `RateLimitPolicyGlobal` - carga configuración
- ✅ `RateLimitPolicyGlobal` - sliding window algorithm
- ✅ `RateLimitPolicyGlobal` - fail-safe en Redis error
- ✅ `RateLimitPolicyGlobal` - feature flags por scope
- ✅ `RateLimitPolicyGlobal` - progressive block durations
- ✅ `RateLimitPolicyGlobal` - hot-reload configuración

**Integration Tests:**
- ✅ Auth rate limiting con RateLimitPolicyGlobal
- ✅ Ingestion rate limiting con RateLimitPolicyGlobal
- ✅ Redis sliding window correctamente
- ✅ Cache invalidation tras cambio SSOT

**E2E Tests:**
- ✅ Admin edita rate limit → sistema responde
- ✅ Feature flag deshabilitado → rate limiting OFF
- ✅ Rate limit excedido → retry_after correcto

**Archivos afectados:**
- `tests/unit/services/rateLimitPolicyGlobal.test.js` (nuevo)
- `tests/integration/rateLimitPolicyGlobal.integration.test.js` (nuevo)
- `tests/e2e/rateLimitPolicyGlobal.e2e.test.js` (nuevo)

### Paso 9: CI/CD

**Acción:** Validar configuración de rate limits en CI

**Script:** `scripts/validate-rate-limit-config.js`

**Validaciones:**
- ✅ Todos los scopes tienen configuración
- ✅ Valores numéricos en rango válido
- ✅ Feature flags existen
- ✅ No hay configuraciones hardcoded fuera de SSOT

**Archivos afectados:**
- `.github/workflows/ci.yml` (añadir validación)
- `scripts/validate-rate-limit-config.js` (nuevo)

---

## Agentes Necesarios

1. **TestEngineer**: Tests unitarios, integración y E2E
2. **Guardian**: Validación de SSOT y políticas de seguridad
3. **BackendDev**: Implementación de RateLimitPolicyGlobal v2

---

## Archivos Afectados

### Nuevos:
- `src/services/rateLimitPolicyGlobal.js`
- `docs/nodes-v2/infraestructura/rate-limits.md`
- `tests/unit/services/rateLimitPolicyGlobal.test.js`
- `tests/integration/rateLimitPolicyGlobal.integration.test.js`
- `tests/e2e/rateLimitPolicyGlobal.e2e.test.js`
- `scripts/validate-rate-limit-config.js`

### Modificados:
- `docs/SSOT-V2.md` (nueva sección 8.1)
- `docs/nodes-v2/14-infraestructura.md` (actualizar sección rate-limits)
- `src/services/settingsLoaderV2.js` (nuevo método loadRateLimitPolicy)
- `src/middleware/authRateLimiterV2.js` (refactor)
- `src/services/ingestion/policies/RateLimitPolicy.js` (refactor)
- `.github/workflows/ci.yml` (añadir validación)

### A Evaluar (Migrar o Deprecar):
- `src/middleware/roastRateLimiter.js`
- `src/middleware/roastrPersonaRateLimiter.js`
- `src/middleware/notificationRateLimiter.js`
- `src/middleware/gdprRateLimiter.js`
- `src/middleware/adminRateLimiter.js`
- `src/middleware/passwordChangeRateLimiter.js`
- `src/middleware/rateLimiter.js`

---

## Validación Pre-Commit

```bash
# 1. Validar SSOT
node scripts/validate-ssot-health.js --ci

# 2. Validar rate limit config
node scripts/validate-rate-limit-config.js

# 3. Validar nodos GDD
node scripts/validate-v2-doc-paths.js --ci

# 4. Tests
npm test -- rateLimitPolicyGlobal

# 5. Coverage
npm run test:coverage
```

---

## Riesgos y Mitigaciones

**Riesgo 1:** Cambiar configuración puede romper rate limiting existente
- **Mitigación:** Mantener valores por defecto idénticos a los actuales
- **Mitigación:** Tests de regresión exhaustivos

**Riesgo 2:** Redis fail puede bloquear todo el sistema
- **Mitigación:** Fail-safe implementado (bloquea solo rate limiting específico)
- **Mitigación:** Fallback a memoria si Redis no disponible (solo dev/test)

**Riesgo 3:** Hot-reload puede causar race conditions
- **Mitigación:** Cache con TTL de 1 minuto (ventana de inconsistencia aceptable)
- **Mitigación:** Validación atómica de configuración antes de aplicar

**Riesgo 4:** Feature flags mal configurados pueden desactivar rate limiting crítico
- **Mitigación:** Defaults fail-closed (enabled: true)
- **Mitigación:** Admin panel con validación estricta
- **Mitigación:** Logs de cambios de feature flags

---

## Definition of Done

- [ ] RateLimitPolicyGlobal v2 implementado y cargando desde SSOT
- [ ] SSOT v2 actualizado con configuración global unificada
- [ ] Auth rate limiting migrado a RateLimitPolicyGlobal
- [ ] Ingestion rate limiting migrado a RateLimitPolicyGlobal
- [ ] Otros rate limiters evaluados (migrados o deprecated)
- [ ] SettingsLoader v2 cargando configuración de rate limits
- [ ] Documentación actualizada (nodos GDD, subnodo rate-limits)
- [ ] Tests >= 90% coverage
- [ ] CI validando configuración de rate limits
- [ ] Sin configuraciones hardcoded fuera de SSOT
- [ ] Feature flags funcionando por scope
- [ ] Fail-safe verificado (Redis error no rompe sistema)
- [ ] Hot-reload verificado (admin edita → sistema responde)
- [ ] CodeRabbit = 0 comentarios
- [ ] Receipts generados (TestEngineer, Guardian)

---

**Plan generado:** 2025-01-07  
**Worktree:** /Users/emiliopostigo/roastr-ai-worktrees/ROA-392  
**Rama:** feature/ROA-392-auto

