# Plan de Implementación: ROA-380 - B2 Password Recovery Frontend UI (shadcn)

**Issue:** #380  
**Tipo:** Feature - Frontend  
**Prioridad:** P1  
**Labels:** `area:frontend`, `area:ui`, `type:feature`

---

## 📋 Objetivo

Implementar la UI frontend para solicitud de recuperación de contraseña usando shadcn/ui, conectando con el backend v2 endpoint `/api/v2/auth/password-recovery`.

**Scope estricto B2:** SOLO request de recuperación. NO reset de contraseña ni manejo de tokens.

---

## ✅ Acceptance Criteria (del Issue)

### AC1: Página de recuperación funcional ✅
- [x] Página `/recover` con formulario de email
- [x] Validación de formato de email con Zod
- [x] Integración con shadcn/ui components (Input, Button, Form, Alert)
- [x] Estados: idle, loading, success, error

### AC2: Integración con backend v2 ✅
- [x] POST a `/api/v2/auth/password-recovery` con email
- [x] API client method: `requestPasswordRecoveryV2(email)`
- [x] Manejo de respuestas del endpoint

### AC3: Error handling genérico ✅
- [x] Mensaje genérico único para todos los errores
- [x] Anti-enumeration: no revelar existencia de email
- [x] No mostrar `error_code` ni detalles técnicos

### AC4: Feature flag ⏳ (PENDIENTE)
- [ ] Check de `ENABLE_PASSWORD_RECOVERY_V2` al montar componente
- [ ] Si OFF: mostrar mensaje "no disponible"
- [ ] Si ON: habilitar formulario

### AC5: Analytics sin PII ⏳ (PENDIENTE)
- [ ] `password_recovery_form_viewed` - al montar
- [ ] `password_recovery_submitted` - al enviar
- [ ] `password_recovery_success_shown` - al éxito
- [ ] `password_recovery_error_shown` - al error

### AC6: Tests mínimos ⏳ (PENDIENTE)
- [ ] Test: componente renderiza
- [ ] Test: validación de email
- [ ] Test: submit con email válido
- [ ] Test: estado loading
- [ ] Test: estado success
- [ ] Test: error genérico
- [ ] Test: feature flag OFF

---

## 📂 Archivos Creados/Modificados

### Archivos principales
- ✅ `frontend/src/pages/auth/recover-v2.tsx` - Componente principal
- ✅ `frontend/src/lib/api/auth.js` - Método `requestPasswordRecoveryV2`
- ✅ `frontend/src/App.tsx` - Ruta `/recover`

### Archivos stub (creados en main para resolver imports faltantes)
- ✅ `frontend/src/lib/supabaseClient.js`
- ✅ `frontend/src/lib/mockMode.js`
- ✅ `frontend/src/utils/csrf.js`

### Archivos pendientes
- ⏳ `frontend/src/pages/auth/__tests__/recover-v2.test.tsx`
- ⏳ `docs/test-evidence/ROA-380/SUMMARY.md`
- ⏳ `CHANGELOG-ROA-380.md`

---

## 🔧 Implementación Técnica

### Componente RecoverPageV2

**Stack:**
- React + TypeScript
- react-hook-form + Zod para validación
- shadcn/ui components (Button, Input, Alert, Card)
- Lucide icons

**Estados:**
- `isSubmitting`: boolean para loading state
- `hasError`: boolean para error state
- `success`: boolean para success state
- `emailSent`: string para mostrar email en mensaje de éxito

**Flujo:**
1. Usuario ingresa email
2. Validación con Zod (formato email)
3. Submit → POST `/api/v2/auth/password-recovery`
4. Backend responde con mensaje anti-enumeration
5. UI muestra success (siempre, por seguridad)

### Error Handling (Simplificado)

**Mensaje genérico único:**
```typescript
"No hemos podido procesar la solicitud en este momento. Inténtalo más tarde."
```

**Anti-enumeration:**
- Success message: "Si el email existe, recibirás instrucciones..."
- Error message: genérico, sin detalles
- NO se interpreta `error_code` del backend

---

## 🚧 Blockers Identificados y Resueltos

### Build Errors (Resueltos)

**Problema:** Imports faltantes en `client.js`
- `Could not resolve "../supabaseClient"`
- `Could not resolve "../mockMode"`
- `Could not resolve "../../utils/csrf"`

**Solución:** Creados stubs en main:
1. `frontend/src/lib/supabaseClient.js` (commit `b0e9b2ca`)
2. `frontend/src/lib/mockMode.js` (commit `c8d2d75d`, `9d3804d5`)
3. `frontend/src/utils/csrf.js` (commit `01e4e2a5`)

### TypeScript Errors (Resueltos)

**Problema:** `auth.js` no tiene tipos
**Solución:** `@ts-expect-error - auth.js is not typed`

**Problema:** `getValues` no usado
**Solución:** Removido de useForm destructuring

### Linter Error (Resuelto)

**Problema:** ESLint requiere `@ts-expect-error` en lugar de `@ts-ignore`
**Solución:** Cambiado a `@ts-expect-error`

---

## ⏳ Trabajo Pendiente (Blockers Actuales)

### 1. Feature Flag Check
```typescript
// Pseudo-código
const { data: flag } = useFeatureFlag('ENABLE_PASSWORD_RECOVERY_V2');

if (!flag?.enabled) {
  return <NotAvailableMessage />;
}
```

### 2. Analytics Tracking
```typescript
// Al montar
useEffect(() => {
  trackEvent('password_recovery_form_viewed', {
    feature_flag_state: featureFlag?.enabled
  });
}, []);

// Al submit
trackEvent('password_recovery_submitted');

// Al éxito/error
trackEvent('password_recovery_success_shown');
trackEvent('password_recovery_error_shown');
```

### 3. Tests (Vitest + Testing Library)
- Render básico
- Validación de email
- Submit y estados
- Feature flag OFF

### 4. Documentación
- CHANGELOG-ROA-380.md
- docs/test-evidence/ROA-380/SUMMARY.md

---

## 🎯 Validación

### Pre-merge Checklist
- [x] CI/CD passing (Build, Lint, Test, Security)
- [x] 0 conflictos con main
- [x] CodeRabbit = 0 comentarios
- [ ] Tests implementados y pasando
- [ ] Feature flag check implementado
- [ ] Analytics tracking implementado
- [ ] Documentación completa

### Visual Evidence
- [ ] Screenshots en docs/test-evidence/ROA-380/
  - Form idle
  - Loading state
  - Success message
  - Error message
  - Feature flag OFF

---

## 📝 Notas

### Scope B2 vs B3/B4
- **B2 (este PR):** SOLO request de recuperación
- **B3:** Reset de contraseña con token
- **B4:** Integración email

### Anti-Enumeration
Crítico mantener en todos los estados para evitar revelar existencia de emails.

### Stubs Temporales
Los archivos stub creados en main son temporales. Requieren implementación real cuando:
- Supabase se integre en frontend
- Mock mode se implemente
- CSRF tokens se habiliten

---

**Estado:** 🟡 En progreso (resolución de blockers)  
**Última actualización:** 2026-01-04

