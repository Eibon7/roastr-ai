# Plan: Issue #1090 - Crear Infraestructura SSOT (Single Source Of Truth) para v2

**Issue:** #1090  
**Fecha:** 2025-01-27  
**Estado:** ✅ Implementación completada - Pendiente validación  
**Prioridad:** P1

---

## 🎯 Objetivo

Crear TODA la infraestructura necesaria para gestionar Single Sources of Truth en la arquitectura v2 sin depender de ningún componente legacy.

---

## 📋 Estado Actual

- ❌ No existe `apps/backend-v2/` (debe crearse)
- ❌ No existe `docs/architecture/sources-of-truth.md`
- ❌ No existe `apps/backend-v2/src/config/admin-controlled.yaml`
- ❌ No existe `apps/backend-v2/src/lib/loadSettings.ts`
- ❌ No existe tabla `admin_settings` en Supabase
- ❌ No existe endpoint `/api/v2/settings/public`

**Legacy (NO usar):**

- ✅ Existe `organization_settings` (v1 - NO usar)
- ✅ Existe `global_shield_settings` (v1 - NO usar)
- ✅ Existe `shieldSettingsService.js` (v1 - NO usar)

---

## 🚀 Pasos de Implementación

### FASE 1: Crear Estructura Base de backend-v2

1. **Crear directorio base:**

   ```
   apps/backend-v2/
   ├── src/
   │   ├── config/
   │   ├── lib/
   │   ├── routes/
   │   └── types/
   ├── tests/
   │   └── unit/
   │       └── lib/
   └── package.json
   ```

2. **Crear package.json básico** con dependencias:
   - `yaml` (para leer YAML)
   - `@supabase/supabase-js` (para Supabase)
   - `typescript` (TypeScript)
   - `vitest` (testing)

### FASE 2: Documentación SSOT

3. **Crear `docs/architecture/sources-of-truth.md`:**
   - Definición de SSOT
   - Cuándo usar BD vs YAML
   - Lista inicial de parámetros configurables
   - Ejemplos de lectura desde backend

### FASE 3: Configuración Estática

4. **Crear `apps/backend-v2/src/config/admin-controlled.yaml`:**
   - Estructura base con valores placeholder
   - Secciones: shield, analysis, roasting, etc.

### FASE 4: Módulo de Carga

5. **Crear `apps/backend-v2/src/lib/loadSettings.ts`:**
   - Cargar YAML (admin-controlled.yaml)
   - Cargar tabla dinámica (admin_settings)
   - Combinar ambos (prioridad: admin_settings > YAML)
   - API pública: `loadSettings()`, `getSetting()`

### FASE 5: Migración de Base de Datos

6. **Crear migración para tabla `admin_settings`:**
   ```sql
   CREATE TABLE admin_settings (
     key TEXT PRIMARY KEY,
     value JSONB NOT NULL,
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

### FASE 6: Endpoint Público

7. **Crear `apps/backend-v2/src/routes/settings.ts`:**
   - `GET /api/v2/settings/public`
   - Devuelve SOLO parámetros permitidos al frontend
   - Nunca enviar claves internas o valores de seguridad

### FASE 7: Tests

8. **Crear `apps/backend-v2/tests/unit/lib/loadSettings.test.ts`:**
   - Lee YAML correctamente
   - Lee admin_settings correctamente
   - admin_settings overridea YAML
   - Devuelve errores claros cuando un valor no existe

---

## 📁 Archivos a Crear

1. `docs/architecture/sources-of-truth.md`
2. `apps/backend-v2/src/config/admin-controlled.yaml`
3. `apps/backend-v2/src/lib/loadSettings.ts`
4. `apps/backend-v2/src/routes/settings.ts`
5. `apps/backend-v2/tests/unit/lib/loadSettings.test.ts`
6. `database/migrations/XXX_create_admin_settings.sql`
7. `apps/backend-v2/package.json`
8. `apps/backend-v2/tsconfig.json`

---

## 🔧 Agentes Relevantes

- **Back-end Dev** - Implementación principal
- **Test Engineer** - Tests unitarios
- **Guardian** - Validación de seguridad y SSOT compliance

---

## ✅ Validación Requerida

- [ ] Tests unitarios pasando (100%) - **Pendiente ejecutar**
- [ ] Coverage >= 90% - **Pendiente verificar**
- [ ] GDD validado: `node scripts/validate-gdd-runtime.js --full` - **Pendiente**
- [ ] Health score >= 87: `node scripts/score-gdd-health.js --ci` - **Pendiente**
- [ ] CodeRabbit = 0 comentarios - **Pendiente PR**
- [ ] Reglas SSOT cumplidas (sin valores hardcoded) - ✅ **Verificado en código**

## 📝 Estado de Implementación

### ✅ Completado

1. ✅ `docs/architecture/sources-of-truth.md` - Documentación SSOT completa
2. ✅ `apps/backend-v2/src/config/admin-controlled.yaml` - Configuración estática
3. ✅ `apps/backend-v2/src/lib/loadSettings.ts` - Módulo de carga SSOT
4. ✅ `database/migrations/031_create_admin_settings.sql` - Migración de tabla
5. ✅ `apps/backend-v2/src/routes/settings.ts` - Endpoint público
6. ✅ `apps/backend-v2/tests/unit/lib/loadSettings.test.ts` - Tests unitarios
7. ✅ `apps/backend-v2/package.json` - Dependencias configuradas
8. ✅ `apps/backend-v2/tsconfig.json` - Configuración TypeScript

### ⚠️ Pendiente

- Ejecutar tests y verificar que pasan
- Verificar que no hay errores de compilación TypeScript
- Validar GDD
- Crear PR y verificar CodeRabbit

---

## 🚫 Fuera de Alcance

- ❌ No migrar nada de v1
- ❌ No tocar `organization_settings`
- ❌ No tocar `global_shield_settings`
- ❌ No mover lógica legacy a v2

---

## 📝 Notas

- Esta es la primera infraestructura de v2, debe ser limpia y sin dependencias legacy
- Todos los valores deben cargarse desde SSOT, nunca hardcoded
- La tabla `admin_settings` es dinámica (runtime), YAML es estático (build-time)
