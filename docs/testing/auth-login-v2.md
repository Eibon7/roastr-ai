# Auth Login v2 - Testing Documentation

**Issue:** ROA-363 (B4. Login Tests V2)  
**Flow:** Auth → Login  
**Type:** Flow / Integration Testing  
**Priority:** Media

---

## 🎯 Objetivo

Validar que el **flujo de login v2 funciona end-to-end a nivel funcional**, sin testear implementación interna, mocks frágiles ni detalles irrelevantes.

👉 Estos tests existen para **detectar roturas reales del flujo**, no para satisfacer coverage artificial.

---

## 📌 Qué Cubren Estos Tests

### ✅ Tests de Flujo (Flow Tests)

Los tests en `apps/backend-v2/tests/flow/auth-login.flow.test.ts` validan:

#### Happy Paths (2 tests)

1. **Login exitoso con email + password**
   - El backend responde OK
   - El usuario queda autenticado (access_token, user data)
   - El flujo resuelve sin errores

2. **Login con feature flag activo**
   - Feature flag `auth.login.enabled = true` permite login
   - El flujo funciona correctamente
   - Sistema responde según configuración

#### Error Paths (4 tests)

1. **Credenciales inválidas**
   - El backend responde error controlado
   - Se lanza excepción apropiada
   - No se setea identidad de usuario

2. **Error de red / servicio**
   - Servicio no disponible
   - El flujo falla sin crashear
   - No hay side-effects persistentes

3. **Rate limiting activo**
   - Rate limit excedido bloquea login
   - Mensaje claro al usuario
   - Sistema no queda bloqueado permanentemente

4. **Feature flag deshabilitado**
   - `auth.login.enabled = false` bloquea login
   - Error apropiado lanzado
   - Sistema responde consistentemente

#### Edge Cases (2 tests)

1. **Email case-insensitive**
   - Emails en mayúsculas/minúsculas funcionan igual
   - Normalización automática a lowercase
   - Flujo resuelve correctamente

2. **Abuse detection**
   - Patrones sospechosos bloquean login
   - Error apropiado al usuario
   - Sistema detecta abuso correctamente

---

## 🚫 Qué NO Cubren Estos Tests

### ❌ NO Validamos

- **Llamadas internas exactas** (ej: `supabase.auth.signInWithPassword` fue llamado X veces)
- **Estructura de requests** (payloads internos, headers específicos)
- **Implementación de Supabase** (es una dependencia externa)
- **Contenido exacto de errores** (solo validamos comportamiento observable)
- **SDK interno de Amplitude** (solo validamos que el flujo funciona)
- **Logs internos** (NO asserts de console.log)
- **Funciones privadas** (ej: `isValidEmail`, `hashForLog`)
- **Timing de operaciones** (NO asserts de duración)

### 🔒 Regla de Oro

> **Si cambiar la implementación rompe el test sin romper el flujo, el test está mal.**

---

## 🧪 Infraestructura de Test

### Framework

- **Vitest** (configurado en `apps/backend-v2/vitest.config.ts`)
- Tests de **flujo**, no unitarios puros
- Mock mínimo de dependencias externas

### Mocks Usados

#### Supabase (dependencia externa)

```typescript
vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      admin: {
        signOut: vi.fn()
      }
    }
  }
}));
```

**Mocks de Supabase:**
- `signInWithPassword()` → Success o error controlado
- Respuestas simulan comportamiento real del servicio

#### Analytics (dependencia externa)

```typescript
vi.mock('@amplitude/analytics-node', () => ({
  init: vi.fn(),
  track: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined)
}));
```

**Mocks de Analytics:**
- `track()` → Spy para validar que eventos se emiten
- NO validamos estructura exacta de eventos (solo que ocurren)

#### Rate Limiting & Abuse Detection

```typescript
vi.mock('../../src/services/rateLimitService', () => ({
  rateLimitService: {
    recordAttempt: vi.fn().mockReturnValue({ allowed: true })
  }
}));

vi.mock('../../src/services/abuseDetectionService', () => ({
  abuseDetectionService: {
    recordAttempt: vi.fn().mockReturnValue({ isAbuse: false })
  }
}));
```

**Por defecto:**
- Rate limiting: Permitido
- Abuse detection: No abuse

**Podemos sobrescribir** en tests específicos para validar escenarios de bloqueo.

---

## 🔍 Escenarios Cubiertos

### 1. ✅ Login Exitoso

**Setup:**
- Supabase responde con sesión válida
- Rate limiting permitido
- Abuse detection OK

**Validaciones:**
- `result.access_token` definido
- `result.user.email` correcto
- `result.user.id` correcto
- `result.expires_in > 0`

**NO validamos:**
- Estructura interna de `session`
- Llamadas específicas a Supabase
- Logs internos

---

### 2. ✅ Login con Feature Flag

**Setup:**
- `loadSettings()` retorna `auth.login.enabled = true`
- Supabase responde OK

**Validaciones:**
- Flujo resuelve correctamente
- `result.access_token` definido
- Usuario autenticado

**NO validamos:**
- Cómo se carga el feature flag internamente
- Estructura de configuración

---

### 3. ❌ Credenciales Inválidas

**Setup:**
- Supabase retorna error `Invalid login credentials`

**Validaciones:**
- `expect(...).rejects.toThrow()`
- El flujo falla correctamente

**NO validamos:**
- Mensaje exacto del error
- Código de error específico
- Logs internos

---

### 4. ❌ Error de Red

**Setup:**
- Supabase lanza `Network error`

**Validaciones:**
- `expect(...).rejects.toThrow()`
- No hay side-effects persistentes
- Sistema queda limpio

**NO validamos:**
- Tipo exacto de error
- Manejo interno de excepciones

---

### 5. ❌ Rate Limiting

**Setup:**
- `rateLimitService.recordAttempt()` retorna `{ allowed: false }`

**Validaciones:**
- `expect(...).rejects.toThrow(/rate limit|too many attempts/i)`
- Error contiene información útil

**NO validamos:**
- Implementación interna de rate limiting
- Estructura de respuesta exacta

---

### 6. ❌ Feature Flag Deshabilitado

**Setup:**
- `loadSettings()` retorna `auth.login.enabled = false`

**Validaciones:**
- `expect(...).rejects.toThrow(/authentication.*unavailable/i)`

**NO validamos:**
- Cómo se decide deshabilitar
- Logs internos

---

### 7. 🔐 Email Case-Insensitive

**Setup:**
- Email en UPPERCASE
- Supabase normaliza a lowercase

**Validaciones:**
- Flujo resuelve correctamente
- `result.user.email` normalizado

**NO validamos:**
- Implementación de normalización

---

### 8. 🔐 Abuse Detection

**Setup:**
- `abuseDetectionService.recordAttempt()` retorna `{ isAbuse: true }`

**Validaciones:**
- `expect(...).rejects.toThrow(/suspicious activity/i)`

**NO validamos:**
- Patrones exactos de abuso
- Implementación interna

---

## 📊 Coverage Esperado

### Lo Que Cubren Estos Tests

✅ **Flujos principales:**
- Login exitoso
- Login con configuración
- Errores controlados
- Rate limiting
- Abuse detection

✅ **Resultados observables:**
- Sesión creada o error
- Usuario autenticado o no
- Mensajes de error apropiados

### Lo Que NO Cubren

❌ **Implementación interna:**
- Funciones privadas (`isValidEmail`, `hashForLog`)
- Logs internos
- Estructura de payloads
- Detalles de Supabase SDK

❌ **Estos deben cubrirse en:**
- Tests unitarios (si son críticos)
- Tests de integración con Supabase Test (si aplica)

---

## 🚀 Ejecutar Tests

### Todos los tests de flujo

```bash
npm test apps/backend-v2/tests/flow/
```

### Solo tests de login

```bash
npm test apps/backend-v2/tests/flow/auth-login.flow.test.ts
```

### Con coverage

```bash
npm test apps/backend-v2/tests/flow/auth-login.flow.test.ts -- --coverage
```

### Watch mode (desarrollo)

```bash
npm test apps/backend-v2/tests/flow/auth-login.flow.test.ts -- --watch
```

---

## 📚 Referencias

### Dependencies

- **B1**: Login Backend v2 (Issue ROA-360) - `apps/backend-v2/src/services/authService.ts`
- **B2**: Login Frontend UI v2 (Issue ROA-361) - Frontend implementation
- **B3**: Login Analytics Implementation v2 (Issue ROA-362) - `apps/backend-v2/src/lib/analytics.ts`

### Documentation

- **GDD Node**: `docs/nodes-v2/02-autenticacion-usuarios.md`
- **SSOT v2**: `docs/SSOT-V2.md` (auth section)
- **System Map v2**: `docs/system-map-v2.yaml` (auth node)

### Related Tests

- Unit tests: `apps/backend-v2/tests/unit/services/authService.test.ts` (si existen)
- E2E tests: `tests/e2e/auth-login.spec.ts` (Playwright, si existen)

---

## 🔄 Mantenimiento

### Cuándo Actualizar Estos Tests

- ✅ **Cambios en el flujo observable** (nuevos estados, errores, comportamientos)
- ✅ **Nuevos feature flags** que afecten login
- ✅ **Cambios en rate limiting / abuse detection** que cambien comportamiento

### Cuándo NO Actualizar

- ❌ **Refactors internos** (cambio de nombres, estructura)
- ❌ **Cambios en logs** (no los validamos)
- ❌ **Cambios en payloads internos** (no los validamos)

---

## ✅ Checklist de Completado (ROA-363)

- [x] Tests escritos con Vitest
- [x] 2 happy paths cubiertos (login exitoso + feature flag)
- [x] 4 error paths cubiertos (credenciales, red, rate limit, feature flag)
- [x] 2 edge cases cubiertos (case-insensitive, abuse detection)
- [x] No asserts frágiles (solo comportamiento observable)
- [x] No dependencia de implementación interna
- [x] Documentación añadida (`docs/testing/auth-login-v2.md`)

---

**Última actualización:** 2025-12-26  
**Versión:** 1.0  
**Status:** ✅ Complete
