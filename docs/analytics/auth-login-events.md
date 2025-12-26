# Auth Login Events - Analytics Documentation

**Issue:** ROA-362  
**Type:** Analytics / Frontend  
**Status:** ✅ Implemented  
**Last Updated:** 2025-12-25

---

## Overview

Este documento describe la implementación de tracking de analytics para el flujo de login en Roastr.AI, siguiendo la taxonomía de eventos v2 definida en ROA-357 (A2: Auth Events Taxonomy).

### Dependencias

- **A1 (ROA-356):** Analytics Identity Sync - Sincronización de identidad del usuario
- **A2 (ROA-357):** Auth Events Taxonomy v2 - Taxonomía jerárquica de eventos
- **B2:** Login Frontend UI v2 - Interfaz de usuario de login

### Alcance

Esta implementación emite **exclusivamente** los eventos de login definidos en A2, sin duplicar lógica de autenticación ni UI.

---

## Eventos Implementados

### 1. `auth_login_attempted`

**Cuándo se dispara:** Al hacer submit del formulario de login

**Momento exacto:** Un intento = un evento (no se duplica por re-render)

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `flow` | string | ✅ | Siempre `"auth_login"` |
| `method` | string | ✅ | Método de autenticación: `email_password`, `demo_mode`, `magic_link`, `oauth` |
| `ui_variant` | string | ❌ | Variante de UI para A/B testing |

**Ejemplo:**

```typescript
trackLoginAttempted('email_password');
// O con variante:
trackLoginAttempted('email_password', 'variant_a');
```

**Payload enviado a Amplitude:**

```json
{
  "event": "auth_login_attempted",
  "properties": {
    "flow": "auth_login",
    "method": "email_password",
    "ui_variant": "variant_a"
  }
}
```

---

### 2. `auth_login_succeeded`

**Cuándo se dispara:** Respuesta 200 del backend después de login exitoso

**Momento exacto:** Inmediatamente después de que el backend confirma la autenticación

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `flow` | string | ✅ | Siempre `"auth_login"` |
| `method` | string | ✅ | Método de autenticación usado |
| `redirect_to` | string | ✅ | Ruta a la que se redirigirá al usuario |
| `account_state` | string | ✅ | Estado de la cuenta: `active`, `trial`, `suspended`, `new` (default: `active`) |
| `ui_variant` | string | ❌ | Variante de UI para A/B testing |

**Ejemplo:**

```typescript
trackLoginSucceeded('email_password', '/app', 'active');
// O sin especificar account_state (default: 'active'):
trackLoginSucceeded('email_password', '/app');
```

**Payload enviado a Amplitude:**

```json
{
  "event": "auth_login_succeeded",
  "properties": {
    "flow": "auth_login",
    "method": "email_password",
    "redirect_to": "/app",
    "account_state": "active"
  }
}
```

**Identidad del usuario:**

La sincronización de identidad (setUserId, setUserProperties) se realiza automáticamente en `auth-context.tsx` usando los helpers de A1 (ROA-356). **No es responsabilidad de este módulo.**

---

### 3. `auth_login_failed`

**Cuándo se dispara:** Error controlado del backend durante el login

**Momento exacto:** Cuando el backend devuelve un error de autenticación

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `flow` | string | ✅ | Siempre `"auth_login"` |
| `method` | string | ✅ | Método de autenticación usado |
| `error_code` | string | ✅ | Código de error normalizado (NO mensaje crudo) |
| `retryable` | boolean | ✅ | Si el error es retryable por el usuario |
| `ui_variant` | string | ❌ | Variante de UI para A/B testing |

**Códigos de error soportados:**

| `error_code` | `retryable` | Descripción |
|--------------|-------------|-------------|
| `invalid_credentials` | `false` | Credenciales incorrectas |
| `account_locked` | `false` | Cuenta bloqueada (rate limit, actividad sospechosa) |
| `account_suspended` | `false` | Cuenta suspendida o deshabilitada |
| `network_error` | `true` | Error de red o timeout |
| `unknown_error` | `true` | Error desconocido (default) |

**Ejemplo:**

```typescript
trackLoginFailed('email_password', 'Invalid credentials provided');
// El error se normaliza automáticamente a error_code
```

**Payload enviado a Amplitude:**

```json
{
  "event": "auth_login_failed",
  "properties": {
    "flow": "auth_login",
    "method": "email_password",
    "error_code": "invalid_credentials",
    "retryable": false
  }
}
```

**Normalización de errores:**

La función `normalizeErrorToCode()` (interna) convierte mensajes de error del backend a códigos estructurados, garantizando que:

- **NO se envían mensajes de error crudos** (pueden contener PII o información sensible)
- **NO se envían detalles técnicos** (rutas, IPs, configuraciones)
- Solo se envían códigos predefinidos y seguros

---

## Protección de PII

### Reglas CRÍTICAS

❌ **NUNCA enviar:**

- Emails (`user@example.com`)
- Passwords o tokens
- Mensajes de error crudos con información sensible
- Detalles técnicos (IPs, hosts, rutas de archivos)

✅ **SIEMPRE enviar:**

- Solo códigos de error normalizados
- Solo propiedades definidas en la taxonomía A2
- Valores enumerados (no strings libres)

### Validación en código

El módulo `auth-events.ts` garantiza protección de PII mediante:

1. **No acepta parámetros de PII:** Las funciones NO tienen parámetros para email/password
2. **Normalización automática:** Mensajes de error se convierten a códigos
3. **Tipos estrictos:** TypeScript previene envío de propiedades no definidas
4. **Tests de PII:** Los tests validan que no se filtre información sensible

---

## Ejemplos de Uso

### Flujo típico de login exitoso

```typescript
// En login.tsx - submit del formulario
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // 1. Track attempt
  trackLoginAttempted('email_password');
  
  try {
    await login(email, password);
    
    // 2. Track success (identidad ya sincronizada en auth-context)
    trackLoginSucceeded('email_password', from, 'active');
    
    navigate(from, { replace: true });
  } catch (err) {
    // 3. Track failure
    trackLoginFailed('email_password', err.message);
    setError(err.message);
  }
};
```

### Flujo de demo mode

```typescript
const handleDemoLogin = async () => {
  // 1. Track demo attempt
  trackLoginAttempted('demo_mode');
  
  try {
    // Simular login
    await createDemoUser();
    
    // 2. Track demo success
    trackLoginSucceeded('demo_mode', '/admin/dashboard', 'active');
    
    window.location.href = '/admin/dashboard';
  } catch (err) {
    // 3. Track demo failure
    trackLoginFailed('demo_mode', err.message);
  }
};
```

### Flujo con retry

```typescript
// Primer intento (falla)
trackLoginAttempted('email_password');
trackLoginFailed('email_password', 'Invalid credentials');

// Usuario corrige credenciales y reintenta
trackLoginAttempted('email_password');
trackLoginSucceeded('email_password', '/app', 'active');
```

---

## Integración con A1 (Identity Sync)

La sincronización de identidad se realiza automáticamente en `auth-context.tsx`:

```typescript
// auth-context.tsx - función login
const login = async (email: string, password: string) => {
  const response = await authApi.login(email, password);
  
  // A1: Sync identity with Amplitude (ROA-356)
  setUserId(response.user.id);
  setUserProperties({
    plan: response.user.plan || 'free',
    role: response.user.is_admin ? 'admin' : 'user',
    has_roastr_persona: !!response.user.lo_que_me_define_encrypted,
    is_admin: response.user.is_admin || false,
    is_trial: response.user.plan?.includes('trial') || false,
    auth_provider: 'email_password',
    locale: navigator.language?.split('-')[0] || 'en'
  });
};
```

**Flujo completo:**

1. Usuario hace submit → `auth_login_attempted`
2. Backend valida credenciales
3. **A1**: `setUserId()` + `setUserProperties()` (identity sync)
4. **B3 (ROA-362)**: `auth_login_succeeded`
5. Redirect al destino

---

## Testing

### Tests unitarios

Los tests validan:

✅ Las funciones no lanzan errores con parámetros válidos  
✅ Normalización de errores funciona correctamente  
✅ No se envía PII en ningún evento  
✅ TypeScript previene envío de propiedades no definidas  
✅ Funciones son no-op en entorno de test (como analytics-identity)

**Ejecutar tests:**

```bash
cd frontend
npm test -- src/lib/__tests__/auth-events.test.ts
```

**Resultado esperado:**

```
✓ src/lib/__tests__/auth-events.test.ts (32 tests) 7ms

Test Files  1 passed (1)
     Tests  32 passed (32)
```

### Tests de integración

Para validar el flujo completo end-to-end:

1. Iniciar frontend: `npm run dev`
2. Abrir DevTools → Network → Filter "amplitude"
3. Probar login con credenciales válidas
4. Verificar eventos en Amplitude dashboard (1-2 min de delay)

---

## Troubleshooting

### Eventos no aparecen en Amplitude

**Verificar:**

1. `VITE_AMPLITUDE_API_KEY` está configurado en `.env`
2. Console muestra: `[Amplitude] Initialized successfully`
3. Network tab muestra requests a Amplitude API
4. Esperar 1-2 minutos para que Amplitude procese eventos

### Eventos duplicados

**Causa:** Re-renders de React pueden causar múltiples llamadas

**Solución:** Los eventos se emiten en puntos semánticos específicos (submit, response), no en renders. Si hay duplicados, revisar lógica de invocación.

### Errores de TypeScript

**Causa:** Intentar enviar propiedades no definidas en la taxonomía

**Solución:** Usar solo las properties definidas en este documento. TypeScript prevenirá compilación si hay errores.

---

## Referencias

### Código

- **Módulo principal:** `frontend/src/lib/auth-events.ts`
- **Integración UI:** `frontend/src/pages/auth/login.tsx`
- **Tests:** `frontend/src/lib/__tests__/auth-events.test.ts`
- **Identity sync:** `frontend/src/lib/analytics-identity.ts` (A1)
- **Auth context:** `frontend/src/lib/auth-context.tsx`

### Documentación

- **Amplitude Guide:** `docs/analytics/amplitude.md`
- **A1 - Identity Sync:** ROA-356
- **A2 - Events Taxonomy:** ROA-357, `docs/nodes-v2/02-autenticacion-usuarios.md` (sección 10.1)
- **B2 - Login UI:** Login frontend UI v2

### Issues

- **ROA-362:** B3. Login Analytics Implementation (esta implementación)
- **ROA-356:** A1. Analytics Identity Sync (V2)
- **ROA-357:** A2. Auth Events Taxonomy (V2)

---

## Checklist de Completado

- [x] Eventos de login implementados según A2
- [x] Properties completas y normalizadas
- [x] Identidad sincronizada solo en success (A1)
- [x] Sin PII enviada
- [x] Tests mínimos pasando (32/32 tests)
- [x] Documentación actualizada

---

**Status:** ✅ **Implementación completa y documentada**  
**Last Review:** 2025-12-25  
**Reviewers:** Roastr.AI Team
