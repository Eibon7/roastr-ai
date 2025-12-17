# Admin Settings Migration - ROA-268

**Status:** ⚠️ Pendiente aplicación manual  
**Priority:** P1  
**Issue:** #1090 (ROA-268)  
**Date:** 2025-01-27

---

## 🎯 Objetivo

Aplicar la migración `031_create_admin_settings.sql` en Supabase para crear la tabla `admin_settings` que forma parte de la infraestructura SSOT v2.

---

## 📋 Estado Actual

✅ **Migración SQL lista:**
- Archivo: `database/migrations/031_create_admin_settings.sql`
- Código backend v2 listo para usar la tabla
- Script helper: `scripts/apply-admin-settings-migration.js`

❌ **Database migration not applied:**
- Tabla `admin_settings` no existe en Supabase
- Migración pendiente de aplicar manualmente

---

## 🚀 Cómo Aplicar la Migración

### Opción 1: Manual (Recomendado - 2 minutos)

```bash
# 1. Ejecutar script helper para instrucciones
node scripts/apply-admin-settings-migration.js

# 2. Seguir la URL proporcionada:
# https://supabase.com/dashboard/project/{project-ref}/sql/new

# 3. Copiar SQL desde:
database/migrations/031_create_admin_settings.sql

# 4. Pegar y ejecutar en el SQL Editor

# 5. Verificar:
SELECT COUNT(*) FROM admin_settings;
-- Debe retornar 0 (tabla vacía inicialmente es esperado)
```

### Opción 2: CLI (si supabase CLI está instalado)

```bash
supabase db push
# o
supabase migration apply 031_create_admin_settings
```

---

## ✅ Qué Crea Esta Migración

### Tabla `admin_settings`

- **Propósito:** Configuración dinámica en runtime para SSOT v2
- **Estructura:**
  - `key` (TEXT PRIMARY KEY): Ruta con puntos (ej: `shield.default_aggressiveness`)
  - `value` (JSONB): Valor del setting
  - `updated_at` (TIMESTAMPTZ): Auto-actualizado
  - `created_at` (TIMESTAMPTZ): Timestamp de creación

### Características

- ✅ **RLS habilitado:** Solo `service_role` puede acceder
- ✅ **Trigger automático:** Actualiza `updated_at` en cada UPDATE
- ✅ **Índice:** En `updated_at` para consultas eficientes
- ✅ **Comentarios:** Documentación en tabla y columnas

---

## 🔍 Verificación Post-Migración

### 1. Verificar que la tabla existe

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'admin_settings';
```

### 2. Verificar estructura de columnas

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'admin_settings'
ORDER BY ordinal_position;
```

### 3. Verificar RLS policies

```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'admin_settings';
```

### 4. Verificar trigger

```sql
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'admin_settings';
```

---

## 📊 Impacto

**Sin impacto en flujos core MVP:**
- ✅ Signup/Login funcionan
- ✅ Roast generation funciona
- ✅ Analysis funciona
- ✅ Todos los flujos críticos operativos

**Funcionalidad habilitada después de migración:**
- ✅ Configuración dinámica desde BD (override de YAML)
- ✅ Sistema SSOT v2 completamente funcional
- ✅ Backend v2 puede cargar settings desde BD
- ✅ Admin panel puede modificar settings en runtime

---

## 🔗 Referencias

- **Issue original:** #1090
- **Plan de implementación:** `docs/plan/issue-1090.md`
- **Completion report:** `docs/plan/issue-1090-COMPLETION.md`
- **SSOT Architecture:** `docs/architecture/sources-of-truth.md`
- **Backend v2:** `apps/backend-v2/src/lib/loadSettings.ts`

---

## 📝 Notas

- Esta migración es parte de la infraestructura SSOT v2
- La tabla `admin_settings` permite override de valores en `admin-controlled.yaml`
- Prioridad: `admin_settings` (runtime) > YAML (build-time)
- Solo `service_role` puede acceder por seguridad

---

**Última actualización:** 2025-01-27  
**Responsable:** ROA-268

