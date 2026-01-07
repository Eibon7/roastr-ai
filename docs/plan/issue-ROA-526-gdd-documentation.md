# Actualización de Nodos GDD - ROA-526

**Issue:** ROA-526 - Rate Limiting v2: Auth Wiring, Observability, and Global Validation  
**Fecha:** 2025-01-07  
**Nodos Afectados:** infraestructura, observabilidad, ssot-integration  

---

## Nodo: `14-infraestructura.md`

### Sección a Añadir: Rate Limiting v2 (después de línea 86)

```markdown
## Rate Limiting v2 (ROA-526)

### Estado
- ✅ **Global Validation** implementada
- ✅ **Health Check** endpoint disponible
- ✅ **Startup Validation** integrada
- ✅ **Correlation Tracking** implementado
- ✅ **Metrics Export** (Prometheus format)

### Componentes

#### 1. Script de Validación
**Archivo:** `scripts/validate-rate-limit-config.js`

**Validaciones:**
- Auth rate limit configuration (SSOT §12.4)
- Progressive block durations
- Abuse detection thresholds
- Endpoint coverage

**Uso:**
```bash
node scripts/validate-rate-limit-config.js
```

**Exit Codes:**
- `0`: All validations passed
- `1`: Configuration errors detected
- `2`: Critical errors (SSOT unavailable)

#### 2. Health Check Endpoint
**Endpoint:** `GET /api/monitoring/health/rate-limiter`  
**Auth:** Admin only  

**Health Checks:**
- SSOT configuration validity
- Redis/Upstash connectivity
- Metrics availability
- Active blocks count

**Status Levels:**
- `healthy`: All systems operational
- `degraded`: Some warnings but functional
- `unhealthy`: Critical failures detected

#### 3. Startup Validation
**Archivo:** `src/index.js`  
**Función:** `validateRateLimitConfig()`  

**Comportamiento:**
- Non-blocking (no detiene startup)
- Usa fallbacks seguros si SSOT no disponible
- Logs warnings/errors to console
- Skips validation in test environment

#### 4. Metrics Export
**Endpoint:** `GET /api/monitoring/metrics/prometheus`  
**Auth:** Admin only  
**Format:** Prometheus text-based exposition format  

**Métricas Exportadas:**
- `auth_rate_limit_hits_total` (counter)
- `auth_blocks_active` (gauge)
- `auth_abuse_events_total` (counter)
- `nodejs_uptime_seconds` (gauge)
- `nodejs_memory_*_bytes` (gauge)

### Dependencias

**SSOT References:**
- `rate_limit.auth` (§12.4)
- `rate_limit.auth.block_durations` (§12.4)
- `abuse_detection.thresholds` (§12.6.5)

**Services:**
- Redis/Upstash (storage)
- settingsLoaderV2 (config loading)
- auditLogService (event logging)

### Arquitectura

```
Startup
├── validateEnvironment() [existing]
└── validateRateLimitConfig() [ROA-526]
    ├── Load from SSOT via settingsLoaderV2
    ├── Validate configuration structure
    ├── Log warnings/errors
    └── Use fallbacks if needed

Runtime
├── Health Check Endpoint
│   ├── Check SSOT config
│   ├── Check Redis connectivity
│   ├── Check metrics availability
│   └── Return status (healthy/degraded/unhealthy)
└── Metrics Export Endpoint
    ├── Collect rate limiter metrics
    ├── Collect system metrics
    └── Format as Prometheus text
```

### Edge Cases

1. **SSOT No Disponible en Startup**
   - Validación es non-blocking
   - Usa `FALLBACK_RATE_LIMIT_CONFIG`
   - Logs warning pero continúa

2. **Redis/Upstash Down**
   - Health check status: `degraded` (production) o `healthy` (dev/test)
   - Fallback a memoria (ya implementado en `authRateLimiterV2.js`)

3. **Configuración Inválida en SSOT**
   - Validación detecta errores
   - Logs detallados con sugerencias
   - Usa fallbacks seguros

### Validación en CI

**Scripts a ejecutar:**
```bash
# Validar configuración de rate limiting
node scripts/validate-rate-limit-config.js

# Validar startup (implicit en tests)
npm test
```

**Expected Results:**
- Exit code 0 (all validations passed)
- No critical errors in logs
- Coverage >= 90%

---

## Agentes Relevantes

- **TestEngineer**: Tests de rate limiting
- **Guardian**: Validación de configuración crítica
- **Back-end Dev**: Implementación de endpoints y middlewares
```

---

## Nodo: `observabilidad.md`

### Sección a Añadir: Rate Limiting Observability (después de sección de Correlation Tracking)

```markdown
## Rate Limiting Observability (ROA-526)

### Structured Logging

#### Eventos Implementados

1. **`auth.rate_limit.hit`**
   - Cuándo: Se alcanza el límite de rate limit
   - Campos: `ip`, `email` (sanitizado), `authType`, `ipAttempts`, `emailAttempts`, `offenseCount`, `requestId`

2. **`auth.rate_limit.blocked`**
   - Cuándo: Se bloquea un usuario por exceder el rate limit
   - Campos: `ip`, `email` (sanitizado), `authType`, `reason`, `offenseCount`, `blockedUntil`, `source`, `requestId`

3. **`auth.rate_limit.unblocked`**
   - Cuándo: Usuario desbloqueado tras autenticación exitosa
   - Campos: `ip`, `email` (sanitizado), `authType`, `reason`, `requestId`

4. **`auth.abuse.detected`**
   - Cuándo: Patrón de abuso detectado (riskScore >= 50)
   - Campos: `ip`, `email` (sanitizado), `authType`, `riskScore`, `patterns`, `requestId`

#### GDPR Compliance

**Email Sanitization:**
```javascript
email.substring(0, 3) + '***'
// Input: user@example.com
// Output: use***
```

**IP Logging:**
- IP completa se registra (justificado por seguridad)
- Debe estar en retention policy (SSOT §13)

**Campos NUNCA Registrados:**
- ❌ Password (plain o hash)
- ❌ Email completo
- ❌ Session tokens
- ❌ User IDs (excepto como hash o prefix)

### Correlation Tracking (ROA-526)

#### Middleware Implementado

**Archivo:** `src/middleware/correlationTracking.js`

**Generación de IDs:**
- `X-Request-Id`: UUID único por request
- Acepta header existente o genera nuevo
- Propaga en response headers
- Disponible en `req.id`

**User ID Tracking:**
- Se añade automáticamente si `req.user` disponible
- Disponible en `req.userId`
- NO se expone en response headers (privacidad)

**Logging Automático:**
- Incoming request log
- Request completed log con duration
- Incluye `requestId` y `userId` en todos los logs

#### Uso en Rate Limiting

**En `authRateLimiterV2.js`:**
```javascript
auditLogService.logEvent('auth.rate_limit.hit', {
  // ... otros campos
  requestId: req.id || crypto.randomUUID()
});
```

**Correlación de Logs:**
1. Todos los logs de una request tienen el mismo `requestId`
2. Todos los logs de un usuario tienen el mismo `userId`
3. Permite tracing completo de requests a través del sistema

### Metrics Export (ROA-526)

#### Formato Prometheus

**Endpoint:** `GET /api/monitoring/metrics/prometheus`  
**Auth:** Admin only  
**Content-Type:** `text/plain; version=0.0.4`  

**Métricas de Rate Limiting:**
```
# HELP auth_rate_limit_hits_total Total number of rate limit hits
# TYPE auth_rate_limit_hits_total counter
auth_rate_limit_hits_total 42

# HELP auth_blocks_active Number of currently active blocks
# TYPE auth_blocks_active gauge
auth_blocks_active 3

# HELP auth_abuse_events_total Total number of abuse detection events
# TYPE auth_abuse_events_total counter
auth_abuse_events_total 5
```

#### Configuración Prometheus

**prometheus.yml:**
```yaml
scrape_configs:
  - job_name: 'roastr-api'
    scrape_interval: 30s
    static_configs:
      - targets: ['api.roastr.ai']
    metrics_path: '/api/monitoring/metrics/prometheus'
    bearer_token: '<admin-token>'
```

#### Dashboards Recomendados

**Grafana Panels:**
1. Rate Limit Hits Over Time (graph)
2. Active Blocks (gauge)
3. Abuse Events Rate (graph)
4. Top Blocked IPs (table)

**Alertas:**
- Alert if `auth_blocks_active > 100` for 5 minutes
- Alert if `auth_abuse_events_total` increases by > 50 in 1 minute
- Alert if `auth_rate_limit_hits_total` > 1000/minute

---

## Agentes Relevantes

- **TestEngineer**: Tests de logging y correlation tracking
- **Back-end Dev**: Implementación de middleware y endpoints
- **DevOps**: Configuración de Prometheus/Grafana
```

---

## Nodo: `15-ssot-integration.md`

### Sección a Añadir: Rate Limiting Validation (después de sección de Validators)

```markdown
## Rate Limiting Configuration Validator (ROA-526)

### Script de Validación

**Archivo:** `scripts/validate-rate-limit-config.js`

**Propósito:** Validar configuración de rate limiting desde SSOT v2 antes de deployment

### Validaciones Implementadas

#### 1. Auth Rate Limit Config

**SSOT Section:** §12.4 - `rate_limit.auth`

**Validaciones:**
- Todos los auth types requeridos están presentes (password, magic_link, oauth, password_reset)
- Campos requeridos presentes: `windowMs`, `maxAttempts`, `blockDurationMs`
- Tipos correctos (todos números)
- Rangos válidos (`maxAttempts >= 1`, `windowMs >= 60000ms`)

#### 2. Progressive Block Durations

**SSOT Section:** §12.4 - `rate_limit.auth.block_durations`

**Validaciones:**
- Es un array
- Tiene al menos 3 entradas
- Todas las entradas son números positivos (excepto última que puede ser `null` para permanent block)
- Durations son progresivas (cada una mayor que la anterior)

#### 3. Abuse Detection Thresholds

**SSOT Section:** §12.6.5 - `abuse_detection.thresholds`

**Validaciones:**
- Todos los thresholds requeridos presentes: `multi_ip`, `multi_email`, `burst`, `slow_attack`
- Todos son números
- Todos >= 1

#### 4. Endpoint Coverage

**Validación:** Manual verification required

**Critical Endpoints:**
- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/magic-link`
- `/api/auth/oauth`
- `/api/auth/reset-password`

### Exit Codes

- `0`: All validations passed
- `1`: Configuration errors detected (non-blocking, pero requiere corrección)
- `2`: Critical errors (SSOT unavailable, invalid structure)

### Integración en CI

**Workflow:** `.github/workflows/ci.yml`

```yaml
- name: Validate Rate Limit Configuration
  run: node scripts/validate-rate-limit-config.js
```

**Expected Behavior:**
- CI fails if exit code != 0
- Bloquea merge si configuración inválida
- Logs detallados para debugging

### Startup Validation

**Función:** `validateRateLimitConfig()` in `src/index.js`

**Diferencias con Script:**
- Non-blocking (no detiene startup)
- Usa fallbacks si SSOT no disponible
- Logs warnings pero continúa
- Permite hot fixes en producción

**Workflow:**
```
Startup
└── validateRateLimitConfig() [async]
    ├── Load config from SSOT
    ├── Validate structure
    ├── Log warnings/errors
    ├── Use fallbacks if needed
    └── Continue (non-blocking)
```

---

## Agentes Relevantes

- **Guardian**: Validación de configuración crítica, enforcement de SSOT compliance
- **TestEngineer**: Tests de validadores
- **Back-end Dev**: Implementación de validación en startup
```

---

## Resumen de Cambios

| Nodo | Sección Añadida | Líneas Aprox. |
|------|-----------------|---------------|
| `14-infraestructura.md` | Rate Limiting v2 | ~120 |
| `observabilidad.md` | Rate Limiting Observability | ~100 |
| `15-ssot-integration.md` | Rate Limiting Validation | ~80 |

**Total:** ~300 líneas de documentación añadidas

---

## Próximos Pasos

1. ✅ Documentación creada
2. ⏭️ Integrar en nodos GDD (modificar archivos .md)
3. ⏭️ Actualizar "Agentes Relevantes" en cada nodo
4. ⏭️ Validar con `node scripts/resolve-graph.js --validate`

---

**Creado por:** AI Assistant  
**Fecha:** 2025-01-07  
**Status:** ✅ COMPLETO - Listo para integrar en nodos

