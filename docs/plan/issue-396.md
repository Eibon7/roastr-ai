# Issue #396: Post-Merge SPEC 10 Tier Limits System Production Monitoring

**Status**: In Progress
**Priority**: High (Error Alerting), Medium (Cache Monitoring), Low (Sentry)
**Related**: PR #384 (Tier Validation System), Issue #368
**Started**: 2025-11-10

---

## Estado Actual

### Implementación Existente (PR #384)

**Archivo**: `src/services/tierValidationService.js`

**Métricas actuales** (líneas 48-54):
```javascript
this.metrics = {
    validationCalls: 0,
    allowedActions: 0,
    blockedActions: 0,
    errors: 0
};
```

**Cache existente**:
- `usageCache`: Map con timeout de 5 minutos
- `requestScopedCache`: Cache por request
- TTL: `CACHE_CONFIG.timeouts.usage` (300,000ms = 5min)

**Método actual**: `getMetrics()` (líneas 1149-1157)

---

## Aceptación Criteria

### AC1: Cache TTL Performance Monitoring (Medium Priority)

**Objetivo**: Rastrear hit rates y rendimiento del cache de 5 minutos

**Implementación**:
1. Añadir métricas de cache a `this.metrics`:
   - `cacheHits` - Número de hits de cache
   - `cacheMisses` - Número de misses
   - `cacheHitRate` - Porcentaje (hits / total)
   - `avgCacheAge` - Edad promedio de entries en cache
2. Instrumentar métodos de cache:
   - `getCachedUsage()` - Track hit/miss
   - `getCachedUserTier()` - Track hit/miss
3. Añadir método `getCachePerformanceMetrics()`:
   - Retorna estadísticas detalladas de cache
   - TTL actual, hit rate, size, performance

**Archivos afectados**:
- `src/services/tierValidationService.js` (modificar métricas + métodos cache)

---

### AC2: Error Alerting Configuration (High Priority) 🔴

**Objetivo**: Configurar alerting para `this.metrics.errors`

**Thresholds**:
- Error rate >5% (errors / validationCalls)
- Absolute count >100 errors/hour

**Implementación**:
1. Crear `src/services/monitoring/tierValidationMonitor.js`:
   - Clase `TierValidationMonitor`
   - Método `checkErrorThresholds()`
   - Alerting vía logger + optional webhook
2. Añadir tracking temporal de errores:
   - Slidin window de 1 hora para conteo
   - Array `this.errorTimestamps = []`
   - Método `pruneOldErrors()` para limpiar >1h
3. Método `shouldAlert()`:
   - Calcula error rate actual
   - Cuenta errors en última hora
   - Retorna boolean + reason
4. Integrar en `validateAction()`:
   - Después de incrementar `this.metrics.errors++`
   - Llamar `monitor.checkAndAlert(this.metrics)`
5. Logging estructurado:
   - `logger.error()` con categoría `tier_validation_alert`
   - Incluir: userId, error rate, absolute count, threshold

**Archivos afectados**:
- `src/services/tierValidationService.js` (añadir errorTimestamps + alerting)
- `src/services/monitoring/tierValidationMonitor.js` (NUEVO)

---

### AC3: Sentry Integration (Low Priority)

**Objetivo**: Mejorar error tracking con Sentry breadcrumbs

**Implementación**:
1. Verificar si Sentry ya está configurado:
   - Buscar `@sentry/node` en package.json
   - Buscar inicialización en `src/index.js` o `src/app.js`
2. Si NO existe:
   - Añadir `@sentry/node` a dependencies
   - Inicializar en `src/config/sentry.js`
   - Feature flag `SENTRY_ENABLED` (default: false)
3. En `tierValidationService.js`:
   - Importar Sentry (condicional)
   - Método `addSentryBreadcrumb(category, data)`:
     - Check si Sentry disponible
     - Añadir breadcrumb con contexto
   - Llamar en puntos clave:
     - `validateAction()` - inicio/fin
     - Errores críticos
     - Cache invalidation events
4. Enhanced error capture:
   - En catch blocks, usar `Sentry.captureException(error, { extra: {...} })`
   - Incluir contexto completo: userId, action, metrics

**Archivos afectados**:
- `package.json` (si es necesario)
- `src/config/sentry.js` (NUEVO, opcional)
- `src/services/tierValidationService.js` (integración Sentry)

---

## Pasos de Implementación

### Paso 1: Cache Performance Monitoring (AC1)

1. Extender `this.metrics`:
   ```javascript
   this.metrics = {
       validationCalls: 0,
       allowedActions: 0,
       blockedActions: 0,
       errors: 0,
       // NEW:
       cacheHits: 0,
       cacheMisses: 0
   };
   ```

2. Instrumentar `getCachedUsage()`:
   ```javascript
   getCachedUsage(userId) {
       const cached = this.usageCache.get(userId);
       if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
           this.metrics.cacheHits++;  // ← Track hit
           return cached.data;
       }
       this.metrics.cacheMisses++;  // ← Track miss
       return null;
   }
   ```

3. Crear `getCachePerformanceMetrics()`:
   ```javascript
   getCachePerformanceMetrics() {
       const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
       const hitRate = totalRequests > 0 ?
           (this.metrics.cacheHits / totalRequests * 100).toFixed(2) : 0;

       return {
           hits: this.metrics.cacheHits,
           misses: this.metrics.cacheMisses,
           hitRate: `${hitRate}%`,
           cacheSize: this.usageCache.size,
           ttlMs: this.cacheTimeout,
           timestamp: new Date().toISOString()
       };
   }
   ```

4. Extender `getMetrics()`:
   ```javascript
   getMetrics() {
       return {
           ...this.metrics,
           cachePerformance: this.getCachePerformanceMetrics(),
           timestamp: new Date().toISOString()
       };
   }
   ```

---

### Paso 2: Error Alerting System (AC2) 🔴

1. Añadir tracking temporal:
   ```javascript
   constructor() {
       // ... existing
       this.errorTimestamps = [];  // Track errors for last hour
       this.lastAlertTime = null;   // Prevent alert spam
       this.alertCooldownMs = 300000; // 5 min between alerts
   }
   ```

2. Método para registrar errors:
   ```javascript
   recordError(userId, action, error) {
       this.metrics.errors++;
       this.errorTimestamps.push(Date.now());
       this.pruneOldErrors();

       // Check if alert needed
       this.checkErrorThresholds(userId, action, error);
   }
   ```

3. Método para limpiar errors antiguos:
   ```javascript
   pruneOldErrors() {
       const oneHourAgo = Date.now() - (60 * 60 * 1000);
       this.errorTimestamps = this.errorTimestamps.filter(t => t > oneHourAgo);
   }
   ```

4. Método de alerting:
   ```javascript
   checkErrorThresholds(userId, action, error) {
       this.pruneOldErrors();

       const errorCount = this.errorTimestamps.length;
       const errorRate = this.metrics.validationCalls > 0 ?
           (this.metrics.errors / this.metrics.validationCalls * 100) : 0;

       // Threshold 1: Error rate >5%
       const rateExceeded = errorRate > 5;

       // Threshold 2: Absolute count >100/hour
       const countExceeded = errorCount > 100;

       // Check cooldown
       const canAlert = !this.lastAlertTime ||
           (Date.now() - this.lastAlertTime) > this.alertCooldownMs;

       if ((rateExceeded || countExceeded) && canAlert) {
           this.triggerAlert({
               userId,
               action,
               error: error.message,
               metrics: {
                   errorRate: `${errorRate.toFixed(2)}%`,
                   errorsLastHour: errorCount,
                   totalErrors: this.metrics.errors,
                   totalValidations: this.metrics.validationCalls
               },
               thresholds: {
                   rateThreshold: '5%',
                   countThreshold: 100
               },
               violations: {
                   rateExceeded,
                   countExceeded
               },
               timestamp: new Date().toISOString()
           });

           this.lastAlertTime = Date.now();
       }
   }
   ```

5. Método para triggerar alerta:
   ```javascript
   triggerAlert(alertData) {
       logger.error('🚨 TIER VALIDATION ALERT: Error threshold exceeded', alertData);

       // Optional: Send to external monitoring (webhook, Slack, PagerDuty)
       // if (process.env.ALERT_WEBHOOK_URL) {
       //     fetch(process.env.ALERT_WEBHOOK_URL, {
       //         method: 'POST',
       //         headers: { 'Content-Type': 'application/json' },
       //         body: JSON.stringify(alertData)
       //     }).catch(e => logger.error('Failed to send alert webhook', e));
       // }
   }
   ```

6. Integrar en catch block de `validateAction()`:
   ```javascript
   catch (error) {
       this.recordError(userId, action, error);  // ← Replace metrics.errors++
       // ... rest of error handling
   }
   ```

---

### Paso 3: Sentry Integration (AC3)

1. Verificar existencia de Sentry:
   ```bash
   grep -r "@sentry/node" package.json src/
   ```

2. Si NO existe, añadir:
   ```bash
   npm install @sentry/node --save
   ```

3. Crear configuración:
   ```javascript
   // src/config/sentry.js
   const Sentry = require('@sentry/node');
   const { logger } = require('../utils/logger');

   const SENTRY_ENABLED = process.env.SENTRY_ENABLED === 'true' &&
                          process.env.SENTRY_DSN;

   if (SENTRY_ENABLED) {
       Sentry.init({
           dsn: process.env.SENTRY_DSN,
           environment: process.env.NODE_ENV || 'development',
           tracesSampleRate: 0.1  // 10% transaction sampling
       });

       logger.info('Sentry initialized for tier validation monitoring');
   } else {
       logger.debug('Sentry disabled or not configured');
   }

   module.exports = { Sentry, SENTRY_ENABLED };
   ```

4. Integrar en `tierValidationService.js`:
   ```javascript
   // At top of file
   const { Sentry, SENTRY_ENABLED } = require('../config/sentry');

   // In class methods
   addSentryBreadcrumb(category, data) {
       if (!SENTRY_ENABLED) return;

       Sentry.addBreadcrumb({
           category: `tier_validation.${category}`,
           message: data.message || category,
           level: data.level || 'info',
           data: {
               ...data,
               service: 'tier_validation_service',
               timestamp: new Date().toISOString()
           }
       });
   }
   ```

5. Añadir breadcrumbs en puntos clave:
   ```javascript
   async validateAction(userId, action, options = {}) {
       this.addSentryBreadcrumb('validation_start', {
           userId,
           action,
           requestId: options.requestId
       });

       try {
           // ... validation logic

           this.addSentryBreadcrumb('validation_complete', {
               userId,
               action,
               allowed: result.allowed,
               reason: result.reason
           });

           return result;
       } catch (error) {
           this.addSentryBreadcrumb('validation_error', {
               level: 'error',
               userId,
               action,
               error: error.message
           });

           if (SENTRY_ENABLED) {
               Sentry.captureException(error, {
                   extra: {
                       userId,
                       action,
                       metrics: this.getMetrics(),
                       cachePerformance: this.getCachePerformanceMetrics()
                   },
                   tags: {
                       service: 'tier_validation',
                       action_type: action
                   }
               });
           }

           throw error;
       }
   }
   ```

---

## Tests

### AC1: Cache Performance Tests

**Archivo**: `tests/unit/services/tierValidationService-monitoring.test.js`

```javascript
describe('Cache Performance Monitoring', () => {
    it('should track cache hits', async () => {
        // Call twice with same userId - second should hit cache
        await service.validateAction(userId, 'roast');
        await service.validateAction(userId, 'roast');

        const metrics = service.getMetrics();
        expect(metrics.cacheHits).toBeGreaterThan(0);
    });

    it('should track cache misses', async () => {
        const metrics1 = service.getMetrics();
        await service.validateAction(userId, 'roast');
        const metrics2 = service.getMetrics();

        expect(metrics2.cacheMisses).toBe(metrics1.cacheMisses + 1);
    });

    it('should calculate hit rate correctly', () => {
        service.metrics.cacheHits = 80;
        service.metrics.cacheMisses = 20;

        const perf = service.getCachePerformanceMetrics();
        expect(perf.hitRate).toBe('80.00%');
    });
});
```

### AC2: Error Alerting Tests

```javascript
describe('Error Alerting', () => {
    it('should trigger alert when error rate >5%', () => {
        // Simulate 100 validations with 6 errors (6%)
        service.metrics.validationCalls = 100;
        service.metrics.errors = 0;

        const alertSpy = jest.spyOn(service, 'triggerAlert');

        // Trigger 6th error
        for (let i = 0; i < 6; i++) {
            service.recordError(userId, 'roast', new Error('test'));
        }

        expect(alertSpy).toHaveBeenCalled();
        expect(alertSpy.mock.calls[0][0].violations.rateExceeded).toBe(true);
    });

    it('should trigger alert when errors >100/hour', () => {
        const alertSpy = jest.spyOn(service, 'triggerAlert');

        // Simulate 101 errors in last hour
        for (let i = 0; i < 101; i++) {
            service.recordError(userId, 'roast', new Error('test'));
        }

        expect(alertSpy).toHaveBeenCalled();
        expect(alertSpy.mock.calls[0][0].violations.countExceeded).toBe(true);
    });

    it('should respect alert cooldown period', () => {
        service.metrics.validationCalls = 100;
        const alertSpy = jest.spyOn(service, 'triggerAlert');

        // First alert
        for (let i = 0; i < 10; i++) {
            service.recordError(userId, 'roast', new Error('test'));
        }
        expect(alertSpy).toHaveBeenCalledTimes(1);

        // Second batch within cooldown
        for (let i = 0; i < 10; i++) {
            service.recordError(userId, 'roast', new Error('test'));
        }
        expect(alertSpy).toHaveBeenCalledTimes(1);  // Still only once
    });
});
```

### AC3: Sentry Integration Tests

```javascript
describe('Sentry Integration', () => {
    beforeEach(() => {
        process.env.SENTRY_ENABLED = 'true';
        jest.clearAllMocks();
    });

    it('should add breadcrumb on validation start', async () => {
        const breadcrumbSpy = jest.spyOn(Sentry, 'addBreadcrumb');

        await service.validateAction(userId, 'roast');

        expect(breadcrumbSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'tier_validation.validation_start'
            })
        );
    });

    it('should capture exception with context on error', async () => {
        const captureSpy = jest.spyOn(Sentry, 'captureException');

        // Force an error
        mockSupabase.from.mockImplementation(() => {
            throw new Error('Database error');
        });

        await service.validateAction(userId, 'roast').catch(() => {});

        expect(captureSpy).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({
                extra: expect.objectContaining({
                    userId,
                    metrics: expect.any(Object)
                })
            })
        );
    });
});
```

---

## Integración con Observability Node

**Actualizar**: `docs/nodes/observability.md`

Añadir nueva sección:

```markdown
### Tier Validation Monitoring (Issue #396)

Production monitoring for tier validation system:

**Cache Performance**:
- Hit rate tracking (target: >80%)
- TTL: 5 minutes
- Metrics: hits, misses, hitRate, size

**Error Alerting**:
- Threshold 1: Error rate >5%
- Threshold 2: Absolute count >100 errors/hour
- Alert cooldown: 5 minutes
- Delivery: Structured logs + optional webhook

**Sentry Integration**:
- Breadcrumbs at validation lifecycle points
- Enhanced exception capture with full context
- Feature flag: `SENTRY_ENABLED=true`

**Endpoints**:
- `/api/tier-validation/metrics` - Get current metrics
- `/api/tier-validation/cache-performance` - Cache stats
```

---

## Validation Checklist

- [ ] AC1: Cache hit/miss tracking implementado
- [ ] AC1: `getCachePerformanceMetrics()` retorna datos correctos
- [ ] AC2: Error tracking temporal con sliding window
- [ ] AC2: Alerting triggers a >5% error rate
- [ ] AC2: Alerting triggers a >100 errors/hour
- [ ] AC2: Alert cooldown funciona (5min)
- [ ] AC3: Sentry breadcrumbs en puntos clave
- [ ] AC3: Sentry exception capture con contexto
- [ ] Tests: 100% passing para nueva funcionalidad
- [ ] Docs: `observability.md` actualizado
- [ ] Logs: Structured logging para todas las alertas
- [ ] No breaking changes en API pública

---

## Archivos a Modificar

1. `src/services/tierValidationService.js` - Core implementation
2. `src/config/sentry.js` - NEW (opcional si no existe)
3. `tests/unit/services/tierValidationService-monitoring.test.js` - NEW
4. `tests/integration/tierValidationMonitoring.test.js` - Revisar si existe
5. `docs/nodes/observability.md` - Update with new monitoring
6. `docs/nodes/cost-control.md` - Reference to monitoring (if needed)
7. `.env.example` - Add `SENTRY_DSN`, `SENTRY_ENABLED`, `ALERT_WEBHOOK_URL`
8. `package.json` - Add @sentry/node (if not present)

---

## Agentes Relevantes

- **Backend Developer** - Core implementation
- **Test Engineer** - Comprehensive test coverage
- **Guardian** - Security review for alerting system
- **Orchestrator** - Coordination and planning

---

**Status**: Plan completado, listo para implementación
**Next Step**: Implementar AC2 (High priority) primero
**Timeline**: ~4 horas de implementación + 2 horas de tests
