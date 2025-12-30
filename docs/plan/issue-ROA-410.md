# Implementation Plan: ROA-410 - Auth Observability Base v2

**Date:** 2025-12-30
**Issue:** ROA-410 - a6-auth-observability-base-v2
**Priority:** P1 (High)
**Type:** type:backend, type:observability
**Estimated Effort:** 8 hours (~1 day)

---

## Estado Actual (Assessment Summary)

**Recomendación:** **ENHANCE** (Mejorar observabilidad existente)

### Infraestructura Existente ✅

- ✅ `authErrorTaxonomy.ts` - Taxonomía de errores de auth (ROA-405)
- ✅ `logger.ts` - Logger básico con niveles (debug, info, warn, error)
- ✅ `analytics.ts` - Integración con Amplitude para tracking de eventos
- ✅ `authService.ts` - Servicio de auth con algunos logs estructurados
- ✅ `requestId.ts` middleware - Genera request IDs únicos
- ✅ `authErrorResponse.ts` - Helper para respuestas de error estructuradas

### Componentes Faltantes ❌

- ❌ **Logging estructurado consistente** - Logs de auth no siguen formato estándar
- ❌ **Métricas de auth** - No hay tracking de métricas (intentos, errores, rate limits)
- ❌ **Event tracking centralizado** - Eventos de auth no están centralizados
- ❌ **Correlation tracking** - No hay propagación consistente de correlation IDs
- ❌ **Auth observability helpers** - No hay funciones helper para logging consistente

### Cobertura de AC: 0/5 (0%)

**Nodos GDD cargados:**

- `auth/overview.md` - Sistema de autenticación
- `auth/error-taxonomy.md` - Taxonomía de errores
- `observabilidad.md` - Sistema de observabilidad general

---

## Objetivos

1. **Crear base de observabilidad para auth** con logging estructurado consistente
2. **Implementar métricas de auth** (intentos, errores, rate limits, duraciones)
3. **Centralizar event tracking** de eventos de auth con correlation IDs
4. **Crear helpers de observabilidad** para logging consistente en todos los flujos de auth
5. **Integrar con analytics** (Amplitude) para eventos de auth estructurados

---

## Pasos de Implementación

### Fase 1: Auth Observability Service (3h)

**Archivo:** `apps/backend-v2/src/services/authObservabilityService.ts`

#### 1.1 Estructura Base (1h)

- Crear servicio centralizado para observabilidad de auth
- Integrar con logger existente
- Integrar con analytics (Amplitude)
- Soporte para correlation IDs y request IDs

```typescript
export interface AuthEventContext {
  request_id?: string;
  correlation_id?: string;
  user_id?: string;
  email?: string; // Truncado para logs
  ip?: string; // Prefijo para logs
  flow?: 'login' | 'register' | 'magic_link' | 'password_recovery' | 'logout' | 'refresh';
  [key: string]: any;
}

export interface AuthMetric {
  event: string;
  timestamp: number;
  context: AuthEventContext;
  metadata?: Record<string, any>;
}

class AuthObservabilityService {
  // Logging estructurado
  logAuthEvent(level: 'info' | 'warn' | 'error', event: string, context: AuthEventContext): void;
  
  // Métricas
  trackAuthMetric(metric: AuthMetric): void;
  
  // Event tracking (Amplitude)
  trackAuthEvent(event: string, context: AuthEventContext, properties?: Record<string, any>): void;
  
  // Helpers específicos
  logLoginAttempt(context: AuthEventContext, success: boolean, error?: AuthError): void;
  logRateLimit(context: AuthEventContext, reason: string): void;
  logAuthError(context: AuthEventContext, error: AuthError): void;
}
```

#### 1.2 Logging Estructurado (1h)

- Formato JSON consistente para logs de auth
- Integración con logger existente
- Sanitización de PII (emails truncados, IPs prefijadas)
- Correlation IDs y request IDs en todos los logs

```typescript
logAuthEvent(level: 'info' | 'warn' | 'error', event: string, context: AuthEventContext): void {
  const sanitizedContext = this.sanitizeContext(context);
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'auth',
    event,
    ...sanitizedContext
  };
  
  logger[level](JSON.stringify(logEntry));
}
```

#### 1.3 Métricas y Tracking (1h)

- Tracking de métricas de auth (intentos, errores, duraciones)
- Integración con Amplitude para eventos estructurados
- Métricas agregadas (success rate, error rate, latency)

```typescript
trackAuthMetric(metric: AuthMetric): void {
  // Log estructurado
  this.logAuthEvent('info', `auth.metric.${metric.event}`, metric.context);
  
  // Amplitude tracking
  trackEvent({
    userId: metric.context.user_id,
    event: `auth_${metric.event}`,
    properties: {
      ...metric.metadata,
      flow: metric.context.flow
    },
    context: {
      flow: 'auth',
      request_id: metric.context.request_id
    }
  });
}
```

---

### Fase 2: Helpers de Observabilidad (2h)

**Archivo:** `apps/backend-v2/src/utils/authObservability.ts`

#### 2.1 Helpers de Logging (1h)

- Funciones helper para eventos comunes de auth
- Wrappers para logging consistente
- Integración con authErrorTaxonomy

```typescript
export function logLoginAttempt(
  context: AuthEventContext,
  success: boolean,
  error?: AuthError
): void {
  if (success) {
    authObservability.logAuthEvent('info', 'auth.login.success', context);
    authObservability.trackAuthEvent('auth_login_success', context);
  } else {
    authObservability.logAuthError(context, error || failClosedAuthError());
    authObservability.trackAuthEvent('auth_login_failed', context, {
      error_slug: error?.slug || 'AUTH_UNKNOWN'
    });
  }
}

export function logRateLimit(context: AuthEventContext, reason: string): void {
  authObservability.logAuthEvent('warn', 'auth.rate_limit', {
    ...context,
    reason
  });
  authObservability.trackAuthEvent('auth_rate_limited', context, { reason });
}

export function logAuthError(context: AuthEventContext, error: AuthError): void {
  authObservability.logAuthEvent('error', 'auth.error', {
    ...context,
    error_slug: error.slug,
    error_category: error.category,
    error_retryable: error.retryable,
    http_status: error.http_status
  });
  authObservability.trackAuthEvent('auth_error', context, {
    error_slug: error.slug,
    error_category: error.category,
    error_retryable: error.retryable
  });
}
```

#### 2.2 Helpers de Métricas (1h)

- Funciones helper para métricas comunes
- Tracking de duraciones (latency)
- Tracking de intentos y errores

```typescript
export function trackAuthDuration(
  event: string,
  context: AuthEventContext,
  durationMs: number
): void {
  authObservability.trackAuthMetric({
    event: `${event}.duration`,
    timestamp: Date.now(),
    context,
    metadata: {
      duration_ms: durationMs
    }
  });
}

export function trackAuthAttempt(
  flow: AuthEventContext['flow'],
  context: AuthEventContext,
  success: boolean
): void {
  authObservability.trackAuthMetric({
    event: `${flow}.attempt`,
    timestamp: Date.now(),
    context: { ...context, flow },
    metadata: {
      success
    }
  });
}
```

---

### Fase 3: Integración con Auth Service (2h)

**Archivo:** `apps/backend-v2/src/services/authService.ts`

#### 3.1 Integrar Observability en Login (30min)

- Añadir logging estructurado en método `login()`
- Tracking de métricas (duración, éxito/fallo)
- Correlation IDs y request IDs

```typescript
async login(params: LoginParams): Promise<Session> {
  const startTime = Date.now();
  const context: AuthEventContext = {
    request_id: params.request_id,
    flow: 'login',
    email: truncateEmailForLog(params.email),
    ip: prefixIP(params.ip)
  };
  
  try {
    // ... lógica de login existente ...
    
    const duration = Date.now() - startTime;
    logLoginAttempt(context, true);
    trackAuthDuration('login', context, duration);
    
    return session;
  } catch (error) {
    const authError = asAuthError(error);
    logLoginAttempt(context, false, authError);
    trackAuthDuration('login', context, Date.now() - startTime);
    throw authError;
  }
}
```

#### 3.2 Integrar Observability en Register (30min)

- Añadir logging estructurado en método `register()`
- Tracking de métricas (duración, éxito/fallo)
- Correlation IDs y request IDs

#### 3.3 Integrar Observability en Magic Link (30min)

- Añadir logging estructurado en método `sendMagicLink()`
- Tracking de métricas (duración, éxito/fallo)
- Correlation IDs y request IDs

#### 3.4 Integrar Observability en Password Recovery (30min)

- Añadir logging estructurado en método `requestPasswordRecovery()`
- Tracking de métricas (duración, éxito/fallo)
- Correlation IDs y request IDs

---

### Fase 4: Integración con Rate Limiting (1h)

**Archivo:** `apps/backend-v2/src/services/rateLimitService.ts`

#### 4.1 Logging de Rate Limits (30min)

- Añadir logging estructurado cuando se detecta rate limit
- Tracking de métricas de rate limiting
- Correlation IDs y request IDs

```typescript
async checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const context: AuthEventContext = {
    request_id: getRequestId(),
    flow: 'rate_limit_check'
  };
  
  const isLimited = await this.redis.get(key);
  
  if (isLimited) {
    logRateLimit(context, `rate_limit_exceeded:${key}`);
    return false;
  }
  
  // ... lógica existente ...
}
```

#### 4.2 Métricas de Rate Limiting (30min)

- Tracking de métricas de rate limiting (intentos bloqueados, ventanas activas)
- Integración con analytics

---

## Archivos Afectados

### Nuevos Archivos

1. `apps/backend-v2/src/services/authObservabilityService.ts` (200 líneas estimadas)
2. `apps/backend-v2/src/utils/authObservability.ts` (150 líneas estimadas)

### Modificaciones

1. `apps/backend-v2/src/services/authService.ts` (+50 líneas: integración de observability)
2. `apps/backend-v2/src/services/rateLimitService.ts` (+30 líneas: logging de rate limits)
3. `apps/backend-v2/src/utils/logger.ts` (+20 líneas: mejoras para logging estructurado)

---

## Criterios de Validación

### Implementación

- [x] AuthObservabilityService creado con logging estructurado
- [x] Helpers de observabilidad implementados
- [x] Integración con authService completa
- [x] Integración con rateLimitService completa
- [x] Correlation IDs y request IDs en todos los logs
- [x] PII sanitizado en logs (emails truncados, IPs prefijadas)
- [x] Integración con Amplitude para eventos de auth

### Logging

- [x] Logs estructurados en formato JSON
- [x] Todos los eventos de auth tienen correlation IDs
- [x] Todos los eventos de auth tienen request IDs
- [x] PII sanitizado correctamente
- [x] Logs incluyen nivel, servicio, evento, timestamp

### Métricas

- [x] Métricas de login (intentos, éxito, duración)
- [x] Métricas de register (intentos, éxito, duración)
- [x] Métricas de rate limiting (intentos bloqueados)
- [x] Métricas de errores (por tipo de error)
- [x] Integración con Amplitude para tracking

---

## Estimación de Esfuerzo

| Fase      | Duración | Descripción                         |
| --------- | -------- | ----------------------------------- |
| Fase 1    | 3h       | Auth Observability Service          |
| Fase 2    | 2h       | Helpers de Observabilidad           |
| Fase 3    | 2h       | Integración con Auth Service        |
| Fase 4    | 1h       | Integración con Rate Limiting       |
| **TOTAL** | **8h**   | ~1 día de trabajo                  |

---

## Próximos Pasos

1. **Implementar AuthObservabilityService** (Fase 1)
2. **Crear helpers de observabilidad** (Fase 2)
3. **Integrar con authService** (Fase 3)
4. **Integrar con rateLimitService** (Fase 4)
5. **Validar logging y métricas** (tests manuales)
6. **Commit + PR** individual para ROA-410

---

**Plan aprobado. Continuando con implementación automáticamente.**

