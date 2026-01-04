# B3: Password Recovery Analytics - Implementación

**Issue:** B3 (Password Recovery Analytics)  
**PR:** #1243  
**Status:** ✅ BACKEND IMPLEMENTADO | ⏳ FRONTEND PENDIENTE

---

## ✅ Implementado

### Backend (Completado 100%)

**Archivo creado:** `apps/backend-v2/src/lib/password-recovery-events.ts`

**Eventos implementados:**
1. ✅ `password_recovery_token_used` - Token válido usado
2. ✅ `password_recovery_failed` - Error en uso de token

**Instrumentation:**
- ✅ `authService.updatePassword()` completamente instrumentado
- ✅ Emite `password_recovery_token_used` cuando token es válido
- ✅ Emite `password_recovery_failed` en estos casos:
  - Validación de password falla
  - Token inválido/expirado
  - Error al actualizar password
  - Cualquier otro error

**Payloads B3-compliant:**
```typescript
// password_recovery_token_used
{
  flow: 'password_recovery',
  provider: 'supabase',
  feature_flag_state: boolean,
  token_status: 'valid',
  auth_state: 'anonymous'
}

// password_recovery_failed (backend)
{
  flow: 'password_recovery',
  provider: 'supabase',
  feature_flag_state: boolean,
  reason: 'token_invalid' | 'token_expired' | 'request_failed' | 'unknown_error',
  retryable: boolean
}
```

### Frontend (Módulo Creado, Integración Pendiente)

**Archivo creado:** `frontend/src/lib/password-recovery-events.ts`

**Funciones exportadas:**
1. ✅ `trackPasswordRecoveryRequested(featureFlagState)` - Listo para usar
2. ✅ `trackPasswordRecoveryFailed(featureFlagState, errorMessage)` - Listo para usar

**Payloads B3-compliant:**
```typescript
// password_recovery_requested
{
  flow: 'password_recovery',
  feature_flag_state: boolean,
  provider: 'supabase',
  request_source: 'auth_ui'
}

// password_recovery_failed (frontend)
{
  flow: 'password_recovery',
  feature_flag_state: boolean,
  provider: 'supabase',
  request_source: 'auth_ui',
  reason: 'request_failed' | 'feature_disabled' | 'rate_limited' | 'unknown_error',
  retryable: boolean
}
```

---

## ⏳ Pendiente

### 1. Frontend Integration

**Archivo a modificar:** `frontend/src/pages/auth/recover-v2.tsx`

**Cambios necesarios:**
```typescript
// Importar eventos B3
import { 
  trackPasswordRecoveryRequested,
  trackPasswordRecoveryFailed 
} from '@/lib/password-recovery-events';

// En onSubmit (antes del try):
trackPasswordRecoveryRequested(isFeatureEnabled);

// En catch (reemplazar trackEvent actual):
trackPasswordRecoveryFailed(isFeatureEnabled, error.message);
```

**Estimado:** 10 minutos

### 2. Tests de Emisión

**Tests mínimos requeridos:**

#### Backend Tests
```typescript
// apps/backend-v2/tests/unit/lib/password-recovery-events.test.ts
describe('Password Recovery Backend Events', () => {
  it('should emit password_recovery_token_used with correct payload', () => {
    // Verify event emitted
    // Verify NO PII (email, user_id, IP, token)
    // Verify payload matches contract
  });

  it('should emit password_recovery_failed with correct reason', () => {
    // Verify event emitted
    // Verify reason is enum value
    // Verify retryable is correct
  });
});
```

#### Frontend Tests
```typescript
// frontend/src/lib/__tests__/password-recovery-events.test.ts
describe('Password Recovery Frontend Events', () => {
  it('should emit password_recovery_requested with correct payload', () => {
    // Verify event emitted
    // Verify NO PII
    // Verify payload matches contract
  });

  it('should emit password_recovery_failed with normalized reason', () => {
    // Verify error message normalized to enum
  });
});
```

**Estimado:** 2 horas

### 3. Integration Tests

**Test E2E del flujo completo:**
```typescript
// apps/backend-v2/tests/integration/auth/password-recovery-analytics.spec.ts
describe('B3: Password Recovery Analytics E2E', () => {
  it('should emit all 4 events in happy path', async () => {
    // 1. Request recovery (frontend)
    // 2. Verify password_recovery_requested emitted
    // 3. Use token (backend)
    // 4. Verify password_recovery_token_used emitted
  });

  it('should emit failed event on token error', async () => {
    // Use invalid token
    // Verify password_recovery_failed emitted
    // Verify reason='token_invalid'
  });
});
```

**Estimado:** 3 horas

---

## 🔒 Privacidad Verificada

**✅ Backend:**
- ❌ NO email
- ❌ NO user_id
- ❌ NO IP
- ❌ NO tokens
- ✅ Solo: flow, provider, token_status, auth_state, reason, retryable, feature_flag_state

**✅ Frontend:**
- ❌ NO email
- ❌ NO user_id
- ❌ NO IP
- ✅ Solo: flow, provider, request_source, reason, retryable, feature_flag_state

**Verificación:** ✅ COMPLIANT con B3 contract

---

## 📊 Estado de Eventos

| Evento | Capa | Status | Integrado | Tested |
|--------|------|--------|-----------|--------|
| `password_recovery_requested` | Frontend | ✅ Creado | ⏳ Pending | ❌ No |
| `password_recovery_failed` (frontend) | Frontend | ✅ Creado | ⏳ Pending | ❌ No |
| `password_recovery_token_used` | Backend | ✅ Creado | ✅ **Instrumentado** | ❌ No |
| `password_recovery_failed` (backend) | Backend | ✅ Creado | ✅ **Instrumentado** | ❌ No |

**Progress:** 2/4 eventos completamente integrados (50%)

---

## 🎯 Próximos Pasos

### Paso 1: Integrar Frontend (10 min)
1. Actualizar `recover-v2.tsx` con imports
2. Reemplazar llamadas a `trackEvent` por funciones B3
3. Verificar en consola que eventos se emiten

### Paso 2: Tests Unitarios (2 horas)
1. Backend: `password-recovery-events.test.ts`
2. Frontend: `password-recovery-events.test.ts`
3. Verificar payloads NO contienen PII
4. Verificar reasons son enums válidos

### Paso 3: Tests de Integración (3 horas)
1. E2E del flujo completo
2. Verificar 4 eventos se emiten en orden correcto
3. Verificar error handling emite `password_recovery_failed`

### Paso 4: Documentación
1. Actualizar `docs/plan/issue-B3.md` con implementación real
2. Añadir ejemplos de uso
3. Confirmar AC cumplidos

---

## ✅ Acceptance Criteria Status

| AC | Status | Nota |
|----|--------|------|
| **AC1: Eventos registrados** | 🟡 50% | Backend ✅ | Frontend ⏳ |
| **AC2: Payloads contractuales** | ✅ 100% | Todos cumplen B3 contract |
| **AC3: NO PII en payloads** | ✅ 100% | Verificado en código |
| **AC4: Tests de emisión** | ❌ 0% | Pending implementación |
| **AC5: Documentación** | 🟡 50% | Plan actualizado | Tests pending |

**Overall Progress:** 60% complete

---

## 📝 Commits

1. **28c77d26** - docs(B3): Clarify PR scope - Phase 0 planning only
2. **f32e3e36** - feat(B3): Implement password recovery analytics events (Backend done)

---

**Última actualización:** 2026-01-04  
**Status:** Backend complete, Frontend pending integration  
**Estimado para completar:** 5-6 horas

