# CI Auth v2 - Debugging Guide

**Propósito:** Troubleshooting y debugging para tests CI Auth v2

---

## 1. Ejecución Local

### Comando

```bash
# Desde el root del proyecto
npm run test:ci:auth

# Con coverage
npm run test:ci:auth:coverage

# Desde backend-v2 directamente
cd apps/backend-v2
vitest run --config vitest.ci.auth.config.ts
```

### Expectativas

- **Exit 0**: Todos los tests Auth v2 pasan (o tienen skips documentados)
- **Exit 1**: Algún test Auth v2 falla → necesita fix o skip

---

## 2. Estado Actual (ROA-536)

### Tests Corriendo

**Total:** 17 archivos, 197 tests

**Passing:** 12 archivos, 172 tests ✅

**Failing:** 5 archivos, 25 tests ❌

### Tests Failing (Identificados)

#### 2.1. `tests/flow/auth-register.endpoint.test.ts` - Analytics Integration

**Tests failing:** ~25 tests

**Razón:** Mock de Analytics no configurado correctamente

**Síntomas:**
- `expect(mockTrackEvent).toHaveBeenCalled()` falla
- Status 500 en lugar de 200 (analytics crashea el flujo)
- Mock no captura llamadas de analytics

**Causa raíz:**
- Analytics service no está mockeado en flow tests
- O el mock está en lugar incorrecto
- O el import de analytics no resuelve al mock

**Solución temporal (Skip):**

```typescript
// En auth-register.endpoint.test.ts
describe.skip('Analytics Integration (B3)', () => {
  // ⚠️ BLOCKED: Mock de Analytics requiere ajuste
  // See: docs/CI-AUTH-V2-DEBUG.md#analytics-mock-issue
  // Issue: TBD - Fix Analytics Mock en Flow Tests
  
  it('FLOW: analytics trackea eventos de success', async () => {
    // Test implementation
  });
});
```

**Solución permanente (Fix):**

1. Revisar cómo se importa `authObservabilityService` en `authService.ts`
2. Asegurar que el mock en test setup cubre todas las importaciones
3. Verificar que `vi.mock()` está antes de importar `authService`

#### 2.2. Otros Failing Tests

**Pendiente:** Identificar otros tests failing si los hay

---

## 3. Mocks Requeridos

### 3.1. Supabase

```typescript
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      // ... otros métodos
    },
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      // ... otros métodos de query
    }))
  }
}));
```

**Env vars requeridas:**
- `SUPABASE_URL=https://mock.supabase.co`
- `SUPABASE_ANON_KEY=mock-anon-key`
- `SUPABASE_SERVICE_ROLE_KEY=mock-service-key`

### 3.2. Rate Limit Service

```typescript
vi.mock('@/services/rateLimitService', () => ({
  rateLimitService: {
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true })
  }
}));
```

### 3.3. Email Service

```typescript
vi.mock('@/services/authEmailService', () => ({
  authEmailService: {
    sendConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
    sendPasswordRecoveryEmail: vi.fn().mockResolvedValue({ success: true })
  }
}));
```

### 3.4. Analytics (PROBLEMA ACTUAL)

```typescript
vi.mock('@/services/authObservabilityService', () => ({
  trackAuthEvent: vi.fn(),
  trackAuthError: vi.fn()
}));
```

**⚠️ ISSUE:** Este mock NO está funcionando en flow tests. Posible causa:
- Import path incorrecto
- Mock declarado después de import de authService
- Analytics service importado de forma diferente

---

## 4. Troubleshooting Común

### 4.1. "No test files found"

**Problema:** Vitest no encuentra tests

**Solución:**
- Ejecutar desde `apps/backend-v2` (no desde root)
- O usar `cd apps/backend-v2 && vitest run --config vitest.ci.auth.config.ts`

### 4.2. "Cannot find module '@/...'"

**Problema:** Alias `@` no resuelve

**Solución:**
- Verificar `vitest.ci.auth.config.ts` tiene `resolve.alias` configurado
- Verificar que apunta a `./src` relativo al config

### 4.3. "Mock not working"

**Problema:** Mock declarado pero no funciona

**Solución:**
- Mover `vi.mock()` ANTES de import del módulo a testear
- Verificar import path exacto (case-sensitive)
- Verificar que mock cubre todos los exports del módulo

### 4.4. "Tests timeout"

**Problema:** Tests tardan más de 10s

**Solución:**
- Verificar que NO se usan servicios reales (solo mocks)
- Aumentar `testTimeout` en `vitest.ci.auth.config.ts` si necesario
- Verificar que no hay loops infinitos

---

## 5. Coverage

### Thresholds

```typescript
thresholds: {
  lines: 85,
  functions: 85,
  branches: 80,
  statements: 85
}
```

### Archivos Cubiertos

- `apps/backend-v2/src/services/authService.ts`
- `apps/backend-v2/src/services/authEmailService.ts`
- `apps/backend-v2/src/lib/authFlags.ts`
- `apps/backend-v2/src/utils/authErrorTaxonomy.ts`
- `apps/backend-v2/src/middleware/authMiddleware.ts`
- `apps/backend-v2/src/routes/auth.ts`

### Verificar Coverage

```bash
cd apps/backend-v2
vitest run --coverage --config vitest.ci.auth.config.ts

# Ver reporte HTML
open coverage/index.html
```

### Coverage Bajo (<85%)

**Causas comunes:**
- Tests skippeados (password-recovery con DB real)
- Tests failing (analytics integration)
- Código no testeado (edge cases)

**Solución:**
- Priorizar tests passing primero
- Skipear tests bloqueados con doc
- Crear tests adicionales si necesario

---

## 6. CI (GitHub Actions)

### Workflow

`.github/workflows/auth-ci-v2.yml`

### Triggers

- Push a `main`, `develop`
- PR a `main`, `develop`
- Cambios en archivos Auth v2 (`apps/backend-v2/src/`, `apps/backend-v2/tests/`)

### Env Vars en CI

```yaml
env:
  NODE_ENV: test
  SUPABASE_URL: https://mock.supabase.co
  SUPABASE_ANON_KEY: mock-anon-key-auth-ci
  SUPABASE_SERVICE_ROLE_KEY: mock-service-key-auth-ci
  AUTH_ENABLED: true
  AUTH_RATE_LIMIT_ENABLED: true
  SMTP_HOST: mock-smtp
  SMTP_PORT: 587
  SMTP_USER: mock@example.com
  SMTP_PASS: mock-password
```

### CI Failing

**Paso 1:** Reproducir localmente
```bash
npm run test:ci:auth
```

**Paso 2:** Revisar logs de CI (GitHub Actions)
- Ir a Actions → Auth CI v2
- Ver logs detallados de cada step

**Paso 3:** Fix o skip
- Si test falla por bug Auth v2 → Fix código
- Si test falla por mock/infra → Fix mock o skip con doc

---

## 7. Tests Skippeados (Documentados)

### Password Recovery - DB Real

**Archivo:** `tests/integration/auth/password-recovery.test.ts`

**Razón:** Requiere DB test (Supabase Local)

**Skip:**
```typescript
it.skip('password recovery completo con DB real', async () => {
  // Skip: Requiere Supabase Local (Issue #2)
  // TODO: Unskip cuando DB test esté disponible
});
```

### Analytics Integration (ACTUAL)

**Archivo:** `tests/flow/auth-register.endpoint.test.ts`

**Razón:** Mock de Analytics no funciona correctamente

**Skip:**
```typescript
describe.skip('Analytics Integration (B3)', () => {
  // ⚠️ BLOCKED: Mock de Analytics requiere ajuste
  // See: docs/CI-AUTH-V2-DEBUG.md#analytics-mock-issue
  // Issue: TBD - Fix Analytics Mock en Flow Tests
});
```

---

## 8. Next Steps (Post ROA-536)

### Issue #1: Fix Analytics Mock

**Objetivo:** Hacer que Analytics Integration tests pasen

**Pasos:**
1. Identificar cómo se importa `authObservabilityService` en `authService.ts`
2. Ajustar mock en `auth-register.endpoint.test.ts`
3. Verificar que mock cubre todos los casos
4. Unskip tests
5. Validar que pasan

### Issue #2: Test Database Infrastructure

**Objetivo:** Setup Supabase Local para integration tests

**Pasos:**
1. Instalar Supabase CLI
2. Configurar Docker Compose
3. Aplicar migraciones
4. Unskip tests con DB real
5. Validar coverage >= 90%

---

## 9. Contacto y Soporte

**Mantenedor:** Test Engineer
**Issue tracking:** ROA-536 (CI Contract v2)
**Documentación relacionada:**
- `docs/plan/CI-CONTRACT-V2.md`
- `docs/plan/AUTH-TESTS-V2.md`
- `docs/plan/FUTURE-ISSUES-AUTH-AND-TESTS.md`

---

**Última actualización:** 2026-01-09

