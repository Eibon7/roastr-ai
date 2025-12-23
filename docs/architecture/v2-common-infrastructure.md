# Infraestructura Común V2

**Issue:** ROA-369  
**Fecha:** 2025-12-19  
**Estado:** En auditoría

---

## 📋 Resumen Ejecutivo

Este documento describe el estado actual de la infraestructura común V2 que será compartida por todos los flujos de migración (Auth, Ingestion, Analysis, Output, etc.).

**Objetivo:** Garantizar que todos los flujos V2 pueden reutilizar la infraestructura sin workarounds y sin dependencias implícitas de V1.

---

## ✅ Componentes Listos

### 1. SettingsLoader v2
**Estado:** ✅ OK  
**Ubicación:** `src/services/settingsLoaderV2.js`

**Características:**
- Carga configuración estática desde `admin-controlled.yaml`
- Carga configuración dinámica desde tabla `admin_settings` (Supabase)
- Merge con prioridad: dinámico > estático
- Cache con TTL de 1 minuto
- Métodos: `loadStaticConfig()`, `loadDynamicConfig()`, `getMergedConfig()`, `getValue()`, `invalidateCache()`

**Garantías:**
- ✅ No hardcoded values
- ✅ No derivation (solo projection)
- ✅ Hot reload mediante invalidación de cache
- ✅ Fallbacks seguros (retorna {} si falla)

**Uso:**
```javascript
const settingsLoader = require('./services/settingsLoaderV2');
const config = await settingsLoader.getMergedConfig();
const value = await settingsLoader.getValue('shield.thresholds.critical');
```

### 2. V2 Endpoints
**Estado:** ✅ OK  
**Ubicación:** `src/routes/v2/`

**Endpoints públicos:**
- `GET /api/v2/settings/public` - Configuración pública (plans, limits, capabilities)
- `GET /api/v2/settings/tones` - Tonos válidos de roast
- `GET /api/v2/settings/roastr-persona/schema` - Schema de Roastr Persona
- `GET /api/v2/settings/shield` - Configuración de Shield

**Endpoints admin:**
- `GET /api/v2/admin/settings/gatekeeper` - Obtener configuración de Gatekeeper
- `PATCH /api/v2/admin/settings/gatekeeper` - Actualizar configuración de Gatekeeper

**Garantías:**
- ✅ Todos usan SettingsLoader v2
- ✅ No hardcoding
- ✅ Solo projection, no derivation
- ✅ Autenticación admin donde aplica

### 3. Gatekeeper
**Estado:** ✅ OK  
**Ubicación:** `src/services/gatekeeperService.js`

**Características:**
- Integrado con SettingsLoader v2
- Configuración desde `admin_settings.gatekeeper.*`
- Detección de abuso y seguridad

**Garantías:**
- ✅ Usa SettingsLoader v2
- ✅ Configuración dinámica desde admin_settings
- ✅ Fallbacks seguros

### 4. CI / GitHub Actions
**Estado:** ✅ OK  
**Ubicación:** `.github/workflows/ci.yml`

**Características:**
- Vitest-first approach
- Validadores v2 disponibles
- Workflows consolidados

**Validadores v2:**
- `scripts/validate-v2-doc-paths.js`
- `scripts/validate-ssot-health.js`
- `scripts/check-system-map-drift.js`
- `scripts/validate-strong-concepts.js`

### 5. Cursor / Agents
**Estado:** ✅ OK  
**Ubicación:** `agents/manifest.yaml`, `scripts/cursor-agents/`

**Características:**
- Auto-activación GDD: `scripts/cursor-agents/auto-gdd-activation.js`
- Detección de triggers: `scripts/cursor-agents/detect-triggers.js`
- Reglas SSOT enforcement en `.cursor/rules/`

**Garantías:**
- ✅ Activation flow funcional
- ✅ SSOT enforcement activo
- ✅ Reglas de escritura segura definidas

---

## ⚠️ Componentes con Gaps

### 1. SSOT v2
**Estado:** ✅ Completado (Sección Gatekeeper añadida)  
**Ubicación:** `docs/SSOT-V2.md`

**Gaps detectados:**
1. ✅ **Sección Gatekeeper añadida** - Documentada en sección 4 del SSOT v2
2. ⚠️ **Referencias legacy en código** - Se encontraron referencias a planes legacy (`free`, `basic`, `creator_plus`) en código, pero son mapeos/comentarios, no valores hardcoded problemáticos

**Acciones requeridas:**
- [x] Añadir sección Gatekeeper al SSOT v2
- [ ] Auditar y migrar referencias legacy a planes v2 (`starter`, `pro`, `plus`) - Baja prioridad (son mapeos)
- [ ] Validar que todos los valores usados están definidos en SSOT

### 2. Supabase
**Estado:** ✅ Completado  
**Ubicación:** `supabase/migrations/`, `database/schema.sql`

**Gaps detectados:**
1. ✅ **admin_settings documentado en schema.sql** - Añadida definición completa con RLS

**Acciones requeridas:**
- [x] Añadir definición de `admin_settings` a `database/schema.sql`
- [x] Crear migración `032_add_admin_settings_v2.sql`
- [x] Añadir RLS policy para admin-only access
- [ ] Verificar que todas las migraciones están aplicadas (pendiente ejecución)
- [x] Validar RLS y permisos de `admin_settings` (documentado)

**Estructura esperada de `admin_settings`:**
```sql
CREATE TABLE admin_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);
```

### 3. Feature Flags v2
**Estado:** ⚠️ Legacy  
**Ubicación:** `src/routes/admin/featureFlags.js`

**Gaps detectados:**
1. **Usa tabla `feature_flags` separada** - Según SSOT v2, debería usar `admin_settings.feature_flags`

**Acciones requeridas:**
- [ ] Migrar feature flags a `admin_settings.feature_flags` (estructura JSONB)
- [ ] Actualizar `src/routes/admin/featureFlags.js` para usar SettingsLoader v2
- [ ] Migrar datos existentes de `feature_flags` a `admin_settings`
- [ ] Deprecar tabla `feature_flags` (marcar como legacy)

**Estructura esperada en `admin_settings`:**
```json
{
  "key": "feature_flags.autopost_enabled",
  "value": true
}
```

### 4. Observabilidad
**Estado:** ✅ OK (Validado)  
**Ubicación:** `src/utils/advancedLogger.js`, `src/utils/logger.js`

**Características:**
- ✅ Winston-based structured logging con formato JSON
- ✅ Daily rotating file transports
- ✅ Correlation IDs (UUID v4) propagados
- ✅ End-to-end traceability
- ✅ ISO 8601 timestamps
- ✅ Categorías de logs (workers, application, security, integrations, shield, audit)

**Garantías:**
- ✅ Structured logging disponible vía `advancedLogger`
- ✅ JSON format para agregación de logs
- ✅ Correlation IDs para trazabilidad
- ✅ Logger básico (`logger.js`) disponible para compatibilidad

**Nota:** El logger básico (`src/utils/logger.js`) no tiene structured logging, pero `advancedLogger.js` sí lo tiene y es el recomendado para workers y servicios. Issue #417 implementó la infraestructura completa.

---

## 📝 Asunciones para Flujos V2

Al construir flujos V2 (Auth, Ingestion, Analysis, Output, etc.), puedes asumir:

### ✅ Disponible
1. **SettingsLoader v2** - Carga configuración desde SSOT v2
2. **Endpoints v2** - `/api/v2/settings/*` y `/api/v2/admin/settings/*` disponibles
3. **Gatekeeper** - Configuración dinámica desde admin_settings
4. **CI validadores** - Scripts de validación v2 disponibles
5. **Cursor/Agents** - Auto-activación y SSOT enforcement activos

### ⚠️ Pendiente (completar antes de escalar)
1. **Feature Flags v2** - Migrar a `admin_settings.feature_flags`
2. **SSOT v2** - Completar sección Gatekeeper
3. **Supabase** - Documentar `admin_settings` en schema.sql
4. **Observabilidad** - Validar structured logging

### ❌ No Disponible
1. **Ninguna dependencia de V1** - Todos los flujos V2 deben usar solo infraestructura V2
2. **Hardcoded values** - Todos los valores deben venir de SSOT v2
3. **Derivation** - Solo projection desde SettingsLoader v2

---

## ✅ Checklist de Infra Común Lista

Usa este checklist antes de iniciar migración de flujos V2:

### SSOT v2
- [x] SSOT v2 completo y validado (sección Gatekeeper añadida)
- [x] Todas las secciones requeridas presentes
- [ ] No hay referencias legacy en código (baja prioridad - son mapeos)
- [ ] Todos los valores usados están definidos

### Supabase
- [x] Tabla `admin_settings` existe y está documentada en schema.sql
- [x] Migración creada: `032_add_admin_settings_v2.sql`
- [x] RLS y permisos configurados (admin-only policy)
- [x] Schema.sql actualizado

### SettingsLoader v2
- [ ] SettingsLoader v2 funcional
- [ ] `admin-controlled.yaml` existe y está actualizado
- [ ] Cache funcionando correctamente
- [ ] Fallbacks seguros implementados

### Endpoints Transversales
- [ ] `/api/v2/settings/*` disponibles
- [ ] `/api/v2/admin/settings/*` disponibles
- [ ] Endpoints registrados en app principal
- [ ] Autenticación configurada donde aplica

### Feature Flags v2
- [ ] Feature flags migrados a `admin_settings.feature_flags`
- [ ] Routes actualizados para usar SettingsLoader v2
- [ ] Datos migrados desde tabla legacy
- [ ] Tabla `feature_flags` marcada como legacy

### Gatekeeper
- [ ] Gatekeeper configurado
- [ ] Integración con SettingsLoader v2
- [ ] Configuración dinámica funcionando

### Observabilidad Base
- [x] Logging estructurado (JSON) - vía advancedLogger.js
- [x] Correlation IDs (UUID v4) - implementado
- [x] End-to-end traceability - implementado
- [ ] Slugs de error estables - pendiente validación exhaustiva
- [ ] Integración con sistemas externos (Axiom/Datadog/Sentry) - pendiente configuración

### CI / GitHub Actions
- [ ] CI usando Vitest-first
- [ ] Validadores v2 disponibles
- [ ] Workflows consolidados

### Cursor / Agents
- [ ] Activation flow funcional
- [ ] SSOT enforcement activo
- [ ] Reglas de escritura segura definidas

---

## 🔄 Próximos Pasos

1. **Completar gaps identificados:**
   - Migrar feature flags a `admin_settings.feature_flags`
   - Añadir sección Gatekeeper al SSOT v2
   - Documentar `admin_settings` en schema.sql
   - Validar structured logging

2. **Validar infraestructura:**
   - Ejecutar `node scripts/audit-v2-infrastructure.js`
   - Verificar que todos los componentes están OK
   - Ejecutar tests de integración

3. **Documentar decisiones:**
   - Actualizar este documento con decisiones tomadas
   - Documentar cualquier workaround temporal

4. **Iniciar migración de flujos:**
   - Una vez completado el checklist, los flujos V2 pueden comenzar
   - Cada flujo debe usar solo infraestructura V2
   - No añadir infraestructura adicional en flujos

---

## 📚 Referencias

- **SSOT v2:** `docs/SSOT-V2.md`
- **System Map v2:** `docs/system-map-v2.yaml`
- **SettingsLoader v2:** `src/services/settingsLoaderV2.js`
- **V2 Endpoints:** `src/routes/v2/`
- **Plan de Trabajo:** `docs/plan/issue-ROA-369.md`
- **Script de Auditoría:** `scripts/audit-v2-infrastructure.js`

---

**Última actualización:** 2025-12-19  
**Próxima revisión:** Después de completar gaps

