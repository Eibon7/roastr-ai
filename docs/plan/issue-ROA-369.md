# Plan de Trabajo - ROA-369: Auditoría y Completar Infraestructura Común V2

**Issue:** ROA-369  
**Título:** c1-auth-supabase-data-migration-v2  
**Tipo:** Infraestructura / Habilitadora  
**Prioridad:** P0 (Bloquea migración de flujos)

---

## 🎯 Objetivo

Auditar y completar toda la infraestructura transversal V2, garantizando que:
- No existen dependencias implícitas de V1
- Todos los flujos V2 pueden reutilizar la infraestructura sin workarounds
- El SSOT es la única fuente de verdad
- Cursor y los agents pueden operar con reglas claras y estables

---

## 📋 Alcance

### 1. Auditoría de Infraestructura Común V2

#### 1.1 SSOT v2
- [ ] Revisar estructura y secciones activas
- [ ] Verificar uso real por backend y frontend
- [ ] Identificar referencias a valores legacy v1
- [ ] Validar que todos los valores usados están definidos

#### 1.2 Supabase
- [ ] Revisar tabla `admin_settings`
- [ ] Verificar migraciones aplicadas
- [ ] Auditar RLS y permisos
- [ ] Validar estructura de datos v2

#### 1.3 SettingsLoader v2
- [ ] Verificar lectura dinámica
- [ ] Validar fallbacks seguros
- [ ] Revisar hot reload si aplica
- [ ] Comprobar integración con SSOT

#### 1.4 Endpoints Transversales
- [ ] `/api/v2/settings/public`
- [ ] `/api/v2/admin/settings/*`
- [ ] Verificar que no dependen de V1

#### 1.5 Feature Flags v2
- [ ] Revisar estructura en `admin_settings.feature_flags`
- [ ] Validar que no hay flags hardcodeados
- [ ] Verificar categorización

#### 1.6 Gatekeeper (Seguridad / Abuso)
- [ ] Revisar configuración
- [ ] Validar integración con SSOT
- [ ] Verificar reglas de detección

#### 1.7 Observabilidad Base
- [ ] Logging estructurado
- [ ] Slugs de error estables
- [ ] Integración con sistemas externos

#### 1.8 CI / GitHub Actions
- [ ] Vitest-first
- [ ] Validadores v2
- [ ] Workflows consolidados

#### 1.9 Cursor / Agents
- [ ] Activation Flow
- [ ] SSOT enforcement
- [ ] Reglas de escritura segura

### 2. Completar Gaps Detectados

Para cada gap identificado:
- [ ] Implementar solución una sola vez
- [ ] Documentar decisión
- [ ] Añadir tests mínimos si aplica
- [ ] Evitar duplicar lógica

### 3. Documentación

- [ ] Crear `docs/architecture/v2-common-infrastructure.md`
- [ ] Incluir qué está listo
- [ ] Documentar garantías ofrecidas
- [ ] Definir asunciones para flujos V2
- [ ] Crear checklist reutilizable

---

## 🔍 Fase 1: Auditoría

### Paso 1.1: SSOT v2
**Archivos a revisar:**
- `docs/SSOT-V2.md`
- `src/services/*` (búsqueda de referencias)
- `frontend/src/**` (búsqueda de referencias)

**Comandos:**
```bash
# Buscar referencias a valores legacy
grep -r "free\|basic\|creator_plus" src/ --exclude-dir=node_modules
grep -r "free\|basic\|creator_plus" frontend/src/ --exclude-dir=node_modules

# Verificar uso de SSOT
grep -r "SSOT\|ssot" src/ --exclude-dir=node_modules
```

### Paso 1.2: Supabase
**Archivos a revisar:**
- `supabase/migrations/*`
- `database/schema.sql`
- `src/config/supabase.js`
- `src/services/settingsLoader.js` (si existe)

**Comandos:**
```bash
# Verificar migraciones
ls -la supabase/migrations/
ls -la database/migrations/

# Buscar referencias a admin_settings
grep -r "admin_settings" src/
```

### Paso 1.3: SettingsLoader v2
**Archivos a revisar:**
- `src/services/settingsLoader.js`
- `src/services/ssotLoader.js` (si existe)
- Cualquier servicio que cargue settings

### Paso 1.4: Endpoints Transversales
**Archivos a revisar:**
- `src/routes/settings.js`
- `src/routes/admin.js`
- `src/routes/v2/*` (si existe)

### Paso 1.5: Feature Flags v2
**Archivos a revisar:**
- `src/services/featureFlagsService.js` (si existe)
- Cualquier uso de feature flags en código

### Paso 1.6: Gatekeeper
**Archivos a revisar:**
- `src/services/gatekeeperService.js`
- `docs/SSOT-V2.md` (sección gatekeeper)

### Paso 1.7: Observabilidad
**Archivos a revisar:**
- `src/utils/logger.js`
- `src/utils/authErrorTaxonomy.js`
- Configuración de logging

### Paso 1.8: CI / GitHub Actions
**Archivos a revisar:**
- `.github/workflows/ci.yml`
- `.github/workflows/*.yml`
- Scripts de validación v2

### Paso 1.9: Cursor / Agents
**Archivos a revisar:**
- `scripts/cursor-agents/*`
- `.cursor/rules/*`
- `agents/manifest.yaml`

---

## 🔧 Fase 2: Completar Gaps

### Estrategia
1. Para cada gap detectado:
   - Evaluar impacto
   - Implementar solución mínima viable
   - Documentar decisión
   - Añadir tests si aplica

2. Principios:
   - Una sola implementación
   - Reutilizable por todos los flujos
   - Sin dependencias de V1
   - Documentado

---

## 📝 Fase 3: Documentación

### Estructura de `docs/architecture/v2-common-infrastructure.md`

```markdown
# Infraestructura Común V2

## Estado Actual

### ✅ Listo
- [Lista de componentes listos]

### ⚠️ Parcialmente Listo
- [Lista con gaps identificados]

### ❌ Faltante
- [Lista de componentes faltantes]

## Garantías Ofrecidas

### SSOT v2
- [Garantías]

### Supabase
- [Garantías]

### SettingsLoader
- [Garantías]

## Asunciones para Flujos V2

- [Asunciones]

## Checklist de Infra Común Lista

- [ ] SSOT v2 completo y validado
- [ ] Supabase configurado
- [ ] SettingsLoader funcional
- [ ] Endpoints transversales disponibles
- [ ] Feature flags operativos
- [ ] Gatekeeper configurado
- [ ] Observabilidad base lista
- [ ] CI validado
- [ ] Cursor/Agents configurados
```

---

## ✅ Criterios de Aceptación

- [ ] Auditoría completa documentada
- [ ] Todos los gaps detectados resueltos o explícitamente descartados
- [ ] No quedan dependencias implícitas de V1
- [ ] Los flujos V2 pueden construirse sin añadir infraestructura adicional
- [ ] Checklist de infraestructura común definido y validado
- [ ] Documentación `docs/architecture/v2-common-infrastructure.md` creada

---

## 🚀 Próximos Pasos

1. Ejecutar auditoría sistemática
2. Documentar hallazgos
3. Priorizar gaps
4. Implementar soluciones
5. Validar con tests
6. Documentar resultado final

---

## 📚 Referencias

- SSOT v2: `docs/SSOT-V2.md`
- System Map v2: `docs/system-map-v2.yaml`
- GDD Activation Guide: `docs/GDD-ACTIVATION-GUIDE.md`
- Cursor Rules: `.cursor/rules/*`

