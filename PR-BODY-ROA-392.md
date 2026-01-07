# ROA-392: Rate Limit Policy Global v2 - Phase 1 (Core Infrastructure)

## 🎯 Objetivo

Implementar sistema unificado de rate limiting para todos los endpoints y servicios de Roastr v2, con configuración centralizada en SSOT, hot-reload, fail-safe behavior y soporte para múltiples scopes.

**Issue:** [ROA-392](https://linear.app/roastrai/issue/ROA-392/rate-limit-policy-global-v2)  
**Type:** backend, docs, ci, analysis  
**Priority:** P1

---

## 📋 Resumen de Cambios

### ✅ Implementado en Phase 1

#### 1. SSOT v2 Actualizado (`docs/SSOT-V2.md`)

**Nueva sección 12.6: Rate Limiting Global v2**

- Estructura de configuración TypeScript completa
- Valores por defecto para 13 scopes:
  - `global` - Rate limit global (10,000/hora)
  - `auth.*` - Password (5/15min), Magic Link (3/hora), OAuth (10/15min), Password Reset (3/hora)
  - `ingestion.*` - Global (1,000/hora), Per User (100/hora), Per Account (50/hora)
  - `roast` - 10/min
  - `persona` - 3/hora
  - `notifications` - 10/min
  - `gdpr` - 5/hora
  - `admin` - 100/min
- Feature flags para control granular por scope
- Progressive blocking durations (15min → 1h → 24h → permanent)
- Algoritmo sliding window con Redis
- Fail-safe rules (bloquea en errores de Redis)

**Feature Flags añadidos:**
- `enable_rate_limit_global`
- `enable_rate_limit_auth`
- `enable_rate_limit_ingestion`
- `enable_rate_limit_roast`
- `enable_rate_limit_persona`
- `enable_rate_limit_notifications`
- `enable_rate_limit_gdpr`
- `enable_rate_limit_admin`

#### 2. RateLimitPolicyGlobal Service (`src/services/rateLimitPolicyGlobal.js`)

**Servicio centralizado de rate limiting (540 líneas)**

**Métodos públicos:**
- `checkRateLimit(scope, key, metadata)` - Verifica si request está dentro del límite
- `incrementRateLimit(scope, key, metadata)` - Incrementa contador (post-request)
- `getRateLimitStatus(scope, key)` - Obtiene estado actual de un key
- `clearRateLimit(scope, key)` - Borra rate limit (admin)
- `getConfig(scope)` - Obtiene configuración de un scope

**Características:**
- ✅ Sliding window algorithm con Redis (sorted sets + timestamps)
- ✅ Hot-reload desde SettingsLoader v2 (cache 1 minuto)
- ✅ Fail-safe behavior (bloquea si Redis falla)
- ✅ Masking de keys sensibles (emails → `em***@domain.com`, IPs → `192.168.***.***`)
- ✅ Progressive blocking support
- ✅ Structured logging con contexto completo
- ✅ Soporta 13 scopes (simple y nested)

**Fail-Safe Rules (SSOT 12.6.6):**
1. NUNCA bypass rate limiting en errores de Redis → **BLOCK**
2. SIEMPRE cargar configuración desde SSOT (no hardcodear)
3. SIEMPRE respetar feature flags por scope
4. SIEMPRE usar sliding window (no fixed window)
5. NUNCA exponer detalles internos de rate limiting en respuestas API

#### 3. SettingsLoader v2 Integration (`src/services/settingsLoaderV2.js`)

**Nuevos métodos:**
- `async loadRateLimitPolicy()` - Carga configuración de rate limits desde merged config
- `_getDefaultRateLimitPolicy()` - Fallback a SSOT defaults

**Flujo:**
1. Intenta cargar desde `merged config` (admin_settings > admin-controlled.yaml)
2. Si no existe → fallback a SSOT defaults
3. Cache de 1 minuto (hot-reload automático)

#### 4. Documentación Completa

**Subnodo creado:** `docs/nodes-v2/infraestructura/rate-limits.md` (700+ líneas)

**15 secciones:**
1. Resumen
2. Arquitectura (componentes, scopes, feature flags)
3. Algoritmo (sliding window, progressive blocking)
4. Almacenamiento (Redis keys, TTL, fallback)
5. Configuración (carga desde SSOT, admin panel, validación)
6. Fail-Safe Behavior (reglas críticas, manejo de errores)
7. Seguridad (masking de keys, abuse detection)
8. Observabilidad (logs, métricas, alertas)
9. Testing (unit, integration, E2E)
10. Migration Path (legacy implementations, timeline)
11. Dependencies (upstream/downstream)
12. Edge Cases (8 casos documentados)
13. Related Nodes
14. Acceptance Criteria
15. References

**Nodo actualizado:** `docs/nodes-v2/14-infraestructura.md`
- Subnodo `rate-limits` ahora implementado (✅)

**Plan de implementación:** `docs/plan/issue-ROA-392.md` (450+ líneas)

#### 5. CI/CD Validation (`scripts/validate-rate-limit-config.js`)

**Script de validación para CI (350+ líneas)**

**Validaciones:**
- ✅ SSOT v2 contiene sección 12.6
- ✅ Todos los scopes documentados en SSOT
- ✅ Todos los feature flags documentados
- ✅ RateLimitPolicyGlobal service existe con métodos requeridos
- ✅ SettingsLoader v2 tiene `loadRateLimitPolicy()`
- ✅ No hay valores hardcoded fuera de SSOT/SettingsLoader/RateLimitPolicyGlobal
- ✅ Documentación existe (subnodo + nodo)

**Resultado:**
```
✅ 6 info checks passed
⚠️  11 warnings (legacy rate limiters detected - expected)
❌ 0 errors
```

---

## 📊 Estadísticas

**Archivos creados:** 4
- `src/services/rateLimitPolicyGlobal.js` (540 líneas)
- `docs/nodes-v2/infraestructura/rate-limits.md` (700+ líneas)
- `scripts/validate-rate-limit-config.js` (350+ líneas)
- `docs/plan/issue-ROA-392.md` (450+ líneas)

**Archivos modificados:** 4
- `docs/SSOT-V2.md` (+200 líneas - sección 12.6)
- `src/services/settingsLoaderV2.js` (+120 líneas)
- `docs/nodes-v2/14-infraestructura.md` (actualización menor)
- `.issue_lock` (configuración de worktree)

**Total líneas añadidas:** ~2,142 líneas

**Commits:** 1
- `05307344` - feat(ROA-392): Rate Limit Policy Global v2 - Phase 1 (Core Infrastructure)

---

## ✅ Validaciones v2 Pasando

```bash
# SSOT Health
node scripts/validate-ssot-health.js --ci
# ✅ Health Score: 100/100

# Doc Paths
node scripts/validate-v2-doc-paths.js --ci
# ✅ 21/21 paths válidos

# Strong Concepts
node scripts/validate-strong-concepts.js --ci
# ✅ Sin duplicados

# System Map Drift
node scripts/check-system-map-drift.js --ci
# ✅ Sin drift crítico

# Rate Limit Config
node scripts/validate-rate-limit-config.js
# ✅ 0 errors, 11 warnings (legacy expected)
```

---

## ⏭️ Phase 2 (Migraciones) - Pendiente

**TODOs para Phase 2:**

1. **Migrar authRateLimiterV2**
   - Refactorizar `src/middleware/authRateLimiterV2.js`
   - Usar `RateLimitPolicyGlobal` con scope `auth`
   - Mantener compatibilidad con rutas existentes

2. **Migrar ingestion/RateLimitPolicy**
   - Refactorizar `src/services/ingestion/policies/RateLimitPolicy.js`
   - Usar `RateLimitPolicyGlobal` con scope `ingestion`
   - Mantener interfaz `PolicyResult`

3. **Evaluar legacy rate limiters** (11 detectados)
   - `src/middleware/adminRateLimiter.js`
   - `src/middleware/gdprRateLimiter.js`
   - `src/middleware/notificationRateLimiter.js`
   - `src/middleware/roastRateLimiter.js`
   - `src/middleware/roastrPersonaRateLimiter.js`
   - `src/middleware/passwordChangeRateLimiter.js`
   - `src/middleware/rateLimiter.js` (genérico)
   - `src/middleware/security.js` (rate limiting parcial)
   - `src/middleware/webhookSecurity.js` (rate limiting parcial)
   - `src/routes/analytics.js` (rate limiting inline)
   - `src/routes/roast.js` (rate limiting inline)
   - Decidir: Migrar o Deprecar

---

## ⏭️ Phase 3 (Tests) - Pendiente

**TODOs para Phase 3:**

1. **Unit Tests** (>=90% coverage)
   - `tests/unit/services/rateLimitPolicyGlobal.test.js`
   - Sliding window algorithm
   - Feature flags
   - Fail-safe behavior
   - Config loading
   - Key masking

2. **Integration Tests**
   - `tests/integration/rateLimitPolicyGlobal.integration.test.js`
   - Redis sliding window end-to-end
   - SettingsLoader v2 integration
   - Cache invalidation

3. **E2E Tests** (Playwright)
   - `tests/e2e/rateLimitPolicyGlobal.e2e.test.js`
   - Admin edita rate limit → sistema responde
   - Feature flag disabled → rate limiting OFF
   - Rate limit excedido → retry_after correcto

---

## 🔗 Referencias

- **SSOT Reference:** Section 12.6 (Rate Limiting Global v2)
- **Implementation:** `src/services/rateLimitPolicyGlobal.js`
- **Documentation:** `docs/nodes-v2/infraestructura/rate-limits.md`
- **Plan:** `docs/plan/issue-ROA-392.md`
- **Issue:** [ROA-392](https://linear.app/roastrai/issue/ROA-392/rate-limit-policy-global-v2)

---

## ✅ Checklist Pre-PR

- [x] Rama con nombre correcto (`feature/ROA-392-auto`)
- [x] Issue asociada incluida en descripción
- [x] Solo commits de esta issue en esta rama (1 commit)
- [x] No hay valores hardcoded fuera de SSOT
- [x] No hay `console.log` (excepto en scripts)
- [x] Validaciones v2 pasando (5/5)
- [x] Documentación completa (SSOT + subnodo + plan)
- [x] CI validation script creado y funcionando
- [x] Historial limpio
- [x] Solo cambios relevantes a la issue

---

## 🎯 Estado de la Issue

**Phase 1 (Core Infrastructure):** ✅ **COMPLETADO**

✅ Infraestructura core implementada  
✅ SSOT actualizado  
✅ Documentación completa  
✅ Validaciones pasando  
✅ Ready para merge y Phase 2

**Próximos pasos post-merge:**
1. Merge de Phase 1
2. Crear issue/PR para Phase 2 (Migraciones)
3. Crear issue/PR para Phase 3 (Tests)

---

## 📝 Notas para Reviewers

### Áreas de Enfoque

1. **SSOT v2 (docs/SSOT-V2.md)**
   - Verificar que sección 12.6 está completa y coherente
   - Validar valores por defecto son razonables
   - Confirmar feature flags correctamente documentados

2. **RateLimitPolicyGlobal (src/services/rateLimitPolicyGlobal.js)**
   - Revisar fail-safe behavior (bloquea correctamente en errores)
   - Validar sliding window algorithm con Redis
   - Verificar masking de keys sensibles (no PII en logs)
   - Confirmar hot-reload funciona correctamente

3. **SettingsLoader v2 (src/services/settingsLoaderV2.js)**
   - Verificar integración con RateLimitPolicyGlobal
   - Validar fallback a defaults funciona
   - Confirmar cache correctamente

4. **Documentación (docs/nodes-v2/infraestructura/rate-limits.md)**
   - Revisar completitud de 15 secciones
   - Validar edge cases están cubiertos
   - Verificar migration path claro

5. **CI Validation (scripts/validate-rate-limit-config.js)**
   - Verificar detección de legacy rate limiters
   - Validar que bloquea valores hardcoded
   - Confirmar todas las validaciones necesarias

### Legacy Code

**11 archivos legacy detectados** que aún usan rate limiting hardcoded. Esto es **esperado** para Phase 1.

Phase 2 se encargará de migrar estos archivos a usar `RateLimitPolicyGlobal`.

**No bloquea merge de Phase 1** ya que:
- Son archivos existentes (no nuevos)
- No hay regresión funcional
- Phase 1 establece la infraestructura necesaria
- Validaciones detectan correctamente estos archivos

---

## 🚀 Testing Instructions

### Manual Testing

```bash
# 1. Validar SSOT
node scripts/validate-ssot-health.js --ci

# 2. Validar documentación
node scripts/validate-v2-doc-paths.js --ci

# 3. Validar rate limit config
node scripts/validate-rate-limit-config.js

# 4. Verificar service existe y es importable
node -e "const RLP = require('./src/services/rateLimitPolicyGlobal'); console.log('✅ Service imported successfully');"

# 5. Verificar SettingsLoader tiene método
node -e "const SL = require('./src/services/settingsLoaderV2'); console.log(typeof SL.loadRateLimitPolicy === 'function' ? '✅ Method exists' : '❌ Method missing');"
```

### Expected Results

- ✅ Todos los scripts de validación pasan
- ✅ Service se importa sin errores
- ✅ SettingsLoader tiene método `loadRateLimitPolicy`
- ⚠️  11 warnings en `validate-rate-limit-config.js` (legacy files - expected)

---

## 📸 Screenshots

N/A - Esta es una PR de infraestructura backend sin cambios visuales de UI.

---

**Ready for Review** ✅

