# ROA-392 - SSOT Contractual Fix: Rate Limit Auth

**Fecha:** 2025-01-07  
**Contexto:** PR ROA-392 - Rate Limit Policy Global v2 – Phase 1  
**Issue:** CodeRabbit blocker - `rate_limit.auth` not defined in SSOT  

---

## 🎯 Objetivo

Convertir el rate limiting de Auth en contrato explícito SSOT v2, eliminando cualquier ambigüedad contractual.

**NO se hizo:**
- ❌ Afinar valores
- ❌ Tocar lógica
- ❌ Añadir observabilidad
- ❌ Añadir tests nuevos

**SÍ se hizo:**
- ✅ Cerrar el contrato SSOT
- ✅ Alinear documentación
- ✅ Eliminar warnings contractuales

---

## 📝 Cambios Realizados

### 1️⃣ SSOT v2 Actualizado

**Archivo:** `docs/SSOT-V2.md`

**Cambios:**
- Añadida sección explícita `rate_limit.auth` en §12.4 con estructura completa:
  - `password`, `magic_link`, `oauth`, `password_reset` con `windowMs`, `maxAttempts`, `blockDurationMs`
  - `block_durations` para bloqueo progresivo (15min → 1h → 24h → permanent)
- Referenciado `abuse_detection.thresholds` desde §12.6.5 (no duplicar contenido)
- Añadida referencia al feature flag `enable_rate_limit_auth`
- Documentados storage (Redis/Upstash + memory fallback) y códigos de fallo contables

**Antes:**
```typescript
// Estructura TypeScript no consumible por código
type AuthRateLimitConfig = { ... }
```

**Después:**
```yaml
rate_limit:
  auth:
    password:
      windowMs: 900000
      maxAttempts: 5
      blockDurationMs: 900000
    # ... otros auth types
    block_durations:
      - 900000  # 15 min
      - 3600000 # 1 hour
      - 86400000 # 24 hours
      - null    # permanent
```

### 2️⃣ Configuración Enforceable Añadida

**Archivo:** `apps/backend-v2/src/config/admin-controlled.yaml`

**Cambios:**
- Añadido bloque `rate_limit.auth` completo (mirrors SSOT §12.4)
- Añadido bloque `abuse_detection.thresholds` (mirrors SSOT §12.6.5)

**Importancia:**
- `settingsLoaderV2` puede leer ahora la configuración desde archivo YAML
- Contrato SSOT es enforceable y validable
- No requiere DB para validación en CI

### 3️⃣ Documentación GDD Alineada

**Archivo:** `docs/plan/issue-ROA-526-gdd-documentation.md`

**Cambios:**
- Corregida referencia de `abuse_detection.thresholds` de §12.4 a §12.6.5 (ubicación correcta)

---

## ✅ Validaciones (Todas Pasaron)

### 1. Rate Limit Configuration Validator

```bash
node scripts/validate-rate-limit-config.js
```

**Resultado:** ✅ Exit 0
- 20 validaciones pasadas
- 1 warning (endpoint coverage - manual verification OK)

**Validaciones pasadas:**
- Auth rate limit config (password, magic_link, oauth, password_reset)
- Progressive block durations (4 entries, ascending, null at end)
- Abuse detection thresholds (multi_ip, multi_email, burst, slow_attack)

### 2. SSOT Health Check

```bash
node scripts/validate-ssot-health.js --ci
```

**Resultado:** ✅ Exit 0
- Health Score: 98.46/100
- System Map Alignment: 100%
- SSOT Alignment: 100%
- Dependency Density: 100%
- Crosslink Score: 92.31%
- Narrative Consistency: 100%

### 3. System Map Drift Check

```bash
node scripts/check-system-map-drift.js --ci
```

**Resultado:** ✅ Exit 0
- No drift detectado
- 10 orphaned files (legacy, esperado)
- Symmetry check passed

### 4. Strong Concepts Validator

```bash
node scripts/validate-strong-concepts.js
```

**Resultado:** ✅ Exit 0
- All Strong Concepts properly owned

---

## 🔒 Verificación del Código

**Sin cambios de lógica requeridos.** El código ya estaba correctamente implementado:

1. ✅ `authRateLimiterV2.js` lee `rate_limit.auth` desde SSOT (línea 93)
2. ✅ Los fallbacks solo actúan si SSOT falla (líneas 98-105, 120-126, 150-157)
3. ✅ Abuse detection lee de `abuse_detection.thresholds` (línea 137) - path correcto
4. ✅ No hay defaults hardcodeados específicos de Auth (solo fallbacks documentados)

---

## 📊 Resumen de Archivos

| Archivo | Cambios | Líneas |
|---------|---------|--------|
| `docs/SSOT-V2.md` | SSOT contract explícito | +50, -30 |
| `apps/backend-v2/src/config/admin-controlled.yaml` | Config enforceable | +38 |
| `docs/plan/issue-ROA-526-gdd-documentation.md` | Fix referencias | +2, -2 |

**Total:** 3 archivos, ~105 líneas netas

---

## 🚨 Blockers Resueltos

### Antes:
- ❌ CodeRabbit: "rate_limit.auth not defined in SSOT"
- ❌ Ambigüedad contractual: código consume `rate_limit.auth` pero SSOT no lo define
- ❌ Validación CI falla con exit code 2 (CRITICAL)

### Después:
- ✅ SSOT §12.4 define explícitamente `rate_limit.auth`
- ✅ `admin-controlled.yaml` hace el contrato enforceable
- ✅ Validación CI pasa con exit 0
- ✅ PR ROA-392 contractualmente correcta

---

## 🎉 Resultado Esperado

- ✅ SSOT v2 define explícitamente `rate_limit.auth`
- ✅ La PR queda contractualmente correcta
- ✅ CodeRabbit blocker resuelto
- ✅ PR lista para merge sin reservas

---

## 🔗 Referencias

- **PR:** ROA-392 - Rate Limit Policy Global v2 – Phase 1
- **Issue Original:** ROA-526 - Rate Limiting v2: Auth Wiring, Observability, and Global Validation
- **SSOT §12.4:** Rate Limiting de Autenticación
- **SSOT §12.6.5:** Abuse Detection Configuration

---

**Commit:** `3a6e5f0c` - fix(rate-limiting): Add explicit SSOT contract for rate_limit.auth (ROA-392)  
**Status:** ✅ COMPLETADO - Ready for merge  
**Reviewed by:** AI Assistant (Cursor)

