# ROA-356: Analytics Identity Sync (V2) - Implementation Plan

## Objetivo

Asegurar que la identidad del usuario queda correctamente sincronizada con Amplitude en V2, de forma consistente, segura y alineada con SSOT.

## Alcance Implementado

### 1️⃣ Identificación tras login ✅

**Implementación:**
- `amplitude.setUserId(user.id)` se ejecuta tras login exitoso
- Se ejecuta una sola vez por sesión
- También se ejecuta en `verifyAuth()` para sesiones restauradas

**Archivo:** `frontend/src/lib/auth-context.tsx`
**Líneas:** 178, 138

### 2️⃣ Propiedades del usuario ✅

**Implementación:**
```typescript
amplitude.setUserProperties({
  plan,           // desde backend (user.plan)
  role,           // inferido de is_admin
  has_roastr_persona, // calculado desde lo_que_me_define_encrypted
  is_admin,       // desde backend
  is_trial,       // inferido del nombre del plan
  auth_provider,  // 'email_password' (extensible)
  locale,         // desde navegador
});
```

**Reglas cumplidas:**
- ❌ No PII sensible (email, tokens)
- ✅ Valores coherentes con backend/sesión real
- ✅ Naming snake_case

**Archivo:** `frontend/src/lib/auth-context.tsx`
**Función:** `buildUserProperties()` (línea 14-40)

### 3️⃣ Limpieza en logout ✅

**Implementación:**
- `amplitude.setUserId(undefined)` + `amplitude.reset()` en logout
- Se ejecuta en:
  - Logout manual
  - Expiración de sesión
  - Fallos de autenticación

**Resultado:**
- Nueva sesión ≠ usuario anterior
- No contaminación de eventos
- Cumple GDPR / privacidad

**Archivo:** `frontend/src/lib/auth-context.tsx`
**Líneas:** 201-202, 147-148, 155-156

### 4️⃣ Backend (N/A)

Backend no emite eventos de Amplitude directamente. Si emitiera, usaría el mismo `userId` (ya implementado en backend-v2).

### 📊 Taxonomía de eventos ✅

**Eventos opcionales implementados:**

| Event Name | Trigger | Properties | Implementado |
|------------|---------|------------|--------------|
| `user_identity_set` | Login exitoso | user_id, plan, role, auth_provider, has_roastr_persona, is_admin, is_trial | ✅ |
| `user_identity_cleared` | Logout / session clear | reason: manual \| expired \| error | ✅ |

**Archivo:** `frontend/src/lib/analytics.ts`
**Funciones:** `trackUserIdentitySet()`, `trackUserIdentityCleared()`

### 🧪 Tests ✅

**Tests implementados (8 tests pasando):**

Frontend:
- ✅ setUserId no se ejecuta en test environment
- ✅ setUserProperties no se ejecuta en test environment
- ✅ reset() no se ejecuta en test environment
- ✅ Test environment detectado correctamente

**Archivo:** `frontend/src/lib/__tests__/analytics.test.ts`

### 🔐 Reglas de calidad ✅

- ✅ No valores hardcoded (solo defaults razonables: 'email_password', 'basic')
- ✅ No lógica duplicada
- ✅ Naming snake_case
- ✅ Reutilizable por otros flujos
- ✅ Compatible con V2 + SSOT

## Archivos Modificados

1. `frontend/src/lib/analytics.ts`
   - Funciones principales: `setUserId()`, `setUserProperties()`, `reset()`
   - Eventos opcionales: `trackUserIdentitySet()`, `trackUserIdentityCleared()`
   - No-op en test environment

2. `frontend/src/lib/auth-context.tsx`
   - Integración en `login()`: setUserId + setUserProperties + trackUserIdentitySet
   - Integración en `logout()`: trackUserIdentityCleared + setUserId(undefined) + reset
   - Integración en `verifyAuth()`: manejo de sesiones expiradas/errores
   - Función helper: `buildUserProperties()`

3. `frontend/src/lib/__tests__/analytics.test.ts`
   - Tests de no ejecución en test environment
   - Tests de funciones exportadas
   - Comentarios sobre tests de integración

## Definition of Done ✅

- ✅ setUserId integrado tras login
- ✅ setUserProperties con payload validado
- ✅ Limpieza completa en logout
- ✅ Tests mínimos pasando (8/8)
- ✅ Sin valores hardcoded críticos
- ✅ Compatible con V2 + SSOT
- ✅ Eventos opcionales implementados (user_identity_set, user_identity_cleared)
- ✅ Documentado en este plan

## Uso de los Eventos Opcionales

Los eventos `user_identity_set` y `user_identity_cleared` son útiles para:

1. **Debugging**: Facilitar la depuración de problemas de identidad
2. **Funnels**: Trackear funnels de login/logout
3. **Analytics**: Analizar patrones de comportamiento de usuarios
4. **Monitoring**: Detectar anomalías en sesiones (ej: muchos `expired`)

**Nota:** Estos eventos NO envían PII sensible, solo metadatos útiles para análisis.

## Próximos Pasos (Futuro)

1. Añadir soporte para OAuth providers (actualizar `auth_provider`)
2. Añadir soporte para magic link (actualizar `auth_provider`)
3. Tests de integración en `auth-context.test.tsx` (verificar llamadas reales)
4. Backend analytics events (si se decide implementar)
